import { Link } from '@/i18n/navigation';

/**
 * [1.30] לחצן "דיווח על ספר" — צף בפינת ה-start הנמוכה של עמוד הספר,
 * ישירות מעל לחצן הנגישות (שיושב שם בכל האתר, ראו AccessibilityWidget).
 * מוביל לטופס יצירת הקשר, לכרטיסיית "הערות והארות על ספרים", כשהספר
 * המדווח כבר נבחר מראש (?tab=book&book=<id> — ראו ContactTabs).
 *
 * ה-id (book-report) משמש את BackToTop כדי לפנות לו מקום: בעמודי ספר
 * חץ "חזרה למעלה" עולה מעל הלחצן הזה במקום להתנגש בו.
 */
export function ReportBookButton({ bookId, label }: { bookId: string; label: string }) {
  return (
    <Link
      id="book-report"
      href={{ pathname: '/contact', query: { tab: 'book', book: bookId } }}
      aria-label={label}
      title={label}
      className="glass fixed bottom-[6.5rem] start-4 z-30 flex h-11 w-11 items-center justify-center rounded-[var(--radius-pill)] text-ink-soft shadow-[var(--shadow-float)] transition-[transform,color] duration-300 ease-[var(--ease-spring)] hover:scale-110 hover:text-burgundy"
    >
      {/* דגלון דיווח */}
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none">
        <path
          d="M5 17V3.5M5 4h9.5l-2.2 3 2.2 3H5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
