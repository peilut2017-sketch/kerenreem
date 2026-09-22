# Runbook: משאבי שרת — CPU, זיכרון, swap

**התראות:** `MemoryPressure` · `SwapThrashing` · `LoadHigh` ·
`ContainerMemoryNearLimit` · `ExporterDown`

---

## 1. תמונת מצב (דקה)

```bash
uptime                       # load 1/5/15
free -h                      # זיכרון ו-swap
vmstat 1 5                   # si/so גבוהים = thrashing
docker stats --no-stream     # מי צורך מה
iostat -x 1 3                # %util גבוה = הדיסק הוא הצוואר
```

`load` נקרא מול מספר הליבות: load 8 על מכונה בת 8 ליבות תקין לחלוטין.
`nproc` נותן את המספר.

---

## 2. זיכרון

```bash
ps aux --sort=-%mem | head -10
dmesg -T | grep -i -E 'oom|killed process' | tail -20
```

אם ה-OOM killer פעל — **לבדוק מה הוא הרג**. הוא בוחר את התהליך עם
הציון הגבוה ביותר, ו-PostgreSQL הוא לרוב הצרכן הגדול ביותר במכונה.
זהו אחד ההסברים האפשריים ל"קונטיינר שנעלם", אם כי באירוע האחרון הוא
**לא הוכח**.

**מה לעשות מיד:**

```bash
# מגבלת זיכרון לקונטיינרים שאין להם — כדי שלא יפילו את השכנים
docker update --memory=512m --memory-swap=512m <name>
```

**מה לא לעשות:** לא להגדיל `shared_buffers` של PostgreSQL "כדי שיהיה
מהיר יותר" בזמן לחץ זיכרון. זה מחריף.

---

## 3. Swap

```bash
swapon --show
cat /proc/sys/vm/swappiness
```

`si`/`so` גבוהים ב-`vmstat` = המכונה מבלה יותר זמן בהחלפת דפים מאשר
בעבודה. זה נראה למשתמש כמו אתר איטי מאוד, לא כמו אתר למטה.

לשרת מסד נתונים, `swappiness` נמוך (10) עדיף:

```bash
sudo sysctl vm.swappiness=10
# קבוע: echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swap.conf
```

---

## 4. CPU

```bash
top -b -n 1 | head -20
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}'
```

- קונטיינר יחיד ב-100% → לבדוק את הלוג שלו.
- PostgreSQL גבוה → שאילתות כבדות, `postgres-down.md` §5.
- `%iowait` גבוה ב-`iostat` → הדיסק הוא הצוואר, לא המעבד.

---

## 5. `ExporterDown`

הסוכן אינו עונה. שתי אפשרויות, והן שונות מאוד:

```bash
ping -c 3 <APP_HOST>
curl -sS http://<APP_HOST>:9100/metrics | head -3
```

- המכונה עונה ל-ping אך הסוכן לא → הקונטיינר של הסוכן נפל.
- המכונה לא עונה כלל → **השרת עצמו למטה.** זה אירוע קריטי, לא תקלת
  ניטור. לבדוק בלוח הבקרה של Hetzner.

> ‏`ExporterDown` היא התראה על **עיוורון**: מרגע זה איננו יודעים מה
> קורה בשכבה הזו. לטפל בה באותה דחיפות כמו בתקלה עצמה.

---

## 6. מניעה

- מגבלות זיכרון לכל קונטיינר, כדי שאחד לא יפיל את השכנים.
- `swappiness=10` על שרת מסד.
- `DiskWillFillSoon` — לחץ דיסק וזיכרון מגיעים לרוב יחד.
- **שדדרוג השרת**: 3.1GB פנויים ושולי זיכרון צרים הם אותה בעיה משתי
  זוויות.
