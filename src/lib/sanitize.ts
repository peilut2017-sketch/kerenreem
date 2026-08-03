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
    'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'mark',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'iframe',
  ],

  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    iframe: [
      'src', 'title', 'width', 'height',
      'loading', 'referrerpolicy', 'allow', 'allowfullscreen', 'frameborder',
    ],
    div: ['data-youtube-video'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    // כיוון ושפה נחוצים בתוכן דו-לשוני, ומותרים בכל תגית. style מותר בכל
    // תגית גם כן, אבל allowedStyles למטה מצמצם אותו לשתי תכונות בלבד עם
    // ערכים קבועים מראש — ראו שם.
    '*': ['dir', 'lang', 'style'],
  },

  /**
   * style מותר, אבל לא כל CSS: allowedStyles מסנן תכונה-תכונה, וכל מה
   * שלא תואם בדיוק לביטוי הרגולרי נופל — לא רק "חשוד" נופל, אלא כל דבר
   * שאינו בדיוק אחת האפשרויות המפורשות. text-align משרת את כפתור היישור
   * בעורך; font-family מוגבל בכוונה למשתני ה-CSS של הגופנים שהאתר טוען
   * בפועל (ראו lib/fonts.ts) — לא לשם גופן חופשי, שהיה מאפשר להזריק כל
   * מחרוזת (כולל ניסיון escape מתוחכם) לתוך CSS שמוגש לדפדפן של מבקר אחר.
   */
  allowedStyles: {
    '*': {
      'text-align': [/^(?:left|right|center|justify)$/],
      'font-family': [
        /^var\(--font-(?:assistant|frank|heebo|rubik|noto-hebrew|david-libre|secular-one|alef)\)$/,
      ],
    },
  },

  // onerror, onload, onclick וכל שאר מאזיני האירועים אינם ברשימת
  // התכונות המותרות ולכן נופלים תמיד — ללא תלות ב-style. script מאבד
  // גם הוא את תוכנו, כי אינו ברשימת allowedTags.
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
