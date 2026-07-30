-- ============================================================================
-- מכון קרן רא"ם — סיפור האירוע: תוכן שזור עם מדיה
-- להרצה אחרי 10_book_page_stage_c.sql
-- ============================================================================
-- עמוד אירוע ישן היה רצף קבוע: כותרת → תמונת שער → וידאו → כל הטקסט →
-- כל הגלריה בסוף. את זה מחליף רצף "בלוקים" שהעורך בונה בעצמו: פסקת
-- טקסט, תמונה גדולה, שורת 2–4 תמונות (מוזאיקה), וידאו, או ציטוט — לפי
-- הסדר שהוא בוחר. כך המדיה יושבת בתוך הסיפור ולא מופרדת ממנו, וכל אירוע
-- יכול להיראות אחרת מהאחרים.
--
-- events.gallery (jsonb, קיים כבר) לא נעלם: הוא הופך ל"גלריה המסיימת" —
-- תמונות שהעורך לא שיבץ ידנית לתוך הסיפור, ומוצגות בהדרגה בסוף העמוד
-- במקום כל התמונות בבת אחת.
-- ============================================================================

create table if not exists event_blocks (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references events(id) on delete cascade,
  type        text not null check (type in ('text', 'image', 'image_row', 'video', 'quote')),
  sort_order  int not null default 0,

  -- תג תחנה אופציונלי, למשל "קבלת פנים" או "חלוקת הספרים". מד ההתקדמות
  -- שבראש העמוד נגזר מרשימת התגים הייחודיים לפי סדר הופעתם באירוע —
  -- בלי תג על אף בלוק, פשוט אין מד. אין רשימה סגורה בכוונה: לכל אירוע
  -- מהלך משלו, ורשימת תחנות קבועה הייתה מכריחה את כולם לאותה תבנית.
  stage_label text,

  -- type = 'text': פסקת סיפור
  body_he     text,
  body_en     text,

  -- type = 'image': תמונה גדולה בודדת, מוצגת במלוא הרוחב
  image_url         text,
  image_alt         text,
  image_caption_he  text,

  -- type = 'image_row': שורת 2–4 תמונות במוזאיקה. מערך ולא טבלה נפרדת —
  -- אין לתמונות כאן קיום עצמאי מחוץ לבלוק שלהן, בניגוד ל-book_images.
  images      jsonb not null default '[]'::jsonb,

  -- type = 'video': YouTube/Vimeo, כמו events.featured_video_url
  video_url         text,
  video_caption_he  text,

  -- type = 'quote': ציטוט מהאירוע, מוצג כמו על קלף
  quote_text            text,
  quote_attribution_he  text,

  created_at  timestamptz not null default now(),

  constraint event_blocks_stage_label_len check (stage_label is null or char_length(stage_label) <= 60)
);

create index if not exists idx_event_blocks_event on event_blocks (event_id, sort_order);

comment on column events.gallery is
  'הגלריה המסיימת: תמונות שלא שובצו ידנית לתוך event_blocks, מוצגות בהדרגה בסוף עמוד האירוע.';

-- ----------------------------------------------------------------------------
-- RLS — קריאה ציבורית (תוכן קטלוגי), כתיבה לצוות העריכה בלבד. אותו דפוס
-- כמו book_images/book_toc ב-10_book_page_stage_c.sql.
-- ----------------------------------------------------------------------------
alter table event_blocks enable row level security;

drop policy if exists event_blocks_public_read on event_blocks;
create policy event_blocks_public_read on event_blocks for select using (true);

drop policy if exists event_blocks_edit on event_blocks;
create policy event_blocks_edit on event_blocks for all
  using (public.can_edit()) with check (public.can_edit());

grant select on event_blocks to anon, authenticated;
grant insert, update, delete on event_blocks to authenticated;

-- ============================================================================
-- מה במכוון אינו כאן
-- ----------------------------------------------------------------------------
--   גודל תצוגה ידני לכל תמונה (גדולה/קטנה/פנורמית) — הפריסה במוזאיקה
--   נקבעת בקוד התצוגה לפי יחס הרוחב-גובה של כל תמונה ולפי מיקומה בשורה,
--   לא בשדה שהעורך צריך למלא. עורך שבוחר תמונות טובות לא צריך גם לדעת
--   מה זה "פנורמי".
-- ============================================================================
