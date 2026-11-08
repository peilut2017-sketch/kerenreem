-- ============================================================================
-- מכון קרן רא"ם — מענה לפנייה דרך הדואר נכנס לשרשור הפניות
-- להרצה אחרי 58_privacy_analytics.sql
-- ============================================================================
--
-- איש צוות שעונה להתראת הפנייה ישירות מתיבת הדואר שלו (Cloudflare Email
-- Routing ← Email Worker ← /api/email/inbound) מקבל את אותו טיפול כמו
-- מענה מהניהול: התשובה נשלחת לפונה מ-contact@ ונשמרת בשרשור הפנייה.
--
-- שלוש עמודות נוספות ל-contact_replies:
--   source      — מאיפה נולד המענה: 'admin' (מסך הניהול) או 'email'
--                 (תשובה במייל). מוצג בשרשור כדי שיהיה ברור איך נכתב.
--   from_email  — כתובת השולח כפי שהגיעה בדואר. מתועדת כי user_id יכול
--                 להיות ריק (תיבה משותפת של הצוות שאינה חשבון ניהול).
--   external_id — Message-ID של המייל הנכנס. אינדקס ייחודי עליו הופך את
--                 הקליטה לאידמפוטנטית: Cloudflare/Worker שמנסים שוב לא
--                 ישלחו לפונה את אותה תשובה פעמיים.
-- ============================================================================

alter table contact_replies
  add column if not exists source text not null default 'admin',
  add column if not exists from_email text,
  add column if not exists external_id text;

alter table contact_replies drop constraint if exists contact_replies_source_valid;
alter table contact_replies add constraint contact_replies_source_valid
  check (source in ('admin', 'email'));

alter table contact_replies drop constraint if exists contact_replies_from_email_len;
alter table contact_replies add constraint contact_replies_from_email_len
  check (from_email is null or char_length(from_email) <= 254);

alter table contact_replies drop constraint if exists contact_replies_external_id_len;
alter table contact_replies add constraint contact_replies_external_id_len
  check (external_id is null or char_length(external_id) <= 998);

create unique index if not exists uq_contact_replies_external_id
  on contact_replies (external_id)
  where external_id is not null;
