export type PrintFormat = 'a4' | 'label' | 'a6';

/** [1.5] גודל עמוד inline per-דף — לא @page בשם מותאם (תמיכת דפדפן חלקית). */
export function pageAtRuleCss(format: PrintFormat): string {
  if (format === 'label') return '@page { size: 100mm 150mm; margin: 4mm; }';
  if (format === 'a6') return '@page { size: A6; margin: 8mm; }';
  return '@page { size: A4; margin: 15mm; }';
}

export function readFormat(value: string | string[] | undefined): PrintFormat {
  return value === 'label' ? 'label' : 'a4';
}
