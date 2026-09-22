# Runbook: הדיסק מתמלא או מלא

**התראות:** `DiskSpaceNotice` (70%) · `DiskSpaceWarning` (80%) ·
`DiskSpaceCritical` (90%) · `DiskWillFillSoon` · `InodesLow`

---

## ⛔ אסור, בשום מצב

```
docker system prune --volumes      # ← מוחק volumes של מסד נתונים
docker volume prune                # ← אותו דבר
docker volume rm <כל דבר>
rm -rf /var/lib/docker/volumes/...
```

**זה הסעיף החשוב ביותר במסמך.** באירוע האחרון הקונטיינר והאימג' של
PostgreSQL נעלמו — וה-volumes הם מה שהציל את הנתונים. שחזור היה אפשרי
בדיוק משום שהם נשארו. פקודת ניקוי אחת "כדי לפנות מקום" הייתה הופכת
תקלה בת שעה לאובדן נתונים.

גם `docker system prune -a` (בלי `--volumes`) מוחק **אימג'ים** —
ואימג' חסר הוא חצי מהתקלה שקרתה.

---

## 1. מה תפס מקום (2 דקות)

```bash
df -h /                    # תמונת מצב
df -i /                    # inodes — דיסק "מלא" גם עם מקום פנוי
du -xh --max-depth=1 / 2>/dev/null | sort -rh | head -20
du -xh --max-depth=1 /var/lib/docker 2>/dev/null | sort -rh | head
journalctl --disk-usage
docker system df           # קורא בלבד; אל תוסיפו prune
```

החשודים, לפי סדר השכיחות:

| מקור | איפה | סימן |
|---|---|---|
| לוגים של קונטיינרים | `/var/lib/docker/containers/*/*-json.log` | קובץ בודד בגיגה־בייטים |
| journald | `/var/log/journal` | `journalctl --disk-usage` |
| אימג'ים ישנים | `/var/lib/docker/overlay2` | `docker images` |
| build cache | `/var/lib/docker` | `docker system df` |
| גיבויים מקומיים | `/opt`, `/root`, `/home` | קבצי `.sql`/`.tar` |
| WAL של PostgreSQL | `pgdata/pg_wal` | ראו סעיף 4 |

---

## 2. פינוי בטוח, לפי סדר

**מדרגה א׳ — בלי סיכון בכלל:**

```bash
# לוגים של מערכת: להשאיר שבוע
sudo journalctl --vacuum-time=7d

# חבילות שהורדו ולא נחוצות
sudo apt-get clean
```

**מדרגה ב׳ — לוגים של קונטיינרים.** הם הגורם הנפוץ ביותר. קיצוץ
בטוח, כי אלה לוגים בלבד:

```bash
# מי הגדול ביותר
sudo du -sh /var/lib/docker/containers/*/*-json.log | sort -rh | head

# איפוס לוג של קונטיינר מסוים (הקונטיינר ממשיך לרוץ)
sudo truncate -s 0 /var/lib/docker/containers/<id>/<id>-json.log
```

ואז **למנוע הישנות** — זו הסיבה שזה קרה, לא רק התסמין:

```json
// /etc/docker/daemon.json
{ "log-driver": "json-file", "log-opts": { "max-size": "50m", "max-file": "3" } }
```

```bash
sudo systemctl restart docker   # ⚠ מפעיל מחדש קונטיינרים — ראו סעיף 5
```

**מדרגה ג׳ — אימג'ים תלויים (dangling) בלבד.** `-a` **לא**:

```bash
docker image prune          # dangling בלבד, בלי --all
docker builder prune --keep-storage 2GB
```

> `docker image prune -a` מוחק כל אימג' שאינו בשימוש **כרגע**. אימג'
> שנמחק ואינו זמין ברג׳יסטרי הוא בדיוק מה שהופך restart פשוט לאירוע.

**מדרגה ד׳ — מה שלא מפנים כאן.** גיבויים ישנים, ארכיוני מדיה: להעביר
החוצה, לא למחוק. מחיקה בשתיים בלילה היא החלטה גרועה.

---

## 3. אם זה כבר 95%+

סדר הפעולות משתנה: קודם למנוע נזק, אחר כך לפנות.

```bash
# 1. Snapshot לפני כל דבר אחר (Hetzner Cloud Console)
# 2. לוודא שהמסד עדיין כותב
docker exec <db> pg_isready
# 3. פינוי מדרגה א׳+ב׳ בלבד — הם מיידיים ובטוחים
```

אם PostgreSQL כבר הפסיק לכתוב → `postgres-down.md`.

---

## 4. WAL של PostgreSQL תופח

`pg_wal` שגדל ללא הפסקה פירושו שמשהו מונע מיחזור:

```bash
docker exec <db> psql -U postgres -c "select * from pg_replication_slots;"
docker exec <db> psql -U postgres -c "select name,setting from pg_settings where name like 'wal%' or name like 'max_wal%';"
```

- **Replication slot נטוש** (`active = false`) מחזיק WAL לנצח. להסיר
  **רק** אחרי שמוודאים שאין צרכן אמיתי: `select pg_drop_replication_slot('<שם>');`
- **`archive_command` נכשל** → WAL נערם עד שיתוקן. לבדוק
  `pg_stat_archiver`.

**לעולם לא למחוק קבצים מ-`pg_wal` ידנית.** זו הדרך הקצרה ביותר למסד
שלא עולה.

---

## 5. אחרי הפינוי

```bash
df -h /
docker ps --format 'table {{.Names}}\t{{.Status}}'   # הכול up?
curl -sS https://www.kerenreem.org/api/health | jq
curl -sS -H "Authorization: Bearer $HEALTH_CHECK_SECRET" \
     https://www.kerenreem.org/api/health/deep | jq
```

לוודא שההתראה נסגרה ושנשלחה הודעת התאוששות.

---

## 6. מניעה

- מגבלת לוגים ב-`daemon.json` (סעיף 2) — עושים פעם אחת.
- `docker image prune` שבועי ב-cron. **בלי `-a`, בלי `--volumes`.**
- גיבויים יוצאים מהשרת מיד; לא נשמרים מקומית.
- **שדרוג השרת.** 3.1GB פנויים אינם שולי בטיחות. עד השדרוג,
  `DiskWillFillSoon` היא ההתראה שנותנת שעות במקום דקות.
