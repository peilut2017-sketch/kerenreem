import { notFound } from 'next/navigation';
import { hasRole, requireRole } from './auth';
import { createServiceClient } from '@/lib/supabase/service';
import {
  getBook,
  getBookRelations,
  getSettings,
  listAttributes,
  listAuthorsAdmin,
  listCategoriesAdmin,
  listSeriesAdmin,
  listTags,
} from './queries';
import type {
  AttributeWithValues,
  Author,
  Book,
  BookRelations,
  Category,
  Series,
  Tag,
  UserRole,
} from '@/lib/supabase/types';

/**
 * נתוני הטופס המשותפים לעמוד המלא ולמגירה המיירטת של אותו מסך — כדי
 * שהשניים לא יסטו זה מזה, כל אחד מהם רק מציג את מה שנטען כאן.
 */
export interface BookFormData {
  book: Book | null;
  authors: Author[];
  categories: Category[];
  tags: Tag[];
  attributes: AttributeWithValues[];
  series: Series[];
  relations: BookRelations;
  storeEnabled: boolean;
  canWrite: boolean;
  /**
   * [1.4] מלאי פיזי אמיתי (סה״כ on_hand בכל המחסנים) — לא לבלבל עם
   * book.stock_quantity, שהוא מטמון נגזר של הזמין (on_hand − reserved).
   * הצגת המטמון בשדה "מלאי פיזי" גרמה למחיקת עותקים שמורים בשקט בכל
   * שמירה שלא נגעה במלאי (ראו reconcileBookStockFromForm). null לספר
   * חדש שטרם נשמר.
   */
  stockOnHand: number | null;
}

async function loadShared(minimum: UserRole) {
  const [session, authors, categories, tags, attributes, series, settings] = await Promise.all([
    requireRole(minimum),
    listAuthorsAdmin(),
    listCategoriesAdmin(),
    listTags(),
    listAttributes(),
    listSeriesAdmin(),
    getSettings(),
  ]);
  return { session, authors, categories, tags, attributes, series, settings };
}

export async function loadNewBookFormData(): Promise<BookFormData> {
  const { session, authors, categories, tags, attributes, series, settings } = await loadShared('editor');
  return {
    book: null,
    authors,
    categories,
    tags,
    attributes,
    series,
    relations: { tagIds: [], categoryIds: [], attributeValueIds: [] },
    storeEnabled: settings?.store_enabled ?? false,
    canWrite: hasRole(session.profile.role, 'editor'),
    stockOnHand: null,
  };
}

/**
 * [1.4] סכימת on_hand האמיתי מכל המחסנים — service client, לא ה-RLS
 * הרגיל: כל עורך תוכן יכול לפתוח את לשונית "מסחר", לא רק בעלי הרשאת
 * store, ולכן אי אפשר להסתמך על מדיניות מלאי שנועדה לצוות החנות.
 */
async function getBookStockOnHand(bookId: string, fallback: number | null): Promise<number | null> {
  const service = createServiceClient();
  if (!service) return fallback;
  const { data: levels } = await service.from('inventory_levels').select('on_hand').eq('book_id', bookId);
  if (!levels || levels.length === 0) return fallback;
  return levels.reduce((sum, level) => sum + level.on_hand, 0);
}

export async function loadEditBookFormData(id: string): Promise<BookFormData> {
  const [{ session, authors, categories, tags, attributes, series, settings }, book, relations] =
    await Promise.all([loadShared('viewer'), getBook(id), getBookRelations(id)]);

  if (!book) notFound();
  const stockOnHand = await getBookStockOnHand(id, book.stock_quantity ?? 0);

  return {
    book,
    authors,
    categories,
    tags,
    attributes,
    series,
    relations,
    storeEnabled: settings?.store_enabled ?? false,
    canWrite: hasRole(session.profile.role, 'editor'),
    stockOnHand,
  };
}
