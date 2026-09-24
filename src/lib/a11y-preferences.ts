/**
 * העדפות הנגישות של האתר.
 *
 * ‏[1.41] עד כה ההתאמות התחלקו בין שני מקורות: שתי העדפות כאן
 * (ניגודיות וגופן קריא), וכל השאר בתוך חבילת accessibility החיצונית.
 * החבילה הוסרה — היא הציגה ארבעה-עשר פריטים ברשימה שטוחה אחת, רובם
 * כפולים או חסרי משמעות באתר הזה (היפוך צבעים שהפך גם את הכריכות
 * לתשליל, דיבור-לטקסט שנחסם ממילא בכותרת Permissions-Policy), והעיצוב
 * שלה לא היה שלנו וגם לא ניתן לשליטה בלי לתקן את ה-DOM שלה בדיעבד.
 *
 * מה שנשאר הוא הסט שיש לו משמעות ממשית באתר, מקובץ לפי סוג ההתאמה.
 * ‏**הסרגל אינו תחליף לנגישות המבנית**: ת"י 5568 נבחן על ה-HTML עצמו —
 * תוויות, מבנה כותרות, ניווט מקלדת, טקסט חלופי וניגודיות. זו שכבת
 * התאמה אישית מעל בסיס שכבר נגיש, וכך גם מנוסחת התקנה.
 *
 * כל ההעדפות מיושמות כתכונות data על <html> ונקראות מ-globals.css.
 * למה כך ולא ב-inline style: כלל CSS אחד יכול להצהיר על עשרות מקומות
 * בעמוד, ורק כך ההעדפה חלה גם על תוכן שמתרנדר אחר כך.
 */

const STORAGE_KEY = 'kr-a11y';

/** התאמות דו-מצביות. */
export type SiteA11yToggle =
  /** ניגודיות גבוהה — דריסת משתני הצבע (ראו globals.css). */
  | 'contrast'
  /** גווני אפור. */
  | 'gray'
  /** גופן קריא — סנס במקום הסריף. */
  | 'font'
  /** הדגשת קישורים בקו תחתון. */
  | 'links'
  /** סמן עכבר גדול. */
  | 'cursor'
  /** קו עזר לקריאה שעוקב אחרי הסמן. */
  | 'guide'
  /** עצירת אנימציות ומעברים. */
  | 'motion';

/** התאמות מדורגות. המדרגה 0 היא ברירת המחדל של האתר. */
export type SiteA11yStep = 'text' | 'lines';

/** מספר המדרגות מעל ברירת המחדל, לכל התאמה מדורגת. */
export const STEP_MAX: Record<SiteA11yStep, number> = { text: 3, lines: 2 };

export interface SiteA11yState {
  contrast: boolean;
  gray: boolean;
  font: boolean;
  links: boolean;
  cursor: boolean;
  guide: boolean;
  motion: boolean;
  text: number;
  lines: number;
}

export const A11Y_TOGGLES: readonly SiteA11yToggle[] = [
  'contrast',
  'gray',
  'font',
  'links',
  'cursor',
  'guide',
  'motion',
];

const DEFAULT_STATE: SiteA11yState = {
  contrast: false,
  gray: false,
  font: false,
  links: false,
  cursor: false,
  guide: false,
  motion: false,
  text: 0,
  lines: 0,
};

/** ‏data-a11y-<שם> — שם התכונה נגזר מהמפתח, ולכן אין טבלת מיפוי. */
function attribute(key: SiteA11yToggle | SiteA11yStep): string {
  return `data-a11y-${key}`;
}

function clampStep(key: SiteA11yStep, value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, STEP_MAX[key]);
}

export function readSitePreferences(): SiteA11yState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<Record<string, unknown>>;
    return {
      contrast: Boolean(parsed.contrast),
      gray: Boolean(parsed.gray),
      font: Boolean(parsed.font),
      links: Boolean(parsed.links),
      cursor: Boolean(parsed.cursor),
      guide: Boolean(parsed.guide),
      motion: Boolean(parsed.motion),
      text: clampStep('text', parsed.text),
      lines: clampStep('lines', parsed.lines),
    };
  } catch {
    // גלישה פרטית או אחסון חסום — ברירות המחדל, בלי להפיל דבר
    return DEFAULT_STATE;
  }
}

function persist(state: SiteA11yState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ההעדפה תחול על העמוד הנוכחי אך לא תישמר */
  }
}

/** מחיל מצב שלם על ה-DOM. נקודה אחת, כדי שלא ייתכן מצב חלקי. */
export function applySitePreferences(state: SiteA11yState): void {
  const root = document.documentElement;

  for (const key of A11Y_TOGGLES) {
    if (state[key]) root.setAttribute(attribute(key), 'on');
    else root.removeAttribute(attribute(key));
  }

  for (const key of ['text', 'lines'] as const) {
    if (state[key] > 0) root.setAttribute(attribute(key), String(state[key]));
    else root.removeAttribute(attribute(key));
  }
}

export function setSiteToggle(key: SiteA11yToggle, on: boolean): SiteA11yState {
  const next = { ...readSitePreferences(), [key]: on };
  applySitePreferences(next);
  persist(next);
  return next;
}

/** מזיז מדרגה אחת בכל כיוון, בתוך הטווח. */
export function stepSitePreference(key: SiteA11yStep, delta: number): SiteA11yState {
  const current = readSitePreferences();
  const next = { ...current, [key]: clampStep(key, current[key] + delta) };
  applySitePreferences(next);
  persist(next);
  return next;
}

export function resetSitePreferences(): SiteA11yState {
  applySitePreferences(DEFAULT_STATE);
  persist(DEFAULT_STATE);
  return DEFAULT_STATE;
}

/** האם משהו שונה מברירת המחדל — לצורך חיווי על כפתור הפתיחה. */
export function countActivePreferences(state: SiteA11yState): number {
  return (
    A11Y_TOGGLES.filter((key) => state[key]).length +
    (state.text > 0 ? 1 : 0) +
    (state.lines > 0 ? 1 : 0)
  );
}

/**
 * רץ לפני הצביעה הראשונה. שתי מטלות:
 *
 * 1. מסמן html.js. ההופעה בגלילה (.reveal) מסתירה תוכן רק כשהדגל קיים,
 *    כך שדפדפן בלי JS מקבל עמוד מלא ולא עמוד ריק — ראו globals.css.
 * 2. מחיל העדפות שנשמרו, כדי שמי שבחר בהן לא יראה הבזק של ברירת
 *    המחדל לפני שה-React עולה. זה מה שמחייב סקריפט חוסם ולא effect.
 */
export const A11Y_INIT_SCRIPT = `(function(){try{
var r=document.documentElement;
r.classList.add('js');
var s=JSON.parse(localStorage.getItem('${STORAGE_KEY}')||'{}');
['contrast','gray','font','links','cursor','guide','motion'].forEach(function(k){
if(s[k])r.setAttribute('data-a11y-'+k,'on');});
['text','lines'].forEach(function(k){
var v=Math.round(Number(s[k]));
if(v>0)r.setAttribute('data-a11y-'+k,String(Math.min(v,3)));});
}catch(e){}})();`;
