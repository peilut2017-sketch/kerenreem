-- ============================================================================
-- מכון קרן רא"ם — שלב א׳ של ניהול המידע על הספר
-- להרצה אחרי 07_banners.sql
-- ============================================================================
-- עד כה לספר היו קטגוריה אחת ומחבר אחד, ותו לא. הקובץ הזה מוסיף את
-- שכבת הידע: תגיות, קטגוריות משניות, מאפיינים, שפות ושדות SEO.
--
-- שלוש החלטות מבניות שכדאי להבין לפני שמרחיבים כאן:
--
-- 1. קטגוריה ראשית נשארת בעמודה category_id שעל books, ולא עוברת לטבלת
--    הקישור. היא נדרשת למיון, לפירורי לחם ול-canonical של הספר — כלומר
--    לשאלה "היכן הספר יושב", שיש לה תשובה אחת. הקטגוריות המשניות הן
--    שאלה אחרת לגמרי: "היכן עוד אפשר למצוא אותו".
--
-- 2. מאפיינים נשמרים כטבלה ולא כעמודות. כריכה, פורמט וקהל יעד הם רשימות
--    שהצוות ירצה להרחיב בלי מתכנת. עמודה לכל מאפיין פירושה מיגרציה בכל
--    פעם שמתווסף ערך.
--
-- 3. שפות הן מערך text[] ולא טבלה. אין להן נתונים נלווים מלבד השם, הן
--    אינן נערכות, והרשימה סגורה. טבלה שלמה עבור שבעה ערכים קבועים היא
--    שלוש שאילתות במקום אפס.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. תגיות
-- ----------------------------------------------------------------------------
-- מערכת עצמאית מקטגוריות: קטגוריה היא מדף, תגית היא נושא. ספר יכול לשבת
-- על מדף אחד ולשאת חמש תגיות.
create table if not exists tags (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name_he     text not null,
  name_en     text,
  -- תגית מערכת נוצרת בקוד (חדש, רב מכר) ואין למחוק אותה מהממשק
  is_system   boolean not null default false,
  created_at  timestamptz not null default now(),

  constraint tags_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint tags_name_len check (char_length(name_he) between 1 and 60)
);

create table if not exists book_tags (
  book_id  uuid not null references books(id) on delete cascade,
  tag_id   uuid not null references tags(id) on delete cascade,
  primary key (book_id, tag_id)
);

create index if not exists idx_book_tags_tag on book_tags (tag_id);

-- ----------------------------------------------------------------------------
-- 2. קטגוריות משניות
-- ----------------------------------------------------------------------------
create table if not exists book_categories (
  book_id      uuid not null references books(id) on delete cascade,
  category_id  uuid not null references categories(id) on delete cascade,
  primary key (book_id, category_id)
);

create index if not exists idx_book_categories_category on book_categories (category_id);

