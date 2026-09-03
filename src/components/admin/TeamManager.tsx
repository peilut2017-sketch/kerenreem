'use client';

import { useMemo, useState, useTransition } from 'react';
import { inviteStaffMember, revokeStaffAccess } from '@/lib/admin/team-actions';
import { ROLE_LABELS, ROLE_DESCRIPTIONS, ASSIGNABLE_ROLES } from '@/lib/admin/permissions';
import type { ScreenOverrideRow } from '@/lib/admin/queries';
import type { ScreenKey } from '@/lib/admin/screens';
import { RoleSelect } from './RoleSelect';
import { ScreenPermissionsPanel } from './ScreenPermissionsPanel';
import { AdminIcon } from './AdminIcons';
import { AdminCell, AdminRow, AdminTable } from './AdminList';
import type { Profile, UserRole } from '@/lib/supabase/types';

import { formatAdminDate } from '@/lib/admin/reporting/format';
/**
 * מסך ניהול הצוות (מסך 15 במפרט המסכים): הזמנה במייל + סיסמה ראשונית,
 * טבלת חברי הצוות עם שינוי תפקיד, הרשאה מותאמת אישית פר-מסך (מודל 1.7,
 * screens.ts) והסרת גישה. כשספק המייל אינו מוגדר, הסיסמה הראשונית מוצגת
 * פעם אחת למנהל — למסירה ידנית.
 */
