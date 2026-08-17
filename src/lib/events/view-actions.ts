'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * [1.14] תיעוד צפיה בפריט מדיה בודד של אירוע — תמונה או וידאו, בין אם
 * מוצג בפריסה העריכתית (הסיפור), ב-Reels או ב-Viewer מלא-מסך. כל שלוש
 * התצוגות קוראות לפונקציה הזו כשפריט נכנס בפועל לתצוגת המבקר.
 *
 * best-effort במכוון (ראו recordPageView, אותו דפוס בדיוק): כשל בתיעוד
 * צפיה לא אמור להפריע לחוויית הצפיה עצמה. הדה-דופ מול צפיות חוזרות
 * (גלילה קדימה-אחורה על אותו פריט) נעשה בצד הלקוח, לא כאן — ראו
 * useMediaViewTracker ב-EventStoryGallery.tsx.
 */
export async function recordEventMediaView(mediaId: string): Promise<void> {
  try {
    const supabase = await createClient();
    if (!supabase) return;

    const { error } = await supabase.rpc('increment_event_media_view', { p_media_id: mediaId });
    if (error) console.error('[events:mediaView]', error.code, error.message);
  } catch (error) {
    console.error('[events:mediaView] חריגה לא צפויה', error);
  }
}
