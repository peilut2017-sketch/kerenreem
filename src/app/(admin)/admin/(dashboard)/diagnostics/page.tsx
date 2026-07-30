import { requireRole } from '@/lib/admin/auth';
import { createClient, createStaticClient } from '@/lib/supabase/server';
import { getBooks } from '@/lib/data';
import { AdminHeader } from '@/components/admin/AdminList';
import { RevalidateButton } from '@/components/admin/RevalidateButton';

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

/**
 * בודק bucket בהעלאה אמיתית.
 *
 * במכוון לא משתמשים ב-listBuckets: הוא קורא מ-storage.buckets, שעליה יש RLS
 * בלי מדיניות קריאה למשתמש מחובר. התוצאה היא רשימה ריקה ללא שגיאה — ואז
 * bucket תקין לחלוטין נראה כאילו אינו קיים. העלאה ומחיקה הן בדיוק מה
 * שהטפסים בניהול עושים, ולכן הן בדיקה שאינה יכולה לשקר.
 */
async function probeBucket(
  supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>,
  bucket: string,
): Promise<Check> {
  const path = `_diagnostics/${makeProbeSlug()}.txt`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, new Blob(['ok'], { type: 'text/plain' }), { upsert: true });

  if (error) {
    const status = 'statusCode' in error ? String(error.statusCode) : '';
    const hint = /not found/i.test(error.message)
      ? ' — ה-bucket אינו קיים. הריצו 02_site_additions.sql'
      : /row-level security|violates|denied/i.test(error.message)
        ? ' — ה-bucket קיים אך המדיניות חוסמת. ודאו ש-can_edit() מוגדרת ושהתפקיד שלכם עורך או מנהל'
        : '';
    return { label: bucket, ok: false, detail: `${status ? `${status}: ` : ''}${error.message}${hint}` };
  }

  // הקובץ נמחק מיד; אם המחיקה נכשלת זו תקלה בפני עצמה ויש לדעת עליה
  const removal = await supabase.storage.from(bucket).remove([path]);
  return removal.error
    ? { label: bucket, ok: false, detail: `ההעלאה הצליחה אך המחיקה נכשלה: ${removal.error.message}` }
    : { label: bucket, ok: true, detail: 'העלאה ומחיקה הצליחו' };
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

  /* --- 3. מדוע תוכן אינו מופיע באתר --- */
  //
  // הבדיקה הקודמת כאן השתמשה ב-session של המנהל, שעליו חלה
  // "is_published or can_edit()" — כלומר מנהל תמיד רואה הכל, גם טיוטות.
  // בדיקה כזו אינה יכולה לתפוס בעיית הרשאות שפוגעת רק במבקר אנונימי:
  // אם ל-anon חסרה הרשאת select על הטבלה, המנהל עדיין יראה "5 מפורסמים"
  // בעוד שהאתר הציבורי מקבל שורה ריקה בשקט.
  //
  // לכן הבדיקה כאן משתמשת ב-createStaticClient — בדיוק הלקוח שהעמוד
  // הציבורי משתמש בו, בלי session — ומריצה את אותה שאילתה מילה במילה.
  const anon = createStaticClient();
  const publicChecks: Check[] = [];
  let missingBooks: { slug: string; title: string }[] = [];

  if (!anon) {
    publicChecks.push({
      label: 'לקוח ציבורי',
      ok: false,
      detail: 'אין חיבור אנונימי למסד — לא ניתן לבדוק מה האתר הציבורי רואה בפועל.',
    });
  } else {
    for (const table of ['books', 'authors', 'events', 'activities'] as const) {
      const [total, asAdmin, asPublic] = await Promise.all([
        supabase.from(table).select('id', { count: 'exact', head: true }),
        supabase.from(table).select('id', { count: 'exact', head: true }).eq('is_published', true),
        anon.from(table).select('id', { count: 'exact', head: true }).eq('is_published', true),
      ]);

      const all = total.count ?? 0;
      const shouldShow = asAdmin.count ?? 0;
      const doesShow = asPublic.count ?? 0;

      publicChecks.push({
        label: `${table} — מפורסמים ונראים למבקר`,
        ok: all === 0 || (!asPublic.error && doesShow >= shouldShow && shouldShow > 0),
        detail: asPublic.error
          ? `${asPublic.error.code ?? '—'}: ${asPublic.error.message} — לתפקיד anon אין הרשאת קריאה. הריצו supabase/06_restore_grants.sql`
          : all === 0
            ? 'אין רשומות כלל'
            : shouldShow === 0
              ? `${all} רשומות, כולן טיוטה. סמנו "מפורסם באתר" בטופס — טיוטה אינה מוצגת באתר.`
              : doesShow < shouldShow
                ? `מסומנים כמפורסמים: ${shouldShow} מתוך ${all}. נראים בפועל למבקר אנונימי: ${doesShow}. ` +
                  'הפער נובע כמעט תמיד מ-RLS או מהרשאות חסרות על הטבלה.'
                : `${doesShow} מפורסמים מתוך ${all}, כולם נראים למבקר`,
      });
    }

    // getBooks() עצמה — לא שאילתה שמדמה אותה. פער בין "מה שהאבחון בדק"
    // לבין "מה שהעמוד הציבורי עושה בפועל" הוא בדיוק המקום שבו תקלה יכולה
    // לחמוק. קריאה לפונקציה האמיתית סוגרת את הפער כליל: מה שמוצג כאן
    // הוא — מילה במילה — מה ש-/books עומד להציג.
    let publicBooks: Awaited<ReturnType<typeof getBooks>> = [];
    let publicBooksError: string | null = null;
    try {
      publicBooks = await getBooks();
    } catch (error) {
      publicBooksError = error instanceof Error ? error.message : String(error);
    }

    publicChecks.push({
      label: 'getBooks() — הפונקציה שהעמוד הציבורי קורא לה',
      ok: !publicBooksError,
      detail: publicBooksError
        ? `נזרקה חריגה: ${publicBooksError}`
        : `הוחזרו ${publicBooks.length} ספרים`,
    });

    // רשימת הספרים שמסומנים כמפורסמים אך getBooks() אינה מחזירה —
    // ההשוואה המדויקת שמצביעה על הספר הספציפי שחסר, לא רק שיש בעיה
    if (!publicBooksError) {
      const visibleSlugs = new Set(publicBooks.map((book) => book.slug));
      const { data: adminBooks } = await supabase
        .from('books')
        .select('slug, title_he')
        .eq('is_published', true);

      missingBooks = (adminBooks ?? [])
        .filter((book) => !visibleSlugs.has(book.slug))
        .map((book) => ({ slug: book.slug, title: book.title_he }));
    }

    // getBooks() בולעת בכוונה כל שגיאה שאינה 42P01/PGRST200 ומחזירה []
    // בשקט, עם רישום ל-console.error בצד השרת בלבד — בלי גישה ליומני
    // השרת, אין שום דרך לדעת מהבדיקה הקודמת *למה* היא החזירה 0. הבדיקות
    // הבאות רצות בלי שום עטיפה שמבליעה שגיאות, ומראות את קוד ה-Postgres
    // בעצמו. השוואה בין ההצטרפות המלאה לבסיסית מאתרת אם הבעיה בהצטרפות
    // עצמה (תגיות/מאפיינים) או קיימת גם בלעדיה.
    const [rawJoined, rawBase] = await Promise.all([
      anon
        .from('books')
        .select(
          'slug, tags:book_tags ( tag:tags ( id ) ), attributeValues:book_attributes ( value_id )',
        )
        .eq('is_published', true),
      anon.from('books').select('slug, author:authors(id), category:categories(id)').eq('is_published', true),
    ]);

    publicChecks.push({
      label: 'שאילתה גולמית — עם הצטרפות תגיות (בלי שום הבלעת שגיאה)',
      ok: !rawJoined.error,
      detail: rawJoined.error
        ? `${rawJoined.error.code ?? '—'}: ${rawJoined.error.message}`
        : `${rawJoined.data?.length ?? 0} שורות`,
    });

    publicChecks.push({
      label: 'שאילתה גולמית — בלי הצטרפות תגיות כלל',
      ok: !rawBase.error,
      detail: rawBase.error
        ? `${rawBase.error.code ?? '—'}: ${rawBase.error.message}`
        : `${rawBase.data?.length ?? 0} שורות`,
    });
  }

  /* --- 4. אחסון קבצים --- */
  const storage: Check[] = await Promise.all(BUCKETS.map((name) => probeBucket(supabase, name)));

  const allOk =
    reads.every((c) => c.ok) &&
    writeChecks.every((c) => c.ok) &&
    publicChecks.every((c) => c.ok) &&
    storage.every((c) => c.ok);

  return (
    <>
      <AdminHeader
        title="אבחון"
        description="בודק בפועל קריאה, כתיבה ואחסון — ומדווח את קוד השגיאה המדויק מהמסד."
      />

      <RevalidateButton />

      <p
        className={`mb-8 border-s-2 px-4 py-3 text-small ${
          allOk ? 'border-rule-strong bg-cream-2' : 'border-burgundy bg-cream-2'
        }`}
      >
        {allOk
          ? 'כל הבדיקות עברו. אם שמירה עדיין נכשלת — שלחו את הודעת השגיאה המופיעה בטופס עצמו.'
          : 'נמצאו כשלים. הפרטים למטה כוללים את קוד השגיאה של Postgres.'}
      </p>

      <Section title="מדוע תוכן אינו מופיע באתר" checks={publicChecks} />

      {missingBooks.length > 0 ? (
        <div className="mb-8 border-s-2 border-burgundy bg-cream-2 px-4 py-3 text-small">
          <p className="font-semibold text-ink">
            {missingBooks.length} ספרים מסומנים כמפורסמים אך getBooks() אינה מחזירה אותם:
          </p>
          <ul className="mt-2 list-disc ps-5 text-ink-soft">
            {missingBooks.map((book) => (
              <li key={book.slug}>
                {book.title} — <span dir="ltr">/books/{book.slug}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-caption text-muted">
            זו אינה תקלת מטמון: הבדיקה קוראת לפונקציה האמיתית שהעמוד הציבורי
            משתמש בה, כרגע, בלי מטמון בכלל. אם ספר מופיע כאן, הוא לא יופיע
            באתר גם אחרי המתנה או רענון — יש לבדוק את שדותיו (מחבר או קטגוריה
            שנמחקו, למשל) ולא לחכות.
          </p>
        </div>
      ) : null}

      <p className="mb-8 text-caption leading-relaxed text-muted">
        אם כל הבדיקות כאן תקינות (כולל הרשימה הזו ריקה) והתוכן עדיין אינו
        מופיע באתר עצמו — העמוד הציבורי מוגש ממטמון. הוא מתרענן אוטומטית תוך
        דקה לכל היותר. רענון קשיח בדפדפן
        (Ctrl+Shift+R) עוקף מטמון של הדפדפן בלבד ולא של השרת.
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
