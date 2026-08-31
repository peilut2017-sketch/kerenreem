-- ============================================================================
-- מכון קרן רא"ם — הקשחת מקביליות במסחר (סבב QA אגרסיבי)
-- להרצה אחרי 53_scale_indexes.sql
-- ============================================================================
--
-- שני מירוצים שעלו בסבב "מתי זה יישבר תחת שני משתמשים בו-זמנית". שניהם
-- נאכפו עד כה רק בקוד היישום (קריאה-ואז-כתיבה), שאינו אטומי — קו ההגנה
-- האמיתי הוא במסד.
--
-- 1. חיוב succeeded כפול לאותה הזמנה.
--    markManualPayment (ערוץ טלפוני) בודק payment_state על צילום נקרא,
--    ואז מוסיף רשומת payment עם מפתח idempotency ידני. אם ה-Webhook של
--    מורנינג מסמן את ההזמנה כשולמה בדיוק בין הקריאה להוספה, שני החיובים
--    ‏succeeded נרשמים (מפתחות שונים) — הכנסה כפולה בדוחות ותקרת זיכוי
--    כפולה (enforce_refund_cap היא פר-חיוב). אינדקס חלקי ייחודי מוודא
--    חיוב succeeded יחיד לכל הזמנה; ההוספה השנייה נכשלת ב-23505 והקוד
--    כבר מטפל בכך כ"שולם כבר" (יציאה שקטה, בלי מייל כפול).
--
-- 2. מימוש קופון מעבר לתקרה (max_uses / max_uses_per_customer).
--    validateCoupon סופר מימושים ומשווה לתקרה, ואז recordRedemption
--    מוסיף שורה — שתי הזמנות מקבילות עם אותו קופון סופרות שתיהן "0 מתוך
--    1", שתיהן עוברות, ושתיהן נרשמות (order_id שונה ⇒ unique(coupon,order)
--    אינו מונע). טריגר שנועל את שורת הקופון (FOR UPDATE) מסדר את המימושים
--    ומאמת את התקרה אטומית לפני כל הוספה. recordRedemption סופג את
--    החריגה (כמו 23505) — הקופון נשאר חסום בתקרה במקום לגלוש ללא גבול.
-- ============================================================================

-- ‏1. חיוב succeeded יחיד לכל הזמנה (זיכויים הם kind='refund' ⇒ מוחרגים).
create unique index if not exists uq_payments_one_success_per_order
  on payments (order_id)
  where kind = 'charge' and status = 'succeeded';

-- ‏2. אכיפת תקרות שימוש בקופון, אטומית תחת נעילת שורת הקופון.
create or replace function public.enforce_coupon_usage_caps()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_max_uses     int;
  v_max_per_cust int;
  v_total        int;
  v_customer     int;
begin
  -- נעילת שורת הקופון: מסדרת הוספות מקבילות של מימושים לאותו קופון, כך
  -- שהספירה שלמטה רואה את המימוש שקדם לה (שכבר בוצע commit) ולא מפספסת
  -- אותו במירוץ. אם הקופון לא קיים — ה-FK יטפל, לא חוסמים כאן.
  select max_uses, max_uses_per_customer
    into v_max_uses, v_max_per_cust
    from coupons where id = new.coupon_id for update;
  if not found then
    return new;
  end if;

  if v_max_uses is not null then
    select count(*) into v_total
      from coupon_redemptions where coupon_id = new.coupon_id;
    if v_total >= v_max_uses then
      raise exception 'coupon usage limit reached' using errcode = 'check_violation';
    end if;
  end if;

  if v_max_per_cust is not null and new.contact_hash is not null then
    select count(*) into v_customer
      from coupon_redemptions
      where coupon_id = new.coupon_id and contact_hash = new.contact_hash;
    if v_customer >= v_max_per_cust then
      raise exception 'coupon per-customer limit reached' using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_coupon_usage_caps on coupon_redemptions;
create trigger trg_coupon_usage_caps
  before insert on coupon_redemptions
  for each row execute function public.enforce_coupon_usage_caps();

-- ============================================================================
-- Rollback:
--   drop trigger trg_coupon_usage_caps on coupon_redemptions;
--   drop function public.enforce_coupon_usage_caps();
--   drop index uq_payments_one_success_per_order;
-- ============================================================================
