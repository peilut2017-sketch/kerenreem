-- ============================================================================
-- מכון קרן רא"ם — ציר הזמן של ההזמנה (append-only)
-- להרצה אחרי 27_order_states.sql
-- ============================================================================
-- כל שינוי מצב, ניסיון תשלום, מסמך, תנועת מלאי הקשורה להזמנה, הודעה
-- שנשלחה והערת צוות — שורה אחת כאן. אין update ואין delete: ציר זמן
-- שמשכתבים אותו אינו ציר זמן.
--
-- הערות צוות פנימיות נשמרות כאן (event_type='note_added') ולא כעמודה על
-- orders — במכוון: policy הקריאה של הלקוח על orders חושפת את כל
-- העמודות, ולטבלה הזו ללקוח אין policy כלל.
-- ============================================================================

create table if not exists order_events (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders(id) on delete cascade,
  event_type  text not null,
  data        jsonb not null default '{}'::jsonb,
  actor_type  text not null default 'system'
                check (actor_type in ('customer', 'staff', 'system', 'morning', 'shipping_provider')),
  actor_id    uuid,
  actor_label text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_order_events_order on order_events (order_id, created_at);

alter table order_events enable row level security;
revoke all on order_events from anon, authenticated;
grant select, insert on order_events to authenticated;

-- צוות קורא וכותב; ללקוח אין גישה ישירה — גרסה מסוננת מוגשת דרך שכבת
-- השרת (עמוד המעקב). כתיבת מערכת — service_role.
drop policy if exists order_events_staff_read on order_events;
create policy order_events_staff_read on order_events
  for select using (public.can_edit());

drop policy if exists order_events_staff_insert on order_events;
create policy order_events_staff_insert on order_events
  for insert with check (public.can_edit());

-- ============================================================================
-- Rollback:  drop table order_events;
-- ============================================================================
