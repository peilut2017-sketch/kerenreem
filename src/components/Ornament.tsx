/**
 * עיטור הזהב: קו — מעוין — קו.
 *
 * לקוח משער של ספר מודפס. זהו הרכיב הדקורטיבי היחיד באתר, ולכן הוא
 * מופיע רק בפתיחת מקטע מרכזי — לא ליד כל כותרת.
 */
export function Ornament({ className = '' }: { className?: string }) {
  return (
    <div className={`ornament ${className}`} aria-hidden="true">
      <span className="ornament-diamond" />
    </div>
  );
}
