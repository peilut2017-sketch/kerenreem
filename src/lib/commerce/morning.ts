import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { DocumentType } from '@/lib/supabase/types';

/**
 * מתאם מורנינג (חשבונית ירוקה) — הנקודה היחידה שמדברת עם ה-API שלהם.
 *
 * ⚠️ הנחות Sandbox (A1–A11 במסמך האב): מבנה הבקשות, קודי סוגי המסמכים,
 * מנגנון חתימת ה-Webhook ופרמטר קביעת אמצעי התשלום — כולם מסומנים
 * כהנחות עד השלמת אימותי 9.3. כל סטייה שתתגלה מתוקנת כאן בלבד; שאר
 * המערכת צורכת את הממשק המופשט הזה.
 *
 * סביבת ההרצה נקבעת ב-env — הפרדה מלאה בין Sandbox לייצור:
 *   MORNING_API_BASE      (ברירת מחדל: sandbox)
 *   MORNING_API_KEY_ID    מזהה מפתח API
 *   MORNING_API_SECRET    הסוד
 *   MORNING_WEBHOOK_SECRET סוד חתימת ההתראות
 */

const SANDBOX_BASE = 'https://sandbox.d.greeninvoice.co.il/api/v1';

function apiBase(): string {
  return process.env.MORNING_API_BASE ?? SANDBOX_BASE;
}

export function isMorningConfigured(): boolean {
  return Boolean(process.env.MORNING_API_KEY_ID && process.env.MORNING_API_SECRET);
}

/** קודי סוג מסמך ב-API של מורנינג — לאישוש ב-Sandbox (הנחה A6). */
const DOC_TYPE_CODES: Record<DocumentType, number> = {
  invoice_receipt: 320,
  receipt: 400,
  donation_receipt: 405,
  credit_note: 330,
};

/* ------------------------------ token cache ------------------------------- */

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string | null> {
  if (!isMorningConfigured()) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const response = await fetch(`${apiBase()}/account/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: process.env.MORNING_API_KEY_ID,
      secret: process.env.MORNING_API_SECRET,
    }),
    cache: 'no-store',
  });
  if (!response.ok) {
    console.error('[morning] token request failed', response.status);
    return null;
  }
  const data = (await response.json()) as { token?: string; expires?: number };
  if (!data.token) return null;
  cachedToken = {
    token: data.token,
    expiresAt: data.expires ? data.expires * 1000 : Date.now() + 10 * 60_000,
  };
  return data.token;
}

async function morningPost<T>(path: string, body: unknown): Promise<
  { ok: true; data: T } | { ok: false; status: number; error: string }
> {
  const token = await getToken();
  if (!token) return { ok: false, status: 0, error: 'morning not configured' };

  const response = await fetch(`${apiBase()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  const data = (await response.json().catch(() => ({}))) as T & {
    errorCode?: number;
    errorMessage?: string;
  };
  if (!response.ok || (typeof data.errorCode === 'number' && data.errorCode !== 0)) {
    return {
      ok: false,
      status: response.status,
      error: data.errorMessage ?? `morning error ${response.status}`,
    };
  }
  return { ok: true, data };
}

/* ----------------------------- payment form ------------------------------- */

export interface PaymentFormLine {
  description: string;
  quantity: number;
  price: number;
}

export interface CreatePaymentFormInput {
  amount: number;
  currency: string;
  description: string;
  lines: PaymentFormLine[];
  client: { name: string; email: string; phone: string };
  documentType: DocumentType;
  vatIncluded: boolean;
  maxInstallments: number;
  /** קביעת אמצעי מראש למסלול האקספרס — הנחה A2; נשלח רק כשמוגדר */
  preferredMethod?: 'bit' | 'apple_pay' | 'google_pay' | null;
  successUrl: string;
  failureUrl: string;
  notifyUrl: string;
  /** מזהה ההזמנה אצלנו — חוזר ב-Webhook לשיוך ודאי */
  externalReference: string;
  lang: 'he' | 'en';
}

export interface PaymentFormResult {
  url: string;
  transactionId: string | null;
  raw: Record<string, unknown>;
}

export async function createPaymentForm(
  input: CreatePaymentFormInput,
): Promise<{ ok: true; data: PaymentFormResult } | { ok: false; error: string }> {
  const payload: Record<string, unknown> = {
    description: input.description,
    type: DOC_TYPE_CODES[input.documentType],
    lang: input.lang,
    currency: input.currency,
    vatType: input.vatIncluded ? 0 : 1,
    amount: input.amount,
    maxPayments: input.maxInstallments,
    client: {
      name: input.client.name,
      emails: [input.client.email],
      phone: input.client.phone,
      add: true,
    },
    income: input.lines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      price: line.price,
      currency: input.currency,
      vatType: input.vatIncluded ? 0 : 1,
    })),
    successUrl: input.successUrl,
    failureUrl: input.failureUrl,
    notifyUrl: input.notifyUrl,
    custom: input.externalReference,
  };
  if (input.preferredMethod) {
    // הנחה A2: שם הפרמטר ייקבע סופית מול ה-Sandbox
    payload.preferredPaymentMethod = input.preferredMethod;
  }

  const result = await morningPost<{ url?: string; paymentFormId?: string; transactionId?: string }>(
    '/payments/form',
    payload,
  );
  if (!result.ok) return { ok: false, error: result.error };
  if (!result.data.url) return { ok: false, error: 'morning returned no payment url' };
  return {
    ok: true,
    data: {
      url: result.data.url,
      transactionId: result.data.transactionId ?? result.data.paymentFormId ?? null,
      raw: result.data as Record<string, unknown>,
    },
  };
}

