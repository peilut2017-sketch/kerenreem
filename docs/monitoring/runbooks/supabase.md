# Runbook: שירות Supabase אינו עונה

**התראות:** `SupabaseServiceDown` · `HealthDeepFailing`

---

## 1. איזה שירות

"Supabase למטה" אינה אבחנה שאפשר לפעול לפיה. כל שירות נבדק בנפרד:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}' | grep -i supabase
```

| שירות | תפקיד | מה נשבר כשהוא נופל |
|---|---|---|
| `db` | PostgreSQL | הכול → `postgres-down.md` |
| `kong` | שער ה-API | הכול מבחוץ |
| `rest` (PostgREST) | קריאת נתונים | קטלוג, דפי ספר |
| `auth` (GoTrue) | התחברות | כניסה לניהול, חשבונות לקוח |
| `storage` | קבצים | תמונות, כריכות, לוגו |
| `realtime` | עדכונים חיים | לא בשימוש באתר — לא קריטי |

**סדר התלות:** `db` → `rest`/`auth`/`storage` → `kong`. אם `db` למטה,
כל השאר ייפלו בעקבותיו וזו אינה תקלה נפרדת.

---

## 2. בדיקה ידנית לכל שירות

```bash
# Kong — 401 היא תשובה תקינה: השער חי ודורש מפתח
curl -si https://<SUPABASE_HOST>/rest/v1/ | head -1

# PostgREST עם מפתח anon — צריך להחזיר JSON
curl -sS "https://<SUPABASE_HOST>/rest/v1/books?select=id&limit=1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"

# Auth
curl -sS https://<SUPABASE_HOST>/auth/v1/health

# Storage — הורדת קובץ עוגן אמיתית, לא HEAD
curl -sI "https://<SUPABASE_HOST>/storage/v1/object/public/covers/<canary>.jpg" | head -3
```

> ⚠️ 401 מ-Kong בלי מפתח הוא **תקין**. בדיקה שמצפה ל-200 כאן תהיה
> אדומה תמיד, ואחרי יומיים אף אחד לא מסתכל עליה.

---

## 3. PostgREST מחזיר שגיאות

```bash
docker logs --tail 200 <rest>
```

| סימן | משמעות |
|---|---|
| `could not connect to server` | המסד למטה → `postgres-down.md` |
| `PGRST002` (schema cache) | PostgREST לא הצליח לטעון את הסכימה |
| `PGRST301` / JWT | סוד JWT לא תואם בין השירותים |
| מחזיר `[]` והמסד מלא | RLS → `postgres-down.md` סעיף 3 |

**רענון מטמון הסכימה** (אחרי migration):

```bash
docker exec <db> psql -U postgres -c "notify pgrst, 'reload schema';"
```

זו פעולה בטוחה לחלוטין — היא רק מבקשת מ-PostgREST לקרוא מחדש את מבנה
הסכימה.

---

## 4. Storage מחזיר שגיאות

הקבצים עצמם יושבים ב-volume של Storage (או ב-S3). Storage שנופל אינו
מוחק דבר.

```bash
docker logs --tail 200 <storage>
docker volume ls | grep -i storage
```

אם הקבצים קיימים והשירות לא עולה → `container-missing.md`.
אם השירות עולה והתמונות חסרות → `storage.md`.

---

## 5. Auth

כשל כאן אינו מפיל את האתר הציבורי — רק כניסה לניהול ולחשבונות.

```bash
docker logs --tail 200 <auth>
```

סוד JWT שאינו תואם בין `auth`, `rest` ו-Kong הוא הסיבה הנפוצה. **לא
לאפס pending settings ב-Coolify** כדי "לרענן" אותם — האיפוס מוחק
הגדרות שלא הוחלו.

---

## 6. אימות

```bash
curl -sS -H "Authorization: Bearer $HEALTH_CHECK_SECRET" \
  https://www.kerenreem.org/api/health/deep | jq
```

מצופה `status: "ok"` עם כל הבדיקות ירוקות. אם `catalogue` ירוק והאתר
עדיין מציג ריק — מטמון, ראו `site-down.md`.
