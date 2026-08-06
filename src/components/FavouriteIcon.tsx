/**
 * אייקון "הספרים שאהבתי" — ספר פתוח, לא לב (דרישת בעל האתר, סבב 1.1):
 * בקהל היעד לב מרגיש זר; ספר אומר בדיוק את מה שהרשימה היא — מדף אישי.
 * במצב פעיל הספר מתמלא; מקור יחיד לכל כפתורי המועדפים באתר.
 */
export function FavouriteIcon({
  active,
  className = 'h-4.5 w-4.5',
  animate = false,
}: {
  active: boolean;
  className?: string;
  /** הנפשת "נשמר" קצרה — רק בכפתורי הכרטיסים */
  animate?: boolean;
}) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path
        d="M10 5.4C8.55 4.15 6.4 3.55 3.8 3.75v11.7c2.6-.2 4.75.4 6.2 1.7 1.45-1.3 3.6-1.9 6.2-1.7V3.75c-2.6-.2-4.75.4-6.2 1.65Z"
        fill={active ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        className={active && animate ? 'origin-center animate-[fav_320ms_var(--ease-spring)]' : ''}
      />
      <path
        d="M10 5.4v11.5"
        stroke={active ? 'var(--color-cream, #faf6ec)' : 'currentColor'}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
