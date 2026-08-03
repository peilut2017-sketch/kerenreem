-- ============================================================================
-- מכון קרן רא"ם — אנליטיקס עצמאי: צפיות בעמודים
-- להרצה אחרי 17_logo_dark_variant.sql
-- ============================================================================
-- טבלת ביקורים ראשונית לפילוח ומעקב כניסות לאתר, בלי כלי חיצוני: כל שורה
-- היא צפיה אחת בעמוד, בלי מידע מזהה אישי.
--
-- visitor_hash אינו כתובת IP ואינו נשמר בשום מקום: הוא גיבוב חד-כיווני
-- (SHA-256) של IP + User-Agent + תאריך היום (ראו
-- src/lib/analytics/actions.ts), שמתחלף בכל יום קלנדרי. כך אפשר לספור
-- "מבקרים ייחודיים" בטווח זמן בלי לשמור זיהוי בר-מעקב לאורך זמן — אי
-- אפשר לשחזר ממנו את כתובת ה-IP, ואי אפשר לקשר בין ביקור אתמול לביקור
-- היום של אותו אדם.
-- ============================================================================

create table if not exists page_views (
  id             uuid primary key default gen_random_uuid(),
  path           text not null,
  locale         text not null default 'he',
  -- רק שם המתחם של המפנה (למשל google.com), לא הכתובת המלאה — כתובת
  -- מלאה עלולה לכלול פרמטרים עם מידע מזהה מהאתר המפנה.
  referrer_host  text,
  visitor_hash   text not null,
  created_at     timestamptz not null default now()
);

create index if not exists idx_page_views_created on page_views (created_at desc);
create index if not exists idx_page_views_path on page_views (path);
create index if not exists idx_page_views_visitor_day on page_views (visitor_hash, created_at);

alter table page_views enable row level security;

-- כל מבקר (גם אנונימי) יכול לתעד צפיה משלו...
drop policy if exists page_views_insert on page_views;
create policy page_views_insert on page_views
  for insert to anon, authenticated
  with check (true);

-- ...אבל רק הצוות (עורך ומעלה) קורא את הנתונים המצטברים בדשבורד.
drop policy if exists page_views_staff_read on page_views;
create policy page_views_staff_read on page_views
  for select using (public.can_edit());

-- מחיקה (למשל צמצום תקופת שמירה) — מנהל בלבד. אין מחיקה אוטומטית: זו
-- בחירת מדיניות שמירה שהצוות מפעיל ביודעין, לא התנהגות סמויה של הקוד.
drop policy if exists page_views_admin_delete on page_views;
create policy page_views_admin_delete on page_views
  for delete using (public.is_admin());
