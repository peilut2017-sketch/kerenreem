import Link from 'next/link';
import { requireRole } from '@/lib/admin/auth';
import { getSettings, listBanners } from '@/lib/admin/queries';
import { AdminCell, AdminHeader, AdminRow, AdminTable } from '@/components/admin/AdminList';
import { RowActions } from '@/components/admin/RowActions';
import { BannersEnabledToggle } from '@/components/admin/BannersEnabledToggle';

export const dynamic = 'force-dynamic';

export default async function AdminBannersPage() {
  await requireRole('viewer');
  const [banners, settings] = await Promise.all([listBanners(), getSettings()]);
  const bannersEnabled = settings?.extra.banners_enabled !== false;

  return (
    <>
      <AdminHeader
        title="באנרים"
        description="הקרוסלה בראש עמוד הבית. מוצגים לפי סדר, רק מה שמסומן כמוצג ובתוך חלון התאריכים."
        action={{ href: '/admin/banners/new', label: 'באנר חדש' }}
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
                <img src={banner.image_url} alt="" className="h-10 w-20 border border-rule object-cover" />
              ) : (
                <span className="text-caption text-burgundy">חסרה תמונה</span>
              )}
            </AdminCell>
            <AdminCell className="text-muted">
              <span dir="ltr">{banner.link_url || '—'}</span>
            </AdminCell>
            <AdminCell className="tabular-nums text-muted">{banner.sort_order}</AdminCell>
            <AdminCell>
              <RowActions
                entity="banners"
                id={banner.id}
                label={banner.title_he}
                published={banner.is_published}
              />
            </AdminCell>
          </AdminRow>
        ))}
      </AdminTable>
    </>
  );
}
