-- ============================================================================
-- מכון קרן רא"ם — סטטוס «ממתין למענה» וקבצים מצורפים בשרשור
-- להרצה אחרי 60_email_tracking_and_visitor_replies.sql
-- ============================================================================
--
-- 1. סטטוס חדש 'awaiting_reply' — הפונה השיב והפנייה ממתינה למענה הצוות.
-- 2. contact_messages.unread_reply — סימון "לא נקרא" נפרד מהסטטוס: תשובת פונה
--    מדליקה אותו, פתיחת הפנייה בניהול מכבה אותו, והסטטוס נשאר «ממתין למענה»
--    עד שהצוות עונה. הוא גם מה שמזין את המונה בתפריט הניהול.
-- 3. contact_replies.attachments — קבצים שנשלחו עם מענה / תשובה, בצורה זהה
--    ל-contact_messages.attachments: [{path, name, size, type}]. path = null
--    לקובץ שנשלח ולא נשמר (סוג שאינו מותר באחסון).
-- ============================================================================

alter table contact_messages drop constraint if exists contact_messages_status_valid;
alter table contact_messages add constraint contact_messages_status_valid
  check (status in ('new', 'awaiting_reply', 'read', 'in_progress', 'todo', 'resolved'));

alter table contact_messages add column if not exists unread_reply boolean not null default false;

create index if not exists idx_contact_messages_unread_reply
  on contact_messages (created_at desc) where unread_reply;

alter table contact_replies add column if not exists attachments jsonb not null default '[]';

-- Rollback:
--   alter table contact_replies drop column attachments;
--   alter table contact_messages drop column unread_reply;
--   (ואז להחזיר את אילוץ הסטטוס בלי 'awaiting_reply', אחרי העברת שורות כאלה ל-'new')
