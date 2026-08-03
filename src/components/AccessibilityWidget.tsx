'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { applySitePreference, readSitePreferences, type SiteA11yToggle } from '@/lib/a11y-preferences';

/**
 * סרגל הנגישות של האתר, מבוסס על החבילה הפתוחה accessibility (MIT).
 *
 * ⚠ הסרגל אינו תחליף לנגישות המבנית. ת"י 5568 נבחן על ה-HTML עצמו —
 * תוויות לשדות, מבנה כותרות, ניווט מקלדת, טקסט חלופי וניגודיות. הסרגל
 * הוא שכבת התאמה אישית מעל בסיס שכבר נגיש, וכך גם מנוסחת התקנה.
 *
 * שלוש החלטות הגדרה שאינן ברירת המחדל של החבילה:
 *
 * 1. useEmojis. ברירת המחדל טוענת את Material Icons מ-fonts.googleapis.com.
 *    ה-CSP של האתר חוסם מקור חיצוני כזה, ולכן האייקונים היו מוצגים כשמות
 *    הליגטורה ("zoom_in") במקום כסמלים. מעבר לכך, טעינת גופן מגוגל מוסרת
 *    את כתובת ה-IP של כל מבקר לצד שלישי — מיותר באתר של מכון.
 *
 * 2. speechToText כבוי. הוא דורש גישה למיקרופון, וכותרת Permissions-Policy
 *    של האתר חוסמת microphone לגמרי. כפתור שלא יכול לעבוד גרוע מכפתור
 *    שאינו קיים. הקראה (textToSpeech) נשארת — היא אינה דורשת הרשאה.
 *
 * 3. "ניגודיות גבוהה" ו"גופן קריא" מגיעים כ-customFunctions ולא מהחבילה.
 *    ה-invertColors שלה הוא filter: invert על כל העמוד, שהופך גם את
 *    הכריכות והצילומים לתשליל — שימושי לחלק מהמשתמשים, אבל אינו "ניגודיות
 *    גבוהה". לאתר יש מצב ניגודיות אמיתי הבנוי על דריסת משתני העיצוב
 *    (ראו html[data-a11y-contrast] ב-globals.css), והוא נשמר על הטקסט
 *    והרקעים בלבד. שניהם מוצגים בתפריט תחת שמות נפרדים, כך שהמשתמש בוחר.
 */
