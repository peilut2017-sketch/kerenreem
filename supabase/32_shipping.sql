-- ============================================================================
-- מכון קרן רא"ם — אזורי משלוח ושיטות אספקה
-- להרצה אחרי 31_carts_checkout.sql
-- ============================================================================
-- שלב ראשון: איסוף עצמי + משלוח במחיר אחיד. המנוע תומך כבר עכשיו גם
-- במשקל, בסכום, בסף חינם ובאזורים — הוספת שיטה עתידית היא שורת נתונים,
-- לא שינוי סכימה.
-- ============================================================================

create table if not exists shipping_zones (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  kind       text not null default 'include' check (kind in ('include', 'exclude')),
  cities     text[] not null default '{}',
  notes      text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists shipping_methods (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique,
  name_he            text not null,
  name_en            text,
  description_he     text,
  description_en     text,
  kind               text not null default 'flat'
                       check (kind in ('pickup', 'flat', 'by_weight', 'by_total', 'free_over')),
  price              numeric(10,2) not null default 0 check (price >= 0),
  free_over          numeric(10,2) check (free_over is null or free_over >= 0),
  min_weight_grams   int,
  max_weight_grams   int,
  min_total          numeric(10,2),
  max_total          numeric(10,2),
  zone_id            uuid references shipping_zones(id) on delete set null,
  eta_business_days  int not null default 3 check (eta_business_days >= 0),
  price_includes_vat boolean not null default true,
  valid_from         date,
  valid_until        date,
  active             boolean not null default true,
  sort_order         int not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

drop trigger if exists trg_shipping_methods_updated on shipping_methods;
create trigger trg_shipping_methods_updated
  before update on shipping_methods
  for each row execute function set_updated_at();

-- זריעה: שתי השיטות של שלב 3. המחירים והזמנים — לעדכון הצוות (החלטות 6–8).
insert into shipping_methods (slug, name_he, name_en, kind, price, eta_business_days, sort_order)
values
  ('pickup', 'איסוף עצמי מהמכון', 'Pickup', 'pickup', 0, 1, 0),
  ('standard', 'משלוח עד הבית', 'Home delivery', 'flat', 30, 5, 1)
on conflict (slug) do nothing;

-- fk שהוכן ב-27
alter table orders drop constraint if exists orders_shipping_method_fkey;
alter table orders add constraint orders_shipping_method_fkey
  foreign key (shipping_method_id) references shipping_methods(id) on delete set null;

alter table shipping_zones   enable row level security;
alter table shipping_methods enable row level security;

revoke all on shipping_zones   from anon, authenticated;
revoke all on shipping_methods from anon, authenticated;
grant select on shipping_zones   to anon, authenticated;
grant select on shipping_methods to anon, authenticated;
grant insert, update, delete on shipping_zones   to authenticated;
grant insert, update, delete on shipping_methods to authenticated;

-- הציבור רואה שיטות פעילות (ה-Checkout זקוק להן); הצוות רואה ומנהל הכל
drop policy if exists shipping_methods_public_read on shipping_methods;
create policy shipping_methods_public_read on shipping_methods
  for select using (active or public.can_edit());

drop policy if exists shipping_methods_admin_write on shipping_methods;
create policy shipping_methods_admin_write on shipping_methods
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists shipping_zones_public_read on shipping_zones;
create policy shipping_zones_public_read on shipping_zones
  for select using (active or public.can_edit());

drop policy if exists shipping_zones_admin_write on shipping_zones;
create policy shipping_zones_admin_write on shipping_zones
  for all using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- Rollback:
--   alter table orders drop constraint orders_shipping_method_fkey;
--   drop table shipping_methods; drop table shipping_zones;
-- ============================================================================
