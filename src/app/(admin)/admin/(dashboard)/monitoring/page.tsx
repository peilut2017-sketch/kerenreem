import Link from 'next/link';
import { requireScreenPermission } from '@/lib/admin/auth';
import { listIncidents, runLiveChecks, type LiveCheck } from '@/lib/admin/monitoring-queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { AdminIcon, type AdminIconName } from '@/components/admin/AdminIcons';
import { MonitoringBoard } from '@/components/admin/MonitoringBoard';
import { RevalidateButton } from '@/components/admin/RevalidateButton';

export const dynamic = 'force-dynamic';

/**
 * [1.40] "בריאות המערכת" — התשובה לשאלה "מה קורה עכשיו, ומה קרה".
 *
 * עד כה הניטור דיווח רק בהתראות: מי שלא קיבל מייל לא ידע כלום, ומי
 * שרצה לבדוק היה צריך להתחבר לשרת או לשלוף אסימון ולקרוא JSON. המסך
 * הזה הוא המקום שבו מסתכלים.
 *
 * שני חלקים, ושניהם מכוונים:
 *   • **עכשיו** — הבדיקות רצות בזמן טעינת המסך, מול המסד והאחסון
 *     ממש. אותן בדיקות כמו /api/health/deep, כדי ששני המקומות לא
 *     יוכלו לחלוק על עצמם.
 *   • **מה קרה** — אירועים מהטבלה, עם ציר זמן ומשך.
 *
 * ‏force-dynamic ובלי מטמון בכלל: מסך בריאות שמוגש ממטמון הוא בדיוק
 * הכישלון שהמערכת הזו נבנתה כדי למנוע — 500 שנשמר במטמון נראה תקין.
 *
 * מסך מנהל-על בלבד (ADMIN_ONLY_SCREENS): הוא חושף שמות מארחים, מצב
 * תשתית ומדדים תפעוליים.
 */
