-- ============================================================================
-- מכון קרן רא"ם — הגדרות חנות ודגלי מסחר שכבתיים
-- להרצה אחרי 23_customer_auth_separation.sql
-- ============================================================================
-- site_settings.store_enabled נשאר מתג-העל (הקוד הקיים תלוי בו). הטבלה
-- הזו מוסיפה מתחתיו דגלים שכבתיים ותצורה תפעולית, בשורה יחידה כמו
-- site_settings. עמודות מוקלדות ולא jsonb: לתצורה כספית מגיע טיפוס,
-- default ו-check — לא מפתח חופשי שמתגלה שגוי רק בזמן ריצה.
-- ============================================================================

create table if not exists store_settings (
  id                        int primary key default 1,

  -- דגלים שכבתיים: שכבה נפעלת רק כשהשכבות שתחתיה פעילות (נאכף בקוד)
  show_prices               boolean not null default false,
  cart_enabled              boolean not null default false,
  checkout_enabled          boolean not null default false,
  payments_enabled          boolean not null default false,
  express_checkout_enabled  boolean not null default false,
  coupons_enabled           boolean not null default false,
  accounts_enabled          boolean not null default false,
  returns_enabled           boolean not null default false,
  recommendations_enabled   boolean not null default false,
  donations_enabled         boolean not null default false,

  -- תצורה כספית ותפעולית
  free_shipping_threshold   numeric(10,2) check (free_shipping_threshold is null or free_shipping_threshold >= 0),
  installments_min_total    numeric(10,2) not null default 250 check (installments_min_total >= 0),
  installments_max          int not null default 3 check (installments_max >= 1),
  vat_mode                  text not null default 'included' check (vat_mode in ('exempt', 'included')),
  vat_rate                  numeric(5,2) not null default 18.00 check (vat_rate >= 0),
  document_type             text not null default 'invoice_receipt'
                              check (document_type in ('invoice_receipt', 'receipt', 'donation_receipt')),
  order_prep_days           int not null default 1 check (order_prep_days >= 0),
  delivery_buffer_days      int not null default 1 check (delivery_buffer_days >= 0),
  -- מערך תאריכים (YYYY-MM-DD) שאינם ימי עבודה מעבר לשישי-שבת ולחגים
  -- המחושבים מ-hebcal בצד השרת — למשל בין-הזמנים או ימי מלאי
  non_working_dates         jsonb not null default '[]'::jsonb,

  pickup_enabled            boolean not null default true,
  pickup_address            jsonb not null default '{}'::jsonb,
  pickup_hours              text,
  pickup_prep_hours         int not null default 24 check (pickup_prep_hours >= 0),

  support_phone             text,
  low_stock_threshold       int not null default 2 check (low_stock_threshold >= 0),
  guest_link_ttl_days       int not null default 90 check (guest_link_ttl_days >= 1),
  abandoned_after_minutes   int not null default 60 check (abandoned_after_minutes >= 5),
  abandoned_retention_days  int not null default 90 check (abandoned_retention_days >= 1),
  add_to_order_window_hours int not null default 12 check (add_to_order_window_hours >= 0),

  updated_at                timestamptz not null default now(),
  constraint store_settings_single_row check (id = 1)
);

insert into store_settings (id) values (1) on conflict do nothing;

drop trigger if exists trg_store_settings_updated on store_settings;
create trigger trg_store_settings_updated
  before update on store_settings
  for each row execute function set_updated_at();

-- RLS: קריאה ציבורית (הצד הציבורי זקוק לסף משלוח חינם, לטלפון העזרה
-- ולדגלים; אין כאן סוד), כתיבה למנהל בלבד.
alter table store_settings enable row level security;

revoke all on store_settings from anon, authenticated;
grant select on store_settings to anon, authenticated;
grant update on store_settings to authenticated;

drop policy if exists store_settings_public_read on store_settings;
create policy store_settings_public_read on store_settings
  for select using (true);

drop policy if exists store_settings_admin_write on store_settings;
create policy store_settings_admin_write on store_settings
  for update using (public.is_admin()) with check (public.is_admin());

-- ============================================================================
-- Rollback:  drop table store_settings;
-- ============================================================================
