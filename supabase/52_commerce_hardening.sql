-- ============================================================================
-- מכון קרן רא"ם — הקשחת מסחר ואחסון (סקירת עומק 30.8)
-- להרצה אחרי 51_book_categories_backfill.sql
-- ============================================================================
--
-- שלושה תיקונים שעלו בסקירת האבטחה/נכונות:
--
-- 1. התאמת שריון מלאי בעריכת פריטי הזמנה.
--    commerce_reserve_stock / commerce_release_stock הן חד-פעמיות במחזור
--    חיי ההזמנה (idempotent לפי (order, book, move_type)) — וזה נכון
--    למסלול checkout/ביטול. אבל עריכת כמויות במסך ההזמנה קראה להן שוב:
--    הגדלת כמות קיבלה 'already_reserved' בלי לשריין את התוספת (מכירת
--    יתר), והקטנה רשמה 'release' שגרם לשחרור המלא בביטול מאוחר להחזיר
--    'already_released' — יתרת השריון נתקעה לנצח. הפונקציה החדשה
--    commerce_adjust_reservation מטפלת בהפרשים בלבד, בתנועת ledger
--    מסוג reserve_adjust שאינה מתנגשת עם האידמפוטנטיות של השלוש.
--
-- 2. מגבלות גודל וסוג קובץ על ה-buckets הציבוריים.
--    contact-attachments קיבל מגבלות כבר במיגרציה 20; חמשת ה-buckets
--    הציבוריים נוצרו בלעדיהן, וכל ההעלאות מתבצעות מצד הלקוח — כלומר
--    לא הייתה שום אכיפה בפועל, וכל בעל הרשאת עריכה יכול היה לאחסן כל
--    קובץ בכל גודל על הדומיין הציבורי.
--
-- 3. אינדקס מיון הקטלוג. idx_books_published_sort נבנה על
--    (sort_order, title_he) אבל getBooks ממיין לפי title_he בלבד —
--    btree אינו משרת ORDER BY על עמודה שאינה תחילית. אינדקס חלקי תואם.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1א. סוג תנועה חדש: reserve_adjust
-- ----------------------------------------------------------------------------
alter table inventory_moves drop constraint if exists inventory_moves_move_type_check;
alter table inventory_moves add constraint inventory_moves_move_type_check
  check (move_type in
    ('receive', 'sale', 'cancel_restock', 'return_restock', 'damage',
     'manual_adjust', 'transfer_in', 'transfer_out', 'count',
     'reserve', 'release', 'reserve_adjust'));

