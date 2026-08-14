-- ============================================================================
-- מכון קרן רא"ם — הקשחת אחסון (סבב אבטחה)
-- ----------------------------------------------------------------------------
-- ה-buckets הציבוריים (covers/events/portraits/samples/site) נוצרו ללא
-- הגבלת גודל וללא רשימת סוגי-קובץ מותרים. איש צוות (כולל תפקיד editor
-- שגישתו אמורה להצטמצם לתוכן) יכול היה להעלות payload.html או SVG עם
-- סקריפט, שיוגש מדומיין ה-Storage עם text/html — עמוד תחת שליטת תוקף על
-- דומיין הפרויקט, שימושי לפישינג "מבית". וללא תקרת גודל, חשבון אחד יכול
-- למלא את האחסון. bucket ה-contact-attachments כבר מוקשח כך (מיגרציה 20);
-- כאן מיישמים את אותו עיקרון על השאר.
--
-- allowed_mime_types נאכף בצד Supabase Storage בזמן ההעלאה. הרשימות
-- מכוונות לשימוש בפועל: תמונות לכל ה-buckets, ו-PDF נוסף ל-samples
-- (דפי דוגמה). SVG *לא* נכלל — הוא נושא סקריפט; הלוגו מומר/מוגש כתמונה.
-- ============================================================================

update storage.buckets
set
  file_size_limit = 10 * 1024 * 1024, -- 10MB לתמונה
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif']
where id in ('covers', 'events', 'portraits', 'site');

update storage.buckets
set
  file_size_limit = 40 * 1024 * 1024, -- 40MB ל-PDF דוגמה
  allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
where id = 'samples';
