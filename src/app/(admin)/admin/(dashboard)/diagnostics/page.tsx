import { requireRole } from '@/lib/admin/auth';
import { createClient } from '@/lib/supabase/server';
import { AdminHeader } from '@/components/admin/AdminList';

export const dynamic = 'force-dynamic';

/**
 * אבחון חיבור והרשאות.
 *
 * "השמירה נכשלת" יכולה לנבוע מטבלה חסרה, מהרשאת תפקיד חסרה, ממדיניות RLS
 * או מ-bucket שלא נוצר — וכולן נראות אותו דבר במסך. העמוד הזה מבצע את
 * הפעולות עצמן ומדווח מה בדיוק קרה.
 *
 * הכתיבה נעשית בטרנזקציית ניסיון: מוסיפים שורה עם slug ייחודי, ומיד
 * מוחקים אותה. אם ההוספה נכשלת — זו התשובה שחיפשנו.
 */

const TABLES = [
  'books', 'authors', 'categories', 'events', 'activities',
  'pages', 'banners', 'site_settings', 'contact_messages', 'audit_log', 'profiles',
] as const;

const BUCKETS = ['covers', 'events', 'portraits', 'samples', 'site'] as const;

type Check = { label: string; ok: boolean; detail: string };

/**
 * מזהה ייחודי לרשומת הבדיקה.
 * מופרד לפונקציה כדי ש-Date.now() לא ייקרא בגוף רכיב — קריאה לפונקציה
 * לא-טהורה בזמן רינדור מייצרת תוצאות שאינן יציבות בין רינדורים.
 */
function makeProbeSlug(): string {
  return `diagnostic-probe-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default async function DiagnosticsPage() {
  const session = await requireRole('admin');
  const supabase = await createClient();

  if (!supabase) {
    return (
      <>
        <AdminHeader title="אבחון" />
        <p className="text-burgundy">אין חיבור למסד: משתני הסביבה חסרים.</p>
      </>
    );
  }

  /* --- 1. קריאה מכל טבלה --- */
  const reads: Check[] = await Promise.all(
    TABLES.map(async (table): Promise<Check> => {
      const { error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (!error) return { label: table, ok: true, detail: `${count ?? 0} שורות` };
      return {
        label: table,
        ok: false,
        detail: `${error.code ?? '—'}: ${error.message}`,
      };
    }),
  );

  /* --- 2. ניסיון כתיבה אמיתי --- */
  const probeSlug = makeProbeSlug();
  const writeChecks: Check[] = [];

  const insert = await supabase
    .from('authors')
    .insert({ slug: probeSlug, name_he: 'בדיקת אבחון', is_published: false })
    .select('id')
    .maybeSingle();

  if (insert.error) {
    writeChecks.push({
      label: 'הוספת רשומה (authors)',
      ok: false,
      detail: `${insert.error.code ?? '—'}: ${insert.error.message}`,
    });
  } else if (!insert.data) {
    writeChecks.push({
      label: 'הוספת רשומה (authors)',
      ok: false,
      detail: 'ההוספה לא החזירה שורה — ככל הנראה מדיניות RLS מסתירה אותה בקריאה חוזרת.',
    });
  } else {
    writeChecks.push({ label: 'הוספת רשומה (authors)', ok: true, detail: 'הצליחה' });

    const del = await supabase.from('authors').delete().eq('id', insert.data.id);
    writeChecks.push({
      label: 'מחיקת רשומת הבדיקה',
      ok: !del.error,
      detail: del.error ? `${del.error.code ?? '—'}: ${del.error.message}` : 'נמחקה',
    });
  }

  const audit = await supabase.from('audit_log').insert({
    user_id: session.userId,
    action: 'insert',
    table_name: 'diagnostics',
    record_id: null,
  });
  writeChecks.push({
    label: 'רישום ביומן הביקורת',
    ok: !audit.error,
    detail: audit.error
      ? `${audit.error.code ?? '—'}: ${audit.error.message} — הריצו 02_site_additions.sql`
      : 'הצליח',
  });

  /* --- 3. אחסון קבצים --- */
  const { data: bucketList, error: bucketError } = await supabase.storage.listBuckets();
  const bucketNames = new Set((bucketList ?? []).map((bucket) => bucket.name));
  const storage: Check[] = bucketError
    ? [{ label: 'רשימת buckets', ok: false, detail: bucketError.message }]
    : BUCKETS.map((name) => ({
        label: name,
        ok: bucketNames.has(name),
        detail: bucketNames.has(name) ? 'קיים' : 'חסר — הריצו 02_site_additions.sql',
      }));

  const allOk =
    reads.every((c) => c.ok) && writeChecks.every((c) => c.ok) && storage.every((c) => c.ok);

  return (
    <>
      <AdminHeader
        title="אבחון"
        description="בודק בפועל קריאה, כתיבה ואחסון — ומדווח את קוד השגיאה המדויק מהמסד."
      />

      <p
        className={`mb-8 border-s-2 px-4 py-3 text-small ${
          allOk ? 'border-rule-strong bg-cream-2' : 'border-burgundy bg-cream-2'
        }`}
      >
        {allOk
          ? 'כל הבדיקות עברו. אם שמירה עדיין נכשלת — שלחו את הודעת השגיאה המופיעה בטופס עצמו.'
          : 'נמצאו כשלים. הפרטים למטה כוללים את קוד השגיאה של Postgres.'}
      </p>

      <Section title="הרשאת כתיבה — ניסיון אמיתי" checks={writeChecks} />
      <Section title="קריאה מהטבלאות" checks={reads} />
      <Section title="אחסון קבצים" checks={storage} />

      <section className="mt-10 border-t border-rule pt-6">
        <h2 className="eyebrow mb-3">משמעות קודי השגיאה</h2>
        <dl className="space-y-2 text-small text-ink-soft">
          <Code code="42501" meaning="אין הרשאה לטבלה. הריצו supabase/06_restore_grants.sql." />
          <Code code="42P01" meaning="הטבלה אינה קיימת. הריצו את קובצי הסכימה לפי הסדר." />
          <Code code="23505" meaning="ערך כפול — בדרך כלל מזהה כתובת (slug) שכבר קיים." />
          <Code code="23503" meaning="הפניה לרשומה שאינה קיימת (מחבר או קטגוריה שנמחקו)." />
          <Code code="23514" meaning="ערך שאינו עומד בכללי המסד (אורך שדה, טווח מספרי)." />
        </dl>
      </section>
    </>
  );
}

function Section({ title, checks }: { title: string; checks: Check[] }) {
  return (
    <section className="mb-10">
      <h2 className="eyebrow mb-3">{title}</h2>
      <ul className="border-t border-rule">
        {checks.map((check) => (
          <li
            key={check.label}
            className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-rule py-2.5 text-small"
          >
            <span
              aria-hidden="true"
              className={`w-4 shrink-0 font-semibold ${check.ok ? 'text-gold-deep' : 'text-burgundy'}`}
            >
              {check.ok ? '✓' : '✗'}
            </span>
            <span className="min-w-40 font-semibold">
              {check.label}
              <span className="sr-only">{check.ok ? ' — תקין' : ' — נכשל'}</span>
            </span>
            <span className={check.ok ? 'text-muted' : 'text-burgundy'} dir="auto">
              {check.detail}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Code({ code, meaning }: { code: string; meaning: string }) {
  return (
    <div className="flex flex-wrap gap-x-3">
      <dt className="font-mono font-semibold" dir="ltr">
        {code}
      </dt>
      <dd className="text-muted">{meaning}</dd>
    </div>
  );
}
