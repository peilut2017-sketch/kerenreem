'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import { collect, gaEvent, touchSession } from '@/lib/analytics/client';

const DOWNLOAD_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|epub|mp3|mp4)$/i;

interface PageState {
  id: string;
  sid: string;
  /** זמן מעורבות שנצבר בלשונית גלויה, באלפיות שנייה */
  visibleMs: number;
  /** מתי החלה הרצועה הגלויה הנוכחית; null כשהלשונית מוסתרת */
  visibleSince: number | null;
  maxScroll: number;
}

function scrollPercent(): number {
  const doc = document.documentElement;
  const total = doc.scrollHeight;
  if (total <= 0) return 0;
  return Math.min(100, Math.round(((window.scrollY + window.innerHeight) / total) * 100));
}

/**
 * מתעד צפיה בעמוד ציבורי, ואת מה שקרה בו: כמה זמן שהו (רק בזמן שהלשונית
 * גלויה), עד איפה גללו, ולאן יצאו. אחראי לכל מה ששייך לעמוד כולו; אירועי
 * ספר ספציפיים (שמירה, הוספה לסל) נשלחים מהרכיבים עצמם.
 *
 * כל ניווט בצד הלקוח הוא צפיה חדשה — כמעט כל ניווט באתר הוא <Link> של
 * Next ולא טעינה מלאה, ובלי מעקב אחרי pathname כל עמוד אחרי הראשון היה
 * "שקוף". usePathname כאן הוא הגרסה המודעת-לשפה: אותו עמוד בשתי השפות
 * נספר תחת אותו path ומתבדל בעמודת locale.
 *
 * המפנה (document.referrer) נשלח רק בכניסה לסשן, מהטעינה הראשונה של
 * המסמך. בניווט פנימי הוא נשאר המפנה החיצוני המקורי, ושליחתו בכל עמוד
 * ניפחה את מונה המפנים. לניווט פנימי יש prev (העמוד הקודם) במקומו.
 *
 * כשל בשליחה אינו מגיע למבקר: collect() בולע שגיאות.
 */
export function AnalyticsBeacon() {
  const pathname = usePathname();
  const locale = useLocale();
  const page = useRef<PageState | null>(null);
  const documentStart = useRef(true);
  const lastPath = useRef<string | null>(null);

  // שליחת המשך/סיום: מצטבר, והשרת רק מעלה ערכים — כך שאפשר לשלוח כמה פעמים
  // (הסתרה, חזרה, עזיבה) בלי לספור כפול.
  useEffect(() => {
    function flush() {
      const current = page.current;
      if (!current) return;
      const now = Date.now();
      const ms = current.visibleMs + (current.visibleSince ? now - current.visibleSince : 0);
      collect({ t: 'pe', id: current.id, sid: current.sid, ms: Math.round(ms), scroll: current.maxScroll });
    }

    function onVisibility() {
      const current = page.current;
      if (!current) return;
      if (document.visibilityState === 'hidden') {
        if (current.visibleSince) current.visibleMs += Date.now() - current.visibleSince;
        current.visibleSince = null;
        flush();
      } else if (!current.visibleSince) {
        current.visibleSince = Date.now();
        touchSession();
      }
    }

    let frame = 0;
    function onScroll() {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const current = page.current;
        if (current) current.maxScroll = Math.max(current.maxScroll, scrollPercent());
      });
    }

    function onClick(event: MouseEvent) {
      const anchor = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      const book = anchor.closest('[data-book-id]')?.getAttribute('data-book-id') ?? undefined;
      const base = { t: 'out', from: lastPath.current ?? '/', sid: touchSession().id, locale, book };

      if (url.protocol === 'tel:' || url.protocol === 'mailto:') {
        const kind = url.protocol === 'tel:' ? 'tel' : 'mailto';
        collect({ ...base, kind });
        gaEvent(kind === 'tel' ? 'tel_click' : 'mailto_click', { page_path: lastPath.current });
      } else if (url.protocol === 'http:' || url.protocol === 'https:') {
        if (url.host !== window.location.host) {
          collect({ ...base, kind: 'external', target: url.hostname });
        } else if (DOWNLOAD_EXT.test(url.pathname)) {
          collect({ ...base, kind: 'download', target: url.pathname });
        }
      }
    }

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick, true);
    document.addEventListener('auxclick', onClick, true);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('auxclick', onClick, true);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [locale]);

  // צפיה חדשה בכל שינוי נתיב; ניקוי האפקט סוגר את הצפיה הקודמת
  useEffect(() => {
    const session = touchSession();
    const fromDocumentLoad = documentStart.current;
    documentStart.current = false;

    const id = crypto.randomUUID();
    const prev = lastPath.current;
    lastPath.current = pathname;
    page.current = {
      id,
      sid: session.id,
      visibleMs: 0,
      visibleSince: document.visibilityState === 'visible' ? Date.now() : null,
      maxScroll: scrollPercent(),
    };

    const payload: Record<string, unknown> = {
      t: 'pv',
      id,
      sid: session.id,
      path: pathname,
      locale,
      entry: session.isNew,
    };
    if (session.isNew) {
      if (fromDocumentLoad && document.referrer) {
        try {
          payload.ref = new URL(document.referrer).hostname;
        } catch {
          /* מפנה לא תקין — נספר ישיר */
        }
      }
      const params = new URLSearchParams(window.location.search);
      payload.us = params.get('utm_source') ?? undefined;
      payload.um = params.get('utm_medium') ?? undefined;
      payload.uc = params.get('utm_campaign') ?? undefined;
    } else {
      payload.prev = prev ?? undefined;
    }
    collect(payload);

    return () => {
      const current = page.current;
      if (!current || current.id !== id) return;
      const now = Date.now();
      const ms = current.visibleMs + (current.visibleSince ? now - current.visibleSince : 0);
      collect({ t: 'pe', id, sid: current.sid, ms: Math.round(ms), scroll: current.maxScroll });
      page.current = null;
    };
  }, [pathname, locale]);

  return null;
}
