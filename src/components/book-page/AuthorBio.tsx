'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RichText } from '@/components/RichText';

/** גובה מקורב לשלוש שורות קריאה, ולתצוגה המורחבת — קצת יותר, לא הכול. */
const COLLAPSED_HEIGHT = '5.5rem';
const EXPANDED_HEIGHT = '20rem';

/**
 * ביוגרפיה מקוצרת בעמוד הספר.
 *
 * עמוד הספר אינו עמוד המחבר: מי שהגיע לכאן מחפש את הספר, והביוגרפיה
 * המלאה דוחקת את ספריו של המחבר מטה. לכן מוצגות כאן שלוש שורות, כפתור
 * מרחיב ל"עוד קצת", והמשך מלא בעמוד המחבר.
 *
 * הכפתור מופיע רק כשיש באמת מה להרחיב. את זה אי אפשר לדעת בשרת — מספר
 * השורות תלוי ברוחב המסך ובגופן — ולכן נמדד בלקוח. המדידה יושבת בתוך
 * callback של ResizeObserver ולא בגוף האפקט: ResizeObserver יורה פעם
 * אחת מיד עם ההתחלה, כך שהמדידה הראשונית מתקבלת בלי setState סינכרוני
 * באפקט (שגורר רינדור מדורג ומסומן כשגיאה ב-lint של הפרויקט).
 *
 * הטקסט המלא נשאר ב-DOM גם במצב מכווץ — הכיווץ הוא ויזואלי בלבד. זו
 * החלטה מכוונת: קורא מסך מקבל את הביוגרפיה במלואה, ומנוע חיפוש מאנדקס
 * אותה, בלי תלות בלחיצה על כפתור.
 */
export function AuthorBio({ html }: { html: string }) {
  const t = useTranslations('books');
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const regionId = useId();

  useEffect(() => {
    // לא למדוד בזמן שהתצוגה פתוחה: שם הגובה ממילא גדול, ומדידה הייתה
    // מכבה את הכפתור שמאפשר לסגור בחזרה. ביציאה מהמצב הפתוח המדידה
    // מתחדשת מעצמה, כי expanded נמצא בתלויות.
    if (expanded) return;

    const node = contentRef.current;
    if (!node) return;

    const observer = new ResizeObserver(() => {
      setOverflows(node.scrollHeight > node.clientHeight + 4);
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [expanded]);

  return (
    <div className="mt-4 max-w-prose">
      <div
        id={regionId}
        ref={contentRef}
        style={{ maxHeight: expanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT }}
        className={`overflow-hidden transition-[max-height] duration-500 ease-[var(--ease-soft)] motion-reduce:transition-none ${
          overflows
            ? '[mask-image:linear-gradient(to_bottom,#000_72%,transparent)]'
            : ''
        }`}
      >
        <RichText html={html} />
      </div>

      {overflows ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={regionId}
          className="mt-2 text-small font-semibold text-gold-deep underline underline-offset-4 transition-colors hover:text-burgundy"
        >
          {expanded ? t('authorBioCollapse') : t('authorBioExpand')}
        </button>
      ) : null}
    </div>
  );
}
