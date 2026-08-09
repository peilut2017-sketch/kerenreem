'use server';

import { headers } from 'next/headers';
import { allowRequest, ipBucket } from './rate-limit';

/**
 * [1.3] אימות כתובות מול מרשם היישובים והרחובות הממשלתי (data.gov.il):
 * השלמה חיה לעיר ולרחוב בזמן ההקלדה — בלי מפתח API ובלי עלות, דרך השרת
 * (ה-CSP חוסם קריאות דפדפן החוצה). ‏Google Places נשקל והושאר כשדרוג
 * עתידי — דורש מפתח בתשלום; המרשם הממשלתי מכסה את הצורך: כתובת ישראלית
 * קיימת. כשל רשת ⇒ רשימה ריקה והשדה נשאר טקסט חופשי — לא חוסמים הזמנה.
 */

const DATA_GOV_BASE = 'https://data.gov.il/api/3/action/datastore_search';
/** מרשם היישובים (למ"ס) */
const CITIES_RESOURCE = '5c78e9fa-c2e2-4771-93ff-7f400a12f7ba';
/** מרשם הרחובות הארצי */
const STREETS_RESOURCE = '9ad3862c-8391-4b2f-84a4-2d4c68625f4b';

interface DatastoreResponse {
  success?: boolean;
  result?: { records?: Record<string, unknown>[] };
}

async function datastoreSearch(
  resourceId: string,
  filters: Record<string, string> | null,
  q: string,
  limit: number,
): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams({ resource_id: resourceId, limit: String(limit), q });
  if (filters) params.set('filters', JSON.stringify(filters));
  try {
    const response = await fetch(`${DATA_GOV_BASE}?${params}`, {
      // המרשם משתנה לעיתים רחוקות — יום שלם במטמון חוסך קריאות
      next: { revalidate: 86400 },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as DatastoreResponse;
    return data.result?.records ?? [];
  } catch {
    return [];
  }
}

/** השלמת יישוב: עד 8 שמות ייחודיים המתחילים/מכילים את הקלט. */
export async function searchCities(query: string): Promise<string[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const headerList = await headers();
  if (!(await allowRequest(ipBucket('address-lookup', headerList), 60, 60))) return [];

  const records = await datastoreSearch(CITIES_RESOURCE, null, q, 32);
  const names = records
    .map((record) => String(record['שם_ישוב'] ?? '').trim())
    .filter((name) => name && name.includes(q));
  // שמות המתחילים בקלט קודם — זו כמעט תמיד הכוונה
  names.sort((a, b) => Number(b.startsWith(q)) - Number(a.startsWith(q)));
  return [...new Set(names)].slice(0, 8);
}

/** השלמת רחוב בתוך יישוב נבחר. */
export async function searchStreets(city: string, query: string): Promise<string[]> {
  const q = query.trim();
  const cityName = city.trim();
  if (q.length < 2 || !cityName) return [];
  const headerList = await headers();
  if (!(await allowRequest(ipBucket('address-lookup', headerList), 60, 60))) return [];

  const records = await datastoreSearch(STREETS_RESOURCE, { שם_ישוב: cityName }, q, 32);
  const names = records
    .map((record) => String(record['שם_רחוב'] ?? '').trim())
    .filter((name) => name && name.includes(q));
  names.sort((a, b) => Number(b.startsWith(q)) - Number(a.startsWith(q)));
  return [...new Set(names)].slice(0, 8);
}
