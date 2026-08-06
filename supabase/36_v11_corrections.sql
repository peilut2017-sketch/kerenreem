-- ============================================================================
-- מכון קרן רא"ם — סבב 1.1: עלויות, תפקידים, ביטול בטוח, קופונים, Webhook
-- להרצה אחרי 35_audit_extension.sql
-- ============================================================================
-- מרכז את שינויי המסד של סבב התיקונים 1.1 (מודל הנתונים, סעיף 8):
--   א. book_costs — עלות פנימית בטבלה פרטית (לא עמודה ב-books הציבורית)
--   ב. order_items.cost_price_snapshot + orders.actual_shipping_cost
--   ג. coupons.combinable_with_coupons (צבירה, ברירת מחדל: לא)
--   ד. webhook_events — עמודות צמצום ו-retention ל-payload
--   ה. חמשת התפקידים (manager/seller/picker לצד admin/editor) + פונקציות
--      הרשאה חדשות + עדכון policies של טבלאות המסחר
--   ו. order_state חדש: cancel_pending_refund — אין cancelled לפני זיכוי
--   ז. מלאי רב-מחסני: adjust עם מיקום מפורש + פונקציית העברה בין מיקומים
--
-- הערת enum: ערכי enum חדשים אינם ניתנים לשימוש ב-DML באותה טרנזקציה שבה
-- נוספו; לכן אין כאן שום insert/update שמשתמש בהם, ופונקציות ההרשאה
-- משוות דרך ::text. גוף plpgsql ממילא מנותח רק בהרצה.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- ה.1 תפקידים חדשים על user_role
-- ----------------------------------------------------------------------------
-- editor הקיים *הוא* "עורך תוכן" של מודל חמשת התפקידים (פרק 19 במסמך האב);
-- viewer נשאר תפקיד צפייה היסטורי. החדשים:
--   manager — מנהל: הכל מלבד ניהול משתמשים
--   seller  — מוכרן: מערכת החנות בלבד, ללא תוכן
--   picker  — מלקט: תפעול הזמנות ששולמו בלבד, ללא סכומים וללא לקוחות
alter type user_role add value if not exists 'manager';
alter type user_role add value if not exists 'seller';
alter type user_role add value if not exists 'picker';

-- ----------------------------------------------------------------------------
-- ה.2 פונקציות הרשאה — השוואות ::text (ראו הערת ה-enum למעלה)
-- ----------------------------------------------------------------------------
-- תוכן (ספרים, עמודים, אירועים…): admin / manager / editor
create or replace function public.can_edit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_user_role()::text in ('admin', 'manager', 'editor');
$$;

-- ניהול-על של החנות (כספים, הגדרות, קופונים, משלוחים, עלויות): admin / manager
create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_user_role()::text in ('admin', 'manager');
$$;

-- תפעול חנות מלא (הזמנות, מלאי, הזמנה ידנית): admin / manager / seller
create or replace function public.can_manage_store()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_user_role()::text in ('admin', 'manager', 'seller');
$$;

-- צוות חנות כולל מלקט (צפייה בהזמנות לליקוט, מלאי, סטטוס אספקה)
create or replace function public.is_store_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_user_role()::text in ('admin', 'manager', 'seller', 'picker');
$$;

-- חשיפת עלויות ורווחיות: admin / manager בלבד
create or replace function public.can_view_costs()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_user_role()::text in ('admin', 'manager');
$$;

-- ----------------------------------------------------------------------------
-- ה.3 עדכון policies — עורך תוכן יוצא מהחנות; מוכרן/מלקט נכנסים
-- ----------------------------------------------------------------------------
-- הזמנות: קריאה לכל צוות החנות (כולל מלקט); כתיבה — מנהלי חנות.
-- שדות כספיים למלקט מוסתרים בשכבת האפליקציה (RLS אינו ברמת עמודה).
drop policy if exists orders_own_read on orders;
create policy orders_own_read on orders
  for select using (user_id = auth.uid() or public.is_store_staff());

drop policy if exists orders_staff_update on orders;
create policy orders_staff_update on orders
  for update using (public.can_manage_store()) with check (public.can_manage_store());

drop policy if exists orders_staff_insert on orders;
create policy orders_staff_insert on orders
  for insert with check (public.can_manage_store());

