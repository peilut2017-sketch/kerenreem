import sanitizeHtmlLib, { type IOptions } from 'sanitize-html';

/**
 * ניקוי HTML שנוצר בעורך התוכן לפני הזרקתו לעמוד.
 *
 * העורך שמור מאחורי אימות, אבל זה לא מספיק: חשבון עורך שנפרץ, או תוכן
 * שהודבק ממקור חיצוני, יכולים להכניס סקריפט. כל טקסט עשיר עובר כאן —
 * אין נתיב עוקף.
 *
 * המנקה פועל על מנתח HTML (htmlparser2) ולא על DOM. הגרסה הקודמת השתמשה
 * ב-DOMPurify, שדורש DOM ולכן גרר את jsdom לתוך כל פונקציית שרת שנוגעת
 * בטקסט עשיר: 535 קבצים, 92MB זיכרון, וקריאה קרה של כשבע שניות. בסביבה
 * ללא שרת זה נטען מחדש בכל התחלה קרה, ולכן היה חלק ניכר מזמן התגובה.
 *
 * linkedom נבדק כתחליף קל ל-jsdom ונדחה: DOMPurify אינו מזהה אותו כסביבה
 * נתמכת, ואז הוא מחזיר את הקלט **כפי שהוא** בלי שגיאה. מנקה שמפסיק לנקות
 * בשקט גרוע מאין מנקה כלל.
 */

/** מקורות שמותר להטמיע מהם iframe. הרחבה כאן בלבד, במודע. */
const ALLOWED_IFRAME_HOSTS = [
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
  'player.vimeo.com',
];

const OPTIONS: IOptions = {
  allowedTags: [
    'p', 'br', 'hr', 'span', 'div',
    'h2', 'h3', 'h4',
    'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'iframe',
  ],

  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'width', 'height', 'loading'],
    iframe: [
      'src', 'title', 'width', 'height',
      'loading', 'referrerpolicy', 'allow', 'allowfullscreen', 'frameborder',
    ],
    div: ['data-youtube-video'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    // כיוון ושפה נחוצים בתוכן דו-לשוני, ומותרים בכל תגית
    '*': ['dir', 'lang'],
  },

  // אין צורך ברשימת איסור נפרדת: style, onerror, onload ו-onclick אינם
  // ברשימת המותרים ולכן נופלים. script ו-style גם מאבדים את תוכנם.
  allowedSchemes: ['https', 'http', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href', 'src'],

  // חוסם //evil.com. הביטוי הרגולרי הקודם התיר אותו בטעות: הוא אישר כל
  // כתובת שמתחילה ב-'/', וכתובת חסרת-פרוטוקול מתחילה בשתיים.
  allowProtocolRelative: false,

  allowedIframeHostnames: ALLOWED_IFRAME_HOSTS,
  allowIframeRelativeUrls: false,

  /**
   * iframe ממקור לא מאושר מאבד את ה-src אבל התגית עצמה נשארת — ואז נותר
   * בעמוד אלמנט אינטראקטיבי ריק, עם כותרת ובלי תוכן. כאן הוא מוסר לגמרי,
   * כפי שעשה ה-hook שקדם למנקה הזה.
   */
  exclusiveFilter: (frame) => frame.tag === 'iframe' && !frame.attribs.src,

  transformTags: {
    iframe: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        // נגישות: לכל iframe חייבת להיות כותרת נגישה. אם העורך לא סיפק
        // אחת, נכניס ברירת מחדל כדי שלא יישאר אלמנט אינטראקטיבי בלי שם.
        title: attribs.title || 'סרטון מוטמע',
        loading: 'lazy',
        referrerpolicy: 'strict-origin-when-cross-origin',
      },
    }),

    // קישורים חיצוניים נפתחים בלשונית חדשה — עם הגנה מפני tabnabbing.
    a: (tagName, attribs) =>
      /^https?:\/\//i.test(attribs.href ?? '')
        ? { tagName, attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' } }
        : { tagName, attribs },
  },
};

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtmlLib(html, OPTIONS);
}

/** גרסה טקסטואלית — לתקציר מטא ולחיפוש. */
export function htmlToPlainText(html: string | null | undefined, maxLength = 200): string {
  if (!html) return '';
  const text = html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).replace(/\s\S*$/, '')}…`;
}
