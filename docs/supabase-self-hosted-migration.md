# מעבר ל-Supabase באירוח עצמי — `supabase.kerenreem.org`

מדריך תפעולי לאחר המעבר מ-Supabase Cloud (`<ref>.supabase.co`) להתקנה
עצמית. מתעד מה הקוד מצפה לו, מה חייב להיות מוגדר בפרודקשן (Vercel), ואיך
מאמתים שהכול עובד אחרי deploy.

---

## 1. מה הקוד מניח

- **אין אף כתובת Supabase קשיחה בקוד.** הכול נגזר משני משתנים:
  `NEXT_PUBLIC_SUPABASE_URL` ו-`NEXT_PUBLIC_SUPABASE_ANON_KEY`
  (ראו `src/lib/supabase/config.ts`, `next.config.ts`).
- **כתובות אחסון נשמרות במסד כ-URL אבסולוטי** (תוצאת `getPublicUrl`
  ברגע ההעלאה — `uploadToBucket` ב-`ImageField.tsx`). לכן תוכן שהועלה
  לפני המעבר מצביע על המארח הישן `<ref>.supabase.co`.
- **שכבת יישור כתובות מורשת** (`src/lib/image-src.ts`): כל כתובת
  `https://*.supabase.co/storage/v1/object/public/...` (או מארח שמופיע
  ב-`NEXT_PUBLIC_LEGACY_STORAGE_HOSTS`) מתורגמת בזמן הצגה לבסיס הנוכחי —
  ה-CDN אם הוגדר, ואחרת `NEXT_PUBLIC_SUPABASE_URL`. **אין צורך במיגרציית
  מסד** של עמודות ה-URL; אסור גם לבצע אחת בלי גיבוי — הקוד מטפל בזה.
- **קבצים פרטיים** (פניות צור-קשר) נשמרים כ-path בלבד וקישור חתום נוצר
  טרי מהשרת הנוכחי — חסינים למעבר מעצם התכנון.

## 2. משתני סביבה בפרודקשן (Vercel)

חובה לכל הסביבות (Production לפחות), **לפני** ה-build — משתני
`NEXT_PUBLIC_*` מוטמעים בזמן הבנייה, ושינוי שלהם מחייב Redeploy:

| משתנה | ערך | הערות |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://supabase.kerenreem.org` | בלי לוכסן סופי ובלי נתיב. זה הדומיין של ה-gateway (Kong) של ההתקנה העצמית. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ה-anon key **של ההתקנה העצמית** | ⚠️ לא המפתח של פרויקט הענן הישן! נגזר מה-`JWT_SECRET` של ההתקנה. מפתח ישן יחזיר 401 על כל בקשה. |
| `SUPABASE_SERVICE_ROLE_KEY` | ה-service key **של ההתקנה העצמית** | שרת בלבד. בלעדיו כל המסחר והניהול המתקדם כבויים. |
| `NEXT_PUBLIC_SITE_URL` | `https://www.kerenreem.org.il` | sitemap, קנוניקל, הפניות auth. |
| `NEXT_PUBLIC_CDN_URL` | ריק, או דומיין CDN שמצביע על המארח **החדש** | ⚠️ אם קיים CDN (למשל `assets.kerenreem.org`) שה-CNAME שלו עדיין מצביע על `<ref>.supabase.co` הישן — **כל התמונות יישברו**. או לעדכן את ה-CNAME אל `supabase.kerenreem.org`, או למחוק את המשתנה עד שה-CDN מוסב. ערך שאינו URL תקין נפסל בשקט (שווה ערך לריק). |
| `NEXT_PUBLIC_LEGACY_STORAGE_HOSTS` | רשות | רק אם היה דומיין CDN ישן שפורק — מארחי `*.supabase.co` מזוהים אוטומטית. |

שאר המשתנים (`ANALYTICS_SALT`, GA, reCAPTCHA, מורנינג, Resend,
`CRON_SECRET`, `COMMERCE_HMAC_SECRET`) — כמפורט ב-`.env.example`; אינם
תלויי-מעבר, אך ודאו שלא אבדו בהעתקה בין פרויקטים.

## 3. הגדרות בצד ההתקנה העצמית

לא בקוד האתר, אבל בלעדיהן עמודים "לא נטענים" באותם סימפטומים בדיוק:

