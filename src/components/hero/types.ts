export type HeroSlideKind = 'book' | 'event' | 'activity';

export interface HeroSlide {
  id: string;
  kind: HeroSlideKind;
  /** תווית קטנה מעל הכותרת: "ספר חדש", "אירוע", "פעילות הקרן" */
  eyebrow: string;
  title: string;
  /** שורה או שתיים. לא פסקה. */
  summary: string | null;
  href: string;
  ctaLabel: string;
  imageUrl: string | null;
  /** טקסט חלופי לתמונה; ריק כשהיא דקורטיבית בלבד */
  imageAlt: string;
}
