'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  motionAllowed,
  preventNestedScroll,
  resizeSmoothScroll,
  setActiveLenis,
} from '@/lib/smooth-scroll';

type LenisInstance = InstanceType<typeof import('lenis').default>;

/**
 * גלילה חלקה (Lenis) לכל העמודים הציבוריים ולניהול.
 *
 * מה שנשאר נייטיבי בכוונה:
 *  • מסך מגע — syncTouch כבוי, ההחלקה היא של הדפדפן.
 *  • הקופה — enabled=false מ-ChromeGate. שם יש iframe של תשלום וטפסים,
 *    ויציבות חשובה יותר מהרגשה.
 *  • מי שביקש הפחתת תנועה, במערכת או במתג הנגישות של האתר. ההעדפה נבדקת
 *    בזמן אמת: הדלקת המתג מכבה את הספרייה מיד, בלי רענון.
 *
 * הספרייה נטענת ב-import דינמי, כך שהיא לא מכבידה על הטעינה הראשונה
 * ולא נטענת בכלל אצל מי שמוותר עליה.
 *
 * אזורי גלילה פנימיים (מגירות, רשימות, חלונות) מסומנים data-lenis-prevent,
 * ו-scripts/check-scroll-areas.mjs נכשל אם נוסף אחד בלי הסימון.
 */
export function SmoothScroll({ enabled = true }: { enabled?: boolean }) {
  const pathname = usePathname();

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let lenis: LenisInstance | null = null;

    async function start() {
      if (lenis || !motionAllowed()) return;
      const { default: Lenis } = await import('lenis');
      // בזמן הטעינה ההעדפה יכולה להשתנות, או שהרכיב כבר הוסר
      if (cancelled || lenis || !motionAllowed()) return;
      lenis = new Lenis({
        autoRaf: true,
        lerp: 0.1,
        smoothWheel: true,
        syncTouch: false,
        // ניווט בין עמודים באמצע תנופה לא יגרור את הגלילה לעמוד החדש
        stopInertiaOnNavigate: true,
        prevent: preventNestedScroll,
      });
      setActiveLenis(lenis);
    }

    function stop() {
      if (!lenis) return;
      setActiveLenis(null);
      lenis.destroy();
      lenis = null;
    }

    function sync() {
      if (motionAllowed()) void start();
      else stop();
    }

    sync();
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    media.addEventListener('change', sync);
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-a11y-motion'],
    });

    return () => {
      cancelled = true;
      media.removeEventListener('change', sync);
      observer.disconnect();
      stop();
    };
  }, [enabled]);

  // עמוד חדש = גובה חדש. בלי מדידה מחדש הספרייה ממשיכה לחשב מול העמוד הקודם.
  useEffect(() => {
    resizeSmoothScroll();
  }, [pathname]);

  return null;
}
