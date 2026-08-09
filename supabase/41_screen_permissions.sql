-- ============================================================================
-- מכון קרן רא"ם — הרשאות גרגריות פר-מסך (מודל 1.7)
-- להרצה אחרי 40_round_1_5.sql
-- ============================================================================
--
-- [1.7] היום יש 5 תפקידים קבועים עם 6 דגלי-על גסים (content/store/store_view/
-- finance/costs/users, permissions.ts) — עורך תוכן לא יכול להוסיף/לערוך
-- "מדף בעמוד הבית" כי הוא גדור finance, מנהל חנות שאינו admin טהור לא יכול
-- להוסיף עוד תפקיד. בעל האתר ביקש 4 תפקידי-על בעלי שם ברור (מנהל־על / מנהל
-- ראשי / ניהול תוכן / ניהול חנות, עם מוכרן/מלקט כתת-דרגות בתוך ניהול חנות)
-- ובנוסף יכולת ליצור משתמש עם הרשאת צפייה/עריכה מותאמת אישית *לכל מסך
-- בנפרד* (הזמנות, מלאי, משלוחים, קופונים, דוחות...), כאשר "אין הרשאה" חוסם
-- לגמרי (לא רק מסתיר כפתורי עריכה).
--
-- שני חלקים: (1) תפקיד enum חדש 'store_manager' — "ניהול חנות" מלא, בלי
-- תוכן ובלי ניהול צוות; seller/picker נשארים כפי שהם כתת-דרגות מצומצמות
-- יותר בתוך אותה משפחה. (2) טבלת override מנורמלת פר-משתמש/מסך (לא jsonb —
-- עקבי עם ההערה ב-24_store_settings.sql שמעדיפה עמודות מוקלדות על מפתח
-- jsonb חופשי) שחורגת בזהירות מברירת המחדל של ה-role כשמנהל בוחר הרשאה
-- מותאמת אישית. שכבת האפליקציה (screens.ts, requireScreenPermission)
-- מוסיפה בשלבים הבאים; זו רק תשתית המסד.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. תפקיד חדש: store_manager ("ניהול חנות") — לא נמחק/משנה seller/picker.
-- ----------------------------------------------------------------------------
alter type user_role add value if not exists 'store_manager';

-- ----------------------------------------------------------------------------
-- 2. הרחבת שלוש הפונקציות ברמת "צוות חנות" לכלול store_manager — כל שימוש
--    קיים שלהן הוא מסחרי/מלאי בלבד (לא תוכן, לא ניהול צוות), ולכן בטוח
--    להוסיף לכולן; can_edit() (תוכן) ו-can_view_costs() (רווחיות) נשארות
--    בכוונה בלי store_manager — לא תוכן, ורווחיות נשארת admin/manager בלבד
--    כברירת מחדל (ניתן לחריגה פרטנית דרך override, ראו סעיף 4).
-- ----------------------------------------------------------------------------
create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_user_role()::text in ('admin', 'manager', 'store_manager');
$$;

create or replace function public.can_manage_store()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_user_role()::text in ('admin', 'manager', 'store_manager', 'seller');
$$;

create or replace function public.is_store_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select current_user_role()::text in ('admin', 'manager', 'store_manager', 'seller', 'picker');
$$;

-- ----------------------------------------------------------------------------
-- 3. טבלת override גרגרי פר-משתמש/מסך. שורה קיימת = חריגה מברירת המחדל של
--    ה-role (מחושבת באפליקציה, screens.ts) לאותו מסך; משתמש בלי שורה למסך
--    מסוים מקבל את ברירת המחדל הרגילה של ה-role שלו. screen_key הוא טקסט
--    חופשי ולא enum בכוונה — הרשימה הסגורה חיה ב-src/lib/admin/screens.ts
--    (קוד, לא מסד) כדי שהוספת מסך חדש לא תדרוש migration.
-- ----------------------------------------------------------------------------
create table if not exists user_screen_permissions (
  user_id     uuid not null references profiles(id) on delete cascade,
  screen_key  text not null,
  can_view    boolean not null default false,
  can_edit    boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (user_id, screen_key)
);

alter table user_screen_permissions enable row level security;
revoke all on user_screen_permissions from anon, authenticated;
grant select on user_screen_permissions to authenticated;

