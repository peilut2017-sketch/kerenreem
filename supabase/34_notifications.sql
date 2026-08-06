-- ============================================================================
-- מכון קרן רא"ם — תיעוד הודעות, התראות חזרה למלאי ואירועי מסחר
-- להרצה אחרי 33_coupons.sql
-- ============================================================================
-- notification_log: כל הודעה יוצאת — מייל (ערוץ הבסיס, תמיד), SMS/וואטסאפ
-- (רק בהסכמה). idempotency_key ייחודי הופך מייל כפול לבלתי אפשרי במסד.
--
-- commerce_events יושבת כאן (ולא בקובץ נפרד) לצד יתר טבלאות הרישום:
-- אותה תבנית RLS מוכחת של page_views — הוספה חופשית, קריאה לצוות,
-- מחיקה למנהל. בלי PII: מזהים בלבד.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. notification_log
-- ----------------------------------------------------------------------------
create table if not exists notification_log (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid references orders(id) on delete set null,
  customer_id         uuid references customers(id) on delete set null,
  template            text not null,
  channel             text not null check (channel in ('email', 'sms', 'whatsapp')),
  recipient           text not null,
  provider            text,
  provider_message_id text,
  status              text not null default 'queued'
                        check (status in ('queued', 'sent', 'failed', 'skipped')),
  attempts            int not null default 0,
  error               text,
  idempotency_key     text not null,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz
);

create unique index if not exists uq_notification_idempotency on notification_log (idempotency_key);
create index if not exists idx_notification_order on notification_log (order_id);
create index if not exists idx_notification_failed on notification_log (status) where status = 'failed';

alter table notification_log enable row level security;
revoke all on notification_log from anon, authenticated;
grant select on notification_log to authenticated;

drop policy if exists notification_log_staff_read on notification_log;
create policy notification_log_staff_read on notification_log
  for select using (public.can_edit());

-- ----------------------------------------------------------------------------
-- 2. back_in_stock_subscriptions
-- ----------------------------------------------------------------------------
create table if not exists back_in_stock_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  book_id     uuid not null references books(id) on delete cascade,
  customer_id uuid references customers(id) on delete cascade,
  email       text,
  phone       text,
  channel     text not null default 'email' check (channel in ('email', 'sms', 'whatsapp')),
  created_at  timestamptz not null default now(),
  notified_at timestamptz,
  constraint back_in_stock_has_target check (customer_id is not null or email is not null)
);

create unique index if not exists uq_back_in_stock_email
  on back_in_stock_subscriptions (book_id, email)
  where notified_at is null and email is not null;
create unique index if not exists uq_back_in_stock_customer
  on back_in_stock_subscriptions (book_id, customer_id)
  where notified_at is null and customer_id is not null;

alter table back_in_stock_subscriptions enable row level security;
revoke all on back_in_stock_subscriptions from anon, authenticated;
grant select, delete on back_in_stock_subscriptions to authenticated;

-- לקוח רואה ומבטל את ההרשמות שלו; ההרשמה עצמה — Server Action (service_role)
drop policy if exists back_in_stock_owner on back_in_stock_subscriptions;
create policy back_in_stock_owner on back_in_stock_subscriptions
  for select using (customer_id = auth.uid() or public.can_edit());

drop policy if exists back_in_stock_owner_delete on back_in_stock_subscriptions;
create policy back_in_stock_owner_delete on back_in_stock_subscriptions
  for delete using (customer_id = auth.uid() or public.is_admin());

-- ----------------------------------------------------------------------------
-- 3. commerce_events — אירועי אנליטיקה ראשוניים (first-party)
-- ----------------------------------------------------------------------------
create table if not exists commerce_events (
  id           uuid primary key default gen_random_uuid(),
  event_name   text not null,
  book_id      uuid references books(id) on delete set null,
  order_id     uuid references orders(id) on delete set null,
  value_agorot bigint,
  meta         jsonb not null default '{}'::jsonb,
  session_key  text not null,
  visitor_hash text not null,
  locale       text not null default 'he',
  created_at   timestamptz not null default now()
);

create index if not exists idx_commerce_events_name on commerce_events (event_name, created_at desc);
create index if not exists idx_commerce_events_created on commerce_events (created_at desc);
-- מניעת כפל: אותו אירוע על אותה ישות באותו session נרשם פעם אחת
create unique index if not exists uq_commerce_events_dedupe
  on commerce_events (session_key, event_name, coalesce(book_id, '00000000-0000-0000-0000-000000000000'::uuid),
                      coalesce(order_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table commerce_events enable row level security;
revoke all on commerce_events from anon, authenticated;
grant insert on commerce_events to anon, authenticated;
grant select on commerce_events to authenticated;
grant delete on commerce_events to authenticated;

drop policy if exists commerce_events_insert on commerce_events;
create policy commerce_events_insert on commerce_events
  for insert to anon, authenticated with check (true);

drop policy if exists commerce_events_staff_read on commerce_events;
create policy commerce_events_staff_read on commerce_events
  for select using (public.can_edit());

drop policy if exists commerce_events_admin_delete on commerce_events;
create policy commerce_events_admin_delete on commerce_events
  for delete using (public.is_admin());

-- ============================================================================
-- Rollback:
--   drop table commerce_events;
--   drop table back_in_stock_subscriptions;
--   drop table notification_log;
-- ============================================================================
