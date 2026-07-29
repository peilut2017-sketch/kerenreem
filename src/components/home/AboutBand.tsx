import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Ornament } from '../Ornament';
import { Reveal } from '../Reveal';

/**
 * רצועת האודות: צילום בצד אחד, טקסט קצר בצד השני.
 *
 * הטקסט מוגבל לכמה שורות בכוונה — זהו פתח לעמוד האודות ולא תחליף לו.
 * כשאין צילום, הטקסט תופס את מלוא הרוחב במקום להשאיר חצי עמוד ריק.
 */
export async function AboutBand({
  excerpt,
  imageUrl,
}: {
  excerpt: string;
  imageUrl: string | null;
}) {
  const t = await getTranslations();

  return (
    <section className="relative bg-cream-2">
      <div className={`grid items-stretch ${imageUrl ? 'lg:grid-cols-2' : ''}`}>
        {imageUrl ? (
          <div className="relative min-h-[16rem] lg:min-h-[30rem]">
            <Image
              src={imageUrl}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
        ) : null}

        <Reveal
          as="div"
          className="flex flex-col items-center justify-center px-6 py-16 text-center sm:px-12 lg:py-24"
        >
          <p className="eyebrow">{t('home.aboutLead')}</p>
          <h2 className="mt-3 font-serif text-[clamp(1.625rem,3.4vw,2.25rem)] text-ink">
            {t('home.aboutTitle')}
          </h2>
          <Ornament />

          <p className="mt-7 max-w-[52ch] text-body leading-[1.9] text-ink-soft">{excerpt}</p>

          <p className="mt-8">
            <Link href="/about" className="link-more">
              {t('home.aboutMore')}
            </Link>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
