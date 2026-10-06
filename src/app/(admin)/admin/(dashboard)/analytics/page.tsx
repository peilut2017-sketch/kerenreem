import Link from 'next/link';
import { requireScreenPermission } from '@/lib/admin/auth';
import {
  getBookStats,
  getBreakdown,
  getDaily,
  getFlow,
  getHours,
  getOutbound,
  getOverview,
  getPages,
  type AnalyticsOverview,
  type BreakdownRow,
} from '@/lib/admin/analytics-queries';
import { RANGE_PRESETS, parseRangeParam, percentChange, previousPeriod, rangeFromDays } from '@/lib/admin/reporting/date-range';
import { AdminHeader } from '@/components/admin/AdminList';
import { AdminIcon } from '@/components/admin/AdminIcons';
import { StatTile } from '@/components/admin/analytics/StatTile';
import { DailyTrendChart } from '@/components/admin/analytics/DailyTrendChart';
import { BarList } from '@/components/admin/analytics/BarList';
import { AnalyticsTable } from '@/components/admin/analytics/AnalyticsTable';
import { HoursHeatmap } from '@/components/admin/analytics/HoursHeatmap';
import { NoTrackToggle } from '@/components/admin/analytics/NoTrackToggle';
import { CsvDownloadButton } from '@/components/admin/reporting/CsvDownloadButton';

export const dynamic = 'force-dynamic';

const VIEWS = [
  { key: 'overview', label: 'סקירה' },
  { key: 'pages', label: 'עמודים' },
  { key: 'sources', label: 'מקורות תנועה' },
  { key: 'outbound', label: 'יציאות מהאתר' },
  { key: 'books', label: 'ספרים' },
  { key: 'audience', label: 'קהל ושעות' },
] as const;
type ViewKey = (typeof VIEWS)[number]['key'];

const CHANNEL_LABELS: Record<string, string> = {
  direct: 'ישיר (הקלדה / אפליקציה)',
  organic_search: 'חיפוש (גוגל וכד׳)',
  social: 'רשתות חברתיות',
  email: 'דוא״ל',
  referral: 'אתרים מפנים',
  paid: 'מודעות ממומנות',
  campaign: 'קמפיין (UTM)',
};
const DEVICE_LABELS: Record<string, string> = {
  mobile: 'נייד',
  tablet: 'טאבלט',
  desktop: 'מחשב',
  unknown: 'לא ידוע',
};
const LOCALE_LABELS: Record<string, string> = { he: 'עברית', en: 'אנגלית' };

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

const VIEWS_COLOR = '#2a78d6';
const SESSIONS_COLOR = '#eb6834';

const n = (value: number) => Math.round(value).toLocaleString('he-IL');

