# Runbook: גיבויים ושחזור

**התראות:** `BackupStale` (אין גיבוי מוצלח מעל 36 שעות)

---

## 0. העיקרון

**Snapshot של השרת אינו תחליף לגיבוי מסד.**

Snapshot מצלם את הדיסק כפי שהוא, כולל מסד באמצע כתיבה. הוא מצוין
לחזרה מהירה משינוי תשתית שנכשל, והוא לא מה שרוצים כשצריך לשחזר טבלה
אחת או לחזור לנקודת זמן. `pg_dump` הוא גיבוי לוגי עקבי — וזה מה שנספר
כאן כ"גיבוי".

---

## 1. גיבוי מתוזמן, מוצפן, מחוץ לשרת

שלושת התנאים אינם רשות:

| תנאי | למה |
|---|---|
| **מתוזמן** | גיבוי ידני נשכח, ותמיד בדיוק בשבוע הלא נכון |
| **מוצפן** | הגיבוי מכיל פרטי לקוחות והזמנות |
| **מחוץ לשרת** | גיבוי על השרת שנפל אינו גיבוי. זה הלקח מהאירוע |

דוגמה (יומי, 03:10):

```bash
#!/usr/bin/env bash
set -euo pipefail
STAMP=$(date +%Y%m%d-%H%M)
OUT="/tmp/kerenreem-$STAMP.sql.gz.gpg"

docker exec <db> pg_dump -U postgres --format=plain --no-owner postgres \
  | gzip -9 \
  | gpg --batch --yes --encrypt --recipient "$BACKUP_GPG_RECIPIENT" --output "$OUT"

# העתקה החוצה — לאחסון אובייקטים או לשרת אחר
rclone copy "$OUT" "$BACKUP_REMOTE:kerenreem/db/"

SIZE=$(stat -c%s "$OUT")
rm -f "$OUT"    # לא להשאיר על השרת: זה גם מקום וגם סיכון

# רישום ההצלחה — בלעדיו אי אפשר להבדיל בין "רץ" ל"נכשל בשקט"
docker exec <db> psql -U postgres -c \
  "insert into monitoring.backup_log (kind, size_bytes, ok) values ('pg_dump', $SIZE, true);"
```

> הרישום ל-`monitoring.backup_log` הוא מה שמפעיל את `BackupStale`.
> בלי זה, גיבוי שנכשל שקט הוא בדיוק סוג התקלה שמתגלה רק כשצריך לשחזר.

**Retention:** יומיים 14 יום · שבועיים 8 שבועות · חודשיים 12 חודשים.

---

## 2. בדיקת שחזור תקופתית

גיבוי שלא נוסה אינו גיבוי. **אחת לרבעון**, ולעולם לא על מסד הייצור:

```bash
gpg --decrypt backup.sql.gz.gpg | gunzip > /tmp/restore-test.sql
docker run -d --name pg-restore-test -e POSTGRES_PASSWORD=test postgres:<גרסה>
docker exec -i pg-restore-test psql -U postgres < /tmp/restore-test.sql
docker exec pg-restore-test psql -U postgres -c \
  "select count(*) from public.books where is_published;"
docker rm -f pg-restore-test && rm -f /tmp/restore-test.sql
```

לרשום את התוצאה והתאריך. ספירה שאינה תואמת את הייצור = הגיבוי חלקי.

---

## 3. שחזור אמיתי

### ⛔ לפני שנוגעים בכלום

1. **Snapshot של השרת.** גם אם המצב נראה אבוד.
2. **לוודא שה-volume הנוכחי אינו נמחק.** ראו `disk-full.md`.
3. לוודא שמדובר באמת באובדן נתונים ולא ב-volume שגוי —
   `container-missing.md` §2.1. מסד שעלה על volume ריק נראה בדיוק
   כמו מסד שנמחק, והשחזור שונה לגמרי.

### השחזור

```bash
# 1. לעצור את מה שכותב
docker stop <rest> <auth> <storage>

# 2. לשחזר למסד ריק חדש (לא לדרוס את הקיים)
gpg --decrypt backup.sql.gz.gpg | gunzip \
  | docker exec -i <db> psql -U postgres -d postgres_restore

# 3. לאמת לפני החלפה
docker exec <db> psql -U postgres -d postgres_restore -c \
  "select count(*) from public.books where is_published;"

# 4. רק אחרי אימות — להחליף, ולהעלות את השירותים
docker start <rest> <auth> <storage>
```

---

## 4. אחרי שחזור

```bash
curl -sS -H "Authorization: Bearer $HEALTH_CHECK_SECRET" \
  https://www.kerenreem.org/api/health/deep | jq
```

מצופה `catalogue.value` ≈ 62. לרענן את המטמון הציבורי (ניהול ← הגדרות
← רענון כל העמודים) ולהריץ את בדיקת הדפדפן.

לתעד באירוע: מאיזה גיבוי שוחזר, מה חלון אובדן הנתונים (מהגיבוי ועד
הנפילה), ומה נבדק אחרי.
