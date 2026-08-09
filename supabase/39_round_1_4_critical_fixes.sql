-- ============================================================================
-- מכון קרן רא"ם — סבב 1.4: תיקוני נתיב קריטי מביקורת המימוש
-- להרצה אחרי 38_editing_picking_promotions.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. מספר מעקב על ההזמנה (במקום לחיות רק בתוך order_events.data) — כדי
--    שיהיה ניתן להציג, לחפש ולאחזר אותו מכל מסך, לא רק מציר הזמן.
-- ----------------------------------------------------------------------------
alter table orders add column if not exists tracking_company text;
alter table orders add column if not exists tracking_number text;
alter table orders add column if not exists tracking_url text;

-- ----------------------------------------------------------------------------
-- 2. תוצאות התאמה יומית מול מורנינג — עד כה reconcileRecentPayments רץ
--    ב-cron ותוצאתו נזרקת (JSON של תשובת ה-route בלבד). בלי שמירה אין
--    "מתי רצה לאחרונה", אין היסטוריה, ואין דרך לדעת שה-API של מורנינג
--    לא הגיב שבוע. נכתב פעם ביום מ-src/app/api/cron/commerce/route.ts.
-- ----------------------------------------------------------------------------
create table if not exists reconciliation_runs (
  id           uuid primary key default gen_random_uuid(),
  ran_at       timestamptz not null default now(),
  checked      int not null default 0,
  matched      int not null default 0,
  mismatched   int not null default 0,
  unreachable  int not null default 0,
  skipped      text
);

create index if not exists idx_reconciliation_runs_ran_at on reconciliation_runs (ran_at desc);

alter table reconciliation_runs enable row level security;
revoke all on reconciliation_runs from anon, authenticated;
grant select on reconciliation_runs to authenticated;

drop policy if exists reconciliation_runs_staff_read on reconciliation_runs;
create policy reconciliation_runs_staff_read on reconciliation_runs
  for select using (public.can_manage_store());

-- ============================================================================
-- לאימות אחרי הרצה:
--   select tracking_company, tracking_number, tracking_url from orders limit 1;
--   select * from reconciliation_runs order by ran_at desc limit 5;
-- ============================================================================
