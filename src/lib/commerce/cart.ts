import 'server-only';
import { createStaticClient } from '@/lib/supabase/server';
import { getBookAvailability } from '@/lib/books/availability';
import type { Book, BookAvailability } from '@/lib/supabase/types';
import { getEffectivePrice, round2 } from './pricing';
import { getCommerceFlags } from './settings';

/**
 * ליבת העגלה — אימות מול המסד (פרק 6.5 במסמך האב): כל קריאה מאמתת
 * מחיר, זמינות וכמות מול books ברגע האמת. העגלה עצמה נושאת מזהים
 * וכמויות בלבד; מחיר לעולם אינו נשמר בעגלה.
 *
 * הצורה אחידה לאורח (kr:cart המקומי נשלח לאימות) ולמחובר (cart_items).
 */

export const MAX_QTY_PER_ITEM = 99;

/**
 * תקרה למספר שורות שונות בעגלה. הכמות פר-פריט כבר חסומה ל-99, אבל מספר
 * הפריטים השונים לא היה חסום — קורא ל-validateCart עם עשרות אלפי {bookId}
 * ייצר שאילתת IN(...) ענקית פר-בקשה, זול לתוקף ויקר למסד. 200 כותרים
 * שונים בעגלה אחת הוא כבר הרבה מעבר לכל שימוש אמיתי.
 */
export const MAX_CART_LINES = 200;

export interface CartInputItem {
  bookId: string;
  quantity: number;
}

export interface ValidatedCartLine {
  bookId: string;
  slug: string;
  title: string;
  /** [1.6] שם המחבר — לתצוגה בשורת העגלה (ח.5); שדה ישיר על books, בלי join */
  author: string | null;
  coverImageUrl: string | null;
  /** הכמות אחרי התאמה למלאי (אם הופחתה — adjusted=true) */
  quantity: number;
  requestedQuantity: number;
  adjusted: boolean;
  unitPrice: number;
  originalUnitPrice: number | null;
  onSale: boolean;
  lineTotal: number;
  availability: BookAvailability;
  /** נכון להצגה בלבד, וכשעוזר להחלטה (פרק 3.5): נשאר עותק אחרון וכד' */
  availableQuantity: number | null;
  weightGrams: number;
  freeShippingEligible: boolean;
  isPreorder: boolean;
  /** [1.3] קטגוריית הספר — לתחולת מבצעים אוטומטיים */
  categoryId: string | null;
  /** פריט שאינו ניתן עוד לרכישה — מוצג עם הודעה, לא נספר בסכום */
  removedReason: 'not_purchasable' | 'out_of_stock' | null;
}

export interface ValidatedCart {
  lines: ValidatedCartLine[];
  subtotal: number;
  totalQuantity: number;
  totalWeightGrams: number;
  freeShippingEligible: boolean;
  /**
   * שינויים שהתגלו באימות — להצגה מפורשת, לעולם לא עדכון שקט. [1.6]
   * previousPrice/newPrice ו-requestedQuantity/availableQuantity (ח.3):
   * ההודעה חייבת לכלול מספרים אמיתיים ("מ-89 ל-79"), לא רק "המחיר השתנה".
   */
  changes: {
    bookId: string;
    title: string;
    kind: 'price' | 'quantity' | 'unavailable';
    previousPrice?: number;
    newPrice?: number;
    requestedQuantity?: number;
    availableQuantity?: number;
  }[];
  maxPrepDays: number;
}

const CART_BOOK_COLUMNS =
  'id, slug, title_he, title_en, author_name_he, author_name_en, category_id, cover_image_url, price, sale_price, sale_starts_at, sale_ends_at, sale_name_he, sale_name_en, currency, stock_quantity, is_purchasable, is_published, preorder_enabled, weight_grams, free_shipping_eligible, is_stock_managed, prep_days_override';

/**
 * אימות עגלה מלא מול המסד. previousPrices — המחירים שהוצגו ללקוח
 * (מהרינדור הקודם), להשוואה ולדיווח שינוי מפורש.
 */
