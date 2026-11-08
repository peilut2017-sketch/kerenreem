-- ============================================================================
-- מכון קרן רא"ם — מעקב צפייה בדואר יוצא, ותשובות פונים בשרשור הפנייה
-- להרצה אחרי 59_inquiry_email_replies.sql
-- ============================================================================
--
-- 1. email_log — שורה לכל הודעה שהאתר שולח (lib/email/send.ts). לשורה
--    מוטמע פיקסל שקוף ‎/api/email/open/<id>‎; כל טעינה שלו מעדכנת את
--    המונים כאן: אם נצפה, מתי לראשונה, מתי לאחרונה, וכמה פעמים.
-- 2. contact_replies.direction — 'out' = מענה שיצא אל הפונה (כמו עד כה),
--    'in' = הודעה שהפונה כתב בתשובה למייל (נקלטת דרך ‎/api/email/inbound‎).
-- 3. contact_replies.email_log_id — קישור מהמענה אל רשומת המעקב שלו.
-- ============================================================================

create table if not exists email_log (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  to_address       text not null,
  subject          text not null,
  -- שם הסוג (contact_reply, order_confirmation…) — לסינון ולהצגה בלבד
  label            text,
  role             text not null default 'automated',
  status           text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  provider_id      text,
  error            text,
  -- רשומה קשורה (טבלה + מזהה כטקסט), אם יש: הזמנה, פנייה…
  related_table    text,
  related_id       text,
  opens            integer not null default 0,
  first_opened_at  timestamptz,
  last_opened_at   timestamptz
);

create index if not exists idx_email_log_created on email_log (created_at desc);
create index if not exists idx_email_log_related on email_log (related_table, related_id)
  where related_id is not null;

-- נכתב ונקרא דרך service_role בלבד (בדיקת הרשאה בקוד, כמו notification_log):
-- הטבלה מכילה כתובות נמענים.
alter table email_log enable row level security;
revoke all on email_log from anon, authenticated;

-- רישום צפייה אטומי. טעינות שנוצרות בתוך 10 שניות מהקודמת אינן נספרות:
-- לקוחות דואר וסורקי קישורים טוענים תמונה כמה פעמים ברצף על פתיחה אחת.
create or replace function public.record_email_open(p_id uuid)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  update email_log
     set opens = opens + 1,
         first_opened_at = coalesce(first_opened_at, now()),
         last_opened_at = now()
   where id = p_id
     and (last_opened_at is null or last_opened_at < now() - interval '10 seconds');
$$;

revoke all on function record_email_open(uuid) from public, anon, authenticated;
grant execute on function record_email_open(uuid) to service_role;

alter table contact_replies
  add column if not exists direction text not null default 'out',
  add column if not exists email_log_id uuid references email_log (id) on delete set null;

alter table contact_replies drop constraint if exists contact_replies_direction_valid;
alter table contact_replies add constraint contact_replies_direction_valid
  check (direction in ('out', 'in'));

-- ============================================================================
-- Rollback:
--   alter table contact_replies drop column email_log_id, drop column direction;
--   drop function record_email_open(uuid); drop table email_log;
-- ============================================================================
