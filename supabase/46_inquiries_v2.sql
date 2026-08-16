-- ============================================================================
-- מכון קרן רא"ם — מערכת פניות מחודשת (v2)
-- להרצה אחרי 45_audit_login.sql
-- ============================================================================
--
-- אפיון מחדש של מערכת יצירת הקשר: שני סוגי פנייה (כללית / הערות והארות
-- על ספרים — עם בחירת ספר, מספר עמוד וגוף עשיר), חמישה סטטוסי טיפול
-- במקום דגל בוליאני יחיד, ושרשור מענות שנשלחות בדואר מתועד בטבלה נפרדת.
--
-- הטבלה הקיימת contact_messages מורחבת ולא מוחלפת: הפניות שכבר התקבלו
-- אינן נמחקות, והרחבה שומרת על כל מדיניות ה-RLS וההוספה האנונימית
-- שכבר נבדקו. is_handled נשאר לתאימות אחורה אך המערכת עוברת ל-status.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. סוג פנייה, סטטוס, ושדות "הערות על ספר"
-- ----------------------------------------------------------------------------
alter table contact_messages
  add column if not exists kind text not null default 'general',
  add column if not exists status text not null default 'new',
  add column if not exists book_id uuid references books (id) on delete set null,
  add column if not exists page_reference text,
  add column if not exists message_html text;

alter table contact_messages drop constraint if exists contact_messages_kind_valid;
alter table contact_messages add constraint contact_messages_kind_valid
  check (kind in ('general', 'book_feedback'));

alter table contact_messages drop constraint if exists contact_messages_status_valid;
alter table contact_messages add constraint contact_messages_status_valid
  check (status in ('new', 'read', 'in_progress', 'todo', 'resolved'));

alter table contact_messages drop constraint if exists contact_messages_page_reference_len;
alter table contact_messages add constraint contact_messages_page_reference_len
  check (page_reference is null or char_length(page_reference) <= 40);

-- גוף עשיר: מנוקה בצד השרת (sanitize.ts) לפני שמירה; המגבלה כאן היא
-- רשת ביטחון נגד ספאם ענק, לא כלל עסקי.
alter table contact_messages drop constraint if exists contact_messages_message_html_len;
alter table contact_messages add constraint contact_messages_message_html_len
  check (message_html is null or char_length(message_html) <= 20000);

-- פניות שכבר טופלו במודל הישן מקבלות סטטוס תואם; השאר נשארות 'new'.
update contact_messages set status = 'resolved' where is_handled and status = 'new';

create index if not exists idx_contact_messages_status on contact_messages (status);
create index if not exists idx_contact_messages_kind on contact_messages (kind);
create index if not exists idx_contact_messages_book on contact_messages (book_id)
  where book_id is not null;

-- ----------------------------------------------------------------------------
-- 2. מענות — כל תשובה שנשלחה בדואר נשמרת כרשומה, לשרשור מלא בפנייה
-- ----------------------------------------------------------------------------
create table if not exists contact_replies (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references contact_messages (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  body_html text not null check (char_length(body_html) between 1 and 20000),
  sent_to text not null check (char_length(sent_to) between 3 and 160),
  delivery_status text not null default 'sent'
    check (delivery_status in ('sent', 'skipped', 'failed')),
  created_at timestamptz not null default now()
);

create index if not exists idx_contact_replies_message on contact_replies (message_id, created_at);

alter table contact_replies enable row level security;

-- צוות תוכן קורא וכותב; אין עדכון ואין מחיקה — מענה שנשלח הוא עובדה.
drop policy if exists contact_replies_staff_read on contact_replies;
create policy contact_replies_staff_read on contact_replies
  for select using (public.can_edit());

drop policy if exists contact_replies_staff_insert on contact_replies;
create policy contact_replies_staff_insert on contact_replies
  for insert to authenticated
  with check (public.can_edit() and user_id = auth.uid());

grant select, insert on contact_replies to authenticated;