1. **Auth (GoTrue)** — `SITE_URL=https://www.kerenreem.org.il` ו-
   `URI_ALLOW_LIST` שכולל את
   `https://www.kerenreem.org.il/api/auth/callback` ו-
   `https://www.kerenreem.org.il/api/auth/admin-callback`
   (קישורי מייל: התחברות לקוחות ושחזור סיסמה לצוות). בלי SMTP מוגדר —
   קישורי המייל לא יישלחו כלל.
2. **העברת נתונים** — הסכימה (`supabase/*.sql` לפי הסדר), הנתונים,
   **וקובצי ה-Storage עצמם** (buckets: `covers`, `events`, `portraits`,
   `samples`, `site`, `contact-attachments`) חייבים להיות מועתקים
   להתקנה החדשה. יישור הכתובות בקוד פותר את ה-URL הישן — לא קובץ שלא
   הועתק. חסר קובץ ⇒ 404 מהמארח החדש.
3. **buckets ציבוריים** — `covers/events/portraits/samples/site` חייבים
   להיות `public=true` גם בהתקנה החדשה (ראו `02_site_additions.sql`);
   `contact-attachments` נשאר פרטי.
4. **TLS** — תעודה תקפה ל-`supabase.kerenreem.org`; הדפדפן חוסם תוכן
   mixed/self-signed בשקט יחסית.

## 4. אימות אחרי deploy

מהדפדפן או מ-shell עם גישה לאינטרנט (להריץ את כולן; כולן צריכות להצליח):

```bash
# 1. בריאות ה-gateway וה-auth
curl -sS https://supabase.kerenreem.org/auth/v1/health
# מצופה: {"date":"...","description":"GoTrue is a user registration and authentication API"}

# 2. קריאת REST אנונימית (RLS) — מחזירה JSON של ספרים מפורסמים
curl -sS "https://supabase.kerenreem.org/rest/v1/books?select=slug&limit=1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"

# 3. קובץ ציבורי מה-Storage (להציב path אמיתי מטבלת books.cover_image_url)
curl -sSI "https://supabase.kerenreem.org/storage/v1/object/public/covers/<file>"
# מצופה: 200 עם content-type של תמונה

# 4. עמודי האתר
curl -sSI https://www.kerenreem.org.il/            # 200
curl -sSI https://www.kerenreem.org.il/books       # 200
curl -sSI https://www.kerenreem.org.il/en          # 200 (עמוד דינמי בלוקאל שני)
```

בדפדפן (עם DevTools → Network + Console פתוחים, לזהות CSP/CORS):

- [ ] עמוד הבית נטען, מדף הספרים מציג כריכות (לא ריבועים ריקים).
- [ ] עמוד ספר: כריכה, צבעי Hero (לא ה-fallback הבורדו-נייבי קבוע אם
      לספר יש כריכה), דפדוף/PDF לדוגמה נפתח.
- [ ] `/admin/login` — מסך האבחון בתחתית העמוד (`LoginDiagnostics`)
      מציג: הפרויקט = `supabase.kerenreem.org`, שרת האימות עונה,
      טבלת profiles נגישה. זה הכלי המהיר ביותר לאתר env שגוי.
- [ ] התחברות ניהול מלאה + פתיחת רשימת הספרים (קריאת DB עם session).
- [ ] הורדת קובץ: PDF דוגמה מעמוד ספר, וקובץ מצורף מפנייה בניהול
      (קישור חתום — מאמת שה-service/anon keys נכונים מול ה-Storage).

תקלות נפוצות לפי סימפטום:

| סימפטום | סיבה סבירה |
|---|---|
| כל קריאה מחזירה 401 `Invalid API key` | anon key ישן (של הענן) מול השרת החדש |
| תמונות ותיקות שבורות, חדשות תקינות | קובצי Storage לא הועתקו, או deploy ישן בלי שכבת היישור |
| כל התמונות שבורות | `NEXT_PUBLIC_CDN_URL` מצביע על CNAME שעדיין מפנה לענן הישן |
| התחברות במייל לא חוזרת לאתר | `URI_ALLOW_LIST`/`SITE_URL` ב-GoTrue |
| עמוד ספר איטי מאוד/timeout | (טופל בקוד: timeout ל-fetch של צבעי כריכה) — deploy ישן |
| הכול עובד מקומית ולא בפרודקשן | משתני `NEXT_PUBLIC_*` הוגדרו אחרי ה-build — צריך Redeploy |
