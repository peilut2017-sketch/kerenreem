# מפת הדואר היוצא של האתר

מסמך מיפוי בלבד — **אינו משנה קוד**. מטרתו לענות על שלוש שאלות:
מה נשלח מהאתר, מאיזו כתובת זה יוצא היום, ומאיזו כתובת זה *צריך* לצאת.

ההפרדה המנחה:

* **דואר אוטומטי** (איפוס סיסמה, אישור פנייה, אישור הזמנה) — נשלח על ידי
  מכונה, ואיש אינו קורא תשובה עליו. כתובת השולח צריכה לומר זאת בפירוש:
  `no-reply@kerenreem.org`.
* **מענה אנושי** (תשובת הצוות לפנייה מהאתר) — נכתב בידי אדם, והנמען
  יענה עליו. הוא חייב לצאת מכתובת שמישהו קורא: `contact@kerenreem.org`.

נכון לעכשיו ההפרדה הזו **אינה קיימת**: כל הדואר יוצא מאותה כתובת אחת.

---

## 1. סיכום הממצאים

| # | ממצא | חומרה |
|---|------|--------|
| 1 | **`Reply-To` אינו מוגדר באף מקום בקוד.** הקריאה ל-Resend ב-`src/lib/email/send.ts` שולחת `from, to, subject, html, text` בלבד. | גבוהה |
| 2 | **שתי תבניות מבטיחות לנמען שאפשר להשיב — בזמן שהשולח הוא `no-reply@`.** תשובה של נמען תיפול לתיבה שאיש אינו קורא, או תידחה. | גבוהה |
| 3 | **כל הדואר יוצא מכתובת אחת** (`COMMERCE_EMAIL_FROM`, ברירת מחדל `no-reply@kerenreem.org`). אין דרך להבדיל בין אוטומטי לאנושי בלי לשנות קוד. | גבוהה |
| 4 | **חלק מהדואר אינו עובר דרך Resend כלל** אלא דרך שרת הדואר של Supabase — עיצוב אחר, דומיין שולח אחר, ואין לו תיעוד אצלנו. | בינונית |
| 5 | **אין כתובת נכנסת.** Resend שולח בלבד; כדי ש-`contact@kerenreem.org` יוכל *לקבל* דואר צריך נתב דואר נפרד (Cloudflare Email Routing). | בינונית |
| 6 | שם משתנה הסביבה `COMMERCE_EMAIL_FROM` מטעה — הוא כבר מזמן אינו מוגבל למסחר; הוא שולט בכל דואר האתר. | נמוכה |

### פירוט ממצא 2 — ההבטחה שאינה ניתנת לקיום

`src/lib/email/templates.ts:254` (מענה הצוות לפנייה):

> «מענה זה נשלח מצוות המכון בהמשך לפנייתכם באתר. **אפשר להשיב להודעה הזו.**»

`src/lib/commerce/notifications.ts:37` (כותרת תחתונה של כל תשעת מיילי ההזמנות):

> «מכון קרן רא״ם · **לשאלות אפשר להשיב למייל הזה** או להתקשר אלינו.»

שתיהן יוצאות היום מ-`no-reply@kerenreem.org` ובלי `Reply-To`.

---

## 2. הטבלה — כל הדואר באתר

### 2.1 דואר שעובר דרך Resend

