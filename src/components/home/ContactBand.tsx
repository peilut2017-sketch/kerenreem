import { Img as Image } from '@/components/Img';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Ornament } from '../Ornament';
import type { SiteContact } from '@/lib/supabase/types';

/**
 * רצועת יצירת הקשר בעמוד הבית: פרטי התקשרות בלבד, עם קישור לטופס
 * המלא בעמוד "צור קשר". הטופס עצמו קיים במקום אחד בלבד — כפילות שני
 * טפסים לאותה פעולה מבלבלת יותר משהיא נוחה.
 */
export async function ContactBand({
  contact,
  backdropUrl,
  locale,
}: {
  contact: SiteContact;
  backdropUrl: string | null;
  locale: string;
}) {
  const t = await getTranslations();
  const address = locale === 'en' ? contact.address_en || contact.address_he : contact.address_he;

  return (
    <section className="on-dark relative isolate overflow-hidden py-20 lg:py-24">
      {backdropUrl ? (
        <div className="media-backdrop absolute inset-0 -z-10">
          <Image src={backdropUrl} alt="" fill sizes="100vw" className="object-cover" />
          <div className="absolute inset-0 bg-navy/88" />
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-[42rem] px-5 text-center sm:px-8">
        <p className="eyebrow">{t('contact.lead')}</p>
        <h2 className="mt-3 font-serif text-[clamp(1.625rem,3.4vw,2.25rem)] text-white">
          {t('contact.title')}
        </h2>
        <Ornament />

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {contact.phone ? (
            <ContactLine label={t('contact.phoneLabel')} icon={<PhoneIcon />}>
              <a href={`tel:${contact.phone.replace(/[^+\d]/g, '')}`} className="link" dir="ltr">
                {contact.phone}
              </a>
            </ContactLine>
          ) : null}

          {contact.email ? (
            <ContactLine label={t('contact.emailLabel')} icon={<MailIcon />}>
              <a href={`mailto:${contact.email}`} className="link" dir="ltr">
                {contact.email}
              </a>
            </ContactLine>
          ) : null}

          {address ? (
            <ContactLine label={t('contact.address')} icon={<PinIcon />}>
              {address}
            </ContactLine>
          ) : null}
        </div>

        <p className="mt-10">
          <Link href="/contact" className="btn btn-solid">
            {t('contact.goToForm')}
          </Link>
        </p>
      </div>
    </section>
  );
}

/**
 * האייקון כאן נושא מידע — הוא מבחין בין טלפון, דואר וכתובת במבט אחד.
 * התווית הטקסטואלית מוסתרת חזותית (sr-only) כי בשורה ממורכזת היא
 * כפילות של האייקון; קוראי מסך עדיין מקבלים אותה.
 */
function ContactLine({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-2.5 text-small text-cream-2">
      <span aria-hidden="true" className="text-gold">
        {icon}
      </span>
      <span className="sr-only">{label}: </span>
      {children}
    </span>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-[1.15rem] w-[1.15rem]" fill="none" aria-hidden="true">
      <path
        d="M6.5 3h-3v3c0 6.1 4.4 10.5 10.5 10.5h3v-3l-3.5-1.5-2 2A11.6 11.6 0 0 1 6 8.5l2-2L6.5 3Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-[1.15rem] w-[1.15rem]" fill="none" aria-hidden="true">
      <rect x="2.5" y="4.5" width="15" height="11" stroke="currentColor" strokeWidth="1.3" />
      <path d="m2.5 5.5 7.5 5 7.5-5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-[1.15rem] w-[1.15rem]" fill="none" aria-hidden="true">
      <path
        d="M10 17.5s5.5-5 5.5-9a5.5 5.5 0 1 0-11 0c0 4 5.5 9 5.5 9Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <circle cx="10" cy="8.5" r="2" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}