/* ------------------------- status polling (גיבוי) ------------------------- */

export interface TransactionStatus {
  status: 'paid' | 'failed' | 'pending' | 'unknown';
  method: 'credit' | 'bit' | 'apple_pay' | 'google_pay' | null;
  documentId: string | null;
  documentNumber: string | null;
  amount: number | null;
  raw: Record<string, unknown>;
}

export async function getTransactionStatus(
  externalReference: string,
): Promise<{ ok: true; data: TransactionStatus } | { ok: false; error: string }> {
  // הנחה A8: נתיב ומבנה בדיקת הסטטוס היזומה ייקבעו סופית מול ה-Sandbox
  const result = await morningPost<Record<string, unknown>>('/transactions/search', {
    custom: externalReference,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: normalizeStatusPayload(result.data) };
}

export function normalizeStatusPayload(raw: Record<string, unknown>): TransactionStatus {
  const statusRaw = String(raw.status ?? raw.transactionStatus ?? '').toLowerCase();
  const methodRaw = String(raw.paymentMethod ?? raw.method ?? '').toLowerCase();
  return {
    status:
      statusRaw === 'paid' || statusRaw === 'success' || statusRaw === 'approved'
        ? 'paid'
        : statusRaw === 'failed' || statusRaw === 'declined' || statusRaw === 'error'
          ? 'failed'
          : statusRaw === 'pending' || statusRaw === 'open'
            ? 'pending'
            : 'unknown',
    method: (['credit', 'bit', 'apple_pay', 'google_pay'] as const).find((m) => methodRaw.includes(m)) ?? null,
    documentId: (raw.documentId as string) ?? null,
    documentNumber: (raw.documentNumber as string) ?? null,
    amount: typeof raw.amount === 'number' ? raw.amount : null,
    raw,
  };
}

/* --------------------------------- refund --------------------------------- */

export async function refundTransaction(input: {
  transactionId: string;
  amount: number;
  reason?: string;
}): Promise<{ ok: true; data: { refundId: string | null; documentId: string | null } } | { ok: false; error: string }> {
  // הנחות A5: נתיב הזיכוי, תמיכה בזיכוי חלקי ובעסקאות ביט — לאישוש ב-Sandbox
  const result = await morningPost<{ refundId?: string; documentId?: string }>(
    `/transactions/${encodeURIComponent(input.transactionId)}/refund`,
    { amount: input.amount, reason: input.reason ?? '' },
  );
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    data: { refundId: result.data.refundId ?? null, documentId: result.data.documentId ?? null },
  };
}

/* ----------------------------- webhook verify ----------------------------- */

/**
 * אימות מקור ההתראה: HMAC-SHA256 על הגוף הגולמי עם הסוד המשותף.
 * הנחה A8: שם הכותרת והסכימה המדויקת ייקבעו מול התיעוד ב-Sandbox; עד אז
 * נבדקות שתי הכותרות המקובלות, בהשוואת זמן קבוע.
 */
export function verifyWebhookSignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env.MORNING_WEBHOOK_SECRET;
  if (!secret) return false;

  const provided =
    headers.get('x-morning-signature') ?? headers.get('x-greeninvoice-signature') ?? '';
  if (!provided) return false;

  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided.trim().toLowerCase(), 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
