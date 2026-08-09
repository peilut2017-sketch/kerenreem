'use server';

import { cookies, headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getCommerceFlags } from './settings';
import { allowRequest, ipBucket } from './rate-limit';
import { getCustomerSession, ensureCustomerRecord } from './account';
import type { ShelfKey } from '@/lib/supabase/types';

/**
 * פעולות חשבון הלקוח. התחברות בלי סיסמאות (פרק 4.4): קישור חד-פעמי
 * למייל; OTP לטלפון יתווסף עם ספק ה-SMS (הנחה A12 — ראו account.ts).
 */

export interface AccountActionResult {
  ok: boolean;
  error?: 'invalid_email' | 'rate_limited' | 'disabled' | 'server';
}

export async function sendLoginLink(email: string): Promise<AccountActionResult> {
  const flags = await getCommerceFlags();
  if (!flags.accountsEnabled) return { ok: false, error: 'disabled' };

  const trimmed = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)) {
    return { ok: false, error: 'invalid_email' };
  }

  const headerList = await headers();
  if (!(await allowRequest(ipBucket('login-link', headerList), 5, 3600))) {
    return { ok: false, error: 'rate_limited' };
  }
  if (!(await allowRequest(`login-email:${trimmed.toLowerCase()}`, 3, 3600))) {
    return { ok: false, error: 'rate_limited' };
  }

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'server' };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? '';
  const { error } = await supabase.auth.signInWithOtp({
    email: trimmed,
    options: { emailRedirectTo: `${siteUrl}/api/auth/callback` },
  });
  if (error) {
    console.error('[commerce:account] login link', error.message);
    return { ok: false, error: 'server' };
  }
  return { ok: true };
}

/**
 * נקרא אחרי ההתחברות: יצירת רשומת לקוח + ‏Claim בטוח (idempotent).
 * claimToken — טוקן הזמנת המקור אם ה-Claim התחיל מקישור מעקב/עמוד תודה.
 * בהיעדרו, עוגן חלופי שווה-ערך: ה-checkout session של הדפדפן הזה (עוגיית
 * httpOnly שהונפקה בעת ההזמנה) — נקרא בצד השרת בלבד.
 */
export async function completeLogin(claimToken?: string | null): Promise<AccountActionResult> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, error: 'server' };

  const token = claimToken?.slice(0, 64) ?? null;
  if (!token) {
    // עוגן ה-checkout: אותה הוכחת-מקור כמו הטוקן, בלי לעבור דרך הלקוח
    const store = await cookies();
    const checkoutSessionId = store.get('kr-checkout')?.value ?? null;
    if (checkoutSessionId) {
      const service = createServiceClient();
      if (service) {
        const { data: checkoutSession } = await service
          .from('checkout_sessions')
          .select('order_id')
          .eq('id', checkoutSessionId)
          .maybeSingle();
        if (checkoutSession?.order_id) {
          // אין לנו את הטוקן הגולמי — משייכים את הזמנת המקור ישירות
          await ensureCustomerRecord(session, null);
          await claimOriginOrderById(session.userId, session.email, checkoutSession.order_id);
          return { ok: true };
        }
      }
    }
  }

  await ensureCustomerRecord(session, token);
  return { ok: true };
}

/** שיוך הזמנת מקור שהוכחה בעוגיית ה-checkout + הזמנות עבר בהתאמה כפולה. */
async function claimOriginOrderById(
  userId: string,
  verifiedEmail: string | null,
  orderId: string,
): Promise<void> {
  const service = createServiceClient();
  if (!service || !verifiedEmail) return;
  const { data: origin } = await service
    .from('orders')
    .select('id, contact_phone, contact_email, user_id')
    .eq('id', orderId)
    .maybeSingle();
  if (!origin || origin.user_id) return;

  await service.from('orders').update({ user_id: userId }).eq('id', origin.id).is('user_id', null);
  if (origin.contact_phone && origin.contact_email === verifiedEmail) {
    await service
      .from('orders')
      .update({ user_id: userId })
      .eq('contact_email', verifiedEmail)
      .eq('contact_phone', origin.contact_phone)
      .is('user_id', null);
  }
}

/**
 * מיזוג המועדפים והמדף המקומיים לחשבון (תרשים 3): איחוד — המקומי גובר
 * בהתנגשות מדף (הבחירה הטרייה), ושום דבר אינו נמחק.
 */
export async function mergeSavedBooks(input: {
  favourites: string[];
  shelf: Record<string, string>;
}): Promise<AccountActionResult> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, error: 'server' };

  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'server' };

  const validShelf = new Set(['wantToRead', 'wantToBuy', 'owned', 'wantAsGift']);
  const bookIds = new Set<string>([
    ...input.favourites,
    ...Object.keys(input.shelf).filter((id) => validShelf.has(input.shelf[id])),
  ]);

  for (const bookId of [...bookIds].slice(0, 500)) {
    const shelf = validShelf.has(input.shelf[bookId]) ? (input.shelf[bookId] as ShelfKey) : null;
    const isFavourite = input.favourites.includes(bookId);
    // upsert פר ספר: איחוד favourite ב-OR, המדף המקומי גובר כשקיים
    const { data: existing } = await supabase
      .from('saved_books')
      .select('is_favourite, shelf')
      .eq('customer_id', session.userId)
      .eq('book_id', bookId)
      .maybeSingle();
    const { error } = await supabase.from('saved_books').upsert(
      {
        customer_id: session.userId,
        book_id: bookId,
        is_favourite: isFavourite || (existing?.is_favourite ?? false),
        shelf: shelf ?? existing?.shelf ?? null,
      },
      { onConflict: 'customer_id,book_id' },
    );
    if (error && error.code !== '23503') {
      console.error('[commerce:account] merge saved', error.message);
    }
  }
  return { ok: true };
}

