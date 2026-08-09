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

-- ----------------------------------------------------------------------------
-- 2. בקשות שירות (ביטול/החזרה) — ישות אמיתית במקום תג+אירוע. עד כה
--    "בקשת ביטול" חייתה רק כתג cancel-requested על ההזמנה: cancelOrder
--    אינו נוגע ב-tags בכלל, כך שהתג נשאר לנצח והתור "בקשות ביטול" באדמין
--    נסתם עם הזמנות שכבר טופלו לפני זמן רב. גם אין ישות "החזרה" בכלל —
--    fulfillment_state='returned' קיים במכונה בלי שום תהליך סביבו.
--    כאן גם התשתית ל"טופס החזרה" המודפס (מספר בקשה + QR).
-- ----------------------------------------------------------------------------
create table if not exists service_requests (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete cascade,
  kind            text not null check (kind in ('cancel', 'return')),
  status          text not null default 'open'
                    check (status in ('open', 'in_progress', 'resolved', 'declined')),
  reason          text,
  requested_by    text not null default 'customer' check (requested_by in ('customer', 'staff')),
  items           jsonb,
  resolution_note text,
  resolved_at     timestamptz,
  resolved_by     uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_service_requests_order on service_requests (order_id);
create index if not exists idx_service_requests_status on service_requests (status, created_at desc);
-- לא לאפשר שתי בקשות פתוחות מאותו סוג על אותה הזמנה בו-זמנית
create unique index if not exists uq_service_requests_open
  on service_requests (order_id, kind)
  where status in ('open', 'in_progress');

alter table service_requests enable row level security;
revoke all on service_requests from anon, authenticated;
grant select, insert, update on service_requests to authenticated;

drop policy if exists service_requests_staff_read on service_requests;
create policy service_requests_staff_read on service_requests
  for select using (public.is_store_staff());

drop policy if exists service_requests_staff_write on service_requests;
create policy service_requests_staff_write on service_requests
  for all using (public.can_manage_store()) with check (public.can_manage_store());

-- set_updated_at() כבר קיים ומשמש טבלאות רבות באפליקציה (ראו migrations קודמות)
drop trigger if exists trg_service_requests_updated_at on service_requests;
create trigger trg_service_requests_updated_at
  before update on service_requests
  for each row execute function public.set_updated_at();

-- ============================================================================
-- לאימות אחרי הרצה:
--   select proname from pg_proc where proname = 'commerce_uncommit_stock';
--   select * from service_requests limit 1;
-- ============================================================================
