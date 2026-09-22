# Runbook: DNS, TLS ורשת

**התראות:** `DnsResolutionFailing` · `TlsCertExpiringSoon` ·
`TlsCertExpiringCritical`

---

## 1. איפה זה נשבר

ההבחנה הראשונה: אצלנו, אצל הספק, או ברשת של הצופה. אם ההתראה מגיעה
מנקודת תצפית אחת בלבד — כנראה הרשת של הצופה.

```bash
dig +short www.kerenreem.org
dig +short www.kerenreem.org @1.1.1.1      # resolver חיצוני
dig +short www.kerenreem.org @8.8.8.8
curl -sSo /dev/null -w '%{http_code} %{time_total}s\n' https://www.kerenreem.org/
mtr -r -c 20 www.kerenreem.org             # איפה אובדות חבילות
```

| מה רואים | המסקנה |
|---|---|
| resolver אחד נכשל, האחרים תקינים | בעיית resolver, לא האתר |
| כל ה-resolvers נכשלים | רשומת DNS הוסרה או פג תוקף הדומיין |
| DNS תקין, החיבור נכשל | ספק/רשת → סעיף 3 |
| אובדן חבילות באמצע המסלול | בעיית ניתוב אצל ספק ביניים |

---

## 2. TLS

```bash
echo | openssl s_client -servername www.kerenreem.org \
  -connect www.kerenreem.org:443 2>/dev/null | openssl x509 -noout -dates -issuer
```

- **פג בעוד <14 יום** — החידוש האוטומטי כנראה נכשל. לבדוק את לוח
  הבקרה של Vercel/Coolify.
- **פג בעוד <5 ימים** — קריטי. כשתפוג, הדפדפן יחסום את האתר לגמרי;
  זו השבתה מלאה, לא הידרדרות.
- **שם לא תואם** — התעודה הונפקה לדומיין אחר. לבדוק שהדומיין המחובר
  בספק הוא זה שמשרת בפועל.

---

## 3. להפריד בין Vercel, Hetzner, הדומיין והאפליקציה

זו ההבחנה שהכי קשה לעשות בלחץ, ולכן כדאי להריץ את ארבע השורות האלה:

```bash
# 1. האפליקציה (Vercel) — אינה נוגעת במסד
curl -sS https://www.kerenreem.org/api/health | jq '.status,.build'

# 2. התשתית (Hetzner) — דרך Supabase
curl -si https://<SUPABASE_HOST>/rest/v1/ | head -1     # 401 = חי

# 3. הדומיין
dig +short www.kerenreem.org

# 4. השרת עצמו
ping -c 3 <APP_HOST_IP>
```

| 1 | 2 | 3 | 4 | המסקנה |
|---|---|---|---|---|
| ✗ | ✓ | ✓ | ✓ | Vercel / האפליקציה → `site-down.md` |
| ✓ | ✗ | ✓ | ✓ | Supabase → `supabase.md` |
| ✓ | ✗ | ✓ | ✗ | השרת → Hetzner Console, `server-resources.md` |
| ✗ | ✗ | ✗ | ✓ | DNS/דומיין → סעיף 1 |

---

## 4. עמוד תקלה זמני

אם ההשבתה ממושכת ולא בשליטתנו (ספק, רשת), עדיף עמוד שמסביר מאשר
שגיאת דפדפן. **לא לשנות רשומות DNS בלחץ** — שינוי DNS מתפשט לאט
ויוצר מצב שקשה לחזור ממנו.

---

## 5. תיעוד

לרשום בלוח האירועים: איזה resolver נבדק, מה ה-TTL של הרשומה, מתי
התחיל ומתי נגמר, ומה **לא** הוכח. ניחוש שנרשם כעובדה מוביל את החקירה
הבאה לכיוון הלא נכון.