function duration(seconds: number | null): string {
  if (seconds === null) return '—';
  if (seconds < 60) return `${Math.round(seconds)} שנ׳`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.round(seconds % 60)).padStart(2, '0')} דק׳`;
}

function percent(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

function countryName(code: string): string {
  if (code === 'unknown') return 'לא ידוע';
  try {
    return new Intl.DisplayNames(['he'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

function delta(current: number, previous: number): string | undefined {
  const change = percentChange(current, previous);
  if (change === null) return 'אין נתוני השוואה';
  return `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(0)}% מהתקופה הקודמת`;
}

const bars = (rows: BreakdownRow[], label: (value: string) => string = (value) => value) =>
  rows.map((row) => ({ label: label(row.label), value: row.views }));

/**
 * דשבורד אנליטיקס עצמאי — page_views / outbound_clicks / commerce_events
 * (ראו 18_page_views.sql, 57_analytics_v2.sql): בלי כלי חיצוני, בלי עוגיית
 * מעקב, ובלי שום קריאה שיוצאת מהדפדפן של המבקר למקום אחר מלבד השרת של
 * האתר עצמו. הצבירה במסד, לא בזיכרון — ראו analytics-queries.ts.
 *
 * הטווח והלשונית הם פרמטרי כתובת ולא state בצד הלקוח: אפשר לשתף קישור,
 * וכל המספרים בעמוד מתייחסים תמיד לאותו טווח.
 */
export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; view?: string }>;
}) {
  await requireScreenPermission('analytics', 'view');
  const params = await searchParams;
  const days = parseRangeParam(params.days);
  const view: ViewKey = VIEWS.some((v) => v.key === params.view) ? (params.view as ViewKey) : 'overview';
  const range = rangeFromDays(days);

  const href = (nextView: ViewKey, nextDays: number) => `/admin/analytics?view=${nextView}&days=${nextDays}`;

  let body: React.ReactNode;
  let failed = false;
  try {
    body = await renderView(view, range, days);
  } catch {
    failed = true;
  }

  return (
    <>
      <AdminHeader
        title="אנליטיקס"
        description="פילוח ומעקב כניסות לאתר — מהמסד של האתר עצמו, בלי כלי חיצוני וללא עוגיות מעקב."
      />

      <nav aria-label="לשוניות אנליטיקס" className="mb-3 flex flex-wrap gap-2">
        {VIEWS.map((item) => (
          <Link
            key={item.key}
            href={href(item.key, days)}
            aria-current={item.key === view ? 'page' : undefined}
            className="admin-chip"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mb-6 flex flex-wrap items-center gap-2" aria-label="טווח הדוח">
        {RANGE_PRESETS.map((preset) => (
          <Link
            key={preset}
            href={href(view, preset)}
            aria-current={preset === days ? 'true' : undefined}
            className="admin-btn admin-btn-quiet"
          >
            {preset === 365 ? 'שנה' : `${preset} ימים`}
          </Link>
        ))}
      </div>

      {failed ? (
        <p role="alert" className="admin-card px-5 py-4 text-small text-[var(--admin-danger)]">
          לא ניתן לקרוא את נתוני האנליטיקס. ודאו שהמיגרציה <code dir="ltr">57_analytics_v2.sql</code> הורצה על המסד,
          ובדקו את יומן השרת.
        </p>
      ) : (
        body
      )}

      <GoogleAnalyticsPanel />
    </>
  );
}

/**
 * הלשוניות נקראות כפונקציות (await) ולא כרכיבי <JSX />: כך שגיאת שאילתה
 * נזרקת כאן, בתוך ה-try של העמוד, ומוצגת כהודעה — ולא כמסך שגיאה כללי.
 */
async function renderView(view: ViewKey, range: Range, days: number) {
  switch (view) {
    case 'pages':
      return await PagesView({ range, days });
    case 'sources':
      return await SourcesView({ range });
    case 'outbound':
      return await OutboundView({ range, days });
    case 'books':
      return await BooksView({ range, days });
    case 'audience':
      return await AudienceView({ range });
    default:
      return await OverviewView({ range, days });
  }
}

type Range = ReturnType<typeof rangeFromDays>;

/* -------------------------------------------------------------------------- */

async function OverviewView({ range, days }: { range: Range; days: number }) {
  const [overview, previous, daily, pages, channels, devices] = await Promise.all([
    getOverview(range),
    getOverview(previousPeriod(range)),
    getDaily(range),
    getPages(range, 10),
    getBreakdown(range, 'channel', 8),
    getBreakdown(range, 'device', 4),
  ]);
  const hasData = daily.some((point) => point.views > 0);

  return (
    <>
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile label="צפיות בעמודים" value={n(overview.views)} icon="analytics" hint={delta(overview.views, previous.views)} />
        <StatTile label="סשנים (ביקורים)" value={n(overview.sessions)} icon="view" hint={delta(overview.sessions, previous.sessions)} />
        <StatTile
          label="מבקרים (ימי-מבקר)"
          value={n(overview.visitorDays)}
          icon="authors"
          hint="גיבוב יומי — אדם שחזר בשני ימים נספר פעמיים"
        />
        <StatTile label="זמן ממוצע בביקור" value={duration(overview.avgSessionSeconds || null)} icon="events" hint="רק זמן שהלשונית גלויה" />
        <StatTile label="נטישה" value={percent(overview.bounceRate)} icon="back" hint="עמוד אחד ופחות מ־10 שניות" />
        <StatTile label="עמודים לביקור" value={overview.pagesPerSession.toFixed(1)} icon="pages" />
      </dl>

      <div className="admin-card mt-8 p-6">
        <h2 className="mb-4 text-small font-bold text-ink">מגמה יומית (זמן ישראל)</h2>
        {hasData ? (
          <DailyTrendChart
            data={daily}
            series={[
              { key: 'views', label: 'צפיות', color: VIEWS_COLOR },
              { key: 'sessions', label: 'סשנים', color: SESSIONS_COLOR },
            ]}
            tableCaption={`צפיות וסשנים ליום, ${days} הימים האחרונים`}
          />
        ) : (
          <p className="py-10 text-center text-small text-muted">אין עדיין נתוני ביקורים בטווח שנבחר.</p>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="admin-card p-6">
          <h2 className="mb-4 text-small font-bold text-ink">עמודים מובילים</h2>
          <BarList items={pages.map((page) => ({ label: page.path, value: page.views }))} emptyLabel="אין עדיין מספיק נתונים." />
        </section>
        <section className="admin-card p-6">
          <h2 className="mb-4 text-small font-bold text-ink">איך הגיעו (כניסות לפי ערוץ)</h2>
          <BarList
            items={bars(channels, (value) => CHANNEL_LABELS[value] ?? value)}
            emptyLabel="נתוני מקור נאספים מרגע הפריסה של הגרסה הזו."
          />
        </section>
      </div>

      <section className="admin-card mt-6 p-6">
        <h2 className="mb-4 text-small font-bold text-ink">מכשירים</h2>
        <BarList items={bars(devices, (value) => DEVICE_LABELS[value] ?? value)} emptyLabel="אין עדיין מספיק נתונים." />
      </section>

      <DataHealth overview={overview} />
    </>
  );
}

/* -------------------------------------------------------------------------- */

async function PagesView({ range, days }: { range: Range; days: number }) {
  const [pages, flow] = await Promise.all([getPages(range, 200), getFlow(range, 25)]);

  return (
    <>
      <section className="admin-card p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-small font-bold text-ink">כל העמודים — כניסות, שהייה, גלילה ויציאות</h2>
          <CsvDownloadButton
            headers={['עמוד', 'צפיות', 'סשנים', 'זמן ממוצע (שניות)', 'גלילה ממוצעת (%)', 'כניסות', 'יציאות']}
            rows={pages.map((p) => [
              p.path,
              p.views,
              p.sessions,
              p.avgSeconds === null ? '' : Math.round(p.avgSeconds),
              p.avgScroll === null ? '' : Math.round(p.avgScroll),
              p.entries,
              p.exits,
            ])}
            filename={`analytics-pages-${days}d.csv`}
          />
        </div>
        <AnalyticsTable
          headers={['עמוד', 'צפיות', 'סשנים', 'זמן ממוצע', 'גלילה', 'כניסות', 'יציאות', '% יציאה']}
          numeric={[1, 2, 3, 4, 5, 6, 7]}
          rows={pages.map((p) => [
            <span key="p" dir="ltr" className="break-all">
              {p.path}
            </span>,
            n(p.views),
            n(p.sessions),
            duration(p.avgSeconds),
            p.avgScroll === null ? '—' : `${Math.round(p.avgScroll)}%`,
            n(p.entries),
            n(p.exits),
            p.views > 0 ? percent(p.exits / p.views) : '—',
          ])}
        />
        <p className="mt-3 text-caption text-muted">
          כניסות = העמוד הראשון בביקור; יציאות = העמוד האחרון בביקור. זמן וגלילה נמדדים רק מצפיות שנאספו מרגע הפריסה
          של v2, ורק כשהלשונית גלויה. נתונים בלי מדידה מוצגים כ־—.
        </p>
      </section>

      <section className="admin-card mt-6 p-6">
        <h2 className="mb-4 text-small font-bold text-ink">זרימה בין עמודים (המעברים הנפוצים)</h2>
        <AnalyticsTable
          headers={['מעמוד', 'לעמוד', 'מעברים']}
          numeric={[2]}
          rows={flow.map((row) => [
            <span key="f" dir="ltr">
              {row.from}
            </span>,
            <span key="t" dir="ltr">
              {row.to}
            </span>,
            n(row.transitions),
          ])}
        />
      </section>
    </>
  );
}

/* -------------------------------------------------------------------------- */

async function SourcesView({ range }: { range: Range }) {
  const [channels, referrers, sources, mediums, campaigns, entryPages] = await Promise.all([
    getBreakdown(range, 'channel', 10),
    getBreakdown(range, 'referrer', 20),
    getBreakdown(range, 'utm_source', 15),
    getBreakdown(range, 'utm_medium', 15),
    getBreakdown(range, 'utm_campaign', 15),
    getBreakdown(range, 'entry_path', 15),
  ]);

  return (
    <>
      <p className="mb-4 max-w-[70ch] text-caption text-muted">
        המקורות נמדדים לפי הכניסה הראשונה בכל ביקור (סשן) בלבד. כניסה בלי מפנה נספרת כ״ישירה״ — כולל קישורים
        מוואטסאפ, מאפליקציות ומדוא״ל שלא מעבירים מפנה. לקישורים שמפיצים בעצמכם הוסיפו{' '}
        <code dir="ltr">?utm_source=…&amp;utm_medium=…&amp;utm_campaign=…</code> כדי לראות אותם כאן בנפרד.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="ערוצי הגעה">
          <BarList items={bars(channels, (value) => CHANNEL_LABELS[value] ?? value)} emptyLabel="אין עדיין מספיק נתונים." />
        </Panel>
        <Panel title="אתרים מפנים">
          <BarList items={bars(referrers)} emptyLabel="אין עדיין כניסות מאתרים מפנים." />
        </Panel>
        <Panel title="קמפיינים (utm_campaign)">
          <BarList items={bars(campaigns)} emptyLabel="אין קישורים עם פרמטרי UTM." />
        </Panel>
        <Panel title="מקור (utm_source)">
          <BarList items={bars(sources)} emptyLabel="אין קישורים עם פרמטרי UTM." />
        </Panel>
        <Panel title="מדיום (utm_medium)">
          <BarList items={bars(mediums)} emptyLabel="אין קישורים עם פרמטרי UTM." />
        </Panel>
        <Panel title="עמודי נחיתה (כניסה ראשונה)">
          <BarList items={bars(entryPages)} emptyLabel="אין עדיין מספיק נתונים." />
        </Panel>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

async function OutboundView({ range, days }: { range: Range; days: number }) {
  const rows = await getOutbound(range);

  const externalByHost = new Map<string, { clicks: number; sessions: number; pages: Map<string, number> }>();
  const totals = { tel: 0, mailto: 0, download: 0 };
  const downloads = new Map<string, number>();
  for (const row of rows) {
    if (row.kind === 'external' && row.target) {
      const entry = externalByHost.get(row.target) ?? { clicks: 0, sessions: 0, pages: new Map() };
      entry.clicks += row.clicks;
      entry.sessions += row.sessions;
      entry.pages.set(row.fromPath, (entry.pages.get(row.fromPath) ?? 0) + row.clicks);
      externalByHost.set(row.target, entry);
    } else if (row.kind === 'download' && row.target) {
      totals.download += row.clicks;
      downloads.set(row.target, (downloads.get(row.target) ?? 0) + row.clicks);
    } else if (row.kind === 'tel' || row.kind === 'mailto') {
      totals[row.kind] += row.clicks;
    }
  }
  const hosts = [...externalByHost.entries()].sort((a, b) => b[1].clicks - a[1].clicks);
  const topPages = (pages: Map<string, number>) =>
    [...pages.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([path, clicks]) => `${path} (${clicks})`)
      .join(' · ');

  return (
    <>
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="יציאות לאתרים חיצוניים" value={n(hosts.reduce((sum, [, e]) => sum + e.clicks, 0))} icon="external" />
        <StatTile label="לחיצות על טלפון" value={n(totals.tel)} icon="messages" hint="כולל הזמנה טלפונית" />
        <StatTile label="לחיצות על דוא״ל" value={n(totals.mailto)} icon="messages" />
        <StatTile label="הורדות קבצים" value={n(totals.download)} icon="upload" />
      </dl>

      <section className="admin-card mt-6 p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-small font-bold text-ink">לאיזה אתרים יצאו</h2>
          <CsvDownloadButton
            headers={['סוג', 'יעד', 'עמוד מקור', 'לחיצות', 'סשנים']}
            rows={rows.map((r) => [r.kind, r.target ?? '', r.fromPath, r.clicks, r.sessions])}
            filename={`analytics-outbound-${days}d.csv`}
          />
        </div>
        <AnalyticsTable
          headers={['אתר יעד', 'לחיצות', 'סשנים', 'מאילו עמודים']}
          numeric={[1, 2]}
          rows={hosts.map(([host, entry]) => [
            <span key="h" dir="ltr">
              {host}
            </span>,
            n(entry.clicks),
            n(entry.sessions),
            <span key="p" dir="ltr" className="text-caption text-muted">
              {topPages(entry.pages)}
            </span>,
          ])}
          emptyLabel="עדיין לא נרשמו יציאות. נאספות מרגע הפריסה של הגרסה הזו."
        />
        <p className="mt-3 text-caption text-muted">
          נשמר שם האתר בלבד (לא הכתובת המלאה), ובלחיצה על טלפון/דוא״ל נשמר רק סוג הלחיצה — לא המספר או הכתובת. לחיצה
          על קישור ספק חיצוני מקושרת גם לספר שממנו יצאו (לשונית ״ספרים״).
        </p>
      </section>

      {downloads.size > 0 ? (
        <section className="admin-card mt-6 p-6">
          <h2 className="mb-4 text-small font-bold text-ink">קבצים שהורדו</h2>
          <BarList
            items={[...downloads.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([path, clicks]) => ({ label: path, value: clicks }))}
            emptyLabel=""
          />
        </section>
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */

async function BooksView({ range, days }: { range: Range; days: number }) {
  const stats = await getBookStats(range);
  const top = stats.slice(0, 25);

  return (
    <section className="admin-card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-small font-bold text-ink">ספרים — מצפייה ועד פעולה</h2>
        <div className="flex items-center gap-2">
          <Link href={`/admin/reports/books?days=${days}`} className="admin-btn admin-btn-quiet">
            דוח מלא כולל מכירות
          </Link>
          <CsvDownloadButton
            headers={['ספר', 'צפיות', 'סשנים', 'זמן ממוצע (שניות)', 'שמירות', 'מכשירים ששמרו', 'הוספות לסל', 'מכשירים שהוסיפו', 'לחיצות לספק', 'מכשירים שעברו לספק']}
            rows={stats.map((s) => [
              s.title,
              s.views,
              s.viewers,
              s.avgSeconds === null ? '' : Math.round(s.avgSeconds),
              s.saves,
              s.saveDevices,
              s.cartAdds,
              s.cartDevices,
              s.supplierClicks,
              s.supplierDevices,
            ])}
            filename={`analytics-books-${days}d.csv`}
          />
        </div>
      </div>
      <AnalyticsTable
        headers={['ספר', 'צפיות', 'זמן בעמוד', 'שמירות', 'הוספות לסל', 'מעבר לספק חיצוני', '% צפייה→סל']}
        numeric={[1, 2, 3, 4, 5, 6]}
        rows={top.map((s) => [
          <Link key="t" href={`/admin/books/${s.bookId}`} className="link">
            {s.title}
          </Link>,
          `${n(s.views)} (${n(s.viewers)})`,
          duration(s.avgSeconds),
          s.saves === 0 ? '0' : `${n(s.saves)} (${n(s.saveDevices)})`,
          s.cartAdds === 0 ? '0' : `${n(s.cartAdds)} (${n(s.cartDevices)})`,
          s.supplierClicks === 0 ? '0' : `${n(s.supplierClicks)} (${n(s.supplierDevices)})`,
          s.viewers > 0 ? percent(s.cartDevices / s.viewers) : '—',
        ])}
        emptyLabel="אין עדיין נתוני ספרים בטווח."
      />
      <p className="mt-3 text-caption text-muted">
        מוצגים 25 הספרים הנצפים ביותר (הייצוא כולל את כולם). בסוגריים: סשנים או מכשירים ייחודיים. שמירה נספרת כשמוסיפים
        ספר ל״שמורים״; ״מעבר לספק חיצוני״ — לחיצה על כפתור הרכישה אצל ספק. ביטול שמירה אינו נספר.
      </p>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

async function AudienceView({ range }: { range: Range }) {
  const [devices, countries, locales, hours] = await Promise.all([
    getBreakdown(range, 'device', 5),
    getBreakdown(range, 'country', 12),
    getBreakdown(range, 'locale', 4),
    getHours(range),
  ]);

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="מכשירים">
          <BarList items={bars(devices, (value) => DEVICE_LABELS[value] ?? value)} emptyLabel="אין עדיין מספיק נתונים." />
        </Panel>
        <Panel title="מדינות">
          <BarList items={bars(countries, countryName)} emptyLabel="אין עדיין מספיק נתונים." />
        </Panel>
        <Panel title="שפת האתר">
          <BarList items={bars(locales, (value) => LOCALE_LABELS[value] ?? value)} emptyLabel="אין עדיין מספיק נתונים." />
        </Panel>
      </div>
      <Panel title="מתי גולשים (זמן ישראל)" className="mt-6">
        <HoursHeatmap cells={hours} />
      </Panel>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Panel({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`admin-card p-6 ${className}`}>
      <h2 className="mb-4 text-small font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

/** מצב הנתונים + ההסבר לפערים מול Google Analytics — כדי שפער לא ייקרא כ״באג״. */
function DataHealth({ overview }: { overview: AnalyticsOverview }) {
  return (
    <details className="admin-card mt-6 p-6">
      <summary className="cursor-pointer text-small font-bold text-ink">
        למה המספרים כאן שונים מ־Google Analytics, ואיכות הנתונים
      </summary>
      <div className="mt-4 space-y-3 text-small leading-relaxed text-ink-soft">
        <p>
          <strong className="text-ink">בוטים:</strong> {n(overview.botViews)} צפיות זוהו כבוטים/כלי ניטור והוחרגו
          מהמספרים בעמוד. בגרסה הקודמת הן נספרו, וגם הניטור הסינתטי של האתר.
        </p>
        <ul className="list-disc space-y-1.5 ps-5">
          <li>
            <strong className="text-ink">הסכמה לעוגיות.</strong> GA4 נטען רק למי שאישר עוגיות, וחוסמי פרסומות חוסמים
            אותו. האנליטיקס כאן אינו תלוי בהסכמה, ולכן יציג בדרך כלל <em>יותר</em> מ־GA.
          </li>
          <li>
            <strong className="text-ink">מבקרים:</strong> כאן אין מזהה קבוע (בכוונה, לפרטיות), ולכן ״מבקרים״ הם
            ימי-מבקר — אדם שחזר בשני ימים נספר פעמיים. GA סופר ״משתמשים״ לפי מזהה קבוע. להשוואה השתמשו ב״סשנים״.
          </li>
          <li>
            <strong className="text-ink">אזור זמן.</strong> כאן כל חלוקה ליום היא לפי שעון ישראל. ודאו שבנכס ה־GA
            מוגדר אזור זמן Asia/Jerusalem (ניהול ← הגדרות נכס).
          </li>
          <li>
            <strong className="text-ink">סשן</strong> מסתיים אחרי 30 דקות ללא פעילות, כמו ב־GA.
          </li>
          <li>
            <strong className="text-ink">צוות האתר.</strong> גלישת הצוות נספרת אלא אם סימנתם למטה ״אל תספור״ בכל
            דפדפן שבו אתם גולשים.
          </li>
        </ul>
        <p>
          <strong className="text-ink">תיקון:</strong> הספירה שנעצרה על 1,000 נבעה מכך שהמסך קרא את הנתונים בשאילתה
          שנחתכת בשקט ב־1,000 שורות. הנתונים עצמם נשמרו במלואם; עכשיו הצבירה נעשית במסד ולכן הספירה מלאה גם על נתוני
          העבר.
        </p>
        <p>
          <strong className="text-ink">מה חדש:</strong> זמן שהייה, גלילה, ערוץ הגעה, מכשיר, מדינה, יציאות ועמוד קודם
          נאספים רק מרגע הפריסה של v2 — בנתוני העבר הם יופיעו כ־״—״. נמדדו {percent(overview.measuredShare)} מהצפיות
          בטווח.
        </p>
        <div className="border-t border-line pt-3">
          <NoTrackToggle />
        </div>
      </div>
    </details>
  );
}

function GoogleAnalyticsPanel() {
  return (
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
          <p className="mt-3 max-w-[70ch] text-small leading-relaxed text-ink-soft">
            הדוחות המלאים של גוגל זמינים ב־
            <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="link">
              analytics.google.com
            </a>
            . בנוסף למדידה האוטומטית של גוגל (עמודים, מקורות, מכשירים, גלילה, לחיצות יוצאות והורדות), האתר שולח
            ל־GA4 אירועים לפי ההמלצה הרשמית לחנויות: <code dir="ltr">view_item</code> (צפייה בספר),{' '}
            <code dir="ltr">add_to_wishlist</code> (שמירה), <code dir="ltr">add_to_cart</code> (הוספה לסל), ואירועים
            מותאמים <code dir="ltr">supplier_click</code> (מעבר לספק חיצוני), <code dir="ltr">tel_click</code> ו־
            <code dir="ltr">mailto_click</code>. לצפייה בהם תחת ״אירועים״; לסימון כאירועי מפתח (Key events) ולהגדרת
            פרמטר <code dir="ltr">supplier</code> כמימד מותאם — Admin ← Events / Custom definitions. האירועים נשלחים
            רק למי שאישר עוגיות.
          </p>
        </>
      ) : (
        <>
          <p className="admin-badge admin-badge-warning">
            <span className="admin-badge-dot" aria-hidden="true" />
            לא הוגדר
          </p>
          <p className="mt-3 text-small text-ink-soft">
            האנליטיקס העצמאי למעלה עובד גם בלי זה. אם רוצים גם את הדוחות של גוגל לצדו:
          </p>
          <ol className="mt-2 list-decimal space-y-1.5 ps-5 text-small text-ink-soft">
            <li>
              יצירת נכס מסוג GA4 ב־
              <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="link">
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
  );
}
