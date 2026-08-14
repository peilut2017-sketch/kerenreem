'use server';

import { revalidatePath } from 'next/cache';
import { assertPermission } from './auth';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * עלויות פנימיות (book_costs — מודל 3.18): קריאה וכתיבה בהרשאת עלויות
 * בלבד (מנהל-על/מנהל). העלות לעולם אינה נשלחת לצד לקוח; שינוי מתועד
 * ב-audit עם diff. הדוחות נשענים על הצילום בשורת ההזמנה, לא על הערך
 * הנוכחי — לכן עדכון כאן אינו משכתב היסטוריה.
 */

export interface CostActionResult {
  ok: boolean;
  error?: string;
  costPrice?: number | null;
}

// getBookCost הוסר — אף רכיב לא קרא לו: BookCostPanel מקבל את העלות
// מהשרת דרך book-form-data ושומר דרך saveBookCost בלבד.

export async function saveBookCost(bookId: string, costPrice: number | null): Promise<CostActionResult> {
  const session = await assertPermission('costs');
  if ('error' in session) return { ok: false, error: session.error };
  if (costPrice != null && !(costPrice >= 0)) return { ok: false, error: 'עלות לא תקינה' };

  const service = createServiceClient();
  if (!service) return { ok: false, error: 'אין חיבור למסד' };

  const { data: existing } = await service
    .from('book_costs')
    .select('cost_price')
    .eq('book_id', bookId)
    .maybeSingle();

  if (costPrice == null) {
    if (existing) await service.from('book_costs').delete().eq('book_id', bookId);
  } else {
    const { error } = await service.from('book_costs').upsert(
      { book_id: bookId, cost_price: costPrice, updated_by: session.userId },
      { onConflict: 'book_id' },
    );
    if (error) return { ok: false, error: error.message };
  }

  const supabase = await createClient();
  if (supabase) {
    await supabase.from('audit_log').insert({
      user_id: session.userId,
      action: 'cost_update',
      table_name: 'book_costs',
      record_id: bookId,
      old_values: { cost_price: existing ? Number(existing.cost_price) : null },
      new_values: { cost_price: costPrice },
      context: 'עדכון עלות ליחידה',
    });
  }

  revalidatePath(`/admin/books/${bookId}`);
  return { ok: true, costPrice };
}
