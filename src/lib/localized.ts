/**
 * בחירת השדה הלשוני הנכון מרשומה דו-לשונית.
 *
 * שדות _en יכולים להישאר ריקים בשלב א'. במקרה כזה נופלים חזרה לעברית
 * במקום להציג עמוד חסר — מבקר אנגלי יראה את השם העברי, וזה עדיף על כלום.
 */

type Localizable<Base extends string> = {
  [K in `${Base}_he` | `${Base}_en`]?: string | null;
};

export function localized<Base extends string>(
  record: Localizable<Base> | null | undefined,
  base: Base,
  locale: string,
): string {
  if (!record) return '';
  const fields = record as Record<string, string | null | undefined>;
  const preferred = fields[`${base}_${locale}`];
  if (preferred) return preferred;
  return fields[`${base}_he`] ?? '';
}

/** כמו localized, אבל מחזיר null כשאין ערך — לשדות רשות. */
export function localizedOrNull<Base extends string>(
  record: Localizable<Base> | null | undefined,
  base: Base,
  locale: string,
): string | null {
  const value = localized(record, base, locale);
  return value || null;
}