export async function updateMyDetails(input: {
  fullName: string;
  email: string;
  phone?: string;
}): Promise<AccountActionResult & { emailConfirmationSent?: boolean }> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, error: 'server' };
  const email = input.email.trim().slice(0, 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { ok: false, error: 'invalid_email' };
  }
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'server' };
  const patch: Record<string, string | null> = {
    full_name: input.fullName.trim().slice(0, 120) || null,
    email,
  };
  if (input.phone?.trim()) patch.phone = input.phone.trim().slice(0, 30);
  const { error } = await supabase.from('customers').update(patch).eq('id', session.userId);
  if (error) return { ok: false, error: 'server' };

  // מייל ההתחברות (auth) שונה ממייל הקשר? מפעילים את זרימת האימות של
  // Supabase — קישור אישור נשלח לכתובת החדשה; עד האישור מתחברים בישנה.
  let emailConfirmationSent = false;
  if (session.email && email.toLowerCase() !== session.email.toLowerCase()) {
    const { error: authError } = await supabase.auth.updateUser({ email });
    emailConfirmationSent = !authError;
    if (authError) console.error('[commerce:account] auth email change', authError.message);
  }
  return { ok: true, emailConfirmationSent };
}

/* ---------------------- [1.3] פנקס הכתובות (פרק 4.6) ---------------------- */

export interface AddressInput {
  label: string;
  recipientName: string;
  phone: string;
  city: string;
  street: string;
  houseNumber: string;
  entrance: string;
  floor: string;
  apartment: string;
  zip: string;
  isDefault: boolean;
}

export async function saveMyAddress(
  addressId: string | null,
  input: AddressInput,
): Promise<AccountActionResult> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, error: 'server' };
  if (!input.city.trim() || !input.street.trim() || !input.recipientName.trim()) {
    return { ok: false, error: 'server' };
  }
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'server' };

  const row = {
    customer_id: session.userId,
    label: input.label.trim().slice(0, 60) || null,
    recipient_name: input.recipientName.trim().slice(0, 120),
    phone: input.phone.trim().slice(0, 30) || null,
    city: input.city.trim().slice(0, 80),
    street: input.street.trim().slice(0, 120),
    house_number: input.houseNumber.trim().slice(0, 20),
    entrance: input.entrance.trim().slice(0, 20) || null,
    floor: input.floor.trim().slice(0, 20) || null,
    apartment: input.apartment.trim().slice(0, 20) || null,
    zip: input.zip.trim().slice(0, 12) || null,
    is_default: input.isDefault,
  };
  if (input.isDefault) {
    await supabase
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('customer_id', session.userId);
  }
  const { error } = addressId
    ? await supabase.from('customer_addresses').update(row).eq('id', addressId)
    : await supabase.from('customer_addresses').insert(row);
  if (error) {
    console.error('[commerce:account] address', error.message);
    return { ok: false, error: 'server' };
  }
  return { ok: true };
}

export async function deleteMyAddress(addressId: string): Promise<AccountActionResult> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, error: 'server' };
  const supabase = await createClient();
  if (!supabase) return { ok: false, error: 'server' };
  const { error } = await supabase.from('customer_addresses').delete().eq('id', addressId);
  if (error) return { ok: false, error: 'server' };
  return { ok: true };
}

/**
 * [1.3] מחיקת חשבון (פרק 4.8 / מודל 5.9): נתוני הפרופיל, הכתובות
 * והשמורים נמחקים; ההזמנות והמסמכים נשארים (חובת שמירה 7 שנים) —
 * ‏orders.user_id מתנתק אוטומטית (on delete set null). המשתמש מנותק.
 */
export async function deleteMyAccount(): Promise<AccountActionResult> {
  const session = await getCustomerSession();
  if (!session) return { ok: false, error: 'server' };
  const service = createServiceClient();
  if (!service) return { ok: false, error: 'server' };

  await service.from('saved_books').delete().eq('customer_id', session.userId);
  await service.from('customer_addresses').delete().eq('customer_id', session.userId);
  await service.from('customers').delete().eq('id', session.userId);
  await service.from('consent_events').insert({
    customer_id: null,
    email: session.email,
    phone: null,
    kind: 'terms',
    granted: false,
    source: 'account',
  });
  // מחיקת משתמש ה-Auth עצמו — ההזמנות כבר נותקו דרך ה-FK
  await service.auth.admin.deleteUser(session.userId).catch(() => undefined);

  const supabase = await createClient();
  await supabase?.auth.signOut();
  return { ok: true };
}

export async function signOutCustomer(): Promise<void> {
  const supabase = await createClient();
  await supabase?.auth.signOut();
}
