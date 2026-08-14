/**
 * הזרקת JSON-LD בטוחה לתגית <script>.
 *
 * JSON.stringify מבריח גרשיים ולוכסנים — אבל לא את '<'. שם ספר שמכיל
 * ‎</script><script>…‎ היה סוגר את התגית ומריץ סקריפט בדפדפן של כל מבקר
 * בעמוד (XSS מאוחסן, חוצה את גבול ההרשאות עורך→מנהל). ההחלפה ל-‎<‎
 * חוקית לחלוטין כ-JSON ומנטרלת את הסגירה; ‎ / ‎ מוברחים גם הם —
 * הם חוקיים ב-JSON אך שוברי-שורה ב-JavaScript.
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll(' ', '\\u2028')
    .replaceAll(' ', '\\u2029');
}
