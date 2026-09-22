'use client';

import { createContext, useCallback, useContext, useId, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BookCover } from '@/components/BookCover';
import { Drawer } from '@/components/Drawer';

/**
 * [1.40] תצוגה מהירה של ספר — כרטיס צף שנפתח בלי לעזוב את העמוד.
 *
 * הבעיה שהוא פותר: בעמוד ספר, לחיצה על כרך אחר בסדרה או על ספר
 * מ"להמשיך מכאן" גררה ניווט מלא לעמוד אחר. מי שרק רצה לדעת "מה זה
 * בעצם" איבד את מקומו, ונאלץ לחזור אחורה. הכרטיס הצף עונה על השאלה
 * במקום, ומשאיר את המעבר המלא כבחירה מפורשת.
 *
 * ההקשר מסופק ברמת הפריסה הציבורית (layout.tsx), ולא בעמוד הספר בלבד:
 * אותה תצוגה מיועדת לשמש גם בקטלוג, בתוצאות חיפוש ובמועדפים. רכיב
 * שקורא ל-useQuickView מחוץ לפריסה מקבל null ופשוט לא מציע את
 * התצוגה — לא קורס.
 */

export interface QuickViewBook {
  slug: string;
  title: string;
  subtitle?: string | null;
  coverUrl: string | null;
  authorName: string | null;
  authorSlug?: string | null;
  /** תמצית קצרה. טקסט נקי בלבד — לא HTML. */
  brief?: string | null;
  /** מחיר מעוצב כבר (כולל מטבע), או null כשהחנות כבויה/אין מחיר. */
  priceLabel?: string | null;
  /** קישור חיצוני לרכישה אצל ספק, אם הוגדר. */
  externalUrl?: string | null;
  externalLabel?: string | null;
  /** שורת שיוך קצרה — "כרך ז׳ בסדרה", "מאותו מחבר" וכד'. */
  eyebrow?: string | null;
}

type Open = (book: QuickViewBook) => void;

const QuickViewContext = createContext<Open | null>(null);

/** null מחוץ לפריסה הציבורית — הקורא מחליט אם להציע תצוגה מהירה בכלל. */
export function useQuickView(): Open | null {
  return useContext(QuickViewContext);
}

export function BookQuickViewProvider({ children }: { children: ReactNode }) {
  const [book, setBook] = useState<QuickViewBook | null>(null);
  const open = useCallback<Open>((next) => setBook(next), []);
  const value = useMemo(() => open, [open]);

  return (
    <QuickViewContext.Provider value={value}>
      {children}
      <BookQuickViewDialog book={book} onClose={() => setBook(null)} />
    </QuickViewContext.Provider>
  );
}

function BookQuickViewDialog({
  book,
  onClose,
}: {
  book: QuickViewBook | null;
  onClose: () => void;
}) {
  const t = useTranslations('books');
  const titleId = useId();

  /*
   * הדיאלוג נשאר מורכב גם כשאין ספר (book=null) — Drawer מנהל בעצמו
   * את מעבר הסגירה ומפרק את עצמו בסופו (ראו mounted/visible שם). פירוק
   * מיידי כאן היה חותך את המעבר באמצע.
   *
   * התוכן עצמו מוגן ב-book && ... : בפריים שבין סגירה לפירוק אין ספר,
   * ואין מה לרנדר.
   */
  return (
    <Drawer
      open={book !== null}
      onClose={onClose}
      titleId={titleId}
      title={book?.title ?? ''}
      closeLabel={t('quickViewClose')}
      variant="center"
      widthClassName="max-w-2xl"
    >
      {book ? (
        <div className="grid gap-6 sm:grid-cols-[11rem_1fr]">
          <div>
            <BookCover
              src={book.coverUrl}
              title={book.title}
              alt={t('coverAlt', { title: book.title })}
              sizes="176px"
            />
          </div>

          <div className="min-w-0">
            {book.eyebrow ? <p className="eyebrow mb-1.5">{book.eyebrow}</p> : null}

            {book.subtitle ? (
              <p className="font-serif text-[1.0625rem] leading-snug text-ink-soft">{book.subtitle}</p>
            ) : null}

            {book.authorName ? (
              <p className="mt-2 text-small text-muted">
                {book.authorSlug ? (
                  <Link href={`/authors/${book.authorSlug}`} className="link" onClick={onClose}>
                    {book.authorName}
                  </Link>
                ) : (
                  book.authorName
                )}
              </p>
            ) : null}

            {book.brief ? (
              <p className="mt-4 line-clamp-6 text-body leading-relaxed text-ink-soft">{book.brief}</p>
            ) : null}

            {book.priceLabel ? (
              <p className="mt-4 font-serif text-h3 text-ink">{book.priceLabel}</p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {/* המעבר לעמוד המלא הוא הפעולה הראשית: התצוגה המהירה עונה
                  על "מה זה", והעמוד עונה על כל השאר. */}
              <Link href={`/books/${book.slug}`} className="btn btn-solid" onClick={onClose}>
                {t('quickViewOpen')}
              </Link>
              {book.externalUrl ? (
                <a
                  href={book.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="btn btn-quiet"
                >
                  {book.externalLabel ?? t('quickViewBuyExternal')}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
