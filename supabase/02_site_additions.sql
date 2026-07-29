-- ============================================================================
-- מכון קרן רא"ם — תוספות שהאתר דורש מעבר לסכימת הבסיס
-- להרצה אחרי 01_schema.sql
-- ----------------------------------------------------------------------------
-- הקובץ נפרד בכוונה: 01_schema.sql הוא הסכימה כפי שנמסרה, ללא שינוי.
-- כאן נמצא רק מה שנוסף בזמן בניית האתר.
--
-- מכיל:
--   1. contact_messages — אחסון פניות מטופס "צור קשר"
--   2. buckets ומדיניות אחסון לקבצים
--   3. אינדקס עזר לחיפוש בקטלוג
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. contact_messages — פניות מטופס יצירת הקשר
-- ----------------------------------------------------------------------------
-- הטופס באתר שומר כאן. אין שליחת דואר מהאתר; הצוות קורא את הפניות
-- במסך "פניות מהאתר" בממשק הניהול.
--
-- שמירת פרטי קשר של אדם היא עיבוד מידע אישי לפי תיקון 13 לחוק הגנת
-- הפרטיות. מדיניות הפרטיות באתר חייבת לציין את המטרה, את תקופת השמירה
-- ואת הזכות למחיקה — ומחיקה בפועל נעשית מכאן.
create table if not exists contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  phone       text,
  subject     text,
  message     text not null,
  is_handled  boolean not null default false,
  created_at  timestamptz not null default now(),

  -- הגבלות אורך בשכבת המסד: ולידציה בצד השרת אפשר לעקוף בקריאה ישירה ל-API
  constraint contact_name_len    check (char_length(name) between 1 and 120),
  constraint contact_email_len   check (char_length(email) between 3 and 160),
  constraint contact_phone_len   check (phone is null or char_length(phone) <= 40),
  constraint contact_subject_len check (subject is null or char_length(subject) <= 160),
  constraint contact_message_len check (char_length(message) between 1 and 4000)
);

create index if not exists idx_contact_messages_created
  on contact_messages (created_at desc);

create index if not exists idx_contact_messages_open
  on contact_messages (created_at desc) where is_handled = false;

alter table contact_messages enable row level security;

-- כל אחד יכול לשלוח פנייה...
drop policy if exists contact_messages_insert on contact_messages;
create policy contact_messages_insert on contact_messages
  for insert to anon, authenticated
  with check (true);

-- ...אבל רק הצוות קורא אותן. בלי policy ל-select, anon אינו רואה דבר.
drop policy if exists contact_messages_staff_read on contact_messages;
create policy contact_messages_staff_read on contact_messages
  for select using (can_edit());

drop policy if exists contact_messages_staff_update on contact_messages;
create policy contact_messages_staff_update on contact_messages
  for update using (can_edit()) with check (can_edit());

-- מחיקה למנהל בלבד — נדרש למימוש זכות המחיקה של נושא המידע
drop policy if exists contact_messages_admin_delete on contact_messages;
create policy contact_messages_admin_delete on contact_messages
  for delete using (is_admin());

-- ----------------------------------------------------------------------------
-- 2. אחסון קבצים (Supabase Storage)
-- ----------------------------------------------------------------------------
-- ארבעה buckets לפי סוג הנכס, ועוד אחד לנכסי האתר (לוגו, תמונות פעילות).
-- כולם ציבוריים לקריאה — כריכות ותמונות אירועים אמורות להיות ניתנות
-- לשיתוף ולאינדוקס. הכתיבה מוגבלת לצוות העריכה.
insert into storage.buckets (id, name, public)
values
  ('covers',    'covers',    true),
  ('events',    'events',    true),
  ('portraits', 'portraits', true),
  ('samples',   'samples',   true),
  ('site',      'site',      true)
on conflict (id) do nothing;

drop policy if exists storage_public_read on storage.objects;
create policy storage_public_read on storage.objects
  for select
  using (bucket_id in ('covers', 'events', 'portraits', 'samples', 'site'));

drop policy if exists storage_staff_write on storage.objects;
create policy storage_staff_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('covers', 'events', 'portraits', 'samples', 'site') and can_edit()
  );

drop policy if exists storage_staff_update on storage.objects;
create policy storage_staff_update on storage.objects
  for update to authenticated
  using (bucket_id in ('covers', 'events', 'portraits', 'samples', 'site') and can_edit());

drop policy if exists storage_staff_delete on storage.objects;
create policy storage_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id in ('covers', 'events', 'portraits', 'samples', 'site') and can_edit());

-- ----------------------------------------------------------------------------
-- 3. אינדקס לסינון הקטלוג
-- ----------------------------------------------------------------------------
-- הקטלוג נטען כולו ומסונן בצד הלקוח, ולכן השאילתה החוזרת היא "כל הספרים
-- שפורסמו, לפי סדר תצוגה".
create index if not exists idx_books_published_sort
  on books (sort_order, title_he) where is_published = true;

-- ============================================================================
-- הערות
-- ----------------------------------------------------------------------------
-- • טופס יצירת הקשר מוגן במלכודת בוט (honeypot) ובהגבלות אורך בלבד. לפני
--   עלייה לאוויר מומלץ להוסיף הגבלת קצב (Rate limit) ברמת Vercel/Cloudflare,
--   או captcha, אם מתקבל ספאם.
-- • תקופת שמירת הפניות אינה נאכפת אוטומטית. אם מדיניות הפרטיות מגדירה
--   תקופה, יש להוסיף משימת ניקוי (pg_cron) שמוחקת רשומות ישנות.
-- ============================================================================
