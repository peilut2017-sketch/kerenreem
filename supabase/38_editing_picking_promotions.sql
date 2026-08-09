-- ============================================================================
-- מכון קרן רא"ם — סבב 1.3: עריכת הזמנה, ליקוט מפורט, קופונים מורחבים ומבצעים
-- להרצה אחרי 37_fix_adjust_stock_ambiguity.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. ליקוט מפורט (בקשת בעל האתר): מה לוקט בפועל, פר פריט + הערת מלקט
-- ----------------------------------------------------------------------------
-- picked_quantity: ‏null = טרם התחיל ליקוט; מספר = כמה לוקטו בפועל.
-- מותר לסמן "נארזה" גם כשלא הכל לוקט (מחסור) — ההערה מסבירה, ומייל
-- "נשלחה" מפרט מה נשלח בפועל.
alter table order_items add column if not exists picked_quantity int
  check (picked_quantity is null or picked_quantity >= 0);
alter table orders add column if not exists packing_note text;

-- ----------------------------------------------------------------------------
-- 2. עריכת חשבון ההזמנה עד האריזה: שורת הנחת צוות מנומקת
-- ----------------------------------------------------------------------------
alter table orders add column if not exists staff_discount numeric(10,2) not null default 0
  check (staff_discount >= 0);
alter table orders add column if not exists staff_discount_reason text;

-- ----------------------------------------------------------------------------
-- 3. קופונים מורחבים: מינימום יחידות + קופון אישי ללקוח
-- ----------------------------------------------------------------------------
-- min_quantity — "קנה X יחידות ומעלה"; משלים את min_total ("קנה מעל X ₪").
-- restricted_contact — קופון אישי: טלפון מנורמל או מייל; מאומת בשרת מול
-- פרטי הקשר של ההזמנה. null = פתוח לכולם.
alter table coupons add column if not exists min_quantity int
  check (min_quantity is null or min_quantity >= 1);
alter table coupons add column if not exists restricted_contact text;

-- ----------------------------------------------------------------------------
-- 4. מבצעים אוטומטיים (promotions) — הנחה כלל-אתרית/קטגוריה/ספרים
-- ----------------------------------------------------------------------------
-- מבצע חל אוטומטית בעגלה (בלי קוד): אחוז או סכום, על תחולה מוגדרת
-- (הכל / קטגוריות / ספרים, עם החרגות), בתנאי מינימום יחידות/סכום.
-- מבצע אחד פעיל מוחל על הזמנה — בעל העדיפות הגבוהה שנותן את ההנחה
-- הגדולה ביותר; אינו נערם עם קופון אלא אם combinable_with_coupon.
create table if not exists promotions (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  kind                   text not null check (kind in ('percent', 'fixed')),
  value                  numeric(10,2) not null check (value > 0),
  scope                  jsonb not null default '{}'::jsonb,
  -- ‏{all: true} או {category_ids: [], book_ids: [], exclude_book_ids: []}
  min_total              numeric(10,2),
  min_quantity           int check (min_quantity is null or min_quantity >= 1),
  combinable_with_coupon boolean not null default false,
  starts_at              timestamptz,
  ends_at                timestamptz,
  priority               int not null default 0,
  active                 boolean not null default true,
  created_by             uuid references auth.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint promotions_percent_range check (kind <> 'percent' or value <= 100)
);

drop trigger if exists trg_promotions_updated on promotions;
create trigger trg_promotions_updated
  before update on promotions
  for each row execute function set_updated_at();

alter table promotions enable row level security;
revoke all on promotions from anon, authenticated;
grant select, insert, update, delete on promotions to authenticated;

drop policy if exists promotions_staff_read on promotions;
create policy promotions_staff_read on promotions
  for select using (public.can_manage_store());
drop policy if exists promotions_admin_write on promotions;
create policy promotions_admin_write on promotions
  for all using (public.is_store_admin()) with check (public.is_store_admin());

-- צילום המבצע על ההזמנה (כמו קופון)
alter table orders add column if not exists promotion_id uuid references promotions(id) on delete set null;
alter table orders add column if not exists promotion_name_snapshot text;

-- ============================================================================
-- Rollback:
--   alter table orders drop column promotion_name_snapshot, promotion_id,
--     staff_discount_reason, staff_discount, packing_note;
--   alter table order_items drop column picked_quantity;
--   alter table coupons drop column restricted_contact, min_quantity;
--   drop table promotions;
-- ============================================================================
