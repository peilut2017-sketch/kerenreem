import { RichText } from '@/components/RichText';

/**
 * גוף התקציר בלבד. הכותרת והמסגרת מגיעות מהעמוד, כי התקציר יושב שם
 * בתוך כרטיס משותף עם מפרט המהדורה — כותרת משלו כאן הייתה כותרת שנייה
 * בתוך אותו כרטיס.
 */
export function SummaryCard({ html }: { html: string }) {
  return <RichText html={html} />;
}
