# מפת הדואר היוצא של האתר

מה נשלח מהאתר, מאיזו כתובת זה יוצא, ומה עוד צריך להגדיר בצד הספק כדי
שזה יעבוד.

ההפרדה המנחה:

* **דואר אוטומטי** — נשלח על ידי מכונה. יוצא מ-`no-reply@kerenreem.org`.
* **מענה אנושי** לפנייה מהאתר — נכתב בידי אדם, והנמען יענה עליו. יוצא
  מ-`contact@kerenreem.org`, תיבה שמישהו קורא.

ההפרדה מיושמת בקוד (גרסה 1.41). מה שנותר הוא **הגדרות בצד הספק** —
אימות הדומיין ב-Resend ונתב הדואר הנכנס ב-Cloudflare — ובלעדיהן
`contact@` הוא כתובת שולח שאי אפשר להשיב אליה בפועל.

---

## 1. מצב הממצאים

| # | ממצא | מצב |
|---|------|------|
| 1 | `Reply-To` לא היה מוגדר באף מקום בקוד | **תוקן** — `sendEmail` תומך ב-`replyTo`, וכל הודעה מקבלת את מה שמתאים לה (סעיף 2) |
| 2 | שתי תבניות הבטיחו לנמען שאפשר להשיב, בזמן שהשולח היה `no-reply@` בלי `Reply-To` | **תוקן** — ההבטחות (`templates.ts:254`, `notifications.ts:37`) נכונות עכשיו. נוסח התבניות לא שונה; המציאות הותאמה להבטחה |
| 3 | כל הדואר יצא מכתובת אחת, בלי דרך להבדיל אוטומטי מאנושי | **תוקן** — `src/lib/email/addresses.ts`, תפקיד `automated` / `human` |
| 4 | חלק מהדואר אינו עובר דרך Resend אלא דרך שרת הדואר של Supabase | **פתוח** — ראו סעיף 8. הוחלט במפורש לא לשכתב את ה-Auth בשלב הזה |
| 5 | אין כתובת נכנסת: `contact@` יכול לשלוח אבל לא לקבל | **פתוח — הגדרה בצד הספק**, ראו סעיף 5 |
| 6 | שם המשתנה `COMMERCE_EMAIL_FROM` מטעה — הוא שולט בכל דואר האתר | **תוקן** — `EMAIL_FROM_AUTOMATED`, והשם הישן נתמך כמיושן |

---

## 2. הטבלה — כל הדואר באתר

### 2.1 דואר שעובר דרך Resend

| הודעה | מה מפעיל אותה | תבנית | נמען | From | Reply-To |
|---|---|---|---|---|---|
| איפוס סיסמה (ניהול) | `requestAdminPasswordReset` — `src/lib/admin/account-actions.ts:81` | `passwordResetEmail` | איש הצוות | `no-reply@` | **ללא, במפורש** |
| הסיסמה הוחלפה | `notifyPasswordChanged` — `account-actions.ts:132` | `passwordChangedEmail` | איש הצוות | `no-reply@` | `contact@` |
| אישור פנייה למבקר | טופס יצירת קשר — `src/app/(public)/[locale]/contact/actions.ts:262` | `contactAckEmail` | המבקר | `no-reply@` | `contact@` |
| פנייה חדשה לצוות | אותו טופס — `contact/actions.ts:267` | `contactStaffEmail` | תיבת הצוות | `no-reply@` | **כתובת הפונה** |
| **מענה הצוות לפנייה** | `replyToInquiry` — `src/lib/admin/messages-actions.ts:118` | `contactReplyEmail` | הפונה | **`contact@`** | `contact@` |
| הזמנת איש צוות | `team-actions.ts:109` | `teamInviteEmail` | איש הצוות החדש | `no-reply@` | `contact@` |
| מייל בדיקה | ניהול ← דואר יוצא — `src/lib/admin/email-actions.ts` | לפי התבנית הנבחרת | מנהל | כמו התבנית | כמו התבנית |

למה `Reply-To` על איפוס סיסמה הוא **ללא** ולא `contact@`: הזמנה לענות
במייל על הודעת איפוס סיסמה היא הזמנה לשלוח סיסמה בטקסט פתוח. שקט הוא
ברירת המחדל הנכונה שם.

