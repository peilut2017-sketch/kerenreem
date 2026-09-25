import 'server-only';

import { revalidatePath } from 'next/cache';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import {
  buildBoundaryPaths,
  CURSOR_KEY,
  DEFAULT_LOOKBACK_MS,
  type BoundaryScan,
} from './boundaries';

/**
 * ‏[1.42] ההרצה בפועל של סורק הגבולות. ההיגיון עצמו (מה נחצה, אילו
 * נתיבים) הוא פונקציה טהורה ב-boundaries.ts; כאן רק המסד, הסמן ו-Next.
 *
 * הסדר מחויב ואינו שרירותי:
 *
 *   1. קריאת הסמן ‎(T0).
 *   2. ‏T1 = now().
 *   3. סריקת הגבולות ב-[T0, T1).
 *   4. אם אין אף גבול — **אפס revalidatePath**, והסמן כן מתקדם.
 *   5. אחרת: רענון כל הנתיבים.
 *   6. **רק אחרי שכולם עברו** — קידום הסמן ל-T1.
 *
 * שלב 6 אחרי שלב 5 במכוון: כשל באמצע משאיר את הסמן במקומו, והריצה הבאה
 * תחזור על אותו חלון. רענון כפול הוא כתיבה מיותרת; גבול שאבד הוא מבצע
 * שלא התחיל. השני גרוע בהרבה.
 *
 * שלב 4 הוא הלב: הסמן מתקדם גם בריצה ריקה, כדי שהחלון לא יגדל בלי
 * גבול — אבל בלי לגעת בשום מטמון. זו הדרישה "אפס writes כשאין שינוי".
 */

export interface BoundaryRunResult {
  ok: boolean;
  /** 'skipped' כשאין חיבור למסד. */
  status: 'done' | 'skipped' | 'failed';
  from: string | null;
  to: string | null;
  revalidated: number;
  counts: BoundaryScan['counts'] | null;
  overflow: boolean;
  cursorAdvanced: boolean;
  error?: string;
}

/** שדות המסד שהסריקה צריכה — מצומצמים בכוונה. */
const BOOK_COLUMNS = 'slug, sale_starts_at, sale_ends_at, author:authors ( slug )';

async function readCursor(service: SupabaseClient, now: number): Promise<number> {
  const { data } = await service.from('site_settings').select('extra').eq('id', 1).maybeSingle();
  const extra = (data?.extra as Record<string, unknown> | null) ?? {};
  const raw = extra[CURSOR_KEY];
  const parsed = typeof raw === 'string' ? new Date(raw).getTime() : NaN;

  /*
   * בלי סמן תקין — חלון ברירת מחדל אחורה, ולא "מתחילת הזמן": סריקה
   * מאפס הייתה מחזירה כל מבצע וכל אירוע בהיסטוריה ומפילה את הסף.
   */
  if (!Number.isFinite(parsed)) return now - DEFAULT_LOOKBACK_MS;

  // סמן מהעתיד (שעון שהוזז, שחזור גיבוי) — מטופל כאילו אינו קיים.
  return parsed > now ? now - DEFAULT_LOOKBACK_MS : parsed;
}

async function writeCursor(service: SupabaseClient, to: number): Promise<boolean> {
  // מיזוג ולא כתיבה גורפת: extra משותפת למסכי ניהול אחרים, וכתיבה מלאה
  // הייתה מוחקת בשקט את מה ששמרו הם (אותו נימוק כמו mergeExtra).
  const { data: current } = await service
    .from('site_settings')
    .select('extra')
    .eq('id', 1)
    .maybeSingle();
  const extra = {
    ...((current?.extra as Record<string, unknown> | null) ?? {}),
    [CURSOR_KEY]: new Date(to).toISOString(),
  };
  const { error } = await service.from('site_settings').update({ extra }).eq('id', 1);
  if (error) console.error('[revalidation] cursor write', error.message);
  return !error;
}

