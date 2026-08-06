-- ============================================================================
-- מכון קרן רא"ם — מלאי מנוהל: מיקומים, רמות, תנועות ופונקציות אטומיות
-- להרצה אחרי 29_payments_documents_webhooks.sql
-- ============================================================================
-- מקור האמת עובר מ-books.stock_quantity אל inventory_levels; העמודה
-- הישנה הופכת למטמון נגזר (סכום הזמין בכל המיקומים) שמתעדכן בטריגר —
-- כך getBookAvailability והקטלוג ממשיכים לעבוד ללא שינוי קוד.
--
-- כל שינוי כמות עובר דרך אחת מארבע פונקציות security definer שההרצה
-- שלהן מוגבלת ל-service_role: נעילת שורה, בדיקה מחדש, איסור שלילי,
-- ורישום תנועה ב-ledger — באותה טרנזקציה. Idempotency להזמנות נאכף
-- באינדקס ייחודי על (order_id, book_id, move_type).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. מיקומי מלאי
-- ----------------------------------------------------------------------------
create table if not exists stock_locations (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  kind       text not null default 'warehouse'
               check (kind in ('warehouse', 'office', 'pickup_point', 'distributor', 'temp')),
  is_default boolean not null default false,
  active     boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_stock_locations_default on stock_locations (is_default)
  where is_default;

insert into stock_locations (slug, name, kind, is_default)
values ('main', 'מחסן ראשי', 'warehouse', true)
on conflict (slug) do nothing;

-- ----------------------------------------------------------------------------
-- 2. רמות מלאי
-- ----------------------------------------------------------------------------
create table if not exists inventory_levels (
  book_id     uuid not null references books(id) on delete cascade,
  location_id uuid not null references stock_locations(id) on delete restrict,
  on_hand     int not null default 0 check (on_hand >= 0),
  reserved    int not null default 0 check (reserved >= 0),
  updated_at  timestamptz not null default now(),
  primary key (book_id, location_id),
  constraint inventory_reserved_within_on_hand check (reserved <= on_hand)
);

drop trigger if exists trg_inventory_levels_updated on inventory_levels;
create trigger trg_inventory_levels_updated
  before update on inventory_levels
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. תנועות מלאי — ledger, append-only
-- ----------------------------------------------------------------------------
create table if not exists inventory_moves (
  id              uuid primary key default gen_random_uuid(),
  book_id         uuid not null references books(id) on delete cascade,
  location_id     uuid not null references stock_locations(id) on delete restrict,
  move_type       text not null check (move_type in
    ('receive', 'sale', 'cancel_restock', 'return_restock', 'damage',
     'manual_adjust', 'transfer_in', 'transfer_out', 'count',
     'reserve', 'release')),
  quantity_delta  int not null check (quantity_delta <> 0),
  on_hand_before  int not null,
  on_hand_after   int not null,
  reserved_before int not null,
  reserved_after  int not null,
  reason          text,
  order_id        uuid references orders(id) on delete set null,
  order_item_id   uuid references order_items(id) on delete set null,
  actor_type      text not null default 'system'
                    check (actor_type in ('customer', 'staff', 'system', 'morning', 'shipping_provider')),
  actor_id        uuid,
  note            text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_inventory_moves_book on inventory_moves (book_id, created_at desc);
create index if not exists idx_inventory_moves_order on inventory_moves (order_id);
-- הפחתה/שמירה/שחרור כפולים מאותה הזמנה — בלתי אפשריים ברמת המסד
create unique index if not exists uq_inventory_moves_order_idempotency
  on inventory_moves (order_id, book_id, move_type)
  where move_type in ('reserve', 'sale', 'release');

-- ----------------------------------------------------------------------------
-- 4. מטמון books.stock_quantity — נגזר מסכום הזמין (on_hand - reserved)
-- ----------------------------------------------------------------------------
create or replace function public.refresh_book_stock_cache()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_book uuid := coalesce(new.book_id, old.book_id);
begin
  update books set stock_quantity = (
    select coalesce(sum(on_hand - reserved), 0)
    from inventory_levels where book_id = v_book
  )
  where id = v_book;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_inventory_levels_cache on inventory_levels;
create trigger trg_inventory_levels_cache
  after insert or update or delete on inventory_levels
  for each row execute function refresh_book_stock_cache();

-- Backfill: המלאי הקיים על הספר עובר למיקום ברירת המחדל
insert into inventory_levels (book_id, location_id, on_hand)
select b.id, (select id from stock_locations where is_default), coalesce(b.stock_quantity, 0)
from books b
on conflict (book_id, location_id) do nothing;

-- ----------------------------------------------------------------------------
-- 5. פונקציות אטומיות — service_role בלבד
-- ----------------------------------------------------------------------------
-- כולן פועלות על מיקום ברירת המחדל (שלב א': מיקום אחד). ריבוי מיקומים
-- בהמשך יוסיף פרמטר location — החתימה כאן נשארת, עם ברירת מחדל.

-- שורת רמות נעולה, נוצרת אם חסרה
create or replace function public.commerce_lock_level(p_book_id uuid)
returns inventory_levels
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_location uuid;
  v_level    inventory_levels;
begin
  select id into v_location from stock_locations where is_default;
  insert into inventory_levels (book_id, location_id)
  values (p_book_id, v_location)
  on conflict (book_id, location_id) do nothing;

  select * into v_level from inventory_levels
  where book_id = p_book_id and location_id = v_location
  for update;
  return v_level;
end $$;

-- שמירת מלאי להזמנה (reserved += qty). idempotent לפי (order, book, 'reserve').
create or replace function public.commerce_reserve_stock(
  p_book_id uuid, p_qty int, p_order_id uuid
)
returns table (ok boolean, reason text, available int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_level inventory_levels;
begin
  if p_qty <= 0 then
    return query select false, 'invalid_quantity', 0; return;
  end if;

  v_level := commerce_lock_level(p_book_id);

  if exists (
    select 1 from inventory_moves
    where order_id = p_order_id and book_id = p_book_id and move_type = 'reserve'
  ) then
    return query select true, 'already_reserved', v_level.on_hand - v_level.reserved; return;
  end if;

  if v_level.on_hand - v_level.reserved < p_qty then
    return query select false, 'insufficient', v_level.on_hand - v_level.reserved; return;
  end if;

  insert into inventory_moves
    (book_id, location_id, move_type, quantity_delta,
     on_hand_before, on_hand_after, reserved_before, reserved_after, order_id)
  values
    (p_book_id, v_level.location_id, 'reserve', p_qty,
     v_level.on_hand, v_level.on_hand, v_level.reserved, v_level.reserved + p_qty, p_order_id);

  update inventory_levels set reserved = reserved + p_qty
  where book_id = p_book_id and location_id = v_level.location_id;

  return query select true, 'reserved', v_level.on_hand - v_level.reserved - p_qty;
end $$;

-- אישור מכירה: השמירה הופכת להפחתה בפועל (on_hand -= qty, reserved -= qty)
create or replace function public.commerce_commit_stock(
  p_book_id uuid, p_qty int, p_order_id uuid
)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_level inventory_levels;
  v_reserved_part int;
begin
  v_level := commerce_lock_level(p_book_id);

  if exists (
    select 1 from inventory_moves
    where order_id = p_order_id and book_id = p_book_id and move_type = 'sale'
  ) then
    return query select true, 'already_committed'; return;
  end if;

  if v_level.on_hand < p_qty then
    -- לא אמור לקרות אחרי reserve תקין; נרשם ככשל מפורש ולא כמלאי שלילי
    return query select false, 'insufficient_on_hand'; return;
  end if;

  -- אם לא הייתה שמירה (מסלול ידני) — מפחיתים on_hand בלבד
  v_reserved_part := least(v_level.reserved, p_qty);

  insert into inventory_moves
    (book_id, location_id, move_type, quantity_delta,
     on_hand_before, on_hand_after, reserved_before, reserved_after, order_id)
  values
    (p_book_id, v_level.location_id, 'sale', -p_qty,
     v_level.on_hand, v_level.on_hand - p_qty,
     v_level.reserved, v_level.reserved - v_reserved_part, p_order_id);

  update inventory_levels
  set on_hand = on_hand - p_qty, reserved = reserved - v_reserved_part
  where book_id = p_book_id and location_id = v_level.location_id;

  return query select true, 'committed';
end $$;

-- שחרור שמירה (תשלום נכשל / פג / הזמנה בוטלה לפני תשלום)
create or replace function public.commerce_release_stock(
  p_book_id uuid, p_qty int, p_order_id uuid
)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_level inventory_levels;
  v_release int;
begin
  v_level := commerce_lock_level(p_book_id);

  if exists (
    select 1 from inventory_moves
    where order_id = p_order_id and book_id = p_book_id and move_type = 'release'
  ) then
    return query select true, 'already_released'; return;
  end if;
  -- שחרור בלי שמירה קודמת, או אחרי sale שכבר שחרר את השמירה — no-op
  if not exists (
    select 1 from inventory_moves
    where order_id = p_order_id and book_id = p_book_id and move_type = 'reserve'
  ) or exists (
    select 1 from inventory_moves
    where order_id = p_order_id and book_id = p_book_id and move_type = 'sale'
  ) then
    return query select true, 'nothing_to_release'; return;
  end if;

  v_release := least(v_level.reserved, p_qty);

  insert into inventory_moves
    (book_id, location_id, move_type, quantity_delta,
     on_hand_before, on_hand_after, reserved_before, reserved_after, order_id)
  values
    (p_book_id, v_level.location_id, 'release', -v_release,
     v_level.on_hand, v_level.on_hand,
     v_level.reserved, v_level.reserved - v_release, p_order_id);

  update inventory_levels set reserved = reserved - v_release
  where book_id = p_book_id and location_id = v_level.location_id;

  return query select true, 'released';
end $$;

-- תנועה ידנית/החזרה/קליטה/נזק — משנה on_hand בדלתא חתומה, לעולם לא לשלילי
create or replace function public.commerce_adjust_stock(
  p_book_id uuid, p_delta int, p_move_type text,
  p_reason text default null, p_order_id uuid default null,
  p_actor_id uuid default null, p_note text default null
)
returns table (ok boolean, reason text, on_hand int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_level inventory_levels;
begin
  if p_move_type not in ('receive', 'cancel_restock', 'return_restock', 'damage', 'manual_adjust', 'count') then
    return query select false, 'invalid_move_type', 0; return;
  end if;
  if p_delta = 0 then
    return query select false, 'zero_delta', 0; return;
  end if;

  v_level := commerce_lock_level(p_book_id);

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
    (p_book_id, v_level.location_id, p_move_type, p_delta,
     v_level.on_hand, v_level.on_hand + p_delta, v_level.reserved, v_level.reserved,
     p_reason, p_order_id, case when p_actor_id is null then 'system' else 'staff' end,
     p_actor_id, p_note);

  update inventory_levels set on_hand = on_hand + p_delta
  where book_id = p_book_id and location_id = v_level.location_id;

  return query select true, 'adjusted', v_level.on_hand + p_delta;
end $$;

-- הרצה: service_role בלבד. הצוות עובר דרך Server Actions שמפעילים אותן.
revoke all on function commerce_lock_level(uuid) from public, anon, authenticated;
revoke all on function commerce_reserve_stock(uuid, int, uuid) from public, anon, authenticated;
revoke all on function commerce_commit_stock(uuid, int, uuid) from public, anon, authenticated;
revoke all on function commerce_release_stock(uuid, int, uuid) from public, anon, authenticated;
revoke all on function commerce_adjust_stock(uuid, int, text, text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function commerce_lock_level(uuid) to service_role;
grant execute on function commerce_reserve_stock(uuid, int, uuid) to service_role;
grant execute on function commerce_commit_stock(uuid, int, uuid) to service_role;
grant execute on function commerce_release_stock(uuid, int, uuid) to service_role;
grant execute on function commerce_adjust_stock(uuid, int, text, text, uuid, uuid, text) to service_role;

-- ----------------------------------------------------------------------------
-- 6. RLS
-- ----------------------------------------------------------------------------
alter table stock_locations  enable row level security;
alter table inventory_levels enable row level security;
alter table inventory_moves  enable row level security;

revoke all on stock_locations  from anon, authenticated;
revoke all on inventory_levels from anon, authenticated;
revoke all on inventory_moves  from anon, authenticated;
grant select on stock_locations  to authenticated;
grant select on inventory_levels to authenticated;
grant select on inventory_moves  to authenticated;

drop policy if exists stock_locations_staff_read on stock_locations;
create policy stock_locations_staff_read on stock_locations
  for select using (public.can_edit());

drop policy if exists inventory_levels_staff_read on inventory_levels;
create policy inventory_levels_staff_read on inventory_levels
  for select using (public.can_edit());

drop policy if exists inventory_moves_staff_read on inventory_moves;
create policy inventory_moves_staff_read on inventory_moves
  for select using (public.can_edit());

-- ============================================================================
-- Rollback:
--   drop function commerce_adjust_stock(...); commerce_release_stock(...);
--   commerce_commit_stock(...); commerce_reserve_stock(...); commerce_lock_level(uuid);
--   drop trigger trg_inventory_levels_cache on inventory_levels;
--   drop function refresh_book_stock_cache();
--   drop table inventory_moves; drop table inventory_levels; drop table stock_locations;
--   books.stock_quantity נשאר בערכו האחרון שסונכרן — הקטלוג ממשיך לעבוד.
-- ============================================================================
