'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLinkStatus } from 'next/link';
import { Link, usePathname } from '@/i18n/navigation';

interface NavItem {
  href: string;
  label: string;
}

/**
 * ניווט ראשי עם סמן זכוכית נוזלית.
 *
 * הסמן הוא אלמנט אחד שנע בין הפריטים, ולא רקע נפרד לכל פריט. כך המעבר
 * נקרא כתנועה של אותו משטח ולא כהבהוב של שניים, וזה מה שנותן את התחושה
 * הנוזלית. הוא נח על העמוד הנוכחי, נע אל פריט שמצביעים עליו, וחוזר
 * כשהעכבר עוזב.
 *
 * המדידה נעשית מה-DOM ולא מחישוב רוחב טקסט: הגופן העברי, מצב הניגודיות
 * וגודל הגופן שהמשתמש בחר בסרגל הנגישות כולם משנים את הרוחב בפועל.
 */
export function NavLinks({
  items,
  label,
  compact = false,
}: {
  items: readonly NavItem[];
  label: string;
  /** מצב צף — מרווחים מכווצים מעט */
  compact?: boolean;
}) {
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const markerRef = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  // התאמה מדויקת או תחילית: /books תואם גם /books/my-book
  const activeIndex = items.findIndex(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  const target = hovered ?? (activeIndex >= 0 ? activeIndex : null);

  /**
   * המיקום נכתב ישירות ל-DOM ולא נשמר ב-state.
   *
   * מדידה ואז setState היא רינדור נוסף בכל תזוזת עכבר — בדיוק בזמן שבו
   * צריך להיות חלק. הסמן הוא סנכרון של React אל ה-DOM, וזה מה שנעשה כאן.
   */
  const measure = useCallback(() => {
    const marker = markerRef.current;
    if (!marker) return;

    const element = target === null ? null : itemRefs.current[target];
    if (!element) {
      marker.style.opacity = '0';
      return;
    }

    // offsetLeft נמדד תמיד מקצה שמאל של ה-offsetParent, בשני כיווני
    // הכתיבה. ה-ul הוא ה-offsetParent (הוא relative), ולכן הערך כבר יחסי
    // אליו ואין להחסיר ממנו דבר — החסרה נוספת הזיזה את הסמן שמאלה.
    //
    // מכאן גם שהעיגון חייב להיות left פיזי ולא start הלוגי: ב-RTL,
    // start-0 פירושו right:0, ואז כל פריט התחיל מקצהו הימני שלו ו"סטה"
    // ביחס לרוחבו — לכן הסטייה הייתה שונה לכל פריט ולא קבועה.
    marker.style.transform = `translateX(${element.offsetLeft}px)`;
    marker.style.width = `${element.offsetWidth}px`;
    marker.style.opacity = '1';
  }, [target]);

  useLayoutEffect(measure, [measure]);

  // גודל הגופן משתנה מסרגל הנגישות, וגם סיבוב מכשיר משנה את הפריסה
  useEffect(() => {
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <nav aria-label={label} className="mx-auto hidden lg:block">
      <ul
        ref={listRef}
        className={`relative flex items-center transition-[gap] duration-[420ms] ease-[var(--ease-spring)] motion-reduce:transition-none ${compact ? 'gap-0.5' : 'gap-1'}`}
        onMouseLeave={() => setHovered(null)}
      >
        {/* הסמן מוסתר מהנגישות: המצב כבר מוסר דרך aria-current על הקישור */}
        <span
          ref={markerRef}
          aria-hidden="true"
          style={{ opacity: 0 }}
          className="glass pointer-events-none absolute inset-y-0 left-0 rounded-[var(--radius-pill)] transition-[transform,width,opacity] duration-500 ease-[var(--ease-spring)] motion-reduce:transition-none"
        />

        {items.map((item, index) => (
          <li
            key={item.href}
            ref={(node) => {
              itemRefs.current[index] = node;
            }}
            onMouseEnter={() => setHovered(index)}
          >
            <Link
              href={item.href}
              aria-current={index === activeIndex ? 'page' : undefined}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              className={`relative z-10 block rounded-[var(--radius-pill)] transition-[color,padding,font-size] duration-300 ${
                compact ? 'px-3 py-1.5 text-small' : 'px-5 py-2.5 text-body'
              } ${
                index === activeIndex
                  ? 'font-semibold text-burgundy'
                  : `text-ink-soft hover:text-burgundy ${compact ? '' : 'font-medium'}`
              }`}
            >
              <NavLabel>{item.label}</NavLabel>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * מציג שהניווט בדרך.
 *
 * useLinkStatus מדווח על מעבר שהתחיל ועדיין לא הסתיים. בלעדיו לחיצה על
 * קישור לעמוד שנטען לאט נראית כאילו לא נקלטה, והמשתמש לוחץ שוב.
 */
function NavLabel({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();

  return (
    <span className="relative inline-flex items-center gap-1.5">
      {children}
      <span
        aria-hidden="true"
        className={`h-1 w-1 rounded-full bg-burgundy transition-opacity duration-200 ${
          pending ? 'animate-pulse opacity-100' : 'opacity-0'
        }`}
      />
    </span>
  );
}
