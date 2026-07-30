/**
 * שלד טעינה לעמודי האתר.
 *
 * המעבר בין עמודים מיידי גם כשהנתונים עדיין בדרך, במקום שהדפדפן יישאר על
 * העמוד הקודם ויראה כאילו הלחיצה לא נקלטה.
 */
export default function PublicLoading() {
  return (
    <div aria-busy="true" aria-live="polite" className="mx-auto w-full max-w-[82rem] px-5 py-16 sm:px-8">
      <span className="sr-only">טוען…</span>

      <div aria-hidden="true" className="animate-pulse">
        <div className="h-4 w-28 rounded-[var(--radius-sm)] bg-rule" />
        <div className="mt-4 h-9 w-2/3 max-w-lg rounded-[var(--radius-sm)] bg-rule/80" />

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="card overflow-hidden">
              <div className="aspect-16/10 bg-rule/50" />
              <div className="p-6">
                <div className="h-4 w-3/4 rounded-[var(--radius-sm)] bg-rule/70" />
                <div className="mt-3 h-3 w-1/2 rounded-[var(--radius-sm)] bg-rule/50" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
