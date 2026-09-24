'use client';

import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Drawer } from './Drawer';
import {
  countActivePreferences,
  readSitePreferences,
  resetSitePreferences,
  setSiteToggle,
  stepSitePreference,
  STEP_MAX,
  type SiteA11yState,
  type SiteA11yStep,
  type SiteA11yToggle,
} from '@/lib/a11y-preferences';

/**
 * סרגל הנגישות של האתר.
 *
 * ⚠ הסרגל אינו תחליף לנגישות המבנית. ת"י 5568 נבחן על ה-HTML עצמו —
 * תוויות לשדות, מבנה כותרות, ניווט מקלדת, טקסט חלופי וניגודיות. הסרגל
 * הוא שכבת התאמה אישית מעל בסיס שכבר נגיש, וכך גם מנוסחת התקנה.
 *
 * ‏[1.41] נכתב מחדש. עד כה הוא היה חבילת accessibility החיצונית, ושלוש
 * בעיות הצטברו בה:
 *
 *  1. **ארבעה-עשר פריטים ברשימה שטוחה אחת.** בלי קיבוץ, בלי היררכיה,
 *     ובלי הבחנה בין התאמה מדורגת (גודל טקסט) לדו-מצבית (ניגודיות).
 *     חלקם כפולים — "היפוך צבעים" לצד "ניגודיות גבוהה" — וחלקם חסרי
 *     משמעות כאן: היפוך צבעים הפך גם את הכריכות והצילומים לתשליל,
 *     ודיבור-לטקסט נחסם ממילא בכותרת Permissions-Policy של האתר.
 *  2. **העיצוב לא היה שלנו.** הוא הותאם בדיעבד בדריסת משתני CSS שלה
 *     ובתיקון ה-DOM שהיא מזריקה (role, aria-label, Escape, חיבור
 *     כפתור האיפוס שלה להעדפות שלנו) — שכבה על שכבה של תיקונים.
 *  3. **היא הייתה תלות נוספת** בשביל פאנל של עשרה כפתורים.
 *
 * במקומה: פאנל אחד, ארבע קבוצות, על אותו Drawer שמשמש את דיאלוג
 * החיפוש — ולכן לכידת מיקוד, ‏Escape ונעילת גלילה כבר פתורים ובאותו
 * אופן בדיוק כמו בשאר האתר, ולא בקוד נפרד.
 *
 * הסט שנשאר הוא מה שיש לו משמעות ממשית: גודל טקסט וריווח שורות
 * (מדורגים), תצוגה (ניגודיות, גווני אפור, גופן קריא), וניווט וקריאה
 * (הדגשת קישורים, סמן גדול, קו עזר, עצירת אנימציות). הקישור להצהרת
 * הנגישות המלאה נשאר בתחתית — הוא נדרש בתקנות, ולא היה מסופק בכלל על
 * ידי החבילה (האפשרות statement שלה מוגדרת בטיפוסים אך אינה ממומשת).
 *
 * ‏Ctrl+Alt+A פותח וסוגר, כפי שהיה.
 */
