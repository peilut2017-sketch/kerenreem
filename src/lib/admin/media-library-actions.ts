'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { writeAuditLog } from './audit';
import { assertScreenPermission } from './auth';
import type { ActionResult } from './actions';
import type { StorageBucket } from '@/components/admin/ImageField';

/**
 * [1.19] מחיקת קובץ מהאחסון — הרסני וחוצה-ישויות (לא שייך לישות אחת
 * כמו ספר/אירוע), ולכן פעולה ייעודית ולא deleteEntity הגנרי. שימו לב:
 * זו מחיקת הקובץ הפיזי בלבד — אם עמוד כלשהו עדיין מפנה לכתובת הזו,
 * התמונה תיעלם ממנו. באחריות מי שמוחק לוודא שהקובץ אינו בשימוש.
 */
export async function deleteStorageFile(bucket: StorageBucket, path: string): Promise<ActionResult> {
  const session = await assertScreenPermission('media-library', 'edit');
  if ('error' in session) return session;

  const supabase = await createClient();
  if (!supabase) return { error: 'אין חיבור למסד' };

  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) return { error: `המחיקה נכשלה: ${error.message}` };

  await writeAuditLog(supabase, session.userId, 'delete', 'storage', null, {
    context: `מחיקת קובץ מספריית המדיה: ${bucket}/${path}`,
  });
  revalidatePath('/admin/media-library');
  return {};
}
