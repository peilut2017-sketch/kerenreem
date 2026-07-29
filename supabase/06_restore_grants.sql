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
grant all on all functions in schema public to anon, authenticated, service_role;

-- הרשאות ברירת מחדל — כדי שגם טבלאות שייווצרו בעתיד יקבלו אותן אוטומטית,
-- ולא נחזור לכאן בכל שינוי סכימה.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;

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
