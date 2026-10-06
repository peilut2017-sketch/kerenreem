-- ============================================================================
-- מכון קרן רא"ם — אנליטיקס עצמאי v2: פילוח מלא, משך שהייה, יציאות, ספרים
-- להרצה אחרי 56_monitoring.sql
-- ============================================================================
-- שלושה דברים במסמך אחד:
--
-- 1. תיקון מקור הספירה החתוכה ב-1000. הדשבורד קרא את כל שורות page_views
--    לתוך הזיכרון עם .limit(20000), אבל PostgREST חותך כל תשובה ב-max-rows
--    (ברירת מחדל 1000) *בשקט*, מעל כל limit שהקוד מבקש. התוצאה: הסכום
--    "נתקע" על 1000 ובכל טווח ארוך חסרות ספירות. הפתרון הנכון אינו להעלות
--    את התקרה אלא לא להעביר שורות: הצבירה נעשית כאן, ב-Postgres, ולקוח
--    האתר מקבל רק את התוצאה המצטברת (עשרות שורות).
--
-- 2. עמודות חדשות ב-page_views (משך שהייה, גלילה, ערוץ, מכשיר, מדינה,
--    זיהוי בוטים, עמוד קודם) וטבלת outbound_clicks ליציאות מהאתר.
--
-- 3. פונקציות צבירה analytics_* — כולן SECURITY INVOKER: ה-RLS הקיים
--    (page_views_staff_read / commerce_events_staff_read) קובע מי רואה,
--    כך שמבקר אנונימי שיקרא להן יקבל תוצאה ריקה.
--
-- אין כאן שום כתובת IP, מזהה קבוע או מידע אישי. ראו מדיניות הפרטיות.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. פענוח אחוזים בנתיבים — לתיקון נתיבים עבריים שנשמרו מקודדים
-- ----------------------------------------------------------------------------
create or replace function analytics_url_decode(input text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  bin   bytea := '';
  token text;
begin
  for token in select (regexp_matches(input, '(%[0-9a-fA-F]{2}|.)', 'g'))[1] loop
    if length(token) = 3 and left(token, 1) = '%' then
      bin := bin || decode(substring(token from 2 for 2), 'hex');
    else
      bin := bin || convert_to(token, 'UTF8');
    end if;
  end loop;
  return convert_from(bin, 'UTF8');
exception when others then
  return input;
end;
$$;

-- ----------------------------------------------------------------------------
-- 1. page_views — עמודות חדשות
-- ----------------------------------------------------------------------------
alter table page_views
  add column if not exists session_id   text,
  add column if not exists is_entry     boolean not null default false,
  add column if not exists prev_path    text,
  add column if not exists duration_ms  integer,
  add column if not exists max_scroll   smallint,
  add column if not exists channel      text,
  add column if not exists utm_source   text,
  add column if not exists utm_medium   text,
  add column if not exists utm_campaign text,
  add column if not exists device       text,
  add column if not exists country      text,
  add column if not exists is_bot       boolean not null default false;

alter table page_views drop constraint if exists page_views_duration_check;
alter table page_views add constraint page_views_duration_check
  check (duration_ms is null or duration_ms between 0 and 1800000);
alter table page_views drop constraint if exists page_views_scroll_check;
alter table page_views add constraint page_views_scroll_check
  check (max_scroll is null or max_scroll between 0 and 100);

create index if not exists idx_page_views_session on page_views (session_id, created_at);
create index if not exists idx_page_views_path_created on page_views (path, created_at);
create index if not exists idx_page_views_human_created on page_views (created_at) where not is_bot;

-- נתיבים מקודדים שנשמרו עד היום (/books/%D7%...) — מפוענחים, כדי שהצמדה
-- לספר לפי slug תעבוד גם על נתוני העבר ושתי צורות הכתיבה לא ייספרו בנפרד.
update page_views
set path = analytics_url_decode(path)
where path like '%\%%' escape '\';

-- "מפנה" ישן נרשם בכל ניווט פנימי (document.referrer אינו מתעדכן בניווט
-- בצד הלקוח) ולכן ניפח כל מקור הפניה. הנתונים הישנים אינם אמינים לניתוח
-- מקורות, ונשארים רק לשימור היסטוריה: דוחות המקורות החדשים מסתמכים על
-- שורות כניסה (is_entry) בלבד.

-- ----------------------------------------------------------------------------
-- 2. עדכון משך שהייה/גלילה — ללא service role וללא UPDATE ציבורי
-- ----------------------------------------------------------------------------
-- הדפדפן יוצר מזהה צפייה (UUID) ושולח אותו עם הכניסה; בעזיבת העמוד הוא
-- שולח את משך השהייה. הפונקציה מעדכנת שורה רק אם גם מזהה הסשן תואם וגם
-- השורה טרייה (עד שעתיים), ורק מעלה ערכים — לא ניתן לשכתב היסטוריה.
create or replace function analytics_record_engagement(
  p_id uuid,
  p_session text,
  p_duration_ms integer,
  p_scroll integer
)
returns void
language sql
security definer
set search_path = public
as $$
  update page_views
  set duration_ms = greatest(coalesce(duration_ms, 0), least(greatest(coalesce(p_duration_ms, 0), 0), 1800000)),
      max_scroll  = greatest(coalesce(max_scroll, 0), least(greatest(coalesce(p_scroll, 0), 0), 100))
  where id = p_id
    and session_id is not null
    and session_id = p_session
    and created_at > now() - interval '2 hours';
$$;

revoke all on function analytics_record_engagement(uuid, text, integer, integer) from public;
grant execute on function analytics_record_engagement(uuid, text, integer, integer) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. outbound_clicks — יציאות מהאתר ופעולות יצירת קשר
-- ----------------------------------------------------------------------------
-- kind: external = קישור לאתר אחר (target = שם המתחם בלבד, לא כתובת מלאה),
--       tel / mailto = לחיצה על טלפון/דוא"ל (target ריק — לא נשמר המספר
--       או הכתובת), download = הורדת קובץ מהאתר (target = נתיב הקובץ).
create table if not exists outbound_clicks (
  id           uuid primary key default gen_random_uuid(),
  kind         text not null check (kind in ('external', 'tel', 'mailto', 'download')),
  target       text,
  from_path    text not null,
  book_id      uuid references books(id) on delete set null,
  session_id   text,
  visitor_hash text not null,
  locale       text not null default 'he',
  created_at   timestamptz not null default now()
);

