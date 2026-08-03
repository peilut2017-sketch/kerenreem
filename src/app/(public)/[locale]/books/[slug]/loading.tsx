import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/Container';

/**
 * שלד טעינה שמחקה את מבנה עמוד הספר עצמו (כריכה, כותרת, תיאור, כפתור,
 * ואזור הסקירה) — לא Spinner גנרי במרכז המסך. מי שמחכה לטעינה רואה
 * כבר עכשיו איפה כל דבר יופיע.
 */
export default async function BookPageLoading() {
  const t = await getTranslations('books');

  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">{t('loading')}</span>

      <div aria-hidden="true" className="animate-pulse">
        <Container className="pt-6">
          <div className="h-4 w-40 rounded-[var(--radius-sm)] bg-rule/70" />
        </Container>

        <div className="mt-6 px-5 sm:px-8">
          <div className="mx-auto grid w-full max-w-[72rem] grid-cols-1 items-center gap-10 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-14">
            <div className="mx-auto aspect-3/4 w-full max-w-[19rem] rounded-[3px] bg-cream-3 lg:max-w-[21rem]" />

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

        <Container className="mt-20 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="h-64 rounded-[var(--radius-lg)] bg-cream-3" />
          <div className="h-64 rounded-[var(--radius-lg)] bg-cream-3" />
        </Container>
      </div>
    </div>
  );
}