למה `Reply-To` של **הפונה** על ההתראה לצוות: כך כפתור «השב» בתיבת הצוות
עונה לפונה ישירות, בלי לעבור דרך מסך הניהול.

### 2.2 דואר הזמנות — `sendOrderEmail`, `src/lib/commerce/notifications.ts`

תשע תבניות, כולן אוטומטיות, כולן `From: no-reply@` ו-`Reply-To: contact@`
— נקבע פעם אחת ב-`sendViaProvider`. כולן נכתבות ל-`notification_log` עם
מפתח `order:{id}:{template}:email` כך שלא תישלחנה פעמיים.

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

שליחה חוזרת ידנית קיימת דרך `resendOrderEmail` (`orders-actions.ts:763`),
עם מפתח `resend:{timestamp}` שעוקף את מנגנון ה-idempotency ביודעין.

### 2.3 דואר חופשי — `sendPlainEmail`

| הודעה | מה מפעיל אותה | From | Reply-To |
|---|---|---|---|
| «המוצר חזר למלאי» | `src/lib/commerce/maintenance.ts:155` | `no-reply@` | `contact@` |

זה הקורא האחרון שנותר ל-`sendPlainEmail`, והוא מקבל את התצורה מאותו
`sendViaProvider` כמו דואר ההזמנות. ה-HTML שלו עדיין נכתב ידנית במקום
להיות תבנית ב-`templates.ts` — ניקוי נפרד, לא חלק מהשינוי הזה.

### 2.4 דואר ש**אינו** עובר דרכנו — שרת הדואר של Supabase

ארבע הודעות נשלחות בידי Supabase Auth עצמו. הן אינן עוברות ב-`sendEmail`,
אין להן את המעטפת המותגת שלנו, ואינן מושפעות מהגדרות התפקידים:

| הודעה | הקריאה | הערה |
|---|---|---|
| קישור כניסה ללקוח (magic link) | `supabase.auth.signInWithOtp` — `src/lib/commerce/account-actions.ts:42` | דרך הכניסה **היחידה** של לקוחות לאזור האישי |
| אישור שינוי כתובת מייל (לקוח) | `supabase.auth.updateUser({ email })` — `commerce/account-actions.ts:194` | |
| אישור שינוי כתובת מייל (ניהול) | `supabase.auth.updateUser({ email })` — `admin/account-actions.ts:114` | |
| איפוס סיסמה — מסלול גיבוי | `supabase.auth.resetPasswordForEmail` — `admin/account-actions.ts:94` | רץ רק כשאין `SUPABASE_SERVICE_ROLE_KEY` |

הטיפול בהן — סעיף 8.

---

## 3. איך זה בנוי בקוד

`src/lib/email/addresses.ts` הוא מקור האמת היחיד לכתובות. הוא מגדיר
**תפקידים**, לא כתובות:

| תפקיד | From | Reply-To כברירת מחדל |
|---|---|---|
| `automated` | `no-reply@kerenreem.org` | **אין** |
| `human` | `contact@kerenreem.org` | `contact@kerenreem.org` |

**ל-`automated` אין ברירת מחדל ל-Reply-To במכוון.** ברירת מחדל גלובלית
הייתה מדביקה כתובת מענה גם להודעות שבמכוון אינן מזמינות תגובה. הודעה
אוטומטית שכן מזמינה תגובה מציינת `replyTo: contactAddress()` במפורש —
בנקודת הקריאה, או פעם אחת בעוטף הרלוונטי (כך זה נעשה לכל דואר המסחר).

`sendEmail(to, email, options)` מקבל:

```ts
{
  role?: 'automated' | 'human';          // ברירת מחדל: 'automated'
  replyTo?: string | string[] | null;    // undefined = ברירת המחדל של התפקיד
}                                        // null = בלי Reply-To, במפורש
```

שלושת המצבים של `replyTo` נחוצים כולם, ולכן ההבחנה בין `undefined`
ל-`null` נשמרת בקוד (`=== undefined` ולא `??`).

**משתני סביבה** (כולם אופציונליים, עם ברירות מחדל בקוד):
`EMAIL_FROM_AUTOMATED`, `EMAIL_FROM_CONTACT`, `EMAIL_REPLY_TO_CONTACT`.
`COMMERCE_EMAIL_FROM` נשאר נתמך כשם מיושן ל-`EMAIL_FROM_AUTOMATED`.

