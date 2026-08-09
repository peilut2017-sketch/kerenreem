import { requireScreenPermission } from '@/lib/admin/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminHeader } from '@/components/admin/AdminList';
import { ShippingManager } from '@/components/admin/orders/ShippingManager';
import { ShippingZonesManager } from '@/components/admin/orders/ShippingZonesManager';
import type { ShippingMethod, ShippingZone } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

/**
 * ניהול שיטות אספקה (פרק 11): מחיר, זמן אספקה בימי עסקים (מזין את
 * תאריך ההבטחה ללקוח), מגבלות משקל/סכום וסף חינם פר-שיטה. הוספת שיטה
 * היא שורת נתונים — המנוע כבר תומך בכל הסוגים.
 *
 * [1.6] אזורי משלוח (ט.16, ביקורת ג.28) — עד כה zone_id היה קיים במסד
 * בלי שום ממשק ניהול ובלי אכיפה בקופה. שני הרכיבים למטה + shipping.ts
 * הם ההשלמה: יצירה/עריכה של אזורים, שיוך שיטה לאזור, וסינון אמיתי
 * לפי עיר היעד ב-getAvailableMethods.
 */
export default async function AdminShippingPage() {
  await requireScreenPermission('shipping', 'view');
  const supabase = await createClient();
  const [methodsRes, zonesRes] = supabase
    ? await Promise.all([
        supabase.from('shipping_methods').select('*').order('sort_order'),
        supabase.from('shipping_zones').select('*').order('name'),
      ])
    : [{ data: [] }, { data: [] }];

  const zones = (zonesRes.data ?? []) as ShippingZone[];

  return (
    <>
      <AdminHeader
        title="שיטות אספקה"
        description="תאריך ההבטחה ללקוח = היום + ימי הכנה + ימי השיטה + מרווח ביטחון (בדילוג על שישי/שבת/חגים). מחירים כוללים מע״מ לפי הגדרת החנות."
      />
      <ShippingManager methods={(methodsRes.data ?? []) as ShippingMethod[]} zones={zones} />

      <h2 className="mt-10 mb-4 font-serif text-h3 text-ink">אזורי משלוח</h2>
      <p className="mb-4 text-small text-muted">
        שיוך שיטת משלוח לאזור מסנן אותה בקופה לפי עיר היעד — שיטה בלי אזור זמינה לכל עיר, כמו היום.
      </p>
      <ShippingZonesManager zones={zones} />
    </>
  );
}
