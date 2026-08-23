'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';

interface TabDef {
  key: string;
  label: string;
  content: ReactNode;
}

/**
 * [1.6] טאבים לאזור האישי (ט.2) — role="tab"/"tabpanel" נגיש, עם ניווט
 * חצים מלא לפי תבנית ה-ARIA Authoring Practices.
 *
 * ניווט החצים אינו קישוט: roving tabindex (tabIndex=-1 על הטאבים שאינם
 * נבחרים) מוציא אותם מסדר ה-Tab — בלעדיו טאבים 2–3 היו בלתי נגישים
 * למקלדת לחלוטין: לא ב-Tab (מוסרים מהסדר) ולא בחצים (לא היה מטפל).
 * ב-RTL חץ שמאלה מתקדם קדימה — הכיוון נגזר מ-document.dir בזמן ההקשה.
 *
 * הטאב הפעיל נשמר בכתובת (?tab=) — רענון, שיתוף קישור וכפתור "אחורה"
 * מחזירים לאותו טאב, וניווט לעמוד הזמנה וחזרה אינו מאפס את הבחירה.
 * תוכן כל טאב מגיע מוכן מרכיב שרת — הרכיב הזה רק מחליט מה גלוי.
 */
export function AccountTabs({ tabs, ariaLabel }: { tabs: TabDef[]; ariaLabel: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get('tab');
  const [active, setActive] = useState(
    () => (urlTab && tabs.some((tab) => tab.key === urlTab) ? urlTab : tabs[0]?.key),
  );

  // הכתובת מתעדכנת אחרי שהבחירה כבר הוחלה — replace בלי גלילה, כדי
  // שהחלפת טאב לא תקפיץ את העמוד ולא תמלא את ההיסטוריה.
  useEffect(() => {
    if (!active || active === tabs[0]?.key) {
      if (urlTab) router.replace(pathname, { scroll: false });
      return;
    }
    if (urlTab !== active) {
      router.replace(`${pathname}?tab=${active}`, { scroll: false });
    }
    // urlTab מכוון להיעדר: הוא הצילום שממנו יצאנו, לא טריגר לסנכרון חוזר
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, pathname, router]);

  function onKeyDown(event: React.KeyboardEvent) {
    const index = tabs.findIndex((tab) => tab.key === active);
    if (index < 0) return;
    // ב-RTL הטאב הבא יושב משמאל — חץ שמאלה מתקדם, חץ ימינה חוזר; ב-LTR להפך
    const rtl = document.dir === 'rtl';
    let next: number;
    if (event.key === 'ArrowRight') next = index + (rtl ? -1 : 1);
    else if (event.key === 'ArrowLeft') next = index + (rtl ? 1 : -1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    const target = tabs[(next + tabs.length) % tabs.length];
    setActive(target.key);
    document.getElementById(`account-tab-${target.key}`)?.focus();
  }

  return (
    <div className="mt-10">
      <div
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        className="flex flex-wrap gap-1.5 border-b border-rule"
      >
        {tabs.map((tab) => {
          const selected = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              id={`account-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`account-panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(tab.key)}
              className={`-mb-px rounded-t-[var(--radius-md)] border border-b-0 px-4 py-2.5 text-small font-semibold transition-colors ${
                selected
                  ? 'border-rule bg-cream text-burgundy'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.key}
          role="tabpanel"
          id={`account-panel-${tab.key}`}
          aria-labelledby={`account-tab-${tab.key}`}
          hidden={active !== tab.key}
          className="pt-6"
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
