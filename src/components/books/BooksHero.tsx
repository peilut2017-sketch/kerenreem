import { Img as Image } from '@/components/Img';

/**
 * אזור הפתיחה של הקטלוג.
 *
 * מתחיל אחרי פס הניווט, עם מרווח — באותם מידות כמו הבאנר בעמוד הבית
 * (ראו BannerStrip.tsx), כדי ששני ראשי העמודים יתיישרו לאותם קצוות.
 *
 * הרקע הוא צילום קבוע של מדף ספרים (public/books-shelf.jpg), לא תמונת
 * מלאי גנרית — הוחלף כאן במקום התצוגה הקודמת שהרכיבה רקע מכריכות
 * מטושטשות מהקטלוג עצמו.
 */
export function BooksHero({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="group relative isolate mx-auto mt-5 w-[calc(100%-2.5rem)] max-w-[82rem] overflow-hidden rounded-[var(--radius-xl)] sm:mt-7 sm:w-[calc(100%-4rem)]">
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-cream-2">
        <Image
          src="/books-shelf.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[68%_50%]"
        />

        {/* הילה רכה שמבטיחה שהכותרת תישאר קריאה בלי תלות בתוכן הצילום
            שמתחתיה — אותה שכבה כמו בגרסה הקודמת עם הכריכות המטושטשות. */}
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
