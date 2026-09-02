'use client';

import { useEffect } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  applySitePreference,
  readSitePreferences,
  resetSitePreferences,
  type SiteA11yToggle,
} from '@/lib/a11y-preferences';

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
    let escapeCleanup: (() => void) | null = null;

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
        // ︎ (variation selector-15) מבקש מהגופן הצגת טקסט חד-צבעית
        // במקום אמוג'י צבעוני מלא — בלעדיה ♿ מגיע עם "תג" כחול משלו,
        // שמתנגש עם הרקע הכהה של הכפתור (ראו העיצוב למטה).
        icon: { useEmojis: true, tabIndex: 0, imgElem: { type: '#text', text: '♿︎' } },
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
              // localePrefix הוא 'as-needed': עברית בלי קידומת. הצורה
              // הישנה /he/accessibility עבדה רק דרך redirect של ה-proxy.
              window.location.href = locale === 'he' ? '/accessibility' : `/${locale}/accessibility`;
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

      // כפתור ה-Reset של החבילה (resetAll) מאפס רק את המודולים שלה ואינו
      // יודע על ה-customFunctions שלנו — כך שאיפוס השאיר את הניגודיות
      // והגופן הקריא דלוקים. מחברים כאן איפוס של העדפות האתר לאותו כפתור.
      const resetBtn = document.querySelector('._menu-reset-btn');
      resetBtn?.addEventListener('click', resetSitePreferences);

      // Escape לסגירת התפריט — לחבילה אין טיפול במקש הזה כלל, כך שתפריט
      // פתוח נסגר רק בלחיצה על ה-X. הוספה כאן: כשהתפריט פתוח, Escape
      // לוחץ על כפתור הסגירה ומחזיר מיקוד לכפתור הפתיחה, כמצופה מדיאלוג.
      const onEscape = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        const menu = document.querySelector('._access-menu');
        if (!menu || menu.classList.contains('close')) return;
        menu
          .querySelector('._menu-close-btn')
          ?.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
        (document.querySelector('._access-icon') as HTMLElement | null)?.focus();
      };
      document.addEventListener('keydown', onEscape);
      escapeCleanup = () => document.removeEventListener('keydown', onEscape);

      // החבילה מזריקה <i tabIndex="0"> בלי role או aria-label — כלומר
      // כפתור הפתיחה לא נקרא כלחצן בקורא מסך, ורק ה-title (מקש הקיצור)
      // מזהה אותו. a11y.open קיים בתרגומים בדיוק לשם כך.
      const icon = document.querySelector('._access-icon');
      icon?.setAttribute('role', 'button');
      icon?.setAttribute('aria-label', t('open'));

      // עיצוב: border-radius ורקע נקבעים כמשתני --_access-icon-* — הדרך
      // הנתמכת של החבילה עצמה, ובטוחה למינפייר (ראו ההערה על .glass
      // למעלה בקובץ הזה על !important שמתמזג עם הכלל הבסיסי). transform
      // ו-box-shadow הבסיסיים אין להם משתנה מקביל בחבילה (ה-skew מוצמד
      // ל-useEmojis:true), אז הם נקבעים ב-inline style ולא בדריסת
      // גיליון עיצוב, מאותה סיבה בדיוק.
      document.documentElement.style.setProperty('--_access-icon-border-radius', '50%');
      document.documentElement.style.setProperty('--_access-icon-bg', 'var(--color-navy)');

      // [1.38] טור אחד עם "דיווח על ספר" (ReportBookButton) ו"חזרה למעלה"
      // (BackToTop): אותו גודל בדיוק (2.75rem = h-11/w-11 שלהם), אותו צד
      // (start — ימין ב-RTL, שמאל ב-LTR) ואותו מרחק מהקצה (1rem = start-4),
      // ומתחתיהם ב-bottom 1rem. ברירות המחדל של החבילה (50px, ימין
      // פיזי, 50px מהתחתית) לא הותאמו אליהם, והטור נראה עקום. גודל
      // הסמל מוקטן יחסית לקופסה החדשה.
      const rtl = document.documentElement.dir === 'rtl';
      for (const [name, value] of [
        ['--_access-icon-width', '2.75rem'],
        ['--_access-icon-height', '2.75rem'],
        ['--_access-icon-bottom', '1rem'],
        [rtl ? '--_access-icon-right' : '--_access-icon-left', '1rem'],
        [rtl ? '--_access-icon-left' : '--_access-icon-right', 'unset'],
        ['--_access-icon-font', '1.5rem/2.75rem system-ui, sans-serif'],
      ] as const) {
        document.documentElement.style.setProperty(name, value);
      }

      if (icon instanceof HTMLElement) {
        icon.style.transform = 'none';
        icon.style.boxShadow = 'var(--shadow-float)';
        icon.style.transition = 'box-shadow .25s ease';

        const lift = () => {
          icon.style.boxShadow = 'var(--shadow-lift)';
        };
        const settle = () => {
          icon.style.boxShadow = 'var(--shadow-float)';
        };
        icon.addEventListener('pointerenter', lift);
        icon.addEventListener('pointerleave', settle);
        icon.addEventListener('focus', lift);
        icon.addEventListener('blur', settle);
      }
    });

    return () => {
      cancelled = true;
      escapeCleanup?.();
      // ניווט בצד הלקוח מרנדר את ה-layout מחדש; בלי destroy היו נערמים
      // כמה כפתורי נגישות זה על זה.
      try {
        instance?.destroy();
      } catch {
        /* החבילה כבר פורקה או שלא הספיקה להיטען */
      }
      for (const name of [
        '--_access-icon-border-radius',
        '--_access-icon-bg',
        '--_access-icon-width',
        '--_access-icon-height',
        '--_access-icon-bottom',
        '--_access-icon-right',
        '--_access-icon-left',
        '--_access-icon-font',
      ]) {
        document.documentElement.style.removeProperty(name);
      }
    };
  }, [locale, t]);

  return null;
}
