-- ============================================================================
-- מכון קרן רא"ם — הקשחה: pg_temp מפורש בפונקציות security definer
-- להרצה אחרי 12_book_page_v2.sql
-- ============================================================================
-- ארבע פונקציות ההרשאה הוגדרו עם `set search_path = public`. זה נראה מוגן,
-- אבל אינו מספיק: כש-pg_temp אינו מופיע ברשימה במפורש, PostgreSQL עדיין
-- מחפש בו **ראשון**. משתמש בעל תפקיד authenticated רשאי ליצור אובייקטים
-- זמניים, ולכן יכול להגדיר pg_temp.current_user_role() משלו — וזו הגרסה
-- שתיקרא מתוך can_edit() ו-is_admin(), ששתיהן קוראות לה בשם לא מוסמך.
--
-- התוצאה האפשרית: פונקציה שמחזירה 'admin' לכל מי שיצר אותה, ובעקבותיה
-- כל מדיניות RLS שנשענת על can_edit()/is_admin() — כלומר כל הכתיבה לאתר.
--
-- שני תיקונים משלימים כאן:
--   1. pg_temp אחרון ברשימת ה-search_path, כך שהחיפוש בו קורה אחרי public.
--   2. קריאות פנימיות מוסמכות בשם מלא (public.current_user_role), כדי
--      שהפתרון לא יסתמך על search_path בלבד.
--
-- אותו דפוס כבר יושם נכון ב-increment_book_view (10_book_page_stage_c.sql);
-- כאן הוא מוחל גם על ארבע הפונקציות הוותיקות.
-- ============================================================================

create or replace function public.current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.can_edit()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_user_role() in ('admin', 'editor');
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.current_user_role() = 'admin';
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;
