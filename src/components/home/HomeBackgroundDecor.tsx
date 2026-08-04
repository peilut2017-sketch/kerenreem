/**
 * שכבת רקע דקורטיבית עדינה למקטעים הבהירים בעמוד הבית (אודות/פעילות/
 * אירועים) — עיגולים רכים וסמלי ספר פתוח בקווי מתאר, בגווני הלוגו
 * (זהב/כחול עמוק/בורדו) בשקיפות נמוכה מאוד. לא צילום ולא איקונוגרפיה
 * נושאית (למשל קופת צדקה) — רק תחושת "יש כאן משהו" ברקע הריק בין
 * הכרטיסים, כדי שהעמוד לא ירגיש כמו רצף לבן שטוח.
 *
 * aria-hidden ו-pointer-events-none: קישוט גרידא, לא תוכן ולא לחיץ.
 * הרכיב עצמו absolute inset-0 -z-10; ההורה חייב position: relative.
 */
export function HomeBackgroundDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -end-24 top-10 h-72 w-72 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-gold)_16%,transparent),transparent_70%)]" />
      <div className="absolute -start-32 top-[38%] h-96 w-96 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-navy)_10%,transparent),transparent_70%)]" />
      <div className="absolute -end-16 bottom-[8%] h-64 w-64 rounded-full bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-burgundy)_10%,transparent),transparent_70%)]" />

      <OpenBookGlyph className="absolute end-[8%] top-[6%] h-20 w-20 -rotate-6 text-gold/[0.14]" />
      <OpenBookGlyph className="absolute start-[6%] top-[55%] h-28 w-28 rotate-12 text-navy/[0.08]" />
      <OpenBookGlyph className="absolute end-[14%] bottom-[4%] h-16 w-16 rotate-3 text-burgundy/[0.1]" />
    </div>
  );
}

function OpenBookGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className} fill="none">
      <path
        d="M32 10c-5-4.5-13-6-22-5v30c9-1 17 0.5 22 5 5-4.5 13-6 22-5V5c-9-1-17 0.5-22 5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M32 10v30" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
