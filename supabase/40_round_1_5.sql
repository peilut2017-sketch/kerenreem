-- ============================================================================
-- מכון קרן רא"ם — סבב 1.5: ביטול פעולה, בקשות שירות, מסמכים והדפסה
-- להרצה אחרי 39_round_1_4_critical_fixes.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ביטול סימון תשלום ידני בטעות (undoManualPayment): צריך היפוך אמיתי
--    ל-commerce_commit_stock — on_hand חוזר למעלה, reserved חוזר למעלה (הפריט
--    עדיין "שמור" עבור אותה הזמנה, רק שהתשלום חזר להיות לא-סופי). אין כזה
--    כיום: commerce_release_stock מסרב במפורש לפעול אחרי תנועת 'sale'
--    (בכוונה — מונע שחרור כפול של מלאי שכבר נמכר בפועל דרך המסלול הרגיל,
--    שבו "שחרור" פירושו שההזמנה בוטלה/נכשלה, לא שההזמנה עדיין פעילה).
--    זו תנועה שונה במהותה, ולכן פונקציה חדשה ולא שימוש-לרעה בקיימת.
-- ----------------------------------------------------------------------------
alter table inventory_moves drop constraint if exists inventory_moves_move_type_check;
alter table inventory_moves add constraint inventory_moves_move_type_check check (move_type in
  ('receive', 'sale', 'cancel_restock', 'return_restock', 'damage',
   'manual_adjust', 'transfer_in', 'transfer_out', 'count',
   'reserve', 'release', 'uncommit'));

drop index if exists uq_inventory_moves_order_idempotency;
create unique index uq_inventory_moves_order_idempotency
  on inventory_moves (order_id, book_id, move_type)
  where move_type in ('reserve', 'sale', 'release', 'uncommit');

create or replace function public.commerce_uncommit_stock(
  p_book_id uuid, p_qty int, p_order_id uuid
)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_level inventory_levels;
begin
  v_level := commerce_lock_level(p_book_id);

  if not exists (
    select 1 from inventory_moves
    where order_id = p_order_id and book_id = p_book_id and move_type = 'sale'
  ) then
    return query select false, 'nothing_to_uncommit'; return;
  end if;
  if exists (
    select 1 from inventory_moves
    where order_id = p_order_id and book_id = p_book_id and move_type = 'uncommit'
  ) then
    return query select true, 'already_uncommitted'; return;
  end if;

  insert into inventory_moves
    (book_id, location_id, move_type, quantity_delta,
     on_hand_before, on_hand_after, reserved_before, reserved_after, order_id)
  values
    (p_book_id, v_level.location_id, 'uncommit', p_qty,
     v_level.on_hand, v_level.on_hand + p_qty,
     v_level.reserved, v_level.reserved + p_qty, p_order_id);

  update inventory_levels
  set on_hand = on_hand + p_qty, reserved = reserved + p_qty
  where book_id = p_book_id and location_id = v_level.location_id;

  return query select true, 'uncommitted';
end $$;

revoke all on function commerce_uncommit_stock(uuid, int, uuid) from public, anon, authenticated;
grant execute on function commerce_uncommit_stock(uuid, int, uuid) to service_role;

-- ============================================================================
-- לאימות אחרי הרצה:
--   select proname from pg_proc where proname = 'commerce_uncommit_stock';
-- ============================================================================
