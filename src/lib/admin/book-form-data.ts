import { notFound } from 'next/navigation';
import { hasRole, requireRole } from './auth';
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
  };
}

export async function loadEditBookFormData(id: string): Promise<BookFormData> {
  const [{ session, authors, categories, tags, attributes, series, settings }, book, relations] =
    await Promise.all([loadShared('viewer'), getBook(id), getBookRelations(id)]);

  if (!book) notFound();

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
  };
}
