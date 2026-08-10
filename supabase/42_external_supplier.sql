-- ============================================================================
-- מכון קרן רא"ם — רכישה דרך ספק חיצוני (מודל 1.9)
-- להרצה אחרי 41_screen_permissions.sql
-- ============================================================================
--
-- [1.9] ספר שלא נמכר (או לא רק נמכר) דרך קרן רא"ם עצמה — למשל הוצאה
-- חיצונית שמוכרת אותו באתר שלה. ארבעה שדות על books, כולם רשות:
-- external_supplier_enabled (המתג הראשי), external_supplier_url/name
-- (קישור הרכישה ושם הספק להצגה), ו-external_supplier_always_show —
-- override נפרד להצגת הכפתור גם כשהספר כן נמכר אצלנו (is_purchasable
-- וחנות פתוחה); בלעדיו הכפתור מוצג רק כשהרכישה הישירה אצלנו אינה
-- זמינה בפועל (לא ניתן לרכישה, או שהחנות כבויה).
-- ============================================================================

alter table books add column if not exists external_supplier_enabled boolean not null default false;
alter table books add column if not exists external_supplier_url text;
alter table books add column if not exists external_supplier_name text;
alter table books add column if not exists external_supplier_always_show boolean not null default false;

-- ============================================================================
-- Rollback:
--   alter table books
--     drop column if exists external_supplier_always_show,
--     drop column if exists external_supplier_name,
--     drop column if exists external_supplier_url,
--     drop column if exists external_supplier_enabled;
-- ============================================================================
