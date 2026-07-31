'use client';

import { useId, useState } from 'react';

/** הסברים קבועים לתגיות מערכת, לספר בלי description_he משלה. */
const SYSTEM_EXPLANATIONS: Record<string, string> = {
  new: 'נוסף לקטלוג לאחרונה.',
  bestseller: 'מהספרים המבוקשים ביותר של המכון.',
};

/**
 * תגית עם Tooltip שמסביר למה היא ניתנה — לא שבב סתמי. ההסבר מגיע מ-
 * description_he אם הוגדר בניהול, אחרת מהסברי ברירת מחדל לתגיות מערכת,
 * ואם אין כלום התגית מוצגת בלי Tooltip (עדיף שקט על הסבר מומצא).
 */
export function SmartTag({
  label,
  slug,
  description,
}: {
  label: string;
  slug: string;
  description?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();
  const explanation = description || SYSTEM_EXPLANATIONS[slug];

  if (!explanation) {
    return (
      <span className="rounded-[var(--radius-pill)] border border-rule px-3 py-1 text-caption text-ink-soft">
        {label}
      </span>
    );
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-describedby={open ? tooltipId : undefined}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="rounded-[var(--radius-pill)] border border-rule px-3 py-1 text-caption text-ink-soft transition-colors hover:border-gold-deep hover:text-gold-deep"
      >
        {label}
      </button>
      {open ? (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute bottom-full left-1/2 z-20 mb-2 w-48 -translate-x-1/2 rounded-[var(--radius-sm)] bg-ink px-3 py-2 text-caption text-cream shadow-[var(--shadow-float)]"
        >
          {explanation}
        </span>
      ) : null}
    </span>
  );
}
