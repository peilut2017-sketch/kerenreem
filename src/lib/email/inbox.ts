import 'server-only';

import { getSiteSettings } from '@/lib/data';
import { staffInbox } from './addresses';

/**
 * ‏[1.41] לאן נשלחת פנייה מהאתר.
 *
 * עד כה הייתה תיבה אחת לכל הפניות — משתנה הסביבה SITE_NOTIFICATIONS_EMAIL,
 * ובהיעדרו כתובת יצירת הקשר שבהגדרות. שני חסרונות: כל הפניות הגיעו
 * לאותו מקום, ושינוי היעד דרש שינוי בסביבה ופריסה מחדש.
 *
 * עכשיו היעד נקבע **לפי סוג הפנייה** ונערך במסך הניהול:
 *
 *   'general' — פנייה מטופס יצירת הקשר.
 *   'book'    — פנייה על ספר מסוים (הטופס בעמוד הספר). לרוב זו שאלה
 *               תוכנית או הערת הגהה, ולא תמיד אותו אדם שמטפל בפניות
 *               הכלליות.
 *
 * שרשרת הנפילה, מהספציפי לכללי:
 *   הכתובת שהוגדרה לסוג → SITE_NOTIFICATIONS_EMAIL → כתובת יצירת הקשר
 *   שבהגדרות האתר.
 *
 * כך פריסה קיימת ממשיכה לעבוד בדיוק כמו קודם עד שמישהו מגדיר כתובת
 * ייעודית, ואין רגע שבו פנייה אינה מגיעה לאיש.
 *
 * הכתובות שמורות ב-site_settings.extra ולא בעמודה ייעודית — אותו
 * נימוק כמו שאר ההגדרות הנקודתיות שם (ראו mergeExtra ב-settings-actions).
 */

export type InquiryKind = 'general' | 'book';

/** המפתח ב-site_settings.extra לכל סוג. */
export const INBOX_KEYS: Record<InquiryKind, string> = {
  general: 'inquiry_inbox_general',
  book: 'inquiry_inbox_book',
};

function fromExtra(extra: Record<string, unknown>, kind: InquiryKind): string | null {
  const value = extra[INBOX_KEYS[kind]];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** התיבה שאליה תישלח פנייה מהסוג הזה, או null כשאין אף יעד מוגדר. */
export async function resolveInquiryInbox(kind: InquiryKind): Promise<string | null> {
  const settings = await getSiteSettings();
  const extra = (settings.extra ?? {}) as Record<string, unknown>;
  return fromExtra(extra, kind) ?? staffInbox(settings.contact?.email ?? null);
}

/** שתי הכתובות כפי שהוגדרו (בלי שרשרת הנפילה) — למסך הניהול. */
export async function readInquiryInboxes(): Promise<Record<InquiryKind, string>> {
  const settings = await getSiteSettings();
  const extra = (settings.extra ?? {}) as Record<string, unknown>;
  return {
    general: fromExtra(extra, 'general') ?? '',
    book: fromExtra(extra, 'book') ?? '',
  };
}
