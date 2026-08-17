-- [1.19] מנהל תמונות האתר (Media Library) — פונקציית עזר למנהל-על בלבד.
--
-- אין טבלת מטא-דאטה נפרדת לקבצים: storage.objects הוא כבר מקור האמת
-- (Supabase Storage ממלא owner_id אוטומטית בהעלאה מאומתת, ו-metadata
-- כולל גודל וסוג קובץ). הבעיה היחידה היא שמדיניות ה-RLS הקיימת על
-- storage.objects (storage_public_read, ראו 02_site_additions.sql)
-- פתוחה לגמרי ל-anon/authenticated — לא מתאימה לחשוף owner_id/מייל
-- מעלה בציבור. לכן פונקציה ייעודית, security definer, גדורה ב-is_admin(),
-- ולא הרחבת ה-RLS הקיים על הטבלה עצמה.
--
-- contact-attachments (bucket פרטי, קבצים מטופס יצירת קשר) לא נכלל
-- בכוונה: זו לא "ספריית מדיה של האתר" אלא צירוף קובץ לפנייה בודדת,
-- וכבר מנוהל דרך מסך "פניות שהתקבלו" הקיים (getContactAttachmentUrls).
create or replace function public.admin_list_storage_files()
returns table (
  id uuid,
  bucket_id text,
  path text,
  owner_id uuid,
  uploader_email text,
  uploader_name text,
  created_at timestamptz,
  updated_at timestamptz,
  size_bytes bigint,
  mime_type text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'permission denied';
  end if;

  return query
    select
      o.id,
      o.bucket_id::text,
      o.name,
      o.owner_id,
      u.email::text,
      p.full_name,
      o.created_at,
      o.updated_at,
      (o.metadata->>'size')::bigint,
      o.metadata->>'mimetype'
    from storage.objects o
    left join auth.users u on u.id = o.owner_id
    left join public.profiles p on p.id = o.owner_id
    where o.bucket_id in ('covers', 'events', 'portraits', 'samples', 'site')
    order by o.created_at desc;
end;
$$;

revoke all on function public.admin_list_storage_files() from public;
grant execute on function public.admin_list_storage_files() to authenticated;
