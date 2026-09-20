import type { ReportFamily, ReportPriority } from './types';
import type { ScreenKey } from '../screens';

/**
 * [1.5] קטלוג כל 26 הדוחות שהוגדרו — גם אלה שכבר בנויים וגם אלה שעדיין
 * לא. זו הדרך היחידה לתת ל-/admin/reports להציג את המבנה המלא (6
 * המשפחות, כולל מה שבדרך) בלי לאבד פריט בשקט תוך כדי בנייה מדורגת.
 * href=null ⇒ "בקרוב" ב-UI, לא קישור שבור.
 */
export interface ReportDefinition {
  id: string;
  family: ReportFamily;
  title: string;
  blurb: string;
  priority: ReportPriority;
  href: string | null;
  /**
   * מסך יעד עם הרשאה משלו (מלאי, לקוחות, הזמנות, יומן ביקורת, רווחיות,
   * תנועות מלאי): אינדקס הדוחות מציג אותו ככרטיס כבוי למי שאין לו גישה,
   * במקום קישור שמוביל ל"אין הרשאה". ריק ⇒ די בהרשאת reports.
   */
  screen?: ScreenKey;
}

export const REPORTS: ReportDefinition[] = [
  // מכירות ורווחיות
  {
    id: 'sales',
    family: 'sales_profit',
    title: 'מכירות והכנסות',
    blurb: 'ברוטו, הנחות, קופונים, החזרות, זיכויים, משלוח שנגבה, מע״מ, נטו — פילוח לפי יום/שבוע/חודש.',
    priority: 'important',
    href: '/admin/reports/sales',
  },
  {
    id: 'profitability',
    family: 'sales_profit',
    title: 'רווחיות',
    blurb: 'הכנסות פחות עלות הספרים, הנחות וזיכויים — רווח גולמי לפי ספר, מחבר, סדרה וקטגוריה.',
    priority: 'important',
    href: '/admin/reports/profitability',
    screen: 'reports-profitability',
  },
  {
    id: 'coupons',
    family: 'sales_profit',
    title: 'קופונים ומבצעים',
    blurb: 'שימושים, הנחה שניתנה והכנסה מהזמנות ששולמו, לפי קופון. מבצעים אוטומטיים — בקרוב (אין להם רישום מימוש פר-הזמנה עדיין).',
    priority: 'important',
    href: '/admin/reports/coupons',
  },
  {
    id: 'bought_together',
    family: 'sales_profit',
    title: '״נקנו יחד״',
    blurb: 'זוגות/קבוצות ספרים שמופיעים באותה הזמנה — לפני הסקת מסקנות נדרש מינימום נתונים.',
    priority: 'later',
    href: null,
  },

  // הזמנות
  {
    id: 'orders',
    family: 'orders',
    title: 'הזמנות',
    blurb: 'מספר הזמנות, סכום, סטטוס, תשלום, אספקה, אמצעי תשלום, אורח/חשבון, טלפוניות/אתר, בוטלו/זוכו.',
    priority: 'important',
    href: '/admin/orders',
    screen: 'orders',
  },
  {
    id: 'attention',
    family: 'orders',
    title: 'הזמנות שדורשות טיפול',
    blurb: 'ממתינות לתשלום, שולמו ולא טופלו, בהכנה זמן רב, ללא מסמך, ללא משלוח, באיחור, בקשות ביטול/החזרה.',
    priority: 'critical',
    href: '/admin/reports/attention',
  },
  {
    id: 'ops_performance',
    family: 'orders',
    title: 'ביצועי תפעול',
    blurb: 'זמן מהזמנה להכנה, מהכנה למשלוח ומהזמנה להשלמה; עומס הזמנות לפי יום ושעה.',
    priority: 'later',
    href: null,
  },

  // ספרים ומלאי
  {
    id: 'books',
    family: 'catalog_inventory',
    title: 'ספרים ומוצרים',
    blurb: 'יחידות שנמכרו, הכנסות, צפיות, שמירות, הוספות לסל והרשמות "הודיעו לי כשיחזור למלאי" — לא רק מה נמכר, גם מה מעניין ולא הומר.',
    priority: 'important',
    href: '/admin/reports/books',
  },
  {
    id: 'taxonomy',
    family: 'catalog_inventory',
    title: 'מחברים / קטגוריות / סדרות',
    blurb: 'הכנסות, יחידות, מספר הזמנות, Conversion, רווחיות ומגמות — לא רק לפי ספר בודד.',
    priority: 'later',
    href: null,
  },
  {
    id: 'inventory',
    family: 'catalog_inventory',
    title: 'מלאי',
    blurb: 'מלאי פיזי, שמור וזמין; מלאי נמוך; אזל; ספרים שלא זזים; קצב מכירה וימי מלאי צפויים.',
    priority: 'critical',
    href: '/admin/inventory',
    screen: 'inventory',
  },
  {
    id: 'inventory_moves',
    family: 'catalog_inventory',
    title: 'תנועות מלאי',
    blurb: 'Ledger מלא: קליטה, מכירה, ביטול, החזרה, נזק, ספירה ותיקון ידני — מי ביצע ומתי.',
    priority: 'important',
    href: '/admin/reports/inventory-moves',
    screen: 'reports-inventory-moves',
  },
  {
    id: 'catalog_quality',
    family: 'catalog_inventory',
    title: 'איכות הקטלוג',
    blurb: 'ספרים לרכישה ללא מחיר/משקל/SKU, מלאי לא תקין, מבצע שפג — לא מוכנים לפתיחת החנות.',
    priority: 'later',
    href: null,
  },

  // לקוחות והתנהגות
  {
    id: 'customers',
    family: 'customers',
    title: 'לקוחות',
    blurb: 'חדשים/חוזרים, הזמנות ללקוח, סכום מצטבר, AOV, זמן בין רכישות, לא פעילים, LTV — בלי PII מיותר.',
    priority: 'later',
    href: '/admin/customers',
    screen: 'customers',
  },
  {
    id: 'funnel',
    family: 'customers',
    title: 'משפך רכישה',
    blurb: 'צפייה → סל → Checkout → משלוח → תשלום → רכישה. Conversion ונפילה בכל שלב.',
    priority: 'important',
    href: '/admin/reports/funnel',
  },
  {
    id: 'abandoned',
    family: 'customers',
    title: 'עגלות ו-Checkout נטושים',
    blurb: 'מספר נטישות, שווי העגלות, נקודת הנטישה, מכשיר, אורח/מחובר, חזרה מאוחרת והמרה.',
    priority: 'later',
    href: null,
  },
  {
    id: 'search',
    family: 'customers',
    title: 'חיפוש באתר',
    blurb: 'חיפושים פופולריים, חיפושים ללא תוצאות, חיפוש שהוביל לרכישה, מילות חיפוש עם נטישה גבוהה.',
    priority: 'later',
    href: null,
  },

  // משלוחים ותפעול
  {
    id: 'shipping',
    family: 'shipping_ops',
    title: 'משלוחים',
    blurb: 'כמות לפי שיטה, עלות שנגבתה מול בפועל, זמן להכנה/משלוח/מסירה, איחורים, איסופים שלא נאספו.',
    priority: 'later',
    href: null,
  },
  {
    id: 'returns_cancellations',
    family: 'shipping_ops',
    title: 'החזרות וביטולים',
    blurb: 'שיעור ביטול/החזרה, סכומי זיכוי, סיבות, ספרים עם שיעור החזרה חריג, השפעה על הרווחיות.',
    priority: 'later',
    href: null,
  },
  {
    id: 'service',
    family: 'shipping_ops',
    title: 'שירות לקוחות',
    blurb: 'בקשות ביטול/החזרה/שאלות הזמנה, זמן טיפול ממוצע, בקשות פתוחות וסגורות, SLA.',
    priority: 'later',
    href: null,
  },

  // כספים והתאמות
  {
    id: 'payments',
    family: 'finance_recon',
    title: 'תשלומים',
    blurb: 'אשראי/Bit/Apple Pay/Google Pay — הצלחות, כשלים, Pending/פג תוקף, זיכויים.',
    priority: 'important',
    href: '/admin/reports/payments',
  },
  {
    id: 'reconciliation',
    family: 'finance_recon',
    title: 'התאמה מול Morning',
    blurb: 'לכל הזמנה ששולמה — עסקה ומסמך תואמים במורנינג; תשלום ללא מסמך, פערי סכום, Webhook שנכשל.',
    priority: 'critical',
    href: '/admin/reports/reconciliation',
  },
  {
    id: 'webhooks',
    family: 'finance_recon',
    title: 'כשלי Webhook',
    blurb: 'התראות ממורנינג שהתקבלו ולא עובדו בהצלחה — חתימה לא תקינה או כשל עיבוד.',
    priority: 'important',
    href: '/admin/reports/webhooks',
  },
  {
    id: 'documents',
    family: 'finance_recon',
    title: 'מסמכים חשבונאיים',
    blurb: 'מסמכים שהופקו/נכשלו/ממתינים, לפי סוג — עם רשימת הכשלים לטיפול.',
    priority: 'important',
    href: '/admin/reports/documents',
  },
  {
    id: 'vat',
    family: 'finance_recon',
    title: 'מע״מ / הנהלת חשבונות',
    blurb: 'מכירות חייבות/פטורות, בסיס המס, מע״מ, זיכויים, הפרדה בין מכירת ספרים לתרומות.',
    priority: 'later',
    href: null,
  },
  {
    id: 'audit',
    family: 'finance_recon',
    title: 'פעילות צוות / Audit',
    blurb: 'שינויי מחיר, מלאי, הנחות ידניות, ביטולים, זיכויים, שינוי הגדרות — מי, מתי, לפני ואחרי.',
    // מומש בפועל (/admin/audit-log, מקושר גם מניווט המערכת) — לא "בקרוב".
    priority: 'important',
    href: '/admin/audit-log',
    screen: 'audit-log',
  },
  {
    id: 'exceptions',
    family: 'finance_recon',
    title: 'דוח חריגים מרכזי',
    blurb: 'תשלום ללא מסמך, מלאי שלילי, הזמנה שולמה ולא טופלה, משלוח באיחור, Webhook כושל — אוחד לתוך "הזמנות שדורשות טיפול" (חפיפה כמעט מלאה בין השניים באפיון).',
    priority: 'important',
    href: '/admin/reports/attention',
  },
];

export function reportsByFamily(family: ReportFamily): ReportDefinition[] {
  return REPORTS.filter((r) => r.family === family);
}