בגוף הבקשה ל-Resend נשלח `reply_to`, ורק כשיש מה לשלוח.

---

## 4. Resend — מה נדרש בצד הספק

### 4.1 אימות הדומיין

יש לאמת את `kerenreem.org` בלוח הבקרה של Resend (Domains ← Add Domain).
Resend מציג את רשומות ה-SPF, ה-DKIM וה-MX המדויקות לדומיין הזה
**ולחשבון הזה**, ויש להעתיק אותן משם כפי שהן. המסמך הזה במכוון אינו
מפרט ערכים לדוגמה: רשומה שמועתקת מדוגמה במסמך ולא מהספק היא הדרך
המהירה ביותר לדואר שנכשל באימות בשקט.

הדבר היחיד שאינו ערך אלא כלל, ולכן נאמר כאן במפורש — ראו 5.2:
**רשומת SPF אחת בלבד לכל שם.**

שתי נקודות מעשיות:

* **אחרי אימות הדומיין אפשר לשלוח מכל כתובת שבו** — `no-reply@`,
  `contact@` — בלי אימות נפרד לכל אחת. כלומר ההפרדה בין השתיים אינה
  דורשת דבר נוסף מ-Resend. שתי הכתובות נשארות על הדומיין עצמו.
* בכתובת השולח יש לשמור על הצורה `שם תצוגה <כתובת>`; הקוד עושה זאת.
* עד גרסה 1.40 ברירת המחדל בקוד הייתה `keren-reem.org` **עם מקף** —
  דומיין שאינו קיים. אם `COMMERCE_EMAIL_FROM` הוגדר בסביבת הייצור
  לערך הישן, הוא גובר על הקוד ויש לתקן אותו שם.

### 4.2 בדיקה

מסך **ניהול ← מערכת ← דואר יוצא** מציג את שתי כתובות השולח, את כתובת
המענה ואת תיבת הצוות, ושולח כל תבנית לכתובת בדיקה **באותה תצורה בדיוק
כמו בייצור** — אותו תפקיד ואותו Reply-To. אחרי כל שינוי בהגדרות, זה
המקום לוודא.

### 4.3 קליטת דואר נכנס — Resend Inbound

ל-Resend יש כיום גם Inbound Email, כלומר הוא אינו ספק שליחה בלבד.
**בשלב הזה איננו משתמשים בו**: הקבלה של `contact@` נעשית ב-Cloudflare
Email Routing (סעיף 5), שהוא הדרך הפשוטה להעביר את התיבה לאדם.

המקום שבו זה ישתנה, כשנרצה לקלוט תשובות ישירות אל מערכת הפניות, מתוכנן
מראש — ראו סעיף 7.

---

## 5. Cloudflare Email Routing — כדי ש-`contact@` יוכל לקבל

Cloudflare Email Routing מעביר דואר שמגיע לכתובת בדומיין אל תיבה
אמיתית. זה מה שהופך את `contact@` מכתובת שולח בלבד לכתובת שאפשר להשיב
אליה.

### 5.1 ההגדרה

1. Cloudflare ← הדומיין ← **Email** ← Email Routing ← Enable. האשף מוסיף
   את רשומות ה-MX וה-SPF הנדרשות בעצמו; אין למלא אותן ידנית.
2. **Destination addresses** — להוסיף את תיבת היעד של הצוות ולאמת אותה.
3. **Routing rules**:
   * `contact@kerenreem.org` → תיבת הצוות
   * `no-reply@kerenreem.org` → **Drop**, במפורש. תשובות יגיעו לשם גם
     כשלא מזמינים אותן, ועדיף שיידחו בשקט מאשר יצטברו בתיבה שאיש אינו
     קורא.
   * *Catch-all* → Drop.

### 5.2 המלכודת: רשומת SPF אחת בלבד

**לדומיין מותר רשומת SPF אחת בדיוק.** שתי רשומות `v=spf1` על אותו שם
גורמות ל-`permerror`, וכל הדואר היוצא נופל — כולל זה שעבד קודם.
Cloudflare מוסיף SPF לשורש הדומיין, ו-Resend מבקש SPF משלו, ולכן זו
נקודת הכשל המעשית.

