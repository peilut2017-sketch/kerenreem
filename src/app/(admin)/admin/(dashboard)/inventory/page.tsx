import { requireScreenPermission } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { AdminHeader } from '@/components/admin/AdminList';
import { listInventory, listStockLocations } from '@/lib/admin/commerce-queries';
import { getStoreSettings } from '@/lib/commerce/settings';
import { InventoryTable } from '@/components/admin/orders/InventoryTable';

export const dynamic = 'force-dynamic';

/**
 * מסך המלאי הרב-מחסני (פרק 10.7 + הכרעה 9): מצב נוכחי, שמור וזמין לכל
 * ספר עם פירוט פר מיקום, תנועה ידנית מנומקת והעברות בין מחסנים —
 * לעולם לא כתיבה ישירה של מספר. ההיסטוריה המלאה ב-ledger.
 */
export default async function AdminInventoryPage() {
  const session = await requireScreenPermission('inventory', 'view');
  const [rows, locations, settings] = await Promise.all([
    listInventory(),
    listStockLocations(),
    getStoreSettings(),
  ]);

  return (
    <>
      <AdminHeader
        title="מלאי ומחסנים"
        description="כל שינוי כמות הוא תנועה מתועדת: קליטה, החזרה, נזק, תיקון, ספירה או העברה בין מיקומים. הזמין = פיזי פחות שמור להזמנות."
      />
      <InventoryTable
        rows={rows}
        locations={locations}
        defaultLowThreshold={settings.low_stock_threshold}
        canManageLocations={hasPermission(session.profile.role, 'finance')}
      />
    </>
  );
}
