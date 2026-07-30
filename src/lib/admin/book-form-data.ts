import { notFound } from 'next/navigation';
import { hasRole, requireRole } from './auth';
import {
  getBook,
  getBookRelations,
  getSettings,
  listAttributes,
  listAuthorsAdmin,
  listCategoriesAdmin,
  listTags,
} from './queries';
import type {
  AttributeWithValues,
  Author,
  Book,
  BookRelations,
  Category,
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
  relations: BookRelations;
  storeEnabled: boolean;
  canWrite: boolean;
}

async function loadShared(minimum: UserRole) {
  const [session, authors, categories, tags, attributes, settings] = await Promise.all([
    requireRole(minimum),
    listAuthorsAdmin(),
    listCategoriesAdmin(),
    listTags(),
    listAttributes(),
    getSettings(),
  ]);
  return { session, authors, categories, tags, attributes, settings };
}

export async function loadNewBookFormData(): Promise<BookFormData> {
  const { session, authors, categories, tags, attributes, settings } = await loadShared('editor');
  return {
    book: null,
    authors,
    categories,
    tags,
    attributes,
    relations: { tagIds: [], categoryIds: [], attributeValueIds: [] },
    storeEnabled: settings?.store_enabled ?? false,
    canWrite: hasRole(session.profile.role, 'editor'),
  };
}

export async function loadEditBookFormData(id: string): Promise<BookFormData> {
  const [{ session, authors, categories, tags, attributes, settings }, book, relations] = await Promise.all([
    loadShared('viewer'),
    getBook(id),
    getBookRelations(id),
  ]);

  if (!book) notFound();

  return {
    book,
    authors,
    categories,
    tags,
    attributes,
    relations,
    storeEnabled: settings?.store_enabled ?? false,
    canWrite: hasRole(session.profile.role, 'editor'),
  };
}
