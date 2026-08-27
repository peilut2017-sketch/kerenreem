'use client';

import { useTranslations } from 'next-intl';
import { FavouriteIcon } from '@/components/FavouriteIcon';
import { Link } from '@/i18n/navigation';
import { BookCover } from '../BookCover';
import { localized } from '@/lib/localized';
import { resolveBookAuthor } from '@/lib/books/author-display';
import { resolveBookBadge } from '@/lib/books/badge';
import { getBookAvailability } from '@/lib/books/availability';
import { formatPrice, getEffectivePrice } from '@/lib/commerce/pricing';
import { AddToCartButton } from '@/components/store/AddToCartButton';
import type { BookWithRelations } from '@/lib/supabase/types';

/**
 * כרטיס הספר — האלמנט המרכזי בקטלוג.
 *
 * הכריכה נושאת את הכרטיס, ולכן היא מקבלת את מרבית השטח. הפעולות המהירות
 * מופיעות במעבר עכבר אבל **נשארות בסדר הטאב תמיד**: פעולה שמופיעה רק
 * ב-hover אינה קיימת עבור מי שמנווט במקלדת. focus-within מחזיר אותן
 * לתצוגה גם כשמגיעים אליהן בטאב.
 */
export function BookCard({
  book,
  locale,
  priority,
  isFavourite,
  onToggleFavourite,
  storeEnabled,
}: {
  book: BookWithRelations;
  locale: string;
  priority?: boolean;
  isFavourite: boolean;
  onToggleFavourite: (book: BookWithRelations) => void;
  storeEnabled: boolean;
}) {
  const t = useTranslations('books');
  const title = localized(book, 'title', locale);
  const author = resolveBookAuthor(book, locale);
  // [1.21] עד שתי קטגוריות בכרטיס — כרטיס קטן, ורצועת קטגוריות ארוכה
  // מתחרה עם המחיר על אותה שורה. השאר נספרים ב"+N" ונגישים במלואם בעמוד הספר.
  const categoryNames = (book.categories?.length ? book.categories : book.category ? [book.category] : []).map(
    (category) => localized(category, 'name', locale),
  );
  const visibleCategoryNames = categoryNames.slice(0, 2);
  const extraCategoryCount = categoryNames.length - visibleCategoryNames.length;
  const badge = resolveBookBadge(book, locale, t('badgeFeatured'));
  const price = storeEnabled ? getEffectivePrice(book, locale) : null;
  const availability = getBookAvailability(book, storeEnabled);

  return (
    // [1.14] "זכוכית נוזלית" בהשראת Apple Liquid Glass — ראו .book-card-glass
    // ב-globals.css: משטח שקוף-למחצה עם backdrop-blur, ברק אלכסוני עדין
    // ומסגרת עליונה בהירה, בגווני האתר (קרם/זהב) במקום גווני iOS.
    <article className="book-card-glass group relative flex h-full flex-col focus-within:ring-2 focus-within:ring-gold/50">
      {/* [1.14] מחצית-שקופה, לא bg-cream-2 אטום — כדי שה-blur/הברק של
          .book-card-glass ייראה גם מאחורי מרבית הכרטיס, לא רק בשוליים */}
      <div className="relative overflow-hidden rounded-t-[var(--radius-lg)] bg-cream-2/55 p-5">
        <div className="transition-transform duration-500 ease-[var(--ease-spring)] group-hover:-translate-y-0.5 group-hover:scale-[1.02] motion-reduce:transform-none">
          <BookCover
            src={book.cover_image_url}
            title={title}
            alt={title}
            priority={priority}
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
          />
        </div>

        {/* פינת הפתיחה שומרת לתגית (מבצע/רב מכר/בחירת המכון) — רצועה
            אלכסונית שחוצה את פינת התמונה (ראו .book-ribbon ב-globals.css),
            הפוכה לפינת הסיום שבה יושב הלב, כדי ששתיהן לא יתנגשו. */}
        {badge ? (
          <span className={`book-ribbon z-10 ${badge.tone === 'accent' ? 'book-ribbon-accent' : ''}`}>
            {badge.label}
          </span>
        ) : null}

        <FavouriteButton
          title={title}
          isFavourite={isFavourite}
          onToggle={() => onToggleFavourite(book)}
        />
      </div>

      {/* relative z-[2] — יושב מעל שכבת הברק העדינה של .book-card-glass::before,
          כדי שהיא תיראה מעל שולי הכרטיס אך לא תעמעם את הטקסט הקריא */}
      <div className="relative z-[2] flex flex-1 flex-col p-5 pt-4">
        <h3 className="font-serif text-[1.0625rem] leading-snug text-ink">
          {/* הקישור פרוש על כל הכרטיס, כך שכל השטח לחיץ ובכל זאת יש רק
              יעד אחד בסדר הטאב — כרטיס עם שלושה קישורים לאותו מקום מכפיל
              את מספר העצירות לקורא מסך. */}
          <Link href={`/books/${book.slug}`} className="after:absolute after:inset-0 hover:text-burgundy">
            {title}
          </Link>
        </h3>

        {author ? <p className="mt-1.5 text-small text-muted">{author.name}</p> : null}

        <div className="mt-auto pt-4">
          <div className="flex flex-wrap items-center gap-2">
            {visibleCategoryNames.map((name) => (
              <span key={name} className="rounded-[var(--radius-pill)] bg-cream-2 px-2.5 py-1 text-caption text-ink-soft">
                {name}
              </span>
            ))}
            {extraCategoryCount > 0 ? (
              <span
                className="rounded-[var(--radius-pill)] bg-cream-2 px-2.5 py-1 text-caption text-ink-soft"
                title={categoryNames.slice(2).join(', ')}
              >
                +{extraCategoryCount}
              </span>
            ) : null}

            {price ? (
              <span className="ms-auto inline-flex items-baseline gap-1.5 font-serif text-[1.05rem] text-ink tabular-nums">
                {price.onSale && price.originalAmount != null ? (
                  <s className="text-caption text-muted">{formatPrice(price.originalAmount, locale)}</s>
                ) : null}
                {formatPrice(price.amount, locale)}
              </span>
            ) : null}
          </div>

          {/* [1.4] כרטיס קטלוג בלי זמינות ובלי דרך לקנות אינו כרטיס חנות —
              ראו ביקורת המימוש ב.8/ב.6. z-20 מעל שכבת הקישור הפרוש על
              הכרטיס (after:absolute after:inset-0 למעלה), אחרת הלחיצה
              על "הוספה לסל" פותחת את עמוד הספר במקום להוסיף. */}
          {availability !== 'catalog_only' ? (
            <div className="relative z-20 mt-3 flex items-center justify-between gap-2">
              {availability === 'out_of_stock' ? (
                <span className="text-caption font-semibold text-burgundy">{t('outOfStock')}</span>
              ) : null}
              <AddToCartButton
                bookId={book.id}
                title={title}
                availability={availability}
                variant="quiet"
                className="ms-auto shrink-0 !px-3 !py-1.5 text-caption"
              />
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function FavouriteButton({
  title,
  isFavourite,
  onToggle,
}: {
  title: string;
  isFavourite: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('books');
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={isFavourite}
      aria-label={isFavourite ? t('favouriteRemoveNamed', { title }) : t('favouriteAddNamed', { title })}
      /* z-20 מעל שכבת הקישור הפרוש, אחרת הלחיצה על הלב פותחת את הספר */
      className={`glass absolute end-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] transition-[opacity,transform,color] duration-300 ease-[var(--ease-spring)] hover:scale-110 focus-visible:opacity-100 motion-reduce:transition-none ${
        isFavourite
          ? 'text-burgundy opacity-100'
          : /* [1.4] בנייד אין hover — הכפתור היה בלתי נראה לחלוטין (opacity-0
               תמיד). גלוי כברירת מחדל, ומתגלה ב-hover רק מ-sm ומעלה. */
            'text-ink-soft opacity-100 sm:opacity-0 sm:group-hover:opacity-100 group-focus-within:opacity-100'
      }`}
    >
      <FavouriteIcon active={isFavourite} animate />
    </button>
  );
}
