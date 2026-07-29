import type { ReactNode } from 'react';

/**
 * רוחב הטקסט באתר. שתי מידות בלבד:
 * 'wide'  — רשתות ספרים, כותרות עמוד
 * 'text'  — טור קריאה רציף (כ-66 תווים), כמו בעמוד ספר
 */
export function Container({
  children,
  width = 'wide',
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode;
  width?: 'wide' | 'text';
  className?: string;
  as?: 'div' | 'section' | 'header' | 'footer' | 'article' | 'nav';
}) {
  const max = width === 'text' ? 'max-w-[46rem]' : 'max-w-[72rem]';
  return <Tag className={`mx-auto w-full ${max} px-5 sm:px-8 ${className}`}>{children}</Tag>;
}
