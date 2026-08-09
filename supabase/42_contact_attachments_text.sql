-- ============================================================================
-- מכון קרן רא"ם — הוספת text/plain לסוגי הקבצים המותרים בצירוף לפנייה
-- להרצה אחרי 41_screen_permissions.sql
-- ============================================================================
-- דווח כשל בפועל: מבקר שניסה לצרף קובץ .txt לטופס יצירת הקשר קיבל
-- "415: mime type text/plain is not supported" מ-Storage. הרשימה
-- שנקבעה ב-20_contact_attachments.sql לא כללה טקסט פשוט מלכתחילה.
-- upsert על אותה שורת bucket (לא CREATE חדש) — עקבי עם התבנית שכבר
-- נקבעה שם ל"עדכון רשימת סוגים".
-- ============================================================================

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
]
where id = 'contact-attachments';

-- ============================================================================
-- לאימות אחרי הרצה:
--   select allowed_mime_types from storage.buckets where id = 'contact-attachments';
--
-- Rollback:
--   update storage.buckets set allowed_mime_types = array[
--     'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
--     'application/msword',
--     'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
--   ] where id = 'contact-attachments';
-- ============================================================================
