import { sanitizeHtml } from '@/lib/sanitize';

/**
 * רינדור טקסט עשיר מן העורך. כל HTML עובר sanitize לפני ההצגה —
 * ראו src/lib/sanitize.ts.
 */
export function RichText({ html, className = '' }: { html: string | null | undefined; className?: string }) {
  const clean = sanitizeHtml(html);
  if (!clean) return null;

  return <div className={`prose-reem ${className}`} dangerouslySetInnerHTML={{ __html: clean }} />;
}