| הודעה | מה מפעיל אותה | תבנית | נמען | שולח היום | שולח מוצע | Reply-To מוצע |
|---|---|---|---|---|---|---|
| איפוס סיסמה (ניהול) | `requestAdminPasswordReset` — `src/lib/admin/account-actions.ts:81` | `passwordResetEmail` | איש הצוות | `no-reply@` | `no-reply@` ✔ | — |
| הסיסמה הוחלפה | `notifyPasswordChanged` — `account-actions.ts:132` | `passwordChangedEmail` | איש הצוות | `no-reply@` | `no-reply@` ✔ | `contact@` (זו הודעת אבטחה: מי שלא ביצע את השינוי חייב דרך להגיב) |
| אישור פנייה למבקר | טופס יצירת קשר — `src/app/(public)/[locale]/contact/actions.ts:262` | `contactAckEmail` | המבקר | `no-reply@` | `no-reply@` ✔ | `contact@` |
| פנייה חדשה לצוות | אותו טופס — `contact/actions.ts:267` | `contactStaffEmail` | תיבת הצוות | `no-reply@` | `no-reply@` ✔ | **כתובת הפונה** — כך «השב» בתיבת הצוות עונה לפונה ישירות |
| **מענה הצוות לפנייה** | `replyToInquiry` — `src/lib/admin/messages-actions.ts:118` | `contactReplyEmail` | הפונה | `no-reply@` ✗ | **`contact@`** | `contact@` |
| הזמנת איש צוות | `team-actions.ts:109` | `teamInviteEmail` | איש הצוות החדש | `no-reply@` | `no-reply@` ✔ | `contact@` |
| מייל בדיקה | ניהול ← דואר יוצא — `src/lib/admin/email-actions.ts:130` | לפי התבנית הנבחרת | מנהל | `no-reply@` | זהה לתבנית הנבדקת | זהה |

### 2.2 דואר הזמנות — `sendOrderEmail`, `src/lib/commerce/notifications.ts`

תשע תבניות, כולן אוטומטיות, כולן נכתבות ל-`notification_log` עם מפתח
`order:{id}:{template}:email` כך שלא תישלחנה פעמיים.

| תבנית | מה מפעיל אותה |
|---|---|
| `order_confirmation` | `checkout-actions.ts:727`, `orders-actions.ts:1007`, `orders-actions.ts:1042` |
| `order_updated` | `orders-actions.ts:1187` (עריכת הזמנה), `orders-actions.ts:1229` (הנחה) |
| `payment_received` | `webhook-processing.ts:345`, `orders-actions.ts:458` (סימון ידני) |
| `payment_failed` | `webhook-processing.ts:365` |
| `document_ready` | `orders-actions.ts:112` |
| `shipped` | `orders-actions.ts:294` |
| `ready_for_pickup` | `orders-actions.ts:112` |
| `cancelled` | `orders-actions.ts:183`, `orders-actions.ts:735`, `maintenance.ts:58` |
| `refunded` | `orders-actions.ts:690` |

שולח היום: `no-reply@` · שולח מוצע: `no-reply@` ✔ · **Reply-To מוצע: `contact@`**
— וזו בדיוק ההבטחה שבכותרת התחתונה (`notifications.ts:37`); היא נכונה
ברגע ש-`Reply-To` קיים.

שליחה חוזרת ידנית קיימת דרך `resendOrderEmail` (`orders-actions.ts:763`),
עם מפתח ייחודי `resend:{timestamp}` כדי לעקוף את מנגנון ה-idempotency.

### 2.3 דואר חופשי — `sendPlainEmail`

| הודעה | מה מפעיל אותה | שולח היום | מוצע |
|---|---|---|---|
| «המוצר חזר למלאי» | `src/lib/commerce/maintenance.ts:155` | `no-reply@` | `no-reply@` ✔, Reply-To `contact@` |

זה הקורא האחרון שנותר ל-`sendPlainEmail`; ה-HTML שלו נכתב ידנית במקום
להיות תבנית ב-`templates.ts`.

### 2.4 דואר ש**אינו** עובר דרכנו — שרת הדואר של Supabase

ארבע הודעות נשלחות בידי Supabase Auth עצמו. הן אינן עוברות ב-`sendEmail`,
אין להן את המעטפת המותגת שלנו, ואינן מושפעות מ-`COMMERCE_EMAIL_FROM`:

