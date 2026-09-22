'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { BookCover } from '@/components/BookCover';
import { ScrollRail } from '@/components/ScrollRail';
import { SectionHeading } from '@/components/SectionHeading';
import { useQuickView, type QuickViewBook } from '@/components/book-quick-view';
import { localized, localizedOrNull } from '@/lib/localized';
import type { BookConnections } from '@/lib/data';
import type { BookRelationType, RelatedBookCard } from '@/lib/supabase/types';

/**
 * "להמשיך מכאן" — קרוסלה אחת עם שבבי סינון, לא ארבע קרוסלות נפרדות זו
 * מתחת לזו (ראו הנימוק המקורי למטה). התוספת כאן: לכל ספר יש עכשיו
 * "סיבה" גלויה (Reason Badge) — למה הוא מוצג כאן — ולא רק כותרת קבוצה.
 *
 * הדדופ בין הקבוצות כבר נעשה בשרת (getBookConnections, לפי סדר עדיפות:
 * קשר ידני → סדרה → מחבר → קטגוריה/תגיות), כך שכל ספר משתייך לקבוצה
 * אחת בלבד וה"סיבה" שלו חד-משמעית.
 *
 * הגרסה הקודמת נתנה שורה שלמה לכל סיבת קשר. בקטלוג אמיתי כל סיבה
 * מחזירה לרוב ספר או שניים, והתוצאה הייתה ארבע שורות שכל אחת כמעט
 * ריקה — הרבה גלילה עבור מעט ספרים. שבב סינון שומר על אותו מידע בדיוק
 * אבל מרכז את הספרים בשורה אחת מלאה.
 *
 * שבב מוצג רק אם יש מאחוריו ספרים — מסנן שמוביל תמיד לאפס תוצאות הוא
 * הבטחה שבורה. בכוונה אין כאן "נרכשו יחד" או "נצפו לאחריו" — אין נתוני
 * רכישה/מעקב אמיתיים לבסס עליהם קבוצה כזו (ראו data.ts).
 */