drop policy if exists order_items_read on order_items;
create policy order_items_read on order_items
  for select using (
    exists (select 1 from orders o where o.id = order_id
            and (o.user_id = auth.uid() or public.is_store_staff()))
  );

drop policy if exists order_items_staff_insert on order_items;
create policy order_items_staff_insert on order_items
  for insert with check (
    exists (select 1 from orders o where o.id = order_id and public.can_manage_store())
  );

drop policy if exists order_events_staff_read on order_events;
create policy order_events_staff_read on order_events
  for select using (public.is_store_staff());

drop policy if exists order_events_staff_insert on order_events;
create policy order_events_staff_insert on order_events
  for insert with check (public.is_store_staff());

-- כספים ולקוחות: לא למלקט
drop policy if exists payments_staff_read on payments;
create policy payments_staff_read on payments
  for select using (public.can_manage_store());

drop policy if exists documents_read on documents;
create policy documents_read on documents
  for select using (
    public.can_manage_store()
    or exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid())
  );

drop policy if exists webhook_events_admin_read on webhook_events;
create policy webhook_events_admin_read on webhook_events
  for select using (public.is_store_admin());

drop policy if exists customers_self_select on customers;
create policy customers_self_select on customers
  for select using (id = auth.uid() or public.can_manage_store());

drop policy if exists customers_admin_update on customers;
create policy customers_admin_update on customers
  for update using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists customer_addresses_staff_read on customer_addresses;
create policy customer_addresses_staff_read on customer_addresses
  for select using (public.can_manage_store());

drop policy if exists consent_events_staff_read on consent_events;
create policy consent_events_staff_read on consent_events
  for select using (public.can_manage_store());

drop policy if exists checkout_sessions_staff_read on checkout_sessions;
create policy checkout_sessions_staff_read on checkout_sessions
  for select using (public.can_manage_store());

drop policy if exists carts_staff_read on carts;
create policy carts_staff_read on carts
  for select using (public.can_manage_store());

drop policy if exists cart_items_staff_read on cart_items;
create policy cart_items_staff_read on cart_items
  for select using (public.can_manage_store());

-- מלאי: קריאה לכל צוות החנות (המלקט רואה זמינות; תנועות דרך service)
drop policy if exists stock_locations_staff_read on stock_locations;
create policy stock_locations_staff_read on stock_locations
  for select using (public.is_store_staff());

drop policy if exists inventory_levels_staff_read on inventory_levels;
create policy inventory_levels_staff_read on inventory_levels
  for select using (public.is_store_staff());

drop policy if exists inventory_moves_staff_read on inventory_moves;
create policy inventory_moves_staff_read on inventory_moves
  for select using (public.can_manage_store());

-- משלוחים וקופונים: כתיבה למנהלי חנות (admin/manager); קריאת קופונים — צוות חנות
drop policy if exists shipping_methods_admin_write on shipping_methods;
create policy shipping_methods_admin_write on shipping_methods
  for all using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists shipping_zones_admin_write on shipping_zones;
create policy shipping_zones_admin_write on shipping_zones
  for all using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists coupons_staff_read on coupons;
create policy coupons_staff_read on coupons
  for select using (public.can_manage_store());

drop policy if exists coupons_admin_write on coupons;
create policy coupons_admin_write on coupons
  for all using (public.is_store_admin()) with check (public.is_store_admin());

drop policy if exists coupon_redemptions_staff_read on coupon_redemptions;
create policy coupon_redemptions_staff_read on coupon_redemptions
  for select using (public.can_manage_store());

drop policy if exists notification_log_staff_read on notification_log;
create policy notification_log_staff_read on notification_log
  for select using (public.can_manage_store());

drop policy if exists store_settings_admin_update on store_settings;
create policy store_settings_admin_update on store_settings
  for update using (public.is_store_admin()) with check (public.is_store_admin());

