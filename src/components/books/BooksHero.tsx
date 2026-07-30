import Image from 'next/image';

/**
 * אזור הפתיחה של הקטלוג.
 *
 * נמוך במכוון — כ-320px. Hero גבוה בעמוד שכל תכליתו למצוא ספר דוחף את
 * התוצאות מתחת לקו הקיפול, ומכריח גלילה לפני הפעולה הראשונה.
 *
 * הרקע בנוי מכריכות אמיתיות מהקטלוג, מטושטשות ומוחלשות. אין כאן תמונת
 * מלאי: מה שנרמז ברקע הוא מה שבאמת נמצא בקטלוג. כשאין כריכות עדיין,
 * נשארת ההילה בלבד — ריק מכובד ולא מסגרת שבורה.
 */
export function BooksHero({
  title,
  subtitle,
  covers,
  children,
}: {
  title: string;
  subtitle: string;
  covers: string[];
  children: React.ReactNode;
}) {
  return (
    <section className="relative isolate mx-3 overflow-hidden rounded-[var(--radius-xl)] sm:mx-5">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-cream-2">
        {covers.length > 0 ? (
          <div className="absolute inset-0 flex items-center justify-center gap-8 opacity-55 blur-[40px]">
            {covers.map((src, index) => (
              <div key={`${src}-${index}`} className="relative h-64 w-44 shrink-0">
                <Image src={src} alt="" fill sizes="176px" className="object-cover" />
              </div>
            ))}
          </div>
        ) : null}

        {/* הילה רכה שמאחדת את הכריכות לרקע אחד ולא לשורת מלבנים.
            המרכז שקוף למחצה בלבד — כיסוי חזק מדי מוחק את הכריכות לגמרי
            ומשאיר שטח בז׳ ריק, וזו הייתה התוצאה בגרסה הראשונה. */}
        <div className="absolute inset-0 bg-[radial-gradient(130%_120%_at_50%_45%,color-mix(in_srgb,var(--color-cream)_55%,transparent)_0%,color-mix(in_srgb,var(--color-cream)_88%,transparent)_55%,var(--color-cream)_100%)]" />
      </div>

      <div className="px-5 py-14 text-center sm:px-8 lg:py-16">
        <h1 className="font-serif text-[clamp(1.75rem,4vw,2.5rem)] leading-tight text-ink">{title}</h1>
        <p className="mx-auto mt-3 max-w-[46ch] text-body text-muted">{subtitle}</p>

        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}
