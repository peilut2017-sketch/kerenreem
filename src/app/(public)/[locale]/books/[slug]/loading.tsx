import { Container } from '@/components/Container';

/**
 * שלד טעינה שמחקה את מבנה עמוד הספר עצמו (כריכה, כותרת, תיאור, כפתור,
 * ואזור הסקירה) — לא Spinner גנרי במרכז המסך. מי שמחכה לטעינה רואה
 * כבר עכשיו איפה כל דבר יופיע.
 *
 * ⚠ בלי getTranslations — ראו האזהרה ב-[locale]/loading.tsx: קריאת
 * תרגום ב-loading מסמנת את כל העץ כדינמי ומכבה את ה-ISR של האתר.
 */
export default function BookPageLoading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">טוען… · Loading…</span>

      <div aria-hidden="true" className="animate-pulse">
        <Container className="pt-6">
          <div className="h-4 w-40 rounded-[var(--radius-sm)] bg-rule/70" />
        </Container>

        <div className="mt-5 px-4 sm:px-6 lg:px-10 xl:px-14">
          <div className="mx-auto grid w-full max-w-[92rem] grid-cols-1 items-center gap-12 rounded-[2rem] bg-cream-2/50 px-6 py-14 lg:grid-cols-[5fr_7fr] lg:gap-16 lg:rounded-[2.5rem] lg:px-16 lg:py-20">
            <div className="mx-auto aspect-4/5 w-full max-w-[29rem] rounded-[var(--radius-md)] bg-cream-3" />

            <div>
              <div className="mx-auto h-6 w-32 rounded-[var(--radius-pill)] bg-rule/60 lg:mx-0" />
              <div className="mx-auto mt-5 h-11 w-3/4 rounded-[var(--radius-sm)] bg-rule/80 lg:mx-0" />
              <div className="mx-auto mt-4 h-6 w-40 rounded-[var(--radius-sm)] bg-rule/60 lg:mx-0" />
              <div className="mx-auto mt-5 h-4 w-full max-w-lg rounded-[var(--radius-sm)] bg-rule/50 lg:mx-0" />
              <div className="mx-auto mt-2 h-4 w-2/3 max-w-lg rounded-[var(--radius-sm)] bg-rule/50 lg:mx-0" />
              <div className="mx-auto mt-8 h-12 w-56 rounded-[var(--radius-pill)] bg-rule/70 lg:mx-0" />
            </div>
          </div>
        </div>

        <Container className="mt-20 space-y-6">
          {/* אזור התקציר */}
          <div className="h-64 rounded-[var(--radius-lg)] bg-cream-3" />
          {/* אזור הדפדוף — רוחב מלא, כמו בעמוד עצמו */}
          <div className="aspect-16/10 rounded-[2rem] bg-cream-3" />
        </Container>
      </div>
    </div>
  );
}
