-- ============================================================================
-- מכון קרן רא"ם — ארבעה צירי מצב להזמנות, מספר הזמנה, פירוק סכומים וצילום
-- להרצה אחרי 26_books_commerce_extension.sql
-- ============================================================================
-- order_status הישן (שדה יחיד עם שישה ערכים) מערבב שלושה צירים. במקומו:
-- ארבעה צירים נפרדים — הזמנה, תשלום, אספקה, מסמך. העמודה הישנה status
-- אינה נמחקת: טריגר סנכרון ממשיך לעדכן אותה מהצירים החדשים, כדי שכלי
-- חוץ שאולי קוראים אותה לא יישברו. מחיקתה — ב-migration ניקיון עתידי
-- נפרד, באישור נפרד (36+), אחרי ייצוב.
--
-- הערת idempotency: הטבלאות ריקות בפועל (אומת בקוד — אפס שימוש TS),
-- כך שה-backfill פורמלי; הוא כתוב בכל זאת נכון לרשומות קיימות.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ארבעת ה-enums
-- ----------------------------------------------------------------------------
do $$ begin
  create type order_state as enum
    ('draft', 'pending', 'confirmed', 'processing', 'completed', 'cancelled', 'closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_state as enum
    ('not_required', 'pending', 'authorized', 'paid', 'failed',
     'partially_refunded', 'refunded', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type fulfillment_state as enum
    ('unfulfilled', 'preparing', 'ready_for_pickup', 'partially_fulfilled',
     'fulfilled', 'shipped', 'delivered', 'returned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_state as enum
    ('not_created', 'pending', 'created', 'failed', 'cancelled', 'credited');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- 2. עמודות חדשות על orders
-- ----------------------------------------------------------------------------
-- זיהוי וערוץ
alter table orders add column if not exists order_number bigint;
alter table orders add column if not exists channel text not null default 'web';
alter table orders add column if not exists locale text not null default 'he';

-- ארבעת הצירים
alter table orders add column if not exists state order_state not null default 'pending';
alter table orders add column if not exists payment_state payment_state not null default 'pending';
alter table orders add column if not exists fulfillment_state fulfillment_state not null default 'unfulfilled';
alter table orders add column if not exists document_state document_state not null default 'not_created';

-- פירוק סכומים (צילום; total הקיים נשאר הסכום הסופי)
alter table orders add column if not exists subtotal numeric(10,2) not null default 0;
alter table orders add column if not exists discount_total numeric(10,2) not null default 0;
alter table orders add column if not exists shipping_total numeric(10,2) not null default 0;
alter table orders add column if not exists donation_amount numeric(10,2) not null default 0;
alter table orders add column if not exists tax_total numeric(10,2) not null default 0;

-- קופון (הטבלה נוצרת ב-33; ה-fk מתווסף שם)
alter table orders add column if not exists coupon_id uuid;
alter table orders add column if not exists coupon_code_snapshot text;

-- אספקה (צילום)
alter table orders add column if not exists fulfillment_type text not null default 'shipping';
alter table orders add column if not exists shipping_method_id uuid;
alter table orders add column if not exists shipping_method_name_snapshot text;
alter table orders add column if not exists promised_delivery_date date;
alter table orders add column if not exists courier_notes text;

-- מתנה
alter table orders add column if not exists is_gift boolean not null default false;
alter table orders add column if not exists gift_recipient_name text;
alter table orders add column if not exists gift_message text;
alter table orders add column if not exists gift_hide_prices boolean not null default true;

-- גישת אורח: נשמר hash בלבד (sha256, hex); הטוקן הגולמי נשלח במייל ואינו נשמר
alter table orders add column if not exists guest_token_hash text;
alter table orders add column if not exists guest_token_expires_at timestamptz;
alter table orders add column if not exists guest_token_revoked boolean not null default false;

-- שם הלקוח (contact_email/contact_phone כבר קיימים מ-01)
alter table orders add column if not exists contact_name text;

-- ציוני זמן ותפעול
alter table orders add column if not exists placed_at timestamptz;
alter table orders add column if not exists paid_at timestamptz;
alter table orders add column if not exists cancelled_at timestamptz;
alter table orders add column if not exists completed_at timestamptz;
alter table orders add column if not exists tags text[] not null default '{}';

-- Idempotency
alter table orders add column if not exists idempotency_key text;

-- אילוצים
alter table orders drop constraint if exists orders_channel_valid;
alter table orders add constraint orders_channel_valid
  check (channel in ('web', 'phone', 'manual'));

alter table orders drop constraint if exists orders_fulfillment_type_valid;
alter table orders add constraint orders_fulfillment_type_valid
  check (fulfillment_type in ('shipping', 'pickup'));

alter table orders drop constraint if exists orders_total_nonnegative;
alter table orders add constraint orders_total_nonnegative check (total >= 0);

create unique index if not exists uq_orders_order_number on orders (order_number);
create unique index if not exists uq_orders_idempotency_key on orders (idempotency_key)
  where idempotency_key is not null;
create unique index if not exists uq_orders_guest_token on orders (guest_token_hash)
  where guest_token_hash is not null;

-- אינדקסים למסך ההזמנות ולתצוגות השמורות
create index if not exists idx_orders_state_created on orders (state, created_at desc);
create index if not exists idx_orders_created on orders (created_at desc);
create index if not exists idx_orders_payment_pending on orders (payment_state)
  where payment_state = 'pending';
create index if not exists idx_orders_fulfillment on orders (fulfillment_state);
create index if not exists idx_orders_contact_phone on orders (contact_phone);
create index if not exists idx_orders_contact_email on orders (contact_email);

-- ----------------------------------------------------------------------------
-- 3. מספר הזמנה — רץ, בלתי ניתן לעריכה, לא ממוחזר (תבנית 09_catalogue_numbers)
-- ----------------------------------------------------------------------------
create sequence if not exists orders_order_number_seq owned by orders.order_number;

update orders set order_number = numbered.position + 1000
from (
  select id, row_number() over (order by created_at, id) as position
  from orders where order_number is null
) as numbered
where orders.id = numbered.id;

select setval('orders_order_number_seq',
  greatest(coalesce((select max(order_number) from orders), 1000), 1000), true);

create or replace function public.keep_order_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    new.order_number := old.order_number;
  else
    new.order_number := nextval('orders_order_number_seq');
  end if;
  return new;
end $$;

drop trigger if exists trg_orders_order_number on orders;
create trigger trg_orders_order_number
  before insert or update on orders
  for each row execute function keep_order_number();

-- ----------------------------------------------------------------------------
-- 4. Backfill מה-status הישן אל הצירים (שמרני; טבלה ריקה בפועל)
-- ----------------------------------------------------------------------------
update orders set
  state = case status
    when 'pending'   then 'pending'::order_state
    when 'paid'      then 'processing'::order_state
    when 'failed'    then 'pending'::order_state
    when 'shipped'   then 'processing'::order_state
    when 'cancelled' then 'cancelled'::order_state
    when 'refunded'  then 'closed'::order_state
  end,
  payment_state = case status
    when 'pending'   then 'pending'::payment_state
    when 'paid'      then 'paid'::payment_state
    when 'failed'    then 'failed'::payment_state
    when 'shipped'   then 'paid'::payment_state
    when 'cancelled' then 'cancelled'::payment_state
    when 'refunded'  then 'refunded'::payment_state
  end,
  fulfillment_state = case status
    when 'shipped' then 'shipped'::fulfillment_state
    else 'unfulfilled'::fulfillment_state
  end
where true;

-- ----------------------------------------------------------------------------
-- 5. סנכרון לאחור: הצירים החדשים ממשיכים להזין את status הישן
-- ----------------------------------------------------------------------------
create or replace function public.sync_legacy_order_status()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.status := case
    when new.state = 'cancelled' then 'cancelled'::order_status
    when new.payment_state in ('refunded', 'partially_refunded') then 'refunded'::order_status
    when new.fulfillment_state in ('shipped', 'delivered') then 'shipped'::order_status
    when new.payment_state = 'paid' then 'paid'::order_status
    when new.payment_state = 'failed' then 'failed'::order_status
    else 'pending'::order_status
  end;
  return new;
end $$;

drop trigger if exists trg_orders_sync_legacy_status on orders;
create trigger trg_orders_sync_legacy_status
  before insert or update on orders
  for each row execute function sync_legacy_order_status();

-- ----------------------------------------------------------------------------
-- 6. עמודות צילום חדשות על order_items
-- ----------------------------------------------------------------------------
alter table order_items add column if not exists sku_snapshot text;
alter table order_items add column if not exists unit_price_original numeric(10,2);
alter table order_items add column if not exists discount_amount numeric(10,2) not null default 0;
alter table order_items add column if not exists tax_rate_snapshot numeric(5,2);
alter table order_items add column if not exists line_total numeric(10,2);
alter table order_items add column if not exists is_preorder boolean not null default false;

alter table order_items drop constraint if exists order_items_unit_price_nonnegative;
alter table order_items add constraint order_items_unit_price_nonnegative
  check (unit_price >= 0);

-- ----------------------------------------------------------------------------
-- 7. הקשחת RLS: יצירת הזמנות עוברת לצד השרת בלבד
-- ----------------------------------------------------------------------------
-- ההזמנה נוצרת תמיד ב-Server Action עם service_role (צילום, מלאי,
-- idempotency). policy ה-insert הישנה שאפשרה ללקוח מאומת insert ישיר —
-- מוסרת; לצוות נשארת דרך can_edit (הזמנה ידנית עוברת אף היא בשרת).
drop policy if exists orders_insert on orders;
create policy orders_staff_insert on orders
  for insert with check (public.can_edit());

drop policy if exists order_items_insert on order_items;
create policy order_items_staff_insert on order_items
  for insert with check (
    exists (select 1 from orders o where o.id = order_id and public.can_edit())
  );

-- ============================================================================
-- Rollback:
--   drop trigger trg_orders_sync_legacy_status on orders;
--   drop function sync_legacy_order_status();
--   drop trigger trg_orders_order_number on orders;  drop function keep_order_number();
--   drop sequence orders_order_number_seq;  (העמודה נמחקת עם drop column)
--   alter table order_items drop column ... (שש העמודות החדשות);
--   alter table orders drop column ... (כל העמודות החדשות);
--   drop type document_state; drop type fulfillment_state;
--   drop type payment_state; drop type order_state;
--   שחזור ה-policies המקוריות מ-01_schema.sql:398-411.
-- ============================================================================
