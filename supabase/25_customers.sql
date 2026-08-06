-- ============================================================================
-- מכון קרן רא"ם — שכבת הלקוחות: customers, כתובות, שמורים, הסכמות
-- להרצה אחרי 24_store_settings.sql (ואחרי 23 — חובה, ראו שם)
-- ============================================================================
-- לקוח = רשומת auth.users עם שורת customers ו*בלי* שורת profiles.
-- ההפרדה נאכפת בשלוש שכבות: הטריגר המותנה (23), פונקציות ההרשאה
-- שמחזירות null בהיעדר profiles (ולכן can_edit/is_admin שקריים), וה-UI.
--
-- הערת grants: 06_restore_grants.sql קבע default privileges שמעניקים הכל
-- ל-anon/authenticated על כל טבלה חדשה. לכן כל טבלה כאן פותחת ב-revoke
-- מפורש ומעניקה מחדש רק את המינימום — הגנה בעומק מתחת ל-RLS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. customers
-- ----------------------------------------------------------------------------
create table if not exists customers (
  id                       uuid primary key references auth.users(id) on delete cascade,
  phone                    text not null unique,
  email                    text,
  full_name                text,
  -- fk מוגדר בהמשך, אחרי יצירת customer_addresses
  default_address_id       uuid,
  marketing_email_opt_in   boolean not null default false,
  channel_sms_opt_in       boolean not null default false,
  channel_whatsapp_opt_in  boolean not null default false,
  locale                   text not null default 'he',
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

drop trigger if exists trg_customers_updated on customers;
create trigger trg_customers_updated
  before update on customers
  for each row execute function set_updated_at();

alter table customers enable row level security;
revoke all on customers from anon, authenticated;
grant select, update on customers to authenticated;

-- הלקוח רואה ומעדכן את עצמו; הצוות רואה (ניהול לקוחות). יצירה — צד שרת
-- בלבד (service_role, בתהליך החשבון הפסיבי) — אין policy ואין grant ל-insert.
drop policy if exists customers_self_select on customers;
create policy customers_self_select on customers
  for select using (id = auth.uid() or public.can_edit());

drop policy if exists customers_self_update on customers;
create policy customers_self_update on customers
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists customers_admin_update on customers;
create policy customers_admin_update on customers
  for update using (public.is_admin()) with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- 2. customer_addresses
-- ----------------------------------------------------------------------------
create table if not exists customer_addresses (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references customers(id) on delete cascade,
  label          text,
  recipient_name text not null,
  phone          text,
  city           text not null,
  street         text not null,
  house_number   text not null,
  entrance       text,
  floor          text,
  apartment      text,
  zip            text,
  courier_notes  text,
  is_default     boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_customer_addresses_customer on customer_addresses (customer_id);
-- כתובת ברירת מחדל אחת לכל היותר ללקוח
create unique index if not exists uq_customer_default_address
  on customer_addresses (customer_id) where is_default;

drop trigger if exists trg_customer_addresses_updated on customer_addresses;
create trigger trg_customer_addresses_updated
  before update on customer_addresses
  for each row execute function set_updated_at();

alter table customer_addresses enable row level security;
revoke all on customer_addresses from anon, authenticated;
grant select, insert, update, delete on customer_addresses to authenticated;

drop policy if exists customer_addresses_owner on customer_addresses;
create policy customer_addresses_owner on customer_addresses
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

drop policy if exists customer_addresses_staff_read on customer_addresses;
create policy customer_addresses_staff_read on customer_addresses
  for select using (public.can_edit());

-- עכשיו אפשר לסגור את המעגל של כתובת ברירת המחדל
alter table customers drop constraint if exists customers_default_address_fkey;
alter table customers add constraint customers_default_address_fkey
  foreign key (default_address_id) references customer_addresses(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 3. saved_books — שיקוף מועדפים (kr:favourites) והמדף (kr:shelf) למחוברים
-- ----------------------------------------------------------------------------
-- ערכי shelf זהים למפתחות ShelfPicker.tsx — מיזוג ההתחברות הוא העתקה
-- ישירה של מבנה ה-localStorage, בלי טבלת תרגום.
create table if not exists saved_books (
  customer_id  uuid not null references customers(id) on delete cascade,
  book_id      uuid not null references books(id) on delete cascade,
  is_favourite boolean not null default false,
  shelf        text check (shelf in ('wantToRead', 'wantToBuy', 'owned', 'wantAsGift')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (customer_id, book_id)
);

-- מזין את לולאות השיווק: "ספרים שמחכים ברשימת לקנות"
create index if not exists idx_saved_books_want_to_buy
  on saved_books (book_id) where shelf = 'wantToBuy';

drop trigger if exists trg_saved_books_updated on saved_books;
create trigger trg_saved_books_updated
  before update on saved_books
  for each row execute function set_updated_at();

alter table saved_books enable row level security;
revoke all on saved_books from anon, authenticated;
grant select, insert, update, delete on saved_books to authenticated;

drop policy if exists saved_books_owner on saved_books;
create policy saved_books_owner on saved_books
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

-- ----------------------------------------------------------------------------
-- 4. consent_events — תיעוד הסכמות, append-only
-- ----------------------------------------------------------------------------
create table if not exists consent_events (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete set null,
  email       text,
  phone       text,
  kind        text not null check (kind in ('marketing_email', 'channel_sms', 'channel_whatsapp', 'terms')),
  granted     boolean not null,
  source      text not null check (source in ('checkout', 'account', 'thank_you', 'unsubscribe_link', 'staff')),
  order_id    uuid,
  created_at  timestamptz not null default now()
);

create index if not exists idx_consent_events_customer on consent_events (customer_id, created_at desc);

alter table consent_events enable row level security;
revoke all on consent_events from anon, authenticated;
grant select on consent_events to authenticated;

-- כתיבה בצד שרת בלבד (service_role); הצוות קורא לצורכי ביקורת
drop policy if exists consent_events_staff_read on consent_events;
create policy consent_events_staff_read on consent_events
  for select using (public.can_edit());

-- ============================================================================
-- Rollback (סדר הפוך, אין נתונים בשלב ההרצה):
--   drop table consent_events;
--   drop table saved_books;
--   alter table customers drop constraint customers_default_address_fkey;
--   drop table customer_addresses;
--   drop table customers;
-- ============================================================================
