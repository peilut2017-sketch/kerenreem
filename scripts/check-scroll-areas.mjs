/**
 * מוודא שאף אזור גלילה לא נשאר מחוץ לשכבת הגלילה החלקה.
 *
 * עם Lenis (src/components/SmoothScroll.tsx) גלגלת העכבר שייכת לעמוד, אלא אם
 * האלמנט שמתחתיה מסומן data-lenis-prevent. אזור גלילה אנכי שנשכח הופך ל"תקוע":
 * הגלגלת מגלגלת את העמוד שמאחוריו ולא אותו. הבדיקה הזו נכשלת על:
 *
 *  1. אלמנט עם overflow-y/auto/scroll (Tailwind או מחלקת CSS) בלי
 *     data-lenis-prevent על אותו אלמנט. גלילה אופקית בלבד (overflow-x) פטורה:
 *     Lenis מתעלם מתנועה אופקית.
 *  2. קריאה ישירה לגלילת העמוד: scrollIntoView, window.scrollTo,
 *     document.body.style.overflow. הן עוברות דרך src/lib/smooth-scroll.ts.
 *  3. scroll-behavior: smooth על כל דבר חוץ מ-html:not(.lenis).
 *
 * חריג מכוון: ההערה smooth-scroll-ok בשורה או בשורה שלפניה, עם הסבר.
 *
 * הרצה: npm run check:scroll
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const HELPER = join(SRC, 'lib', 'smooth-scroll.ts');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(tsx?|css)$/.test(name)) out.push(full);
  }
  return out;
}

/** מחליף הערות ברווחים — שומר על אותם אופסטים ומספרי שורות. */
function blank(source, isCss) {
  const pattern = isCss ? /\/\*[\s\S]*?\*\//g : /\/\*[\s\S]*?\*\/|(^|[^:'"`])\/\/.*$/gm;
  return source.replace(pattern, (match, lead) => {
    const keep = typeof lead === 'string' ? lead : '';
    return keep + match.slice(keep.length).replace(/[^\n]/g, ' ');
  });
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/** הטקסט של תג הפתיחה שמכיל את האופסט הנתון, או null. */
function enclosingTag(text, index) {
  let start = index;
  while (start >= 0) {
    start = text.lastIndexOf('<', start - 1);
    if (start < 0) return null;
    if (/[A-Za-z]/.test(text[start + 1] ?? '')) break;
  }
  let depth = 0;
  let quote = null;
  for (let i = start + 1; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== '\\') quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch;
    else if (ch === '{') depth += 1;
    else if (ch === '}') depth -= 1;
    else if (ch === '>' && depth === 0 && text[i - 1] !== '=') {
      return i >= index ? text.slice(start, i + 1) : null;
    }
  }
  return null;
}

const failures = [];
const fail = (file, line, message) => failures.push(`${relative(ROOT, file)}:${line}  ${message}`);

const files = walk(SRC);
const sources = new Map(files.map((file) => [file, readFileSync(file, 'utf8')]));
const cleaned = new Map(files.map((file) => [file, blank(sources.get(file), file.endsWith('.css'))]));

const hasOk = (raw, index) => {
  const lines = raw.split('\n');
  const n = lineOf(raw, index);
  return /smooth-scroll-ok/.test(`${lines[n - 2] ?? ''}\n${lines[n - 1] ?? ''}`);
};
const hasPrevent = (tag) => /data-lenis-prevent(?!-(?:touch|horizontal))/.test(tag);

