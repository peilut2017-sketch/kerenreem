/**
 * מפרט המהדורה כרשת אייקונים ולא כטבלת שורות.
 *
 * אלה נתונים שקוראים בסריקה ("כמה זה שוקל", "איזו כריכה"), לא ברצף —
 * טבלה אנכית מכריחה את העין לרדת שורה-שורה כדי למצוא פריט אחד. אייקון
 * לכל סוג נתון נותן עוגן חזותי שמאפשר לקפוץ ישר לנכון.
 */

const ICONS: Record<string, string> = {
  weight: 'M6 7h8l1.5 8.5a1 1 0 0 1-1 1.2h-9a1 1 0 0 1-1-1.2L6 7Zm4-3.5a1.6 1.6 0 1 1 0 3.2 1.6 1.6 0 0 1 0-3.2Z',
  size: 'M3.5 6.5h13v7h-13zM6.5 6.5v7M13.5 6.5v7',
  isbn: 'M4 5v10M6.5 5v10M9 5v10M11.5 5v10M14 5v10M16 5v10',
  binding: 'M4.5 4.5h7a2 2 0 0 1 2 2v9a1.6 1.6 0 0 0-1.6-1.6H4.5zM13.5 6.5h2v9h-2',
  language: 'M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 0c-2 2-2 11 0 13m0-13c2 2 2 11 0 13M3.7 8h12.6M3.7 12h12.6',
  pages: 'M5 4h7l3 3v9H5zM12 4v3h3',
  publisher: 'M4.5 16.5v-11l5.5-2 5.5 2v11M4.5 16.5h11M7.5 8h2M10.5 8h2M7.5 11h2M10.5 11h2',
  edition: 'M4 6.5 10 4l6 2.5-6 2.5-6-2.5Zm0 3.5 6 2.5 6-2.5m-12 3.5 6 2.5 6-2.5',
};

export interface SpecItem {
  icon: keyof typeof ICONS | string;
  label: string;
  value: string;
}

export function SpecGrid({ items }: { items: SpecItem[] }) {
  if (items.length === 0) return null;

  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col items-center gap-2 text-center">
          <span aria-hidden="true" className="icon-chip h-10 w-10">
            <svg viewBox="0 0 20 20" className="h-[1.15rem] w-[1.15rem]" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d={ICONS[item.icon] ?? ICONS.pages} />
            </svg>
          </span>
          <dd className="text-small leading-tight text-ink" dir="auto">
            {item.value}
          </dd>
          <dt className="text-caption text-muted">{item.label}</dt>
        </div>
      ))}
    </dl>
  );
}
