-- ============================================================================
-- מכון קרן רא"ם — הרחבות מסחר על הקטלוג + אילוצי הגנה על שדות קיימים
-- להרצה אחרי 25_customers.sql
-- ============================================================================
-- שתי הערות תכן:
--
-- 1. עלות פנימית (cost_price) *אינה* נוספת כאן במכוון. RLS היא ברמת שורה,
--    ו-books_public_read חושפת את כל העמודות — עמודת עלות הייתה נקראת
--    בקריאת API ציבורית. היא תתווסף רק יחד עם מנגנון הרשאות עמודתי
--    (view נפרד לצוות), בשלב הדוחות.
--
-- 2. תיקון נתונים לפני האילוצים: stock_quantity ריק בטופס הקיים נכתב
--    כ-null (schema.ts משתמש ב-f ולא fd). האילוץ דורש >= 0 על ערך שאינו
--    null, כך ש-null חוקי — אבל מיושר כאן ל-0 כדי שהמשמעות תהיה אחידה.
-- ============================================================================

-- מחיר מבצע
alter table books add column if not exists sale_price numeric(10,2);
alter table books add column if not exists sale_starts_at timestamptz;
alter table books add column if not exists sale_ends_at timestamptz;
alter table books add column if not exists sale_name_he text;
alter table books add column if not exists sale_name_en text;
alter table books add column if not exists compare_at_price numeric(10,2);

-- מס ומלאי
alter table books add column if not exists tax_group text not null default 'standard';
alter table books add column if not exists is_stock_managed boolean not null default true;
alter table books add column if not exists low_stock_threshold int;
alter table books add column if not exists allow_backorder boolean not null default false;

-- זיהוי ולוגיסטיקה
alter table books add column if not exists barcode text;
alter table books add column if not exists prep_days_override int;
alter table books add column if not exists free_shipping_eligible boolean not null default true;
alter table books add column if not exists coupons_excluded boolean not null default false;

-- תיקון נתונים לפני האילוצים
update books set stock_quantity = 0 where stock_quantity is null;
update books set price = null where price is not null and price < 0;
update books set weight_grams = null where weight_grams is not null and weight_grams < 0;

-- אילוצי הגנה (על הקיים ועל החדש)
alter table books drop constraint if exists books_price_nonnegative;
alter table books add constraint books_price_nonnegative
  check (price is null or price >= 0);

alter table books drop constraint if exists books_sale_price_nonnegative;
alter table books add constraint books_sale_price_nonnegative
  check (sale_price is null or sale_price >= 0);

alter table books drop constraint if exists books_stock_nonnegative;
alter table books add constraint books_stock_nonnegative
  check (stock_quantity is null or stock_quantity >= 0);

alter table books drop constraint if exists books_weight_nonnegative;
alter table books add constraint books_weight_nonnegative
  check (weight_grams is null or weight_grams >= 0);

alter table books drop constraint if exists books_tax_group_valid;
alter table books add constraint books_tax_group_valid
  check (tax_group in ('standard', 'exempt'));

-- ============================================================================
-- Rollback:
--   alter table books
--     drop constraint if exists books_tax_group_valid,
--     drop constraint if exists books_weight_nonnegative,
--     drop constraint if exists books_stock_nonnegative,
--     drop constraint if exists books_sale_price_nonnegative,
--     drop constraint if exists books_price_nonnegative;
--   alter table books
--     drop column if exists coupons_excluded,
--     drop column if exists free_shipping_eligible,
--     drop column if exists prep_days_override,
--     drop column if exists barcode,
--     drop column if exists allow_backorder,
--     drop column if exists low_stock_threshold,
--     drop column if exists is_stock_managed,
--     drop column if exists tax_group,
--     drop column if exists compare_at_price,
--     drop column if exists sale_name_en,
--     drop column if exists sale_name_he,
--     drop column if exists sale_ends_at,
--     drop column if exists sale_starts_at,
--     drop column if exists sale_price;
-- ============================================================================
