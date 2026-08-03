import Link from 'next/link';
import { requireRole } from '@/lib/admin/auth';
import { getSettings, listProfiles } from '@/lib/admin/queries';
import { AdminCell, AdminHeader, AdminRow, AdminTable } from '@/components/admin/AdminList';
import { SettingsForm } from '@/components/admin/SettingsForm';
import { RoleSelect } from '@/components/admin/RoleSelect';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  const session = await requireRole('admin');
  const [settings, profiles] = await Promise.all([getSettings(), listProfiles()]);

  return (
    <>
      <AdminHeader title="הגדרות" description="זהות הארגון, פרטי קשר ורשתות. ניהול צוות למטה." />

      <p className="mb-8 text-caption text-muted">
        מחפשים את הפעלת החנות? היא עברה תחת{' '}
        <Link href="/admin/books/settings" className="link">
          ספרים ← הגדרות קטלוג וחנות
        </Link>
        , כי היא שייכת לקטלוג ולא לזהות הארגון.
      </p>

      {settings ? (
        <SettingsForm settings={settings} />
      ) : (
        <p className="text-muted">לא נמצאה שורת הגדרות. יש להריץ את סכימת ה-SQL.</p>
      )}

      <section className="mt-16" aria-labelledby="team-heading">
        <h2 id="team-heading" className="font-serif text-h3 text-ink">
          צוות
        </h2>
        <p className="mb-5 mt-1 text-small text-muted">
          משתמשים נוצרים דרך Supabase Auth (הזמנה או הרשמה). התפקיד נקבע כאן.
          מנהל אינו יכול לשנות את התפקיד של עצמו.
        </p>

        <AdminTable columns={['שם', 'תפקיד']} empty={profiles.length === 0 ? 'אין משתמשים.' : undefined}>
          {profiles.map((profile) => (
            <AdminRow key={profile.id}>
              <AdminCell>
                {profile.full_name || '—'}
                {profile.id === session.userId ? (
                  <span className="ms-2 text-caption text-muted">(אתה)</span>
                ) : null}
              </AdminCell>
              <AdminCell>
                <RoleSelect
                  userId={profile.id}
                  role={profile.role}
                  disabled={profile.id === session.userId}
                  name={profile.full_name || 'משתמש'}
                />
              </AdminCell>
            </AdminRow>
          ))}
        </AdminTable>
      </section>
    </>
  );
}
