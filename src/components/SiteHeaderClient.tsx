'use client';

import { usePathname } from '@/i18n/navigation';
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
 * ניווט משתלב-ב-Hero (Morphing Navigation).
 *
 * בראש עמוד עם Hero מלא (הבאנר בעמוד הבית, הצילום בעמוד הספרים) הניווט
 * מתחיל שקוף וללא קפסולה — חלק ממה שמתחתיו. אחרי גלילה קצרה (עם
 * hysteresis, ראו useHeaderState) הוא נסגר לקפסולת זכוכית צפה, בדיוק
 * כפי שהוא נראה תמיד בשאר העמודים.
 *
 * בעמודים בלי Hero מלא אין "מצב משולב" — הניווט תמיד בקפסולת הזכוכית,
 * בדיוק כמו לפני השדרוג הזה. רק שני העמודים עם Hero משנים מראה בגלילה.
 *
 * הרוחב הפנימי (max-w-[82rem]) קבוע בשני המצבים ותמיד ממורכז, כדי
 * שהתוכן יתיישר עם קצוות ה-Hero גם כשההיקף החיצוני "נוגע" בשולי המסך
 * במצב הפתוח. רק ה-padding החיצוני, שיוצר את המרווח מהקצה, משתנה.
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
  const pathname = usePathname();

  // "משולב ב-Hero": רק עמודים שבהם Hero מלא מתחיל בראש העמוד ממש.
  const integrated = pathname === '/' || pathname === '/books';
  const expanded = integrated && !isFloating;
  // הבאנר בעמוד הבית מועלה בניהול ואין דרך לדעת מראש אם הוא בהיר או
  // כהה (ראו BannerStrip.tsx) — לכן טקסט בהיר + מסך כהה, שעובד סביר על
  // רוב הצילומים. עמוד הספרים משתמש בצילום קבוע ובהיר (books-shelf.jpg)
  // שכבר ידוע, ולכן נשאר טקסט כהה רגיל.
  const onDark = expanded && pathname === '/';

  return (
    <header
      className={`sticky top-0 z-50 transition-[padding] duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none ${
        expanded ? 'px-0 pt-0' : 'px-3 pt-3 sm:px-5 sm:pt-5'
      }`}
    >
      <SiteHeaderHeightVar />
      <div
        className={`relative mx-auto flex w-full max-w-[82rem] items-center gap-4 overflow-hidden transition-[border-radius,padding] duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none sm:gap-6 ${
          expanded ? 'rounded-none px-4 py-3.5 sm:px-8 sm:py-5' : 'rounded-[var(--radius-xl)] px-4 py-2.5 sm:px-6'
        }`}
      >
        {/* שכבת הזכוכית: העוצמה (blur) קבועה תמיד, רק השקיפות מונפשת —
            הנפשת backdrop-filter עצמו יקרה וקופצנית. */}
        <span
          aria-hidden="true"
          className={`glass absolute inset-0 -z-10 transition-opacity duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none ${
            expanded ? 'opacity-0' : 'opacity-100'
          }`}
        />
        {/* מסך רך במצב הפתוח בלבד: מבטיח ניגודיות לטקסט הניווט בלי תלות
            בתוכן ה-Hero שמתחתיו — כהה על הבאנר, בהיר על צילום הספרים. */}
        {expanded ? (
          <span
            aria-hidden="true"
            className={`absolute inset-0 -z-10 ${
              onDark
                ? 'bg-gradient-to-b from-black/45 via-black/10 to-transparent'
                : 'bg-gradient-to-b from-white/70 via-white/25 to-transparent'
            }`}
          />
        ) : null}

        <Wordmark
          logoUrl={logoUrl}
          name={siteName}
          tagline={tagline}
          variant={onDark ? 'dark' : 'light'}
          compact={!expanded}
        />

        <NavLinks label={navLabel} items={navItems} onDark={onDark} compact={!expanded} />

        <div className="ms-auto flex items-center gap-3 lg:ms-0">
          <div className="hidden items-center gap-3 lg:flex">
            <SearchLauncher onDark={onDark} />
            <LocaleSwitch onDark={onDark} />
          </div>

          <MobileNav
            items={navItems}
            openLabel={openLabel}
            closeLabel={closeLabel}
            searchLabel={searchLabel}
            onDark={onDark}
          />
        </div>
      </div>
    </header>
  );
}
