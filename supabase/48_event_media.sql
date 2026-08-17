-- ============================================================================
-- מכון קרן רא"ם — Event Story Gallery: מדיית אירועים ושלבים
-- להרצה אחרי 47_custom_fonts.sql
-- ============================================================================
--
-- תצוגת המדיה של אירוע נבנית מחדש כ"סיפור אירוע": טבלת מדיה מסודרת
-- (תמונות ווידאו) במקום שדה jsonb, עם שלבים (Chapters), כתוביות,
-- נקודת מיקוד, מובלטת, ומידות שנשמרות מראש (כדי שהפריסה לא תקפוץ
-- בזמן טעינה). שדה events.gallery הישן נשאר לתאימות אחורה — אירוע בלי
-- שורות event_media ממשיך להציג אותו.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. שלבי האירוע (התכנסות, דברי פתיחה, השיעור המרכזי...)
-- ----------------------------------------------------------------------------
create table if not exists event_chapters (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  title_he text not null check (char_length(title_he) between 1 and 80),
  title_en text,
  description_he text,
  description_en text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_chapters_event on event_chapters (event_id, sort_order);

-- ----------------------------------------------------------------------------
-- 2. פריטי המדיה
-- ----------------------------------------------------------------------------
create table if not exists event_media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events (id) on delete cascade,
  type text not null default 'image' check (type in ('image', 'video')),
  url text not null check (char_length(url) <= 800),
  thumbnail_url text,
  caption_he text,
  caption_en text,
  alt_he text,
  alt_en text,
  sort_order int not null default 0,
  chapter_id uuid references event_chapters (id) on delete set null,
  is_featured boolean not null default false,
  is_visible boolean not null default true,
  -- נקודת מיקוד (0–1) — לחיתוך מבוקר בקומפוזיציות; ברירת מחדל מרכז
  focal_x numeric(3, 2) not null default 0.5 check (focal_x between 0 and 1),
  focal_y numeric(3, 2) not null default 0.5 check (focal_y between 0 and 1),
  -- מידות מקוריות — נשמרות בזמן ההעלאה כדי שהפריסה תישמר בלי קפיצות
  width int,
  height int,
  duration int,
  video_provider text check (video_provider in ('youtube', 'vimeo', 'file') or video_provider is null),
  video_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_event_media_event on event_media (event_id, sort_order);
create index if not exists idx_event_media_chapter on event_media (chapter_id);

drop trigger if exists trg_event_media_updated on event_media;
create trigger trg_event_media_updated
  before update on event_media
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- 3. RLS — הציבור רואה מדיה גלויה של אירוע מפורסם; צוות תוכן מנהל
-- ----------------------------------------------------------------------------
alter table event_chapters enable row level security;
alter table event_media enable row level security;

drop policy if exists event_chapters_public_read on event_chapters;
create policy event_chapters_public_read on event_chapters
  for select using (
    exists (
      select 1 from events e
      where e.id = event_chapters.event_id and (e.is_published or public.can_edit())
    )
  );

drop policy if exists event_chapters_staff_write on event_chapters;
create policy event_chapters_staff_write on event_chapters
  for all to authenticated
  using (public.can_edit())
  with check (public.can_edit());

drop policy if exists event_media_public_read on event_media;
create policy event_media_public_read on event_media
  for select using (
    (is_visible or public.can_edit())
    and exists (
      select 1 from events e
      where e.id = event_media.event_id and (e.is_published or public.can_edit())
    )
  );

drop policy if exists event_media_staff_write on event_media;
create policy event_media_staff_write on event_media
  for all to authenticated
  using (public.can_edit())
  with check (public.can_edit());

grant select on event_chapters, event_media to anon;
grant select, insert, update, delete on event_chapters, event_media to authenticated;

-- ----------------------------------------------------------------------------
-- 4. שמירת סדר כפעולה אחת — לא UPDATE נפרד לכל תמונה בכל גרירה
-- ----------------------------------------------------------------------------
create or replace function public.reorder_event_media(p_event_id uuid, p_items jsonb)
returns void
language sql
security definer
set search_path = public
as $$
  update event_media m
  set sort_order = (item->>'sort_order')::int,
      chapter_id = nullif(item->>'chapter_id', '')::uuid
  from jsonb_array_elements(p_items) as item
  where m.id = (item->>'id')::uuid
    and m.event_id = p_event_id
    and public.can_edit();
$$;

revoke all on function public.reorder_event_media(uuid, jsonb) from public;
grant execute on function public.reorder_event_media(uuid, jsonb) to authenticated;
