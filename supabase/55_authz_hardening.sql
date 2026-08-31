-- ============================================================================
-- מכון קרן רא"ם — הקשחת הרשאות בשכבת המסד (מטא-אודיט אבטחה)
-- להרצה אחרי 54_commerce_concurrency.sql
-- ============================================================================
--
-- רקע. אנשי הצוות מתחברים דרך Supabase Auth ומחזיקים JWT אמיתי; מפתח ה-anon
-- וה-URL נשלחים ל-bundle של הדפדפן. לכן איש צוות יכול לפנות ל-PostgREST
-- ישירות (‏/rest/v1/<table> עם ה-anon key ו-ה-JWT שלו), ואז RLS מפעילה את
-- ההרשאה לפי ה*תפקיד הגס* בלבד. ההרשאות הגרנולריות פר-מסך (user_screen_
-- permissions) נאכפות רק בשכבת האפליקציה (assertScreenPermission) — כך
-- ש-override שמנהל מגדיר כדי *לצמצם* גישה של איש צוות אינו נאכף במסד.
--
-- ה-migration הזה סוגר את חלק ה*כתיבה* של הפער — הצד הבטוח לתיקון עכשיו,
-- כי כל הכתיבות של האפליקציה לטבלאות האלה עוברות ב-service-role (server
-- actions), ולא בלקוח ה-anon:
--
--   • orders / order_items — נשלטו ב-grant all הגורף של מיגרציה 06. איש
--     צוות עם תפקיד חנות (can_manage_store) יכול היה PATCH ישיר
--     ‏{payment_state:'paid', total:0} — הזמנה "שולמה" בלי רשומת תשלום,
--     בלי מסמך ובלי audit, תוך עקיפת markManualPayment, enforce_refund_cap
--     ו-uq_payments_one_success_per_order. כל כתיבות ההזמנות באפליקציה הן
--     ב-service-role (checkout, orders-actions, transitionOrder) — הרשאת
--     הכתיבה הישירה של authenticated היא משטח תקיפה מיותר.
--
--   • coupons — grant select,insert,update (מיגרציה 33). store_manager
--     שנשלל ממנו מסך הקופונים ב-override יכול היה POST ישיר וליצור קוד
--     100%. saveCoupon/setCouponActive עוברים ב-service-role (האחרון הוסב
--     לשם יחד עם ה-migration הזה).
--
--   • books.stock_quantity — מטמון נגזר מ-inventory_levels (טריגר), והאפליקציה
--     אף פעם לא כותבת אותו ישירות (actions.ts מוחק אותו מה-payload ומנתב
--     ל-RPC האטומי). כתיבה ישירה הייתה מבטלת את הסנכרון עד תנועת המלאי הבאה.
--
-- קריאה (SELECT) נשמרת: דוחות הניהול קוראים orders/payments דרך לקוח ה-anon
-- ו-RLS, ושלילתה תשבור אותם. הצד שנותר פתוח — קריאת PII (customers,
-- addresses) בידי איש צוות ש-override שולל ממנו את המסך אך תפקידו הגס עדיין
-- מתיר — דורש אכיפת has_screen_permission בתוך מדיניות ה-SELECT (או ניתוב כל
-- קריאות הטבלאות הרגישות דרך service-role). זהו שינוי רחב שיש לאמת מול מופע
-- Supabase אמיתי עם נתוני התפקידים/ה-overrides, כדי לא לנעול צוות לגיטימי
-- בחוץ — מתועד ולא מבוצע כאן.
-- ============================================================================

-- הזמנות: כתיבה רק דרך service-role. SELECT נשאר (דוחות + צפיית לקוח ב-RLS).
revoke insert, update, delete on orders      from authenticated;
revoke insert, update, delete on order_items from authenticated;

-- קופונים: כתיבה רק דרך service-role. SELECT נשאר (אימות/דוחות בצד השרת).
revoke insert, update on coupons from authenticated;

-- מטמון המלאי בשורת הספר: אף פעם לא נכתב ישירות בידי האפליקציה.
revoke update (stock_quantity) on books from authenticated;

-- ============================================================================
-- Rollback:
--   grant insert, update, delete on orders      to authenticated;
--   grant insert, update, delete on order_items to authenticated;
--   grant insert, update on coupons to authenticated;
--   grant update (stock_quantity) on books to authenticated;
-- ============================================================================
