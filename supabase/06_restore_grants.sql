-- ============================================================================
-- מכון קרן רא"ם — שחזור הרשאות אחרי drop schema public
-- ============================================================================
-- מתי צריך את זה:
--
-- Supabase מעניקה מראש הרשאות על סכימת public לתפקידים anon, authenticated
-- ו-service_role — אלה התפקידים שדרכם האתר ניגש למסד. הפקודה
-- `drop schema public cascade` מוחקת את ההרשאות האלה יחד עם הסכימה,
-- ויצירתה מחדש אינה מחזירה אותן.
--
-- התוצאה מבלבלת: הנתונים קיימים במסד ונראים מצוין ב-SQL Editor (שרץ
-- בתפקיד postgres), אבל האתר מקבל "permission denied" על כל טבלה.
-- הסימפטומים:
--   • ההתחברות מצליחה אך המסך אומר שאין למשתמש פרופיל — למרות ששורת
--     הפרופיל קיימת
--   • הקטלוג ריק באתר הציבורי גם אחרי הרצת ה-seed
--   • טופס יצירת הקשר נכשל
--
-- RLS אינו מושפע: ההרשאות כאן פותחות את הדלת לטבלה, ומדיניות ה-RLS
-- ממשיכה לקבוע אילו שורות נראות. שתי השכבות עובדות יחד.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. אבחון — האם יש הרשאת קריאה לתפקידי האתר?
-- ----------------------------------------------------------------------------
select
  t.tablename,
  has_table_privilege('anon',          'public.' || t.tablename, 'SELECT') as anon_select,
  has_table_privilege('authenticated', 'public.' || t.tablename, 'SELECT') as auth_select
from pg_tables t
where t.schemaname = 'public'
order by t.tablename;

-- אם העמודות מציגות false — זו הבעיה. הריצו את סעיף 2.

-- ----------------------------------------------------------------------------
-- 2. שחזור ההרשאות
-- ----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;

-- ⚠ פונקציות — service_role בלבד, ובכוונה.
--
-- הרבה מפונקציות המסחר הן SECURITY DEFINER (commerce_reserve_stock,
-- commerce_adjust_stock, commerce_rate_limit ועוד): RLS אינו חוסם הרצת
-- פונקציה, ולכן EXECUTE ל-anon על פונקציה כזו הוא הסלמת הרשאות ישירה —
-- כל מבקר עם המפתח הציבורי היה יכול לשנות מלאי או לשרוף מכסות קצב.
-- מיגרציות 13/30/31/36/37/40 מעניקות אותן ל-service_role בלבד; שחזור
-- גורף היה מבטל את ההקשחה הזו. לכן כאן service_role בלבד, והפונקציה
-- הציבורית היחידה שאורח באמת צריך מוענקת במפורש למטה.
grant all on all functions in schema public to service_role;

-- increment_book_view — מונה הצפיות הציבורי (10_book_page_stage_c.sql).
-- הפונקציה הציבורית היחידה שאורח קורא בפועל (lib/data.ts). שאר
-- הפונקציות נשארות שרת-בלבד.
do $$
begin
  execute 'grant execute on function public.increment_book_view(text) to anon, authenticated';
exception when undefined_function then
  raise notice 'increment_book_view not present yet — run 10_book_page_stage_c.sql first';
end $$;

-- הרשאות ברירת מחדל — לטבלאות/רצפים שייווצרו בעתיד בלבד. פונקציות
-- מוחרגות במכוון: פונקציה חדשה מקבלת את הגדר שמיגרציית האבטחה שלה
-- קובעת (ברירת מחדל: service_role), לא EXECUTE גורף ל-anon.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to service_role;

-- ----------------------------------------------------------------------------
-- 3. אימות
-- ----------------------------------------------------------------------------
-- הריצו שוב את שאילתת האבחון שבסעיף 1. כל השורות אמורות להציג true.
--
-- ⚠ true כאן אינו אומר שהמידע חשוף. הוא אומר שהתפקיד רשאי לגשת לטבלה;
--   אילו שורות יחזרו בפועל נקבע ב-RLS. כך זה אמור לעבוד ב-Supabase:
--   anon מקבל SELECT על books, ומדיניות books_public_read מגבילה אותו
--   לשורות עם is_published = true בלבד.
-- ============================================================================
