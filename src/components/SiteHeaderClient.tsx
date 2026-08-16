'use client';

import { useHeaderState } from './useHeaderState';
import { SiteHeaderHeightVar } from './SiteHeaderHeightVar';
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
  const { isFloating, headerRef } = useHeaderState();

  return (
    /* [1.11] המעבר בין הפס המלא לקפסולה הצפה רציף וצמוד-גלילה: כל
       המאפיינים נגזרים מ---hp שנכתב ישירות על האלמנט (useHeaderState),
       דרך המחלקות site-header-* ב-globals.css. ההחלקה הקצרה
       (site-header-smooth) מגשרת על צעדי גלגלת בדידים בלי לנתק את
       התחושה שהסרגל "נאסף" יחד עם הגלילה — כמו פתיחת אפליקציה. */
    <header ref={headerRef} className="site-header-shell site-header-smooth sticky top-0 z-50">
      <SiteHeaderHeightVar />

      {/* המשטח: מלא-רוחב ואטום למעלה, קפסולת זכוכית ממורכזת בגלילה */}
      <div className="site-header-surface site-header-smooth relative mx-auto w-full">
        {/* הזכוכית מונפשת ב-opacity בלבד — הנפשת backdrop-filter עצמו
            יקרה וקופצנית. מתחתיה משטח אטום בגוון זהב שדועך כלפי מטה, שנחוץ
            במצב היציב: עד סף הגלילה כבר נכנס תוכן מתחת לפס, ובלי אטימות
            הוא היה נראה דרכו.
            הדעיכה עצמה (גוון + צל רך) היא גם מה שמחליף את קו ההפרדה הישן:
            קו חד בתחתית הסרגל הוא שפה גרפית מיושנת; משטח שדועך לרקע העמוד
            נותן את אותה הפרדה בעדינות, בלי קו. */}
        <span
          aria-hidden="true"
          className="header-surface-tint site-header-tint site-header-smooth absolute inset-0 -z-10"
        />
        <span
          aria-hidden="true"
          className="glass site-header-glass site-header-smooth absolute inset-0 -z-10 rounded-[inherit]"
        />

        {/* התוכן: קפסולה צפה נשארת ממורכזת ומוגבלת ברוחב; הסרגל היציב
            פרוש לרוחב המסך המלא כדי שהלוגו יישב בקצה הפיזי (ימין בעברית)
            והפעולות בקצה הנגדי, ולא רק בקצה גוש התוכן הממורכז. */}
        <div className="site-header-content site-header-smooth mx-auto flex w-full items-center gap-4 sm:gap-6">
          <Wordmark
            logoUrl={logoUrl}
            name={siteName}
            tagline={tagline}
            compact={isFloating}
          />

          <NavLinks label={navLabel} items={navItems} compact={isFloating} />

          <div className="ms-auto flex items-center gap-1.5 sm:gap-2 lg:ms-0">
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
      </div>
    </header>
  );
}
