'use server';

import { headers } from 'next/headers';
import { createServiceClient } from '@/lib/supabase/service';
import { allowRequest, ipBucket } from './rate-limit';

/**
 * הרשמה לעדכון חזרה-למלאי (פרק 16.4): מייל בלבד, בלי חשבון. ‏unique
 * חלקי במסד ‎(book_id, email) where notified_at is null — הרשמה כפולה
 * היא no-op שקט. ההתראה נשלחת מ-notifyBackInStock שב-cron.
 */
export async function subscribeBackInStock(
  bookId: string,
  email: string,
): Promise<{ ok: boolean; error?: 'invalid_email' | 'rate_limited' | 'server' }> {
  const trimmed = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
    return { ok: false, error: 'invalid_email' };
  }
  const headerList = await headers();
  if (!(await allowRequest(ipBucket('back-in-stock', headerList), 10, 3600))) {
    return { ok: false, error: 'rate_limited' };
  }

  const service = createServiceClient();
  if (!service) return { ok: false, error: 'server' };

  const { error } = await service.from('back_in_stock_subscriptions').insert({
    book_id: bookId,
    email: trimmed,
    channel: 'email',
  });
  if (error && error.code !== '23505') {
    console.error('[commerce:back-in-stock]', error.message);
    return { ok: false, error: 'server' };
  }
  return { ok: true };
}
