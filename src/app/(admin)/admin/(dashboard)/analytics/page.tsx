import Link from 'next/link';
import { requireScreenPermission } from '@/lib/admin/auth';
import { getAnalyticsSummary } from '@/lib/admin/analytics-queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { AdminIcon } from '@/components/admin/AdminIcons';
import { StatTile } from '@/components/admin/analytics/StatTile';
import { DailyTrendChart } from '@/components/admin/analytics/DailyTrendChart';
import { BarList } from '@/components/admin/analytics/BarList';

export const dynamic = 'force-dynamic';

const RANGE_OPTIONS = [
  { days: 7, label: '7 ימים אחרונים' },
  { days: 30, label: '30 יום אחרונים' },
  { days: 90, label: '90 יום אחרונים' },
];

const LOCALE_NAMES: Record<string, string> = { he: 'עברית', en: 'אנגלית' };

// שני הגוונים הראשונים בסדר הקטגוריאלי המאומת (ראו dataviz) — נבדקו מול
// משטח הכרטיס הבהיר (ניגודיות, הפרדת CVD, סף ראייה רגילה — כולם עוברים).
const VIEWS_COLOR = '#2a78d6';
const VISITORS_COLOR = '#eb6834';

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * דשבורד אנליטיקס עצמאי, מבוסס page_views (ראו 18_page_views.sql) —
 * בלי כלי חיצוני, בלי עוגיית מעקב, ובלי שום קריאה שיוצאת מהדפדפן של
 * המבקר למקום אחר מלבד השרת של האתר עצמו.
 *
 * טווח התאריכים הוא פרמטר כתובת ולא state בצד הלקוח: כך אפשר לשתף
 * קישור לטווח מסוים, וכל התרשימים והמספרים בעמוד תמיד מתייחסים לאותו
 * טווח בדיוק (ראו dataviz: "Filters scope everything below them").
 */
export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  await requireScreenPermission('analytics', 'view');
  const { days: daysParam } = await searchParams;
  const days = RANGE_OPTIONS.some((option) => String(option.days) === daysParam) ? Number(daysParam) : 30;

  const summary = await getAnalyticsSummary(days);
  const hasData = summary.dailySeries.some((point) => point.views > 0);

  return (
    <>
      <AdminHeader
        title="אנליטיקס"
        description="פילוח ומעקב כניסות לאתר — מהמסד של האתר עצמו, בלי כלי חיצוני וללא עוגיות מעקב."
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {RANGE_OPTIONS.map((option) => (
          <Link
            key={option.days}
            href={`/admin/analytics?days=${option.days}`}
            className={`admin-btn ${days === option.days ? 'admin-btn-solid' : 'admin-btn-quiet'}`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <dl className="grid max-w-xl grid-cols-2 gap-4">
        <StatTile label="צפיות בעמודים" value={summary.totalViews.toLocaleString('he-IL')} icon="analytics" />
        <StatTile
          label="מבקרים ייחודיים"
          value={summary.uniqueVisitors.toLocaleString('he-IL')}
          icon="authors"
          hint="גיבוב יומי, לא עוגיה"
        />
      </dl>

      <div className="admin-card mt-8 p-6">
        <h2 className="mb-4 text-small font-bold text-ink">מגמת ביקורים</h2>
        {hasData ? (
          <DailyTrendChart
            data={summary.dailySeries}
            series={[
              { key: 'views', label: 'צפיות', color: VIEWS_COLOR },
              { key: 'uniqueVisitors', label: 'מבקרים ייחודיים', color: VISITORS_COLOR },
            ]}
            tableCaption={`צפיות ומבקרים ייחודיים ליום, ${days} הימים האחרונים`}
          />
        ) : (
          <p className="py-10 text-center text-small text-muted">
            אין עדיין נתוני ביקורים בטווח שנבחר. הנתונים מתחילים להצטבר מרגע הפריסה של הגרסה הזו.
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="admin-card p-6">
          <h2 className="mb-4 text-small font-bold text-ink">עמודים מובילים</h2>
          <BarList
            items={summary.topPages.map((page) => ({ label: page.path, value: page.views }))}
            emptyLabel="אין עדיין מספיק נתונים."
          />
        </section>
        <section className="admin-card p-6">
          <h2 className="mb-4 text-small font-bold text-ink">מקורות הפניה מובילים</h2>
          <BarList
            items={summary.topReferrers.map((referrer) => ({ label: referrer.host, value: referrer.views }))}
            emptyLabel="רוב הביקורים הגיעו ישירות, בלי מפנה מזוהה."
          />
        </section>
      </div>

      {summary.localeBreakdown.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-6 text-small text-ink-soft">
          {summary.localeBreakdown.map((item) => (
            <span key={item.locale}>
              {LOCALE_NAMES[item.locale] ?? item.locale}:{' '}
              <strong className="text-ink">{item.views.toLocaleString('he-IL')}</strong>
            </span>
          ))}
        </div>
      ) : null}

      {/* Google Analytics — פאנל סטטוס, לא עוד גרף: GA4 הוא הרחבה
          אופציונלית שמצטרפת לנתונים העצמאיים למעלה, לא מחליפה אותם. */}
      <div className="admin-card mt-10 p-6">
        <h2 className="mb-3 flex items-center gap-2 text-small font-bold text-ink">
          <AdminIcon name="globe" className="h-4 w-4 text-muted" />
          Google Analytics 4
        </h2>

        {GA_MEASUREMENT_ID ? (
          <>
            <p className="admin-badge admin-badge-success">
              <span className="admin-badge-dot" aria-hidden="true" />
              פעיל — מזהה {GA_MEASUREMENT_ID}
            </p>
            <p className="mt-3 max-w-[60ch] text-small leading-relaxed text-ink-soft">
              הדוחות המלאים של גוגל (מקורות תנועה, מכשירים, משך ביקור ועוד)
              זמינים ב־
              <a
                href="https://analytics.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="link"
              >
                analytics.google.com
              </a>
              . הטמעת אותם דוחות בתוך המסך הזה אפשרית בעתיד, ודורשת הקמת
              חשבון שירות (Service Account) ב־Google Cloud עם הרשאת קריאה
              ל־Analytics Data API על הנכס — שלב חד-פעמי בצד גוגל שאין לנו
              דרך לבצע במקומכם.
            </p>
          </>
        ) : (
          <>
            <p className="admin-badge admin-badge-warning">
              <span className="admin-badge-dot" aria-hidden="true" />
              לא הוגדר
            </p>
            <p className="mt-3 text-small text-ink-soft">
              האנליטיקס העצמאי למעלה עובד גם בלי זה. אם רוצים גם את הדוחות
              של גוגל לצדו:
            </p>
            <ol className="mt-2 list-decimal space-y-1.5 ps-5 text-small text-ink-soft">
              <li>
                יצירת נכס מסוג GA4 ב־
                <a
                  href="https://analytics.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link"
                >
                  Google Analytics
                </a>
                , ותחת &quot;זרימות נתונים&quot; (Data Streams) → אתר.
              </li>
              <li>העתקת ה־Measurement ID (מתחיל ב־G-).</li>
              <li>
                הגדרתו כמשתנה סביבה{' '}
                <code dir="ltr" className="rounded bg-cream-2 px-1.5 py-0.5">
                  NEXT_PUBLIC_GA_MEASUREMENT_ID
                </code>{' '}
                בפריסה, ופריסה מחדש.
              </li>
            </ol>
          </>
        )}
      </div>
    </>
  );
}