export async function runBoundaryRevalidation(): Promise<BoundaryRunResult> {
  const empty: BoundaryRunResult = {
    ok: true,
    status: 'skipped',
    from: null,
    to: null,
    revalidated: 0,
    counts: null,
    overflow: false,
    cursorAdvanced: false,
  };

  const service = createServiceClient();
  if (!service) return empty;

  const now = Date.now();
  const from = await readCursor(service, now);
  const to = now;
  const fromIso = new Date(from).toISOString();
  const toIso = new Date(to).toISOString();

  /*
   * טווח השליפה רחב מהחלון בכוונה: גבול של אירוע הוא `event_date + יום`,
   * ולכן אירוע שעובר עכשיו הוא זה של *אתמול*. שליפה על החלון עצמו הייתה
   * מפספסת אותו. הסינון המדויק נעשה ב-buildBoundaryPaths.
   */
  const scanFromIso = new Date(from - 2 * 24 * 60 * 60_000).toISOString();

  const [booksResult, bannersResult, eventsResult] = await Promise.all([
    service
      .from('books')
      .select(BOOK_COLUMNS)
      .or(`sale_starts_at.gte.${scanFromIso},sale_ends_at.gte.${scanFromIso}`)
      .lte('sale_starts_at', toIso)
      .limit(1000),
    service
      .from('banners')
      .select('starts_at, ends_at')
      .eq('is_published', true)
      .limit(500),
    service
      .from('events')
      .select('event_date')
      .eq('is_published', true)
      .gte('event_date', scanFromIso.slice(0, 10))
      .lte('event_date', toIso.slice(0, 10))
      .limit(500),
  ]);

  const failure = booksResult.error ?? bannersResult.error ?? eventsResult.error;
  if (failure) {
    console.error('[revalidation] scan', failure.message);
    // הסמן אינו מתקדם — הריצה הבאה תנסה את אותו חלון.
    return {
      ...empty,
      ok: false,
      status: 'failed',
      from: fromIso,
      to: toIso,
      error: failure.message,
    };
  }

  type BookRow = {
    slug: string;
    sale_starts_at: string | null;
    sale_ends_at: string | null;
    author: { slug: string } | { slug: string }[] | null;
  };

  const scan = buildBoundaryPaths({
    from,
    to,
    books: ((booksResult.data ?? []) as unknown as BookRow[]).map((row) => {
      // ‏PostgREST מחזיר יחס יחיד כאובייקט או כמערך, תלוי בהסקת הקשר.
      const author = Array.isArray(row.author) ? row.author[0] : row.author;
      return {
        slug: row.slug,
        authorSlug: author?.slug ?? null,
        saleStartsAt: row.sale_starts_at,
        saleEndsAt: row.sale_ends_at,
      };
    }),
    banners: (bannersResult.data ?? []) as { starts_at: string | null; ends_at: string | null }[],
    events: ((eventsResult.data ?? []) as { event_date: string | null }[]).map((row) => ({
      eventDate: row.event_date,
    })),
  });

  // ‏אין גבול — אפס רענון, והסמן מתקדם. זו הדרישה המרכזית.
  if (scan.paths.length === 0) {
    const advanced = await writeCursor(service, to);
    return {
      ok: true,
      status: 'done',
      from: fromIso,
      to: toIso,
      revalidated: 0,
      counts: scan.counts,
      overflow: false,
      cursorAdvanced: advanced,
    };
  }

  try {
    if (scan.overflow) {
      /*
       * חריג מנומק, ולא נוחות: מעל הסף (ראו OVERFLOW_THRESHOLD) ביטול
       * ממוקד הוא כבר יותר כתיבות מביטול העץ, ומסתכן בבקשה שנחתכת
       * ומשאירה חלק מהנתיבים לא מרועננים. קורה רק אחרי השבתה ארוכה או
       * שינוי מבצעים סיטוני.
       */
      console.warn(
        `[revalidation] ${scan.paths.length} נתיבים — מעבר לביטול גורף של עץ השפה`,
        { from: fromIso, to: toIso, counts: scan.counts },
      );
      revalidatePath('/[locale]', 'layout');
    } else {
      for (const path of scan.paths) revalidatePath(path);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[revalidation] revalidatePath', message);
    // הסמן אינו מתקדם. הריצה הבאה תחזור על אותו חלון.
    return {
      ok: false,
      status: 'failed',
      from: fromIso,
      to: toIso,
      revalidated: 0,
      counts: scan.counts,
      overflow: scan.overflow,
      cursorAdvanced: false,
      error: message,
    };
  }

  const advanced = await writeCursor(service, to);
  return {
    ok: advanced,
    status: advanced ? 'done' : 'failed',
    from: fromIso,
    to: toIso,
    revalidated: scan.overflow ? 1 : scan.paths.length,
    counts: scan.counts,
    overflow: scan.overflow,
    cursorAdvanced: advanced,
    error: advanced ? undefined : 'cursor write failed',
  };
}