| הודעה | הקריאה | הערה |
|---|---|---|
| קישור כניסה ללקוח (magic link) | `supabase.auth.signInWithOtp` — `src/lib/commerce/account-actions.ts:42` | זו דרך הכניסה **היחידה** של לקוחות לאזור האישי |
| אישור שינוי כתובת מייל (לקוח) | `supabase.auth.updateUser({ email })` — `commerce/account-actions.ts:194` | |
| אישור שינוי כתובת מייל (ניהול) | `supabase.auth.updateUser({ email })` — `admin/account-actions.ts:114` | |
| איפוס סיסמה — מסלול גיבוי | `supabase.auth.resetPasswordForEmail` — `admin/account-actions.ts:94` | רץ רק כשאין `SUPABASE_SERVICE_ROLE_KEY`. כשיש מפתח, הקוד מייצר את הקישור ב-`generateLink` ושולח אותו בתבנית שלנו |

**המשמעות המעשית:** לקוח שנכנס לאזור האישי מקבל הודעה בעיצוב ברירת מחדל,
מדומיין שאינו `kerenreem.org` (אלא אם הוגדר SMTP מותאם בפרויקט Supabase),
ובלי שהאתר יודע שהיא נשלחה. זה הפער הגדול ביותר במיפוי.

שתי דרכים לסגור אותו, ושתיהן מחוץ להיקף מסמך זה:
1. להגדיר ב-Supabase ← Authentication ← SMTP את פרטי Resend, ולהחליף את
   תבניות הדואר שם לתבניות בעיצוב האתר. פשוט, אבל התבניות חיות בשני מקומות.
2. לייצר את הקישורים ב-`auth.admin.generateLink` ולשלוח אותם בעצמנו —
   בדיוק כפי שכבר נעשה באיפוס סיסמה בניהול. עקבי, אבל דורש מפתח
   `service_role` בכל אחד מהמסלולים.

---

## 3. Reply-To

`grep` על כל הקוד: אין ולו מופע אחד של `reply_to` / `replyTo`.
Resend תומך בשדה `reply_to` בגוף הבקשה (מחרוזת או מערך), והוא אינו
דורש אימות נוסף — כל כתובת מותרת.

מדיניות מוצעת, בשורה אחת: **כל הודעה שיש לה תשובה אפשרית מקבלת
`Reply-To: contact@kerenreem.org`; התראת הפנייה לצוות מקבלת את כתובת
הפונה; ומענה אנושי לא רק מקבל Reply-To אלא גם *נשלח* מ-`contact@`.**

שלוש ההודעות שבהן זה קריטי:

1. **מענה הצוות לפנייה** — הנמען יענה. הוא חייב לצאת מ-`contact@`.
2. **הפנייה החדשה שנשלחת לצוות** — `Reply-To` לכתובת הפונה הופך את
   כפתור «השב» בתיבת הצוות למענה ישיר, בלי לעבור דרך מסך הניהול.
3. **«הסיסמה שלך הוחלפה»** — הודעת אבטחה. מי שלא ביצע את השינוי צריך
   דרך מיידית להגיב; `no-reply` בלי `Reply-To` הוא קיר אטום.

---

## 4. Resend — מה נדרש בצד הספק

Resend **שולח בלבד**. הוא אינו תיבת דואר ואינו מקבל הודעות נכנסות; תשובה
שתגיע ל-`contact@kerenreem.org` לא תופיע בשום מקום ב-Resend.

### 4.1 אימות הדומיין

יש לאמת את `kerenreem.org` בלוח הבקרה של Resend (Domains ← Add Domain).
Resend מספק את הערכים המדויקים; להלן המבנה:

