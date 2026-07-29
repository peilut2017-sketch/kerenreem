import type { MetadataRoute } from 'next';
import { getActivitySlugs, getAuthorSlugs, getBookSlugs, getEventSlugs } from '@/lib/data';
import { routing } from '@/i18n/routing';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

const STATIC_PATHS = [
  '',
  '/about',
  '/books',
  '/authors',
  '/activities',
  '/events',
  '/donate',
  '/contact',
  '/terms',
  '/privacy',
  '/accessibility',
];

/** עברית ללא קידומת, אנגלית עם /en — בהתאם ל-localePrefix: 'as-needed'. */
function url(locale: string, path: string) {
  const prefix = locale === routing.defaultLocale ? '' : `/${locale}`;
  return `${SITE_URL}${prefix}${path}`;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [books, authors, activities, events] = await Promise.all([
    getBookSlugs(),
    getAuthorSlugs(),
    getActivitySlugs(),
    getEventSlugs(),
  ]);

  const dynamicPaths = [
    ...books.map((slug) => `/books/${slug}`),
    ...authors.map((slug) => `/authors/${slug}`),
    ...activities.map((slug) => `/activities/${slug}`),
    ...events.map((slug) => `/events/${slug}`),
  ];

  const lastModified = new Date();

  return [...STATIC_PATHS, ...dynamicPaths].flatMap((path) =>
    routing.locales.map((locale) => ({
      url: url(locale, path),
      lastModified,
      // עמוד ספר הוא הנכס המרכזי לגילוי אורגני
      priority: path.startsWith('/books/') ? 0.8 : path === '' ? 1 : 0.6,
      alternates: {
        languages: Object.fromEntries(routing.locales.map((l) => [l, url(l, path)])),
      },
    })),
  );
}
