-- ============================================================================
-- מכון קרן רא"ם — העדפות תצוגה אישיות לצוות הניהול
-- להרצה אחרי 43_hebrew_slug_check_constraints.sql
-- ============================================================================
--
-- בחירת עמודות בטבלת הספרים (והעדפות תצוגה עתידיות) נשמרה עד כה
-- ב-localStorage — כלומר לדפדפן, לא למשתמש: מעבר מחשב איפס את הבחירה.
-- הטבלה הזו שומרת העדפה פר-משתמש/מפתח, כך שהבחירה מלווה את המשתמש
-- בכל מקום שבו הוא מתחבר. value הוא jsonb כדי שהעדפות שונות (רשימת
-- עמודות, מסננים שמורים...) יחיו באותו מבנה בלי מיגרציה לכל העדפה.
-- ============================================================================

create table if not exists public.admin_user_prefs (
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null check (char_length(key) between 1 and 80),
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.admin_user_prefs enable row level security;

-- כל משתמש מחובר רואה ומעדכן רק את ההעדפות של עצמו — אין כאן מידע
-- רגיש, אבל גם אין סיבה שעורך אחד יקרא את העדפות התצוגה של אחר.
drop policy if exists user_prefs_own on public.admin_user_prefs;
create policy user_prefs_own on public.admin_user_prefs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.admin_user_prefs to authenticated;
