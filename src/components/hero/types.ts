export type HeroSlideKind = 'book' | 'event' | 'activity' | 'banner';

export type FocalPoint = 'center' | 'top' | 'bottom' | 'start' | 'end';

export interface HeroSlide {
  id: string;
  kind: HeroSlideKind;
  /** תווית קטנה מעל הכותרת */
  eyebrow: string;
  title: string;
  /** שורה או שתיים. לא פסקה. */
  summary: string | null;
  href: string | null;
  ctaLabel: string | null;
  imageUrl: string | null;
  /** גרסה אנכית לנייד. בהיעדרה נחתכת התמונה הרחבה לפי focalPoint. */
  imageMobileUrl?: string | null;
  focalPoint?: FocalPoint;
  /** טקסט חלופי; ריק כשהתמונה דקורטיבית */
  imageAlt: string;
}
