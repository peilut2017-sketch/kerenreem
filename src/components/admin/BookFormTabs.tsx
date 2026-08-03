'use client';

import { useState, type ReactNode } from 'react';
import { AdminIcon, type AdminIconName } from './AdminIcons';

export interface BookFormTab {
  id: string;
  label: string;
  icon: AdminIconName;
  hasError: boolean;
  content: ReactNode;
}

/**
 * לשוניות טופס הספר.
 *
 * כל הלשוניות נשארות ב-DOM תמיד — רק מוסתרות ב-CSS — כי שדה לא-מבוקר
 * (defaultValue) ששוחזר מה-DOM היה מאבד את הערך שהמשתמש הקליד ברגע
 * שהלשונית שמכילה אותו מתפרקת ונבנית מחדש. הבחירה מה מוצג היא ויזואלית
 * בלבד; השליחה תמיד כוללת את כל השדות משלוש הלשוניות גם יחד.
 *
 * מעבר ללשונית שגויה קורה תוך כדי רינדור ולא באפקט: זו "התאמת state
 * לפי props שהשתנו" (ראו react.dev/learn/you-might-not-need-an-effect) —
 * firstErrorTab משתנה רק אחרי שליחה כושלת חדשה, ומשווים אותו לעצמו
 * מהרינדור הקודם כדי לזהות בדיוק את הרגע הזה בלי אפקט נפרד.
 */
export function BookFormTabs({
  firstErrorTab,
  tabs,
}: {
  firstErrorTab?: string;
  tabs: BookFormTab[];
}) {
  const [activeTab, setActiveTab] = useState(firstErrorTab ?? tabs[0].id);
  const [seenErrorTab, setSeenErrorTab] = useState(firstErrorTab);

  if (firstErrorTab && firstErrorTab !== seenErrorTab) {
    setSeenErrorTab(firstErrorTab);
    setActiveTab(firstErrorTab);
  }

  return (
    <div>
      <div role="tablist" aria-label="קטעי טופס הספר" className="admin-nav-shell mb-8 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`book-form-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`book-form-panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`admin-nav-link ${activeTab === tab.id ? 'admin-nav-link-active' : ''}`}
          >
            <AdminIcon name={tab.icon} className="h-4 w-4" />
            {tab.label}
            {tab.hasError ? (
              <span
                aria-label="חסרה השלמה בלשונית זו"
                className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--admin-danger)]"
              />
            ) : null}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          id={`book-form-panel-${tab.id}`}
          role="tabpanel"
          aria-labelledby={`book-form-tab-${tab.id}`}
          tabIndex={0}
          className={activeTab === tab.id ? 'space-y-8' : 'hidden'}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}