create index if not exists idx_outbound_clicks_created on outbound_clicks (created_at desc);
create index if not exists idx_outbound_clicks_book on outbound_clicks (book_id, created_at) where book_id is not null;

alter table outbound_clicks enable row level security;
revoke all on outbound_clicks from anon, authenticated;
grant insert on outbound_clicks to anon, authenticated;
grant select, delete on outbound_clicks to authenticated;

drop policy if exists outbound_clicks_insert on outbound_clicks;
create policy outbound_clicks_insert on outbound_clicks
  for insert to anon, authenticated with check (true);

drop policy if exists outbound_clicks_staff_read on outbound_clicks;
create policy outbound_clicks_staff_read on outbound_clicks
  for select using (public.can_edit());

drop policy if exists outbound_clicks_admin_delete on outbound_clicks;
create policy outbound_clicks_admin_delete on outbound_clicks
  for delete using (public.is_admin());

-- ----------------------------------------------------------------------------
-- 4. commerce_events — ספירת לחיצות חוזרות
-- ----------------------------------------------------------------------------
-- המדד "כמה לחצו על הוספה לסל / רכישה דרך ספק / שמירה" צריך לספור גם
-- לחיצות חוזרות של אותו מכשיר (כמה פעמים) וגם מכשירים ייחודיים (כמה
-- אנשים). הדה-דופליקציה הישנה — אירוע אחד לכל מכשיר+ספר לנצח — איפשרה
-- רק את השני. אירועי התנהגות אחרים (תשלום, קופון...) נשארים מדודפים.
drop index if exists uq_commerce_events_dedupe;
create unique index if not exists uq_commerce_events_dedupe
  on commerce_events (session_key, event_name,
                      coalesce(book_id, '00000000-0000-0000-0000-000000000000'::uuid),
                      coalesce(order_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where event_name not in ('product_added_to_cart', 'product_saved', 'external_supplier_clicked');

create index if not exists idx_commerce_events_book on commerce_events (book_id, created_at) where book_id is not null;

-- ----------------------------------------------------------------------------
-- 5. פונקציות צבירה (כולן מוציאות בוטים; אזור זמן ישראל לכל חלוקה ליום/שעה)
-- ----------------------------------------------------------------------------

-- סיכום כללי. "סשן" = מזהה הסשן של הדפדפן (ובנתוני עבר: גיבוב המבקר
-- היומי). "מבקרים" = ימי-מבקר ייחודיים: אותו אדם בשני ימים נספר פעמיים,
-- כי אין מזהה קבוע (במכוון — פרטיות). נטישה = סשן עם צפייה אחת ופחות
-- מ-10 שניות מעורבות, כהגדרת GA4.
create or replace function analytics_overview(p_from timestamptz, p_to timestamptz)
returns table (
  views bigint,
  sessions bigint,
  visitor_days bigint,
  avg_session_seconds numeric,
  avg_page_seconds numeric,
  bounce_rate numeric,
  pages_per_session numeric,
  bot_views bigint,
  measured_share numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with v as (
    select coalesce(session_id, visitor_hash) as sid,
           visitor_hash,
           (created_at at time zone 'Asia/Jerusalem')::date as d,
           duration_ms
    from page_views
    where created_at >= p_from and created_at < p_to and not is_bot
  ),
  s as (
    select sid, count(*) as pv, sum(duration_ms) as dur
    from v group by sid
  )
  select
    (select count(*) from v),
    (select count(*) from s),
    (select count(distinct (d, visitor_hash)) from v),
    (select avg(dur) / 1000.0 from s where dur is not null),
    (select avg(duration_ms) / 1000.0 from v where duration_ms is not null),
    (select case when count(*) = 0 then 0
                 else count(*) filter (where pv = 1 and coalesce(dur, 0) < 10000)::numeric / count(*) end from s),
    (select case when count(*) = 0 then 0 else sum(pv)::numeric / count(*) end from s),
    (select count(*) from page_views where created_at >= p_from and created_at < p_to and is_bot),
    (select case when count(*) = 0 then 0
                 else count(*) filter (where duration_ms is not null)::numeric / count(*) end from v);
$$;

-- סדרה יומית (זמן ישראל), כל יום בטווח גם בלי ביקורים.
create or replace function analytics_daily(p_from timestamptz, p_to timestamptz)
returns table (day date, views bigint, sessions bigint, visitors bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with days as (
    select generate_series(
      (p_from at time zone 'Asia/Jerusalem')::date,
      ((p_to - interval '1 second') at time zone 'Asia/Jerusalem')::date,
      interval '1 day'
    )::date as day
  ),
  agg as (
    select (created_at at time zone 'Asia/Jerusalem')::date as day,
           count(*) as views,
           count(distinct coalesce(session_id, visitor_hash)) as sessions,
           count(distinct visitor_hash) as visitors
    from page_views
    where created_at >= p_from and created_at < p_to and not is_bot
    group by 1
  )
  select days.day,
         coalesce(agg.views, 0),
         coalesce(agg.sessions, 0),
         coalesce(agg.visitors, 0)
  from days left join agg using (day)
  order by days.day;
$$;

-- לכל עמוד: צפיות, סשנים, זמן שהייה ממוצע, גלילה ממוצעת, כניסות (עמוד
-- ראשון בסשן) ויציאות (עמוד אחרון בסשן).
create or replace function analytics_pages(p_from timestamptz, p_to timestamptz, p_limit integer default 100)
returns table (
  path text,
  views bigint,
  sessions bigint,
  avg_seconds numeric,
  avg_scroll numeric,
  entries bigint,
  exits bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with v as (
    select path,
           coalesce(session_id, visitor_hash) as sid,
           duration_ms, max_scroll, is_entry,
           row_number() over (
             partition by coalesce(session_id, visitor_hash) order by created_at desc
           ) as rn_desc
    from page_views
    where created_at >= p_from and created_at < p_to and not is_bot
  )
  select path,
         count(*),
         count(distinct sid),
         avg(duration_ms) filter (where duration_ms is not null) / 1000.0,
         avg(max_scroll) filter (where max_scroll is not null),
         count(*) filter (where is_entry),
         count(*) filter (where rn_desc = 1)
  from v
  group by path
  order by count(*) desc
  limit least(greatest(p_limit, 1), 500);
$$;

-- פילוח לפי ממד. מקורות (channel/referrer/utm_*) נמדדים לפי שורות כניסה
-- בלבד — כניסה אחת לסשן — ולכן "views" שם הוא מספר כניסות/סשנים.
create or replace function analytics_breakdown(
  p_from timestamptz,
  p_to timestamptz,
  p_dim text,
  p_limit integer default 20
)
returns table (label text, views bigint, sessions bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with v as (
    select case p_dim
             when 'channel'      then channel
             when 'referrer'     then referrer_host
             when 'utm_source'   then utm_source
             when 'utm_medium'   then utm_medium
             when 'utm_campaign' then utm_campaign
             when 'device'       then coalesce(device, 'unknown')
             when 'country'      then coalesce(country, 'unknown')
             when 'locale'       then locale
             when 'entry_path'   then path
           end as label,
           coalesce(session_id, visitor_hash) as sid,
           is_entry
    from page_views
    where created_at >= p_from and created_at < p_to and not is_bot
      and (p_dim not in ('channel', 'referrer', 'utm_source', 'utm_medium', 'utm_campaign', 'entry_path') or is_entry)
  )
  select label, count(*), count(distinct sid)
  from v
  where label is not null
  group by label
  order by count(*) desc
  limit least(greatest(p_limit, 1), 100);
$$;

-- יציאות: לפי סוג, יעד ועמוד מקור.
create or replace function analytics_outbound(p_from timestamptz, p_to timestamptz, p_limit integer default 300)
returns table (kind text, target text, from_path text, clicks bigint, sessions bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select kind, target, from_path, count(*), count(distinct coalesce(session_id, visitor_hash))
  from outbound_clicks
  where created_at >= p_from and created_at < p_to
  group by kind, target, from_path
  order by count(*) desc
  limit least(greatest(p_limit, 1), 1000);
$$;

-- זרימה פנימית: מאיזה עמוד עברו לאיזה עמוד.
create or replace function analytics_flow(p_from timestamptz, p_to timestamptz, p_limit integer default 30)
returns table (from_path text, to_path text, transitions bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select prev_path, path, count(*)
  from page_views
  where created_at >= p_from and created_at < p_to and not is_bot
    and prev_path is not null and prev_path <> path
  group by prev_path, path
  order by count(*) desc
  limit least(greatest(p_limit, 1), 200);
$$;

-- מפת חום: יום בשבוע (0=ראשון) × שעה, זמן ישראל.
create or replace function analytics_hours(p_from timestamptz, p_to timestamptz)
returns table (dow integer, hour integer, views bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select extract(dow from created_at at time zone 'Asia/Jerusalem')::integer,
         extract(hour from created_at at time zone 'Asia/Jerusalem')::integer,
         count(*)
  from page_views
  where created_at >= p_from and created_at < p_to and not is_bot
  group by 1, 2;
$$;

-- ספירת צפיות לפי קידומת נתיב (לכל הזמן) — מונה הצפיות לאירועים בניהול.
create or replace function analytics_path_counts(p_prefix text)
returns table (path text, views bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select path, count(*)
  from page_views
  where not is_bot and left(path, length(p_prefix)) = p_prefix
  group by path;
$$;

-- פילוח לכל ספר: צפיות מעמוד הספר (page_views, צמוד לפי slug) ופעולות
-- (commerce_events + outbound_clicks). "מכשירים" = מזהי מכשיר ייחודיים,
-- "פעולות" = סך הלחיצות.
create or replace function analytics_book_stats(p_from timestamptz, p_to timestamptz)
returns table (
  book_id uuid,
  slug text,
  title text,
  views bigint,
  viewers bigint,
  avg_seconds numeric,
  avg_scroll numeric,
  saves bigint,
  save_devices bigint,
  cart_adds bigint,
  cart_devices bigint,
  supplier_clicks bigint,
  supplier_devices bigint,
  back_in_stock bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with pv as (
    select b.id as book_id,
           count(*) as views,
           count(distinct coalesce(p.session_id, p.visitor_hash)) as viewers,
           avg(p.duration_ms) filter (where p.duration_ms is not null) / 1000.0 as avg_seconds,
           avg(p.max_scroll) filter (where p.max_scroll is not null) as avg_scroll
    from page_views p
    join books b on p.path = '/books/' || b.slug
    where p.created_at >= p_from and p.created_at < p_to and not p.is_bot
    group by b.id
  ),
  ev as (
    select book_id,
           count(*) filter (where event_name = 'product_saved') as saves,
           count(distinct session_key) filter (where event_name = 'product_saved') as save_devices,
           count(*) filter (where event_name = 'product_added_to_cart') as cart_adds,
           count(distinct session_key) filter (where event_name = 'product_added_to_cart') as cart_devices,
           count(*) filter (where event_name = 'external_supplier_clicked') as supplier_clicks,
           count(distinct session_key) filter (where event_name = 'external_supplier_clicked') as supplier_devices,
           count(*) filter (where event_name = 'back_in_stock_subscribed') as back_in_stock
    from commerce_events
    where created_at >= p_from and created_at < p_to and book_id is not null
      and event_name in ('product_saved', 'product_added_to_cart', 'external_supplier_clicked', 'back_in_stock_subscribed')
    group by book_id
  )
  select b.id, b.slug, b.title_he,
         coalesce(pv.views, 0), coalesce(pv.viewers, 0), pv.avg_seconds, pv.avg_scroll,
         coalesce(ev.saves, 0), coalesce(ev.save_devices, 0),
         coalesce(ev.cart_adds, 0), coalesce(ev.cart_devices, 0),
         coalesce(ev.supplier_clicks, 0), coalesce(ev.supplier_devices, 0),
         coalesce(ev.back_in_stock, 0)
  from pv
  full join ev on ev.book_id = pv.book_id
  join books b on b.id = coalesce(pv.book_id, ev.book_id)
  order by coalesce(pv.views, 0) desc, coalesce(ev.cart_adds, 0) desc
  limit 1000;
$$;

-- יעדים חיצוניים לפי ספר (לאיזה ספק יצאו מכל ספר).
create or replace function analytics_book_outbound(p_from timestamptz, p_to timestamptz)
returns table (book_id uuid, target text, clicks bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select book_id, target, count(*)
  from outbound_clicks
  where created_at >= p_from and created_at < p_to and kind = 'external' and book_id is not null
  group by book_id, target;
$$;

do $$
declare
  fn text;
begin
  for fn in
    select format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'analytics\_%' escape '\'
      and p.proname not in ('analytics_record_engagement', 'analytics_url_decode')
  loop
    execute format('revoke all on function %s from public, anon', fn);
    execute format('grant execute on function %s to authenticated', fn);
  end loop;
end $$;

-- ============================================================================
-- Rollback:
--   drop function if exists analytics_book_outbound, analytics_book_stats, analytics_path_counts,
--     analytics_hours, analytics_flow, analytics_outbound, analytics_breakdown, analytics_pages,
--     analytics_daily, analytics_overview, analytics_record_engagement, analytics_url_decode cascade;
--   drop table outbound_clicks;
--   alter table page_views drop column session_id, drop column is_entry, drop column prev_path,
--     drop column duration_ms, drop column max_scroll, drop column channel, drop column utm_source,
--     drop column utm_medium, drop column utm_campaign, drop column device, drop column country,
--     drop column is_bot;
-- ============================================================================
