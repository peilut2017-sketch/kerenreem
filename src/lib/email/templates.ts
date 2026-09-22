import 'server-only';

import {
  button,
  definitionTable,
  divider,
  escapeHtml,
  getEmailBrand,
  h,
  noticeBlock,
  p,
  quoteBlock,
  renderBrandedEmail,
  safeUrl,
  type RenderedEmail,
} from './brand';

/**
 * [1.40] ההודעות עצמן. כל תבנית מחזירה נושא, HTML מותג וגרסת טקסט.
 *
 * העקרונות שחוזרים בכולן:
 *  • שורת פתיחה אחת שאומרת מה קרה, לפני כל פירוט. מי שקורא במובייל
 *    רואה בדרך כלל רק אותה.
 *  • פעולה אחת ברורה (כפתור), ולא שלוש אפשרויות שקולות.
 *  • תוכן שהמשתמש עצמו כתב מוצג במסגרת ציטוט, כדי שלא ייקרא כאילו
 *    נכתב על ידינו.
 *  • הודעת אבטחה (איפוס סיסמה) אומרת תמיד מה לעשות אם *לא* ביקשת.
 */

/** התבניות הקיימות — לשימוש מסך בדיקת הדואר בניהול. */
export const SITE_EMAIL_TEMPLATES = [
  { id: 'password_reset', label: 'איפוס סיסמה' },
  { id: 'password_changed', label: 'הסיסמה הוחלפה' },
  { id: 'contact_ack', label: 'אישור קבלת פנייה (לפונה)' },
  { id: 'contact_staff', label: 'התראה על פנייה חדשה (לצוות)' },
  { id: 'contact_reply', label: 'מענה לפנייה' },
  { id: 'team_invite', label: 'הזמנת איש צוות' },
] as const;

export type SiteEmailTemplate = (typeof SITE_EMAIL_TEMPLATES)[number]['id'];

/** כמה זמן קישור איפוס תקף — לתצוגה בלבד; התוקף עצמו נקבע ב-Supabase Auth. */
const RESET_VALIDITY = 'שעה';

