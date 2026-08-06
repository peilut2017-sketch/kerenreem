'use client';

import { useState, useTransition } from 'react';
import { inviteStaffMember, revokeStaffAccess } from '@/lib/admin/team-actions';
import { ROLE_LABELS, ROLE_DESCRIPTIONS, ASSIGNABLE_ROLES } from '@/lib/admin/permissions';
import { RoleSelect } from './RoleSelect';
import { AdminIcon } from './AdminIcons';
import { AdminCell, AdminRow, AdminTable } from './AdminList';
import type { Profile, UserRole } from '@/lib/supabase/types';

/**
 * מסך ניהול הצוות (מסך 15 במפרט המסכים): הזמנה במייל + סיסמה ראשונית,
 * טבלת חברי הצוות עם שינוי תפקיד והסרת גישה. כשספק המייל אינו מוגדר,
 * הסיסמה הראשונית מוצגת פעם אחת למנהל — למסירה ידנית.
 */
export function TeamManager({
  profiles,
  currentUserId,
}: {
  profiles: Profile[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('seller');
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
      <div className="admin-card">
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
              <label htmlFor="invite-name" className="field-label">
                שם מלא
              </label>
              <input
                id="invite-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="field-input"
              />
            </div>
            <div>
              <label htmlFor="invite-email" className="field-label">
                כתובת מייל
              </label>
              <input
                id="invite-email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="field-input"
              />
            </div>
            <div className="sm:col-span-2">
              <span className="field-label">תפקיד</span>
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
              <button type="submit" disabled={pending} className="btn btn-solid">
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
                {new Intl.DateTimeFormat('he-IL', { dateStyle: 'medium' }).format(
                  new Date(profile.created_at),
                )}
              </AdminCell>
              <AdminCell className="text-end">
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
    </div>
  );
}
