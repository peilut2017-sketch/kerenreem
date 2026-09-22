import { NextResponse } from 'next/server';
import { canonicalUrlStatus } from '@/lib/site-url';

/**
 * [1.40] בדיקת חיות רדודה — "האפליקציה עצמה עונה".
 *
 * מכוון שהיא *לא* נוגעת במסד ולא באחסון: זו הבדיקה שאמורה להבדיל בין
 * "Vercel/Next נפלו" לבין "התשתית מאחור נפלה". בדיקה אחת שבודקת הכול
 * אינה מסוגלת להצביע על מקור התקלה, וזו בדיוק הייתה הבעיה באירוע
 * האחרון: עמוד הבית החזיר 200 בעוד שדפי הספר החזירו 500.
 *
 * מחזירה תמיד 200 כשהתהליך חי, ומצרפת מידע שמאפשר למוניטור לזהות
 * פריסה חדשה (build SHA) ותשובה שהוגשה ממטמון ישן.
 *
 * גלויה בלי אימות בכוונה: אין בה שום מידע רגיש, ומוניטור חיצוני חייב
 * להגיע אליה גם כשאין לו סודות. הבדיקה העמוקה, שכן נוגעת במסד,
 * מוגנת בסוד — ראו /api/health/deep.
 */

export const dynamic = 'force-dynamic';
// ‏nodejs ולא edge: הבדיקה העמוקה שלצדה זקוקה ל-runtime מלא, ועדיף
// ששתיהן ירוצו באותה סביבה — אחרת "הבריאות" מודדת משהו אחר מהאתר.
export const runtime = 'nodejs';

/** מזהה הבנייה — Vercel מזריק אותו; מחוץ ל-Vercel פשוט לא ידוע. */
function buildId(): string | null {
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.NEXT_PUBLIC_BUILD_SHA ??
    process.env.SOURCE_COMMIT ??
    null
  );
}

export function GET(): NextResponse {
  const canonical = canonicalUrlStatus();

  return NextResponse.json(
    {
      status: 'ok',
      service: 'web',
      time: new Date().toISOString(),
      // זמן העלייה של המופע. מופע שנולד לפני שניות ספורות מסביר
      // השהיה חריגה בבדיקה הבאה (cold start) בלי להזעיק אף אחד.
      uptimeSeconds: Math.round(process.uptime()),
      build: buildId(),
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'unknown',
      /*
       * הכתובת הקנונית מדווחת כאן במכוון. sitemap.xml שפרסם את כתובת
       * הפריסה של Vercel במקום את הדומיין של המכון היה תקלה שהתגלתה
       * בעין חודשים אחרי שקרתה; עכשיו המוניטור יכול לשאול את האתר
       * עצמו מה הוא חושב שכתובתו, ולהתריע ברגע שזה משתנה.
       */
      canonicalUrl: canonical.effective,
      canonicalOverridden: canonical.overridden,
      canonicalReason: canonical.reason,
    },
    {
      status: 200,
      headers: {
        // בדיקת בריאות שמוגשת ממטמון אינה בדיקת בריאות. זו בדיוק
        // הטעות שגרמה לכך שדפי ספר המשיכו להגיש 500 שמור אחרי
        // שהמסד כבר חזר — תשובה ישנה שנראתה כמו המצב הנוכחי.
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      },
    },
  );
}
