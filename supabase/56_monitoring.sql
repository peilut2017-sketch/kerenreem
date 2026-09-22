-- [1.40] ניטור ובריאות — סכימת אירועים ודגימות.
--
-- מה הקובץ הזה כן עושה: יוצר טבלאות *חדשות* בסכימה נפרדת (monitoring),
-- עם RLS סגור. מה הוא בשום אופן לא עושה: לא נוגע בטבלה קיימת, לא
-- משנה מדיניות קיימת, לא מוחק דבר. זו דרישה מפורשת — מערכת הניטור
-- אסור שתוכל לסכן את המסד שהיא אמורה לשמור עליו.
--
-- למה בכלל לשמור אירועים במסד ולא להסתפק בכלי הניטור: כלי הניטור
-- (Prometheus/Uptime Kuma) יודע "מה למעלה ומה למטה ברגע זה", אבל לא
-- יודע לספר סיפור. לוח האירועים צריך ציר זמן: מתי התחיל, איזה שירות
-- נפל, מה הייתה ההשפעה, איזה build רץ, ומה סגר את האירוע. זה שאילתה
-- על טבלה, לא גרף.
--
-- ⚠️ הרצה: psql על המסד, או Supabase SQL Editor. הקובץ idempotent —
-- אפשר להריץ אותו שוב בלי נזק.

create schema if not exists monitoring;

