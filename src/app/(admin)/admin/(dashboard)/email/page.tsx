import { requireScreenPermission } from '@/lib/admin/auth';
import { getEmailConfigStatus } from '@/lib/admin/email-actions';
import { AdminHeader } from '@/components/admin/AdminList';
import { EmailTester } from '@/components/admin/EmailTester';

export const dynamic = 'force-dynamic';

/**
 * [1.40] "דואר יוצא" — מצב ההגדרה של שירות הדואר, ותצוגה מקדימה/שליחת
 * בדיקה לכל תבנית.
 *
 * מסך מנהל-על בלבד (ADMIN_ONLY_SCREENS, screens.ts): הוא חושף את כתובת
 * השולח ואת תיבת ההתראות של הצוות, ומאפשר לשלוח דואר מהדומיין של המכון
 * לכל כתובת שתוקלד בו.
 */
export default async function AdminEmailPage() {
  const session = await requireScreenPermission('email', 'view');
  const status = await getEmailConfigStatus();

  return (
    <>
      <AdminHeader
        title="דואר יוצא"
        description="כל ההודעות שהאתר שולח — אישור קבלת פנייה, איפוס סיסמה, הזמנת איש צוות ואישורי הזמנה — יוצאות באותה מעטפת מותגת: לוגו האתר, רצועת הזהות ופרטי המכון בתחתית."
      />

      {/* מצב ההגדרה קודם לכל השאר: בלי ספק דואר מוגדר, שום דבר במסך
          הזה לא יישלח — ועדיף לומר את זה מראש מאשר להשאיר את המנהל
          לגלות זאת מהודעת שגיאה אחרי ניסיון שליחה. */}
      <div className="admin-card mb-6 p-4">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="admin-field-label">שירות הדואר</dt>
            <dd className="mt-1">
              {status.providerConfigured ? (
                <span className="admin-badge admin-badge-success">
                  <span className="admin-badge-dot" aria-hidden="true" />
                  מוגדר
                </span>
              ) : (
                <span className="admin-badge admin-badge-danger">
                  <span className="admin-badge-dot" aria-hidden="true" />
                  לא מוגדר — חסר RESEND_API_KEY
                </span>
              )}
            </dd>
          </div>
          {/* ‏[1.41] שתי כתובות שולח ולא אחת: דואר אוטומטי יוצא
              מ-no-reply@ ומענה אנושי לפנייה מ-contact@. ההפרדה מוצגת
              כאן כדי שלא יצטרכו לקרוא קוד כדי לדעת מה יוצא מאיפה. */}
          <div>
            <dt className="admin-field-label">דואר אוטומטי נשלח מ־</dt>
            <dd dir="ltr" className="mt-1 text-start text-small text-ink">
              {status.automatedFrom}
            </dd>
            <span className="admin-field-hint">
              איפוס סיסמה, אישורי הזמנה, אישור פנייה, הזמנת איש צוות. איפוס סיסמה נשלח
              בלי כתובת מענה בכלל; שאר ההודעות האוטומטיות מפנות מענה אל {status.replyTo}.
            </span>
          </div>
          <div>
            <dt className="admin-field-label">מענה אנושי לפנייה נשלח מ־</dt>
            <dd dir="ltr" className="mt-1 text-start text-small text-ink">
              {status.humanFrom}
            </dd>
            <span className="admin-field-hint">
              תיבה שאפשר להשיב אליה. התראה על פנייה חדשה שנשלחת לצוות מפנה מענה אל כתובת
              הפונה עצמו, כך ש״השב״ עונה לו ישירות.
            </span>
          </div>
          <div>
            <dt className="admin-field-label">התראות על פניות חדשות</dt>
            <dd dir="ltr" className="mt-1 text-start text-small text-ink">
              {status.staffInbox ?? '—'}
            </dd>
            <span className="admin-field-hint">
              ברירת המחדל היא כתובת יצירת הקשר שבהגדרות האתר. אפשר לקבוע כתובת ייעודית
              במשתנה הסביבה SITE_NOTIFICATIONS_EMAIL.
            </span>
          </div>
          <div>
            <dt className="admin-field-label">כתובת האתר בקישורים</dt>
            <dd dir="ltr" className="mt-1 text-start text-small text-ink">
              {status.siteUrl || '—'}
            </dd>
            <span className="admin-field-hint">
              נלקחת מ-NEXT_PUBLIC_SITE_URL. כתובת שגויה כאן שולחת את הנמענים לכתובת הלא נכונה.
            </span>
          </div>
        </dl>
      </div>

      <EmailTester defaultTo={session.email ?? ''} />
    </>
  );
}
