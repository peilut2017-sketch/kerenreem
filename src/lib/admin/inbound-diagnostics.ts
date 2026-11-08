'use server';

import { assertRole } from './auth';
import { createServiceClient } from '@/lib/supabase/service';
import { INBOUND_PING_ID, inboundSecret, inquiryReplyAddress } from '@/lib/email/inquiry-thread';
import { replyToForInquiry, sendEmail } from '@/lib/email/send';

/**
 * ‏[1.45] אבחון קליטת הדואר הנכנס — מסך "דואר יוצא" ← "קליטת תשובות".
 *
 * שאלת התפעול היא "תשובה נשלחה ולא הגיעה לשום מקום — איפה היא נעצרה?".
 * השרשרת ארוכה (ספק שליחה ← MX ← Cloudflare Routing ← Worker ← האתר ←
 * מסד), ומבחוץ כל החוליות נראות אותו דבר. כאן שלושה כלים:
 *   1. רשימת בדיקות הגדרה שאפשר לאמת מהאתר עצמו;
 *   2. יומן כל ניסיון קליטה, עם התוצאה והסיבה — "אין שורה" אומר שהמייל
 *      לא הגיע לאתר בכלל;
 *   3. בדיקת מקצה לקצה: האתר שולח מייל לכתובת קליטה ייעודית ומחכה שיופיע
 *      ביומן. הצלחה = כל השרשרת עובדת.
 * מנהל בלבד, כמו שאר מסך הדואר.
 */

export interface DiagnosticCheck {
  key: string;
  label: string;
  ok: boolean;
  detail: string;
}

export interface InboundLogRow {
  id: string;
  received_at: string;
  recipient: string | null;
  sender: string | null;
  outcome: string;
  reason: string | null;
}

export interface InboundDiagnostics {
  checks: DiagnosticCheck[];
  log: InboundLogRow[];
  workerUrl: string | null;
  pingAddress: string | null;
}

/** האם טבלה/עמודה קיימת — לפי קוד השגיאה של PostgREST (42P01 / 42703 / PGRST20x). */
async function probe(
  service: NonNullable<ReturnType<typeof createServiceClient>>,
  table: string,
  column: string,
): Promise<boolean> {
  const { error } = await service.from(table).select(column).limit(1);
  return !error;
}

