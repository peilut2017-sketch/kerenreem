'use client';

import { createContext, useContext } from 'react';

export interface FontChoice {
  label: string;
  value: string;
}

/**
 * [1.11] הגופנים המותקנים (custom_fonts) שזמינים לבורר הגופנים בעורכי
 * הטקסט. מסופק ברמת פריסת הדשבורד — כך RichTextEditor, בכל מקום שבו
 * הוא מורכב, מקבל את הרשימה בלי שכל מסך יעביר אותה כ-prop.
 */
export const CustomFontsContext = createContext<FontChoice[]>([]);

export function CustomFontsProvider({
  fonts,
  children,
}: {
  fonts: FontChoice[];
  children: React.ReactNode;
}) {
  return <CustomFontsContext.Provider value={fonts}>{children}</CustomFontsContext.Provider>;
}

export function useCustomFontChoices(): FontChoice[] {
  return useContext(CustomFontsContext);
}
