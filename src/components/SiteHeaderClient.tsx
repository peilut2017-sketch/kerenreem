'use client';

import { useHeaderState } from './useHeaderState';
import { SiteHeaderHeightVar } from './SiteHeaderHeightVar';
import { Wordmark } from './Wordmark';
import { NavLinks } from './NavLinks';
import { LocaleSwitch } from './LocaleSwitch';
import { SearchLauncher } from './SearchLauncher';
import { MobileNav } from './MobileNav';

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
}: {
  logoUrl: string | null;
  siteName: string;
  tagline: string;
  navLabel: string;
  navItems: NavItem[];
  openLabel: string;
  closeLabel: string;
  searchLabel: string;
}) {
  const { isFloating } = useHeaderState();

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
            יקרה וקופצנית. מתחתיה רקע אטום בצבע העמוד, שנחוץ במצב
            היציב: עד סף הגלילה כבר נכנס תוכן מתחת לפס, ובלי אטימות
            הוא היה נראה דרכו. */}
        <span
          aria-hidden="true"
          className={`absolute inset-0 -z-10 bg-cream transition-opacity duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none ${
            isFloating ? 'opacity-0' : 'opacity-100'
          }`}
        />
        <span
          aria-hidden="true"
          className={`glass absolute inset-0 -z-10 rounded-[inherit] transition-opacity duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none ${
            isFloating ? 'opacity-100' : 'opacity-0'
          }`}
        />
        {/* קו הפרדה דק במצב היציב בלבד — במצב הצף מסגרת הזכוכית
            כבר מגדירה את הקצה, ושני הקווים יחד נראים ככפילות. */}
        <span
          aria-hidden="true"
          className={`absolute inset-x-0 bottom-0 h-px bg-rule transition-opacity duration-[420ms] motion-reduce:transition-none ${
            isFloating ? 'opacity-0' : 'opacity-100'
          }`}
        />

        <div
          className={`mx-auto flex w-full max-w-[82rem] items-center gap-4 transition-[padding] duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none sm:gap-6 ${
            isFloating ? 'px-4 py-2.5 sm:px-6' : 'px-5 py-3.5 sm:px-8'
          }`}
        >
          <Wordmark
            logoUrl={logoUrl}
            name={siteName}
            tagline={tagline}
            compact={isFloating}
          />

          <NavLinks label={navLabel} items={navItems} compact={isFloating} />

          <div className="ms-auto flex items-center gap-3 lg:ms-0">
            <div className="hidden items-center gap-3 lg:flex">
              <SearchLauncher />
              <LocaleSwitch />
            </div>

            <MobileNav
              items={navItems}
              openLabel={openLabel}
              closeLabel={closeLabel}
              searchLabel={searchLabel}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
