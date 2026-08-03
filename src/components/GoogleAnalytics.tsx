import Script from 'next/script';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * Google Analytics 4 — מוגדר-תצורה: פעיל רק אם NEXT_PUBLIC_GA_MEASUREMENT_ID
 * מוגדר בסביבה. בלי המשתנה הזה (ברירת המחדל) הרכיב אינו מרנדר דבר, ולא
 * נטען שום סקריפט חיצוני — האתר ממשיך לרוץ תחת ה-CSP המחמיר המקורי בלי
 * אף מתחם נוסף (ראו next.config.ts, ששם את ההרחבה ל-CSP מאחורי אותו
 * תנאי בדיוק).
 *
 * זה משלים ולא מחליף את האנליטיקס העצמאי (page_views, ראו
 * lib/analytics/actions.ts): הראשון נשאר עובד תמיד, בלי הגדרה נדרשת
 * ובלי לשלוח נתונים לגוגל; GA4 הוא הרחבה אופציונלית לכלים ולדוחות
 * העשירים יותר של גוגל, למי שרוצה גם אותם.
 *
 * הקמה: Google Analytics → Admin → Data Streams → Web → Measurement ID
 * (מתחיל ב-G-), להגדיר כמשתנה סביבה NEXT_PUBLIC_GA_MEASUREMENT_ID.
 */
export function GoogleAnalytics() {
  if (!GA_MEASUREMENT_ID) return null;

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
