'use client';

import { useTranslations } from 'next-intl';
import { useHeaderState } from './useHeaderState';
import { SiteHeaderHeightVar } from './SiteHeaderHeightVar';
import { HeaderContextNav } from './HeaderContextNav';
import { HeaderContextNavMobile } from './HeaderContextNavMobile';
import { useHeaderContextNav } from './header-context-nav';
import { Wordmark } from './Wordmark';
import { NavLinks } from './NavLinks';
import { LocaleSwitch } from './LocaleSwitch';
import { SearchLauncher } from './SearchLauncher';
import { MobileNav } from './MobileNav';
import { CartIndicator } from './store/CartIndicator';
import { AccountIndicator, FavouritesIndicator } from './store/HeaderQuickLinks';

interface NavItem {
  href: string;
  label: string;
}

/**
 * הניווט: שורה יציבה לרוחב המסך בראש העמוד, קפסולת זכוכית צפה בגלילה.
 *
 * בראש כל עמוד הניווט הוא פס מלא מקצה לקצה, יושב יציב ואטום — לא משטח
 * מרחף. אחרי גלילה קצרה (hysteresis, ראו useHeaderState) הוא נאסף
 * לקפסולת הזכוכית הצפה שמלווה את הגלילה. אותה התנהגות בכל עמודי האתר,
 * כולל עמוד הספר: אין עמוד שמתחיל כבר במצב צף.
 *
 * הפס עצמו תמיד לרוחב המסך המלא, אבל תוכנו (לוגו, קישורים, פעולות)
 * מוגבל לאותו max-w של תוכן העמוד ומיושר אליו — כך שברוחב מסך גדול
 * הלוגו אינו נדבק לקצה הפיזי של הצג.
 *
 * שלוש שכבות בכוונה: מיקום (header), משטח (הרקע/הזכוכית/הפינות),
 * ותוכן. ההפרדה מאפשרת להנפיש רוחב ורקע בלי לגעת בפריסת התוכן.
 */
