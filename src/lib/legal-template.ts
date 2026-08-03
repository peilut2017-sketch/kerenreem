import type { SiteSettings } from './supabase/types';

/**
 * מציאת ערכי קשר בעמודי המסגרת המשפטיים (תקנון/פרטיות/נגישות).
 *
 * גוף העמוד נשמר כטקסט ב-pages.body_he/en, אבל מספר עמותה, טלפון, דוא"ל
 * וכתובת כבר קיימים כשדות מובנים בהגדרות האתר (site_settings.contact) —
 * ראו SettingsForm.tsx. בלי הפונקציה הזו, שני המקורות היו יכולים לסטות
 * זה מזה: מנהל שממלא את הפרטים בהגדרות לא היה רואה אותם משתקפים במסמכים
 * המשפטיים, כי אלה HTML קבוע. ה-token מוחלף כאן, ברינדור, כך שמקור האמת
 * היחיד הוא ההגדרות.
 *
 * שדה שעדיין ריק בהגדרות מוצג באותה מוסכמת "[למילוי: ...]" שמשמשת ביתר
 * העמוד לפרטים שאין להם שדה מובנה כלל (עיר השיפוט, אישור סעיף 46) — כך
 * שאין הבדל חזותי בין "עוד לא מולא" ל"אין לזה בכלל שדה".
 */
const PLACEHOLDERS: Record<string, string> = {
  registration_number: '[למילוי: מספר עמותה — יש להזין בהגדרות האתר]',
  privacy_officer: '[למילוי: שם ותפקיד ממונה הפרטיות — יש להזין בהגדרות האתר]',
  accessibility_officer: '[למילוי: שם רכז הנגישות — יש להזין בהגדרות האתר]',
  phone: '[למילוי: מספר טלפון — יש להזין בהגדרות האתר]',
  email: '[למילוי: כתובת דואר אלקטרוני — יש להזין בהגדרות האתר]',
  address: '[למילוי: כתובת מלאה — יש להזין בהגדרות האתר]',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** מחליף {{token}} בגוף עמוד משפטי בערך אמיתי מההגדרות, או בברירת מחדל אם עוד לא מולא. */
export function renderLegalTemplate(html: string, settings: SiteSettings, locale: string): string {
  const contact = settings.contact ?? {};
  const address = locale === 'en' ? contact.address_en || contact.address_he : contact.address_he;

  const values: Record<string, string | undefined> = {
    registration_number: contact.registration_number,
    privacy_officer: contact.privacy_officer,
    accessibility_officer: contact.accessibility_officer,
    phone: contact.phone,
    email: contact.email,
    address,
  };

  return html.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (!(key in values)) return match;
    const value = values[key]?.trim();
    return value ? escapeHtml(value) : (PLACEHOLDERS[key] ?? match);
  });
}