/* --- 1א. Tailwind: overflow אנכי או דו-כיווני --- */
const TAILWIND = /(?<![\w-])(?:[\w[\]:&>*()-]+:)*overflow-(?:y-)?(?:auto|scroll)(?![\w-])/g;
for (const file of files) {
  if (!file.endsWith('.tsx')) continue;
  const text = cleaned.get(file);
  for (const match of text.matchAll(TAILWIND)) {
    if (hasOk(sources.get(file), match.index)) continue;
    const tag = enclosingTag(text, match.index);
    if (tag === null) {
      fail(file, lineOf(text, match.index), `${match[0]} מחוץ לתג JSX — אי אפשר לוודא data-lenis-prevent, העבירו את המחלקה לתג`);
    } else if (!hasPrevent(tag)) {
      fail(file, lineOf(text, match.index), `${match[0]} בלי data-lenis-prevent על אותו אלמנט`);
    }
  }
}

/* --- 1ב. CSS: מחלקות עם overflow אנכי, ובדיקת כל שימוש בהן --- */
const cssClasses = new Map();
for (const file of files) {
  if (!file.endsWith('.css')) continue;
  const text = cleaned.get(file);
  for (const match of text.matchAll(/overflow(?:-y)?\s*:\s*(?:auto|scroll)\b/g)) {
    const open = text.lastIndexOf('{', match.index);
    const selector = text.slice(Math.max(text.lastIndexOf('}', open), text.lastIndexOf(';', open)) + 1, open);
    for (const cls of selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) {
      cssClasses.set(cls[1], `${relative(ROOT, file)}:${lineOf(text, match.index)}`);
    }
  }
}
for (const [cls, where] of cssClasses) {
  const usage = new RegExp(`(?<![\\w-])${cls.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?![\\w-])`, 'g');
  for (const file of files) {
    if (!file.endsWith('.tsx')) continue;
    const text = cleaned.get(file);
    for (const match of text.matchAll(usage)) {
      const tag = enclosingTag(text, match.index);
      if (tag && /class(Name)?\s*=/.test(tag) && !hasPrevent(tag)) {
        fail(file, lineOf(text, match.index), `.${cls} (overflow אנכי ב-${where}) בלי data-lenis-prevent`);
      }
    }
  }
}

/* --- 2. קריאות ישירות לגלילת העמוד --- */
const FORBIDDEN = [
  [/\.scrollIntoView\s*\(/g, 'scrollIntoView — השתמשו ב-scrollToElement מ-@/lib/smooth-scroll'],
  [/window\.scrollTo\s*\(/g, 'window.scrollTo — השתמשו ב-scrollToY / scrollToTop מ-@/lib/smooth-scroll'],
  [/document\.body\.style\.overflow/g, 'body.style.overflow — השתמשו ב-lockScroll מ-@/lib/smooth-scroll'],
];
for (const file of files) {
  if (file === HELPER || file.endsWith('.css')) continue;
  const text = cleaned.get(file);
  for (const [pattern, message] of FORBIDDEN) {
    for (const match of text.matchAll(pattern)) {
      if (hasOk(sources.get(file), match.index)) continue;
      fail(file, lineOf(text, match.index), message);
    }
  }
}

/* --- 3. scroll-behavior: smooth ברמת העמוד --- */
for (const file of files) {
  if (!file.endsWith('.css')) continue;
  const text = cleaned.get(file);
  for (const match of text.matchAll(/scroll-behavior\s*:\s*smooth/g)) {
    const open = text.lastIndexOf('{', match.index);
    const selector = text.slice(Math.max(text.lastIndexOf('}', open), text.lastIndexOf(';', open)) + 1, open).trim();
    if (selector !== 'html:not(.lenis)') {
      fail(file, lineOf(text, match.index), `scroll-behavior: smooth על "${selector}" — רק html:not(.lenis) מותר (Lenis מחליק בעצמו)`);
    }
  }
}

if (failures.length > 0) {
  console.error(`✗ נמצאו ${failures.length} אזורי גלילה או קריאות גלילה שלא עברו דרך השכבה האחידה:\n`);
  for (const line of failures) console.error('  ' + line);
  process.exit(1);
}
console.log('✓ כל אזורי הגלילה האנכיים מסומנים, וכל קריאות הגלילה עוברות דרך smooth-scroll.ts');
