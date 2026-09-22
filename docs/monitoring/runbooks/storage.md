# Runbook: תמונות, לוגו או נכסים חסרים

**התראות:** `AssetMissing` · `HealthDeepFailing` (בדיקת `storage`)

---

## 1. הקובץ קיים או נעלם

```bash
# הורדה אמיתית, לא HEAD: Storage יכול להחזיר 200 על HEAD בעוד שהגוף ריק
curl -sS -o /tmp/canary.jpg -w '%{http_code} %{size_download} %{content_type}\n' \
  "https://<SUPABASE_HOST>/storage/v1/object/public/covers/<canary>.jpg"
```

| תוצאה | משמעות |
|---|---|
| 200, גודל סביר, `image/*` | הקובץ שם — הבעיה בתצוגה, סעיף 3 |
| 404 | הקובץ נמחק או שהנתיב השתנה, סעיף 2 |
| 400/500 | שירות Storage → `supabase.md` |
| 200 אך גודל אפסי | קובץ פגום — להעלות מחדש |

**באירוע האחרון הקבצים לא נמחקו** ו-Storage החזיר 200. שווה לוודא לפני
שמניחים את הגרוע.

---

## 2. קובץ חסר

```sql
-- מה בכלל אמור להיות שם
select bucket_id, name, (metadata->>'size')::bigint as size, created_at
from storage.objects
where bucket_id in ('covers','site','portraits','events','samples')
order by created_at desc limit 20;
```

- הרשומה קיימת אך הקובץ אינו יורד → הקובץ הפיזי אבד. להעלות מחדש דרך
  **ניהול ← מערכת ← ספריית מדיה** (כפתור ההחלפה שומר על אותו נתיב, ולכן
  כל מקום שמפנה אליו מתוקן בבת אחת).
- גם הרשומה חסרה → הקובץ נמחק. להעלות מחדש ולעדכן את הרשומה שמפנה
  אליו (ספר/מחבר/הגדרות).

**לא למחוק שורות מ-`storage.objects` ידנית.** זה מנתק את הרשומה
מהקובץ ויוצר יתומים משני הכיוונים.

---

## 3. הקובץ קיים אך אינו מוצג

| סיבה | בדיקה |
|---|---|
| CSP חוסם את המקור | קונסול הדפדפן: `Refused to load the image` |
| כתובת חיצונית | ImageField מזהיר על כך בניהול — CSP מתיר אחסון פרויקט בלבד |
| CDN מול Storage מחזיר ישן | להשוות את הכתובת הישירה מול כתובת ה-CDN |
| `remotePatterns` ב-`next.config.ts` | דומיין חדש שלא נוסף → next/image זורק |

בדיקה מהירה של הכול יחד:

```bash
node monitoring/scripts/synthetic-browser.mjs --base https://www.kerenreem.org
```

היא מדווחת בדיוק אילו תמונות לא נטענו, בדסקטופ ובמובייל.

---

## 4. מניעה

- `HEALTH_STORAGE_CANARY` מצביע על קובץ קבוע שלא יימחק; בדיקת
  `/api/health/deep` מורידה אותו כל שתי דקות ובודקת סוג וגודל.
- בדיקת הדפדפן השעתית תופסת תמונות שבורות שאף בדיקת HTTP לא תתפוס.
- **ספריית המדיה** (ניהול ← מערכת) מציגה את כל הקבצים באחסון. היא
  נטענת גם כשפונקציית העזר שבמסד חסרה — נפילה חזרה ל-Storage API.