-- ---------------------------------------------------------------------------
-- אירוע: יחידת "משהו נשבר" אחת, מהתסמין הראשון ועד ההתאוששות.
-- ---------------------------------------------------------------------------
create table if not exists monitoring.incidents (
  id uuid primary key default gen_random_uuid(),

  -- מפתח קיבוץ: כל התסמינים של אותה תקלה נכנסים לאירוע אחד ולא
  -- מייצרים חמש התראות נפרדות. הכלי המתריע מרכיב אותו מ-
  -- {scope}:{component} ומחפש אירוע פתוח עם אותו מפתח.
  dedupe_key text not null,

  -- איפה: server / docker / postgres / supabase / vercel / network / app
  scope text not null,
  -- מה בדיוק: 'postgres', 'storage', 'kong', 'disk', 'books-page'…
  component text not null,

  severity text not null check (severity in ('warning', 'critical')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),

  title text not null,
  -- השפעה על המשתמש, בשפה אנושית: "הקטלוג מוצג ריק", "דפי ספר מחזירים 500"
  impact text,

  -- הקשר טכני שמאפשר לשחזר: SHA שרץ, מצב מטמון, מדדי שרת ברגע האירוע,
  -- קישורים ללוגים. jsonb ולא עמודות — מה שרלוונטי משתנה בין סוגי אירוע.
  context jsonb not null default '{}'::jsonb,

  started_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  -- מה סגר את האירוע: 'auto' (הבדיקה חזרה לירוק) או תיאור ידני
  resolution text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- אירוע פתוח אחד לכל מפתח קיבוץ. זה הלב של "קיבוץ תסמינים לאירוע
-- אחד": ניסיון לפתוח שני אירועים פתוחים לאותו רכיב נכשל, והמתריע
-- מעדכן את הקיים במקום.
create unique index if not exists incidents_open_dedupe
  on monitoring.incidents (dedupe_key)
  where status <> 'resolved';

create index if not exists incidents_started_at on monitoring.incidents (started_at desc);
create index if not exists incidents_scope_status on monitoring.incidents (scope, status);

-- ---------------------------------------------------------------------------
-- ציר הזמן של האירוע: כל תסמין, כל שינוי מצב, כל פעולה שננקטה.
-- ---------------------------------------------------------------------------
create table if not exists monitoring.incident_events (
  id bigserial primary key,
  incident_id uuid not null references monitoring.incidents (id) on delete cascade,
  at timestamptz not null default now(),
  -- 'symptom' | 'state' | 'action' | 'note'
  kind text not null,
  message text not null,
  data jsonb not null default '{}'::jsonb
);

create index if not exists incident_events_incident on monitoring.incident_events (incident_id, at);

-- ---------------------------------------------------------------------------
-- דגימות בדיקה: התוצאה הגולמית של כל הרצת בדיקה.
--
-- למה לשמור גם את התקינות ולא רק את הכשלים: בלי הרקע אי אפשר לענות
-- על "מתי זה התחיל להידרדר". זמן תגובה שזוחל מ-200ms ל-1.5s במשך
-- שבוע אינו כשל באף רגע בודד, אבל הוא האזהרה האמיתית.
--
-- שמירה קצרה בכוונה — ראו monitoring.prune() למטה. זו טבלה שגדלה
-- מהר, ודיסק מלא הוא בדיוק התקלה שאנחנו מנסים למנוע.
-- ---------------------------------------------------------------------------
create table if not exists monitoring.check_samples (
  id bigserial primary key,
  at timestamptz not null default now(),
  check_name text not null,
  target text,
  status text not null check (status in ('ok', 'warn', 'fail', 'skipped')),
  duration_ms integer,
  http_status integer,
  detail text,
  data jsonb not null default '{}'::jsonb
);

create index if not exists check_samples_at on monitoring.check_samples (at desc);
create index if not exists check_samples_name_at on monitoring.check_samples (check_name, at desc);

-- ---------------------------------------------------------------------------
-- הרשאות: סגור לחלוטין לציבור.
--
-- anon ו-authenticated לא מקבלים דבר — לא קריאה ולא כתיבה. מערכת
-- הניטור כותבת דרך service_role, ולוח האירועים בניהול נקרא דרך
-- פונקציות security definer גדורות ב-is_admin() (יתווספו עם המסך).
-- ---------------------------------------------------------------------------
alter table monitoring.incidents enable row level security;
alter table monitoring.incident_events enable row level security;
alter table monitoring.check_samples enable row level security;

revoke all on all tables in schema monitoring from anon, authenticated;
revoke all on schema monitoring from anon, authenticated;

-- ---------------------------------------------------------------------------
-- פתיחה/עדכון אירוע — אטומי, וזה מה שמונע סופת התראות.
--
-- קריאה חוזרת עם אותו dedupe_key בזמן שהאירוע עדיין פתוח *מעדכנת*
-- אותו ומוסיפה שורה לציר הזמן, במקום לפתוח אירוע שני. כך נפילת
-- PostgreSQL מייצרת אירוע אחד עם עשרה תסמינים, ולא עשר התראות.
-- ---------------------------------------------------------------------------
create or replace function monitoring.raise_incident(
  p_dedupe_key text,
  p_scope text,
  p_component text,
  p_severity text,
  p_title text,
  p_impact text default null,
  p_context jsonb default '{}'::jsonb,
  p_symptom text default null
)
returns uuid
language plpgsql
security definer
set search_path = monitoring, public, pg_temp
as $$
declare
  v_id uuid;
begin
  select id into v_id
    from monitoring.incidents
   where dedupe_key = p_dedupe_key and status <> 'resolved'
   limit 1;

  if v_id is null then
    insert into monitoring.incidents
      (dedupe_key, scope, component, severity, title, impact, context)
    values
      (p_dedupe_key, p_scope, p_component, p_severity, p_title, p_impact, coalesce(p_context, '{}'::jsonb))
    returning id into v_id;
  else
    -- חומרה רק עולה בתוך אירוע פתוח: אירוע שהחל כאזהרה והפך לקריטי
    -- נשאר קריטי גם אם דגימה מאוחרת יותר הייתה רק אזהרה.
    update monitoring.incidents
       set severity = case when p_severity = 'critical' then 'critical' else severity end,
           context = context || coalesce(p_context, '{}'::jsonb),
           updated_at = now()
     where id = v_id;
  end if;

  insert into monitoring.incident_events (incident_id, kind, message, data)
  values (v_id, 'symptom', coalesce(p_symptom, p_title), coalesce(p_context, '{}'::jsonb));

  return v_id;
end;
$$;

-- סגירת אירוע כשהבדיקה חזרה לירוק. מחזיר את מזהה האירוע שנסגר, או
-- null כשלא היה אירוע פתוח — כך הקורא יודע אם לשלוח הודעת התאוששות.
create or replace function monitoring.resolve_incident(
  p_dedupe_key text,
  p_resolution text default 'auto'
)
returns uuid
language plpgsql
security definer
set search_path = monitoring, public, pg_temp
as $$
declare
  v_id uuid;
begin
  update monitoring.incidents
     set status = 'resolved',
         resolved_at = now(),
         resolution = p_resolution,
         updated_at = now()
   where dedupe_key = p_dedupe_key and status <> 'resolved'
   returning id into v_id;

  if v_id is not null then
    insert into monitoring.incident_events (incident_id, kind, message)
    values (v_id, 'state', 'האירוע נסגר: ' || p_resolution);
  end if;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- טיהור. מערכת ניטור שממלאת את הדיסק היא אירוניה יקרה.
--
-- דגימות: 14 יום. אירועים סגורים: שנה — הם התיעוד, והם קטנים.
-- להרצה יומית מתוך המתזמן הקיים (/api/cron/commerce) או pg_cron.
-- ---------------------------------------------------------------------------
create or replace function monitoring.prune(
  p_sample_days integer default 14,
  p_incident_days integer default 365
)
returns table (samples_deleted bigint, incidents_deleted bigint)
language plpgsql
security definer
set search_path = monitoring, public, pg_temp
as $$
declare
  v_samples bigint;
  v_incidents bigint;
begin
  delete from monitoring.check_samples
   where at < now() - make_interval(days => p_sample_days);
  get diagnostics v_samples = row_count;

  delete from monitoring.incidents
   where status = 'resolved' and resolved_at < now() - make_interval(days => p_incident_days);
  get diagnostics v_incidents = row_count;

  return query select v_samples, v_incidents;
end;
$$;

revoke all on function monitoring.raise_incident(text, text, text, text, text, text, jsonb, text) from public;
revoke all on function monitoring.resolve_incident(text, text) from public;
revoke all on function monitoring.prune(integer, integer) from public;
