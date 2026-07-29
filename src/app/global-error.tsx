'use client';

/**
 * גבול השגיאה האחרון.
 *
 * שגיאה שנזרקת ב-root layout עצמו אינה נתפסת באף error.tsx של מסלול פנימי
 * — רק כאן. בלי הקובץ הזה בקשה כזו מסתיימת בלי גוף תשובה, והמבקר מקבל את
 * מסך השגיאה של הפלטפורמה במקום את האתר.
 *
 * הרכיב מחליף את ה-root layout ולכן חייב לספק html ו-body בעצמו, וגם
 * להסתדר בלי הגופנים והסגנונות שנטענים בו. לכן הסגנון כאן מוטבע ומינימלי.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="he" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          backgroundColor: '#faf7f2',
          color: '#1c1a17',
          fontFamily: 'system-ui, sans-serif',
          lineHeight: 1.7,
        }}
      >
        <main style={{ maxWidth: '34rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>
            אירעה שגיאה בטעינת האתר
          </h1>
          <p style={{ marginTop: '1rem', color: '#5b5348' }}>
            התקלה נרשמה. אנא רעננו את העמוד; אם היא חוזרת, שלחו את מזהה השגיאה.
          </p>

          {error.digest ? (
            <p style={{ marginTop: '1.5rem', fontFamily: 'ui-monospace, monospace' }} dir="ltr">
              {error.digest}
            </p>
          ) : null}

          <p style={{ marginTop: '2rem' }}>
            {/* טעינה מלאה במכוון: ברגע הזה ה-root layout עצמו נכשל, וניווט רך
                היה מנסה להמשיך מאותו עץ שבור במקום לבנות אותו מחדש. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ color: '#7b2d3b' }}>
              חזרה לדף הבית
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
