import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PUBLIC_CONTENT_CACHE_TAG } from '@/lib/revalidation/content-cache';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './config';

/**
 * לקוח מקושר-session, לשימוש ב-Server Components וב-Route Handlers.
 * כפוף ל-RLS: משתמש אנונימי רואה רק תוכן שפורסם.
 *
 * מחזיר null כשהסביבה אינה מוגדרת — הקוראים אמורים לטפל בכך.
 */
export async function createClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return null;

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // קריאה מ-Server Component שאינו יכול לכתוב עוגיות — ה-middleware
          // כבר מרענן את ה-session, כך שאפשר להתעלם בבטחה.
        }
      },
    },
  });
}

/**
 * שלושה לקוחות אנונימיים (בלי session), לפי מה שהקורא צריך מהמטמון:
 *
 *   createStaticClient — ברירת המחדל של Next (`auto no cache`): אינו מוסיף
 *     שום הנחיית מטמון. בזמן prerender נשלף פעם אחת והעמוד נשאר סטטי; בזמן
 *     בקשה נשלף מחדש. זה הלקוח של כל מי שמשרת גם עמוד סטטי וגם מסלול חי —
 *     הגדרות החנות, דגלי המסחר, שיטות משלוח — ושל כתיבות.
 *   createContentClient — מטמון תוכן **בבחירה מפורשת**, רק לשליפות תוכן
 *     ב-data.ts. נשמר עד שמבטלים את התג (ראו lib/revalidation/content-cache.ts).
 *   createLiveClient — `no-store` מפורש לכל בקשה. לכל מי שרץ בזמן בקשה בלבד
 *     ואסור לו לראות נתון ישן: עגלה, זמינות מלאי, health, diagnostics.
 *     אסור להשתמש בו בקוד שרץ גם ב-prerender: no-store הופך מסלול לדינמי.
 */

type RequestTarget = { url: string; method: string };

function describeRequest(input: RequestInfo | URL, init?: RequestInit): RequestTarget {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  return { url, method };
}

/**
 * עטיפת fetch של לקוח התוכן: קריאות קריאה (GET/HEAD אל PostgREST) נשמרות
 * במטמון-הנתונים עם התג הציבורי; כל השאר (auth, storage, כתיבות, rpc)
 * עובר כמות שהוא. `force-cache` בלי `revalidate` אינו מוסיף חלון זמן,
 * ולכן המסלולים נשארים סטטיים ואינם הופכים ל-ISR מבוסס-זמן.
 *
 * ‏`base` מאפשר לבדיקה להחליף את ה-fetch; ברירת המחדל נקראת בזמן הקריאה
 * ולא בזמן היצירה, כדי לקבל את ה-fetch שהוחלף ב-Next.
 */
export function createContentFetch(base?: typeof fetch): typeof fetch {
  return (input, init) => {
    const send = base ?? fetch;
    const { url, method } = describeRequest(input, init);
    if ((method === 'GET' || method === 'HEAD') && url.includes('/rest/v1/')) {
      return send(input, {
        ...init,
        cache: 'force-cache',
        next: { tags: [PUBLIC_CONTENT_CACHE_TAG] },
      } as RequestInit);
    }
    return send(input, init);
  };
}

/** עטיפת fetch של הלקוח החי: כל בקשה `no-store`, בלי תגים. */
export function createLiveFetch(base?: typeof fetch): typeof fetch {
  return (input, init) => (base ?? fetch)(input, { ...init, cache: 'no-store' });
}

function createAnonymousClient(fetchImpl?: typeof fetch): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll: () => [], setAll: () => {} },
    ...(fetchImpl ? { global: { fetch: fetchImpl } } : {}),
  });
}

/**
 * לקוח ללא session, לשימוש בשליפות סטטיות (generateStaticParams, ISR,
 * sitemap) שרצות מחוץ להקשר בקשה ולכן אין להן גישה לעוגיות.
 *
 * ברירת המחדל של Next בלבד — לא נשמר במטמון-הנתונים. ראו הסבר על שלושת
 * הלקוחות למעלה.
 */
export function createStaticClient(): SupabaseClient | null {
  return createAnonymousClient();
}

/** לקוח תוכן עם מטמון-נתונים מתויג. רק לשליפות תוכן ב-data.ts. */
export function createContentClient(): SupabaseClient | null {
  return createAnonymousClient(createContentFetch());
}

/** לקוח שלעולם אינו במטמון — ראו ההסבר על שלושת הלקוחות למעלה. */
export function createLiveClient(): SupabaseClient | null {
  return createAnonymousClient(createLiveFetch());
}
