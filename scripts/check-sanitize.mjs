/**
 * בדיקת המנקה של הטקסט העשיר.
 *
 * המנקה הוא רכיב אבטחה, ולכן הוא לא מוחלף בלי כיסוי. הבדיקה הזו נכתבה
 * כשהמנקה עבר מ-DOMPurify (שגרר jsdom) ל-sanitize-html, כדי לוודא שכל כלל
 * שהיה קיים נשמר — ובעיקר כדי לתפוס את מצב הכשל הגרוע ביותר: מנקה
 * שמחזיר את הקלט כפי שהוא בלי שגיאה.
 *
 * הרצה: node --experimental-strip-types scripts/check-sanitize.mjs
 */
import { sanitizeHtml, htmlToPlainText } from '../src/lib/sanitize.ts';

let failures = 0;

/** התוצאה חייבת להכיל את מה שמותר ולא להכיל את מה שאסור. */
function check(label, input, { has = [], hasNot = [] }) {
  const out = sanitizeHtml(input);
  const missing = has.filter((s) => !out.includes(s));
  const leaked = hasNot.filter((s) => out.includes(s));
  const ok = missing.length === 0 && leaked.length === 0;

  console.log(`${ok ? '✓' : '✗'} ${label}`);
  if (!ok) {
    failures += 1;
    if (leaked.length) console.log(`    דלף: ${leaked.join(', ')}`);
    if (missing.length) console.log(`    חסר: ${missing.join(', ')}`);
    console.log(`    פלט: ${out}`);
  }
}

/* --- הזרקת סקריפט --- */
check('תגית script מוסרת עם תוכנה', '<p>שלום<script>alert(1)</script></p>', {
  has: ['<p>שלום</p>'],
  hasNot: ['script', 'alert'],
});

check('script בכתיב מעורב מוסר', '<p>a</p><ScRiPt>alert(1)</ScRiPt>', {
  hasNot: ['alert', 'cRiPt'],
});

check('מטען onerror מוסר', '<img src="x" onerror="alert(1)">', {
  hasNot: ['onerror', 'alert'],
});

check('onclick מוסר', '<p onclick="alert(1)">a</p>', { hasNot: ['onclick', 'alert'] });

check('תכונת style מוסרת', '<p style="position:fixed;inset:0">a</p>', {
  hasNot: ['style', 'fixed'],
});

check('כתובת javascript: מוסרת', '<a href="javascript:alert(1)">קישור</a>', {
  hasNot: ['javascript', 'alert'],
});

check('כתובת data: בתמונה מוסרת', '<img src="data:text/html;base64,PHNjcmlwdD4=">', {
  hasNot: ['data:'],
});

check('תגיות טופס מוסרות', '<form action="/x"><input name="a"><button>שלח</button></form>', {
  hasNot: ['<form', '<input', '<button'],
});

check('object ו-embed מוסרים', '<object data="x"></object><embed src="y">', {
  hasNot: ['<object', '<embed'],
});

/* --- כתובות חסרות פרוטוקול --- */
check('כתובת חסרת פרוטוקול נחסמת', '<a href="//evil.example/x">a</a>', {
  hasNot: ['evil.example'],
});

/* --- iframe: רק מקורות מאושרים --- */
check('iframe של יוטיוב נשמר ומקבל כותרת', '<iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe>', {
  has: ['<iframe', 'youtube-nocookie.com/embed/abc', 'title="סרטון מוטמע"', 'loading="lazy"',
        'referrerpolicy="strict-origin-when-cross-origin"'],
});

check('כותרת שסופקה נשמרת', '<iframe src="https://player.vimeo.com/video/1" title="שיעור פתיחה"></iframe>', {
  has: ['title="שיעור פתיחה"'],
  hasNot: ['סרטון מוטמע'],
});

check('iframe ממקור לא מאושר מוסר', '<iframe src="https://evil.example/x"></iframe>', {
  hasNot: ['evil.example'],
});

check('iframe בלי src מוסר', '<iframe></iframe>', { hasNot: ['<iframe'] });

check('iframe עם כתובת יחסית מוסר', '<iframe src="/local"></iframe>', { hasNot: ['<iframe'] });

/* --- קישורים --- */
check('קישור חיצוני מקבל target ו-rel', '<a href="https://example.com">a</a>', {
  has: ['target="_blank"', 'rel="noopener noreferrer"'],
});

check('קישור פנימי אינו מקבל target', '<a href="/books">ספרים</a>', {
  has: ['href="/books"'],
  hasNot: ['target'],
});

check('mailto ו-tel מותרים', '<a href="mailto:a@b.c">דואר</a><a href="tel:+972">טלפון</a>', {
  has: ['mailto:a@b.c', 'tel:+972'],
});

/* --- תוכן תקין נשמר --- */
check('עיצוב טקסט נשמר', '<h2>כותרת</h2><p><strong>מודגש</strong> ו<em>נטוי</em></p><ul><li>א</li></ul>', {
  has: ['<h2>כותרת</h2>', '<strong>מודגש</strong>', '<em>נטוי</em>', '<li>א</li>'],
});

check('טבלה נשמרת עם colspan', '<table><tbody><tr><td colspan="2">א</td></tr></tbody></table>', {
  has: ['<table>', 'colspan="2"'],
});

check('עוטף היוטיוב של העורך נשמר', '<div data-youtube-video><iframe src="https://www.youtube.com/embed/x"></iframe></div>', {
  has: ['data-youtube-video', '<iframe'],
});

check('dir ו-lang נשמרים', '<p dir="ltr" lang="en">English</p>', {
  has: ['dir="ltr"', 'lang="en"'],
});

/* --- מצב הכשל הגרוע: מנקה שאינו מנקה --- */
const passthroughProbe = '<p>a<script>alert(1)</script></p>';
if (sanitizeHtml(passthroughProbe) === passthroughProbe) {
  console.log('✗ המנקה החזיר את הקלט ללא שינוי — הוא אינו פעיל כלל');
  failures += 1;
}

/* --- הגרסה הטקסטואלית --- */
const plain = htmlToPlainText('<p>שלום <strong>עולם</strong></p>');
if (plain !== 'שלום עולם') {
  console.log(`✗ htmlToPlainText החזיר "${plain}"`);
  failures += 1;
} else {
  console.log('✓ htmlToPlainText מסיר תגיות');
}

console.log(failures === 0 ? '\nהמנקה תקין.' : `\n${failures} בדיקות נכשלו.`);
process.exit(failures === 0 ? 0 : 1);
