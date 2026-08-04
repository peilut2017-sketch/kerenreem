'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    grecaptcha?: { reset: (id?: number) => void };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;

/**
 * reCAPTCHA v2 ("אני לא רובוט") — פעיל רק כש-NEXT_PUBLIC_RECAPTCHA_SITE_KEY
 * מוגדר, באותו דפוס כמו GoogleAnalytics.tsx: אתר שלא הגדיר מפתח ממשיך
 * לעבוד בלי הרכיב הזה בכלל, ובלי הרחבת CSP (ראו next.config.ts).
 *
 * ה-checkbox נרשם דרך התג הרגיל (class="g-recaptcha") ולא ה-API של
 * JS — סקריפט גוגל סורק את ה-DOM וממיר אותו בעצמו, וה-token מגיע לטופס
 * דרך textarea מוסתר בשם g-recaptcha-response שהוא יוצר בתוך התג. בדיוק
 * כמו כל שדה אחר בטופס, הוא נכלל אוטומטית ב-FormData.
 */
export function Captcha({ resetSignal }: { resetSignal?: unknown }) {
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    window.grecaptcha?.reset();
  }, [resetSignal]);

  if (!SITE_KEY) return null;

  return (
    <div>
      <Script src="https://www.google.com/recaptcha/api.js" strategy="afterInteractive" />
      <div className="g-recaptcha" data-sitekey={SITE_KEY} />
    </div>
  );
}
