import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import type { ContactAttachment } from '@/lib/supabase/types';
import type { MailAttachment } from './send';

/**
 * ‏[1.46] קבצים מצורפים בדואר הפניות — שני כיוונים:
 *   • מהאחסון אל הודעה יוצאת (קבצי הפנייה → התראה לצוות; קבצי מענה → פונה);
 *   • ממייל נכנס אל האחסון (תשובת פונה/צוות → שרשור הפנייה).
 *
 * אותו bucket פרטי של הפניות (contact-attachments, 20_contact_attachments.sql).
 * ‏service_role עוקף את מדיניות ה-bucket אך **לא** את הגבלת סוגי הקבצים
 * שלו — ולכן סוג שאינו מותר שם (zip, exe…) אינו נשמר, גם מתשובה במייל.
 * כל הפונקציות כאן צרות לתפקידן ופועלות רק על ה-bucket הזה.
 */

export const CONTACT_BUCKET = 'contact-attachments';

/** תקרת גודל כוללת לקבצים בהודעה אחת (לפני base64) — מתחת ל-40MB של הספק. */
export const MAX_MAIL_ATTACHMENT_BYTES = 20 * 1024 * 1024;

const STORABLE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/** נתיב תקין באחסון: בלי יציאה מהתיקייה ובלי תווים מוזרים. */
export function isSafeStoragePath(path: string): boolean {
  return path.length > 0 && path.length <= 200 && !path.includes('..') && /^[\w./-]+$/.test(path);
}

function safeName(name: string): string {
  const cleaned = name.replace(/[^\w.\-֐-׿]+/g, '_').replace(/^\.+/, '').slice(-80);
  return cleaned || 'file';
}

/** קובץ בשרשור: path=null = נשלח אך לא נשמר באחסון. */
export type ThreadAttachment = Omit<ContactAttachment, 'path'> & { path: string | null };

export interface LoadedAttachments {
  files: MailAttachment[];
  /** כמה קבצים לא צורפו (גדולים מדי יחד, או שלא נמצאו) */
  skipped: number;
}

/**
 * מוריד מהאחסון קבצים לצירוף להודעה. הכול-או-כלום ביחס לתקרה: אם הסך
 * עולה עליה, שום קובץ לא מצורף (הודעה עם חצי מהקבצים מטעה יותר משום קובץ),
 * והקורא מציין בגוף ההודעה שהקבצים זמינים בניהול.
 */
export async function loadAttachments(items: ContactAttachment[]): Promise<LoadedAttachments> {
  const wanted = items.filter((item) => isSafeStoragePath(item.path));
  if (wanted.length === 0) return { files: [], skipped: items.length };

  const total = wanted.reduce((sum, item) => sum + item.size, 0);
  if (total > MAX_MAIL_ATTACHMENT_BYTES) return { files: [], skipped: items.length };

  const service = createServiceClient();
  if (!service) return { files: [], skipped: items.length };

  const files: MailAttachment[] = [];
  for (const item of wanted) {
    const { data, error } = await service.storage.from(CONTACT_BUCKET).download(item.path);
    if (error || !data) {
      console.error('[email:attachments] download', item.path, error?.message);
      continue;
    }
    files.push({ filename: item.name, content: new Uint8Array(await data.arrayBuffer()) });
  }
  return { files, skipped: items.length - files.length };
}

export interface InboundFile {
  filename: string | null;
  mimeType: string;
  content: ArrayBuffer | Uint8Array | string;
}

/**
 * שומר קבצים ממייל נכנס באחסון ומחזיר את התיאור לשרשור. קובץ מסוג שאינו
 * מותר (או שההעלאה נכשלה) מוחזר עם path=null — הוא עדיין מופיע בשרשור
 * בשמו, ועדיין מועבר הלאה בדואר, רק לא ניתן להורדה מהניהול.
 */
export async function storeInboundFiles(
  files: InboundFile[],
  folder: string,
): Promise<{ stored: ThreadAttachment[]; mail: MailAttachment[] }> {
  const service = createServiceClient();
  const stored: ThreadAttachment[] = [];
  const mail: MailAttachment[] = [];

  for (const file of files) {
    const bytes =
      typeof file.content === 'string'
        ? new TextEncoder().encode(file.content)
        : new Uint8Array(file.content);
    const name = file.filename?.trim() || 'attachment';
    mail.push({ filename: name, content: bytes });

    let path: string | null = null;
    if (service && STORABLE_TYPES.has(file.mimeType.toLowerCase())) {
      const candidate = `${folder}/${crypto.randomUUID()}-${safeName(name)}`;
      const { error } = await service.storage
        .from(CONTACT_BUCKET)
        .upload(candidate, bytes, { contentType: file.mimeType, upsert: false });
      if (error) console.error('[email:attachments] upload', error.message);
      else path = candidate;
    }
    stored.push({ path, name, size: bytes.byteLength, type: file.mimeType });
  }
  return { stored, mail };
}
