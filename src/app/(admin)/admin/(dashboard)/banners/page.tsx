import Link from 'next/link';
import { requireScreenPermission, screenAccess } from '@/lib/admin/auth';
import { getSettings, listBanners } from '@/lib/admin/queries';
import { AdminCell, AdminHeader, AdminRow, AdminTable } from '@/components/admin/AdminList';
import { RowActions } from '@/components/admin/RowActions';
import { BannersEnabledToggle } from '@/components/admin/BannersEnabledToggle';
import { toCdnUrl } from '@/lib/image-src';

export const dynamic = 'force-dynamic';

export default async function AdminBannersPage() {
  const session = await requireScreenPermission('banners', 'view');
  // לחצני יצירה/עריכה/מחיקה רק למי שרשאי לערוך — אחרת משתמש בצפייה בלבד
  // לחץ על כפתור נראה והוחזר לדשבורד עם denied=1 (כמו ב-/admin/books)
  const { edit: canEdit } = await screenAccess(session, 'banners');
  const [banners, settings] = await Promise.all([listBanners(), getSettings()]);
  // extra יכול להיות null בפועל גם שהעמודה במסד not null default '{}':
  // שורה ישנה יכולה עדיין להחזיק ערך null. גישה ישירה ל-extra.X בלי
  // הבדיקה הזו (ראו books/settings/page.tsx) קרסה את כל העמוד.
  const bannersEnabled = (settings?.extra ?? {}).banners_enabled !== false;

  return (
    <>
      <AdminHeader
        title="באנרים"
        description="הקרוסלה בראש עמוד הבית. מוצגים לפי סדר, רק מה שמסומן כמוצג ובתוך חלון התאריכים."
        action={canEdit ? { href: '/admin/banners/new', label: 'באנר חדש' } : undefined}
      />

      <div className="mb-6">
        <BannersEnabledToggle enabled={bannersEnabled} />
      </div>

      <AdminTable
        columns={['כותרת', 'תמונה', 'יעד', 'סדר', 'מצב ופעולות']}
        empty={
          banners.length === 0
            ? 'טרם נוספו באנרים. עד שיתווספו, הקרוסלה נבנית אוטומטית מספר, אירוע וציר פעילות שפורסמו.'
            : undefined
        }
      >
        {banners.map((banner) => (
          <AdminRow key={banner.id}>
            <AdminCell>
              <Link href={`/admin/banners/${banner.id}`} className="font-semibold hover:text-burgundy">
                {banner.title_he}
              </Link>
              {banner.subtitle_he ? (
                <span className="mt-0.5 block text-caption text-muted">{banner.subtitle_he}</span>
              ) : null}
            </AdminCell>
            <AdminCell>
              {banner.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element -- תצוגה מקדימה בממשק הניהול */
                <img src={toCdnUrl(banner.image_url)} alt="" className="h-10 w-20 border border-rule object-cover" />
              ) : (
                <span className="text-caption text-burgundy">חסרה תמונה</span>
              )}
            </AdminCell>
            <AdminCell className="text-muted">
              <span dir="ltr">{banner.link_url || '—'}</span>
            </AdminCell>
            <AdminCell className="tabular-nums text-muted">{banner.sort_order}</AdminCell>
            <AdminCell>
              {canEdit ? <RowActions
                entity="banners"
                id={banner.id}
                label={banner.title_he}
                published={banner.is_published}
              /> : null}
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>
    </>
  );
}
