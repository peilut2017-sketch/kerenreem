-- [1.21] קטגוריות מרובות לספר — book_categories (08_pim_stage_a.sql)
-- כבר קיימת, אך שימשה עד כה רק "מדפים נוספים" משניים: הקטגוריה
-- הראשית (books.category_id) מעולם לא הועתקה אליה, והתצוגה הציבורית
-- הציגה תמיד קטגוריה יחידה בלבד. עכשיו שהתצוגה עוברת לקרוא מ-
-- book_categories (ראו BOOK_SELECT ב-data.ts), כל ספר שיש לו category_id
-- אבל אין לו שורה תואמת ב-book_categories היה מציג "בלי קטגוריה" —
-- רגרסיה על כל ספר קיים. גיבוי חד-פעמי ואידמפוטנטי (on conflict do
-- nothing) לפני שינוי ההתנהגות.
insert into book_categories (book_id, category_id)
select id, category_id from books
where category_id is not null
on conflict (book_id, category_id) do nothing;
