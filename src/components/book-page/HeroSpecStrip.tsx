/**
 * פס המפרט שמתחת לכותרת ב-Hero: ערך גדול מעל, תווית קטנה מתחת, קו
 * מפריד אנכי בין הפריטים.
 *
 * זה לא אותו מידע כמו טבלת "פרטי המהדורה" המלאה שבהמשך העמוד — כאן רק
 * ארבעת הנתונים שקורא רוצה לדעת לפני שהוא מחליט אם להמשיך לקרוא בכלל
 * (מי כתב, על מה, מתי, כמה עמודים). מפרט מלא ב-Hero הופך אותו לטבלה.
 */
export function HeroSpecStrip({ items }: { items: { label: string; value: string }[] }) {
  if (items.length === 0) return null;

  return (
    <dl className="flex flex-wrap items-stretch justify-center gap-x-6 gap-y-4 border-y border-rule/70 py-4 lg:justify-start">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={`flex flex-col items-center gap-0.5 lg:items-start ${
            index > 0 ? 'border-rule ps-6 lg:border-s' : ''
          }`}
        >
          <dd className="font-serif text-[1.05rem] leading-tight text-ink">{item.value}</dd>
          <dt className="text-caption text-muted">{item.label}</dt>
        </div>
      ))}
    </dl>
  );
}
