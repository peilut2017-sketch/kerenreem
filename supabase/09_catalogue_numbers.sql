-- ============================================================================
-- מכון קרן רא"ם — מספור רץ לספרים ולמחברים
-- להרצה אחרי 08_pim_stage_a.sql
-- ============================================================================
-- לכל ספר ולכל מחבר יש כבר מזהה uuid, אבל אי אפשר להקריא אותו בטלפון.
-- המספר הרץ הוא המזהה האנושי: "ספר 47".
--
-- שתי החלטות:
--
-- 1. מספור נפרד לספרים ולמחברים, ולא רצף אחד משותף. ספר 12 ומחבר 12 הם
--    שתי ישויות שונות, וזה בסדר — הקשר ברור מהמסך שבו הם מופיעים. רצף
--    משותף היה יוצר פערים בכל אחת מהסדרות ומקשה על הקריאה.
--
-- 2. המספר אינו ניתן לעריכה ואינו ממוחזר. רשומה שנמחקה משאירה חור, וזו
--    התנהגות נכונה: מספר שהוקצה מחדש היה הופך הפניה ישנה למסמך אחר.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['books', 'authors']
  loop
    execute format('alter table %I add column if not exists catalogue_number int', t);

    execute format(
      'create sequence if not exists %I owned by %I.catalogue_number',
      t || '_catalogue_number_seq', t
    );

    -- מילוי הרשומות הקיימות לפי סדר ההוספה, כך שהמספור משקף את
    -- ההיסטוריה ולא סדר אקראי של שורות
    execute format(
      'update %I set catalogue_number = numbered.position
       from (
         select id, row_number() over (order by created_at, id) as position
         from %I where catalogue_number is null
       ) as numbered
       where %I.id = numbered.id',
      t, t, t
    );

    -- הרצף ממשיך מהמספר הגבוה ביותר שכבר בשימוש
    execute format(
      'select setval(%L, coalesce((select max(catalogue_number) from %I), 0) + 1, false)',
      t || '_catalogue_number_seq', t
    );

    -- אין default על העמודה במכוון: הטריגר למטה קורא nextval() בעצמו
    -- בכל הוספה, ללא תנאי. default במקביל היה גורם לשני צריכות רצף
    -- לכל שורה — אחת מה-default ואחת מהטריגר שדורס אותה מיד אחר כך.
    execute format('alter table %I alter column catalogue_number set not null', t);

    execute format(
      'alter table %I drop constraint if exists %I', t, t || '_catalogue_number_key'
    );
    execute format(
      'alter table %I add constraint %I unique (catalogue_number)',
      t, t || '_catalogue_number_key'
    );
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- מניעת עריכה — גם בעדכון וגם בהוספה
-- ----------------------------------------------------------------------------
-- השדה אינו בטופס, אבל RLS לבדה אינה מונעת שליחתו בקריאה ישירה ל-API.
-- ב-UPDATE הטריגר מחזיר את הערך הישן במקום לזרוק שגיאה: עדכון של שדות
-- אחרים באותה שורה אינו אמור להיכשל רק משום שהמספר נשלח יחד איתם.
--
-- ב-INSERT זו לא מספיקה. עמודת default עם nextval() חלה רק כשהעמודה
-- מושמטת מה-INSERT; לקוח ששולח כאן ערך מפורש (למשל 1) היה מקבל אותו
-- כפי שהוא, ומתנגש בעתיד עם הרצף האמיתי. לכן ב-INSERT הטריגר תמיד קורא
-- nextval() בעצמו ומתעלם ממה שהתקבל — בדיוק כמו שאי אפשר לבחור id.
create or replace function keep_catalogue_number()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' then
    new.catalogue_number := old.catalogue_number;
  else
    new.catalogue_number := nextval(tg_argv[0]);
  end if;
  return new;
end $$;

drop trigger if exists trg_books_catalogue_number on books;
create trigger trg_books_catalogue_number
  before insert or update on books
  for each row execute function keep_catalogue_number('books_catalogue_number_seq');

drop trigger if exists trg_authors_catalogue_number on authors;
create trigger trg_authors_catalogue_number
  before insert or update on authors
  for each row execute function keep_catalogue_number('authors_catalogue_number_seq');
