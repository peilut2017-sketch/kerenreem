import { requireRole } from '@/lib/admin/auth';
import { AdminHeader } from '@/components/admin/AdminList';
import { listInventory } from '@/lib/admin/commerce-queries';
import { getStoreSettings } from '@/lib/commerce/settings';
import { InventoryTable } from '@/components/admin/orders/InventoryTable';

export const dynamic = 'force-dynamic';

/**
 * מסך המלאי (פרק 10.7): מצב נוכחי, שמור וזמין לכל ספר, עם תנועה ידנית
 * מנומקת — לעולם לא כתיבה ישירה של מספר. ההיסטוריה המלאה ב-ledger.
 */
export default async function AdminInventoryPage() {
  await requireRole('editor');
  const [rows, settings] = await Promise.all([listInventory(), getStoreSettings()]);

  return (
    <>
      <AdminHeader
        title="מלאי"
        description="כל שינוי כמות הוא תנועה מתועדת: קליטה, החזרה, נזק, תיקון או ספירה. המלאי הזמין = פיזי פחות שמור להזמנות."
      />
      <InventoryTable rows={rows} defaultLowThreshold={settings.low_stock_threshold} />
    </>
  );
}
