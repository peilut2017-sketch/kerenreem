import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './config';

/**
 * לקוח מקושר-session, לשימוש ב-Server Components וב-Route Handlers.
 * כפוף ל-RLS: משתמש אנונימי רואה רק תוכן שפורסם.
 *
 * מחזיר null כשהסביבה אינה מוגדרת — הקוראים אמורים לטפל בכך.
 */
export async function createClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return null;

  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // קריאה מ-Server Component שאינו יכול לכתוב עוגיות — ה-middleware
          // כבר מרענן את ה-session, כך שאפשר להתעלם בבטחה.
        }
      },
    },
  });
}

/**
 * לקוח ללא session, לשימוש בשליפות סטטיות (generateStaticParams, ISR,
 * sitemap) שרצות מחוץ להקשר בקשה ולכן אין להן גישה לעוגיות.
 */
export function createStaticClient(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}
