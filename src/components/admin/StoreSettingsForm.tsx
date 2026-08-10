'use client';

import { toggleStoreEnabled } from '@/lib/admin/settings-actions';
import { ToggleField, FieldSet } from './Fields';
import type { SiteSettings } from '@/lib/supabase/types';

/**
 * הגדרת הפעלת החנות — טופס נפרד מהגדרות האתר הכלליות, חי תחת "ספרים"
 * כי היא שייכת לקטלוג ולא לזהות הארגון. ראו toggleStoreEnabled בסיבה
 * שהשמירה שלה נפרדת מ-saveSettings הרגילה.
 *
 * [1.5] העמוד נפתח ל-finance (מנהל חנות ומעלה), אבל toggleStoreEnabled
 * דורש admin בכוונה — מתג-על שמדליק/מכבה מחירים וכפתורי רכישה בכל
 * האתר לא אמור להיות ביד מנהל בודד. בלי isAdmin, מנהל היה רואה תיבה
 * פעילה, לוחץ עליה, ומקבל "אין הרשאה" רק אחרי הלחיצה — התיבה כאן
 * מנוטרלת מראש עם הסבר, במקום פקד גלוי שנכשל בשקט.
 *
 * [1.10] שדה יחיד בלי שדות נוספים — הטוגל שומר את עצמו מיד בלחיצה, ואין
 * טעם בטופס וכפתור "שמירה" נפרדים סביבו.
 */
export function StoreSettingsForm({ settings, isAdmin }: { settings: SiteSettings; isAdmin: boolean }) {
  return (
    <FieldSet
      legend="הפעלת החנות"
      description="הפעלת החנות חושפת מחירים וכפתורי רכישה בעמודי הספרים שסומנו כניתנים לרכישה. אין להפעיל לפני חיבור ספק סליקה ופרסום תנאי רכישה, ביטול והחזרים בתקנון."
    >
      <ToggleField
        name="store_enabled"
        label="חנות פעילה"
        defaultChecked={settings.store_enabled}
        disabled={!isAdmin}
        hint={isAdmin ? undefined : 'רק מנהל-על יכול לשנות הגדרה זו.'}
        onToggle={(next) => toggleStoreEnabled(next)}
      />
    </FieldSet>
  );
}
