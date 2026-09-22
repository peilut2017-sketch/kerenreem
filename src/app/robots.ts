import type { MetadataRoute } from 'next';
import { canonicalSiteUrl } from '@/lib/site-url';

const SITE_URL = canonicalSiteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // ממשק הניהול אינו תוכן ציבורי ואין סיבה שייסרק
      disallow: ['/admin', '/api'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
