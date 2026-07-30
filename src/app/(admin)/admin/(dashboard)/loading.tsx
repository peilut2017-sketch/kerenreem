/**
 * שלד טעינה למסכי הניהול.
 *
 * בלעדיו הדפדפן נשאר על המסך הקודם עד שהשרת מסיים — ניווט נראה כאילו
 * הלחיצה לא נקלטה, וזה בדיוק מה שגורם לתחושת האיטיות. עם השלד המעבר
 * מיידי, וזמן ההמתנה נעשה גלוי במקום להיראות כתקלה.
 *
 * aria-busy מודיע לקורא מסך שהאזור בטעינה; שאר השלד מוסתר ממנו, כי
 * מלבנים אפורים אינם מידע.
 */
export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">טוען…</span>

      <div aria-hidden="true" className="animate-pulse">
        <div className="mb-8 border-b border-rule pb-5">
          <div className="h-7 w-52 rounded-[var(--radius-sm)] bg-rule" />
          <div className="mt-2 h-4 w-80 max-w-full rounded-[var(--radius-sm)] bg-rule/60" />
        </div>

        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 border-b border-rule pb-3">
              <div className="h-4 flex-1 rounded-[var(--radius-sm)] bg-rule/70" />
              <div className="h-4 w-24 rounded-[var(--radius-sm)] bg-rule/50" />
              <div className="h-4 w-16 rounded-[var(--radius-sm)] bg-rule/50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
