-- ============================================================================
-- מכון קרן רא"ם — גופנים מותקנים
-- להרצה אחרי 46_inquiries_v2.sql
-- ============================================================================
--
-- מערכת התקנת גופנים לאתר: מנהל מעלה קובץ גופן (woff2/woff/ttf) ל-bucket
-- הציבורי 'site', והאתר מזריק @font-face ומשתנה CSS ‏--font-custom-<slug>
-- לשני ה-root layouts (ראו CustomFontsStyle.tsx). כך הגופן זמין גם
-- בעורכי הטקסט העשיר בניהול (בורר הגופנים) וגם בתוכן שנשמר ומוצג באתר —
-- הערך שנשמר ב-HTML הוא משתנה ה-CSS, לא שם הגופן, בדיוק כמו הגופנים
-- המובנים (ראו lib/fonts.ts ו-sanitize.ts).
-- ============================================================================

create table if not exists custom_fonts (
  id uuid primary key default gen_random_uuid(),
  -- השם שמוצג בבורר הגופנים בעורך
  name text not null check (char_length(name) between 1 and 60),
  -- סיומת משתנה ה-CSS: ‏--font-custom-<slug>. לטיני קטן בלבד — נכנס לתוך
  -- selector ולתוך regex הסינון של sanitize.ts
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,40}$'),
  -- כתובת הקובץ ב-bucket הציבורי; נבדקת גם באפליקציה (רק אחסון הפרויקט)
  font_url text not null check (char_length(font_url) <= 500),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table custom_fonts enable row level security;

-- הציבור קורא (העמודים הציבוריים מזריקים @font-face); צוות תוכן מנהל.
drop policy if exists custom_fonts_public_read on custom_fonts;
create policy custom_fonts_public_read on custom_fonts
  for select using (true);

drop policy if exists custom_fonts_staff_write on custom_fonts;
create policy custom_fonts_staff_write on custom_fonts
  for all to authenticated
  using (public.can_edit())
  with check (public.can_edit());

grant select on custom_fonts to anon;
grant select, insert, update, delete on custom_fonts to authenticated;
