import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

/**
 * שלושת הצבעים הדומיננטיים של הכריכה, ל-Hero של עמוד הספר.
 *
 * לא Gradient קבוע: הרעיון הוא שכל ספר ירגיש אחרת, בלי לתכנת צבע ידנית
 * לכל כותר. הרקע נגזר מהתמונה עצמה.
 *
 * מחושב פעם אחת לכל בנייה מחדש של ה-ISR (revalidate=60 בעמוד הספר) ולא
 * פעם לכל מבקר — resize ל-24×24 ו-k-means על פחות מ-600 פיקסלים הם
 * עבודה זניחה, אבל אין סיבה לחזור עליה בכל בקשה בכל זאת.
 */
export interface CoverPalette {
  colors: [string, string, string];
}

/** בורגונדי, נייבי כהה וזהב — צבעי הזהות החזותית, לכריכה חסרה או תמונה שנכשלה. */
const FALLBACK: CoverPalette = { colors: ['#7a1f2b', '#2c2420', '#c9a04a'] };

async function readCoverBytes(url: string): Promise<Buffer | null> {
  try {
    if (url.startsWith('/')) {
      // נכס מקומי תחת public/ (כריכות דמו) — קריאת קובץ ולא fetch, כי אין
      // כאן בסיס URL בזמן רינדור שרת
      return await readFile(path.join(process.cwd(), 'public', url));
    }
    const response = await fetch(url);
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

type RGB = [number, number, number];

function rgbToHex([r, g, b]: RGB): string {
  return `#${[r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * k-means פשוט וללא תלות חיצונית — מספיק בהחלט לתמונה זעירה ול-k=3.
 * לא מיועד לדיוק צבע מקצועי, רק ל"מה הגוונים השולטים כאן".
 */
function dominantColors(pixels: RGB[], k: number, iterations = 8): { color: RGB; count: number }[] {
  if (pixels.length === 0) return [];

  let centers: RGB[] = pixels
    .filter((_, i) => i % Math.max(1, Math.floor(pixels.length / k)) === 0)
    .slice(0, k);
  while (centers.length < k) centers.push(pixels[pixels.length - 1]);

  let assignments = new Array(pixels.length).fill(0);

  for (let iter = 0; iter < iterations; iter += 1) {
    assignments = pixels.map((pixel) => {
      let best = 0;
      let bestDistance = Infinity;
      centers.forEach((center, index) => {
        const distance =
          (pixel[0] - center[0]) ** 2 + (pixel[1] - center[1]) ** 2 + (pixel[2] - center[2]) ** 2;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      return best;
    });

    const sums = centers.map(() => [0, 0, 0, 0]);
    pixels.forEach((pixel, i) => {
      const cluster = assignments[i];
      sums[cluster][0] += pixel[0];
      sums[cluster][1] += pixel[1];
      sums[cluster][2] += pixel[2];
      sums[cluster][3] += 1;
    });
    centers = sums.map((sum, i) => (sum[3] > 0 ? [sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3]] : centers[i]));
  }

  const counts = new Array(k).fill(0);
  assignments.forEach((cluster) => {
    counts[cluster] += 1;
  });

  return centers.map((color, i) => ({ color, count: counts[i] })).filter((entry) => entry.count > 0);
}

export async function getCoverPalette(coverUrl: string | null): Promise<CoverPalette> {
  if (!coverUrl) return FALLBACK;

  const bytes = await readCoverBytes(coverUrl);
  if (!bytes) return FALLBACK;

  try {
    const { data, info } = await sharp(bytes)
      .resize(24, 24, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixels: RGB[] = [];
    for (let i = 0; i + 2 < data.length; i += info.channels) {
      pixels.push([data[i], data[i + 1], data[i + 2]]);
    }

    const clusters = dominantColors(pixels, 3).sort((a, b) => b.count - a.count);
    const colors = clusters.map((cluster) => rgbToHex(cluster.color));

    // תמונה חד-גונית מאוד (כריכה לבנה, למשל) עשויה להחזיר פחות משלושה
    // אשכולות שנבדלים זה מזה — משלימים מהצבע הדומיננטי ביותר
    while (colors.length < 3) colors.push(colors[0] ?? FALLBACK.colors[0]);

    return { colors: [colors[0], colors[1], colors[2]] };
  } catch (error) {
    console.error('[cover-colors]', error);
    return FALLBACK;
  }
}
