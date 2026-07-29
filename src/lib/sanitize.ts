import DOMPurify from 'isomorphic-dompurify';

/**
 * ניקוי HTML שנוצר בעורך התוכן לפני הזרקתו לעמוד.
 *
 * העורך שמור מאחורי אימות, אבל זה לא מספיק: חשבון עורך שנפרץ, או תוכן
 * שהודבק ממקור חיצוני, יכולים להכניס סקריפט. כל טקסט עשיר עובר כאן —
 * אין נתיב עוקף.
 */

/** מקורות שמותר להטמיע מהם iframe. הרחבה כאן בלבד, במודע. */
const ALLOWED_IFRAME_HOSTS = [
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
  'player.vimeo.com',
];

let hooksRegistered = false;

function registerHooks() {
  if (hooksRegistered) return;
  hooksRegistered = true;

  DOMPurify.addHook('uponSanitizeElement', (node, data) => {
    if (data.tagName !== 'iframe') return;

    const element = node as unknown as Element;
    const src = element.getAttribute?.('src') ?? '';

    let allowed = false;
    try {
      const url = new URL(src, 'https://example.invalid');
      allowed = url.protocol === 'https:' && ALLOWED_IFRAME_HOSTS.includes(url.hostname);
    } catch {
      allowed = false;
    }

    if (!allowed) {
      element.remove?.();
      return;
    }

    // נגישות: לכל iframe חייבת להיות כותרת נגישה. אם העורך לא סיפק אחת,
    // נכניס ברירת מחדל כדי שלא יישאר אלמנט אינטראקטיבי בלי שם.
    if (!element.getAttribute?.('title')) {
      element.setAttribute?.('title', 'סרטון מוטמע');
    }
    element.setAttribute?.('loading', 'lazy');
    element.setAttribute?.('referrerpolicy', 'strict-origin-when-cross-origin');
  });

  // קישורים חיצוניים נפתחים בלשונית חדשה — עם הגנה מפני tabnabbing.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    const element = node as unknown as Element;
    if (element.tagName !== 'A') return;
    const href = element.getAttribute?.('href') ?? '';
    if (/^https?:\/\//i.test(href)) {
      element.setAttribute?.('target', '_blank');
      element.setAttribute?.('rel', 'noopener noreferrer');
    }
  });
}

const CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  ALLOWED_TAGS: [
    'p', 'br', 'hr', 'span', 'div',
    'h2', 'h3', 'h4',
    'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
    'ul', 'ol', 'li',
    'blockquote', 'pre', 'code',
    'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'iframe',
  ],
  ALLOWED_ATTR: [
    'href', 'target', 'rel', 'title',
    'src', 'alt', 'width', 'height', 'loading', 'referrerpolicy',
    'allow', 'allowfullscreen', 'frameborder',
    'colspan', 'rowspan',
    'dir', 'lang',
    'data-youtube-video',
  ],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|\/|#)/i,
  FORBID_TAGS: ['script', 'style', 'form', 'input', 'button', 'object', 'embed'],
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
};

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  registerHooks();
  return DOMPurify.sanitize(html, CONFIG) as unknown as string;
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
