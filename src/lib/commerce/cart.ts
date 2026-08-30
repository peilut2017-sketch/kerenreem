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
 * תקרת שורות לעגלה. בלי תקרה, מערך של אלפי פריטים מהדפדפן הופך
 * לשאילתת ‎.in()‎ ענקית ולשורת checkout_sessions שמחזיקה את כולו.
 * גדול בהרבה מכל עגלה אמיתית בחנות ספרים — נועד לחסום שימוש לרעה בלבד.
 */
export const MAX_CART_LINES = 50;

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
 *
 * [1.8] allowUnpublished — ערוץ ההזמנה הטלפונית (manual-orders.ts) מציג
 * לצוות כל ספר עם is_purchasable=true, בלי לבדוק is_published (ספר יכול
 * להימכר בטלפון לפני שהוא גלוי בקטלוג הציבורי). בלי הדגל, אותו ספר לא
 * נמצא כאן (השאילתה דרשה is_published), נופל לענף "ספר לא נמצא" למטה,
 * ונעלם מההזמנה בלי שום סימון — הצוות מוסיף אותו, הכל נראה תקין, וההזמנה
 * שנוצרת פשוט חסרה את הפריט. לצ׳ק-אאוט הציבורי (שאר הקוראים) נשאר הגדר
 * הרגיל — עגלה של אורח לא אמורה לצאת עם ספר שאינו מפורסם.
 *
 * [1.9] priceOverrides — גם בערוץ הטלפוני בלבד: מחיר שהצוות הקליד עבור
 * ספר *בלי* מחיר קטלוגי. לעולם לא דורס מחיר קטלוגי קיים (נבדק למטה לפני
 * שהערך נקרא בכלל) — אחרת עובד/באג היה יכול לתמחר מתחת למחיר האמיתי.
 */
export async function validateCart(
  items: CartInputItem[],
  locale: string = 'he',
  previousPrices?: Record<string, number>,
  options?: { allowUnpublished?: boolean; priceOverrides?: Record<string, number> },
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
    .filter((item) => item.quantity > 0)
    .map((item) => ({ ...item, quantity: Math.min(Math.floor(item.quantity), MAX_QTY_PER_ITEM) }))
    .slice(0, MAX_CART_LINES);
  if (cleaned.length === 0) return empty;

  const supabase = createStaticClient();
  if (!supabase) return empty;

  const flags = await getCommerceFlags();
  let query = supabase
    .from('books')
    .select(CART_BOOK_COLUMNS)
    .in('id', cleaned.map((item) => item.bookId));
  if (!options?.allowUnpublished) {
    query = query.eq('is_published', true);
  }
  const { data, error } = await query;

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
    if (!book) {
      // ספר שנמחק (או בוטל פרסומו, כשלא הותר allowUnpublished) — שורת
      // "לא זמין" מפורשת, לא היעלמות שקטה: אחרת הצוות/הלקוח מוסיפים
      // פריט תקין למראית עין, וההזמנה שנוצרת פשוט חסרה אותו בלי הסבר.
      lines.push(buildUnknownRemovedLine(item.bookId, item.quantity));
      changes.push({ bookId: item.bookId, title: item.bookId, kind: 'unavailable' });
      continue;
    }

    const title = locale === 'en' && book.title_en ? book.title_en : book.title_he;
    const author = locale === 'en' && book.author_name_en ? book.author_name_en : book.author_name_he;
    const catalogPrice = getEffectivePrice(book, locale);
    // מחיר ידני נבחן רק כשאין בכלל מחיר קטלוגי (catalogPrice null) — אף
    // פעם לא כתחליף למחיר שכבר קיים.
    const manualPrice =
      catalogPrice == null ? options?.priceOverrides?.[item.bookId] : undefined;
    const price =
      catalogPrice ??
      (manualPrice != null && manualPrice >= 0
        ? { amount: round2(manualPrice), originalAmount: null, onSale: false, saleName: null }
        : null);

    let availability = getBookAvailability(book, flags.storeEnabled);
    // "catalog_only" יכול לנבוע רק מחוסר מחיר (לא מ-is_purchasable=false
    // ולא מחנות כבויה) — במקרה הזה בלבד מחיר ידני "מתקן" את הזמינות.
    if (
      availability === 'catalog_only' &&
      manualPrice != null &&
      price != null &&
      book.is_purchasable &&
      flags.storeEnabled
    ) {
      availability = book.preorder_enabled
        ? 'preorder'
        : (book.stock_quantity ?? 0) > 0
          ? 'in_stock'
          : 'out_of_stock';
    }

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

/** ספר שלא נמצא בכלל בשאילתה (נמחק, או שאינו מפורסם בלי allowUnpublished) — אין row לשלוף ממנו כותרת/כריכה. */
function buildUnknownRemovedLine(bookId: string, requested: number): ValidatedCartLine {
  return {
    bookId,
    slug: '',
    title: bookId,
    author: null,
    coverImageUrl: null,
    quantity: 0,
    requestedQuantity: requested,
    adjusted: true,
    unitPrice: 0,
    originalUnitPrice: null,
    onSale: false,
    lineTotal: 0,
    availability: 'catalog_only',
    availableQuantity: 0,
    weightGrams: 0,
    freeShippingEligible: true,
    isPreorder: false,
    categoryId: null,
    removedReason: 'not_purchasable',
  };
}
