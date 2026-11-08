-- ============================================================================
-- מכון קרן רא"ם — יומן קליטת דואר נכנס (אבחון)
-- להרצה אחרי 60_email_tracking_and_visitor_replies.sql
-- ============================================================================
--
-- שורה לכל פנייה של ה-Email Worker אל ‎/api/email/inbound‎ — כולל דחיות
-- (שולח לא מורשה, כתובת פגומה) וכשלים. זה מה שמאפשר לענות על "תשובה
-- נשלחה ולא הגיעה לשום מקום": אם אין שורה — המייל לא הגיע לאתר
-- (Cloudflare / ה-Worker); אם יש — העמודות outcome ו-reason אומרות איפה
-- ולמה הוא נעצר. בדיקת "מקצה לקצה" במסך הדואר היוצא נשענת על הטבלה הזו.
--
-- אין תוכן הודעה: רק כתובות, מזהה פנייה, תוצאה וסיבה.
-- ============================================================================

create table if not exists inbound_email_log (
  id           uuid primary key default gen_random_uuid(),
  received_at  timestamptz not null default now(),
  recipient    text,
  sender       text,
  inquiry_id   uuid,
  -- recorded | duplicate | ignored | ping | rejected | failed | unauthorized
  outcome      text not null,
  reason       text,
  size_bytes   integer
);

create index if not exists idx_inbound_email_log_received on inbound_email_log (received_at desc);

alter table inbound_email_log enable row level security;
revoke all on inbound_email_log from anon, authenticated;
-- service_role בלבד; הקריאה במסך הניהול עוברת שער הרשאה בקוד

-- Rollback: drop table inbound_email_log;
