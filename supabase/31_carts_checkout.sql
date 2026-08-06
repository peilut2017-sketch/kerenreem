-- ============================================================================
-- מכון קרן רא"ם — עגלות, Checkout sessions והגבלת קצב עמידה
-- להרצה אחרי 30_inventory.sql
-- ============================================================================
-- עגלת אורח נשארת ב-localStorage (kr:cart) — אין רשומה אנונימית במסד.
-- כאן: עגלת המחובר, ה-checkout session (התקדמות, נטישה, עוגן idempotency
-- לפני שקיימת הזמנה), וטבלת rate_limits — תחליף עמיד למגבל הקצב
-- שבזיכרון התהליך (contact/actions.ts), שנועד לנקודות הכספיות.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. carts + cart_items
-- ----------------------------------------------------------------------------
create table if not exists carts (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  status      text not null default 'active'
                check (status in ('active', 'merged', 'converted', 'expired')),
  currency    text not null default 'ILS',
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- עגלה פעילה אחת ללקוח
create unique index if not exists uq_carts_active_per_customer on carts (customer_id)
  where status = 'active';

drop trigger if exists trg_carts_updated on carts;
create trigger trg_carts_updated
  before update on carts
  for each row execute function set_updated_at();

create table if not exists cart_items (
  id       uuid primary key default gen_random_uuid(),
  cart_id  uuid not null references carts(id) on delete cascade,
  book_id  uuid not null references books(id) on delete restrict,
  quantity int not null check (quantity > 0 and quantity <= 99),
  added_at timestamptz not null default now(),
  unique (cart_id, book_id)
);

create index if not exists idx_cart_items_cart on cart_items (cart_id);

alter table carts      enable row level security;
alter table cart_items enable row level security;

revoke all on carts      from anon, authenticated;
revoke all on cart_items from anon, authenticated;
grant select, insert, update, delete on carts      to authenticated;
grant select, insert, update, delete on cart_items to authenticated;

drop policy if exists carts_owner on carts;
create policy carts_owner on carts
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

drop policy if exists carts_staff_read on carts;
create policy carts_staff_read on carts
  for select using (public.can_edit());

drop policy if exists cart_items_owner on cart_items;
create policy cart_items_owner on cart_items
  for all using (
    exists (select 1 from carts c where c.id = cart_id and c.customer_id = auth.uid())
  ) with check (
    exists (select 1 from carts c where c.id = cart_id and c.customer_id = auth.uid())
  );

drop policy if exists cart_items_staff_read on cart_items;
create policy cart_items_staff_read on cart_items
  for select using (public.can_edit());

-- ----------------------------------------------------------------------------
-- 2. checkout_sessions
-- ----------------------------------------------------------------------------
-- ה-id עצמו הוא ה-bearer (נשמר ב-cookie httpOnly). לכן אין policy ללקוח
-- כלל — כל הגישה דרך Server Actions עם service_role; הצוות קורא לדוח
-- הנטישה בלבד.
create table if not exists checkout_sessions (
  id                      uuid primary key default gen_random_uuid(),
  customer_id             uuid references customers(id) on delete set null,
  status                  text not null default 'open'
                            check (status in ('open', 'contact_entered', 'abandoned', 'converted', 'expired')),
  items                   jsonb not null default '[]'::jsonb,
  contact_phone           text,
  contact_name            text,
  contact_email           text,
  fulfillment             jsonb not null default '{}'::jsonb,
  is_gift                 boolean not null default false,
  gift_recipient_name     text,
  gift_message            text,
  gift_hide_prices        boolean not null default true,
  coupon_code             text,
  donation_amount         numeric(10,2),
  is_express              boolean not null default false,
  express_wallet          text check (express_wallet in ('bit', 'apple_pay', 'google_pay')),
  notify_channel          text check (notify_channel in ('sms', 'whatsapp')),
  terms_accepted_at       timestamptz,
  idempotency_key         text not null,
  order_id                uuid references orders(id) on delete set null,
  locale                  text not null default 'he',
  abandoned_email_sent_at timestamptz,
  expires_at              timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create unique index if not exists uq_checkout_sessions_idempotency
  on checkout_sessions (idempotency_key);
create index if not exists idx_checkout_sessions_abandoned
  on checkout_sessions (status, updated_at)
  where status in ('open', 'contact_entered');

drop trigger if exists trg_checkout_sessions_updated on checkout_sessions;
create trigger trg_checkout_sessions_updated
  before update on checkout_sessions
  for each row execute function set_updated_at();

alter table checkout_sessions enable row level security;
revoke all on checkout_sessions from anon, authenticated;
grant select on checkout_sessions to authenticated;

drop policy if exists checkout_sessions_staff_read on checkout_sessions;
create policy checkout_sessions_staff_read on checkout_sessions
  for select using (public.can_edit());

-- ----------------------------------------------------------------------------
-- 3. rate_limits — חלון הזזה עמיד (משותף לכל ה-instances)
-- ----------------------------------------------------------------------------
create table if not exists rate_limits (
  bucket     text not null,
  hit_at     timestamptz not null default now(),
  id         uuid primary key default gen_random_uuid()
);

create index if not exists idx_rate_limits_bucket on rate_limits (bucket, hit_at desc);

-- בדיקה + רישום באטומיות: מחזירה true אם הבקשה מותרת
create or replace function public.commerce_rate_limit(
  p_bucket text, p_max int, p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  -- ניקוי עצלן של החלון שחלף, רק בדלי הנוכחי
  delete from rate_limits
  where bucket = p_bucket and hit_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into v_count from rate_limits where bucket = p_bucket;
  if v_count >= p_max then
    return false;
  end if;

  insert into rate_limits (bucket) values (p_bucket);
  return true;
end $$;

revoke all on function commerce_rate_limit(text, int, int) from public, anon, authenticated;
grant execute on function commerce_rate_limit(text, int, int) to service_role;

alter table rate_limits enable row level security;
revoke all on rate_limits from anon, authenticated;
-- אין policies — service_role בלבד, דרך הפונקציה

-- ============================================================================
-- Rollback:
--   drop function commerce_rate_limit(text, int, int); drop table rate_limits;
--   drop table checkout_sessions;
--   drop table cart_items; drop table carts;
-- ============================================================================
