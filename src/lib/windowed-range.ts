/**
 * חלון אינדקסים סביב "הנוכחי", בלי "מקומות ריקים" בקצוות הטווח — כשהחלון
 * המבוקש (רדיוס משני הצדדים) חורג מהתחלת/סוף הרשימה, הוא מצטמצם לצד השני
 * במקום פשוט להיחתך. [1.20]/[1.30] — משותף ל-Contextual Filmstrip
 * (גלריית מדיה) ולניווט ההקשרי בכותרת (שלבי אירוע/מקטעי ספר).
 */
export function computeWindow(current: number, total: number, radius: number): number[] {
  if (total <= radius * 2 + 1) return Array.from({ length: total }, (_, i) => i);
  let start = current - radius;
  let end = current + radius;
  if (start < 0) {
    end += -start;
    start = 0;
  } else if (end > total - 1) {
    start -= end - (total - 1);
    end = total - 1;
  }
  start = Math.max(0, start);
  end = Math.min(total - 1, end);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
