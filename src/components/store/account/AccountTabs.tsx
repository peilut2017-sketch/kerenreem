'use client';

import { useState, type ReactNode } from 'react';

interface TabDef {
  key: string;
  label: string;
  content: ReactNode;
}

/**
 * [1.6] טאבים לאזור האישי (ט.2) — role="tab"/"tabpanel" נגיש, בכוונה בלי
 * ניווט חצים RTL-aware (Tab/Shift+Tab בין הכפתורים עצמם עדיין עובד; זו
 * פשטה מכוונת, לא כל ARIA Authoring Practice למקרה שימוש כה קטן).
 * תוכן כל טאב מגיע מוכן מרכיב שרת — הרכיב הזה רק מחליט מה גלוי.
 */
export function AccountTabs({ tabs, ariaLabel }: { tabs: TabDef[]; ariaLabel: string }) {
  const [active, setActive] = useState(tabs[0]?.key);

  return (
    <div className="mt-10">
      <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap gap-1.5 border-b border-rule">
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
