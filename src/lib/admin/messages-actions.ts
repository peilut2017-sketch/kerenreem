'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { assertRole, assertScreenPermission } from './auth';
import type { ActionResult } from './actions';

/**
 * פעולות על פניות מהאתר (contact_messages) — טבלה בפני עצמה, לא ישות
 * גנרית דרך schema.ts: אין לה טופס עריכה, רק צפייה, סימון סטטוס ומחיקה.
 */

/** סימון פנייה כטופלה/לא טופלה. */
export async function setMessageHandled(id: string, handled: boolean): Promise<ActionResult> {
  const session = await assertScreenPermission('messages', 'edit');
  if ('error' in session) return session;

  const supabase = await createClient();
  if (!supabase) return { error: 'אין חיבור למסד' };

  const { error } = await supabase.from('contact_messages').update({ is_handled: handled }).eq('id', id);
  if (error) {
    console.error('[admin:messages] סימון סטטוס נכשל', error.code, error.message);
    return { error: `העדכון נכשל: ${error.message}` };
  }

  revalidatePath('/admin/messages');
  return {};
}

/**
 * מחיקת פנייה — מנהל בלבד (contact_messages_admin_delete ב-RLS), כמו
 * הזכות למחיקה שנדרשת לפי חוק הגנת הפרטיות על מידע אישי. לא מוחקת את
 * הקבצים המצורפים מהאחסון: קובץ יתום אינו מסוכן, בדיוק כמו שאר האתר
 * (ראו הערה על כך ב-supabase/20_contact_attachments.sql).
 */
export async function deleteContactMessage(id: string): Promise<ActionResult> {
  const session = await assertRole('admin');
  if ('error' in session) return session;

  const supabase = await createClient();
  if (!supabase) return { error: 'אין חיבור למסד' };

  const { error } = await supabase.from('contact_messages').delete().eq('id', id);
  if (error) {
    console.error('[admin:messages] מחיקה נכשלה', error.code, error.message);
    return { error: `המחיקה נכשלה: ${error.message}` };
  }

  revalidatePath('/admin/messages');
  return {};
}
