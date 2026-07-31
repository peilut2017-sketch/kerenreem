/**
 * שתי העדפות הנגישות שנשארו באחריות האתר עצמו: ניגודיות גבוהה וגופן קריא.
 *
 * שאר ההתאמות (גודל טקסט, ריווח, סרגל קריאה, סמן גדול, הקראה) מגיעות
 * מחבילת accessibility ונשמרות אצלה. שתי אלה נשארו כאן משום ששתיהן
 * דורשות ידע על מערכת העיצוב של האתר: מצב הניגודיות דורס את משתני
 * הצבע ב-globals.css, והגופן הקריא מחליף את הסריף בסנס. גרסה גנרית של
 * שתיהן — filter: invert על כל העמוד — הופכת גם את הכריכות והצילומים
 * לתשליל, וזה גרוע יותר מכלום.
 */

const STORAGE_KEY = 'kr-a11y';

export type SiteA11yToggle = 'contrast' | 'font';

export interface SiteA11yState {
  contrast: boolean;
  font: boolean;
}

const DEFAULT_STATE: SiteA11yState = { contrast: false, font: false };

const ATTRIBUTE: Record<SiteA11yToggle, string> = {
  contrast: 'data-a11y-contrast',
  font: 'data-a11y-font',
};

export function readSitePreferences(): SiteA11yState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<SiteA11yState>;
    return { contrast: Boolean(parsed.contrast), font: Boolean(parsed.font) };
  } catch {
    // גלישה פרטית או אחסון חסום — ברירות המחדל, בלי להפיל דבר
    return DEFAULT_STATE;
  }
}

export function applySitePreference(key: SiteA11yToggle, on: boolean): void {
  const next = { ...readSitePreferences(), [key]: on };

  const root = document.documentElement;
  if (on) root.setAttribute(ATTRIBUTE[key], 'on');
  else root.removeAttribute(ATTRIBUTE[key]);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ההעדפה תחול על העמוד הנוכחי אך לא תישמר */
  }
}

/**
 * רץ לפני הצביעה הראשונה. שתי מטלות:
 *
 * 1. מסמן html.js. ההופעה בגלילה (.reveal) מסתירה תוכן רק כשהדגל קיים,
 *    כך שדפדפן בלי JS מקבל עמוד מלא ולא עמוד ריק — ראו globals.css.
 * 2. מחיל ניגודיות/גופן שנשמרו, כדי שמי שבחר בהם לא יראה הבזק של
 *    ברירת המחדל לפני שה-React עולה.
 */
export const A11Y_INIT_SCRIPT = `(function(){try{
var r=document.documentElement;
r.classList.add('js');
var s=JSON.parse(localStorage.getItem('${STORAGE_KEY}')||'{}');
if(s.contrast)r.setAttribute('data-a11y-contrast','on');
if(s.font)r.setAttribute('data-a11y-font','on');
}catch(e){}})();`;
