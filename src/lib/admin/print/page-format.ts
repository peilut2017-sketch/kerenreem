export type PrintFormat = 'a4' | 'label';

/** [1.5] גודל עמוד inline per-דף — לא @page בשם מותאם (תמיכת דפדפן חלקית). */
export function pageAtRuleCss(format: PrintFormat): string {
  return format === 'label'
    ? '@page { size: 100mm 150mm; margin: 4mm; }'
    : '@page { size: A4; margin: 15mm; }';
}

export function readFormat(value: string | string[] | undefined): PrintFormat {
  return value === 'label' ? 'label' : 'a4';
}
