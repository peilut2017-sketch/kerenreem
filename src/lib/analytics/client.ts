/**
 * צד הלקוח של האנליטיקה העצמאית: מזהה סשן, שליחה בטוחה-לעזיבה, ואירועי GA4.
 *
 * אין כאן שום עוגייה. מזהה הסשן הוא מחרוזת אקראית ב-sessionStorage —
 * נמחק עם סגירת הלשונית, תקף 30 דקות של חוסר פעילות, ואינו קשור לאדם.
 * מזהה המכשיר של אירועי המסחר (kr:session) הוא מנגנון קיים, ראו CartProvider.
 */

export const COLLECT_URL = '/api/analytics/collect';
export const NO_TRACK_KEY = 'kr:no-track';
const SESSION_KEY = 'kr:sid';
const DEVICE_KEY = 'kr:session';
const SESSION_IDLE_MS = 30 * 60_000;

let memorySession: { id: string; ts: number } | null = null;

function randomId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** מזהה המכשיר לאירועי מסחר (נשמר מקומית, בלי PII) — מקור אחד ל-CartProvider ולמעקב. */
export function getDeviceKey(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const fresh = randomId();
    window.localStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    return 'no-storage';
  }
}

/** האם המכשיר הוחרג מהספירה (צוות שמסמן "אל תספור אותי" במסך האנליטיקס). */
export function isTrackingDisabled(): boolean {
  try {
    return window.localStorage.getItem(NO_TRACK_KEY) === '1';
  } catch {
    return false;
  }
}

/** סשן נוכחי; isNew=true כשנוצר עכשיו (כניסה חדשה, או אחרי 30 דקות חוסר פעילות). */
export function touchSession(): { id: string; isNew: boolean } {
  const now = Date.now();
  let stored: { id: string; ts: number } | null = memorySession;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (raw) stored = JSON.parse(raw) as { id: string; ts: number };
  } catch {
    /* sessionStorage חסום — נשארים עם הזיכרון */
  }
  const fresh = !stored || typeof stored.id !== 'string' || now - stored.ts > SESSION_IDLE_MS;
  const next = fresh ? { id: randomId(), ts: now } : { id: stored!.id, ts: now };
  memorySession = next;
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
  } catch {
    /* ראו לעיל */
  }
  return { id: next.id, isNew: fresh };
}

/**
 * שליחה שמחזיקה מעמד בעזיבת עמוד: sendBeacon, ובחוסר תמיכה fetch עם
 * keepalive. text/plain ולא application/json — בקשה "פשוטה" בלי preflight.
 */
export function collect(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined' || isTrackingDisabled()) return;
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon?.(COLLECT_URL, new Blob([body], { type: 'text/plain' }))) return;
  } catch {
    /* ממשיכים ל-fetch */
  }
  void fetch(COLLECT_URL, {
    method: 'POST',
    body,
    keepalive: true,
    headers: { 'content-type': 'text/plain' },
  }).catch(() => {});
}

type GtagWindow = Window & { gtag?: (...args: unknown[]) => void };

/**
 * אירוע ל-GA4 — רק אם GA נטען בפועל (כלומר מוגדר מזהה, והמבקר אישר
 * עוגיות; ראו GoogleAnalytics.tsx). בלעדיו window.gtag אינו קיים וזה no-op.
 */
export function gaEvent(name: string, params: Record<string, unknown>): void {
  if (typeof window === 'undefined' || isTrackingDisabled()) return;
  const gtag = (window as GtagWindow).gtag;
  if (typeof gtag === 'function') gtag('event', name, params);
}

/** שמירת ספר למועדפים: אירוע מסחר ראשוני + אירוע GA4 (add_to_wishlist). */
export function trackBookSaved(bookId: string, title?: string): void {
  collect({ t: 'ev', name: 'product_saved', book: bookId, key: getDeviceKey(), locale: document.documentElement.lang });
  gaEvent('add_to_wishlist', { items: [{ item_id: bookId, item_name: title }] });
}
