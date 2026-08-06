import { requireRole } from '@/lib/admin/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminHeader } from '@/components/admin/AdminList';
import { ShippingManager } from '@/components/admin/orders/ShippingManager';
import type { ShippingMethod } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

/**
 * ניהול שיטות אספקה (פרק 11): מחיר, זמן אספקה בימי עסקים (מזין את
 * תאריך ההבטחה ללקוח), מגבלות משקל/סכום וסף חינם פר-שיטה. הוספת שיטה
 * היא שורת נתונים — המנוע כבר תומך בכל הסוגים.
 */
export default async function AdminShippingPage() {
  await requireRole('admin');
  const supabase = await createClient();
  const { data } = supabase
    ? await supabase.from('shipping_methods').select('*').order('sort_order')
    : { data: [] };

  return (
    <>
      <AdminHeader
        title="שיטות אספקה"
        description="תאריך ההבטחה ללקוח = היום + ימי הכנה + ימי השיטה + מרווח ביטחון (בדילוג על שישי/שבת/חגים). מחירים כוללים מע״מ לפי הגדרת החנות."
      />
      <ShippingManager methods={(data ?? []) as ShippingMethod[]} />
    </>
  );
}
