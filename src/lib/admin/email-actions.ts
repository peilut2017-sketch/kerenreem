'use server';

import { assertRole } from './auth';
import { writeAuditLog } from './audit';
import { createClient } from '@/lib/supabase/server';
import { sendEmail, staffInbox } from '@/lib/email/send';
import { getEmailBrand } from '@/lib/email/brand';
import {
  contactAckEmail,
  contactReplyEmail,
  contactStaffEmail,
  passwordChangedEmail,
  passwordResetEmail,
  teamInviteEmail,
} from '@/lib/email/templates';
import type { SiteEmailTemplate } from '@/lib/email/template-list';
import type { RenderedEmail } from '@/lib/email/brand';

/**
 * [1.40] בדיקת מערכת הדואר מתוך הניהול.
 *
 * למה זה נחוץ: דואר יוצא הוא החלק היחיד במערכת שאי אפשר לבדוק
 * בעין מהאתר — הוא מתגלה רק כשלקוח אמיתי לא מקבל הודעה, ואז כבר
 * מאוחר. המסך הזה מאפשר לראות כל תבנית כפי שהיא תגיע, ולשלוח אותה
 * לכתובת אמיתית כדי לוודא שהספק, ה-SPF/DKIM והכתובת השולחת עובדים.
 *
 * כל התבניות נבדקות עם *נתוני דוגמה* ולא עם רשומות אמיתיות: הבדיקה
 * לא אמורה לגעת בשום פנייה או חשבון קיימים, ובטח לא לשלוח משהו
 * ללקוח.
 */

export interface EmailActionResult {
  ok: boolean;
  error?: string;
  /** תצוגה מקדימה — ה-HTML המלא כפי שיישלח. */
  html?: string;
  subject?: string;
}

const SAMPLE_CONTACT = {
  name: 'ישראל ישראלי',
  email: 'demo@example.com',
  phone: '050-0000000',
  subject: 'שאלה על מהדורה',
  topic: 'הזמנות ומשלוחים',
  message:
    'שלום רב,\nראיתי שיצאה מהדורה חדשה ורציתי לשאול אם היא כוללת את ההוספות שבמהדורה הקודמת.\nתודה רבה!',
  attachmentCount: 2,
};

/** בונה תבנית עם נתוני דוגמה. משותף לתצוגה המקדימה ולשליחת הבדיקה. */
async function renderSample(template: SiteEmailTemplate): Promise<RenderedEmail> {
  const brand = await getEmailBrand();
  const site = brand.siteUrl || 'https://www.kerenreem.org';

  switch (template) {
    case 'password_reset':
      return passwordResetEmail({
        resetUrl: `${site}/api/auth/admin-callback?code=sample`,
        name: 'ישראל ישראלי',
        isStaff: true,
      });
    case 'password_changed':
      return passwordChangedEmail({
        name: 'ישראל ישראלי',
        whenLabel: new Intl.DateTimeFormat('he-IL', {
          dateStyle: 'long',
          timeStyle: 'short',
          timeZone: 'Asia/Jerusalem',
        }).format(new Date()),
        isStaff: true,
      });
    case 'contact_ack':
      return contactAckEmail(SAMPLE_CONTACT);
    case 'contact_staff':
      return contactStaffEmail(SAMPLE_CONTACT, `${site}/admin/messages`);
    case 'contact_reply':
      return contactReplyEmail({
        name: SAMPLE_CONTACT.name,
        subject: 'מענה לפנייתך',
        bodyHtml:
          '<p>תודה על הפנייה. המהדורה החדשה אכן כוללת את כל ההוספות, ובנוסף מפתח מקורות מורחב.</p>',
        bodyText:
          'תודה על הפנייה. המהדורה החדשה אכן כוללת את כל ההוספות, ובנוסף מפתח מקורות מורחב.',
      });
    case 'team_invite':
      return teamInviteEmail({
        name: 'ישראל ישראלי',
        email: 'staff@example.com',
        password: 'Aa3!demo-only',
        roleLabel: 'עורך תוכן',
        loginUrl: `${site}/admin/login`,
      });
  }
}

/** תצוגה מקדימה — לא שולחת דבר. */
export async function previewSiteEmail(template: SiteEmailTemplate): Promise<EmailActionResult> {
  // מנהל בלבד: התצוגה חושפת את פרטי הקשר והלוגו שבהגדרות, ואת מבנה
  // הודעות האבטחה של המערכת.
  const session = await assertRole('admin');
  if ('error' in session) return { ok: false, error: session.error };

  try {
    const email = await renderSample(template);
    return { ok: true, html: email.html, subject: email.subject };
  } catch (error) {
    console.error('[admin:email] preview', error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** שליחת בדיקה לכתובת שהוזנה. */
export async function sendTestSiteEmail(
  template: SiteEmailTemplate,
  to: string,
): Promise<EmailActionResult> {
  const session = await assertRole('admin');
  if ('error' in session) return { ok: false, error: session.error };

  const address = to.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address)) {
    return { ok: false, error: 'כתובת מייל לא תקינה' };
  }

  try {
    const email = await renderSample(template);
    // הנושא מסומן במפורש: הודעת בדיקה שנוחתת בתיבה של מישהו ונראית
    // אמיתית (למשל "הסיסמה שלך הוחלפה") היא בדיוק מה שלא צריך לקרות.
    const result = await sendEmail(address, {
      ...email,
      subject: `[בדיקה] ${email.subject}`,
    });

    if (result.skipped) {
      return {
        ok: false,
        error:
          'שירות הדואר אינו מוגדר: חסר RESEND_API_KEY בהגדרות הסביבה. התצוגה המקדימה עובדת, אבל שום הודעה לא תישלח בפועל.',
      };
    }
    if (!result.ok) return { ok: false, error: result.error ?? 'השליחה נכשלה' };

    const supabase = await createClient();
    await writeAuditLog(supabase, session.userId, 'email_test', 'site_settings', null, {
      context: `שליחת מייל בדיקה (${template}) אל ${address}`,
    });

    return { ok: true, subject: email.subject };
  } catch (error) {
    console.error('[admin:email] test send', error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/** מצב ההגדרה — למסך, כדי שלא יצטרכו לנחש למה כלום לא נשלח. */
export async function getEmailConfigStatus(): Promise<{
  providerConfigured: boolean;
  fromAddress: string;
  staffInbox: string | null;
  siteUrl: string;
}> {
  const session = await assertRole('admin');
  if ('error' in session) {
    return { providerConfigured: false, fromAddress: '', staffInbox: null, siteUrl: '' };
  }
  const brand = await getEmailBrand();
  return {
    providerConfigured: Boolean(process.env.RESEND_API_KEY),
    fromAddress: process.env.COMMERCE_EMAIL_FROM ?? 'מכון קרן רא״ם <no-reply@keren-reem.org>',
    staffInbox: staffInbox(brand.contactEmail),
    siteUrl: brand.siteUrl,
  };
}
