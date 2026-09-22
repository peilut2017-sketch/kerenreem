# Runbook: PostgreSQL למטה, או קטלוג ריק

**התראות:** `PostgresDown` · `PublishedBooksTooFew` ·
`PostgresConnectionsHigh` · `PostgresLongRunningQuery` ·
`PostgresBlockedQueries`

---

## ⛔ לפני הכול

- **לא למחוק volume של המסד** — ראו `disk-full.md`.
- **Snapshot לפני כל שינוי מסוכן.**
- לא להריץ `pg_resetwal` אלא אחרי שנוסו כל השאר ועם גיבוי בצד. זו
  פקודה שמאבדת נתונים בהגדרה.

---

## 1. חי בכלל?

```bash
docker ps -a | grep -i -E 'db|postgres'
docker exec <db> pg_isready
```

- הקונטיינר **חסר** או נעצר → `container-missing.md`.
- `pg_isready` נכשל אך הקונטיינר רץ → סעיף 2.

---

## 2. רץ אך אינו מקבל חיבורים

```bash
docker logs --tail 200 <db>
df -h /                     # דיסק מלא עוצר כתיבה
docker exec <db> psql -U postgres -c "select 1"
```

| סימן | משמעות | לאן |
|---|---|---|
| `No space left on device` | דיסק | `disk-full.md` |
| `the database system is starting up` | שחזור אחרי כיבוי לא נקי | להמתין; לעקוב בלוג |
| `too many clients already` | מכסת חיבורים | סעיף 4 |
| `could not fork new process` | מגבלת משאבים | `server-resources.md` |

התאוששות אחרי כיבוי לא נקי יכולה לקחת דקות. **לא להפעיל מחדש
באמצע** — הפעלה חוזרת מתחילה את ההתאוששות מהתחלה.

---

## 3. המסד חי אך הקטלוג ריק

זה המצב המסוכן: הכול "ירוק" והאתר מציג קטלוג ריק.

```bash
docker exec <db> psql -U postgres -d postgres -c \
  "select count(*) total, count(*) filter (where is_published) published from public.books;"
```

**אם הספירה תקינה (≈63 / 62 מפורסמים)** — המסד בסדר, והבעיה בשכבה
שמעליו:

```bash
# PostgREST רואה את הנתונים?
curl -sS "https://<SUPABASE_HOST>/rest/v1/books?select=id&limit=1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
```

- שגיאה מ-PostgREST → `supabase.md`
- מחזיר `[]` בעוד שהספירה במסד תקינה → **RLS**. לוודא שמדיניות
  הקריאה הציבורית על `books` קיימת ושהיא מתירה `anon` לשורות
  `is_published = true`.
- מחזיר נתונים, והאתר עדיין ריק → מטמון ISR, ראו `site-down.md`.

**אם הספירה אפס או נמוכה** — הנתונים באמת חסרים:

1. לוודא שהקונטיינר מחובר ל-**volume הנכון** (`container-missing.md`
   סעיף 2.1). מסד שעלה על volume חדש וריק נראה בדיוק ככה.
2. אם ה-volume הנכון ובאמת ריק → שחזור מגיבוי, `backups.md`.

---

## 4. מכסת חיבורים

```bash
docker exec <db> psql -U postgres -c \
  "select count(*), state from pg_stat_activity group by state;"
docker exec <db> psql -U postgres -c "show max_connections;"
```

`idle in transaction` רבים = יישום שפתח טרנזקציה ולא סגר. הם מחזיקים
נעילות ומונעים `vacuum`.

לשחרר חיבורים תקועים מעל 30 דקות (לא נוגע בשאילתות פעילות):

```sql
select pg_terminate_backend(pid)
from pg_stat_activity
where state = 'idle in transaction'
  and state_change < now() - interval '30 minutes'
  and pid <> pg_backend_pid();
```

---

## 5. שאילתה ארוכה או נעילות

```sql
-- מי רץ הכי הרבה זמן
select pid, now() - query_start as duration, state, left(query, 120)
from pg_stat_activity
where state = 'active' and backend_type = 'client backend'
order by duration desc limit 10;

-- מי חוסם את מי
select blocked.pid as blocked_pid, blocking.pid as blocking_pid,
       left(blocked.query, 80) as blocked_query,
       left(blocking.query, 80) as blocking_query
from pg_stat_activity blocked
join pg_stat_activity blocking
  on blocking.pid = any(pg_blocking_pids(blocked.pid))
where cardinality(pg_blocking_pids(blocked.pid)) > 0;
```

לבטל שאילתה ספציפית: `select pg_cancel_backend(<pid>);` (עדין).
רק אם לא הגיב: `select pg_terminate_backend(<pid>);`

---

## 6. אימות

```bash
docker exec <db> pg_isready
docker exec <db> psql -U postgres -d postgres -c \
  "select count(*) from public.books where is_published;"
curl -sS -H "Authorization: Bearer $HEALTH_CHECK_SECRET" \
  https://www.kerenreem.org/api/health/deep | jq '.checks'
```

מצופה: `database: ok`, `catalogue: ok` עם `value` ≈ 62.
