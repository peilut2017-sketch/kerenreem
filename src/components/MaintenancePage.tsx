import { getTranslations } from 'next-intl/server';

/**
 * ‏[1.41] עמוד תחזוקה — כשמסד הנתונים אינו נגיש.
 *
 * הבעיה שהוא פותר: כל שליפה ב-lib/data.ts מחזירה ערך ריק כשהיא נכשלת,
 * וזו ההתנהגות הנכונה לתוכן בודד — קטלוג לא צריך להיעלם בגלל תקלת רשת
 * רגעית. אבל כשהמסד אינו נגיש בכלל, אותה התנהגות מפיקה משהו גרוע
 * מעמוד שגיאה: **אתר שנראה תקין** ומציג את ברירות המחדל שבקוד — שם,
 * פרטי קשר וקטלוג ריק — כלומר מידע שאינו נכון, בלי שהמבקר יודע זאת.
 *
 * עדיף להכריז. העמוד הזה אומר בפירוש שיש תקלה, למה אין תוכן, ומה לעשות.
 *
 * מוגש **בלי הכותרת והפוטר של האתר**, ובמכוון: שניהם נבנים מהגדרות
 * שמגיעות מאותו מסד שאינו נגיש — הלוגו, שם האתר, פרטי הקשר, תפריט
 * הניווט. כותרת שמוצגת מברירות מחדל היא בדיוק אותה הטעיה בקטן.
 *
 * העיצוב מוטבע ואינו תלוי במחלקות של האתר, מאותה סיבה שב-global-error:
 * זהו מסלול שצריך לעבוד גם כשמעט מאוד עובד.
 */
export async function MaintenancePage({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'error' });

  return (
    <main
      dir={locale === 'he' ? 'rtl' : 'ltr'}
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.25rem',
        backgroundColor: '#fbf9f5',
        color: '#14120e',
        fontFamily: 'var(--font-sans), system-ui, sans-serif',
        lineHeight: 1.8,
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '34rem' }}>
        <div
          aria-hidden="true"
          style={{
            width: '4rem',
            height: '4rem',
            margin: '0 auto',
            borderRadius: '999px',
            backgroundColor: '#f5f1ea',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#8a6820',
          }}
        >
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path
              d="M14.5 3.5a4.5 4.5 0 0 0-5.9 5.9L3.5 14.5a2 2 0 0 0 2.8 2.8l5.1-5.1a4.5 4.5 0 0 0 5.9-5.9l-2.4 2.4-2.8-2.8z"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <h1 style={{ marginTop: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>
          {t('maintenanceTitle')}
        </h1>
        <p style={{ marginTop: '1rem', color: '#423b30' }}>{t('maintenanceBody')}</p>
        <p style={{ marginTop: '1.5rem', fontSize: '0.875rem', color: '#6b6455' }}>
          {t('maintenanceContact')}
        </p>
      </div>
    </main>
  );
}
