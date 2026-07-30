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

    const submitted = values.get(field.name);
    if (typeof submitted === 'string') field.value = submitted;
  }
}
