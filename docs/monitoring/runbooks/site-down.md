# Runbook: האתר למטה, מחזיר 500, או מטמון תקוע

**התראות:** `PageDown` · `PageServerError` · `HealthDeepFailing` · `PageSlow`

---

## 1. לבודד את השכבה (2 דקות)

```bash
# האפליקציה עצמה חיה? (לא נוגעת במסד)
curl -sS https://www.kerenreem.org/api/health | jq

# כל שכבה בנפרד
curl -sS -H "Authorization: Bearer $HEALTH_CHECK_SECRET" \
  https://www.kerenreem.org/api/health/deep | jq
```

| מה רואים | המסקנה | לאן |
|---|---|---|
| `/api/health` לא עונה | Vercel/Next למטה, או DNS | סעיף 2 |
| `/api/health` תקין, `deep` מחזיר `database: fail` | המסד | `postgres-down.md` |
| `deep` מחזיר `catalogue: fail` עם `database: ok` | RLS או נתונים | `postgres-down.md` §3 |
| `deep` מחזיר `storage: fail` | אחסון | `storage.md` |
| הכול `ok` אבל העמוד שבור | **מטמון** | סעיף 4 |

> העיקרון: `/api/health` ו-`/api/health/deep` קיימים בדיוק כדי להבדיל
> בין "האפליקציה נפלה" ל"התשתית מאחור נפלה". בדיקה אחת שבודקת הכול
> אינה יכולה להצביע על מקור התקלה.

---

## 2. האפליקציה אינה עונה

```bash
curl -sS -o /dev/null -w '%{http_code} %{time_total}s\n' https://www.kerenreem.org/
dig +short www.kerenreem.org
curl -sI https://www.kerenreem.org | head -5
```

- DNS לא מתרגם → `network.md`
- TLS נכשל → `network.md`
- 404/500 מ-Vercel → לבדוק את לוח הפריסות: האם פריסה חדשה נכשלה או
  שהתבצע rollback?

**לא לפרוס SHA אחר בלי אישור.** אם פריסה אחרונה חשודה — לרשום את
ה-SHA, לדווח, ולהמתין להחלטה.

---

## 3. 5xx בעמודים מסוימים בלבד

זה מה שקרה באירוע: עמוד הבית החזיר 200 ודפי ספר החזירו 500. עמוד הבית
מוגש ממטמון ואינו תלוי בשאילתה לכל בקשה; דף ספר כן.

```bash
for p in / /books /authors /events "/books/<slug>"; do
  printf '%s → ' "$p"
  curl -sS -o /dev/null -w '%{http_code}\n' "https://www.kerenreem.org$p"
done
```

אם רק דפי ספר נופלים — הבעיה בשכבת הנתונים → `postgres-down.md`.

---

## 4. מטמון תקוע: 500 ששוכפל ונשמר

**התסמין:** התשתית חזרה לתקינות, `deep` ירוק, והעמוד עדיין מציג שגיאה.

**מה קרה:** בזמן שהמסד היה למטה, הרינדור נכשל והתשובה — כולל קוד 500
— נשמרה. מטמון אינו יודע שהתשובה ששמר הייתה תקלה.

**בדיקה:** האם התשובה טרייה או שמורה?

```bash
curl -sI "https://www.kerenreem.org/books/<slug>" | grep -i -E 'age|x-vercel-cache|cache-control'
curl -sI "https://www.kerenreem.org/books/<slug>?cachebust=$(date +%s)" | head -1
```

`x-vercel-cache: HIT` עם `age` גדול, בעוד שהכתובת עם `?cachebust`
מחזירה 200 — זה בדיוק המצב.

**התיקון:**

1. לרוב מספיק להמתין: חלון ה-ISR של עמודי האתר קצר (עד ~60 שניות),
   והעמוד יתרענן מעצמו.
2. רענון יזום מהניהול: **ניהול ← הגדרות ← רענון כל העמודים הציבוריים**
   (`revalidateAllPublicPages`). זו הדרך המועדפת — היא עוברת דרך
   `revalidatePath` ואינה נוגעת בשום דבר אחר.
3. רק אם גם זה לא עזר: Purge Cache מלוח הבקרה של Vercel.

> ⚠️ לא לפרוס מחדש רק כדי לנקות מטמון. פריסה מחליפה SHA, ומוסיפה
> משתנה לחקירה במקום להסיר אחד.

---

## 5. האתר איטי אך עולה

```bash
curl -sS -o /dev/null -w 'dns %{time_namelookup}s · tls %{time_appconnect}s · ttfb %{time_starttransfer}s · total %{time_total}s\n' \
  https://www.kerenreem.org/books
```

- TTFB גבוה ו-DNS/TLS תקינים → השרת או המסד. לבדוק שאילתות ארוכות
  (`postgres-down.md` §5) ועומס (`server-resources.md`).
- `uptimeSeconds` נמוך ב-`/api/health` → מופע שרק עלה (cold start).
  לא תקלה, ולא להזעיק על סמך דגימה אחת.

---

## 6. אימות סגירה

```bash
npm run check:canonical -- --base https://www.kerenreem.org
node monitoring/scripts/synthetic-browser.mjs --base https://www.kerenreem.org --book <slug>
```

בדיקת הדפדפן היא האימות האמיתי: היא מוודאת שהעמודים נטענים, שהתמונות
באמת מוצגות, ושאין שגיאות JavaScript — בדסקטופ ובמובייל.