export async function getInboundDiagnostics(): Promise<InboundDiagnostics> {
  const empty: InboundDiagnostics = { checks: [], log: [], workerUrl: null, pingAddress: null };
  const session = await assertRole('admin');
  if ('error' in session) return empty;

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/+$/, '');
  const service = createServiceClient();
  const secret = inboundSecret();
  const sample = replyToForInquiry('11111111-1111-4111-8111-111111111111');

  const checks: DiagnosticCheck[] = [
    {
      key: 'secret',
      label: 'INBOUND_EMAIL_SECRET מוגדר',
      ok: Boolean(secret),
      detail: secret
        ? 'הסוד קיים. הוא חייב להיות זהה, תו בתו, ל-INBOUND_SECRET ב-Worker.'
        : 'חסר. בלעדיו אין כתובת מענה חתומה והקליטה כבויה (תשובות חוזרות ל-contact@ רגיל).',
    },
    {
      key: 'reply-to',
      label: 'כתובת המענה שהפונה מקבל חתומה',
      ok: /\+i[0-9a-f]{32}\./.test(sample),
      detail: /\+i[0-9a-f]{32}\./.test(sample)
        ? `דוגמה: ${sample}`
        : 'הפונה מקבל contact@ נטו, ולכן תשובתו לא תיקלט לשרשור. (מופיע כשחסר הסוד, או שהגרסה החדשה עדיין לא פרוסה.)',
    },
    {
      key: 'site-url',
      label: 'NEXT_PUBLIC_SITE_URL מוגדר',
      ok: Boolean(siteUrl),
      detail: siteUrl
        ? `INBOUND_URL ב-Worker צריך להיות ${siteUrl}/api/email/inbound`
        : 'חסר: הקישור בהתראות ופיקסל המעקב לא ייווצרו.',
    },
    {
      key: 'service-role',
      label: 'SUPABASE_SERVICE_ROLE_KEY מוגדר',
      ok: Boolean(service),
      detail: service ? 'קיים.' : 'חסר: נקודת הקליטה לא יכולה לכתוב למסד.',
    },
    {
      key: 'resend',
      label: 'RESEND_API_KEY מוגדר',
      ok: Boolean(process.env.RESEND_API_KEY),
      detail: process.env.RESEND_API_KEY ? 'קיים.' : 'חסר: שום מייל לא יוצא, כולל מענה לפונה.',
    },
  ];

  if (service) {
    const migrations: [string, string, string, string][] = [
      ['m59', 'contact_replies', 'source', 'מיגרציה 59 (מענה במייל)'],
      ['m60', 'email_log', 'id', 'מיגרציה 60 (מעקב צפייה ותשובות פונים)'],
      ['m60b', 'contact_replies', 'direction', 'מיגרציה 60 (עמודת direction)'],
      ['m61', 'inbound_email_log', 'id', 'מיגרציה 61 (יומן קליטה)'],
    ];
    for (const [key, table, column, label] of migrations) {
      const ok = await probe(service, table, column);
      checks.push({
        key,
        label: `${label} הורצה`,
        ok,
        detail: ok ? 'קיימת במסד.' : `לא נמצאו ${table}.${column} — להריץ את קובץ ה-SQL ב-Supabase.`,
      });
    }
  }

  let log: InboundLogRow[] = [];
  if (service) {
    const { data } = await service
      .from('inbound_email_log')
      .select('id, received_at, recipient, sender, outcome, reason')
      .order('received_at', { ascending: false })
      .limit(25);
    log = (data as InboundLogRow[] | null) ?? [];
  }

  return {
    checks,
    log,
    workerUrl: siteUrl ? `${siteUrl}/api/email/inbound` : null,
    pingAddress: inquiryReplyAddress(INBOUND_PING_ID),
  };
}

/** שולח מייל בדיקה אל כתובת הקליטה הייעודית. מחזיר את רגע השליחה — לבדיקת ההגעה. */
export async function sendInboundPing(): Promise<{ ok: boolean; sentAt?: string; error?: string }> {
  const session = await assertRole('admin');
  if ('error' in session) return { ok: false, error: session.error };

  const address = inquiryReplyAddress(INBOUND_PING_ID);
  if (!address) return { ok: false, error: 'INBOUND_EMAIL_SECRET אינו מוגדר — אין כתובת קליטה לבדוק.' };

  const sentAt = new Date().toISOString();
  const result = await sendEmail(
    address,
    {
      subject: 'בדיקת קליטת דואר — אפשר להתעלם',
      html: '<p>הודעת בדיקה אוטומטית ממסך הדואר היוצא. אין צורך לעשות דבר.</p>',
      text: 'הודעת בדיקה אוטומטית ממסך הדואר היוצא. אין צורך לעשות דבר.',
    },
    { track: false, label: 'inbound_ping', replyTo: null },
  );
  if (result.skipped) return { ok: false, error: 'RESEND_API_KEY אינו מוגדר — לא ניתן לשלוח.' };
  if (!result.ok) return { ok: false, error: `השליחה נכשלה אצל ספק הדואר: ${result.error ?? 'לא ידוע'}` };
  return { ok: true, sentAt };
}

/** האם בדיקת המקצה-לקצה הגיעה? ואם לא — מה נרשם ביומן מאז, כדי לכוון את האבחון. */
export async function checkInboundPing(
  sinceIso: string,
): Promise<{ arrived: boolean; since: { outcome: string; reason: string | null }[] }> {
  const session = await assertRole('admin');
  const service = createServiceClient();
  if ('error' in session || !service) return { arrived: false, since: [] };

  const { data } = await service
    .from('inbound_email_log')
    .select('outcome, reason')
    .gte('received_at', sinceIso)
    .order('received_at', { ascending: false })
    .limit(10);
  const rows = (data as { outcome: string; reason: string | null }[] | null) ?? [];
  return { arrived: rows.some((row) => row.outcome === 'ping'), since: rows };
}
