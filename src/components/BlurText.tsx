import type { ElementType } from 'react';

/**
 * כותרת שנכנסת מילה אחר מילה, מטושטשת ומתבהרת (בהשראת BlurText של React Bits,
 * MIT + Commons Clause).
 *
 * שלוש סטיות מהרכיב המקורי, וכולן בכוונה:
 *  • הפיצול הוא למילים בלבד. פיצול לאותיות מנתק ניקוד מהאות שלו בעברית.
 *  • האנימציה היא CSS טהור (‎.blur-word ב-globals.css), לא motion עם
 *    initial={{opacity: 0}}. המקור מגיש את הטקסט נסתר ב-HTML מהשרת וממתין
 *    ל-JS כדי להציג אותו — בדיוק מה ש-Reveal נבנה כדי להימנע ממנו, וגם פגיעה
 *    בטעינה הנתפסת של כותרת H1. כאן הטקסט קיים ב-HTML, והרכיב אינו Client
 *    Component בכלל.
 *  • הרכיב מיועד לכותרות בראש העמוד, שנראות בטעינה. הוא לא מחכה לגלילה.
 *
 * הפחתת תנועה (מערכת או מתג הנגישות) מכווצת את האנימציה ל-0.001ms, והכותרת
 * מופיעה מיד.
 */
export function BlurText({
  text,
  as: Tag = 'span',
  className = '',
}: {
  text: string;
  as?: ElementType;
  className?: string;
}) {
  const words = text.split(/\s+/).filter(Boolean);

  return (
    <Tag className={className}>
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>
          <span className="blur-word" style={{ '--i': index } as React.CSSProperties}>
            {word}
          </span>
          {index < words.length - 1 ? ' ' : null}
        </span>
      ))}
    </Tag>
  );
}
