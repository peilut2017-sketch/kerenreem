'use client';

import { Img as Image } from '@/components/Img';
import { usePlaceholderArt } from './placeholder-art-context';

/**
 * [1.10] ברירת המחדל לספר בלי כריכה שהועלתה — לא ריבוע ריק, לא "אין
 * תמונה".
 *
 * [1.12] כשהועלתה תמונת בסיס בהגדרות (ניהול ← הגדרות ← תמונות בסיס
 * לספרים) — כריכת העור הגנרית משמשת רקע, שם הספר מוטבע עליה בגוון זהב
 * ובגופן תורני (David Libre) בתוך הקשת, וכיתוב מוקטן בתחתית מבהיר שזו
 * תמונת המחשה. בלי תמונת בסיס — הכריכה הגנרית המצוירת (נייבי + מסגרת
 * זהב) נשארת כפי שהייתה.
 *
 * ה"הטבעה" היא טריק text-shadow — צל כהה מתחת ליצירת עומק, לא תמונה
 * שנוצרה מראש (ראו האזהרה על טקסט עברי ב-AI ליד hero_mockup_url).
 */
export function BookCoverPlaceholder({ title, className = '' }: { title: string; className?: string }) {
  const { coverUrl, captionLabel } = usePlaceholderArt();

  if (coverUrl) {
    return (
      <div
        className={`relative aspect-3/4 w-full overflow-hidden ${className}`}
        style={{ containerType: 'inline-size' }}
        role="img"
        aria-label={title}
      >
        <Image
          src={coverUrl}
          alt=""
          fill
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 220px"
          className="object-cover"
        />

        {/* שם הספר — ממורכז בתוך קשת הכריכה, זהב מוטבע בגופן תורני */}
        <span
          aria-hidden="true"
          className="absolute inset-x-[27%] bottom-[30%] top-[23%] flex items-center justify-center"
        >
          <span
            className="line-clamp-6 text-center font-bold leading-snug text-gold-bright"
            style={{
              fontFamily: "var(--font-david-libre), 'David Libre', serif",
              fontSize: 'clamp(0.65rem, 6.2cqw, 1.6rem)',
              textShadow: '0 1px 2px rgba(0,0,0,0.8), 0 0 14px rgba(0,0,0,0.35), 0 -1px 0 rgba(255,235,170,0.18)',
            }}
          >
            {title}
          </span>
        </span>

        {/* כיתוב מוקטן — הבהרה שאין זו הכריכה האמיתית של הספר */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 bottom-[2.5%] text-center tracking-wide"
          style={{
            fontSize: 'clamp(0.45rem, 2.8cqw, 0.6rem)',
            color: 'color-mix(in srgb, var(--color-gold) 78%, #fff)',
            opacity: 0.85,
            textShadow: '0 1px 1px rgba(0,0,0,0.7)',
          }}
        >
          {captionLabel}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`relative flex aspect-3/4 w-full items-center justify-center overflow-hidden bg-gradient-to-br from-navy-2 via-navy to-navy-3 ${className}`}
      style={{ containerType: 'inline-size' }}
      role="img"
      aria-label={title}
    >
      <span aria-hidden="true" className="pointer-events-none absolute inset-[7%] border border-gold/30" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-[9.5%] border border-gold/15" />
      <span
        aria-hidden="true"
        className="line-clamp-5 px-[12%] text-center font-serif text-[clamp(0.8rem,5.2cqw,1.35rem)] leading-snug text-gold-bright"
        style={{ textShadow: '0 1px 1px rgba(0,0,0,0.6), 0 -1px 0 rgba(255,255,255,0.14)' }}
      >
        {title}
      </span>
    </div>
  );
}
