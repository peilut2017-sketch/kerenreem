-- ============================================================================
-- מכון קרן רא"ם — תחומי פנייה ושדות מותאמים בטופס יצירת קשר
-- להרצה אחרי 20_contact_attachments.sql
-- ============================================================================
-- שתי טבלאות שהצוות מנהל דרך הניהול, בדיוק כמו תגיות/קטגוריות: רשימת
-- "תחומי פנייה" (support/ספרים/הזמנות...) שמוצגת כבורר בטופס הציבורי,
-- ורשימת "שדות מותאמים" — שאלות נוספות שהצוות רוצה לצרף לטופס בלי לגעת
-- בקוד, מכל סוג (טקסט קצר/ארוך/רשימה נפתחת/תיבת סימון).
--
-- אין להן slug: לא לתחום ולא לשדה יש עמוד ציבורי משלו, הן רק תוכן לטופס
-- אחד. contact_fields.id עצמו משמש כמפתח בתוך custom_field_values —
-- אין צורך במזהה יציב נפרד.
-- ============================================================================

create table if not exists contact_topics (
  id           uuid primary key default gen_random_uuid(),
  name_he      text not null,
  name_en      text,
  sort_order   int not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),

  constraint contact_topics_name_len check (char_length(name_he) between 1 and 120)
);

create table if not exists contact_fields (
  id           uuid primary key default gen_random_uuid(),
  label_he     text not null,
  label_en     text,
  -- text: שורה אחת | textarea: כמה שורות | select: רשימה נפתחת | checkbox: כן/לא
  field_type   text not null default 'text',
  -- אפשרויות ל-select בלבד, שורה אחת לכל אפשרות; מתעלמים מהעמודה בשאר הסוגים
  options_he   text,
  options_en   text,
  is_required  boolean not null default false,
  sort_order   int not null default 0,
  is_published boolean not null default true,
  created_at   timestamptz not null default now(),

  constraint contact_fields_label_len check (char_length(label_he) between 1 and 160),
  constraint contact_fields_type_chk check (field_type in ('text', 'textarea', 'select', 'checkbox'))
);

alter table contact_messages
  add column if not exists topic_id uuid references contact_topics(id) on delete set null;

-- מפתח = contact_fields.id, ערך = תשובת הפונה (מחרוזת, או true/false לתיבת סימון).
-- jsonb ולא טבלה נפרדת: אותו עיקרון כמו attachments/gallery — מספר קטן
-- של תשובות לכל פנייה, בלי צורך בשאילתת JOIN כדי להציג פנייה בודדת.
alter table contact_messages
  add column if not exists custom_field_values jsonb not null default '{}';

alter table contact_topics enable row level security;
alter table contact_fields enable row level security;

-- אותו דפוס בדיוק כמו categories/authors/events (01_schema.sql): קריאה
-- ציבורית רק לרשומות מפורסמות, כתיבה לצוות עם הרשאת עריכה.
drop policy if exists contact_topics_public_read on contact_topics;
create policy contact_topics_public_read on contact_topics
  for select using (is_published or can_edit());

drop policy if exists contact_topics_edit on contact_topics;
create policy contact_topics_edit on contact_topics
  for all using (can_edit()) with check (can_edit());

drop policy if exists contact_fields_public_read on contact_fields;
create policy contact_fields_public_read on contact_fields
  for select using (is_published or can_edit());

drop policy if exists contact_fields_edit on contact_fields;
create policy contact_fields_edit on contact_fields
  for all using (can_edit()) with check (can_edit());
