/**
 * ‏[1.42] חלון התוקף של באנר — פונקציה אחת, שני קוראים.
 *
 * ‏getBanners (lib/data.ts) מסנן לפי החלון בזמן הרינדור, וסורק הגבולות
 * ‏(lib/revalidation/boundaries.ts) צריך לדעת **מתי** החלון נפתח ונסגר
 * כדי לרענן את עמוד הבית באותו רגע. אם שני המקומות יחשבו את זה בנפרד,
 * הם יחלקו זה על זה — וזה בדיוק מה שקרה פעמיים עם הזמינות (‏getBookAvailability
 * מול validateCart, בשני מופעים נפרדים). לכן: כלל אחד, במקום אחד.
 *
 * הדקדוק ב-ends_at אינו קוסמטי. השדה הוא timestamptz, אבל הטופס בניהול
 * שומר בו לרוב תאריך בלבד (YYYY-MM-DD), וכזה מתפרש כחצות UTC. באנר
 * שאמור להסתיים "ביום האירוע" היה נעלם ב-00:00 UTC של אותו יום —
 * ‏02:00/03:00 בישראל, כלומר עד יממה מוקדם מהצפוי. לכן תאריך-בלבד נמתח
 * עד סוף אותו יום. ערך עם שעה מפורשת נשמר כפי שהוא.
 */

const DAY_MS = 24 * 60 * 60_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export interface BannerWindow {
  /** מתי הבאנר מתחיל להיות תקף, או null כשאין הגבלה. */
  startsAt: number | null;
  /** מתי הוא מפסיק להיות תקף, או null כשאין הגבלה. */
  endsAt: number | null;
}

export function bannerWindow(banner: {
  starts_at?: string | null;
  ends_at?: string | null;
}): BannerWindow {
  const raw = banner.ends_at;
  return {
    startsAt: banner.starts_at ? new Date(banner.starts_at).getTime() : null,
    endsAt: raw
      ? DATE_ONLY.test(raw)
        ? new Date(raw).getTime() + DAY_MS // תאריך בלבד → עד סוף אותו יום
        : new Date(raw).getTime()
      : null,
  };
}

/** האם הבאנר תקף ברגע נתון. */
export function bannerActiveAt(
  banner: { starts_at?: string | null; ends_at?: string | null },
  at: number,
): boolean {
  const { startsAt, endsAt } = bannerWindow(banner);
  if (startsAt != null && startsAt > at) return false;
  if (endsAt != null && endsAt < at) return false;
  return true;
}