export function SiteHeaderClient({
  logoUrl,
  siteName,
  tagline,
  navLabel,
  navItems,
  openLabel,
  closeLabel,
  searchLabel,
  accountsEnabled = false,
}: {
  logoUrl: string | null;
  siteName: string;
  tagline: string;
  navLabel: string;
  navItems: NavItem[];
  openLabel: string;
  closeLabel: string;
  searchLabel: string;
  accountsEnabled?: boolean;
}) {
  const { isFloating } = useHeaderState();
  const contextNav = useHeaderContextNav();
  const t = useTranslations('books');

  return (
    <header
      className={`sticky top-0 z-50 transition-[padding] duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none ${
        isFloating ? 'px-3 pt-3 sm:px-5 sm:pt-5' : 'px-0 pt-0'
      }`}
    >
      <SiteHeaderHeightVar />

      {/* המשטח: מלא-רוחב ואטום למעלה, קפסולת זכוכית ממורכזת בגלילה */}
      <div
        className={`relative mx-auto w-full transition-[max-width,border-radius] duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none ${
          isFloating
            ? 'max-w-[82rem] rounded-[var(--radius-xl)]'
            : 'max-w-none rounded-none'
        }`}
      >
        {/* הזכוכית מונפשת ב-opacity בלבד — הנפשת backdrop-filter עצמו
            יקרה וקופצנית. מתחתיה משטח אטום בגוון זהב שדועך כלפי מטה, שנחוץ
            במצב היציב: עד סף הגלילה כבר נכנס תוכן מתחת לפס, ובלי אטימות
            הוא היה נראה דרכו.
            הדעיכה עצמה (גוון + צל רך) היא גם מה שמחליף את קו ההפרדה הישן:
            קו חד בתחתית הסרגל הוא שפה גרפית מיושנת; משטח שדועך לרקע העמוד
            נותן את אותה הפרדה בעדינות, בלי קו. */}
        <span
          aria-hidden="true"
          className={`header-surface-tint absolute inset-0 -z-10 transition-opacity duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none ${
            isFloating ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <span
          aria-hidden="true"
          className={`glass absolute inset-0 -z-10 rounded-[inherit] transition-opacity duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none ${
            isFloating ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* התוכן: קפסולה צפה נשארת ממורכזת ומוגבלת ברוחב; הסרגל היציב
            פרוש לרוחב המסך המלא כדי שהלוגו יישב בקצה הפיזי (ימין בעברית)
            והפעולות בקצה הנגדי, ולא רק בקצה גוש התוכן הממורכז. */}
        <div
          className={`mx-auto flex w-full items-center gap-4 transition-[padding,max-width] duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none sm:gap-6 ${
            isFloating
              ? 'max-w-[82rem] px-4 py-2.5 sm:px-6'
              : 'max-w-none px-5 py-5 sm:px-9 lg:px-12'
          }`}
        >
          <Wordmark
            logoUrl={logoUrl}
            name={siteName}
            tagline={tagline}
            compact={isFloating}
          />

          <NavLinks label={navLabel} items={navItems} compact={isFloating} />

          {/* [1.30] ניווט הקשרי (שלבי אירוע/מקטעי ספר) — מתווסף לקפסולה
              הצפה עצמה, לא כפס נפרד מתחתיה, ורק אחרי שהיא כבר קפסולה
              (isFloating): במצב היציב המלא-רוחב אין עדיין מקום בעל
              משמעות "בתוך הכותרת" להוסיף אליו ניווט משני. */}
          {isFloating && contextNav ? <HeaderContextNav {...contextNav} /> : null}

          <div className="ms-auto flex items-center gap-1.5 sm:gap-2 lg:ms-0">
            {/* [1.32] גרסה מצומצמת של פס הכריכה/כותרת/רכישה הישן של עמוד
                הספר (StickyNav) — רק מחיר וקריאה-לפעולה, ליד שאר פעולות
                המסחר (מועדפים/סל) ולא בתוך רצועת הניווט ההקשרי עצמה. */}
            {isFloating && contextNav?.identity?.price ? (
              <button
                type="button"
                onClick={contextNav.identity.onBuy}
                aria-label={`${contextNav.identity.title} — ${contextNav.identity.price}`}
                title={contextNav.identity.title}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-pill)] bg-navy px-3 text-caption text-cream transition-colors hover:bg-navy-2 sm:px-3.5"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5 shrink-0" fill="none">
                  <path
                    d="M5 7h10l-1 9H6L5 7Zm2 0V5.5a3 3 0 0 1 6 0V7"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {/* מוצג רק מ-sm ומעלה — במסך צר הכפתור מצטמצם לאייקון בלבד,
                    כמו שאר כפתורי הפעולה (מועדפים/סל) שלצדו. */}
                <span className="hidden sm:inline">{contextNav.identity.price}</span>
                <span className="sr-only"> — {t('goToPurchase')}</span>
              </button>
            ) : null}

            {/* הכניסות המהירות (1.1): ספר → "הספרים שאהבתי"; חשבון —
                רק כשהחשבונות פעילים; מונה הסל — רק כשהעגלה פעילה */}
            <FavouritesIndicator />
            {accountsEnabled ? <AccountIndicator /> : null}
            <CartIndicator />

            {/* חיפוש אחרון בסדר ה-DOM ולא ראשון: ב-RTL זה מה שממקם אותו
                בקצה השמאלי הקיצוני של הקבוצה, כפי שהתבקש — לא רק לצד
                מתג השפה. */}
            <div className="hidden items-center gap-2 lg:flex">
              <LocaleSwitch />
              <SearchLauncher />
            </div>

            <MobileNav
              items={navItems}
              openLabel={openLabel}
              closeLabel={closeLabel}
              searchLabel={searchLabel}
            />
          </div>
        </div>

        {/* [1.33] גרסת מובייל של הניווט ההקשרי — שורה שנייה בתוך אותה
            קפסולה, לא חלון מצומצם כמו בדסקטופ (HeaderContextNav מוסתר
            מתחת ל-lg): במסך צר גלילה אופקית ישירה, לא כפס נפרד שיושב
            מתחת לכותרת. */}
        {isFloating && contextNav && contextNav.items.length > 0 ? (
          <HeaderContextNavMobile {...contextNav} />
        ) : null}
      </div>
    </header>
  );
}
