import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/Container';
import { getCommerceFlags } from '@/lib/commerce/settings';
import { getCustomerSession } from '@/lib/commerce/account';

export const dynamic = 'force-dynamic';

/**
 * [1.6] שומר משותף לכל אזור הלקוח המחובר (ט.2, ביקורת ב.28/ב.29: הבדיקה
 * הזו הייתה משוכפלת בארבעה עמודים). login/page.tsx נשאר סיבלינג *מחוץ*
 * לקבוצה הזו בכוונה — הוא היעד של ההפניה כשאין session, וקבוצת נתיב לא
 * משנה כתובות (אותו דפוס בדיוק כמו admin/(dashboard) מול admin/orders/print
 * בצד הניהול: guard+chrome בקבוצה, נתיבים ללא guard כסיבלינג).
 */
export default async function AccountGuardedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const flags = await getCommerceFlags();
  const t = await getTranslations('store');
  if (!flags.accountsEnabled) {
    return (
      <Container className="py-20 text-center">
        <p className="text-lead text-muted">{t('disabled')}</p>
      </Container>
    );
  }

  const session = await getCustomerSession();
  if (!session) redirect('/account/login');

  return <Container className="max-w-3xl py-12 lg:py-16">{children}</Container>;
}
