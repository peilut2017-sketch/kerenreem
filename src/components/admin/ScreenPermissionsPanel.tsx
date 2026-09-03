'use client';

import { useMemo, useState, useTransition } from 'react';
import { saveScreenOverrides, clearScreenOverrides } from '@/lib/admin/team-actions';
import { SCREENS, ADMIN_ONLY_SCREENS, defaultScreenAccess, type ScreenKey } from '@/lib/admin/screens';
import type { UserRole } from '@/lib/supabase/types';
import { useRouter } from 'next/navigation';

const FAMILY_LABELS: Record<'content' | 'store' | 'system', string> = {
  content: 'תוכן',
  store: 'חנות',
  system: 'כללי',
};

type AccessMap = Record<ScreenKey, { view: boolean; edit: boolean }>;

/** מסכי הבחירה — שלושת מסכי המערכת (צוות/יומן ביקורת/אבחון) admin-בלבד קשיח, לא מוצגים כאן. */
const PICKABLE_SCREENS = SCREENS.filter((s) => !ADMIN_ONLY_SCREENS.has(s.key));

function accessMapFor(role: UserRole, overrides: Map<ScreenKey, { view: boolean; edit: boolean }>): AccessMap {
  const map = {} as AccessMap;
  for (const screen of PICKABLE_SCREENS) {
    map[screen.key] = overrides.get(screen.key) ?? defaultScreenAccess(role, screen.key);
  }
  return map;
}

/**
 * [1.7] "הרשאה מותאמת אישית" פר-משתמש/מסך — נפתח מתחת לשורת המשתמש
 * ב-TeamManager. כל תא מתחיל מברירת המחדל של ה-role (screens.ts) או
 * מ-override קיים; שמירה כותבת שורת override לכל 28 המסכים (לא רק מה
 * שהשתנה) — פשוט וחד-משמעי מחישוב הפרש. "איפוס" מוחק את כל שורות ה-
 * override של המשתמש וחוזר לברירת המחדל הרגילה של ה-role.
 */
export function ScreenPermissionsPanel({
  userId,
  role,
  hasCustom,
  overrides,
}: {
  userId: string;
  role: UserRole;
  hasCustom: boolean;
  overrides: Map<ScreenKey, { view: boolean; edit: boolean }>;
}) {
  const [access, setAccess] = useState<AccessMap>(() => accessMapFor(role, overrides));
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const byFamily = new Map<'content' | 'store' | 'system', typeof PICKABLE_SCREENS>();
    for (const screen of PICKABLE_SCREENS) {
      const list = byFamily.get(screen.family) ?? [];
      list.push(screen);
      byFamily.set(screen.family, list);
    }
    return byFamily;
  }, []);

  function toggle(screen: ScreenKey, mode: 'view' | 'edit') {
    setAccess((prev) => {
      const current = prev[screen];
      // עריכה מחייבת גם צפייה — אין טעם ל"עריכה בלי צפייה"
      const next = mode === 'view' ? { view: !current.view, edit: current.edit && !current.view } : { view: true, edit: !current.edit };
      return { ...prev, [screen]: next };
    });
  }

  function save() {
    startTransition(async () => {
      const rows = PICKABLE_SCREENS.map((s) => ({ screen: s.key, ...access[s.key] }));
      const result = await saveScreenOverrides(userId, rows);
      setNotice(result.ok ? 'נשמר.' : (result.error ?? 'שגיאה'));
      // בלי רענון סימון "(מותאם)" ולחצן האיפוס במסך הצוות נשארו במצב שלפני השמירה
      if (result.ok) router.refresh();
    });
  }

  function reset() {
    startTransition(async () => {
      const result = await clearScreenOverrides(userId);
      if (result.ok) {
        setAccess(accessMapFor(role, new Map()));
        setNotice('אופס לברירת המחדל של התפקיד.');
      } else {
        setNotice(result.error ?? 'שגיאה');
      }
    });
  }

  return (
    <div className="mt-3 rounded-[10px] border border-[var(--admin-border)] bg-cream-1 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-caption text-muted">
          {hasCustom
            ? 'למשתמש הזה הרשאה מותאמת אישית — חורגת מברירת המחדל של התפקיד שנבחר.'
            : 'מוצגת ברירת המחדל של התפקיד שנבחר. סימון/ביטול תא כאן יוצר הרשאה מותאמת אישית.'}
        </p>
        {hasCustom ? (
          <button type="button" onClick={reset} disabled={pending} className="text-caption text-burgundy hover:underline">
            איפוס לברירת מחדל
          </button>
        ) : null}
      </div>

      <div className="space-y-4">
        {(['content', 'store', 'system'] as const).map((family) => {
          const screens = grouped.get(family);
          if (!screens || screens.length === 0) return null;
          return (
            <div key={family}>
              <h4 className="mb-1.5 text-caption font-semibold text-ink">{FAMILY_LABELS[family]}</h4>
              <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {screens.map((screen) => (
                  <div key={screen.key} className="flex items-center justify-between gap-2 rounded-[8px] px-2 py-1.5 text-caption hover:bg-cream-2">
                    <span className="text-ink">{screen.label}</span>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={access[screen.key].view}
                          onChange={() => toggle(screen.key, 'view')}
                          className="h-3.5 w-3.5"
                        />
                        צפייה
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={access[screen.key].edit}
                          onChange={() => toggle(screen.key, 'edit')}
                          className="h-3.5 w-3.5"
                        />
                        עריכה
                      </label>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button type="button" onClick={save} disabled={pending} className="btn btn-solid">
          {pending ? 'שומר…' : 'שמירת הרשאות'}
        </button>
        {notice ? <span role="status" className="text-caption text-muted">{notice}</span> : null}
      </div>
    </div>
  );
}
