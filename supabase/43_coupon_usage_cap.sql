-- ============================================================================
-- מכון קרן רא"ם — אכיפת מגבלות שימוש בקופון ברמת המסד (מניעת מרוץ)
-- להרצה אחרי 42_contact_attachments_text.sql
-- ============================================================================
-- [1.7] validateCoupon סופר מימושים קיימים ורק אחר כך recordRedemption
-- כותב שורה — count-then-insert בלי נעילה. שתי קופות במקביל (עוגיות
-- kr-checkout נפרדות, אותו קופון) שרצות placeOrder בו-זמנית עוברות שתיהן
-- את הבדיקה לפני ששורה כלשהי נכתבה, ושתיהן מקבלות את ההנחה — עוקפות את
-- max_uses / max_uses_per_customer. האילוצים הקיימים (unique(order_id),
-- unique(coupon_id, order_id)) מונעים ספירה כפולה של אותה הזמנה, אך לא
-- מגבילים את מספר המימושים הכולל/ללקוח.
--
-- הפתרון, באותו דפוס כמו enforce_refund_cap: טריגר BEFORE INSERT שנועל
-- את שורת הקופון (SELECT ... FOR UPDATE) — כך שתי הכנסות מקבילות לאותו
-- קופון מסתדרות בטור — וסופר מחדש תחת הנעילה. ההגנה האפליקטיבית נשארת
-- (משוב מיידי ללקוח); זו רשת ביטחון סופית שלא ניתנת למרוץ.
-- ============================================================================

create or replace function public.enforce_coupon_usage_cap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_max_uses              int;
  v_max_uses_per_customer int;
  v_total                 int;
  v_customer              int;
begin
  -- נעילת שורת הקופון מסדרת מימושים מקבילים של אותו קופון בטור
  select max_uses, max_uses_per_customer
    into v_max_uses, v_max_uses_per_customer
  from coupons
  where id = new.coupon_id
  for update;

  if not found then
    raise exception 'coupon % not found', new.coupon_id;
  end if;

  if v_max_uses is not null then
    select count(*) into v_total
    from coupon_redemptions
    where coupon_id = new.coupon_id and id <> new.id;
    if v_total >= v_max_uses then
      raise exception 'coupon % usage limit reached (% / %)', new.coupon_id, v_total, v_max_uses;
    end if;
  end if;

  -- max_uses_per_customer הוא not null default 1; אכיפה תמיד. הספירה לפי
  -- contact_hash המאוחסן (אותו hash שהאפליקציה כותבת) — רשת ביטחון למרוץ,
  -- לצד ספירת ה-HMAC/legacy הכפולה שנעשית באפליקציה.
  select count(*) into v_customer
  from coupon_redemptions
  where coupon_id = new.coupon_id
    and contact_hash = new.contact_hash
    and id <> new.id;
  if v_customer >= v_max_uses_per_customer then
    raise exception 'coupon % per-customer limit reached (% / %)', new.coupon_id, v_customer, v_max_uses_per_customer;
  end if;

  return new;
end $$;

drop trigger if exists trg_coupon_redemptions_usage_cap on coupon_redemptions;
create trigger trg_coupon_redemptions_usage_cap
  before insert on coupon_redemptions
  for each row execute function enforce_coupon_usage_cap();

-- ============================================================================
-- לאימות אחרי הרצה:
--   select tgname from pg_trigger where tgname = 'trg_coupon_redemptions_usage_cap';
--
-- Rollback:
--   drop trigger trg_coupon_redemptions_usage_cap on coupon_redemptions;
--   drop function enforce_coupon_usage_cap();
-- ============================================================================
