-- ============================================================================
-- מכון קרן רא"ם — סכימת Supabase
-- גרסה 1.0 | מוכן להרצה ב-Supabase SQL Editor
-- ----------------------------------------------------------------------------
-- סדר ההרצה: extensions → enums → פונקציות עזר → טבלאות → אינדקסים →
--            טריגרים → RLS. ניתן להריץ את הקובץ כולו ברצף אחד.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ----------------------------------------------------------------------------
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "unaccent";       -- חיפוש טקסט

-- ----------------------------------------------------------------------------
-- 2. ENUMS
-- ----------------------------------------------------------------------------
create type user_role as enum ('admin', 'editor', 'viewer');
create type order_status as enum ('pending', 'paid', 'failed', 'shipped', 'cancelled', 'refunded');

-- ----------------------------------------------------------------------------
-- 3. פונקציות עזר
-- ----------------------------------------------------------------------------

-- עדכון אוטומטי של updated_at
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- פונקציות ההרשאה (current_user_role / can_edit / is_admin) מוגדרות
-- בסעיף 4.1א, מיד אחרי טבלת profiles. הן קוראות ממנה, ו-Postgres מאמת
-- את גוף הפונקציה כבר בזמן היצירה — ולכן הן חייבות לבוא אחרי הטבלה.

-- ============================================================================
-- 4. טבלאות
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 4.1 profiles — משתמשי צוות (מקושר ל-auth.users)
-- ----------------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  role        user_role not null default 'viewer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- יצירת profile אוטומטית בעת הרשמת משתמש חדש
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ----------------------------------------------------------------------------
-- 4.1א פונקציות הרשאה — משמשות בכל מדיניות ה-RLS שבהמשך
-- ----------------------------------------------------------------------------
-- הועברו לכאן מסעיף 3: הן שולפות מ-profiles, ופונקציית language sql
-- מאומתת בזמן היצירה. הגדרתן לפני הטבלה נכשלת ב-
-- ERROR: relation "public.profiles" does not exist

-- שליפת תפקיד המשתמש הנוכחי (משמש ב-RLS)
create or replace function current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- בדיקה אם המשתמש הנוכחי הוא admin או editor (הרשאת כתיבה)
create or replace function can_edit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_user_role() in ('admin', 'editor');
$$;

-- בדיקה אם המשתמש הנוכחי הוא admin
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_user_role() = 'admin';
$$;

-- ----------------------------------------------------------------------------
-- 4.2 categories — קטגוריות ספרים
-- ----------------------------------------------------------------------------
create table categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name_he     text not null,
  name_en     text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4.3 authors — מחברים / דמויות