export function AccessibilityWidget() {
  const t = useTranslations('a11y');
  const titleId = useId();
  const [open, setOpen] = useState(false);

  /**
   * ‏null עד שהפאנל נפתח לראשונה. ההעדפות חיות ב-localStorage וחלות
   * על ה-DOM עוד לפני ש-React עולה (A11Y_INIT_SCRIPT), ולכן אין צורך
   * לקרוא אותן ברינדור — קריאה כזו גם הייתה מפיקה בשרת תוצאה אחרת
   * מאשר בדפדפן. הן נקראות ברגע הפתיחה, כשיש מה להציג.
   */
  const [state, setState] = useState<SiteA11yState | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.altKey) return;
      if (event.key.toLowerCase() !== 'a') return;
      event.preventDefault();
      setOpen((current) => !current);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function show() {
    setState(readSitePreferences());
    setOpen(true);
  }

  const activeCount = state ? countActivePreferences(state) : 0;

  return (
    <>
      {/* [1.38] טור אחד עם "דיווח על ספר" (ReportBookButton) ו"חזרה
          למעלה" (BackToTop): אותו גודל (h-11/w-11), אותו צד (start —
          ימין ב-RTL) ואותו מרחק מהקצה, ומתחתיהם ב-bottom-4. */}
      <button
        type="button"
        onClick={show}
        aria-label={t('open')}
        title={`${t('open')} · ${t('hotkeyPrefix')}Ctrl+Alt+A`}
        className="fixed bottom-4 start-4 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-navy text-[1.375rem] leading-none text-cream shadow-[var(--shadow-float)] transition-shadow hover:shadow-[var(--shadow-lift)] focus-visible:outline-offset-4"
      >
        {/* ︎ (variation selector-15) מבקש הצגה חד-צבעית במקום אמוג'י
            צבעוני — בלעדיה ♿ מגיע עם תג כחול משלו שמתנגש עם הרקע. */}
        <span aria-hidden="true">♿︎</span>
        {activeCount > 0 ? (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold px-1 text-[0.625rem] font-bold text-navy"
          >
            {activeCount}
          </span>
        ) : null}
      </button>

      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        titleId={titleId}
        title={t('toolbarTitle')}
        variant="center"
        widthClassName="max-w-[26rem]"
        closeLabel={t('close')}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setState(resetSitePreferences())}
              disabled={activeCount === 0}
              className="btn btn-quiet disabled:opacity-40"
            >
              {t('reset')}
            </button>
            <Link href="/accessibility" onClick={() => setOpen(false)} className="link text-small">
              {t('statementLink')}
            </Link>
          </div>
        }
      >
        {state ? (
          <div className="space-y-5">
            <Group label={t('groupReading')}>
              <Stepper
                label={t('textSize')}
                stepKey="text"
                value={state.text}
                onChange={(delta) => setState(stepSitePreference('text', delta))}
                decreaseLabel={t('decreaseText')}
                increaseLabel={t('increaseText')}
                defaultLabel={t('sizeDefault')}
              />
              <Stepper
                label={t('lineHeight')}
                stepKey="lines"
                value={state.lines}
                onChange={(delta) => setState(stepSitePreference('lines', delta))}
                decreaseLabel={t('decreaseLineHeight')}
                increaseLabel={t('increaseLineHeight')}
                defaultLabel={t('sizeDefault')}
              />
            </Group>

            <Group label={t('groupDisplay')}>
              <Toggle
                label={t('contrast')}
                toggleKey="contrast"
                state={state}
                setState={setState}
                hint={t('contrastHint')}
              />
              <Toggle label={t('grayHues')} toggleKey="gray" state={state} setState={setState} />
              <Toggle
                label={t('readableFont')}
                toggleKey="font"
                state={state}
                setState={setState}
                hint={t('readableFontHint')}
              />
            </Group>

            <Group label={t('groupNavigation')}>
              <Toggle label={t('underlineLinks')} toggleKey="links" state={state} setState={setState} />
              <Toggle label={t('bigCursor')} toggleKey="cursor" state={state} setState={setState} />
              <Toggle label={t('readingGuide')} toggleKey="guide" state={state} setState={setState} />
              <Toggle label={t('stopMotion')} toggleKey="motion" state={state} setState={setState} />
            </Group>

            <p className="border-t border-rule pt-4 text-caption text-ink-soft">
              {t('structuralNote')}
            </p>
          </div>
        ) : null}
      </Drawer>

      {/* קו העזר לקריאה חי מחוץ לפאנל: הוא צריך לפעול גם כשהפאנל סגור. */}
      <ReadingGuide />
    </>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      {/* ‏text-ink-soft ולא text-muted: טקסט בגודל caption מחויב ל-4.5:1,
          ו-text-muted על משטח הזכוכית של הפאנל נמדד מתחת לרף. בפאנל
          נגישות זה לא פרט של טעם. */}
      <h3 className="mb-2 text-caption font-semibold tracking-wide text-ink-soft">{label}</h3>
      <div className="divide-y divide-rule overflow-hidden rounded-[var(--radius-md)] border border-rule">
        {children}
      </div>
    </section>
  );
}

