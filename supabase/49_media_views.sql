-- ============================================================================
-- מכון קרן רא"ם — מונה צפיות לפריטי מדיה של אירוע
-- להרצה אחרי 48_event_media.sql
-- ============================================================================
--
-- צפיות אירוע עצמו נספרות מהטבלה הכללית page_views שכבר קיימת
-- (18_page_views.sql, path = '/events/<slug>') — אין צורך בעמודה
-- ייעודית. תמונה/וידאו בודדים בתוך אירוע אינם "עמוד" נפרד, ולכן הם
-- זקוקים למונה משלהם: עמודה ממוצעת (לא טבלת log) שמתעדכנת אטומית
-- בכל פעם שפריט מוצג בפועל למבקר — בסיפור העריכתי, ב-Reels או ב-Viewer
-- מלא (ראו src/lib/events/view-actions.ts).
-- ============================================================================

alter table event_media add column if not exists view_count bigint not null default 0;

-- security definer: המבקר הציבורי מקבל דרך צרה לעדכן מונה בלבד, לא
-- גישת כתיבה כללית לטבלה (זו נשארת can_edit() בלבד, ראו מיגרציה 48).
-- מתעדכן רק לפריט גלוי — פריט מוסתר (is_visible=false) אינו אמור
-- להיספר, וממילא לא נחשף למבקר כדי שיוכל לקרוא לפונקציה עליו.
create or replace function public.increment_event_media_view(p_media_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update event_media set view_count = view_count + 1
  where id = p_media_id and is_visible = true;
$$;

revoke all on function public.increment_event_media_view(uuid) from public;
grant execute on function public.increment_event_media_view(uuid) to anon, authenticated;
