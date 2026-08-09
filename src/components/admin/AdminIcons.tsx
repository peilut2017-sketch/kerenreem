/**
 * ערכת אייקונים לכרום של ממשק הניהול — קווית, במשקל אחיד, כמו Icon.tsx
 * הציבורי, אבל קובץ נפרד ומכוון: Icon.tsx משרת שדה תוכן שנערך ב-CMS
 * (activities.icon), והשמות שם הם חוזה עם המסד. האייקונים כאן הם כרום
 * קבוע של הממשק עצמו — ניווט, פעולות שורה, תגי סטטוס — ואינם נשלטים
 * משום שדה במסד, ולכן לא שייכים לאותה רשימה.
 */

export type AdminIconName =
  | 'dashboard'
  | 'books'
  | 'authors'
  | 'categories'
  | 'series'
  | 'tags'
  | 'events'
  | 'activities'
  | 'pages'
  | 'messages'
  | 'settings'
  | 'diagnostics'
  | 'banners'
  | 'analytics'
  | 'store'
  | 'orders'
  | 'inventory'
  | 'shipping'
  | 'coupon'
  | 'team'
  | 'finance'
  | 'warehouse'
  | 'transfer'
  | 'edit'
  | 'view'
  | 'external'
  | 'trash'
  | 'check'
  | 'x'
  | 'plus'
  | 'chevron-down'
  | 'search'
  | 'columns'
  | 'back'
  | 'image'
  | 'list'
  | 'globe'
  | 'upload'
  | 'list-bullet'
  | 'list-numbered'
  | 'quote'
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'align-justify'
  | 'highlighter'
  | 'link'
  | 'video'
  | 'undo'
  | 'table'
  | 'print';

