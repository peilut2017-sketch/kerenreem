import { getTranslations } from 'next-intl/server';
import { SocialIcon, SOCIAL_NAMES } from './SocialIcon';
import { LegalMenu } from './LegalMenu';
import type { SiteSettings } from '@/lib/supabase/types';

const LEGAL_NAV = [
  { href: '/terms', key: 'terms' },
  { href: '/privacy', key: 'privacy' },
  { href: '/accessibility', key: 'accessibility' },
] as const;

/**
 * פוטר מצומצם: זכויות יוצרים וקרדיט, לחצני הרשתות, ותפריט המידע המשפטי.
 *
 * עמודי הניווט הראשי אינם חוזרים כאן — הם בכותרת העליונה — וגם פרטי הקשר
 * (כתובת/טלפון/דואר) יושבים בעמוד «צור קשר». המידע המשפטי נשאר נגיש מכל
 * עמוד דרך התפריט, כנדרש: תקנון, פרטיות, נגישות והגדרות עוגיות.
 *
 * הריווח בצד ההתחלה (‎sm:ps-[4.5rem]‎ ו-‎pb-16‎ בנייד) משאיר מקום לעמודת הכפתורים
 * הצפים (נגישות / חזרה למעלה) — הם קבועים בפינה, ובפוטר דק היו מכסים את שורת הזכויות.
 */
export async function SiteFooter({ settings }: { settings: SiteSettings; locale: string }) {
  const t = await getTranslations();
  const contact = settings.contact ?? {};
  const social = Object.entries(settings.social_links ?? {}).filter(([, url]) => Boolean(url));

  return (
    <footer className="on-dark mt-auto">
      <div className="mx-auto flex w-full max-w-[82rem] flex-col-reverse items-center gap-4 px-5 pb-16 pt-5 sm:flex-row sm:justify-between sm:px-8 sm:pb-5 sm:ps-[4.5rem]">
        <p className="text-center text-caption text-cream-2/60 sm:text-start">
          © {new Date().getFullYear()} {t('footer.rights')}
          {' · '}
          {contact.registration_number ? `${contact.registration_number} · ` : ''}
          <a
            href="https://smartop-azure.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 transition-colors hover:text-gold"
          >
            {t('footer.credit')}
          </a>
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {/* [1.11] לוגו הרשת במקום שם הרשת כטקסט — SocialIcon.tsx */}
          {social.length > 0 ? (
            <ul className="flex flex-wrap items-center gap-2.5">
              {social.map(([name, url]) => (
                <li key={name}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={SOCIAL_NAMES[name] ?? name}
                    title={SOCIAL_NAMES[name] ?? name}
                    className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-pill)] border border-white/15 text-cream-2/70 transition-all duration-300 hover:-translate-y-0.5 hover:border-gold/60 hover:text-gold motion-reduce:transform-none"
                  >
                    <SocialIcon name={name} className="h-4.5 w-4.5" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}

          <LegalMenu
            label={t('footer.legalHeading')}
            items={LEGAL_NAV.map((item) => ({ href: item.href, label: t(`pages.${item.key}`) }))}
            cookieLabel={t('footer.cookieSettings')}
          />
        </div>
      </div>
    </footer>
  );
}