export function TeamManager({
  profiles,
  currentUserId,
  overrides,
}: {
  profiles: Profile[];
  currentUserId: string;
  overrides: ScreenOverrideRow[];
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('seller');
  const [permissionsOpenFor, setPermissionsOpenFor] = useState<string | null>(null);

  const overridesByUser = useMemo(() => {
    const map = new Map<string, Map<ScreenKey, { view: boolean; edit: boolean }>>();
    for (const row of overrides) {
      const userMap = map.get(row.user_id) ?? new Map();
      userMap.set(row.screen_key as ScreenKey, { view: row.can_view, edit: row.can_edit });
      map.set(row.user_id, userMap);
    }
    return map;
  }, [overrides]);
  const [result, setResult] = useState<{
    kind: 'success' | 'error';
    message: string;
    password?: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  function submit() {
    startTransition(async () => {
      const response = await inviteStaffMember({ email, fullName, role });
      if (!response.ok) {
        setResult({ kind: 'error', message: response.error ?? 'שגיאה' });
        return;
      }
      setResult({
        kind: 'success',
        message: response.emailSent
          ? `נשלח מייל הזמנה אל ${email} עם פרטי הכניסה.`
          : `המשתמש נוצר. ספק המייל אינו מוגדר — מסרו את הסיסמה הראשונית באופן ידני:`,
        password: response.initialPassword,
      });
      setEmail('');
      setFullName('');
      setOpen(false);
    });
  }

  return (
    <div className="space-y-6">
      {/* הזמנת איש צוות */}
      <div className="admin-card px-5 py-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-3 text-start"
        >
          <span className="flex items-center gap-2.5 font-semibold text-ink">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]">
              <AdminIcon name="plus" className="h-4.5 w-4.5" />
            </span>
            הזמנת איש צוות חדש
          </span>
          <AdminIcon
            name="chevron-down"
            className={`h-4 w-4 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
            className="mt-5 grid gap-4 border-t border-[var(--admin-border)] pt-5 sm:grid-cols-2"
          >
            <div>
              <label htmlFor="invite-name" className="admin-field-label">
                שם מלא
              </label>
              <input
                id="invite-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="admin-field-input"
              />
            </div>
            <div>
              <label htmlFor="invite-email" className="admin-field-label">
                כתובת מייל
              </label>
              <input
                id="invite-email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="admin-field-input"
              />
            </div>
            <div className="sm:col-span-2">
              <span className="admin-field-label">תפקיד</span>
              <div className="mt-1 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ASSIGNABLE_ROLES.map((value) => (
                  <label
                    key={value}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-[10px] border px-3.5 py-3 transition-colors ${
                      role === value
                        ? 'border-[var(--admin-accent)] bg-[var(--admin-accent-soft)]'
                        : 'border-[var(--admin-border)] hover:border-[var(--admin-accent)]/40'
                    }`}
                  >
                    <input
                      type="radio"
                      name="invite-role"
                      value={value}
                      checked={role === value}
                      onChange={() => setRole(value)}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-small font-semibold text-ink">
                        {ROLE_LABELS[value]}
                      </span>
                      <span className="mt-0.5 block text-caption text-muted">
                        {ROLE_DESCRIPTIONS[value]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={pending} className="admin-btn admin-btn-solid">
                {pending ? 'יוצר…' : 'הזמנה ושליחת פרטי כניסה'}
              </button>
            </div>
          </form>
        ) : null}
      </div>

      {result ? (
        <div
          role={result.kind === 'error' ? 'alert' : 'status'}
          className={`admin-card ${result.kind === 'error' ? 'border-burgundy/40' : 'border-[var(--admin-accent)]/40'}`}
        >
          <p className="text-small text-ink">{result.message}</p>
          {result.password ? (
            <p
              dir="ltr"
              className="mt-3 rounded-[8px] bg-cream-2 px-4 py-3 text-center font-mono text-lead tracking-wider text-ink"
            >
              {result.password}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* חברי הצוות */}
      <AdminTable
        columns={['שם', 'תפקיד', 'הצטרפות', '']}
        empty={profiles.length === 0 ? 'אין חברי צוות.' : undefined}
      >
        {profiles.map((profile) => {
          const isSelf = profile.id === currentUserId;
          return (
            <AdminRow key={profile.id}>
              <AdminCell>
                <span className="font-medium text-ink">{profile.full_name || '—'}</span>
                {isSelf ? <span className="ms-2 text-caption text-muted">(אתה)</span> : null}
              </AdminCell>
              <AdminCell>
                <RoleSelect
                  userId={profile.id}
                  role={profile.role}
                  disabled={isSelf}
                  name={profile.full_name || 'משתמש'}
                />
              </AdminCell>
              <AdminCell className="text-small text-muted">
                {formatAdminDate(profile.created_at, 'medium')}
              </AdminCell>
              <AdminCell className="text-end">
                <button
                  type="button"
                  onClick={() => setPermissionsOpenFor((v) => (v === profile.id ? null : profile.id))}
                  aria-expanded={permissionsOpenFor === profile.id}
                  className="me-2 inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-caption text-muted transition-colors hover:bg-cream-2 hover:text-ink"
                >
                  <AdminIcon name="settings" className="h-3.5 w-3.5" />
                  הרשאות{overridesByUser.has(profile.id) ? ' (מותאם)' : ''}
                </button>
                {!isSelf ? (
                  confirmRevoke === profile.id ? (
                    <span className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const response = await revokeStaffAccess(profile.id);
                            if (!response.ok) {
                              setResult({ kind: 'error', message: response.error ?? 'שגיאה' });
                            }
                            setConfirmRevoke(null);
                          })
                        }
                        className="rounded-[8px] bg-burgundy px-3 py-1.5 text-caption font-semibold text-white hover:bg-burgundy/90"
                      >
                        אישור הסרה
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmRevoke(null)}
                        className="text-caption text-muted hover:text-ink"
                      >
                        ביטול
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmRevoke(profile.id)}
                      title="הסרת גישת צוות"
                      className="inline-flex items-center gap-1.5 rounded-[8px] px-2.5 py-1.5 text-caption text-muted transition-colors hover:bg-burgundy/10 hover:text-burgundy"
                    >
                      <AdminIcon name="trash" className="h-3.5 w-3.5" />
                      הסרה
                    </button>
                  )
                ) : null}
              </AdminCell>
            </AdminRow>
          );
        })}
      </AdminTable>

      {permissionsOpenFor
        ? (() => {
            const profile = profiles.find((p) => p.id === permissionsOpenFor);
            if (!profile) return null;
            return (
              <div className="admin-card px-5 py-4">
                <h3 className="mb-1 text-small font-bold text-ink">
                  הרשאות מותאמות אישית — {profile.full_name || 'משתמש'}
                </h3>
                <ScreenPermissionsPanel
                  userId={profile.id}
                  role={profile.role}
                  hasCustom={overridesByUser.has(profile.id)}
                  overrides={overridesByUser.get(profile.id) ?? new Map()}
                />
              </div>
            );
          })()
        : null}
    </div>
  );
}