const PATHS: Record<AdminIconName, React.ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  books: (
    <>
      <path d="M4 4.5c0-.8.7-1.5 1.5-1.5H10v18H5.5A1.5 1.5 0 0 1 4 19.5v-15Z" />
      <path d="M20 4.5c0-.8-.7-1.5-1.5-1.5H14v18h4.5a1.5 1.5 0 0 0 1.5-1.5v-15Z" />
      <path d="M10 3h4v18h-4Z" />
    </>
  ),
  authors: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7" />
    </>
  ),
  categories: (
    <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h4.4c.5 0 1 .2 1.3.6l1.4 1.4c.3.4.8.6 1.3.6h5.6A2.5 2.5 0 0 1 22 9.1v8.4a2.5 2.5 0 0 1-2.5 2.5H5.5A2.5 2.5 0 0 1 3 17.5v-11Z" />
  ),
  series: (
    <>
      <path d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path d="M3 12l9 5 9-5" />
      <path d="M3 16l9 5 9-5" />
    </>
  ),
  tags: (
    <>
      <path d="M11.6 3H5a2 2 0 0 0-2 2v6.6c0 .5.2 1 .6 1.4l8.8 8.8c.8.8 2 .8 2.8 0l6.6-6.6c.8-.8.8-2 0-2.8L12.9 3.6a2 2 0 0 0-1.4-.6Z" />
      <circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  events: (
    <>
      <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17M8 3v3M16 3v3" />
    </>
  ),
  activities: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15 9-4.2 2-1.8 4.2 4.2-2 1.8-4.2Z" />
    </>
  ),
  pages: (
    <>
      <path d="M6.5 3.5h7l4 4v12.5a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5 20V5a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M13.5 3.5v4h4M8 12.5h8M8 16h8M8 9h3" />
    </>
  ),
  messages: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6 8 6.5L19.5 6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.5 1.5M7.1 16.9l-1.5 1.5M18.4 18.4l-1.5-1.5M7.1 7.1 5.6 5.6" />
    </>
  ),
  diagnostics: (
    <>
      <path d="M3 12h4l2-7 4 14 2-7h4" />
    </>
  ),
  banners: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 16 5-4.5 4 3 4-5 4 3.5" />
      <circle cx="8" cy="9" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  analytics: (
    <>
      <path d="M4 20V4M4 20h16" />
      <rect x="7.5" y="12" width="3" height="8" />
      <rect x="12.5" y="8" width="3" height="12" />
      <rect x="17.5" y="14" width="3" height="6" />
    </>
  ),
  store: (
    <>
      <path d="M4 9.5 5 4h14l1 5.5" />
      <path d="M4 9.5a2.5 2.5 0 0 0 5 .3 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5-.3" />
      <path d="M5.5 9.5V20h13V9.5" />
      <path d="M10 20v-5.5h4V20" />
    </>
  ),
  // הזמנות — תעודת משלוח עם וי
  orders: (
    <>
      <path d="M6 3.5h9l3.5 3.5v12A1.5 1.5 0 0 1 17 20.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5Z" />
      <path d="M14.5 3.5V7.5h4" />
      <path d="m8 13 2.2 2.2L15 10.5" />
    </>
  ),
  // מלאי — ערימת ארגזים
  inventory: (
    <>
      <rect x="3.5" y="12.5" width="8" height="8" rx="1" />
      <rect x="12.5" y="12.5" width="8" height="8" rx="1" />
      <rect x="8" y="3.5" width="8" height="8" rx="1" />
      <path d="M12 3.5v3M7.5 12.5v3M16.5 12.5v3" />
    </>
  ),
  // משלוחים — משאית
  shipping: (
    <>
      <path d="M2.5 6.5h11v10h-11Z" />
      <path d="M13.5 9.5h4l3 3.5v3.5h-7" />
      <circle cx="6.5" cy="18.5" r="1.8" />
      <circle cx="16.5" cy="18.5" r="1.8" />
    </>
  ),
  // קופון — כרטיס עם ניקוב
  coupon: (
    <>
      <path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a2.5 2.5 0 0 0 0 5V16a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a2.5 2.5 0 0 0 0-5Z" />
      <path d="M13.5 6v2M13.5 11v2M13.5 16v2" strokeDasharray="0.1 3" />
    </>
  ),
  // צוות — שני אנשים
  team: (
    <>
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3 19.5c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
      <circle cx="16.8" cy="9.5" r="2.4" />
      <path d="M16 14.2c2.9.2 5 2.3 5 5.3" />
    </>
  ),
  // כספים — מטבעות
  finance: (
    <>
      <ellipse cx="9" cy="6.5" rx="6" ry="2.8" />
      <path d="M3 6.5v5c0 1.5 2.7 2.8 6 2.8s6-1.3 6-2.8v-5" />
      <path d="M3 11.5v5c0 1.5 2.7 2.8 6 2.8 1.2 0 2.3-.2 3.2-.5" />
      <circle cx="17" cy="16" r="4.2" />
      <path d="M17 14v4M15.5 15.2h3" />
    </>
  ),
  // מחסן — מבנה עם מדפים
  warehouse: (
    <>
      <path d="M3 20V9l9-5 9 5v11" />
      <path d="M7 20v-7h10v7" />
      <path d="M7 16.5h10M12 13v7" />
    </>
  ),
  // העברה בין מיקומים — חצים דו-כיווניים
  transfer: (
    <>
      <path d="M8 7h12M17 4l3 3-3 3" />
      <path d="M16 17H4M7 14l-3 3 3 3" />
    </>
  ),
  edit: (
    <>
      <path d="m14 5 5 5-9.5 9.5H4v-4.5L14 5Z" />
      <path d="m12 7 5 5" />
    </>
  ),
  view: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  external: (
    <>
      <path d="M9 5h-3.5A1.5 1.5 0 0 0 4 6.5v12A1.5 1.5 0 0 0 5.5 20h12a1.5 1.5 0 0 0 1.5-1.5V15" />
      <path d="M13.5 4h6.5v6.5" />
      <path d="M20 4 11 13" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 6.5h15" />
      <path d="M8 6.5V5a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 16 5v1.5" />
      <path d="M6.5 6.5 7.3 19a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4l.8-12.5" />
      <path d="M10 10.5v6M14 10.5v6" />
    </>
  ),
  check: <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />,
  x: <path d="M5 5l14 14M19 5 5 19" />,
  plus: <path d="M12 4.5v15M4.5 12h15" />,
  'chevron-down': <path d="m5 8 7 7 7-7" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.5-4.5" />
    </>
  ),
  columns: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M9.5 4v16M15.5 4v16" />
    </>
  ),
  back: <path d="M15 5 8 12l7 7" />,
  image: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.6" />
      <path d="m4 17 5-5 4 3.5L18 10l3 4" />
    </>
  ),
  list: (
    <>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <circle cx="4.3" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.3" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="4.3" cy="17.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.4 3.8 5.3 3.8 8.5s-1.3 6.1-3.8 8.5c-2.5-2.4-3.8-5.3-3.8-8.5S9.5 5.9 12 3.5Z" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15.5V4M7.5 8.5 12 4l4.5 4.5" />
      <path d="M4.5 15.5v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
    </>
  ),
  'list-bullet': (
    <>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <circle cx="4.3" cy="6.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="4.3" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="4.3" cy="17.5" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  'list-numbered': (
    <>
      <path d="M9 6.5h11M9 12h11M9 17.5h11" />
      <path d="M3.3 5.5h1v2.5M3.3 8h1.6M3.1 12.2c0-.7.6-1.2 1.3-1.2s1.3.5 1.3 1.1c0 .5-.3.8-.7 1.1l-1.7 1.4h2.4M3.1 16.8h1.4c.6 0 1.1.4 1.1.9s-.5.9-1.1.9h-.3M3.1 19.4h1.4c.6 0 1.1-.4 1.1-.9" />
    </>
  ),
  quote: (
    <>
      <path d="M7 8.5c-2 .8-3 2.4-3 4.4 0 1.7 1.1 2.9 2.6 2.9S9 14.7 9 13.2C9 11.8 8 11 7 11c-.1 0-.3 0-.4.1C7 9.9 8 9 9.5 8.3L7 8.5Z" fill="currentColor" stroke="none" />
      <path d="M16 8.5c-2 .8-3 2.4-3 4.4 0 1.7 1.1 2.9 2.6 2.9S18 14.7 18 13.2c0-1.4-1-2.2-2-2.2-.1 0-.3 0-.4.1C16 9.9 17 9 18.5 8.3L16 8.5Z" fill="currentColor" stroke="none" />
    </>
  ),
  'align-left': (
    <>
      <path d="M4 6h16M4 11h10M4 16h13M4 21h7" strokeWidth="1.8" />
    </>
  ),
  'align-center': (
    <>
      <path d="M4 6h16M7 11h10M5.5 16h13M8 21h8" strokeWidth="1.8" />
    </>
  ),
  'align-right': (
    <>
      <path d="M4 6h16M10 11h10M7 16h13M13 21h7" strokeWidth="1.8" />
    </>
  ),
  'align-justify': (
    <>
      <path d="M4 6h16M4 11h16M4 16h16M4 21h16" strokeWidth="1.8" />
    </>
  ),
  highlighter: (
    <>
      <path d="m8 15 6.5-6.5 3 3L11 18l-4.5 1.2L8 15Z" />
      <path d="m11.5 8.5-2-2 2.5-2.5a2 2 0 0 1 2.8 0l1.2 1.2a2 2 0 0 1 0 2.8L13.5 10" />
      <path d="M4 21h6" />
    </>
  ),
  link: (
    <>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M11 6.5 13 4.5a3.5 3.5 0 0 1 5 5l-2 2" />
      <path d="M13 17.5 11 19.5a3.5 3.5 0 0 1-5-5l2-2" />
    </>
  ),
  video: (
    <>
      <rect x="3" y="5.5" width="13" height="13" rx="2" />
      <path d="m16 10 5-2.5v9L16 14Z" strokeLinejoin="round" />
    </>
  ),
  undo: (
    <>
      <path d="M7 8H16a5 5 0 0 1 0 10h-5" />
      <path d="m7 8 4-4M7 8l4 4" />
    </>
  ),
  table: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M3.5 14.5h17M9.5 4.5v15" />
    </>
  ),
  print: (
    <>
      <path d="M7 8.5V3.5h10v5" />
      <rect x="3.5" y="8.5" width="17" height="8" rx="1.5" />
      <path d="M7 14.5h10v6H7z" />
    </>
  ),
};

export function AdminIcon({
  name,
  className = 'h-4 w-4',
}: {
  name: AdminIconName;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
