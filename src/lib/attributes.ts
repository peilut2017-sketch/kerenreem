import type { AttributeWithValues } from '@/lib/supabase/types';

/**
 * [1.26/1.32] שמות מאפיינים שמוסתרים בכל מקום שבו נטענים מאפיינים —
 * גם בטופס הניהול וגם בסינון הציבורי — כדי שהחריגה תישאר במקום אחד ולא
 * תלך ותשתכח בכל צרכן חדש. "כריכה" כפולה את שדה binding החופשי (ט.26);
 * "פורמט" ו"קהל יעד" אינם רלוונטיים לחנות (ט.32) — המנהל ביקש להסיר
 * אותם, אך אין כאן גישה למסד חי כדי למחוק את השורות עצמן, ולכן ההסתרה
 * כאן היא בפועל ה"הסרה" היחידה הזמינה.
 */
const HIDDEN_ATTRIBUTE_NAMES = new Set(['כריכה', 'פורמט', 'קהל יעד']);

export function filterVisibleAttributes(attributes: AttributeWithValues[]): AttributeWithValues[] {
  return attributes.filter((attribute) => !HIDDEN_ATTRIBUTE_NAMES.has(attribute.name_he.trim()));
}
