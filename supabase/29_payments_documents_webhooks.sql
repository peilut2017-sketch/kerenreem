-- ============================================================================
-- מכון קרן רא"ם — תשלומים, מסמכים חשבונאיים ואירועי Webhook (מורנינג)
-- להרצה אחרי 28_order_events.sql
-- ============================================================================
-- שלוש הטבלאות הכספיות ביותר במערכת. עקרונות:
--   • אפס גישת כתיבה מהדפדפן — service_role בלבד.
--   • Idempotency נאכף כאן, באילוצי unique, לא רק בקוד.
--   • שום שורה אינה נמחקת; ביטול = מצב, לא מחיקה (on delete restrict).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. payments — חיובים וזיכויים
-- ----------------------------------------------------------------------------
create table if not exists payments (
  id                       uuid primary key default gen_random_uuid(),
  order_id                 uuid not null references orders(id) on delete restrict,
  kind                     text not null default 'charge' check (kind in ('charge', 'refund')),
  parent_payment_id        uuid references payments(id) on delete restrict,
  provider                 text not null default 'morning',
  method                   text check (method in ('credit', 'bit', 'apple_pay', 'google_pay', 'manual_external')),
  amount                   numeric(10,2) not null check (amount > 0),
  currency                 text not null default 'ILS',
  installments             int not null default 1 check (installments >= 1),
  status                   text not null default 'initiated'
                             check (status in ('initiated', 'pending', 'succeeded', 'failed', 'cancelled', 'expired')),
  morning_transaction_id   text,
  morning_payment_page_url text,
  morning_payload          jsonb,
  idempotency_key          text not null,
  error                    jsonb,
  expires_at               timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create unique index if not exists uq_payments_idempotency on payments (idempotency_key);
create unique index if not exists uq_payments_morning_txn on payments (morning_transaction_id)
  where morning_transaction_id is not null;
create index if not exists idx_payments_order on payments (order_id);
create index if not exists idx_payments_open on payments (status)
  where status in ('initiated', 'pending');

drop trigger if exists trg_payments_updated on payments;
create trigger trg_payments_updated
  before update on payments
  for each row execute function set_updated_at();

-- תקרת זיכויים: סכום הזיכויים שהצליחו/פתוחים לחיוב נתון לעולם אינו עולה
-- על סכום החיוב. קו ההגנה האחרון מתחת לבדיקה בקוד.
create or replace function public.enforce_refund_cap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_charge_amount numeric(10,2);
  v_refunded      numeric(10,2);
begin
  if new.kind <> 'refund' then
    return new;
  end if;
  if new.parent_payment_id is null then
    raise exception 'refund requires parent_payment_id';
  end if;

  select amount into v_charge_amount
  from payments
  where id = new.parent_payment_id and kind = 'charge'
  for update;

  if v_charge_amount is null then
    raise exception 'parent payment not found or not a charge';
  end if;

  select coalesce(sum(amount), 0) into v_refunded
  from payments
  where parent_payment_id = new.parent_payment_id
    and kind = 'refund'
    and status in ('initiated', 'pending', 'succeeded')
    and id <> new.id;

  if v_refunded + new.amount > v_charge_amount then
    raise exception 'refund total % exceeds charge amount %', v_refunded + new.amount, v_charge_amount;
  end if;
  return new;
end $$;

drop trigger if exists trg_payments_refund_cap on payments;
create trigger trg_payments_refund_cap
  before insert on payments
  for each row execute function enforce_refund_cap();

alter table payments enable row level security;
revoke all on payments from anon, authenticated;
grant select on payments to authenticated;

drop policy if exists payments_staff_read on payments;
create policy payments_staff_read on payments
  for select using (public.can_edit());

-- ----------------------------------------------------------------------------
-- 2. documents — מסמכים חשבונאיים ממורנינג
-- ----------------------------------------------------------------------------
create table if not exists documents (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references orders(id) on delete restrict,
  payment_id      uuid references payments(id) on delete restrict,
  provider        text not null default 'morning',
  morning_doc_id  text,
  doc_type        text not null
                    check (doc_type in ('invoice_receipt', 'receipt', 'donation_receipt', 'credit_note')),
  doc_number      text,
  issued_at       timestamptz,
  amount          numeric(10,2) not null,
  currency        text not null default 'ILS',
  status          text not null default 'pending'
                    check (status in ('pending', 'created', 'failed', 'cancelled')),
  download_url    text,
  url_expires_at  timestamptz,
  storage_path    text,
  error           text,
  attempts        int not null default 0,
  last_attempt_at timestamptz,
  idempotency_key text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists uq_documents_idempotency on documents (idempotency_key);
create unique index if not exists uq_documents_morning_id on documents (morning_doc_id)
  where morning_doc_id is not null;
-- מסמך חי אחד לכל סוג להזמנה — מניעת מסמך כפול ברמת המסד
create unique index if not exists uq_documents_live_per_order on documents (order_id, doc_type)
  where status in ('pending', 'created');
create index if not exists idx_documents_order on documents (order_id);
create index if not exists idx_documents_failed on documents (status) where status = 'failed';

drop trigger if exists trg_documents_updated on documents;
create trigger trg_documents_updated
  before update on documents
  for each row execute function set_updated_at();

alter table documents enable row level security;
revoke all on documents from anon, authenticated;
grant select on documents to authenticated;

-- הלקוח רואה מסמכים של הזמנותיו; הצוות רואה הכל; כתיבה — service_role
drop policy if exists documents_read on documents;
create policy documents_read on documents
  for select using (
    public.can_edit()
    or exists (select 1 from orders o where o.id = order_id and o.user_id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 3. webhook_events — כל אירוע נכנס, גולמי, לפני כל עיבוד
-- ----------------------------------------------------------------------------
create table if not exists webhook_events (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null default 'morning',
  event_type        text,
  external_event_id text,
  dedupe_hash       text not null,
  signature_valid   boolean not null,
  payload           jsonb not null,
  received_at       timestamptz not null default now(),
  processing_status text not null default 'received'
                      check (processing_status in ('received', 'processed', 'duplicate', 'invalid_signature', 'failed')),
  processed_at      timestamptz,
  attempts          int not null default 0,
  error             text,
  order_id          uuid references orders(id) on delete set null,
  payment_id        uuid references payments(id) on delete set null
);

-- שני מנגנוני dedupe: מזהה אירוע של הספק (אם קיים) + hash על גוף מנורמל
create unique index if not exists uq_webhook_external_id on webhook_events (provider, external_event_id)
  where external_event_id is not null;
create unique index if not exists uq_webhook_dedupe on webhook_events (provider, dedupe_hash);
create index if not exists idx_webhook_failed on webhook_events (processing_status)
  where processing_status = 'failed';
create index if not exists idx_webhook_received on webhook_events (received_at desc);

alter table webhook_events enable row level security;
revoke all on webhook_events from anon, authenticated;
grant select on webhook_events to authenticated;

drop policy if exists webhook_events_admin_read on webhook_events;
create policy webhook_events_admin_read on webhook_events
  for select using (public.is_admin());

-- ============================================================================
-- Rollback:
--   drop table webhook_events;
--   drop table documents;
--   drop trigger trg_payments_refund_cap on payments; drop function enforce_refund_cap();
--   drop table payments;
-- ============================================================================
