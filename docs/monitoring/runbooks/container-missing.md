# Runbook: קונטיינר חובה חסר, נעצר, או בלולאת restart

**התראות:** `RequiredContainerMissing` · `ContainerStopped` ·
`ContainerRestartLoop`

זה ה-runbook של האירוע שקרה בפועל: קונטיינר ואימג' של PostgreSQL היו
חסרים, ה-volumes נשמרו, והשחזור היה חיבור אותו PostgreSQL חזרה לאותם
volumes.

---

## ⛔ לפני הכול

- **לא למחוק volumes.** ראו `disk-full.md` — זה מה שהציל את הנתונים.
- **לא לאפס pending settings ב-Coolify.** האיפוס מוחק את ההגדרה
  שעדיין לא הוחלה, כולל מיפויי volume — ואז הקונטיינר קם על אחסון ריק
  ונראה כאילו הנתונים נמחקו.
- **Snapshot לפני כל שינוי מסוכן.**

---

## 1. איזה מצב מהשלושה (דקה אחת)

```bash
docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
```

| מה רואים | המצב | לאן |
|---|---|---|
| השם לא מופיע בכלל | **חסר** | סעיף 2 |
| `Exited (…)` | נעצר | סעיף 3 |
| `Restarting (…)` / `Up 12 seconds` שחוזר | לולאה | סעיף 4 |
| `Up … (unhealthy)` | חי אך לא בריא | סעיף 5 |

---

## 2. הקונטיינר חסר לגמרי

### 2.1 לאתר את ה-volumes — **לפני** כל פעולה

```bash
docker volume ls | grep -i -E 'db|pg|postgres|supabase'
docker volume inspect <שם> | jq '.[0].Mountpoint'
sudo ls -la <Mountpoint>          # האם יש PG_VERSION ו-base/?
sudo du -sh <Mountpoint>          # גודל סביר לקטלוג?
```

אם התיקייה מכילה `PG_VERSION` ו-`base/` — **הנתונים שם.** זה המצב
שהיה באירוע. לנשום.

### 2.2 האם האימג' קיים

```bash
docker images | grep -i -E 'postgres|supabase'
```

אם חסר — למשוך **בדיוק את אותה גרסה ראשית**:

```bash
cat <Mountpoint>/PG_VERSION      # למשל: 15
docker pull supabase/postgres:<התג המקורי>
```

> ⚠️ **אסור להעלות גרסה ראשית.** PostgreSQL 16 לא יעלה על ספריית
> נתונים של 15; הוא ידרוש `pg_upgrade`. משיכת "latest" כאן היא הדרך
> להפוך תקלה בת שעה לאירוע של יום.

### 2.3 להקים מחדש עם אותם volumes

**דרך Coolify (המועדפת):** Redeploy לאותו שירות. לוודא לפני כן
שמיפויי ה-volume בהגדרה מצביעים על אותם שמות מסעיף 2.1.

**ידנית, אם Coolify אינו זמין:** להשתמש ב-compose המקורי —

```bash
docker compose -f <הקובץ המקורי> up -d db
```

לעולם לא `docker run` מאולתר: `-v` שגוי יוצר volume חדש וריק, והמסד
"מאבד" את כל הנתונים למראית עין.

### 2.4 אימות

```bash
docker exec <db> pg_isready
docker exec <db> psql -U postgres -d postgres -c "select count(*) from public.books where is_published;"
```

מצופה: 62 (או קרוב). אם אפס → `postgres-down.md` סעיף "המסד חי אך ריק".

---

## 3. הקונטיינר קיים אך נעצר

```bash
docker inspect <name> --format '{{.State.ExitCode}} {{.State.Error}} {{.State.OOMKilled}}'
docker logs --tail 200 <name>
```

| קוד יציאה | משמעות | לאן |
|---|---|---|
| `OOMKilled: true` | חנק בזיכרון | `server-resources.md` |
| 137 | נהרג (SIGKILL) — לרוב OOM | `server-resources.md` |
| 1 / אחר | כשל יישומי | לקרוא את הלוג |

אם הדיסק מלא, הקונטיינר לא יעלה שוב עד שיפונה מקום → `disk-full.md`.

```bash
docker start <name>
```

---

## 4. לולאת restart

**לא להפעיל מחדש שוב ושוב.** הלולאה היא התסמין; הסיבה בלוג.

```bash
docker logs --tail 300 <name> 2>&1 | less
```

הסיבות הנפוצות:

| סימן בלוג | משמעות |
|---|---|
| `No space left on device` | → `disk-full.md` |
| `database files are incompatible` | גרסת אימג' שגויה → סעיף 2.2 |
| `could not access directory` / `Permission denied` | הרשאות על ה-volume |
| `FATAL: password authentication failed` | סוד שהשתנה — **לא לאפס pending settings** |
| משתנה סביבה חסר | הגדרה שלא הוחלה |

כדי לעצור את הלולאה ולחקור בשקט:

```bash
docker update --restart=no <name>
docker stop <name>
# … לחקור …
docker update --restart=unless-stopped <name>
docker start <name>
```

---

## 5. חי אך `unhealthy`

```bash
docker inspect <name> --format '{{json .State.Health}}' | jq
```

לבדוק אם ה-healthcheck עצמו הגיוני (timeout קצר מדי תחת עומס). אם
השירות עונה בפועל, ייתכן שהבעיה בהגדרת הבדיקה ולא בשירות.

---

## 6. אחרי השחזור

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}'
curl -sS -H "Authorization: Bearer $HEALTH_CHECK_SECRET" \
     https://www.kerenreem.org/api/health/deep | jq
```

מצופה: `status: "ok"`, ו-`catalogue.value` ≈ 62.

**הקטלוג עדיין ריק אחרי שהמסד חזר?** ISR — חלון של עד 60 שניות.
**דפי ספר עדיין מחזירים 500?** זו תשובה שנשמרה במטמון בזמן הנפילה →
`site-down.md`, סעיף "מטמון תקוע".

---

## 7. מה לתעד באירוע

- שמות ה-volumes ונקודות העיגון שנמצאו, וגודלן.
- תג האימג' שהיה ושאליו שוחזר.
- ספירת הספרים לפני ואחרי.
- **מה שלא ידוע.** אם אין לוג שמסביר מי הסיר את הקונטיינר — לרשום
  "סיבת השורש לא הוכחה". ניחוש שנרשם כעובדה מוביל את החקירה הבאה
  לכיוון הלא נכון.
