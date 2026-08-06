-- ============================================================================
-- מכון קרן רא"ם — הפרדת לקוחות ממשתמשי צוות (שלב 1 של המסחר)
-- להרצה אחרי 22_book_location_size.sql
-- ============================================================================
-- עד היום כל רשומה חדשה ב-auth.users קיבלה שורת profiles עם role='viewer' —
-- כלומר פרופיל *צוות* שעובר את שער requireRole('viewer') של דשבורד הניהול.
-- כשנפתחת הרשמת לקוחות (OTP), אסור שלקוח יקבל פרופיל צוות.
--
-- הפתרון: הטריגר יוצר פרופיל רק כשהמשתמש סומן צוות במפורש, בדגל
-- kr_staff בתוך raw_app_meta_data. נבחר app_metadata ולא user_metadata
-- במכוון: user_metadata ניתן לעדכון על ידי המשתמש עצמו דרך ה-API של
-- Supabase, ו-app_metadata נכתב רק מצד שרת או מדשבורד הניהול — לקוח
-- אינו יכול להעניק לעצמו את הדגל.
--
-- השלכה תפעולית (מעודכן גם ב-README): בהוספת איש צוות חדש בדשבורד
-- Supabase יש להוסיף ל-App Metadata את המפתח:  {"kr_staff": "true"}
-- ואז להריץ את 05_repair_profiles.sql אם הפרופיל לא נוצר (משתמש שנוצר
-- לפני הוספת הדגל). לקוחות חנות לעולם אינם מקבלים את הדגל.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(new.raw_app_meta_data->>'kr_staff', '') = 'true' then
    insert into public.profiles (id, full_name)
    values (new.id, new.raw_user_meta_data->>'full_name');
  end if;
  return new;
end;
$$;

-- ============================================================================
-- Rollback (החזרת ההתנהגות הקודמת — פרופיל לכל משתמש חדש):
--   הריצו מחדש את הגדרת handle_new_user מתוך 13_harden_search_path.sql
--   (הגרסה הבלתי-מותנית). אין נתונים למחוק — הפונקציה בלבד השתנתה.
-- ============================================================================