| סוג | שם | ערך | לשם מה |
|---|---|---|---|
| TXT | `send` (או תת-דומיין השליחה) | `v=spf1 include:amazonses.com ~all` | SPF |
| MX | `send` | `feedback-smtp.<region>.amazonses.com` (עדיפות 10) | החזרות ותלונות |
| TXT | `resend._domainkey` | המפתח הציבורי מ-Resend | DKIM |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@kerenreem.org` | DMARC — להתחיל ב-`p=none` ולעלות ל-`quarantine` רק אחרי שבועיים של דוחות נקיים |

הערות:

* **אחרי אימות הדומיין אפשר לשלוח מכל כתובת שבו** — `no-reply@`,
  `contact@`, `orders@` — בלי אימות נפרד לכל אחת. כלומר ההפרדה המבוקשת
  אינה דורשת דבר נוסף מ-Resend.
* בכתובת השולח יש לשמור על הצורה `שם תצוגה <כתובת>`; הקוד כבר עושה זאת
  (`מכון קרן רא״ם <no-reply@kerenreem.org>`).
* עד היום ברירת המחדל בקוד הייתה `keren-reem.org` **עם מקף** — דומיין
  שאינו קיים. כל דואר שיצא ממנו נכשל באימות. זה תוקן, אך אם
  `COMMERCE_EMAIL_FROM` הוגדר בסביבת הייצור לערך הישן — הוא גובר על הקוד
  ויש לתקן אותו שם.

### 4.2 בדיקה

מסך **ניהול ← מערכת ← דואר יוצא** מציג את כתובת השולח בפועל, את תיבת
הצוות, ושולח כל תבנית לכתובת בדיקה. אחרי כל שינוי בהגדרות — זה המקום לוודא.

---

## 5. Cloudflare Email Routing — כדי ש-`contact@` יוכל לקבל

Cloudflare Email Routing הוא שירות חינמי שמעביר דואר שמגיע לכתובת
בדומיין אל תיבה אמיתית (Gmail וכדומה). זה מה שהופך את `contact@` מכתובת
שולח בלבד לכתובת שאפשר להשיב אליה.

### 5.1 ההגדרה

1. Cloudflare ← הדומיין ← **Email** ← Email Routing ← Enable.
2. Cloudflare מוסיף אוטומטית רשומות MX ורשומת SPF לשורש הדומיין.
3. **Destination addresses** — להוסיף את תיבת היעד האמיתית ולאמת אותה
   (נשלח אליה מייל אימות).
4. **Routing rules** — למפות:
   * `contact@kerenreem.org` → תיבת הצוות
   * `no-reply@kerenreem.org` → **Drop**, במפורש. תשובות יגיעו לשם גם
     כשלא מזמינים אותן; עדיף שיידחו בשקט מאשר יצטברו בתיבה שאיש אינו קורא.
   * `dmarc@kerenreem.org` → תיבת הצוות, אם הוגדר `rua` בדוח ה-DMARC.
   * *Catch-all* → Drop.

### 5.2 המלכודת: רשומת SPF אחת בלבד

זו נקודת הכשל הנפוצה, ולכן היא מפורטת:

**לדומיין מותר רשומת SPF אחת בדיוק.** שתי רשומות `v=spf1` על אותו שם
גורמות לכישלון `permerror` — וכל הדואר היוצא נופל, כולל זה שעבד קודם.

Cloudflare Email Routing מוסיף SPF לשורש הדומיין, ו-Resend מבקש SPF משלו.
שתי דרכים, והראשונה עדיפה:

* **מומלץ — להפריד תת-דומיין לשליחה.** לשלוח מ-`send.kerenreem.org`
  (הכתובות יישארו קריאות אם רוצים, אך התצורה מפרידה לחלוטין): ה-SPF של
  Resend יושב על `send`, וה-SPF של Cloudflare על השורש. הם אינם נוגעים
  זה בזה, והקבלה בשורש ממשיכה לעבוד.
* **אם שולחים מהשורש — למזג ידנית לרשומה אחת:**
  `v=spf1 include:_spf.mx.cloudflare.net include:amazonses.com ~all`
  ולוודא שלא נותרה רשומת `v=spf1` שנייה.

DKIM אינו מתנגש: הוא יושב על שם ייעודי (`resend._domainkey`), וריבוי
מפתחות DKIM הוא תקין ומקובל.

### 5.3 מגבלה שכדאי לדעת מראש

Email Routing מעביר דואר נכנס — הוא **אינו מאפשר לשלוח** מהכתובת. כדי
שאיש צוות יוכל לענות מ-Gmail *בשם* `contact@kerenreem.org`, צריך להגדיר
ב-Gmail «שלח דואר בתור» עם SMTP של Resend. בלי זה, מענה ידני מ-Gmail
ייצא מהכתובת הפרטית של איש הצוות — מה שמנוגד לכל מטרת ההפרדה.

---

## 6. הצעה לריכוז הכתובות בקונפיגורציה אחת

היום הכתובות מפוזרות בשלושה מקומות: קבוע בקוד (`send.ts`), משתנה סביבה
(`COMMERCE_EMAIL_FROM`), והגדרות האתר במסד (`settings.contact.email`,
דרך `staffInbox()`). אין מקום אחד שבו רואים «מאיזו כתובת יוצא מה».

ההצעה: מודול אחד, `src/lib/email/addresses.ts`, שמגדיר **תפקידים** ולא
כתובות — כך שקוד הקורא אומר «זו הודעה אוטומטית» ולא «שלח מ-no-reply».

```ts
// סקיצה בלבד — לא נכתבה לקוד.
export const EMAIL_DOMAIN = 'kerenreem.org';

