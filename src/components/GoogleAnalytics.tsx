'use client';

import Script from 'next/script';
import { useLocalValue } from '@/lib/client-hooks';
import { COOKIE_CONSENT_KEY } from './CookieConsentBanner';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * Google Analytics 4 — מוגדר-תצורה: פעיל רק אם NEXT_PUBLIC_GA_MEASUREMENT_ID
 * מוגדר בסביבה. בלי המשתנה הזה (ברירת המחדל) הרכיב אינו מרנדר דבר, ולא
 * נטען שום סקריפט חיצוני — האתר ממשיך לרוץ תחת ה-CSP המחמיר המקורי בלי
 * אף מתחם נוסף (ראו next.config.ts, ששם את ההרחבה ל-CSP מאחורי אותו
 * תנאי בדיוק).
 *
 * גם כשהמפתח מוגדר, הסקריפט לא נטען לפני שהמבקר הסכים לעוגיות (ראו
 * CookieConsentBanner.tsx) — 'use client' ו-useLocalValue כדי לקרוא
 * את ההסכמה מהאחסון המקומי ולהגיב אליה מיידית בלי רענון עמוד.
 *
 * זה משלים ולא מחליף את האנליטיקס העצמאי (page_views, ראו
 * lib/analytics/actions.ts): הראשון נשאר עובד תמיד, בלי הגדרה נדרשת,
 * בלי עוגיות ובלי לשלוח נתונים לגוגל; GA4 הוא הרחבה אופציונלית לכלים
 * ולדוחות העשירים יותר של גוגל, למי שרוצה גם אותם ושהסכים לכך.
 *
 * הקמה: Google Analytics → Admin → Data Streams → Web → Measurement ID
 * (מתחיל ב-G-), להגדיר כמשתנה סביבה NEXT_PUBLIC_GA_MEASUREMENT_ID.
 */
export function GoogleAnalytics() {
  const { value: consent } = useLocalValue(COOKIE_CONSENT_KEY);

  if (!GA_MEASUREMENT_ID || consent !== 'granted') return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}');
        `}
      </Script>
    </>
  );
}