הטיפול: **למזג את שני ה-`include` לרשומה אחת**, בעזרת הערכים שכל אחד
מהשניים מציג בממשק שלו, ולוודא שלא נותרה רשומת `v=spf1` שנייה על אותו
שם. אם Resend ידרוש בפועל תת-דומיין שליחה נפרד — אין התנגשות מלכתחילה,
כי כל אחד יושב על שם אחר. **איננו עוברים לתת-דומיין מיוזמתנו**:
הכתובות הציבוריות נשארות על `kerenreem.org` עצמו.

DKIM אינו מתנגש: הוא יושב על שם ייעודי, וריבוי מפתחות DKIM הוא תקין.

### 5.3 מגבלה שכדאי לדעת מראש

Email Routing מעביר דואר נכנס — הוא **אינו מאפשר לשלוח** מהכתובת. כדי
שאיש צוות יוכל לענות מ-Gmail *בשם* `contact@kerenreem.org`, צריך להגדיר
ב-Gmail «שלח דואר בתור» עם ה-SMTP של Resend. בלי זה, מענה ידני מ-Gmail
ייצא מהכתובת הפרטית שלו — מה שמנוגד לכל מטרת ההפרדה.

---

## 6. ריכוז הכתובות — מיושם

היום כל הכתובות מוגדרות במקום אחד, `src/lib/email/addresses.ts`:

```ts
export const EMAIL_DOMAIN = 'kerenreem.org';
export type EmailRole = 'automated' | 'human';

export function fromAddress(role: EmailRole): string;
export function contactAddress(): string;              // מקור אמת אחד ל-contact@
export function defaultReplyTo(role: EmailRole): string | undefined;
export function replyToForInquiry(id?): string;        // התפר, ראו סעיף 7
export function staffInbox(contactEmail: string | null): string | null;
```

`staffInbox` נשארת נפרדת מהכתובות האחרות במכוון: היא **יעד** להתראות
פנימיות, לא כתובת שולח, והיא לרוב תיבת Gmail של הצוות ולא כתובת על
הדומיין.

`src/lib/email/template-list.ts` רושם לכל תבנית את התפקיד וכתובת המענה
שלה. זה מה שמאפשר לשליחת הבדיקה במסך הניהול לצאת באותה תצורה בדיוק כמו
בייצור — בדיקה שיוצאת מכתובת אחרת מזו שהנמען יראה אינה בודקת את מה שצריך.

---

## 7. התפר לקליטת תשובות אוטומטית (Resend Inbound בעתיד)

כדי שתשובה של פונה תיקלט אל **הפנייה הנכונה** במערכת, היא צריכה לחזור
לכתובת שמזהה את הפנייה: `contact+inq-123@kerenreem.org`. גם Cloudflare
Email Routing (אחרי הפעלת subaddressing בהגדרות) וגם Resend Inbound יודעים
להתאים כתובת כזו לכלל של `contact@` ולשמר את הסיומת — כלומר אין כאן מחסום
טכני בשום כיוון.

`replyToForInquiry(inquiryId)` היא התפר, והיא **מחזירה כרגע `contact@`
נטו**. הסיבה אינה מגבלה של הספק אלא שאין עדיין מנגנון שמכניס תשובות
לפנייה באתר: כתובת שמבטיחה קליטה אוטומטית לפני שהיא קיימת גרועה מכתובת
פשוטה. `replyToInquiry` (`messages-actions.ts`) כבר קורא דרכה, ולכן
ההפעלה תהיה שינוי בגוף הפונקציה הזו בלבד.

מה יידרש בפועל כשנרצה להפעיל — **לא חלק מהמצב הנוכחי**:

1. להחזיר מ-`replyToForInquiry` את הצורה עם הסיומת.
2. להפעיל subaddressing ב-Cloudflare, או להעביר את הקבלה ל-Resend Inbound.
3. `src/lib/email/inbound.ts` + נתיב `POST /api/email/inbound` שמאמת את
   חתימת ה-webhook של הספק, מפענח את `inq-<id>` ומוסיף רשומה
   ל-`contact_replies` — כך שתשובה תופיע בשרשור הפנייה בניהול.

---

## 8. Supabase Auth — מה להגדיר, בלי לשכתב את ה-Auth

