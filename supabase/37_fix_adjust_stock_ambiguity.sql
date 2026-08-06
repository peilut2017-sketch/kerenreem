-- ============================================================================
-- מכון קרן רא"ם — תיקון: "column reference on_hand is ambiguous" בתנועת מלאי
-- להרצה אחרי 36_v11_corrections.sql (ובטוח להרצה גם בלעדיו)
-- ============================================================================
-- הבאג: ‏commerce_adjust_stock מוגדרת עם
--     returns table (ok boolean, reason text, on_hand int)
-- כלומר `on_hand` הוא *פרמטר פלט* של הפונקציה. בגוף הפונקציה הופיעה השורה
--     update inventory_levels set on_hand = on_hand + p_delta ...
-- וב-plpgsql הביטוי שמימין ל-‎=‎ מתפרש בשני מרחבי שמות בו-זמנית — עמודת
-- הטבלה ופרמטר הפלט — ולכן Postgres נכשל ב-‏42702 ‏(ambiguous). התוצאה:
-- כל תנועת מלאי ידנית (קליטה, ספירה, נזק, החזרה) נכשלה, והמסך הציג שגיאה.
--
-- התיקון: הסמכה מפורשת של כל התייחסות לעמודה בשם הזה (‏il.on_hand) —
-- ולא שינוי שם עמודת הפלט, כי הקוד באפליקציה קורא `row.on_hand`.
--
-- הבאג היה קיים כבר ב-30_inventory.sql ועבר לגרסת 36; הקובץ הזה מחליף את
-- שתיהן. ‏create or replace ⇒ בטוח להרצה חוזרת.
-- ============================================================================

-- הגרסה הישנה בת 7 הפרמטרים (מ-30) — מוסרת כדי שלא יישאר overload דו-משמעי
-- מול הגרסה בת 8 הפרמטרים (עם המיקום). אם 36 כבר רץ, זו פעולה ריקה.
drop function if exists public.commerce_adjust_stock(uuid, int, text, text, uuid, uuid, text);

create or replace function public.commerce_adjust_stock(
  p_book_id uuid, p_delta int, p_move_type text,
  p_reason text default null, p_order_id uuid default null,
  p_actor_id uuid default null, p_note text default null,
  p_location_id uuid default null
)
returns table (ok boolean, reason text, on_hand int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_location uuid;
  v_level    inventory_levels;
begin
  if p_move_type not in ('receive', 'cancel_restock', 'return_restock', 'damage', 'manual_adjust', 'count') then
    return query select false, 'invalid_move_type', 0; return;
  end if;
  if p_delta = 0 then
    return query select false, 'zero_delta', 0; return;
  end if;

  -- מיקום מפורש (ריבוי מחסנים) או מיקום ברירת המחדל
  select coalesce(p_location_id, (select sl.id from stock_locations sl where sl.is_default))
    into v_location;
  if v_location is null then
    return query select false, 'no_location', 0; return;
  end if;

  insert into inventory_levels (book_id, location_id)
  values (p_book_id, v_location)
  on conflict (book_id, location_id) do nothing;

  select * into v_level from inventory_levels il
  where il.book_id = p_book_id and il.location_id = v_location
  for update;

  if v_level.on_hand + p_delta < 0 then
    return query select false, 'would_go_negative', v_level.on_hand; return;
  end if;
  if v_level.on_hand + p_delta < v_level.reserved then
    return query select false, 'below_reserved', v_level.on_hand; return;
  end if;

  insert into inventory_moves
    (book_id, location_id, move_type, quantity_delta,
     on_hand_before, on_hand_after, reserved_before, reserved_after,
     reason, order_id, actor_type, actor_id, note)
  values
    (p_book_id, v_location, p_move_type, p_delta,
     v_level.on_hand, v_level.on_hand + p_delta, v_level.reserved, v_level.reserved,
     p_reason, p_order_id, case when p_actor_id is null then 'system' else 'staff' end,
     p_actor_id, p_note);

  -- ↓ ליבת התיקון: il.on_hand מוסמך, ולכן אינו מתנגש בפרמטר הפלט on_hand
  update inventory_levels il
  set on_hand = il.on_hand + p_delta
  where il.book_id = p_book_id and il.location_id = v_location;

  return query select true, 'ok', v_level.on_hand + p_delta;
end $$;

revoke all on function public.commerce_adjust_stock(uuid, int, text, text, uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.commerce_adjust_stock(uuid, int, text, text, uuid, uuid, text, uuid)
  to service_role;

-- ============================================================================
-- בדיקה מהירה אחרי ההרצה (מחליפים את המזהה בספר אמיתי; מוסיף 1 ומיד מוריד 1):
--   select * from commerce_adjust_stock(
--     '00000000-0000-0000-0000-000000000000'::uuid, 1, 'count', 'בדיקת תקינות');
--   ⇒ מצופה: ok=true, reason='ok', on_hand=<המלאי החדש>
--
-- Rollback: הרצת ההגדרה מ-36_v11_corrections.sql (הגרסה עם הבאג) — אין סיבה.
-- ============================================================================
