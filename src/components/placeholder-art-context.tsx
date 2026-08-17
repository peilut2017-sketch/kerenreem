'use client';

import { createContext, useContext } from 'react';

/**
 * [1.12] תמונות הבסיס לספרים חסרי-תמונה: כריכת עור גנרית ושדרת עור
 * גנרית שמועלות פעם אחת בניהול ← הגדרות ← תמונות בסיס לספרים
 * (site_settings.extra.book_base_cover_url / book_base_spine_url).
 *
 * מסופק ברמת פריסת האתר הציבורי, כך ש-BookCoverPlaceholder (קטלוג,
 * עמוד ספר) ו-Spine (מדף עמוד הבית) ניגשים אליו בלי שכל עמוד יעביר
 * אותו כ-prop. captionLabel מגיע מתורגם מהשרת — הרכיבים עצמם אינם
 * תלויים ב-intl provider, ולכן בטוחים גם בתצוגות ניהול.
 */
export interface PlaceholderArt {
  coverUrl: string | null;
  spineUrl: string | null;
  /** "תמונת המחשה" — הכיתוב המוקטן שמבהיר שאין זו הכריכה האמיתית. */
  captionLabel: string;
}

const EMPTY: PlaceholderArt = { coverUrl: null, spineUrl: null, captionLabel: 'תמונת המחשה' };

const PlaceholderArtContext = createContext<PlaceholderArt>(EMPTY);

export function PlaceholderArtProvider({
  value,
  children,
}: {
  value: PlaceholderArt;
  children: React.ReactNode;
}) {
  return <PlaceholderArtContext.Provider value={value}>{children}</PlaceholderArtContext.Provider>;
}

export function usePlaceholderArt(): PlaceholderArt {
  return useContext(PlaceholderArtContext);
}