ארבע ההודעות שבסעיף 2.4 ממשיכות לצאת מ-Supabase. **איננו מחליפים את
מסלול ה-Auth בשלב הזה**; רק את המוביל והמראה.

### 8.1 Custom SMTP

**Project Settings ← Authentication ← SMTP Settings** — להפעיל Custom SMTP
ולמלא מהערכים שעמוד ה-SMTP של Resend מציג (יש לאמת אותם שם, לא כאן):

| שדה | הערך אצל Resend |
|---|---|
| Host | `smtp.resend.com` |
| Port | 465 (TLS מובנה); 587 כחלופה |
| Username | `resend` |
| Password | מפתח API של Resend עם הרשאת שליחה |
| Sender email | `no-reply@kerenreem.org` |
| Sender name | `מכון קרן רא״ם` |

ואחר כך **Authentication ← Rate Limits ← «Emails sent per hour»** — להעלות.
מגבלת ברירת המחדל שייכת לשירות הדואר המובנה של Supabase, והיא נמוכה מדי
לשימוש אמיתי. שכחה של השלב הזה מתבטאת בלקוחות שפשוט אינם מקבלים קישור
כניסה, בלי שגיאה באתר.

### 8.2 אילו תבניות למתג

**Authentication ← Email Templates**, בסדר חשיבות:

1. **Magic Link** — קישור הכניסה של לקוחות. דרך הכניסה היחידה לאזור
   האישי, ולכן ראשונה.
2. **Change Email Address** — משמשת את שני אתרי שינוי המייל (לקוח ומנהל).
3. **Confirm signup** — נשלחת כשהלקוח חדש (תלוי ב-`shouldCreateUser`).
4. **Reset Password** — רק מסלול הגיבוי, כשאין `SUPABASE_SERVICE_ROLE_KEY`.

**Invite user** ו-**Reauthentication** — הקוד שלנו אינו משתמש בהן
(`team-actions` יוצר משתמש עם סיסמה זמנית ושולח בתבנית שלנו). להשאיר
כברירת מחדל.

### 8.3 שתי מגבלות שיש לדעת מראש

* **התבניות ב-Supabase הן HTML סטטי בדשבורד.** הן אינן יכולות לקרוא את
  `src/lib/email/brand.ts`, ולכן מיתוג שלהן פירושו **שכפול** מעטפת המותג,
  ושינוי עתידי בעיצוב הדואר יצטרך להיעשות בשני מקומות. זה הנימוק
  למסלול החלופי (`auth.admin.generateLink` ושליחה בתבנית שלנו, כפי שכבר
  נעשה באיפוס סיסמה בניהול) — אבל הוא מחוץ לשלב הזה. הלוגו יעבוד בתנאי
  שמשתמשים ב-URL מוחלט.
* **אין הגדרת Reply-To ב-Auth.** ארבע ההודעות האלה ייצאו מ-`no-reply@`
  בלי כתובת מענה. עקבי עם ההחלטה לגבי איפוס סיסמה; לגבי Magic Link זה
  מקובל.

---

## 9. סדר הפעולות שנותר

הקוד מוכן. מה שנשאר הוא בצד הספק, והסדר חשוב: אין טעם לבדוק מענה לפני
שהכתובת קולטת.

1. לאמת את `kerenreem.org` ב-Resend, ברשומות שהוא מציג. לוודא ש-
   `COMMERCE_EMAIL_FROM` בייצור אינו מצביע על `keren-reem.org` הישן.
2. להפעיל Cloudflare Email Routing, למפות `contact@` לתיבת הצוות ולהפיל
   `no-reply@`, תוך הקפדה על רשומת SPF אחת (5.2).
3. להגדיר Custom SMTP ב-Supabase ולהעלות את מגבלת הדואר (8.1).
4. לשלוח מייל בדיקה ממסך «דואר יוצא» לתיבה חיצונית, ולוודא בכותרות
   ההודעה: `dkim=pass`, `spf=pass`, ושה-`From` וה-`Reply-To` הם מה
   שהטבלה בסעיף 2 אומרת — כולל שבאיפוס סיסמה אין `Reply-To` כלל.
5. להשיב על ההודעה, ולוודא שהתשובה מגיעה לתיבת הצוות.
6. למתג את ארבע תבניות ה-Auth (8.2).