export default async function AdminMonitoringPage() {
  await requireScreenPermission('monitoring', 'view');

  const [checks, incidents] = await Promise.all([runLiveChecks(), listIncidents(60)]);

  const failing = checks.filter((check) => check.status === 'fail');
  const warning = checks.filter((check) => check.status === 'warn');
  const overall = failing.length > 0 ? 'fail' : warning.length > 0 ? 'warn' : 'ok';

  return (
    <>
      <AdminHeader
        title="בריאות המערכת"
        description="מצב כל שכבה בנפרד — מסד נתונים, קטלוג, אחסון, דואר — ואירועים שנרשמו. הבדיקות רצות עכשיו, בכל טעינה של המסך, ואינן מוגשות ממטמון."
      />

      {/* שורת המצב הכולל. הצבע נקבע לפי הגרוע מבין הבדיקות, כך שאי
          אפשר לראות "ירוק" בזמן ששכבה אחת נפלה. */}
      <div
        className={`admin-card mb-6 flex flex-wrap items-center gap-3 px-4 py-3 ${
          overall === 'fail'
            ? 'border-s-4 border-s-[var(--admin-danger)]'
            : overall === 'warn'
              ? 'border-s-4 border-s-[var(--admin-warning)]'
              : 'border-s-4 border-s-[var(--admin-success)]'
        }`}
      >
        <span
          className={`admin-badge ${
            overall === 'fail'
              ? 'admin-badge-danger'
              : overall === 'warn'
                ? 'admin-badge-neutral'
                : 'admin-badge-success'
          }`}
        >
          <span className="admin-badge-dot" aria-hidden="true" />
          {overall === 'fail' ? 'יש תקלה' : overall === 'warn' ? 'דורש תשומת לב' : 'הכול תקין'}
        </span>
        <span className="text-small text-ink-soft">
          {overall === 'ok'
            ? 'כל הבדיקות עברו.'
            : [...failing, ...warning].map((check) => `${check.label}: ${check.detail}`).join(' · ')}
        </span>
        <span className="ms-auto text-caption text-muted tabular-nums">
          נבדק {new Intl.DateTimeFormat('he-IL', {
            timeStyle: 'medium',
            timeZone: 'Asia/Jerusalem',
          }).format(new Date())}
        </span>
      </div>

      <section className="mb-8">
        <h2 className="mb-3 font-serif text-h3 text-ink">מצב עכשיו</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {checks.map((check) => (
            <CheckCard key={check.name} check={check} />
          ))}
        </div>
      </section>

      {incidents.error ? (
        <p
          className={`mb-6 border-s-2 px-4 py-3 text-small ${
            incidents.notInstalled
              ? 'border-[var(--admin-warning)] bg-[var(--admin-warning-soft)] text-[var(--admin-warning)]'
              : 'border-burgundy bg-cream-2 text-burgundy'
          }`}
        >
          {incidents.error}
        </p>
      ) : null}

      <MonitoringBoard incidents={incidents.incidents} />

      {/* מה שהמסך הזה *אינו* עושה, ולמה — כדי שלא יחפשו כאן כפתור
          שלא קיים בכוונה. */}
      <section className="admin-card mt-8 px-4 py-4">
        <h2 className="mb-2 font-serif text-h3 text-ink">מה נמצא איפה</h2>
        <ul className="space-y-1.5 text-small text-ink-soft">
          <li>
            <span className="text-muted">מדדי שרת, דיסק, קונטיינרים ו-PostgreSQL: </span>
            במחסנית הניטור שרצה על מכונה נפרדת (Prometheus ו-Uptime Kuma). היא נפרדת בכוונה —
            ניטור שיושב על השרת החולה שותק בדיוק כשצריך אותו.
          </li>
          <li>
            <span className="text-muted">בדיקה חיצונית בפורמט JSON: </span>
            <code dir="ltr">/api/health</code> (פתוחה) ו-<code dir="ltr">/api/health/deep</code>{' '}
            (מוגנת בסוד).
          </li>
          <li>
            <span className="text-muted">מדריכי טיפול בתקלות: </span>
            <code dir="ltr">docs/monitoring/runbooks/</code> במאגר הקוד.
          </li>
          <li>
            <span className="text-muted">תיקון אוטומטי: </span>
            אין, במכוון. המערכת מתריעה ומתעדת; אדם מחליט ופועל לפי המדריך. מערכת שמתקנת
            בעצמה היא מערכת שיכולה גם להזיק בעצמה.
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-rule pt-4">
          <Link href="/admin/diagnostics" className="admin-btn admin-btn-quiet">
            <AdminIcon name="diagnostics" className="h-4 w-4" />
            אבחון התקנה
          </Link>
          <Link href="/admin/email" className="admin-btn admin-btn-quiet">
            <AdminIcon name="messages" className="h-4 w-4" />
            דואר יוצא
          </Link>
        </div>
      </section>

      {/* רענון המטמון הציבורי — הפעולה שסוגרת את המקרה של "התשתית
          חזרה אבל העמוד עדיין מציג שגיאה שנשמרה במטמון". רכיב עם
          פריסה משלו, ולכן בלוק נפרד ולא כפתור בשורה שמעל. */}
      <div className="mt-6">
        <RevalidateButton />
      </div>
    </>
  );
}

const STATUS_STYLE: Record<LiveCheck['status'], { badge: string; icon: AdminIconName; label: string }> = {
  ok: { badge: 'admin-badge-success', icon: 'check', label: 'תקין' },
  warn: { badge: 'admin-badge-neutral', icon: 'warning', label: 'שימו לב' },
  fail: { badge: 'admin-badge-danger', icon: 'warning', label: 'תקלה' },
  skipped: { badge: 'admin-badge-neutral', icon: 'x', label: 'לא נבדק' },
};

function CheckCard({ check }: { check: LiveCheck }) {
  const style = STATUS_STYLE[check.status];
  return (
    <div className="admin-card p-4">
      <div className="flex items-center gap-2">
        <span className={`admin-badge ${style.badge}`}>
          <AdminIcon name={style.icon} className="h-3.5 w-3.5" />
          {style.label}
        </span>
        <span className="ms-auto text-caption text-muted tabular-nums">{check.durationMs}ms</span>
      </div>
      <h3 className="mt-2 text-body font-semibold text-ink">{check.label}</h3>
      {check.value != null ? (
        <p dir="auto" className="mt-0.5 font-serif text-h3 text-ink">
          {check.value}
        </p>
      ) : null}
      {check.detail ? <p className="mt-1 text-caption text-muted">{check.detail}</p> : null}
    </div>
  );
}
