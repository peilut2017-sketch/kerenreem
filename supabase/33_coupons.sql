-- ============================================================================
-- מכון קרן רא"ם — קופונים ומימושים (שלב 10; הסכימה מוכנה מראש)
-- להרצה אחרי 32_shipping.sql
-- ============================================================================
-- הקוד נשמר uppercase; האימות בצד השרת מנרמל. אין קריאה ציבורית לטבלת
-- הקופונים — אימות קוד נעשה ב-Server Action, כדי שלא ניתן יהיה לקצור
-- את רשימת הקודים מה-API.
-- ============================================================================

create table if not exists coupons (
  id                    uuid primary key default gen_random_uuid(),
  code                  text not null unique,
  kind                  text not null check (kind in ('percent', 'fixed', 'free_shipping')),
  value                 numeric(10,2) not null default 0,
  min_total             numeric(10,2),
  starts_at             timestamptz,
  ends_at               timestamptz,
  max_uses              int,
  max_uses_per_customer int not null default 1,
  first_order_only      boolean not null default false,
  applies_to            jsonb not null default '{}'::jsonb,
  combinable_with_sale  boolean not null default false,
  active                boolean not null default true,
  created_by            uuid references auth.users(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint coupons_value_valid check (
    (kind = 'free_shipping' and value = 0)
    or (kind = 'percent' and value > 0 and value <= 100)
    or (kind = 'fixed' and value > 0)
  ),
  constraint coupons_code_upper check (code = upper(code))
);

drop trigger if exists trg_coupons_updated on coupons;
create trigger trg_coupons_updated
  before update on coupons
  for each row execute function set_updated_at();

create table if not exists coupon_redemptions (
  id                uuid primary key default gen_random_uuid(),
  coupon_id         uuid not null references coupons(id) on delete restrict,
  order_id          uuid not null references orders(id) on delete restrict unique,
  customer_id       uuid references customers(id) on delete set null,
  -- sha256 של הטלפון המנורמל — אכיפת "שימושים ללקוח" גם לאורחים
  contact_hash      text not null,
  amount_discounted numeric(10,2) not null default 0,
  created_at        timestamptz not null default now(),
  unique (coupon_id, order_id)
);

create index if not exists idx_coupon_redemptions_coupon on coupon_redemptions (coupon_id);
create index if not exists idx_coupon_redemptions_contact on coupon_redemptions (contact_hash);

-- fk שהוכן ב-27
alter table orders drop constraint if exists orders_coupon_fkey;
alter table orders add constraint orders_coupon_fkey
  foreign key (coupon_id) references coupons(id) on delete set null;

alter table coupons            enable row level security;
alter table coupon_redemptions enable row level security;

revoke all on coupons            from anon, authenticated;
revoke all on coupon_redemptions from anon, authenticated;
grant select, insert, update on coupons to authenticated;
grant select on coupon_redemptions to authenticated;

drop policy if exists coupons_staff_read on coupons;
create policy coupons_staff_read on coupons
  for select using (public.can_edit());

drop policy if exists coupons_admin_write on coupons;
create policy coupons_admin_write on coupons
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists coupon_redemptions_staff_read on coupon_redemptions;
create policy coupon_redemptions_staff_read on coupon_redemptions
  for select using (public.can_edit());

-- ============================================================================
-- Rollback:
--   alter table orders drop constraint orders_coupon_fkey;
--   drop table coupon_redemptions; drop table coupons;
-- ============================================================================
