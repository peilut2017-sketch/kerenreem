'use server';

import { revalidatePath } from 'next/cache';
import { escapeHtml, sendPlainEmail } from '@/lib/commerce/notifications';
import { sanitizeHtml } from '@/lib/sanitize';
import { createClient } from '@/lib/supabase/server';
import { writeAuditLog } from './audit';
import { assertRole, assertScreenPermission } from './auth';
import type { ActionResult } from './actions';
import type { InquiryStatus } from './queries';

/**
 * [1.11] פעולות מערכת הפניות המחודשת — טבלה בפני עצמה, לא ישות גנרית
 * דרך schema.ts: אין לה טופס עריכה, רק צפייה, סטטוס, מענה ומחיקה.
 *
 * חמישה סטטוסים במקום הדגל is_handled: חדשה / נקראה / בטיפול / לטיפול /
 * נפתרה. מענה נשלח בדואר (sendPlainEmail — אותה תשתית של הודעות ההזמנות,
 * עטיפת RTL כלולה) ונשמר בטבלת contact_replies לשרשור מלא.
 */

const VALID_STATUSES: InquiryStatus[] = ['new', 'read', 'in_progress', 'todo', 'resolved'];

const STATUS_LABELS: Record<InquiryStatus, string> = {
  new: 'חדשה',
  read: 'נקראה',
  in_progress: 'בטיפול',
  todo: 'לטיפול',
  resolved: 'נפתרה',
};

/** שינוי סטטוס פנייה. is_handled מתעדכן יחד, לתאימות עם צרכנים ישנים. */
export async function setInquiryStatus(id: string, status: InquiryStatus): Promise<ActionResult> {
  const session = await assertScreenPermission('messages', 'edit');
  if ('error' in session) return session;
  if (!VALID_STATUSES.includes(status)) return { error: 'סטטוס לא מוכר' };

  const supabase = await createClient();
  if (!supabase) return { error: 'אין חיבור למסד' };

  const { error } = await supabase
    .from('contact_messages')
    .update({ status, is_handled: status === 'resolved' })
    .eq('id', id);
  if (error) {
    console.error('[admin:messages] עדכון סטטוס נכשל', error.code, error.message);
    return { error: `העדכון נכשל: ${error.message}` };
  }

  await writeAuditLog(supabase, session.userId, 'status', 'contact_messages', id, {
    newValues: { status },
    context: `סימון פנייה: ${STATUS_LABELS[status]}`,
  });
  revalidatePath('/admin/messages');
  revalidatePath('/admin');
  return {};
}

/**
 * פתיחת פנייה חדשה מסמנת אותה "נקראה" — בשקט, בלי audit נפרד לכל
 * פתיחה: זו התאמת תצוגה, לא החלטת טיפול.
 */
export async function markInquiryOpened(id: string): Promise<void> {
  const session = await assertScreenPermission('messages', 'edit');
  if ('error' in session) return;

  const supabase = await createClient();
  if (!supabase) return;

  await supabase.from('contact_messages').update({ status: 'read' }).eq('id', id).eq('status', 'new');
  revalidatePath('/admin/messages');
  revalidatePath('/admin');
}

/**
 * מענה לפנייה: נשלח בדואר לכתובת הפונה, נשמר בשרשור (contact_replies)
 * ומעביר פנייה חדשה/נקראה/לטיפול ל"בטיפול". ה-HTML מנוקה כאן — גם
 * למייל וגם לשמירה — באותו sanitize של שאר האתר.
 */
export async function replyToInquiry(id: string, bodyHtml: string): Promise<ActionResult> {
  const session = await assertScreenPermission('messages', 'edit');
  if ('error' in session) return session;

  const clean = sanitizeHtml(bodyHtml);
  if (!clean.replace(/<[^>]+>/g, '').trim()) return { error: 'תוכן המענה ריק' };
  if (clean.length > 20000) return { error: 'המענה ארוך מדי' };

  const supabase = await createClient();
  if (!supabase) return { error: 'אין חיבור למסד' };

  const { data: inquiry } = await supabase
    .from('contact_messages')
    .select('id, name, email, subject, status')
    .eq('id', id)
    .maybeSingle();
  if (!inquiry) return { error: 'הפנייה לא נמצאה' };

  const subject = inquiry.subject
    ? `מענה לפנייתך: ${inquiry.subject}`.slice(0, 160)
    : 'מענה לפנייתך למכון קרן רא״ם';

  // שם הפונה הוא קלט חופשי מטופס ציבורי — escape לפני הרכבת ה-HTML
  const emailHtml = `
    <p>שלום ${escapeHtml(inquiry.name ?? '')},</p>
    ${clean}
    <hr style="border:none;border-top:1px solid #ddd;margin:1.5em 0" />
    <p style="color:#666;font-size:0.9em">מענה זה נשלח מצוות מכון קרן רא״ם בהמשך לפנייתך באתר.</p>
  `;

  const sent = await sendPlainEmail(inquiry.email, subject, emailHtml);
  if (!sent.ok && !sent.skipped) {
    return { error: 'שליחת הדואר נכשלה. המענה לא נשמר — נסו שוב.' };
  }

  const { error: insertError } = await supabase.from('contact_replies').insert({
    message_id: id,
    user_id: session.userId,
    body_html: clean,
    sent_to: inquiry.email,
    delivery_status: sent.ok ? 'sent' : 'skipped',
  });
  if (insertError) {
    console.error('[admin:messages] שמירת מענה נכשלה', insertError.code, insertError.message);
    return {
      error: sent.ok
        ? 'הדואר נשלח, אך שמירת המענה בשרשור נכשלה.'
        : `שמירת המענה נכשלה: ${insertError.message}`,
    };
  }

  // פנייה שקיבלה מענה נמצאת בטיפול — אלא אם כבר סומנה כנפתרה
  if (inquiry.status !== 'resolved') {
    await supabase
      .from('contact_messages')
      .update({ status: 'in_progress' })
      .eq('id', id)
      .neq('status', 'resolved');
  }

  await writeAuditLog(supabase, session.userId, 'reply', 'contact_messages', id, {
    newValues: { sent_to: inquiry.email, delivery_status: sent.ok ? 'sent' : 'skipped' },
    context: `מענה לפנייה של ${inquiry.name}${sent.skipped ? ' (דואר לא מוגדר — נשמר בלבד)' : ''}`,
  });
  revalidatePath('/admin/messages');
  revalidatePath('/admin');

  return sent.skipped
    ? { error: 'שירות הדואר אינו מוגדר (RESEND_API_KEY) — המענה נשמר בשרשור אך לא נשלח.' }
    : {};
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

  const { data: doomed } = await supabase
    .from('contact_messages')
    .select('name, email, subject, kind')
    .eq('id', id)
    .maybeSingle();

  const { error } = await supabase.from('contact_messages').delete().eq('id', id);
  if (error) {
    console.error('[admin:messages] מחיקה נכשלה', error.code, error.message);
    return { error: `המחיקה נכשלה: ${error.message}` };
  }

  await writeAuditLog(supabase, session.userId, 'delete', 'contact_messages', id, {
    oldValues: (doomed as Record<string, unknown> | null) ?? null,
    context: doomed ? `מחיקת פנייה של ${doomed.name}` : 'מחיקת פנייה',
  });
  revalidatePath('/admin/messages');
  revalidatePath('/admin');
  return {};
}
