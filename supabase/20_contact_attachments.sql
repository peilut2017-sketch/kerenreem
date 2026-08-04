-- ============================================================================
-- מכון קרן רא"ם — קבצים מצורפים לפניית יצירת קשר
-- להרצה אחרי 19_book_author_freetext.sql
-- ============================================================================
-- עמודת attachments (jsonb, כמו gallery באירועים — מערך {path, name, size,
-- type} בלי טבלה נפרדת) ו-bucket ייעודי לשמירת הקבצים עצמם.
--
-- ה-bucket הזה, בניגוד לכל שאר האחסון באתר (02_site_additions.sql), אינו
-- ציבורי: קובץ שמבקר אנונימי מצרף לפנייה עשוי להכיל מידע רגיש (מסמך עם
-- פרטים אישיים, למשל), ולכן רק צוות מחובר עם הרשאת עריכה יכול לקרוא אותו
-- — לא כל מי שמנחש או מקבל את הכתובת. הצוות ניגש דרך קישור חתום שנוצר
-- לפי דרישה (ראו src/app/(admin)/admin/(dashboard)/messages/page.tsx),
-- לא URL ציבורי קבוע.
--
-- הגבלת הגודל (30MB) וסוגי הקבצים המותרים נאכפות ברמת ה-bucket עצמו, לא
-- רק בצד הלקוח: אימות בדפדפן אפשר לעקוף בקריאה ישירה ל-API של Storage.
-- ============================================================================

alter table contact_messages add column if not exists attachments jsonb not null default '[]';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contact-attachments',
  'contact-attachments',
  false,
  31457280, -- 30MB, בבייטים
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- כל מבקר (גם אנונימי) יכול לצרף קובץ לפנייה שהוא שולח...
drop policy if exists storage_contact_insert on storage.objects;
create policy storage_contact_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'contact-attachments');

-- ...אבל רק הצוות קורא אותם, ולכן גם רק הצוות יכול ליצור להם קישור חתום.
drop policy if exists storage_contact_staff_read on storage.objects;
create policy storage_contact_staff_read on storage.objects
  for select to authenticated
  using (bucket_id = 'contact-attachments' and public.can_edit());

-- מחיקה למנהל בלבד — כמו מחיקת הפנייה עצמה, נדרש למימוש זכות המחיקה
-- של נושא המידע.
drop policy if exists storage_contact_admin_delete on storage.objects;
create policy storage_contact_admin_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'contact-attachments' and public.is_admin());
