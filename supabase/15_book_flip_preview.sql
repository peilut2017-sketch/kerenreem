-- ============================================================================
-- מכון קרן רא"ם — עמוד הספר, גרסה 4: הדמיית כריכה ודפדוף מוחשי
-- להרצה אחרי 14_book_page_v3.sql
-- ============================================================================
-- החלטה שגוברת על מפרט קודם: שם הוחלט להימנע מהדמיית קיפול דף, וכעת
-- הוחלט במפורש להוסיף חוויית דפדוף מוחשית (react-pageflip). הקובץ הזה
-- מוסיף רק את מה שהיכולת הזאת דורשת ואין לה היום מקום במסד:
--
-- 1. hero_mockup_url — נכס PNG/WebP שקוף חלופי לכריכה השטוחה ב-Hero,
--    שכבר כולל שדרה, עובי ותאורה מצולמים/מעוצבים מראש. עמודה על הספר,
--    לא טבלה: זהו נכס יחיד לכל ספר, בדיוק כמו cover_image_url.
--
-- 2. book_preview_pages — דפי דוגמה שעברו המרה חד-פעמית ל-WebP בזמן
--    עריכת הספר (לא בכל טעינת עמוד ציבורי). טבלה ולא jsonb על הספר,
--    מאותו נימוק בדיוק כמו book_toc/book_images: זו רשימה שנוצרת
--    ונמחקת כיחידה (יצירה מחדש) אבל צריכה סדר יציב (page_number) ואינדוקס
--    לפי ספר — ראו ההסבר המקביל ב-10_book_page_stage_c.sql.
-- ============================================================================

alter table books add column if not exists hero_mockup_url text;

-- ----------------------------------------------------------------------------
-- 1. דפי דוגמה שעברו המרה
-- ----------------------------------------------------------------------------
create table if not exists book_preview_pages (
  id            uuid primary key default gen_random_uuid(),
  book_id       uuid not null references books(id) on delete cascade,
  page_number   integer not null,
  image_url     text not null,
  width         integer not null,
  height        integer not null,
  created_at    timestamptz not null default now(),

  constraint book_preview_pages_page_number_check check (page_number > 0),
  constraint book_preview_pages_book_page_unique unique (book_id, page_number)
);

create index if not exists book_preview_pages_book_id_idx
  on book_preview_pages (book_id, page_number);

-- ----------------------------------------------------------------------------
-- 2. RLS
-- ----------------------------------------------------------------------------
-- מחמיר יותר מ-book_images/book_toc (using(true) בשלב ג׳): שם ההסתמכות
-- היא על כך שהעמוד הציבורי תמיד שולף דרך join עם books, שכבר מסנן טיוטות.
-- כאן צוין במפורש שדפי דוגמה של ספר לא-מפורסם אסורים בקריאה ציבורית גם
-- בגישה ישירה לטבלה, ולכן התנאי חוזר על עצמו כאן ולא רק ב-books.
alter table book_preview_pages enable row level security;

drop policy if exists book_preview_pages_public_read on book_preview_pages;
create policy book_preview_pages_public_read on book_preview_pages
  for select
  using (
    exists (
      select 1 from books b
      where b.id = book_preview_pages.book_id
        and (b.is_published or public.can_edit())
    )
  );

drop policy if exists book_preview_pages_edit on book_preview_pages;
create policy book_preview_pages_edit on book_preview_pages
  for all
  using (public.can_edit())
  with check (public.can_edit());

grant select on book_preview_pages to anon, authenticated;
grant insert, update, delete on book_preview_pages to authenticated;

-- ============================================================================
-- אחסון: אין buckets חדשים
-- ----------------------------------------------------------------------------
-- הדמיית ה-Hero משתמשת ב-bucket הקיים 'covers' (תחת mockups/) — היא
-- וריאציה של אותו נכס בדיוק (תמונת כריכה ל-Hero), ולא סוג נכס חדש.
-- דפי הדוגמה משתמשים ב-bucket הקיים 'samples' (תחת previews/{bookId}/) —
-- הם נגזרים מה-PDF שכבר יושב שם. שני ה-buckets כבר ציבוריים לקריאה
-- ומוגבלים לצוות העריכה בכתיבה (ראו storage_public_read/storage_staff_write
-- ב-02_site_additions.sql), כך שאין צורך במדיניות Storage נוספת.
-- ============================================================================