/** התפקידים. הקוד בוחר תפקיד; הכתובת היא פרט יישום. */
export const EMAIL_ROLES = {
  /** דואר אוטומטי. איש אינו קורא תשובות לכאן. */
  automated: { user: 'no-reply', label: 'מכון קרן רא״ם', env: 'EMAIL_FROM_AUTOMATED' },
  /** מענה אנושי לפניות. תיבה שמישהו קורא. */
  human:     { user: 'contact',  label: 'מכון קרן רא״ם', env: 'EMAIL_FROM_CONTACT'   },
} as const;

export type EmailRole = keyof typeof EMAIL_ROLES;

export function fromAddress(role: EmailRole): string { /* env ?? ברירת מחדל */ }
export function replyToAddress(role: EmailRole): string | undefined { /* contact@ */ }
export function staffInbox(contactEmail: string | null): string | null { /* כמו היום */ }
```

ושלוש התאמות שנגזרות ממנו:

1. `sendEmail` מקבל `role` (ברירת מחדל `'automated'`) ומוסיף `reply_to`
   לגוף הבקשה ל-Resend.
2. `replyToInquiry` (`messages-actions.ts`) הוא הקורא היחיד שמעביר
   `'human'` — וזו כל ההפרדה המבוקשת, בשורה אחת.
3. `contactStaffEmail` מעביר `replyTo` מפורש: כתובת הפונה.

משתני סביבה חדשים ב-`.env.example` (שניהם אופציונליים, עם ברירות מחדל
בקוד): `EMAIL_FROM_AUTOMATED`, `EMAIL_FROM_CONTACT`.
`COMMERCE_EMAIL_FROM` נשאר נתמך כשם מיושן ל-`EMAIL_FROM_AUTOMATED`, כדי
שפריסה קיימת לא תשבר.

---

## 7. סדר הפעולות המומלץ

הצד התשתיתי קודם לצד התוכנה: שינוי קוד שישלח מ-`contact@` לפני
שהדומיין מאומת והכתובת קולטת — ייצור מצב גרוע מהקיים.

1. לאמת את `kerenreem.org` ב-Resend (SPF/DKIM/DMARC), ולוודא ש-
   `COMMERCE_EMAIL_FROM` בייצור אינו מצביע על `keren-reem.org` הישן.
2. להפעיל Cloudflare Email Routing, למפות `contact@` לתיבת הצוות
   ולהפיל `no-reply@`, תוך הקפדה על רשומת SPF אחת (סעיף 5.2).
3. לשלוח מייל בדיקה לתיבה חיצונית ולוודא `dkim=pass` ו-`spf=pass`
   בכותרות.
4. רק אז: מודול הכתובות, `reply_to`, והעברת המענה האנושי ל-`contact@`.
5. להחליט על שרת הדואר של Supabase (סעיף 2.4) — עד אז, הקישור לאזור
   האישי של לקוחות נשאר מחוץ למיפוי הזה.
