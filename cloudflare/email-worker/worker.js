/**
 * Email Worker של Cloudflare — קולט תשובות צוות לפניות ומעביר אותן לאתר.
 *
 * מדביקים ב-Cloudflare ← Workers & Pages ← Create ← Worker ← Edit code
 * (או מפעילים עם wrangler). הוראות מלאות: docs/inbound-email.md.
 *
 * מה הוא עושה, לכל מייל שמגיע ל-contact@kerenreem.org:
 *   • כתובת פנייה חתומה (contact+i<מזהה>.<חתימה>@…) → POST לאתר, שם
 *     התשובה נשלחת לפונה ונשמרת בשרשור הפנייה.
 *   • כל מייל אחר ל-contact@ → מועבר לתיבת הצוות, כמו שהיה לפני כן.
 *   • כל כשל בקליטה → המייל המקורי מועבר לתיבת הגיבוי. תשובה של צוות
 *     לעולם לא נעלמת בשקט.
 *
 * משתני Worker (Settings ← Variables):
 *   INBOUND_URL     למשל https://www.kerenreem.org.il/api/email/inbound
 *   INBOUND_SECRET  (Secret) אותו ערך כמו INBOUND_EMAIL_SECRET באתר
 *   STAFF_INBOX     תיבת הצוות — כתובת יעד מאומתת ב-Email Routing
 *   FALLBACK_TO     (רשות) תיבת גיבוי לכשל; ברירת מחדל: STAFF_INBOX
 *
 * ללא תלויות: הפענוח של ה-MIME נעשה באתר, לא כאן.
 */

// תואם את הצורה ש-lib/email/inquiry-thread.ts מייצר.
const INQUIRY_ADDRESS = /^contact\+i[0-9a-f]{32}\.[0-9a-f]{12}@/i;

// ‏Vercel מגביל גוף בקשה ל-4.5MB (ראו api/email/inbound/route.ts).
const MAX_BYTES = 4 * 1024 * 1024;

const worker = {
  async email(message, env) {
    const fallback = env.FALLBACK_TO || env.STAFF_INBOX;

    if (!INQUIRY_ADDRESS.test(message.to)) {
      await message.forward(env.STAFF_INBOX);
      return;
    }

    try {
      if (message.rawSize > MAX_BYTES) throw new Error(`message too large: ${message.rawSize}`);

      const raw = await new Response(message.raw).arrayBuffer();
      const response = await fetch(env.INBOUND_URL, {
        method: 'POST',
        headers: {
          'content-type': 'message/rfc822',
          'x-inbound-secret': env.INBOUND_SECRET,
          'x-envelope-to': message.to,
        },
        body: raw,
      });

      // 200 = נקלט (או כפילות). כל דבר אחר = לא נשלח לפונה → גיבוי.
      if (!response.ok) throw new Error(`inbound responded ${response.status}`);
    } catch (error) {
      console.error('inbound failed, forwarding to fallback:', String(error));
      await message.forward(fallback);
    }
  },
};

export default worker;