-- ----------------------------------------------------------------------------
-- 1ב. התאמת שריון קיים — לעריכת כמויות בהזמנה פעילה בלבד
-- ----------------------------------------------------------------------------
-- delta חיובי: שריון נוסף (נבדק מול הזמין); שלילי: שחרור חלקי (נחתך
-- ליתרה המשוריינת). פועלת רק כשיש שריון פעיל להזמנה (reserve קיים,
-- sale/release אינם) — אחרת no-op מוצלח: ספר שאינו מנוהל-מלאי מעולם
-- לא שוריין, ואין מה להתאים.
create or replace function public.commerce_adjust_reservation(
  p_book_id uuid, p_delta int, p_order_id uuid
)
returns table (ok boolean, reason text, available int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_level inventory_levels;
  v_change int;
begin
  if p_delta = 0 then
    return query select true, 'no_change', null::int; return;
  end if;

  v_level := commerce_lock_level(p_book_id);

  -- אין שריון פעיל — אין מה להתאים (ספר לא מנוהל, או שההזמנה כבר
  -- שולמה/שוחררה; שני המקרים נחסמים ממילא בשכבת האפליקציה).
  if not exists (
    select 1 from inventory_moves
    where order_id = p_order_id and book_id = p_book_id and move_type = 'reserve'
  ) or exists (
    select 1 from inventory_moves
    where order_id = p_order_id and book_id = p_book_id and move_type in ('sale', 'release')
  ) then
    return query select true, 'no_active_reservation', null::int; return;
  end if;

  if p_delta > 0 then
    if v_level.on_hand - v_level.reserved < p_delta then
      return query select false, 'insufficient', v_level.on_hand - v_level.reserved; return;
    end if;
    v_change := p_delta;
  else
    -- שחרור חלקי נחתך ליתרה המשוריינת — לא יורדים מתחת לאפס
    v_change := -least(v_level.reserved, -p_delta);
    if v_change = 0 then
      return query select true, 'nothing_reserved', v_level.on_hand - v_level.reserved; return;
    end if;
  end if;

  insert into inventory_moves
    (book_id, location_id, move_type, quantity_delta,
     on_hand_before, on_hand_after, reserved_before, reserved_after, order_id)
  values
    (p_book_id, v_level.location_id, 'reserve_adjust', v_change,
     v_level.on_hand, v_level.on_hand,
     v_level.reserved, v_level.reserved + v_change, p_order_id);

  update inventory_levels set reserved = reserved + v_change
  where book_id = p_book_id and location_id = v_level.location_id;

  return query select true, 'adjusted', v_level.on_hand - v_level.reserved - v_change;
end $$;

revoke all on function public.commerce_adjust_reservation(uuid, int, uuid) from public;
grant execute on function public.commerce_adjust_reservation(uuid, int, uuid) to service_role;

-- ----------------------------------------------------------------------------
-- 2. מגבלות על ה-buckets הציבוריים
-- ----------------------------------------------------------------------------
-- הערכים נגזרים מהשימוש בפועל בקוד:
--   covers    — כריכות + תמונות מהעורך העשיר (uploadToBucket ב-RichTextEditor)
--   portraits — דיוקנאות מחברים
--   events    — תמונות אירועים + מדיית הסיפור (תמונות; וידאו מוטמע רק
--               מיוטיוב/וימאו, לא מועלה לכאן)
--   samples   — PDF לדפדוף + דפי התצוגה שנגזרים ממנו (webp/png)
--   site      — לוגו, באנרים, וקובצי גופן מותקנים (FontsManager)
-- application/octet-stream נכלל בבucket הגופנים בלבד: דפדפנים רבים
-- אינם מזהים MIME לקובצי woff2/ttf ושולחים אותם כ-octet-stream —
-- בלעדיו התקנת גופן נשברת. העיקר הוא ש-text/html חסום בכולם.
update storage.buckets set
  file_size_limit = 10485760, -- 10MB
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
where id in ('covers', 'portraits', 'events');

update storage.buckets set
  file_size_limit = 62914560, -- 60MB (PDF מלא לדפדוף)
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
where id = 'samples';

update storage.buckets set
  file_size_limit = 15728640, -- 15MB
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml',
    'font/woff2', 'font/woff', 'font/ttf', 'font/otf', 'application/octet-stream'
  ]
where id = 'site';

-- ----------------------------------------------------------------------------
-- 3. יומן הביקורת פתוח לכל תפקידי הצוות
-- ----------------------------------------------------------------------------
-- המדיניות הקודמת (02_site_additions) התנתה הכנסה ב-can_edit() —
-- admin/manager/editor בלבד. דווקא התפקידים שמבצעים את הפעולות
-- הכספיות (store_manager, מוכרן, מלקט) קיבלו 42501 שקט על כל רישום:
-- זיכוי, סימון תשלום ותנועות מלאי נשארו בלי שום עקבה ביומן.
-- כל בעל פרופיל צוות רשאי לרשום את פעולותיו-שלו; היומן נותר
-- append-only (אין update/delete) וקריא ל-admin בלבד.
drop policy if exists audit_log_staff_insert on audit_log;
create policy audit_log_staff_insert on audit_log
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from profiles where id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 4. אינדקס מיון הקטלוג
-- ----------------------------------------------------------------------------
-- getBooks: where is_published order by title_he. האינדקס הקיים
-- (sort_order, title_he) נשאר לטובת שאילתות שממיינות לפי sort_order.
create index if not exists idx_books_published_title
  on books (title_he) where is_published = true;

-- getMostViewedBooks: where is_published order by view_count desc
create index if not exists idx_books_published_views
  on books (view_count desc) where is_published = true;