-- ----------------------------------------------------------------------------
create table authors (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name_he     text not null,
  name_en     text,
  bio_he      text,
  bio_en      text,
  portrait_url text,
  birth_year  text,   -- טקסט כדי לאפשר תאריך עברי ("תר"ף")
  death_year  text,
  sort_order  int not null default 0,
  is_published boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4.4 books — לב הקטלוג (כולל שדות מסחר רדומים)
-- ----------------------------------------------------------------------------
create table books (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  title_he        text not null,
  title_en        text,
  subtitle_he     text,
  subtitle_en     text,
  description_he  text,   -- טקסט עשיר (HTML מ-Tiptap)
  description_en  text,
  author_id       uuid references authors(id) on delete set null,
  category_id     uuid references categories(id) on delete set null,
  publication_year_he  text,   -- שנה עברית
  publication_year_ce  int,    -- שנה לועזית
  cover_image_url text,
  pages           int,
  format          text,   -- כריכה, גודל וכו'
  binding         text,
  isbn            text,
  volume_count    int default 1,
  sample_pdf_url  text,

  -- --- שדות מסחר: נבנים עכשיו, רדומים עד הפעלת החנות ---
  price           numeric(10,2),
  currency        text default 'ILS',
  sku             text unique,
  stock_quantity  int default 0,
  is_purchasable  boolean not null default false,
  weight_grams    int,
  -- -----------------------------------------------------

  is_published    boolean not null default false,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4.5 activities — צירי פעילות הקרן
-- ----------------------------------------------------------------------------
create table activities (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title_he    text not null,
  title_en    text,
  summary_he  text,
  summary_en  text,
  body_he     text,   -- טקסט עשיר
  body_en     text,
  icon        text,
  cover_image_url text,
  sort_order  int not null default 0,
  is_published boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4.6 events — אירועים
-- ----------------------------------------------------------------------------
create table events (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title_he    text not null,
  title_en    text,
  event_date  date,
  event_date_he text,   -- תאריך עברי חוזר (למשל "ט"ו באב") לאירועים שנתיים
  body_he     text,   -- טקסט עשיר
  body_en     text,
  cover_image_url text,
  featured_video_url text,   -- וידאו ראשי אופציונלי (YouTube/Vimeo) לראש העמוד
  gallery     jsonb not null default '[]'::jsonb,  -- מערך {url, caption_he, caption_en}
  is_published boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4.7 pages — עמודי תוכן דינמיים (אודות וכו')
-- ----------------------------------------------------------------------------
create table pages (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title_he    text not null,
  title_en    text,
  body_he     text,
  body_en     text,
  is_published boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4.8 site_settings — הגדרות גלובליות ודגלי פיצ'ר (שורה יחידה)
-- ----------------------------------------------------------------------------
create table site_settings (
  id            int primary key default 1,
  logo_url      text,
  contact       jsonb not null default '{}'::jsonb,   -- טלפון, אימייל, כתובת
  social_links  jsonb not null default '{}'::jsonb,
  store_enabled boolean not null default false,       -- דגל הפעלת החנות
  extra         jsonb not null default '{}'::jsonb,
  updated_at    timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into site_settings (id) values (1) on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 4.9 טבלאות מסחר — נבנות עכשיו, מופעלות בשלב ב'
-- ----------------------------------------------------------------------------
create table orders (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete set null,
  status        order_status not null default 'pending',
  total         numeric(10,2) not null default 0,
  currency      text not null default 'ILS',
  payment_ref   text,   -- מזהה עסקה מספק הסליקה
  shipping_address jsonb,
  contact_email text,
  contact_phone text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  book_id     uuid references books(id) on delete set null,
  title_snapshot text,   -- שם הספר בעת ההזמנה (למקרה ששונה)
  quantity    int not null default 1 check (quantity > 0),
  unit_price  numeric(10,2) not null
);

-- ----------------------------------------------------------------------------
-- 4.10 audit_log — תיעוד שינויים
-- ----------------------------------------------------------------------------
create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  action      text not null,        -- insert / update / delete
  table_name  text not null,
  record_id   uuid,
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- 5. אינדקסים
-- ============================================================================
create index idx_books_author       on books(author_id);
create index idx_books_category      on books(category_id);
create index idx_books_published     on books(is_published) where is_published = true;
create index idx_books_slug          on books(slug);
create index idx_authors_published   on authors(is_published) where is_published = true;
create index idx_events_date         on events(event_date desc);
create index idx_events_published    on events(is_published) where is_published = true;
create index idx_order_items_order    on order_items(order_id);
create index idx_orders_user          on orders(user_id);
create index idx_audit_table          on audit_log(table_name, record_id);

-- חיפוש טקסט חופשי בכותרות ספרים (עברית + אנגלית)
create index idx_books_search on books
  using gin (to_tsvector('simple', coalesce(title_he,'') || ' ' || coalesce(title_en,'') || ' ' || coalesce(subtitle_he,'')));

-- ============================================================================
-- 6. טריגרים ל-updated_at
-- ============================================================================
create trigger trg_profiles_updated   before update on profiles   for each row execute function set_updated_at();
create trigger trg_categories_updated before update on categories for each row execute function set_updated_at();
create trigger trg_authors_updated    before update on authors    for each row execute function set_updated_at();
create trigger trg_books_updated      before update on books      for each row execute function set_updated_at();
create trigger trg_activities_updated before update on activities for each row execute function set_updated_at();
create trigger trg_events_updated     before update on events     for each row execute function set_updated_at();
create trigger trg_pages_updated      before update on pages      for each row execute function set_updated_at();
create trigger trg_orders_updated     before update on orders     for each row execute function set_updated_at();

-- ============================================================================
-- 7. ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
-- עיקרון: קריאה ציבורית רק לתוכן שפורסם. כתיבה לפי תפקיד.
-- ============================================================================

alter table profiles     enable row level security;
alter table categories   enable row level security;
alter table authors      enable row level security;
alter table books        enable row level security;
alter table activities   enable row level security;
alter table events       enable row level security;
alter table pages        enable row level security;
alter table site_settings enable row level security;
alter table orders       enable row level security;
alter table order_items  enable row level security;
alter table audit_log    enable row level security;

-- ---------- profiles ----------
-- כל אחד רואה את הפרופיל שלו; admin רואה הכל
create policy profiles_select_self on profiles
  for select using (id = auth.uid() or is_admin());
-- admin בלבד מנהל תפקידים
create policy profiles_admin_all on profiles
  for all using (is_admin()) with check (is_admin());

-- ---------- טבלאות תוכן: תבנית קריאה ציבורית + כתיבה לעורכים ----------
-- categories
create policy categories_public_read on categories
  for select using (true);
create policy categories_edit on categories
  for all using (can_edit()) with check (can_edit());

-- authors
create policy authors_public_read on authors
  for select using (is_published or can_edit());
create policy authors_edit on authors
  for all using (can_edit()) with check (can_edit());

-- books
create policy books_public_read on books
  for select using (is_published or can_edit());
create policy books_edit on books
  for all using (can_edit()) with check (can_edit());

-- activities
create policy activities_public_read on activities
  for select using (is_published or can_edit());
create policy activities_edit on activities
  for all using (can_edit()) with check (can_edit());

-- events
create policy events_public_read on events
  for select using (is_published or can_edit());
create policy events_edit on events
  for all using (can_edit()) with check (can_edit());

-- pages
create policy pages_public_read on pages
  for select using (is_published or can_edit());
create policy pages_edit on pages
  for all using (can_edit()) with check (can_edit());

-- ---------- site_settings ----------
create policy settings_public_read on site_settings
  for select using (true);
create policy settings_admin_write on site_settings
  for all using (is_admin()) with check (is_admin());

-- ---------- orders + order_items (שלב ב') ----------
-- לקוח רואה את ההזמנות שלו; צוות רואה הכל
create policy orders_own_read on orders
  for select using (user_id = auth.uid() or can_edit());
-- יצירת הזמנה: מאומת בלבד (בפועל תיווצר בצד השרת עם service_role)
create policy orders_insert on orders
  for insert with check (user_id = auth.uid() or can_edit());
-- עדכון סטטוס: צוות בלבד
create policy orders_staff_update on orders
  for update using (can_edit()) with check (can_edit());

create policy order_items_read on order_items
  for select using (
    exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or can_edit()))
  );
create policy order_items_insert on order_items
  for insert with check (
    exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or can_edit()))
  );

-- ---------- audit_log ----------
create policy audit_admin_read on audit_log
  for select using (is_admin());
-- כתיבה נעשית בצד השרת (service_role עוקף RLS); אין policy ל-insert מהלקוח

-- ============================================================================
-- 8. הערות תפעוליות
-- ----------------------------------------------------------------------------
-- • המשתמש הראשון: לאחר הרשמה, הפוך אותו ל-admin ידנית:
--     update profiles set role = 'admin' where id = '<user-uuid>';
-- • פעולות סליקה והזמנות בצד השרת ירוצו עם service_role key שעוקף RLS —
--   לעולם לא לחשוף מפתח זה בצד הלקוח.
-- • Storage: צור buckets נפרדים — 'covers', 'events', 'samples', 'portraits'.
--   קריאה ציבורית; כתיבה מוגבלת למאומתים.
-- • שדות _en יכולים להישאר ריקים בשלב א'; התשתית מוכנה למילוי הדרגתי.
-- ============================================================================
