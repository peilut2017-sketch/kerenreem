import { createClient } from '@/lib/supabase/client';
import type { ContactAttachment } from '@/lib/supabase/types';

/**
 * העלאת קבצים מטופס יצירת הקשר — ישירות מהדפדפן ל-Supabase Storage,
 * כמו uploadToBucket בממשק הניהול (ImageField.tsx), אבל לא אותה פונקציה:
 * ה-bucket כאן פרטי (לא ציבורי) ולכן אין טעם ב-getPublicUrl — מה שנשמר
 * הוא ה-path, וצוות האתר מקבל אליו קישור חתום לפי דרישה (ראו
 * admin/(dashboard)/messages/page.tsx). כמו כן זהו bucket שמבקר אנונימי
 * כותב אליו, אז ולא מייבאים מ-components/admin (הפרדה בין הציבורי לניהול,
 * ראו מבנה הפרויקט ב-README).
 *
 * ההגבלות (גודל, סוג קובץ, מספר קבצים) נאכפות שוב ב-bucket עצמו
 * (20_contact_attachments.sql) — הבדיקה כאן היא רק למשוב מיידי בטופס.
 */

export const MAX_ATTACHMENT_BYTES = 30 * 1024 * 1024;
export const MAX_ATTACHMENTS = 5;

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const CONTACT_ATTACHMENTS_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function randomPath(originalName: string): string {
  const extension = originalName.includes('.') ? originalName.split('.').pop()!.toLowerCase() : 'bin';
  const stamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${stamp}-${random}.${extension.replace(/[^a-z0-9]/g, '')}`;
}

/** בודק גודל וסוג לפני העלאה — מחזיר הודעת שגיאה מתורגמת-מראש, או null אם תקין. */
export function validateAttachment(file: File, tooLarge: string, badType: string): string | null {
  if (file.size > MAX_ATTACHMENT_BYTES) return tooLarge;
  if (!ALLOWED_TYPES.has(file.type)) return badType;
  return null;
}

export async function uploadContactAttachment(file: File): Promise<ContactAttachment> {
  const supabase = createClient();
  if (!supabase) throw new Error('אין חיבור לאחסון');

  const path = randomPath(file.name);
  const { error } = await supabase.storage.from('contact-attachments').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) throw new Error(error.message);

  return { path, name: file.name, size: file.size, type: file.type };
}