export function ConnectionsSection({
  connections,
  authorName,
  locale,
}: {
  connections: BookConnections;
  authorName: string | null;
  locale: string;
}) {
  const t = useTranslations('books');
  const openQuickView = useQuickView();

  const REASON_LABELS: Record<BookRelationType, string> = {
    complements: t('reasonComplements'),
    recommended: t('reasonRecommended'),
    previous_edition: t('reasonPreviousEdition'),
    next_edition: t('reasonNextEdition'),
    staff_pick: t('reasonStaffPick'),
    bundle: t('reasonBundle'),
  };

  const groups = useMemo(
    () =>
      [
        connections.manual.length > 0
          ? {
              key: 'manual',
              label: t('reasonStaffPick'),
              books: connections.manual.map((relation) => relation.target),
              reasonFor: (book: RelatedBookCard) => {
                const relation = connections.manual.find((r) => r.target.id === book.id);
                return relation ? REASON_LABELS[relation.relation_type] : t('reasonStaffPick');
              },
            }
          : null,
        connections.sameSeries.length > 0
          ? {
              key: 'series',
              label: t('connectionsSeries'),
              books: connections.sameSeries,
              reasonFor: () => t('connectionsSeries'),
            }
          : null,
        authorName && connections.sameAuthor.length > 0
          ? {
              key: 'author',
              label: t('connectionsAuthor', { name: authorName }),
              books: connections.sameAuthor,
              reasonFor: () => t('connectionsAuthor', { name: authorName }),
            }
          : null,
        connections.sameCategory.length > 0
          ? {
              key: 'category',
              label: t('connectionsCategory'),
              books: connections.sameCategory,
              reasonFor: () => t('connectionsCategory'),
            }
          : null,
        connections.sameTags.length > 0
          ? {
              key: 'tags',
              label: t('connectionsTags'),
              books: connections.sameTags,
              reasonFor: () => t('connectionsTags'),
            }
          : null,
      ].filter(
        (
          g,
        ): g is {
          key: string;
          label: string;
          books: RelatedBookCard[];
          reasonFor: (book: RelatedBookCard) => string;
        } => g !== null,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t is stable per-render; REASON_LABELS derives from it
    [connections, authorName],
  );

  const [active, setActive] = useState('all');

  // "הכל" מאחד את כל הדליים, וכל ספר שומר את הסיבה של הדלי שבו נמצא —
  // דדופ כבר נעשה בשרת, כך שכל מזהה מופיע פה פעם אחת בדיוק.
  const all = useMemo(() => {
    const seen = new Set<string>();
    const merged: { book: RelatedBookCard; reason: string }[] = [];
    for (const group of groups) {
      for (const book of group.books) {
        if (seen.has(book.id)) continue;
        seen.add(book.id);
        merged.push({ book, reason: group.reasonFor(book) });
      }
    }
    return merged;
  }, [groups]);

  if (groups.length === 0) return null;

  const activeGroup = groups.find((g) => g.key === active);
  const shown = active === 'all' ? all : (activeGroup?.books.map((book) => ({ book, reason: activeGroup.reasonFor(book) })) ?? all);

  return (
    <section aria-labelledby="book-connections">
      <SectionHeading level={2} title={t('navConnections')} id="book-connections" />

      {groups.length > 1 ? (
        <div role="group" aria-label={t('connectionsFilter')} className="mb-6 flex flex-wrap gap-2">
          {[{ key: 'all', label: t('connectionsAll') }, ...groups].map((chip) => (
            <button
              key={chip.key}
              type="button"
              aria-pressed={active === chip.key}
              onClick={() => setActive(chip.key)}
              className={`rounded-[var(--radius-pill)] border px-4 py-1.5 text-caption transition-colors ${
                active === chip.key
                  ? 'border-navy bg-navy text-cream'
                  : 'border-rule text-ink-soft hover:border-gold-deep hover:text-gold-deep'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* [1.40] רצועה עם חיצים במקום פס גלילה חשוף — ראו ScrollRail.
          הרצועה עצמה היא המגלל ונושאת role="group" עם שם נגיש, ולכן
          הכרטיסים הם ילדים ישירים שלה ולא <ul> מקונן: מגלל בתוך מגלל
          היה שובר את מדידת הקצוות ואת ה-snap. */}
      <ScrollRail
        label={t('connectionsRailLabel')}
        prevLabel={t('railPrev')}
        nextLabel={t('railNext')}
      >
        {shown.map(({ book, reason }) => {
            const title = localized(book, 'title', locale);
            const author = book.author ? localized(book.author, 'name', locale) : null;
            return (
              <div key={book.id} className="w-36 shrink-0 sm:w-44">
                <div className="group relative block h-full rounded-[var(--radius-lg)] border border-rule bg-cream-2/50 p-3.5 transition-[transform,border-color] duration-300 ease-[var(--ease-spring)] hover:-translate-y-1.5 hover:border-gold-deep">
                  <BookCover src={book.cover_image_url} title={title} alt={t('coverAlt', { title })} sizes="176px" />
                  <span className="mt-3 block truncate rounded-[var(--radius-pill)] bg-cream-3 px-2.5 py-0.5 text-center text-[0.6875rem] text-ink-soft">
                    {reason}
                  </span>
                  <h3 className="mt-2 line-clamp-2 text-small leading-snug text-ink group-hover:text-gold-deep">
                    {/*
                      הקישור נשאר <Link> אמיתי לעמוד הספר — כך הוא נפתח
                      בכרטיסייה חדשה בלחיצה אמצעית, נסרק, ועובד בלי JS.
                      הלחיצה הרגילה נתפסת ומוחלפת בתצוגה מהירה רק כשזו
                      זמינה (הפריסה הציבורית מספקת אותה), ורק ללחיצה
                      "נקייה": עם Ctrl/Cmd/Shift, או בכפתור שאינו הראשי,
                      הדפדפן מקבל את ההתנהגות הרגילה שלו.
                    */}
                    <Link
                      href={`/books/${book.slug}`}
                      onClick={(event) => {
                        if (!openQuickView) return;
                        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
                        event.preventDefault();
                        openQuickView(toQuickView(book, locale, reason));
                      }}
                      className="after:absolute after:inset-0 focus-visible:outline-offset-4"
                    >
                      {title}
                    </Link>
                  </h3>
                  {author ? <p className="mt-0.5 text-caption text-muted">{author}</p> : null}
                </div>
              </div>
            );
        })}
      </ScrollRail>
    </section>
  );
}

/**
 * ספר קשור → נתוני התצוגה המהירה. כל השדות כאן נשלפים כבר ב-select של
 * הקשרים (ראו BOOK_DETAIL_SELECT_V3 ב-data.ts), ולכן פתיחת התצוגה אינה
 * דורשת סבב רשת נוסף.
 */
function toQuickView(book: RelatedBookCard, locale: string, eyebrow: string): QuickViewBook {
  return {
    slug: book.slug,
    title: localized(book, 'title', locale),
    subtitle: localizedOrNull(book, 'subtitle', locale),
    coverUrl: book.cover_image_url,
    authorName: book.author ? localized(book.author, 'name', locale) : null,
    authorSlug: book.author?.slug ?? null,
    brief: localizedOrNull(book, 'description_brief', locale),
    // הכפתור החיצוני מוצג רק כשהמצב באמת מופעל — קישור ששמור בשדה
    // אבל המתג כבוי אינו אמור להופיע בשום מקום באתר.
    externalUrl: book.external_supplier_enabled ? (book.external_supplier_url ?? null) : null,
    externalLabel: book.external_supplier_name ?? null,
    eyebrow,
  };
}
