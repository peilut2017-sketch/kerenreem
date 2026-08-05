# תרשימי תהליכים — מערכת המסחר של מכון קרן רא״ם

> חלק מחבילת אפיון המסחר: [מסמך האב](./commerce-master-spec.md) · [מודל הנתונים](./commerce-data-model.md) · [ניתוח פערים](./commerce-gap-analysis.md) · [תוכנית יישום](./commerce-implementation-plan.md) · [החלטות](./commerce-decisions.md)
>
> שמות טבלאות, שדות ופונקציות — כמוגדר במודל הנתונים. "שרת" = Server Action / Route Handler עם service role; "מסד" = Supabase Postgres; "מורנינג" = חשבונית ירוקה (סליקה + מסמכים).

## תוכן

1. [ארבעת צירי המצב (State Machines)](#state-machines)
2. [הוספה לסל](#flow-add-to-cart)
3. [התחברות ומיזוג סל](#flow-merge)
4. [Checkout — המסלול הרגיל](#flow-checkout-regular)
5. [Checkout — מסלול אקספרס](#flow-checkout-express)
6. [יצירת הזמנה (צילום מלא)](#flow-create-order)
7. [מעבר לסליקה במורנינג](#flow-payment-redirect)
8. [קבלת Webhook](#flow-webhook)
9. [הפקת מסמך חשבונאי](#flow-document)
10. [הפחתת מלאי אטומית](#flow-inventory)
11. [הכנת משלוח](#flow-fulfillment)
12. [איסוף עצמי](#flow-pickup)
13. [ביטול](#flow-cancel)
14. [החזרה](#flow-return)
15. [זיכוי](#flow-refund)
16. [תשלום שנכשל](#flow-payment-failed)
17. [תשלום הצליח, מסמך נכשל](#flow-doc-failed)
18. [חשבון פסיבי לאחר רכישה](#flow-passive-account)
19. [חזרת הלקוח מדף התשלום לפני ה־Webhook](#flow-return-before-webhook)

---

<a name="state-machines"></a>
## 1. ארבעת צירי המצב

עיקרון: אין שדה סטטוס יחיד. כל ציר מתקדם בנפרד, כל מעבר מתועד ב־`order_events` עם `actor_type`. מעבר שאינו מופיע כאן — **אסור**, ונאכף גם בשכבת ה־Domain וגם ב־trigger במסד.

### 1.1 ציר ההזמנה — `orders.state`

```mermaid
stateDiagram-v2
    [*] --> draft: יצירת טיוטה (הזמנה ידנית)
    [*] --> pending: Checkout הושלם
    draft --> pending: הצוות שולח קישור תשלום
    draft --> cancelled: הצוות מוחק טיוטה
    pending --> confirmed: תשלום אושר (Webhook) / סימון תשלום חיצוני
    pending --> cancelled: הלקוח ביטל / פג תוקף / הצוות ביטל
    confirmed --> processing: הצוות התחיל טיפול
    processing --> completed: נמסר / נאסף
    confirmed --> cancelled: ביטול לפני טיפול (עם זיכוי אם שולם)
    processing --> cancelled: ביטול חריג (אישור כפול)
    completed --> closed: נסגר סופית (אחרי חלון החזרה)
    cancelled --> closed: נסגר אחרי השלמת זיכויים
    closed --> [*]
```

| מעבר | מי רשאי | תיעוד |
|---|---|---|
| →pending | מערכת (Checkout) | `order_created` |
| pending→confirmed | מערכת (Webhook) בלבד; או צוות בהרשאת "סימון תשלום חיצוני" | `payment_succeeded` / `manual_payment_marked` |
| confirmed→processing | צוות ("מטפל בהזמנות"+) | `status_changed` |
| processing→completed | צוות / מערכת (אישור מסירה) | `status_changed` |
| →cancelled | לקוח (רק מ־pending, ותנאי פרק 14); צוות; מערכת (פקיעה) | `cancelled` + סיבה |
| →closed | מערכת (job) / צוות | `status_changed` |

### 1.2 ציר התשלום — `orders.payment_state`

```mermaid
stateDiagram-v2
    [*] --> not_required: הזמנה בסכום 0 (עתידי)
    [*] --> pending: הזמנה נוצרה
    pending --> authorized: תפיסת מסגרת (אם מורנינג תומכת — הנחה 9.3)
    pending --> paid: Webhook תשלום מוצלח
    authorized --> paid: לכידה
    pending --> failed: Webhook כשל / פקיעת דף תשלום
    failed --> pending: ניסיון תשלום חוזר
    pending --> cancelled: ההזמנה בוטלה לפני תשלום
    paid --> partially_refunded: זיכוי חלקי
    paid --> refunded: זיכוי מלא
    partially_refunded --> refunded: השלמת הזיכוי
```

מי רשאי: כל המעברים — **מערכת בלבד** (Webhook/Reconciliation), למעט זיכוי (צוות בהרשאת "זיכוי" → מפעיל את מורנינג → המעבר עצמו נרשם רק אחרי אישור מורנינג) וסימון תשלום חיצוני (צוות, ערוץ טלפוני, הרשאה ייעודית, נתיב `manual_external`).

### 1.3 ציר האספקה — `orders.fulfillment_state`

```mermaid
stateDiagram-v2
    [*] --> unfulfilled
    unfulfilled --> preparing: הצוות התחיל ליקוט
    preparing --> ready_for_pickup: הזמנת איסוף מוכנה
    preparing --> shipped: נמסר לשליח (+מספר מעקב)
    preparing --> partially_fulfilled: חלק נשלח (רק אם הוחלט לתמוך — החלטה 13)
    partially_fulfilled --> shipped: יתרת הפריטים נשלחה
    ready_for_pickup --> fulfilled: נאסף בפועל
    shipped --> delivered: אישור מסירה
    delivered --> returned: החזרה התקבלה
    fulfilled --> returned: החזרה התקבלה
    shipped --> fulfilled: אין אישור מסירה, נסגר ידנית
```

מי רשאי: צוות ("מחסן ומשלוחים"+); `delivered` — גם מערכת (עדכון ספק שילוח, עתידי). כל מעבר שולח הודעת לקוח לפי מטריצת פרק 16 במסמך האב.

### 1.4 ציר המסמך — `orders.document_state`

```mermaid
stateDiagram-v2
    [*] --> not_created
    not_created --> pending: תשלום אושר, ממתין להפקה
    pending --> created: מורנינג החזירה מסמך
    pending --> failed: הפקה נכשלה
    failed --> pending: ‏Retry (אוטומטי/ידני)
    created --> credited: הופק מסמך זיכוי
    created --> cancelled: המסמך בוטל במורנינג
```

מי רשאי: מערכת; "הפקה מחדש" — צוות בהרשאת "הפקת מסמך מחדש". אם המסמך מופק אוטומטית על־ידי מורנינג בעת הסליקה (תרחיש הבסיס, אימות 9.3.5) — המעבר `not_created→created` מגיע ישירות מה־Webhook.

---

<a name="flow-add-to-cart"></a>
## 2. הוספה לסל

טריגר: כפתור "הוספה לסל" — היום רכיב דומם ללא `onClick` ב־`BookHeroActions.tsx:70-74`, ‏`BookFinalCta.tsx:55-59`; כפתורי הגלילה ב־`StickyNav.tsx:173`, ‏`FloatingActions.tsx:98`; וכפתור חדש בכרטיסי הקטלוג.

```mermaid
sequenceDiagram
    autonumber
    actor U as מבקר
    participant C as רכיב לקוח (CartProvider)
    participant S as שרת (cart action)
    participant DB as מסד

    U->>C: לחיצה על "הוספה לסל"
    C->>S: addToCart(bookId, qty=1)
    S->>DB: קריאת הספר: is_purchasable, price, stock, preorder
    alt הספר אינו זמין (אזל / הוסר / לא לרכישה)
        S-->>C: שגיאה מפורשת לפי סוג
        C-->>U: הודעה ("אזל מן המלאי" וכו'), הכפתור מתעדכן
    else זמין
        alt מבקר מחובר (חשבון)
            S->>DB: upsert cart_items (unique cart+book, qty+1, תקרה 99)
        else אורח
            C->>C: עדכון kr:cart ב-localStorage (useLocalMap)
        end
        S-->>C: מצב עדכני: qty, subtotal, availability
        C-->>U: Toast "נוסף לסל" + עדכון מונה בכותרת + פתיחת Mini Cart (בעמוד ספר)
    end
```

מצבי קצה: כמות מבוקשת > זמין ⇒ ההוספה נחסמת עם הודעה על הכמות המקסימלית; לחיצה כפולה ⇒ ההוספה idempotent־ברמת הכוונה (מונה עולה פעם אחת — debounce בלקוח + upsert בשרת); שתי לשוניות ⇒ סנכרון דרך אירוע `storage` (מנגנון קיים ב־`client-hooks.ts:76-88`).

---

<a name="flow-merge"></a>
## 3. התחברות ומיזוג סל (ורשימות)

```mermaid
sequenceDiagram
    autonumber
    actor U as לקוח
    participant C as לקוח (דפדפן)
    participant S as שרת
    participant DB as מסד

    U->>C: התחברות (OTP) הצליחה
    C->>S: mergeLocalState({cart: kr:cart, favourites: kr:favourites, shelf: kr:shelf, recent: kr:recent-searches})
    S->>DB: טעינת עגלת active של הלקוח
    S->>S: מיזוג עגלה: איחוד ספרים; כמות = max(מקומי, שרת)
    S->>DB: כתיבת עגלה ממוזגת (בטרנזקציה)
    S->>DB: מיזוג saved_books: favourite=OR, ‏shelf=המקומי גובר אם קיים (הבחירה הטרייה)
    S-->>C: תמונת מצב ממוזגת
    C->>C: ריקון kr:cart; ‏kr:favourites/kr:shelf מוחלפים בעותק מהשרת
    C-->>U: מונה סל מעודכן; אין איבוד מידע
```

כללי התנגשות (סעיף 5.8 במסמך האב): לעולם אין מחיקה שקטה — פריט שקיים רק בצד אחד נשמר; התנגשות מדף (ערכים שונים) ⇒ המקומי גובר ונרשם `updated_at`; בהתנתקות — עותק קריאה נשאר מקומי כדי שהחוויה לא "תתרוקן", ומסונכרן מחדש בהתחברות הבאה.

---

<a name="flow-checkout-regular"></a>
## 4. ‏Checkout — המסלול הרגיל (עמוד אחד, שלושה בלוקים)

```mermaid
flowchart TD
    A[כניסה ל-/checkout] --> B{עגלה תקינה?}
    B -- ריקה --> B1[הפניה לעגלה עם הודעה]
    B -- כן --> C[אימות שרת: מחיר+מלאי לכל פריט]
    C -- שינוי התגלה --> C1[הודעה מפורשת: מה השתנה, אישור להמשיך]
    C1 --> D
    C -- תקין --> D[יצירת/עדכון checkout_session + הצגת הטופס]
    D --> E[בלוק 1: טלפון → שם → מייל חובה<br/>הצעת OTP עדינה ללקוח קיים]
    E -->|שמירת פרטי קשר| E1[(session: contact_entered<br/>בסיס עגלה נטושה)]
    E --> F[בלוק 2: משלוח או איסוף עצמי<br/>כתובת עם השלמה + שיטה + תאריך אספקה]
    F --> G[בלוק 3: קופון, מתנה, תרומה*, סקירה<br/>תקנון + תמצית ביטול + שורת אמון + טלפון]
    G --> H{לחיצה על מעבר לתשלום}
    H --> I[נעילת כפתור + Idempotency-Key]
    I --> J[אימות סופי בשרת: מחיר, מלאי, קופון, משלוח]
    J -- נכשל --> J1[חזרה עם הודעה נקודתית<br/>הכפתור משוחרר]
    J -- תקין --> K[יצירת הזמנה pending — תרשים 6]
    K --> L[יצירת דף תשלום במורנינג — תרשים 7]
    L --> M[הפניה לדף התשלום]
```

שמירת התקדמות: רענון בכל שלב משחזר מה־session (זיהוי ב־cookie httpOnly). המובייל: סיכום מתקפל בראש; דסקטופ: סיכום דביק בצד. תרומה* — רק כש־`donations_enabled` (מחוץ ל־MVP).

---

<a name="flow-checkout-express"></a>
## 5. ‏Checkout — מסלול אקספרס (Bit / Apple Pay / Google Pay)

מותנה באימות מורנינג 9.3.1 (קביעת אמצעי תשלום מראש דרך ה־API). אם האימות ייכשל — המסלול הופך ל"מעבר מהיר לדף התשלום" (אותו תרשים בלי צעד 4) וההנחה מסומנת.

```mermaid
sequenceDiagram
    autonumber
    actor U as לקוח
    participant C as לקוח (Mini Cart / עמוד ספר / Checkout)
    participant S as שרת
    participant M as מורנינג

    U->>C: לחיצה על Bit / Apple Pay / Google Pay
    C->>S: expressCheckout(items, wallet, idempotencyKey)
    S->>S: אימות מלאי ומחיר מול המסד
    alt חסר מייל או כתובת (משלוח)
        S-->>C: מסך ביניים מינימלי: כתובת/איסוף + מייל<br/>(פרטי הארנק ממולאים אוטומטית, לא נשאלים שוב)
        C->>S: השלמת החסר בלבד
    end
    S->>S: יצירת הזמנה pending + צילום (תרשים 6), channel=web, is_express=true
    S->>M: יצירת דף תשלום עם אמצעי קבוע מראש (wallet)
    M-->>S: כתובת דף תשלום
    S-->>C: הפניה
    U->>M: אישור בארנק/באפליקציית ביט
    M-->>S: Webhook (תרשים 8)
```

---

<a name="flow-create-order"></a>
## 6. יצירת הזמנה — צילום מלא לפני תשלום

```mermaid
flowchart TD
    A[קלט: checkout_session + Idempotency-Key] --> B{קיימת הזמנה עם המפתח הזה?}
    B -- כן --> B1[החזרת ההזמנה הקיימת<br/>אין יצירה כפולה]
    B -- לא --> C[טרנזקציה]
    C --> D[נעילת שורות המלאי הרלוונטיות for update]
    D --> E{מלאי מספיק לכל פריט?}
    E -- לא --> E1[rollback + הודעה: הפריט אזל<br/>העגלה מסומנת לעדכון]
    E -- כן --> F[חישוב בשרת: מחירים מ-books,<br/>מבצע בתוקף, קופון, משלוח, מס, תרומה]
    F --> G{הסכום שהוצג ללקוח = הסכום המחושב?}
    G -- לא --> G1[rollback + חזרה לסקירה עם ההפרש מוצג]
    G -- כן --> H[insert orders: state=pending, payment_state=pending<br/>+ צילום: שמות, מק״ט, מחירים, הנחות, מס, משלוח, כתובת, תאריך מובטח]
    H --> I[insert order_items עם כל שדות הצילום]
    I --> J[commerce_reserve_stock לכל פריט<br/>reserved += qty, תנועת reserve]
    J --> K[insert order_events: order_created]
    K --> L[commit]
    L --> M[יצירת טוקן אורח, שליחת hash למסד<br/>אין מייל עדיין — רק אחרי תשלום]
```

הערה: שמירת המלאי (reserve) ביצירת ההזמנה עם תוקף = `payments.expires_at`; ההחלטה הסופית על מועד השמירה — החלטה 9. ‏`draft` (הזמנה ידנית) עוקף את הצעדים D–J עד שליחת קישור התשלום.

---

<a name="flow-payment-redirect"></a>
## 7. מעבר לסליקה במורנינג

```mermaid
sequenceDiagram
    autonumber
    participant S as שרת
    participant DB as מסד
    participant M as מורנינג (API)
    actor U as לקוח

    S->>DB: insert payments: kind=charge, status=initiated,<br/>idempotency_key, amount=orders.total
    S->>M: יצירת דף תשלום: סכום, פירוט שורות, פרטי לקוח,<br/>סוג מסמך (מהגדרות), success/cancel URLs, מזהה הזמנה,<br/>אמצעי קבוע (אקספרס) / תשלומים מעל סף (אשראי)
    alt הקריאה נכשלה (רשת/API)
        M--xS: שגיאה
        S->>DB: payments.status=failed + error
        S-->>U: הודעה: התשלום לא נפתח, נסו שוב / הזמינו בטלפון<br/>(ההזמנה נשארת pending; ניסיון חוזר יוצר payment חדש)
    else הצליחה
        M-->>S: payment_page_url + מזהה עסקה
        S->>DB: payments: status=pending, morning_transaction_id, page_url
        S-->>U: redirect לדף התשלום של מורנינג
        Note over U,M: הלקוח מזין פרטי תשלום אצל מורנינג בלבד —<br/>פרטי אשראי לעולם אינם עוברים בשרתי האתר
    end
```

---

<a name="flow-webhook"></a>
## 8. קבלת Webhook ממורנינג — מקור האמת לאישור תשלום

```mermaid
flowchart TD
    A[POST /api/webhooks/morning] --> B[שמירת payload גולמי ל-webhook_events<br/>status=received — לפני כל עיבוד]
    B --> C{אימות חתימה/סוד}
    C -- נכשל --> C1[status=invalid_signature<br/>תשובה 401. אין עיבוד. התראה לצוות אם חוזר]
    C -- תקין --> D{אירוע כפול? unique על external_id/hash}
    D -- כפול --> D1[status=duplicate, תשובה 200<br/>אין עיבוד נוסף — Idempotency]
    D -- חדש --> E[התאמת עסקה: morning_transaction_id → payments → order]
    E -- לא נמצאה --> E1[status=failed + התראה<br/>נשמר לחקירה, תשובה 200]
    E -- נמצאה --> F{בדיקת סכום ומטבע מול צילום ההזמנה}
    F -- אי-התאמה --> F1[חריגה: order מסומן דורש-טיפול,<br/>התראה לצוות, אין אישור אוטומטי]
    F -- תואם --> G[טרנזקציה]
    G --> H[payments.status=succeeded + method מה-payload]
    H --> I[orders: payment_state=paid, state=confirmed, paid_at]
    I --> J[commerce_commit_stock לכל פריט<br/>on_hand −= qty, reserved −= qty — idempotent]
    J --> K[document_state=pending / created<br/>לפי מצב ההפקה האוטומטית — תרשים 9]
    K --> L[order_events: payment_succeeded]
    L --> M[commit]
    M --> N[תור הודעות: מייל אישור תשלום + מסמך<br/>+ SMS/וואטסאפ אם נבחר]
    N --> O[webhook_events: status=processed, תשובה 200]
```

גיבוי ל־Webhook שלא הגיע: ‏job מתוזמן (Polling) שסורק `payments` במצב pending מעל X דקות ושואל את מורנינג לסטטוס יזום (אימות 9.3.7); אותה לוגיקת עיבוד בדיוק, עם `actor_type=system`.

---

<a name="flow-document"></a>
## 9. הפקת מסמך חשבונאי

תרחיש הבסיס (לפי ממצאי 9.1): המסמך מופק **אוטומטית על־ידי מורנינג** עם העסקה, וה־Webhook נושא את פרטיו. התרשים מכסה גם הפקה יזומה (ערוץ טלפוני / Retry).

```mermaid
flowchart TD
    A{מקור} -->|Webhook עם פרטי מסמך| B[insert documents: created,<br/>morning_doc_id, מספר, קישור]
    A -->|תשלום אושר ללא מסמך| C[קריאת API להפקה<br/>עם idempotency_key = order:doc_type]
    C -->|הצליחה| B
    C -->|נכשלה| D[documents.status=failed<br/>orders.document_state=failed<br/>error + attempts+1]
    D --> E[Retry אוטומטי: backoff 1m/10m/1h, עד 5]
    E -->|הצליח| B
    E -->|מוצו הניסיונות| F[התראה לצוות + תצוגת ׳תשלום ללא מסמך׳<br/>כפתור הפקה ידנית]
    F --> C
    B --> G[orders.document_state=created]
    G --> H[שמירת עותק/קישור + מייל ללקוח עם המסמך<br/>בהזמנת מתנה — למזמין בלבד]
```

מניעת כפילות: לפני כל קריאת הפקה — בדיקת מסמך חי קיים (partial unique index על `(order_id, doc_type)`); ‏idempotency_key בקריאת ה־API עצמה אם נתמך (אימות 9.3).

---

<a name="flow-inventory"></a>
## 10. הפחתת מלאי אטומית — שני לקוחות על העותק האחרון

```mermaid
sequenceDiagram
    autonumber
    actor A as לקוח א׳
    actor B as לקוח ב׳
    participant S as שרת
    participant DB as מסד (commerce_reserve_stock)

    par שני Checkout במקביל, מלאי available=1
        A->>S: מעבר לתשלום (ספר X)
        B->>S: מעבר לתשלום (ספר X)
    end
    S->>DB: reserve(X,1,orderA) — select for update
    Note over DB: שורת המלאי נעולה; הבקשה השנייה ממתינה
    DB-->>S: הצלחה: reserved=1, available=0
    S->>DB: reserve(X,1,orderB) — הנעילה השתחררה
    DB-->>S: כשל: available=0
    S-->>A: ממשיך למורנינג
    S-->>B: "העותק האחרון נתפס זה עתה" + הצעה:<br/>התראת חזרה למלאי / הסרה מהסל
```

כללי יסוד: אין ערך שלילי (check במסד); כל תנועה נרשמת ב־ledger עם before/after; ‏commit/release בלבד משחררים reserve; ‏reserve שפג תוקפו (תשלום לא הושלם) משוחרר ב־job עם תנועת release.

---

<a name="flow-fulfillment"></a>
## 11. הכנת משלוח

```mermaid
flowchart TD
    A[תצוגה שמורה: ׳להכנה׳<br/>state=confirmed, fulfillment=unfulfilled] --> B[פתיחת הזמנה / הדפסת רשימת ליקוט]
    B --> C[fulfillment_state=preparing]
    C --> D[ליקוט לפי stock_location שעל הספר]
    D --> E{הזמנת מתנה?}
    E -- כן --> E1[אריזת מתנה: הקדשה מודפסת,<br/>בלי מחיר בחבילה]
    E -- לא --> F
    E1 --> F[אריזה + תעודת משלוח]
    F --> G[הזנה: חברת משלוחים, מספר מעקב,<br/>קישור מעקב, תאריך מסירה לשליח]
    G --> H[fulfillment_state=shipped<br/>order_events: tracking_added]
    H --> I[מייל ׳נשלח׳ עם מעקב + ערוץ נייד אם נבחר]
    I --> J{עדכון מסירה}
    J -->|התקבל| K[delivered + מייל ׳נמסר׳]
    J -->|אין| L[נשאר shipped · דוח ׳עמידה בתאריך׳<br/>מסמן איחור מול promised_delivery_date]
```

---

<a name="flow-pickup"></a>
## 12. איסוף עצמי

```mermaid
flowchart TD
    A[הזמנה עם fulfillment_type=pickup שולמה] --> B[מופיעה בתצוגת ׳לאיסוף — בהכנה׳]
    B --> C[הצוות מכין: preparing]
    C --> D[fulfillment_state=ready_for_pickup]
    D --> E[הודעה יזומה: ׳ההזמנה מוכנה לאיסוף׳<br/>כתובת, שעות, מה להביא — ׳שולם׳ אינו ׳מוכן לאיסוף׳]
    E --> F{הלקוח הגיע}
    F -- כן --> G[אימות: מספר הזמנה + שם/טלפון]
    G --> H[fulfillment_state=fulfilled → state=completed]
    F -- לא בתוך X ימים --> I[תזכורת במייל]
    I --> J{עדיין לא נאסף}
    J -- כן --> K[דוח ׳איסופים שלא נאספו׳ → טיפול ידני:<br/>תיאום / ביטול וזיכוי]
```

---

<a name="flow-cancel"></a>
## 13. ביטול הזמנה

```mermaid
flowchart TD
    A{מקור הבקשה} -->|לקוח: עמוד ההזמנה, בתנאי הזכאות| B[order_events: cancel_requested<br/>+ סיבה. ההזמנה אינה מבוטלת אוטומטית]
    A -->|צוות| C[פעולת ביטול במסך ההזמנה]
    A -->|מערכת: pending שפג| D[ביטול אוטומטי שקט]
    B --> E[תצוגת ׳בקשות ביטול׳ לצוות]
    E --> F{החלטת צוות}
    F -- דחייה --> F1[מענה ללקוח + תיעוד]
    F -- אישור --> C
    C --> G{שולם?}
    G -- לא --> H[state=cancelled<br/>commerce_release_stock — שחרור שמירה]
    G -- כן --> I[זיכוי דרך מורנינג — תרשים 15]
    I --> J{הפריטים חזרו פיזית?}
    J -- שאלת חובה --> K[החזרה למלאי מפורשת בלבד:<br/>תקין? לאיזה מיקום? — תרשים 14]
    H --> L[מייל ביטול + order_events: cancelled]
    K --> L
    D --> H
```

---

<a name="flow-return"></a>
## 14. החזרה (אחרי מסירה)

```mermaid
flowchart TD
    A[בקשת החזרה: פריטים, כמות, סיבה, מצב המוצר] --> B[return_requested + תצוגת צוות]
    B --> C{החלטה}
    C -- בקשת מידע --> C1[פנייה ללקוח, הבקשה פתוחה]
    C -- דחייה --> C2[נימוק + תיעוד + מייל]
    C -- אישור --> D[הפקת הוראות החזרה ללקוח<br/>שיטת החזרה, כתובת, אריזה]
    D --> E[הפריט התקבל פיזית]
    E --> F{בדיקת מצב}
    F -- תקין --> G[commerce_restock למיקום שנבחר<br/>תנועת return_restock]
    F -- פגום --> H[תנועת damage — לא חוזר למכירה]
    G --> I[זיכוי — תרשים 15]
    H --> I
    I --> J[fulfillment_state=returned<br/>סגירת הבקשה + מייל סיכום]
```

עמידה בדין (סעיף 14.5 במסמך האב): חלונות הביטול, דמי הביטול והחריגים — מהתקנון; המערכת אוכפת את חלון הזכאות בעמוד הלקוח ומציגה את התמצית ליד הכפתור.

---

<a name="flow-refund"></a>
## 15. זיכוי (מלא / חלקי) דרך מורנינג

```mermaid
sequenceDiagram
    autonumber
    actor T as צוות (הרשאת זיכוי)
    participant S as שרת
    participant DB as מסד
    participant M as מורנינג

    T->>S: זיכוי: פריטים/סכום, כולל משלוח או לא, סיבה
    S->>DB: חישוב תקרה: paid − sum(refunds succeeded)
    alt הסכום חורג מהתקרה
        S-->>T: נחסם: ׳זיכוי מצטבר עולה על ששולם׳
    else תקין
        S-->>T: מסך אישור כפול: סכום, אמצעי מקורי (כולל ביט), מסמך זיכוי צפוי
        T->>S: אישור סופי
        S->>DB: insert payments: kind=refund, status=initiated,<br/>parent=החיוב, idempotency_key
        S->>M: בקשת זיכוי על העסקה המקורית
        alt מורנינג אישרה
            M-->>S: אישור + מסמך זיכוי (credit_note)
            S->>DB: refund succeeded; payment_state=partially_refunded/refunded;<br/>documents: credit_note; document_state=credited
            S->>DB: order_events: refund_issued
            S-->>T: הצלחה + קישור למסמך הזיכוי
            S->>S: מייל זיכוי ללקוח
        else נכשלה
            M--xS: שגיאה
            S->>DB: refund failed + error
            S-->>T: כשל מפורט; ניתן לנסות שוב — אין זיכוי כפול (idempotency)
        end
    end
```

זיכוי על עסקת ביט — תהליך/זמנים/מסמך כפופים לאימות 9.3.4; עד אז מסומן כהנחה.

---

<a name="flow-payment-failed"></a>
## 16. תשלום שנכשל

```mermaid
flowchart TD
    A{מקור הכשל} -->|Webhook: failed| B[payments.status=failed]
    A -->|הלקוח ביטל בדף מורנינג| B
    A -->|פקיעת דף תשלום| B
    B --> C[orders: payment_state=failed<br/>state נשאר pending]
    C --> D[עמוד תוצאה: ׳התשלום לא הושלם׳<br/>+ כפתור ניסיון חוזר + טלפון]
    D --> E{הלקוח מנסה שוב?}
    E -- כן --> F[payment חדש — רשומה חדשה, אותה הזמנה<br/>המחיר מהצילום — לא מחושב מחדש]
    F --> G[תרשים 7]
    E -- לא, עבר הזמן --> H[job: שחרור שמירת המלאי — release<br/>ביטול אוטומטי אחרי חלון מוגדר + מייל ׳ההזמנה בוטלה׳]
    C --> I[order_events: payment_failed<br/>+ התראת צוות אם חוזר על עצמו]
```

---

<a name="flow-doc-failed"></a>
## 17. תשלום הצליח, מסמך נכשל

```mermaid
flowchart TD
    A[Webhook: תשלום הצליח, הפקת מסמך נכשלה/לא הגיעה] --> B[orders: payment_state=paid ✓<br/>document_state=failed]
    B --> C[אין סימון כשל תשלום. אין חיוב חוזר.<br/>המלאי כבר הופחת — לא מוחזר]
    C --> D[מייל אישור תשלום נשלח כרגיל<br/>בלי המסמך, עם ׳החשבונית תישלח בנפרד׳]
    D --> E[Retry אוטומטי — תרשים 9]
    E -->|הצליח| F[document_state=created + מייל המסמך]
    E -->|נכשל סופית| G[התראה + תצוגת ׳תשלום ללא מסמך׳<br/>הפקה ידנית עם הגנת כפילות]
```

---

<a name="flow-passive-account"></a>
## 18. יצירת חשבון פסיבי לאחר רכישה

```mermaid
sequenceDiagram
    autonumber
    actor U as לקוח (אורח ששילם)
    participant T as עמוד תודה / מייל אישור
    participant S as שרת
    participant A as Supabase Auth
    participant DB as מסד

    T-->>U: ׳שמור את הפרטים לפעם הבאה׳ (הצעה, לא חובה)
    U->>S: לחיצה על ההצעה (טוקן ההזמנה מזהה אותה)
    S->>A: יצירת/איתור משתמש לפי הטלפון + שליחת OTP
    Note over A: בלי kr_staff ⇒ לא נוצר profile צוות (migration 23)
    U->>S: הזנת הקוד
    S->>A: אימות OTP
    A-->>S: session
    S->>DB: insert customers מפרטי ההזמנה (טלפון, שם, מייל)<br/>+ כתובת ההזמנה כ-customer_address ברירת מחדל
    S->>DB: orders.user_id = המשתמש החדש —<br/>לכל ההזמנות התואמות טלפון מאומת זה
    S->>DB: consent_events: terms/channels כפי שסומנו ב-Checkout
    S-->>U: ׳החשבון מוכן׳ + כניסה לאזור האישי<br/>ההזמנה כבר מופיעה בו
```

אין טופס נוסף ואין סיסמה בשום שלב. שיוך הזמנות עבר: רק הזמנות שהטלפון בהן **זהה לטלפון שאומת** ב־OTP — מניעת השתלטות על הזמנות של אחר.

---

<a name="flow-return-before-webhook"></a>
## 19. הלקוח חזר מדף התשלום לפני שה־Webhook הגיע

```mermaid
sequenceDiagram
    autonumber
    actor U as לקוח
    participant R as ‏/checkout/result
    participant S as שרת
    participant M as מורנינג

    U->>R: חזרה מ-success URL
    R->>S: getOrderPaymentState(orderToken)
    S-->>R: payment_state=pending (ה-Webhook טרם הגיע)
    R-->>U: ׳מעבדים את התשלום…׳ — מצב ביניים חיובי, לא שגיאה
    loop רענון כל 3s, עד 60s
        R->>S: בדיקת מצב
        alt Webhook הגיע בינתיים
            S-->>R: paid ⇒ הצגת עמוד התודה המלא
        end
    end
    alt עדיין pending אחרי התקרה
        S->>M: בדיקת סטטוס יזומה (Polling, אימות 9.3.7)
        M-->>S: סטטוס עסקה
        S-->>R: עדכון בהתאם
    end
    alt נשאר לא ידוע
        R-->>U: ׳ההזמנה נקלטה. אישור סופי יישלח למייל בדקות הקרובות׳<br/>+ מספר הזמנה + טלפון. אין חיוב כפול בשום נתיב
    end
```

עיקרון מנחה: **ההפניה חזרה אינה אישור תשלום.** רק Webhook (או Polling מאומת) משנה `payment_state`.