export function AccessibilityWidget() {
  const t = useTranslations('a11y');
  const locale = useLocale();

  useEffect(() => {
    let instance: { destroy: () => void } | null = null;
    let cancelled = false;

    // ייבוא דינמי: החבילה נוגעת ב-document כבר בבנייה, ואין לה מה לעשות
    // בצד השרת. כך היא גם אינה נכנסת ל-bundle הראשוני של העמוד.
    void import('accessibility').then(({ Accessibility }) => {
      if (cancelled) return;

      const toggleSite = (key: SiteA11yToggle) => () => {
        const current = readSitePreferences();
        applySitePreference(key, !current[key]);
      };

      instance = new Accessibility({
        // imgElem מפורש: ב-6.1.0 useEmojis לבדו לא מספיק לכפתור הפותח
        // עצמו — imgElem מחושב מברירת המחדל ("accessibility", שם
        // הליגטורה של Material Icons) לפני ש-fontFallback מחליף אותה
        // באמוג'י, כך שבלי הערך הזה הכפתור מציג את המילה "accessibility"
        // כטקסט גולמי במקום סמל.
        icon: { useEmojis: true, tabIndex: 0, imgElem: { type: '#text', text: '♿' } },
        session: { persistent: true },
        // מקשי הקיצור כבויים כברירת מחדל בחבילה. Ctrl+Alt+A לפתיחת התפריט
        // ושאר הצירופים הם תוספת ממשית למי שמנווט במקלדת, והכותרות
        // (helpTitles) מציגות אותם ליד כל פריט בתפריט.
        hotkeys: {
          enabled: true,
          helpTitles: true,
          keys: {
            toggleMenu: ['ctrlKey', 'altKey', 65],
            invertColors: ['ctrlKey', 'altKey', 73],
            grayHues: ['ctrlKey', 'altKey', 71],
            underlineLinks: ['ctrlKey', 'altKey', 85],
            bigCursor: ['ctrlKey', 'altKey', 67],
            readingGuide: ['ctrlKey', 'altKey', 82],
            textToSpeech: ['ctrlKey', 'altKey', 84],
            speechToText: ['ctrlKey', 'altKey', 83],
            disableAnimations: ['ctrlKey', 'altKey', 81],
          },
        },
        language: {
          textToSpeechLang: locale === 'he' ? 'he-IL' : 'en-GB',
          speechToTextLang: locale === 'he' ? 'he-IL' : 'en-GB',
        },
        // הערה: האפשרות statement מוגדרת בטיפוסים של החבילה אבל אינה
        // ממומשת ב-6.1.0 — _options.statement אינו נקרא בשום מקום בקוד
        // שלה. הקישור להצהרת הנגישות נדרש בתקנות, ולכן הוא מוזרק כאן
        // כ-customFunction במקום להסתמך עליה.
        modules: {
          increaseText: true,
          decreaseText: true,
          increaseTextSpacing: true,
          decreaseTextSpacing: true,
          increaseLineHeight: true,
          decreaseLineHeight: true,
          invertColors: true,
          grayHues: true,
          bigCursor: true,
          readingGuide: true,
          underlineLinks: true,
          textToSpeech: true,
          speechToText: false, // ראו החלטה 2 למעלה
          disableAnimations: true,
        },
        customFunctions: [
          {
            id: 'kr-contrast',
            buttonText: t('contrast'),
            emoji: '◐',
            toggle: true,
            method: toggleSite('contrast'),
          },
          {
            id: 'kr-font',
            buttonText: t('readableFont'),
            emoji: '🔤',
            toggle: true,
            method: toggleSite('font'),
          },
          {
            id: 'kr-statement',
            buttonText: t('statementLink'),
            emoji: '📄',
            toggle: false,
            method: () => {
              window.location.href = `/${locale}/accessibility`;
            },
          },
        ],
        labels: {
          menuTitle: t('toolbarTitle'),
          resetTitle: t('reset'),
          closeTitle: t('close'),
          increaseText: t('increaseText'),
          decreaseText: t('decreaseText'),
          increaseTextSpacing: t('increaseTextSpacing'),
          decreaseTextSpacing: t('decreaseTextSpacing'),
          increaseLineHeight: t('increaseLineHeight'),
          decreaseLineHeight: t('decreaseLineHeight'),
          invertColors: t('invertColors'),
          grayHues: t('grayHues'),
          bigCursor: t('bigCursor'),
          readingGuide: t('readingGuide'),
          underlineLinks: t('underlineLinks'),
          textToSpeech: t('textToSpeech'),
          speechToText: t('speechToText'),
          disableAnimations: t('stopMotion'),
          hotkeyPrefix: t('hotkeyPrefix'),
        },
      }) as unknown as { destroy: () => void };

      // החבילה מזריקה <i tabIndex="0"> בלי role או aria-label — כלומר
      // כפתור הפתיחה לא נקרא כלחצן בקורא מסך, ורק ה-title (מקש הקיצור)
      // מזהה אותו. a11y.open קיים בתרגומים בדיוק לשם כך.
      const icon = document.querySelector('._access-icon');
      icon?.setAttribute('role', 'button');
      icon?.setAttribute('aria-label', t('open'));
    });

    return () => {
      cancelled = true;
      // ניווט בצד הלקוח מרנדר את ה-layout מחדש; בלי destroy היו נערמים
      // כמה כפתורי נגישות זה על זה.
      try {
        instance?.destroy();
      } catch {
        /* החבילה כבר פורקה או שלא הספיקה להיטען */
      }
    };
  }, [locale, t]);

  return null;
}