export async function validateCart(
  items: CartInputItem[],
  locale: string = 'he',
  previousPrices?: Record<string, number>,
): Promise<ValidatedCart> {
  const empty: ValidatedCart = {
    lines: [],
    subtotal: 0,
    totalQuantity: 0,
    totalWeightGrams: 0,
    freeShippingEligible: true,
    changes: [],
    maxPrepDays: 0,
  };
  const cleaned = items
    .slice(0, MAX_CART_LINES)
    .filter((item) => item.quantity > 0)
    .map((item) => ({ ...item, quantity: Math.min(Math.floor(item.quantity), MAX_QTY_PER_ITEM) }));
  if (cleaned.length === 0) return empty;

  const supabase = createStaticClient();
  if (!supabase) return empty;

  const flags = await getCommerceFlags();
  const { data, error } = await supabase
    .from('books')
    .select(CART_BOOK_COLUMNS)
    .in('id', cleaned.map((item) => item.bookId))
    .eq('is_published', true);

  if (error) {
    console.error('[commerce:cart] validate', error.message);
    return empty;
  }

  const books = new Map((data ?? []).map((book) => [book.id as string, book as unknown as Book]));
  const lines: ValidatedCartLine[] = [];
  const changes: ValidatedCart['changes'] = [];
  let maxPrepDays = 0;

  for (const item of cleaned) {
    const book = books.get(item.bookId);
    if (!book) continue; // ספר שנמחק/בוטל פרסומו — נעלם מהעגלה עם הודעת unavailable

    const title = locale === 'en' && book.title_en ? book.title_en : book.title_he;
    const author = locale === 'en' && book.author_name_en ? book.author_name_en : book.author_name_he;
    const availability = getBookAvailability(book, flags.storeEnabled);
    const price = getEffectivePrice(book, locale);

    if (availability === 'catalog_only' || price == null) {
      lines.push(buildRemovedLine(book, title, author, item.quantity, 'not_purchasable'));
      changes.push({ bookId: book.id, title, kind: 'unavailable' });
      continue;
    }

    const managed = book.is_stock_managed !== false && !book.preorder_enabled;
    const available = managed ? Math.max(book.stock_quantity ?? 0, 0) : null;

    if (managed && (available ?? 0) <= 0) {
      lines.push(buildRemovedLine(book, title, author, item.quantity, 'out_of_stock'));
      changes.push({ bookId: book.id, title, kind: 'unavailable' });
      continue;
    }

    const quantity = managed ? Math.min(item.quantity, available!) : item.quantity;
    const adjusted = quantity !== item.quantity;
    if (adjusted) {
      changes.push({
        bookId: book.id,
        title,
        kind: 'quantity',
        requestedQuantity: item.quantity,
        availableQuantity: available ?? 0,
      });
    }

    const previous = previousPrices?.[book.id];
    if (previous != null && round2(previous) !== price.amount) {
      changes.push({
        bookId: book.id,
        title,
        kind: 'price',
        previousPrice: round2(previous),
        newPrice: price.amount,
      });
    }

    maxPrepDays = Math.max(maxPrepDays, book.prep_days_override ?? 0);
    lines.push({
      bookId: book.id,
      slug: book.slug,
      title,
      author,
      coverImageUrl: book.cover_image_url,
      quantity,
      requestedQuantity: item.quantity,
      adjusted,
      unitPrice: price.amount,
      originalUnitPrice: price.originalAmount,
      onSale: price.onSale,
      lineTotal: round2(price.amount * quantity),
      availability,
      availableQuantity: available,
      weightGrams: book.weight_grams ?? 0,
      freeShippingEligible: book.free_shipping_eligible !== false,
      isPreorder: availability === 'preorder',
      categoryId: book.category_id ?? null,
      removedReason: null,
    });
  }

  const active = lines.filter((line) => line.removedReason === null);
  return {
    lines,
    subtotal: round2(active.reduce((sum, line) => sum + line.lineTotal, 0)),
    totalQuantity: active.reduce((sum, line) => sum + line.quantity, 0),
    totalWeightGrams: active.reduce((sum, line) => sum + line.weightGrams * line.quantity, 0),
    freeShippingEligible: active.every((line) => line.freeShippingEligible),
    changes,
    maxPrepDays,
  };
}

function buildRemovedLine(
  book: Book,
  title: string,
  author: string | null,
  requested: number,
  reason: 'not_purchasable' | 'out_of_stock',
): ValidatedCartLine {
  return {
    bookId: book.id,
    slug: book.slug,
    title,
    author,
    coverImageUrl: book.cover_image_url,
    quantity: 0,
    requestedQuantity: requested,
    adjusted: true,
    unitPrice: 0,
    originalUnitPrice: null,
    onSale: false,
    lineTotal: 0,
    availability: reason === 'out_of_stock' ? 'out_of_stock' : 'catalog_only',
    availableQuantity: 0,
    weightGrams: 0,
    freeShippingEligible: true,
    isPreorder: false,
        categoryId: book.category_id ?? null,
    removedReason: reason,
  };
}