drop policy if exists user_screen_permissions_self_read on user_screen_permissions;
create policy user_screen_permissions_self_read on user_screen_permissions
  for select using (user_id = auth.uid() or public.is_admin());

-- כתיבה רק דרך service_role (team-actions.ts::saveScreenOverrides) —
-- אותו דפוס בדיוק כמו inviteStaffMember/updateProfileRole הקיימים.

drop trigger if exists trg_user_screen_permissions_updated_at on user_screen_permissions;
create trigger trg_user_screen_permissions_updated_at
  before update on user_screen_permissions
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 4. פונקציה לבדיקת override גרגרי — משמשת להרחיב בזהירות את חמש המדיניות
--    הכספיות הצרות (shipping/coupons/store_settings/promotions) כך שמנהל
--    יוכל להעניק הרשאת עריכה על מסך ספציפי גם למי שה-role הבסיסי שלו לא
--    מכסה זאת (לדוגמה: מוכרן עם הרשאת עריכה על "קופונים" בלבד).
--
--    מגבלה מכוונת: זו תוספת ל-is_store_admin() (permissive policy נוספת,
--    לא תחליף) — כלומר יכולה רק *להרחיב* עריכה בתוך משפחת החנות, לא להעניק
--    גישה למי שאינו "צוות חנות" כלל ברמת ה-RLS (is_store_staff()=false,
--    כמו viewer/editor טהור) — עבור מקרה כזה השורה עדיין תקרא ריקה בפועל.
--    ראו הערה מתאימה ב-screens.ts כשייכתב.
-- ----------------------------------------------------------------------------
create or replace function public.has_screen_permission(p_screen text, p_mode text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select case p_mode
       when 'edit' then can_edit
       else can_view
     end
     from public.user_screen_permissions
     where user_id = auth.uid() and screen_key = p_screen),
    false
  );
$$;

drop policy if exists shipping_methods_screen_override on shipping_methods;
create policy shipping_methods_screen_override on shipping_methods
  for all
  using (public.is_store_staff() and public.has_screen_permission('shipping', 'edit'))
  with check (public.is_store_staff() and public.has_screen_permission('shipping', 'edit'));

drop policy if exists shipping_zones_screen_override on shipping_zones;
create policy shipping_zones_screen_override on shipping_zones
  for all
  using (public.is_store_staff() and public.has_screen_permission('shipping', 'edit'))
  with check (public.is_store_staff() and public.has_screen_permission('shipping', 'edit'));

drop policy if exists coupons_screen_override on coupons;
create policy coupons_screen_override on coupons
  for all
  using (public.is_store_staff() and public.has_screen_permission('coupons', 'edit'))
  with check (public.is_store_staff() and public.has_screen_permission('coupons', 'edit'));

drop policy if exists store_settings_screen_override on store_settings;
create policy store_settings_screen_override on store_settings
  for update
  using (public.is_store_staff() and public.has_screen_permission('store-settings', 'edit'))
  with check (public.is_store_staff() and public.has_screen_permission('store-settings', 'edit'));

drop policy if exists promotions_screen_override on promotions;
create policy promotions_screen_override on promotions
  for all
  using (public.is_store_staff() and public.has_screen_permission('sale-prices', 'edit'))
  with check (public.is_store_staff() and public.has_screen_permission('sale-prices', 'edit'));

-- ============================================================================
-- לאימות אחרי הרצה:
--   select unnest(enum_range(null::user_role))::text;  -- כולל 'store_manager'
--   select proname from pg_proc where proname in
--     ('is_store_admin','can_manage_store','is_store_staff','has_screen_permission');
--   select * from user_screen_permissions limit 1;
--
-- Rollback:
--   drop policy shipping_methods_screen_override on shipping_methods;
--   drop policy shipping_zones_screen_override on shipping_zones;
--   drop policy coupons_screen_override on coupons;
--   drop policy store_settings_screen_override on store_settings;
--   drop policy promotions_screen_override on promotions;
--   drop function has_screen_permission(text, text);
--   drop table user_screen_permissions;
--   -- שים לב: אי אפשר להסיר ערך enum שכבר נוסף (store_manager) בלי ליצור
--   -- מחדש את הטיפוס כולו — להשאיר את הערך גם ב-rollback אם בוצע.
-- ============================================================================
