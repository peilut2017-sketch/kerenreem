-- ============================================================================
-- מכון קרן רא"ם — עמוד הספר, גרסה 3: מרחב גילוי ועיון
-- להרצה אחרי 13_harden_search_path.sql
-- ============================================================================
-- שלוש תוספות, כל אחת סוגרת פער אמיתי בעמוד הספר החדש ולא שדה שאולי
-- ישמש בעתיד:
--
-- 1. הוצאה ומהדורה — אין להם שדה כלל היום. "כריכה"/"פורמט" קיימים כבר
--    כמאפיינים, אבל הוצאה לאור ומהדורה הם מידע על הספר עצמו, לא סיווג.
--
-- 2. גוונים אופציונליים לרקע ה-Hero ("אווירה"). ברירת המחדל היא עדיין
--    חילוץ הצבע מהכריכה (getCoverPalette, קיים) — השדות כאן הם override
--    ידני, לספר שבו הצבע שנחלץ אוטומטית לא מתאים.
--
-- 3. is_featured / preorder — שני מצבים אמיתיים שלעמוד אין היום דרך
--    לבטא: "בחירת הצוות" ו"בקרוב". לא הוספנו marketing_badge טקסטואלי
--    חופשי: התגיות הקיימות (tags, 08_pim_stage_a.sql) כבר משמשות
--    "חדש"/"רב מכר", ובאדג' חופשי נוסף היה יוצר שני מקומות לאותה כוונה.
--
-- קשרים ידניים בין ספרים (book_relations) הם הרחבה נפרדת, ראו סעיף 4 —
-- הם התוספת היחידה שהיא טבלה ולא עמודה, כי לקשר יש שני צדדים וסוג.
-- ============================================================================

alter table books add column if not exists publisher_he text;
alter table books add column if not exists publisher_en text;
alter table books add column if not exists edition_he text;
alter table books add column if not exists edition_en text;

-- צבעי HEX בלבד ("#rrggbb") — נצרכים כ-CSS custom property, לא כמזהה
-- צבע בשם (Tailwind וכו') כדי שלא יהיה תלוי בבנייה.
alter table books add column if not exists accent_primary text;
alter table books add column if not exists accent_secondary text;
alter table books drop constraint if exists books_accent_primary_format;
alter table books add constraint books_accent_primary_format
  check (accent_primary is null or accent_primary ~ '^#[0-9a-fA-F]{6}$');
alter table books drop constraint if exists books_accent_secondary_format;
alter table books add constraint books_accent_secondary_format
  check (accent_secondary is null or accent_secondary ~ '^#[0-9a-fA-F]{6}$');

alter table books add column if not exists is_featured boolean not null default false;
alter table books add column if not exists preorder_enabled boolean not null default false;
alter table books add column if not exists preorder_release_date date;

-- ----------------------------------------------------------------------------
-- 4. קשרים ידניים בין ספרים
-- ----------------------------------------------------------------------------
-- "להמשיך מכאן" נשען קודם כול על קשרים שהצוות קבע בעצמו (עדיפות ראשונה
-- בסעיף הגילוי), ורק כשאין כאלה עובר לקשרים הנגזרים (מחבר/סדרה/קטגוריה,
-- כולם קיימים כבר ב-getBookConnections). כיוון אחד בלבד (source→target):
-- קשר לא בהכרח סימטרי ("כרך קודם" הוא היחס ההפוך של "כרך הבא", לא אותו
-- קשר משני הצדדים), ומי שרוצה קישור דו-כיווני מוסיף שתי שורות.
create table if not exists book_relations (
  id               uuid primary key default gen_random_uuid(),
  source_book_id   uuid not null references books(id) on delete cascade,
  target_book_id   uuid not null references books(id) on delete cascade,
  relation_type    text not null,
  sort_order       int not null default 0,
  note_he          text,
  note_en          text,
  created_at       timestamptz not null default now(),

  constraint book_relations_not_self check (source_book_id <> target_book_id),
  constraint book_relations_type check (relation_type in (
    'complements', 'recommended', 'previous_edition', 'next_edition',
    'staff_pick', 'bundle'
  )),
  unique (source_book_id, target_book_id, relation_type)
);

create index if not exists idx_book_relations_source on book_relations (source_book_id, sort_order);

alter table book_relations enable row level security;

drop policy if exists book_relations_public_read on book_relations;
create policy book_relations_public_read on book_relations for select using (true);

drop policy if exists book_relations_edit on book_relations;
create policy book_relations_edit on book_relations for all
  using (public.can_edit()) with check (public.can_edit());

grant select on book_relations to anon, authenticated;
grant insert, update, delete on book_relations to authenticated;

-- ============================================================================
-- מה במכוון אינו כאן
-- ----------------------------------------------------------------------------
--   מבצעים ומחסנים — אין להם משמעות כל עוד store_enabled כבוי (ראו הערה
--   זהה ב-08_pim_stage_a.sql). מנוע תמחור שאין לו צרכן הוא עבודה שתיכתב
--   פעמיים: פעם עכשיו, ופעם כשתיפתח החנות ויתבררו הדרישות האמיתיות.
--
--   "נרכשו יחד" / "נצפו לאחריו" — כבר הוסבר ב-10_book_page_stage_c.sql
--   שהם דורשים נתוני רכישה/מעקב שאין. עדיין נכון כאן.
--
--   ביקורות — טבלה שלמה (דירוג, טקסט, אישור) בלי החלטה על ניהולה
--   ב-CMS היא מבנה שאיש לא יכול למלא. האזור בעמוד מוסתר עד אז.
-- ============================================================================
