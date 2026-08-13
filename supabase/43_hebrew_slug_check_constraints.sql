-- ============================================================================
-- מכון קרן רא"ם — תמיכה בעברית בכתובות: תיקון אילוצי CHECK ישנים במסד
-- להרצה אחרי 42_external_supplier.sql
-- ============================================================================
--
-- [1.10] כתובות מותאמות (slug) הורחבו לתמוך גם באותיות עבריות ברמת
-- האפליקציה — ראו SLUG_PATTERN ב-src/lib/admin/actions.ts, שכבר תוקן
-- לכלול את הטווח א-ת. אבל ארבעה אילוצי CHECK במסד (series, tags,
-- attributes, attribute_values) המשיכו לאכוף את הדפוס הלטיני-בלבד
-- הישן, שמעולם לא עודכן יחד עם קוד האפליקציה. התוצאה: slug עברי עבר
-- את הוולידציה בשרת (saveEntity) ואז נדחה בשקט על ידי המסד עם שגיאת
-- check_violation גנרית — למשל שמירת סדרה עם כתובת בעברית נכשלת בלי
-- שהעורך מבין למה, כי הודעת השגיאה אינה ספציפית לשדה.
--
-- ל-categories ול-authors אין אילוץ CHECK מקביל בסכימה המתועדת בריפו
-- הזה — ה-drop if exists לשתיהן כאן הוא רשת ביטחון בלבד, למקרה שבמסד
-- החי נוסף ידנית אילוץ מקביל שלא הוזן למיגרציות (סטייה בין הסכימה
-- המתועדת לזו שבפועל).
-- ============================================================================

alter table series           drop constraint if exists series_slug_format;
alter table tags             drop constraint if exists tags_slug_format;
alter table attributes       drop constraint if exists attributes_slug_format;
alter table attribute_values drop constraint if exists attribute_values_slug_format;
alter table categories       drop constraint if exists categories_slug_format;
alter table authors          drop constraint if exists authors_slug_format;

alter table series           add constraint series_slug_format           check (slug ~ '^[a-z0-9א-ת]+(-[a-z0-9א-ת]+)*$');
alter table tags             add constraint tags_slug_format             check (slug ~ '^[a-z0-9א-ת]+(-[a-z0-9א-ת]+)*$');
alter table attributes       add constraint attributes_slug_format       check (slug ~ '^[a-z0-9א-ת]+(-[a-z0-9א-ת]+)*$');
alter table attribute_values add constraint attribute_values_slug_format check (slug ~ '^[a-z0-9א-ת]+(-[a-z0-9א-ת]+)*$');
alter table categories       add constraint categories_slug_format       check (slug ~ '^[a-z0-9א-ת]+(-[a-z0-9א-ת]+)*$');
alter table authors          add constraint authors_slug_format          check (slug ~ '^[a-z0-9א-ת]+(-[a-z0-9א-ת]+)*$');

-- ============================================================================
-- Rollback:
--   alter table series           drop constraint if exists series_slug_format;
--   alter table tags             drop constraint if exists tags_slug_format;
--   alter table attributes       drop constraint if exists attributes_slug_format;
--   alter table attribute_values drop constraint if exists attribute_values_slug_format;
--   alter table categories       drop constraint if exists categories_slug_format;
--   alter table authors          drop constraint if exists authors_slug_format;
--
--   alter table series           add constraint series_slug_format           check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
--   alter table tags             add constraint tags_slug_format             check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
--   alter table attributes       add constraint attributes_slug_format       check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
--   alter table attribute_values add constraint attribute_values_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
--   -- categories/authors לא היה להם אילוץ קודם — אין מה להחזיר עבורם.
-- ============================================================================
