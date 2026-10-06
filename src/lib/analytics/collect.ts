import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { allowRequest, ipBucket } from '@/lib/commerce/rate-limit';
import { recordCommerceEvent } from '@/lib/commerce/events-actions';
import { clientIp, dailyVisitorHash, isUuid } from './shared';
import {
  classifyChannel,
  cleanLabel,
  cleanPath,
  countryFromHeaders,
  deviceFromUserAgent,
  isBotUserAgent,
  normalizeHost,
} from './classify';

/**
 * איסוף האנליטיקה העצמאית — נקרא רק מ-/api/analytics/collect.
 *
 * הכל best-effort: כשל בתיעוד לעולם לא מוחזר למבקר. כל שדה שמגיע מהדפדפן
 * מאומת וחתוך כאן, כי הנתיב ציבורי וכל אחד יכול לשלוח אליו כל payload.
 * לא נשמרים: כתובת IP, מזהה קבוע, כתובת מפנה מלאה, מחרוזות שאילתה, או
 * מספר טלפון/כתובת דוא"ל של הלחיצה (רק סוג הלחיצה).
 */

type Payload = Record<string, unknown>;

/** הפעולות המותרות כאירוע-ספר דרך נתיב האיסוף (שאר אירועי המסחר — Server Action). */
const BOOK_EVENTS = new Set(['product_saved']);
const OUTBOUND_KINDS = new Set(['external', 'tel', 'mailto', 'download']);

function str(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null;
}

function locale(value: unknown): 'he' | 'en' {
  return value === 'en' ? 'en' : 'he';
}

export async function handleCollect(payload: Payload, requestHeaders: Headers): Promise<void> {
  const type = payload.t;
  try {
    if (type === 'pe') return await recordEngagement(payload);
    // pe (עדכון משך) זול ומוגן במזהה צפייה+סשן; השאר כותבים שורות — מוגבלי קצב.
    if (type !== 'ev' && !(await allowRequest(ipBucket('analytics', requestHeaders), 600, 60))) return;
    if (type === 'pv') return await recordPageView(payload, requestHeaders);
    if (type === 'out') return await recordOutbound(payload, requestHeaders);
    if (type === 'ev') return await recordBookEvent(payload);
  } catch (error) {
    console.error('[analytics:collect] חריגה לא צפויה', type, error);
  }
}

async function recordPageView(payload: Payload, requestHeaders: Headers): Promise<void> {
  const path = cleanPath(payload.path);
  const sessionId = str(payload.sid, 64);
  const id = isUuid(payload.id) ? payload.id : null;
  if (!path || !sessionId || !id) return;

  const supabase = await createClient();
  if (!supabase) return;

  const userAgent = requestHeaders.get('user-agent') ?? 'unknown';
  const isEntry = payload.entry === true;
  const ownHost = normalizeHost(requestHeaders.get('host'));

  // המפנה והקמפיין נקבעים רק בכניסה לסשן. בניווט פנימי document.referrer
  // אינו מתעדכן — הוא נשאר המפנה החיצוני המקורי, ושליחתו בכל עמוד ניפחה
  // כל מקור הפניה פי מספר העמודים בביקור.
  let referrerHost: string | null = null;
  let utmSource: string | null = null;
  let utmMedium: string | null = null;
  let utmCampaign: string | null = null;
  if (isEntry) {
    const host = normalizeHost(str(payload.ref, 100));
    referrerHost = host && host !== ownHost ? host : null;
    utmSource = cleanLabel(payload.us);
    utmMedium = cleanLabel(payload.um);
    utmCampaign = cleanLabel(payload.uc);
  }

  const { error } = await supabase.from('page_views').insert({
    id,
    path,
    locale: locale(payload.locale),
    referrer_host: referrerHost,
    visitor_hash: dailyVisitorHash(clientIp(requestHeaders), userAgent),
    session_id: sessionId,
    is_entry: isEntry,
    prev_path: isEntry ? null : cleanPath(payload.prev),
    channel: isEntry ? classifyChannel({ referrerHost, utmSource, utmMedium }) : null,
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    device: deviceFromUserAgent(userAgent),
    country: countryFromHeaders(requestHeaders),
    is_bot: isBotUserAgent(userAgent),
  });
  // 23505 = אותו מזהה צפייה נשלח פעמיים (ניסיון חוזר) — לא שגיאה
  if (error && error.code !== '23505') console.error('[analytics:pageview]', error.code, error.message);
}

async function recordEngagement(payload: Payload): Promise<void> {
  const sessionId = str(payload.sid, 64);
  if (!isUuid(payload.id) || !sessionId) return;
  const duration = Number(payload.ms);
  const scroll = Number(payload.scroll);
  if (!Number.isFinite(duration)) return;

  const supabase = await createClient();
  if (!supabase) return;
  const { error } = await supabase.rpc('analytics_record_engagement', {
    p_id: payload.id,
    p_session: sessionId,
    p_duration_ms: Math.round(Math.min(Math.max(duration, 0), 1_800_000)),
    p_scroll: Number.isFinite(scroll) ? Math.round(Math.min(Math.max(scroll, 0), 100)) : 0,
  });
  if (error) console.error('[analytics:engagement]', error.code, error.message);
}

async function recordOutbound(payload: Payload, requestHeaders: Headers): Promise<void> {
  const kind = str(payload.kind, 10);
  const fromPath = cleanPath(payload.from);
  if (!kind || !OUTBOUND_KINDS.has(kind) || !fromPath) return;

  let target: string | null = null;
  if (kind === 'external') {
    target = normalizeHost(str(payload.target, 100));
    if (!target) return;
  } else if (kind === 'download') {
    target = cleanPath(payload.target);
    if (!target) return;
  }

  const supabase = await createClient();
  if (!supabase) return;
  const userAgent = requestHeaders.get('user-agent') ?? 'unknown';
  if (isBotUserAgent(userAgent)) return;

  const { error } = await supabase.from('outbound_clicks').insert({
    kind,
    target,
    from_path: fromPath,
    book_id: isUuid(payload.book) ? payload.book : null,
    session_id: str(payload.sid, 64),
    visitor_hash: dailyVisitorHash(clientIp(requestHeaders), userAgent),
    locale: locale(payload.locale),
  });
  if (error) console.error('[analytics:outbound]', error.code, error.message);
}

async function recordBookEvent(payload: Payload): Promise<void> {
  const name = str(payload.name, 40);
  const key = str(payload.key, 64);
  if (!name || !BOOK_EVENTS.has(name) || !key || !isUuid(payload.book)) return;
  // recordCommerceEvent מגביל קצב בעצמו ומאמת את שאר השדות
  await recordCommerceEvent(name, { sessionKey: key, bookId: payload.book, locale: locale(payload.locale) });
}