-- ----------------------------------------------------------------------------
-- א. book_costs — עלות פנימית, טבלה פרטית (מודל 3.18)
-- ----------------------------------------------------------------------------
-- העלות אינה עמודה ב-books במכוון: books נקראת ציבורית ו-RLS של Postgres
-- אינו ברמת עמודה — עמודת עלות שם הייתה דולפת לכל קורא קטלוג.
create table if not exists book_costs (
  book_id    uuid primary key references books(id) on delete cascade,
  cost_price numeric(10,2) not null check (cost_price >= 0),
  currency   text not null default 'ILS',
  note       text,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column book_costs.cost_price is 'עלות ליחידה (הדפסה/רכש), ללא מע"מ';

drop trigger if exists trg_book_costs_updated on book_costs;
create trigger trg_book_costs_updated
  before update on book_costs
  for each row execute function set_updated_at();

alter table book_costs enable row level security;
revoke all on book_costs from anon, authenticated;
grant select, insert, update, delete on book_costs to authenticated;

drop policy if exists book_costs_managers on book_costs;
create policy book_costs_managers on book_costs
  for all using (public.can_view_costs()) with check (public.can_view_costs());

-- ----------------------------------------------------------------------------
-- ב. צילומי עלות ומשלוח-בפועל
-- ----------------------------------------------------------------------------
-- צילום העלות בעת יצירת ההזמנה — בסיס דוחות הרווחיות (17.14). null =
-- "ללא עלות מתועדת"; לעולם אינו נשלח לצד לקוח.
alter table order_items add column if not exists cost_price_snapshot numeric(10,2);

-- עלות המשלוח בפועל (הזנה ידנית / ייבוא מחברת המשלוחים) — מול
-- shipping_total שנגבה; מזין את דוח פער המשלוח.
alter table orders add column if not exists actual_shipping_cost numeric(10,2);

-- ----------------------------------------------------------------------------
-- ג. צבירת קופונים
-- ----------------------------------------------------------------------------
alter table coupons add column if not exists combinable_with_coupons boolean not null default false;

-- ----------------------------------------------------------------------------
-- ד. webhook_events — צמצום payload ו-retention (מודל 3.10)
-- ----------------------------------------------------------------------------
-- payload_normalized — השדות העסקיים שחולצו, שורדים את טיהור הגולמי;
-- payload_truncated — הגוף חצה את תקרת הגודל ולא נשמר גולמי;
-- raw_purged_at — מתי job התחזוקה רוקן את payload הגולמי (אחרי 90 יום).
alter table webhook_events add column if not exists payload_normalized jsonb;
alter table webhook_events add column if not exists payload_truncated boolean not null default false;
alter table webhook_events add column if not exists raw_purged_at timestamptz;

create index if not exists idx_webhook_purge on webhook_events (received_at)
  where raw_purged_at is null;

-- ----------------------------------------------------------------------------
-- ו. cancel_pending_refund — אין cancelled לפני שהזיכוי הצליח (תרשים 13)
-- ----------------------------------------------------------------------------
alter type order_state add value if not exists 'cancel_pending_refund';

-- הסטטוס הישן: בזמן המתנה לזיכוי ההזמנה עדיין שולמה — נשארת 'paid'
create or replace function public.sync_legacy_order_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.status := case
    when new.state::text = 'cancelled' then 'cancelled'::order_status
    when new.payment_state in ('refunded', 'partially_refunded') then 'refunded'::order_status
    when new.fulfillment_state in ('shipped', 'delivered') then 'shipped'::order_status
    when new.payment_state = 'paid' then 'paid'::order_status
    when new.payment_state = 'failed' then 'failed'::order_status
    else 'pending'::order_status
  end;
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- ז. מלאי רב-מחסני (הכרעה 9: "יש לנו כמה מחסנים")
-- ----------------------------------------------------------------------------
-- commerce_adjust_stock מקבל מעתה מיקום מפורש (ברירת מחדל — המיקום
-- הראשי, כמו קודם). drop לפני recreate: הוספת פרמטר עם default יוצרת
-- overload דו-משמעי מול הגרסה הישנה.
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
  v_level inventory_levels;
begin
  if p_move_type not in ('receive', 'cancel_restock', 'return_restock', 'damage', 'manual_adjust', 'count') then
    return query select false, 'invalid_move_type', 0; return;
  end if;
  if p_delta = 0 then
    return query select false, 'zero_delta', 0; return;
  end if;

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
     p_reason, p_order_id, case when p_actor_id is null then 'system' else 'staff' end, p_actor_id, p_note);

  -- הסמכה מפורשת (il.on_hand): בלעדיה הביטוי מתנגש בפרמטר הפלט בשם
  -- on_hand ו-Postgres נכשל ב-42702 "column reference is ambiguous"
  update inventory_levels il
  set on_hand = il.on_hand + p_delta
  where il.book_id = p_book_id and il.location_id = v_location;

  return query select true, 'ok', v_level.on_hand + p_delta;
