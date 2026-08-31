-- ============================================================================
-- מכון קרן רא"ם — אינדקסים לשאילתות שגדלות עם הנתונים (סקירת עומק 30.8)
-- להרצה אחרי 52_commerce_hardening.sql
-- ============================================================================
--
-- שני אינדקסים שחסרים לשאילתות שהקוד כבר מריץ, ושהופכות לסריקה מלאה
-- ככל שהטבלה גדלה:
--
-- 1. payments.created_at — דוחות המכירות והתשלומים (getSalesData,
--    getPaymentsReport) מסננים payments לפי טווח created_at, אבל
--    האינדקסים הקיימים על payments הם idempotency/txn/order/status בלבד.
--    בלי זה כל הפקת דוח כספי סורקת את כל טבלת התשלומים.
--
-- 2. consent_events.phone / email — עמוד פרטי הלקוח (getCustomerDetail)
--    מחפש הסכמות לפי טלפון ולפי מייל, אבל האינדקס היחיד הוא לפי
--    customer_id. בלי זה כל טעינת לקוח סורקת את כל טבלת ההסכמות.
-- ============================================================================

create index if not exists idx_payments_created on payments (created_at desc);

create index if not exists idx_consent_events_phone on consent_events (phone) where phone is not null;
create index if not exists idx_consent_events_email on consent_events (email) where email is not null;