/** קישור לאיפוס סיסמה. */
export async function passwordResetEmail(input: {
  resetUrl: string;
  /** שם הנמען, כשידוע — הודעה אישית קריאה יותר מ"שלום". */
  name?: string | null;
  /** true לחשבון צוות בממשק הניהול, false ללקוח החנות. */
  isStaff: boolean;
}): Promise<RenderedEmail> {
  const brand = await getEmailBrand();
  const greeting = input.name ? `שלום ${escapeHtml(input.name)},` : 'שלום,';
  const where = input.isStaff ? 'לממשק הניהול של האתר' : 'לחשבון שלך באתר';
  const url = safeUrl(input.resetUrl);

  const body = [
    p(greeting),
    p(`התקבלה בקשה לאיפוס הסיסמה ${where}. הקישור שלמטה יוביל לבחירת סיסמה חדשה.`),
    url ? button('בחירת סיסמה חדשה', url) : '',
    p(`הקישור תקף ל${RESET_VALIDITY} אחת, ולשימוש אחד בלבד.`, { small: true, muted: true }),
    noticeBlock(
      'אם לא ביקשתם לאפס סיסמה — אין צורך לעשות דבר. הסיסמה הקיימת נשארת בתוקף, והקישור יפוג מעצמו.',
    ),
    // הכתובת המלאה בנוסף לכפתור: חלק מלקוחות הדואר חוסמים כפתורים,
    // וחלק מהמשתמשים פשוט לא בוטחים בהם.
    url
      ? p(
          `אם הכפתור אינו עובד, אפשר להעתיק את הכתובת הזו לדפדפן:<br><span dir="ltr" style="word-break:break-all">${escapeHtml(url)}</span>`,
          { small: true, muted: true },
        )
      : '',
  ].join('');

  return renderBrandedEmail({
    brand,
    subject: 'איפוס סיסמה',
    preheader: `קישור לבחירת סיסמה חדשה, תקף ל${RESET_VALIDITY}.`,
    title: 'איפוס סיסמה',
    body,
    text: [
      greeting.replace(/&#39;/g, "'"),
      `התקבלה בקשה לאיפוס הסיסמה ${where}.`,
      url ? `לבחירת סיסמה חדשה: ${url}` : '',
      `הקישור תקף ל${RESET_VALIDITY} אחת ולשימוש אחד בלבד.`,
      'אם לא ביקשתם לאפס סיסמה — אין צורך לעשות דבר.',
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

/** אישור שהסיסמה הוחלפה בפועל — ההודעה שמאפשרת לזהות השתלטות על חשבון. */
export async function passwordChangedEmail(input: {
  name?: string | null;
  /** מתי, בטקסט קריא. */
  whenLabel: string;
  isStaff: boolean;
}): Promise<RenderedEmail> {
  const brand = await getEmailBrand();
  const greeting = input.name ? `שלום ${escapeHtml(input.name)},` : 'שלום,';
  const contact = brand.contactEmail;

  const body = [
    p(greeting),
    p(`הסיסמה ${input.isStaff ? 'לממשק הניהול' : 'לחשבון שלך באתר'} הוחלפה בהצלחה.`),
    definitionTable([{ label: 'מועד השינוי', value: escapeHtml(input.whenLabel) }]),
    noticeBlock(
      contact
        ? `אם לא אתם ביצעתם את השינוי — יש ליצור איתנו קשר מיד בכתובת ${contact}.`
        : 'אם לא אתם ביצעתם את השינוי — יש ליצור איתנו קשר מיד.',
    ),
  ].join('');

  return renderBrandedEmail({
    brand,
    subject: 'הסיסמה שלך הוחלפה',
    preheader: 'אישור על החלפת סיסמה. אם לא אתם עשיתם זאת — צרו קשר.',
    title: 'הסיסמה הוחלפה',
    body,
    text: [
      greeting,
      `הסיסמה ${input.isStaff ? 'לממשק הניהול' : 'לחשבון שלך באתר'} הוחלפה בהצלחה.`,
      `מועד השינוי: ${input.whenLabel}`,
      contact ? `אם לא אתם ביצעתם את השינוי — צרו קשר מיד: ${contact}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

export interface ContactDetails {
  name: string;
  email: string;
  phone?: string | null;
  subject?: string | null;
  topic?: string | null;
  message: string;
  /** שדות נוספים שהוגדרו בניהול (contact_fields). */
  extraFields?: { label: string; value: string }[];
  attachmentCount?: number;
}

/** אישור קבלה לשולח הפנייה. */
export async function contactAckEmail(details: ContactDetails): Promise<RenderedEmail> {
  const brand = await getEmailBrand();

  const body = [
    p(`שלום ${escapeHtml(details.name)},`),
    p('פנייתכם התקבלה. נשתדל לחזור אליכם בהקדם.'),
    h('מה שנשלח'),
    definitionTable(
      [
        details.topic ? { label: 'תחום', value: escapeHtml(details.topic) } : null,
        details.subject ? { label: 'נושא', value: escapeHtml(details.subject) } : null,
      ].filter((row): row is { label: string; value: string } => row !== null),
    ),
    quoteBlock(escapeHtml(details.message).replaceAll('\n', '<br>')),
    details.attachmentCount
      ? p(`צורפו ${details.attachmentCount} קבצים.`, { small: true, muted: true })
      : '',
    divider(),
    p('אין צורך להשיב להודעה הזו — היא נשלחה אוטומטית כאישור קבלה.', {
      small: true,
      muted: true,
    }),
  ].join('');

  return renderBrandedEmail({
    brand,
    subject: 'פנייתכם התקבלה',
    preheader: 'קיבלנו את הפנייה ונחזור אליכם בהקדם.',
    title: 'הפנייה התקבלה',
    body,
    text: [
      `שלום ${details.name},`,
      'פנייתכם התקבלה. נשתדל לחזור אליכם בהקדם.',
      details.topic ? `תחום: ${details.topic}` : '',
      details.subject ? `נושא: ${details.subject}` : '',
      '',
      details.message,
    ]
      .filter((line) => line !== '')
      .join('\n'),
  });
}

/** התראה לצוות על פנייה חדשה. */
export async function contactStaffEmail(
  details: ContactDetails,
  inboxUrl: string | null,
): Promise<RenderedEmail> {
  const brand = await getEmailBrand();
  const url = safeUrl(inboxUrl);

  const rows = [
    { label: 'שם', value: escapeHtml(details.name) },
    {
      label: 'דואר אלקטרוני',
      value: `<a href="mailto:${escapeHtml(details.email)}" dir="ltr">${escapeHtml(details.email)}</a>`,
    },
    details.phone
      ? {
          label: 'טלפון',
          value: `<a href="tel:${escapeHtml(details.phone)}" dir="ltr">${escapeHtml(details.phone)}</a>`,
        }
      : null,
    details.topic ? { label: 'תחום', value: escapeHtml(details.topic) } : null,
    details.subject ? { label: 'נושא', value: escapeHtml(details.subject) } : null,
    ...(details.extraFields ?? []).map((field) => ({
      label: field.label,
      value: escapeHtml(field.value),
    })),
    details.attachmentCount
      ? { label: 'קבצים מצורפים', value: String(details.attachmentCount) }
      : null,
  ].filter((row): row is { label: string; value: string } => row !== null);

  const body = [
    p('התקבלה פנייה חדשה מטופס יצירת הקשר באתר.'),
    definitionTable(rows),
    quoteBlock(escapeHtml(details.message).replaceAll('\n', '<br>')),
    url ? button('פתיחת הפנייה בניהול', url) : '',
  ].join('');

  return renderBrandedEmail({
    brand,
    // הנושא נושא את שם הפונה: תיבת דואר של צוות ממוינת לפי שורת נושא.
    subject: `פנייה חדשה מהאתר — ${details.name}`,
    preheader: details.subject ?? details.message.slice(0, 90),
    title: 'פנייה חדשה מהאתר',
    body,
    text: [
      'התקבלה פנייה חדשה מטופס יצירת הקשר באתר.',
      ...rows.map((row) => `${row.label}: ${row.value.replace(/<[^>]+>/g, '')}`),
      '',
      details.message,
      url ? `\nפתיחה בניהול: ${url}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  });
}

/** מענה הצוות לפנייה — ה-HTML של המענה כבר עבר sanitize אצל הקורא. */
export async function contactReplyEmail(input: {
  name: string | null;
  subject: string;
  bodyHtml: string;
  /** אותו תוכן כטקסט, לגרסת הטקסט. */
  bodyText: string;
}): Promise<RenderedEmail> {
  const brand = await getEmailBrand();

  const body = [
    p(input.name ? `שלום ${escapeHtml(input.name)},` : 'שלום,'),
    // ה-HTML מוזרם כמות שהוא: הוא נוקה ב-sanitizeHtml לפני שהגיע לכאן
    // (ראו messages-actions.ts), ובריחה נוספת הייתה מציגה תגיות כטקסט.
    `<div style="font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:15px;line-height:1.75;color:#3d382f">${input.bodyHtml}</div>`,
    divider(),
    p('מענה זה נשלח מצוות המכון בהמשך לפנייתכם באתר. אפשר להשיב להודעה הזו.', {
      small: true,
      muted: true,
    }),
  ].join('');

  return renderBrandedEmail({
    brand,
    subject: input.subject,
    preheader: input.bodyText.slice(0, 90),
    body,
    text: [input.name ? `שלום ${input.name},` : 'שלום,', '', input.bodyText].join('\n'),
  });
}

/**
 * הזמנת איש צוות לממשק הניהול.
 *
 * הזרימה בפועל (ראו team-actions.ts) יוצרת את המשתמש עם סיסמה זמנית
 * ולא שולחת קישור הזמנה, ולכן התבנית מציגה את פרטי הכניסה ומדגישה
 * שיש להחליף סיסמה בכניסה הראשונה. הסיסמה מוצגת ב-LTR ובגופן קבוע-
 * רוחב: סיסמה אקראית שמוצגת ב-RTL נקראת בסדר הפוך ומוקלדת שגוי.
 */
export async function teamInviteEmail(input: {
  name?: string | null;
  email: string;
  password: string;
  roleLabel: string;
  loginUrl: string;
}): Promise<RenderedEmail> {
  const brand = await getEmailBrand();
  const url = safeUrl(input.loginUrl);
  const greeting = input.name ? `שלום ${escapeHtml(input.name)},` : 'שלום,';

  const body = [
    p(greeting),
    p(`נוצר עבורכם חשבון צוות באתר ${escapeHtml(brand.siteName)}.`),
    definitionTable([{ label: 'תפקיד', value: escapeHtml(input.roleLabel) }]),
    h('פרטי הכניסה הראשונית'),
    `<div dir="ltr" style="margin:0 0 18px;padding:14px 18px;background:#f3ede0;border-radius:8px;text-align:left;font-family:'SFMono-Regular',Consolas,'Courier New',monospace;font-size:14px;line-height:1.9;color:#1f1c17">
       <strong>${escapeHtml(input.email)}</strong><br>
       <strong>${escapeHtml(input.password)}</strong>
     </div>`,
    noticeBlock('בכניסה הראשונה תתבקשו להחליף את הסיסמה. אין להעביר את הפרטים האלה הלאה.'),
    url ? button('כניסה לממשק הניהול', url) : '',
    p('אם לא ציפיתם להזמנה הזו — אפשר להתעלם ממנה.', { small: true, muted: true }),
  ].join('');

  return renderBrandedEmail({
    brand,
    subject: `הזמנה לצוות ${brand.siteName}`,
    preheader: 'פרטי הכניסה הראשונית לממשק הניהול.',
    title: 'הזמנה לצוות',
    body,
    text: [
      greeting,
      `נוצר עבורכם חשבון צוות באתר ${brand.siteName} בתפקיד ${input.roleLabel}.`,
      '',
      'פרטי הכניסה הראשונית:',
      input.email,
      input.password,
      '',
      'בכניסה הראשונה תתבקשו להחליף את הסיסמה.',
      url ? `כניסה: ${url}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
  });
}
