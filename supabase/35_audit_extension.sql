-- ============================================================================
-- מכון קרן רא"ם — הרחבת audit_log: לפני/אחרי, סוג מבצע והקשר
-- להרצה אחרי 34_notifications.sql
-- ============================================================================
-- הרישום הקיים ({user_id, action, table_name, record_id}) אינו מבחין בין
-- שינוי מחיר לשינוי כותרת. העמודות החדשות nullable — תשע נקודות הכתיבה
-- הקיימות ממשיכות לעבוד כמות שהן; writeAudit המורחב מוסיף diff לפעולות
-- רגישות (מחיר, מלאי, זיכוי, הרשאות, הגדרות חנות, ייצוא).
-- ============================================================================

alter table audit_log add column if not exists old_values jsonb;
alter table audit_log add column if not exists new_values jsonb;
alter table audit_log add column if not exists actor_type text not null default 'staff';
alter table audit_log add column if not exists context text;

alter table audit_log drop constraint if exists audit_log_actor_type_valid;
alter table audit_log add constraint audit_log_actor_type_valid
  check (actor_type in ('staff', 'system', 'customer'));

-- ============================================================================
-- Rollback:
--   alter table audit_log
--     drop constraint if exists audit_log_actor_type_valid,
--     drop column if exists context,
--     drop column if exists actor_type,
--     drop column if exists new_values,
--     drop column if exists old_values;
-- ============================================================================
