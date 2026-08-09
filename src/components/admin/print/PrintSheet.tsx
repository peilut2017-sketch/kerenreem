import { pageAtRuleCss, type PrintFormat } from '@/lib/admin/print/page-format';

/**
 * [1.5] עטיפת עמוד הדפסה: קובעת @page (גודל+שוליים) inline לפי הפורמט,
 * ומציגה תצוגה מקדימה בגודל אמיתי על המסך. Server Component טהור —
 * אין כאן אינטראקטיביות, רק CSS.
 */
export function PrintSheet({
  format = 'a4',
  className = '',
  children,
}: {
  format?: PrintFormat;
  className?: string;
  children: React.ReactNode;
}) {
  const width = format === 'label' ? '100mm' : format === 'a6' ? '105mm' : '210mm';
  const padding = format === 'label' ? '4mm' : format === 'a6' ? '8mm' : '15mm';
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: pageAtRuleCss(format) }} />
      <div
        className={`print-sheet print-page ${className}`}
        style={{ width, minWidth: width, padding }}
      >
        {children}
      </div>
    </>
  );
}