end $$;

revoke all on function public.commerce_adjust_stock(uuid, int, text, text, uuid, uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.commerce_adjust_stock(uuid, int, text, text, uuid, uuid, text, uuid)
  to service_role;

-- העברה אטומית בין מיקומים: transfer_out במקור + transfer_in ביעד,
-- בטרנזקציה אחת, בלי לגעת בשמירות (reserved נשאר במקומו).
create or replace function public.commerce_transfer_stock(
  p_book_id uuid, p_from_location uuid, p_to_location uuid, p_qty int,
  p_actor_id uuid default null, p_note text default null
)
returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_from inventory_levels;
begin
  if p_qty <= 0 then return query select false, 'invalid_qty'; return; end if;
  if p_from_location = p_to_location then return query select false, 'same_location'; return; end if;

  select * into v_from from inventory_levels
  where book_id = p_book_id and location_id = p_from_location
  for update;
  if v_from is null or v_from.on_hand - p_qty < v_from.reserved then
    return query select false, 'insufficient_at_source'; return;
  end if;

  insert into inventory_levels (book_id, location_id)
  values (p_book_id, p_to_location)
  on conflict (book_id, location_id) do nothing;

  perform 1 from inventory_levels
  where book_id = p_book_id and location_id = p_to_location
  for update;

  insert into inventory_moves
    (book_id, location_id, move_type, quantity_delta,
     on_hand_before, on_hand_after, reserved_before, reserved_after,
     actor_type, actor_id, note)
  values
    (p_book_id, p_from_location, 'transfer_out', -p_qty,
     v_from.on_hand, v_from.on_hand - p_qty, v_from.reserved, v_from.reserved,
     case when p_actor_id is null then 'system' else 'staff' end, p_actor_id, p_note);

  update inventory_levels set on_hand = on_hand - p_qty
  where book_id = p_book_id and location_id = p_from_location;

  insert into inventory_moves
    (book_id, location_id, move_type, quantity_delta,
     on_hand_before, on_hand_after, reserved_before, reserved_after,
     actor_type, actor_id, note)
  select p_book_id, p_to_location, 'transfer_in', p_qty,
     il.on_hand, il.on_hand + p_qty, il.reserved, il.reserved,
     case when p_actor_id is null then 'system' else 'staff' end, p_actor_id, p_note
  from inventory_levels il
  where il.book_id = p_book_id and il.location_id = p_to_location;

  update inventory_levels set on_hand = on_hand + p_qty
  where book_id = p_book_id and location_id = p_to_location;

  return query select true, 'ok';
end $$;

revoke all on function public.commerce_transfer_stock(uuid, uuid, uuid, int, uuid, text)
  from public, anon, authenticated;
grant execute on function public.commerce_transfer_stock(uuid, uuid, uuid, int, uuid, text)
  to service_role;

-- ניהול מיקומים: כתיבה למנהלי חנות
drop policy if exists stock_locations_admin_write on stock_locations;
create policy stock_locations_admin_write on stock_locations
  for all using (public.is_store_admin()) with check (public.is_store_admin());
grant insert, update on stock_locations to authenticated;

-- ============================================================================
-- Rollback:
--   drop policy stock_locations_admin_write on stock_locations;
--   drop function commerce_transfer_stock(uuid, uuid, uuid, int, uuid, text);
--   שחזור commerce_adjust_stock מ-30_inventory.sql (החתימה הישנה);
--   alter table webhook_events drop column raw_purged_at, payload_truncated,
--     payload_normalized;
--   alter table coupons drop column combinable_with_coupons;
--   alter table orders drop column actual_shipping_cost;
--   alter table order_items drop column cost_price_snapshot;
--   drop table book_costs;
--   שחזור sync_legacy_order_status ו-can_edit מ-27/01;
--   drop function can_view_costs(); drop function is_store_staff();
--   drop function can_manage_store(); drop function is_store_admin();
--   שחזור ה-policies המקוריים מ-01/25/27/28/29/30/31/32/33/34.
--   הסרת ערכי enum (cancel_pending_refund, manager, seller, picker) —
--   בלתי הפיכה ב-Postgres; אינם מזיקים כערכים רדומים.
-- ============================================================================
