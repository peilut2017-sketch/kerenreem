/**
 * מחזיר את הערכים שנשלחו אל תוך טופס לא-מבוקר.
 *
 * React מאפס טופס כזה אחרי שפעולת שרת מסתיימת. כשהשמירה נכשלת על שדה אחד,
 * כל שאר השדות מתרוקנים — והמשתמש ממלא מחדש טופס שלם כדי לתקן תו אחד.
 * בטופס יצירת קשר ארוך זו הסיבה הישירה לנטישה.
 *
 * המימוש משותף לניהול ולאתר הציבורי כדי ששניהם לא יוכלו להיפרד זה מזה.
 */
export function restoreFormValues(form: HTMLFormElement, values: FormData): void {
  for (const element of Array.from(form.elements)) {
    const field = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    if (!field.name || field.type === 'file' || field.type === 'submit') continue;

    if (field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')) {
      // צ'ק־בוקס שלא סומן אינו נשלח כלל, ולכן היעדרו מה-FormData הוא המידע
      field.checked = values.getAll(field.name).includes(field.value || 'on');
      continue;
    }

    // select multiple: כל הבחירות משוחזרות, לא רק הראשונה — get מחזיר
    // ערך יחיד גם כשנשלחו כמה (coerce בצד השרת כבר קורא getAll במקביל).
    if (field instanceof HTMLSelectElement && field.multiple) {
      const selected = new Set(
        values.getAll(field.name).filter((entry): entry is string => typeof entry === 'string'),
      );
      for (const option of Array.from(field.options)) {
        option.selected = selected.has(option.value);
      }
      continue;
    }

    // שדות חוזרים באותו שם (RepeatableTextField): כל מופע מקבל את הערך
    // שנשלח במקומו הסידורי, לא כולם את הראשון.
    const all = values.getAll(field.name).filter((entry): entry is string => typeof entry === 'string');
    if (all.length === 0) continue;
    const sameName = Array.from(form.elements).filter(
      (el) => (el as HTMLInputElement).name === field.name,
    );
    const position = sameName.indexOf(field);
    const submitted = all[position] ?? all[0];
    field.value = submitted;
  }
}