/**
 * התאמה מדורגת. מוצגת כמדרגות ולא כשני כפתורים נפרדים ברשימה: כך רואים
 * גם באיזו מדרגה נמצאים, וגם שיש גבול — בגרסה הקודמת "הגדלת טקסט"
 * ו"הקטנת טקסט" היו שני פריטים מנותקים בלי שום חיווי על המצב.
 *
 * ‏role="group" עם aria-label, ולא slider: הערכים בודדים וגלויים
 * כטקסט, והכפתורים עצמם נושאים תוויות מפורשות.
 */
function Stepper({
  label,
  stepKey,
  value,
  onChange,
  decreaseLabel,
  increaseLabel,
  defaultLabel,
}: {
  label: string;
  stepKey: SiteA11yStep;
  value: number;
  onChange: (delta: number) => void;
  decreaseLabel: string;
  increaseLabel: string;
  defaultLabel: string;
}) {
  const max = STEP_MAX[stepKey];
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="min-w-0 flex-1 text-small text-ink">{label}</span>
      <div role="group" aria-label={label} className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(-1)}
          disabled={value === 0}
          aria-label={decreaseLabel}
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-rule text-body leading-none text-ink transition-colors hover:bg-cream-2 disabled:opacity-35"
        >
          −
        </button>
        <span className="min-w-14 text-center text-caption tabular-nums text-ink-soft">
          {value === 0 ? defaultLabel : `+${value}`}
        </span>
        <button
          type="button"
          onClick={() => onChange(1)}
          disabled={value === max}
          aria-label={increaseLabel}
          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-rule text-body leading-none text-ink transition-colors hover:bg-cream-2 disabled:opacity-35"
        >
          +
        </button>
      </div>
    </div>
  );
}

/**
 * התאמה דו-מצבית. ‏<input type="checkbox"> אמיתי ולא כפתור עם
 * ‏aria-pressed: קורא מסך מקריא "תיבת סימון, מסומן", וזה התיאור הנכון
 * למצב מתמשך — להבדיל מפעולה חד-פעמית.
 */
function Toggle({
  label,
  toggleKey,
  state,
  setState,
  hint,
}: {
  label: string;
  toggleKey: SiteA11yToggle;
  state: SiteA11yState;
  setState: (next: SiteA11yState) => void;
  hint?: string;
}) {
  const on = state[toggleKey];
  return (
    <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors hover:bg-cream-2/60">
      <input
        type="checkbox"
        checked={on}
        onChange={(event) => setState(setSiteToggle(toggleKey, event.target.checked))}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-burgundy)]"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-small text-ink">{label}</span>
        {hint ? <span className="block text-caption text-ink-soft">{hint}</span> : null}
      </span>
    </label>
  );
}

/**
 * מצב קו העזר, נקרא מתכונת ה-DOM.
 *
 * התכונה היא מקור האמת שכבר הוחל (ראו A11Y_INIT_SCRIPT), ולכן אין
 * צורך בעוד עותק של המצב. ‏useSyncExternalStore ולא useState + useEffect
 * מאותה סיבה כמו ב-AdminNav: קריאה מה-DOM ברינדור אינה אפשרית בשרת,
 * ותיקון ב-effect הוא setState מיד לאחר הרינדור הראשון.
 */
function subscribeGuide(listener: () => void): () => void {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-a11y-guide'],
  });
  return () => observer.disconnect();
}

function readGuide(): boolean {
  return document.documentElement.getAttribute('data-a11y-guide') === 'on';
}

/** בשרת אין DOM, וקו עזר שעוקב אחרי סמן אינו רלוונטי לרינדור הראשון. */
function guideOffOnServer(): boolean {
  return false;
}

/**
 * קו עזר לקריאה — רצועה אופקית שעוקבת אחרי הסמן, לקושי במעקב אחר שורה.
 *
 * מאזין ה-pointermove נרשם רק כשההעדפה דלוקה, ולכן באתר הרגיל אין כאן
 * שום מאזין תנועה.
 */
function ReadingGuide() {
  const enabled = useSyncExternalStore(subscribeGuide, readGuide, guideOffOnServer);
  const [y, setY] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const onMove = (event: PointerEvent) => setY(event.clientY);
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [enabled]);

  if (!enabled || y === null) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 z-[60] h-10 -translate-y-1/2 border-y-2 border-burgundy/70 bg-gold/15"
      style={{ top: y }}
    />
  );
}
