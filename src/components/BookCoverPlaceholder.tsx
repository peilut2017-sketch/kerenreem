/**
 * [1.10] ברירת המחדל לספר בלי כריכה שהועלתה: כריכה גנרית — לא ריבוע
 * ריק, לא "אין תמונה". גוון כהה (נייבי) כמו כריכת עור, מסגרת זהב כפולה
 * דקה כמו הטבעה, ושם הספר מוטבע עליה בזהב. ה"הטבעה" היא טריק
 * text-shadow פשוט — צל כהה מתחת ליצירת עומק, הבהרה עדינה מעל ליצירת
 * מקור אור — לא תמונה שנוצרה מראש (ראו האזהרה על טקסט עברי ב-AI, ליד
 * hero_mockup_url ב-BookForm).
 */
export function BookCoverPlaceholder({ title, className = '' }: { title: string; className?: string }) {
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
