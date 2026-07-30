-- ============================================================================
-- מכון קרן רא"ם — שלב ג׳: שכבת הנתונים של עמוד תצוגת הספר
-- להרצה אחרי 09_catalogue_numbers.sql
-- ============================================================================
-- עמוד הספר החדש אינו עמוד מוצר אלא "מרחב ידע": תוכן עניינים, גלריה,
-- סדרות וקשרים בין ספרים. הקובץ הזה מוסיף את מה שחסר במסד כדי שיהיה מה
-- להציג שם — בלי להמציא נתונים שאינם קיימים.
--
-- שלוש החלטות שכדאי להבין לפני שמרחיבים כאן:
--
-- 1. מונה הצפיות יושב על books ומתעדכן דרך פונקציית security definer ולא
--    דרך update ישיר. ה-RLS חוסם כתיבה ל-anon בכוונה, ולפתוח אותה כדי
--    למנות צפיות היה פותח גם את היכולת לשנות מחיר או למחוק ספר. פונקציה
--    שמעדכנת עמודה אחת בלבד היא הפתח הצר שאפשר להסביר.
--
-- 2. תוכן העניינים הוא טבלה ולא JSON על הספר. הוא נדרש לחיפוש ("באיזה
--    ספר יש פרק על גרמא"), לקישור לעמוד, ולעריכה שורה-שורה. JSON היה
--    מחייב לקרוא ולכתוב את כולו בכל תיקון של שורה אחת.
--
-- 3. סדרה היא ישות בפני עצמה ולא שדה טקסט על הספר. "אותה סדרה" הוא קשר
--    שצריך להיות אמין: שדה טקסט חופשי מייצר "שו״ת" ו"שו״ת " כשתי סדרות
--    שנראות זהות ברשימה ואינן מתחברות זו לזו.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. סדרות
-- ----------------------------------------------------------------------------
create table if not exists series (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name_he         text not null,
  name_en         text,
  description_he  text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint series_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint series_name_len check (char_length(name_he) between 1 and 120)
);

alter table books add column if not exists series_id uuid references series(id) on delete set null;
-- מיקום הכרך בתוך הסדרה (כרך א׳ = 1). null = שייך לסדרה בלי סדר מוגדר.
alter table books add column if not exists series_position int;

create index if not exists idx_books_series on books (series_id, series_position);

drop trigger if exists trg_series_updated on series;
create trigger trg_series_updated before update on series
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 1א. ציטוטים מתוך הספר
-- ----------------------------------------------------------------------------
-- מערך טקסט פשוט על הספר ולא טבלה: לציטוט אין כאן שדות נלווים (לא page
-- number מובנה, לא מחבר משני) שמצדיקים ישות בפני עצמה, ועורך שרוצה
-- להוסיף שורה לא צריך מסך נפרד בשביל זה.
alter table books add column if not exists quotes text[] not null default '{}';

-- ----------------------------------------------------------------------------
-- 2. גלריית תמונות נוספות
-- ----------------------------------------------------------------------------
-- הכריכה נשארת על books.cover_image_url: היא התמונה היחידה שכל תצוגה
-- באתר זקוקה לה (כרטיס, רשימה, שיתוף), ושליפתה לא צריכה להיות join.
-- כאן נשמרות רק התמונות *הנוספות* — פתיחת שער, דוגמת עמוד, כריכה אחורית.
create table if not exists book_images (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references books(id) on delete cascade,
  image_url   text not null,
  alt         text,
  caption_he  text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists idx_book_images_book on book_images (book_id, sort_order);

-- ----------------------------------------------------------------------------
-- 3. תוכן עניינים
-- ----------------------------------------------------------------------------
create table if not exists book_toc (
  id           uuid primary key default gen_random_uuid(),
  book_id      uuid not null references books(id) on delete cascade,
  title_he     text not null,
  -- עומק ההיררכיה: 0 = פרק ראשי, 1 = תת-פרק. שני מפלסים מספיקים לתוכן
  -- עניינים שנועד לקריאה ולא לניווט מלא בספר.
  level        int not null default 0,
  page_number  int,
  -- תקציר קצר של הפרק, למי שרוצה לדעת מה יש בו בלי לפתוח את הספר
  summary_he   text,
  sort_order   int not null default 0,
  created_at   timestamptz not null default now(),

  constraint book_toc_level_range check (level between 0 and 1),
  constraint book_toc_title_len check (char_length(title_he) between 1 and 300)
);

create index if not exists idx_book_toc_book on book_toc (book_id, sort_order);

-- ----------------------------------------------------------------------------
-- 3א. הסבר לתגית
-- ----------------------------------------------------------------------------
-- "למה קיבל את התג הזה" — מוצג ב-Tooltip בעמוד הספר. אופציונלי במכוון:
-- תגיות מערכת (חדש, רב מכר) יקבלו הסבר קבוע בקוד התצוגה גם בלעדיו.
alter table tags add column if not exists description_he text;

-- ----------------------------------------------------------------------------
-- 4. מונה צפיות
-- ----------------------------------------------------------------------------
alter table books add column if not exists view_count bigint not null default 0;

-- ספירה גסה במכוון: אין כאן ניכוי בוטים, אין ייחוד לפי מבקר, ואין חלון
-- זמן. "פופולרי" באתר של מכון תורני הוא רמז לסקרנות ולא מדד שמישהו
-- מקבל לפיו החלטה, ומנגנון מדויק היה דורש טבלת אירועים שלמה.
create or replace function public.increment_book_view(target_slug text)
returns void
language plpgsql
security definer
-- search_path מקובע: פונקציית security definer בלי זה חשופה להשתלטות דרך
-- schema שהקורא שולט בו
set search_path = public, pg_temp
as $$
begin
  update books set view_count = view_count + 1
  where slug = target_slug and is_published;
end $$;

revoke all on function public.increment_book_view(text) from public;
grant execute on function public.increment_book_view(text) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 5. RLS
-- ----------------------------------------------------------------------------
-- כמו בשלב א׳: קריאה ציבורית (אלה נתוני קטלוג), כתיבה לצוות בלבד. הסתרת
-- טיוטות נעשית ב-books עצמו, ולכן אין כאן תנאי is_published כפול.
do $$
declare t text;
begin
  foreach t in array array['series', 'book_images', 'book_toc']
  loop
    execute format('alter table %I enable row level security', t);

    execute format('drop policy if exists %I on %I', t || '_public_read', t);
    execute format(
      'create policy %I on %I for select using (true)', t || '_public_read', t
    );

    execute format('drop policy if exists %I on %I', t || '_edit', t);
    execute format(
      'create policy %I on %I for all using (public.can_edit()) with check (public.can_edit())',
      t || '_edit', t
    );

    execute format('grant select on %I to anon, authenticated', t);
    execute format('grant insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

-- ============================================================================
-- מה במכוון אינו כאן
-- ----------------------------------------------------------------------------
--   "נקנו יחד" ו"מי שקרא את זה קרא גם" — דורשים נתוני רכישה או מעקב
--   מבקרים שאין. קרוסלה כזו שנבנית בלי נתונים היא ניחוש שמוצג כעובדה,
--   וזו בדיוק הטעות שעמוד ידע צריך להימנע ממנה. הקשרים בעמוד נגזרים
--   ממה שקיים: מחבר, קטגוריה, תגיות וסדרה.
--
--   OCR וחיפוש בתוך הספר — דורשים עיבוד קבצים שאינו קיים עדיין. טבלת
--   book_toc היא הבסיס שעליו אפשר יהיה לבנות את זה כשיהיה.
-- ============================================================================
