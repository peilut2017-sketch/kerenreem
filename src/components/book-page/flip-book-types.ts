import type { ComponentType, CSSProperties, ReactNode, RefAttributes } from 'react';

/**
 * טיפוסים מדויקים ל-react-pageflip.
 *
 * הספרייה עצמה מצהירה על ה-ref כ-`RefAttributes<any>` (ראו
 * build/html-flip-book/index.d.ts), כלומר כל שימוש ב-ref שלה גורר `any`
 * לתוך הקוד שלנו. במקום לפזר `any` בכל קריאה, ה-shape האמיתי מוגדר כאן
 * פעם אחת לפי מה שהספרייה מחזירה בפועל:
 *
 *   useImperativeHandle(ref, () => ({ pageFlip: () => pageFlip.current }))
 *
 * ו-`pageFlip.current` הוא מופע PageFlip של page-flip, שממנו נדרשות כאן
 * רק פעולות הניווט. הרשימה מצומצמת בכוונה למה שבשימוש — הצהרה על API
 * שלם שלא נבדק היא הבטחה שאיש לא אימת.
 */

export type FlipCorner = 'top' | 'bottom';

export interface PageFlipInstance {
  flipNext(corner?: FlipCorner): void;
  flipPrev(corner?: FlipCorner): void;
  turnToPage(pageIndex: number): void;
  getCurrentPageIndex(): number;
  getPageCount(): number;
  getOrientation(): 'portrait' | 'landscape';
}

/** מה שה-ref של HTMLFlipBook חושף בפועל. */
export interface FlipBookRef {
  pageFlip(): PageFlipInstance | undefined;
}

/**
 * IFlipSetting של הספרייה מגדיר את *כל* השדות כחובה, ולכן אי אפשר להשמיט
 * אף אחד מהם. כאן הם נשארים חובה (כדי שהקומפיילר יתפוס השמטה), למעט
 * מאזיני האירועים שהם רשות באמת.
 */
export interface FlipBookProps {
  className: string;
  style: CSSProperties;
  children: ReactNode;
  startPage: number;
  size: 'fixed' | 'stretch';
  width: number;
  height: number;
  minWidth: number;
  maxWidth: number;
  minHeight: number;
  maxHeight: number;
  drawShadow: boolean;
  flippingTime: number;
  usePortrait: boolean;
  startZIndex: number;
  autoSize: boolean;
  maxShadowOpacity: number;
  showCover: boolean;
  mobileScrollSupport: boolean;
  clickEventForward: boolean;
  useMouseEvents: boolean;
  swipeDistance: number;
  showPageCorners: boolean;
  disableFlipByClick: boolean;
  onFlip?: (event: { data: number }) => void;
  onChangeOrientation?: (event: { data: 'portrait' | 'landscape' }) => void;
  /** נורה פעם אחת אחרי האתחול — onChangeOrientation נורה רק על *שינוי*. */
  onInit?: (event: { data: number }) => void;
}

export type FlipBookComponent = ComponentType<FlipBookProps & RefAttributes<FlipBookRef>>;