-- ----------------------------------------------------------------------------
-- 3. מאפיינים
-- ----------------------------------------------------------------------------
-- attributes = סוג המאפיין (כריכה), attribute_values = הערכים (קשה, רכה).
-- ההפרדה מאפשרת להוסיף ערך חדש בלי לגעת בסכימה ובלי לגעת בקוד.
create table if not exists attributes (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name_he     text not null,
  name_en     text,
  -- האם ניתן לבחור יותר מערך אחד (קהל יעד — כן, כריכה — לא)
  is_multi    boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),

  constraint attributes_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create table if not exists attribute_values (
  id            uuid primary key default gen_random_uuid(),
  attribute_id  uuid not null references attributes(id) on delete cascade,
  slug          text not null,
  name_he       text not null,
  name_en       text,
  sort_order    int not null default 0,

  unique (attribute_id, slug),
  constraint attribute_values_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create index if not exists idx_attribute_values_attribute on attribute_values (attribute_id);

create table if not exists book_attributes (
  book_id   uuid not null references books(id) on delete cascade,
  value_id  uuid not null references attribute_values(id) on delete cascade,
  primary key (book_id, value_id)
);

create index if not exists idx_book_attributes_value on book_attributes (value_id);

-- ----------------------------------------------------------------------------
-- 4. שפות ו-SEO על הספר עצמו
-- ----------------------------------------------------------------------------
-- שדות שיש להם ערך אחד לכל ספר יושבים על הספר. טבלת קישור עבורם הייתה
-- מוסיפה שאילתה לכל שליפה בלי להוסיף שום יכולת.
alter table books add column if not exists languages text[] not null default '{}';
alter table books add column if not exists meta_title text;
alter table books add column if not exists meta_description text;
alter table books add column if not exists og_image_url text;
alter table books add column if not exists canonical_url text;
alter table books add column if not exists search_keywords text;
-- טקסט חלופי לכריכה. בלעדיו כל כריכה מוכרזת בשם הספר בלבד, וזה מספיק
-- ברוב המקרים אבל לא כשהכריכה נושאת מידע נוסף.
alter table books add column if not exists cover_alt text;

-- אורך meta_description מעל 160 תווים נחתך בתוצאות החיפוש. מוטב שהמסד
-- יעצור מאשר שגוגל יחתוך באמצע משפט.
alter table books drop constraint if exists books_meta_description_len;
alter table books add constraint books_meta_description_len
  check (meta_description is null or char_length(meta_description) <= 160);

alter table books drop constraint if exists books_meta_title_len;
alter table books add constraint books_meta_title_len
  check (meta_title is null or char_length(meta_title) <= 70);

-- ----------------------------------------------------------------------------
-- 5. RLS
-- ----------------------------------------------------------------------------
-- הקריאה פתוחה: אלה נתוני קטלוג ציבוריים. הכתיבה לצוות העריכה בלבד.
-- טבלאות הקישור נקראות תמיד יחד עם הספר, וה-RLS של books הוא שמסתיר
-- טיוטות — ולכן אין כאן תנאי is_published כפול שהיה רק מאט.
do $$
declare t text;
begin
  foreach t in array array[
    'tags', 'book_tags', 'book_categories',
    'attributes', 'attribute_values', 'book_attributes'
  ]
  loop
    execute format('alter table %I enable row level security', t);

    execute format('drop policy if exists %I on %I', t || '_public_read', t);
    execute format(
      'create policy %I on %I for select using (true)', t || '_public_read', t
    );

    execute format('drop policy if exists %I on %I', t || '_edit', t);
    execute format(
      'create policy %I on %I for all using (public.can_edit()) with check (public.can_edit())',
      t || '_edit', t
    );

    -- טבלה חדשה אחרי drop schema public אינה מקבלת הרשאות אוטומטית
    execute format('grant select on %I to anon, authenticated', t);
    execute format('grant insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 6. ערכי פתיחה
-- ----------------------------------------------------------------------------
-- תגיות פתיחה בלבד.
--
-- מאפיינים אינם נזרעים במכוון: כריכה ופורמט כבר קיימים כשדות על הספר,
-- ומאפיין באותו שם היה יוצר שני מקומות לאותו נתון — בדיוק מה שמערכת
-- כזו אמורה למנוע. מנגנון המאפיינים קיים וזמין לסיווגים שאין להם עדיין
-- שדה, וטופס הספר מציג את הקטע הזה רק כשיש מאפיינים בפועל.
insert into tags (slug, name_he, is_system) values
  ('new',        'חדש',      true),
  ('bestseller', 'רב מכר',   true),
  ('foundation', 'ספר יסוד', false),
  ('recommended','מומלץ',    false)
on conflict (slug) do nothing;

-- ============================================================================
-- מה נשאר לשלב ב׳ ומדוע לא כאן
-- ----------------------------------------------------------------------------
--   מבצעים ומחסנים — אין להם משמעות כל עוד store_enabled כבוי, וכל שינוי
--   במודל שלהם עד לפתיחת החנות הוא עבודה כפולה.
--
--   שדות מותאמים אישית וגרסאות — דורשים ממשק ניהול משלהם. הוספת הטבלאות
--   בלי הממשק הייתה יוצרת מבנה שאיש אינו יכול למלא.
-- ============================================================================
