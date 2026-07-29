-- ============================================================================
-- מכון קרן רא"ם — באנרים לקרוסלת הפתיחה
-- להרצה אחרי 02_site_additions.sql
-- ============================================================================
-- עד כה הקרוסלה נבנתה אוטומטית מספר, אירוע וציר פעילות. הטבלה הזו נותנת
-- שליטה ידנית: איזה באנר מוצג, באיזה סדר, לאן הוא מוביל, ומתי הוא נכבה.
--
-- שתי תמונות לכל באנר במכוון:
--   image_url         — רחב, למסך מחשב
--   image_mobile_url  — לאנכי, לנייד (רשות)
-- קידוד תמונה רחבה לנייד חותך את מרכז העניין או מקטין אותו עד לבלתי
-- נראה. כשאין תמונת נייד, נעשה שימוש ברחבה עם מיקוד לפי focal_point.
-- ============================================================================

create table if not exists banners (
  id            uuid primary key default gen_random_uuid(),

  title_he      text not null,
  title_en      text,
  subtitle_he   text,
  subtitle_en   text,

  image_url         text,          -- שולחני, רחב
  image_mobile_url  text,          -- נייד, אנכי (רשות)
  -- נקודת המיקוד בחיתוך התמונה הרחבה כשאין גרסת נייד
  focal_point   text not null default 'center'
                check (focal_point in ('center', 'top', 'bottom', 'start', 'end')),

  link_url      text,              -- יעד הלחיצה: נתיב פנימי (/books/x) או כתובת מלאה
  cta_label_he  text,
  cta_label_en  text,

  is_published  boolean not null default false,
  sort_order    int not null default 0,
  -- חלון תצוגה אופציונלי: באנר של אירוע יכול לכבות מעצמו אחרי המועד
  starts_at     timestamptz,
  ends_at       timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint banners_title_len check (char_length(title_he) between 1 and 120),
  constraint banners_window check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create index if not exists idx_banners_live
  on banners (sort_order) where is_published = true;

drop trigger if exists trg_banners_updated on banners;
create trigger trg_banners_updated
  before update on banners
  for each row execute function set_updated_at();

alter table banners enable row level security;

drop policy if exists banners_public_read on banners;
create policy banners_public_read on banners
  for select using (is_published or public.can_edit());

drop policy if exists banners_edit on banners;
create policy banners_edit on banners
  for all using (public.can_edit()) with check (public.can_edit());

-- ההרשאות לתפקידי האתר. טבלה חדשה אחרי drop schema public לא מקבלת אותן
-- אוטומטית, ולכן מעניקים כאן במפורש.
grant select on banners to anon, authenticated;
grant insert, update, delete on banners to authenticated;

-- ============================================================================
-- גדלי תמונה מומלצים
-- ----------------------------------------------------------------------------
--   שולחני : 2400 × 1000 (יחס 12:5). מינימום 1920 × 800.
--   נייד   : 1080 × 1350 (יחס 4:5).
--   פורמט  : JPEG או WebP, עד 400KB לתמונה.
--
-- הקרוסלה מכהה את התמונה ומניחה עליה טקסט לבן, ולכן עדיף צילום שאזור
-- המרכז שלו אינו עמוס — או להשאיר בו שטח נקי לכותרת.
-- ============================================================================
