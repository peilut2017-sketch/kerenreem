'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/**
 * סרגל נגישות.
 *
 * ⚠ הסרגל אינו תחליף לנגישות המבנית של האתר. תקן 5568 נבחן על ה-HTML
 * עצמו — תוויות לשדות, מבנה כותרות, ניווט מקלדת וניגודיות. הסרגל הוא
 * שכבת התאמה אישית מעל בסיס שכבר נגיש.
 */

const STORAGE_KEY = 'kr-a11y';

type Toggles = 'contrast' | 'links' | 'font' | 'motion';

interface A11yState {
  scale: number;
  contrast: boolean;
  links: boolean;
  font: boolean;
  motion: boolean;
}

const DEFAULT_STATE: A11yState = {
  scale: 1,
  contrast: false,
  links: false,
  font: false,
  motion: false,
};

const MIN_SCALE = 0.9;
const MAX_SCALE = 1.5;
const STEP = 0.1;

function apply(state: A11yState) {
  const root = document.documentElement;
  root.style.setProperty('--a11y-scale', String(state.scale));
  const set = (name: string, on: boolean) => {
    if (on) root.setAttribute(name, name === 'data-a11y-motion' ? 'off' : 'on');
    else root.removeAttribute(name);
  };
  set('data-a11y-contrast', state.contrast);
  set('data-a11y-links', state.links);
  set('data-a11y-font', state.font);
  set('data-a11y-motion', state.motion);
}

/* --------------------------------------------------------------------------
   ההעדפות חיות ב-localStorage — מערכת חיצונית ל-React, שאינה קיימת בשרת.
   useSyncExternalStore הוא הכלי המיועד לכך: הוא נותן ערך שרת נפרד (ברירות
   המחדל) ולכן אין פער hydration, ואינו דורש setState בתוך effect.

   רווח נוסף: אירוע storage מסנכרן את ההעדפה בין לשוניות פתוחות. מי שהגדיל
   טקסט בלשונית אחת מקבל אותו בכולן.
   -------------------------------------------------------------------------- */

const listeners = new Set<() => void>();

// getSnapshot חייב להחזיר אותה הפניה כל עוד לא השתנה דבר, אחרת React
// נכנס ללולאת רינדור אינסופית. לכן שומרים את ה-JSON הגולמי ואת התוצאה.
let cachedRaw: string | null = null;
let cachedState: A11yState = DEFAULT_STATE;

function readState(): A11yState {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    /* localStorage חסום (מצב פרטי, חסימת צד שלישי) — ברירות המחדל */
  }

  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedState = raw
        ? { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<A11yState>) }
        : DEFAULT_STATE;
    } catch {
      cachedState = DEFAULT_STATE;
    }
  }
  return cachedState;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener('storage', onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onChange);
  };
}

function writeState(next: A11yState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // האחסון חסום; ההעדפה תחול על העמוד הנוכחי אך לא תישמר.
    cachedRaw = null;
    cachedState = next;
  }
  apply(next);
  // אירוע storage אינו נורה בלשונית שכתבה — מודיעים לעצמנו במפורש.
  listeners.forEach((listener) => listener());
}

export function AccessibilityBar() {
  const t = useTranslations('a11y');
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // בשרת ובצביעה הראשונה מוחזרות ברירות המחדל; הסקריפט שב-layout כבר
  // החיל את ההעדפות האמיתיות על ה-DOM, ולכן אין הבזק ויזואלי.
  const state = useSyncExternalStore(subscribe, readState, () => DEFAULT_STATE);

  const update = useCallback((next: A11yState) => writeState(next), []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const toggle = (key: Toggles) => update({ ...state, [key]: !state[key] });

  const scaleBy = (delta: number) =>
    update({
      ...state,
      scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round((state.scale + delta) * 10) / 10)),
    });

  return (
    <div className="no-print fixed bottom-4 start-4 z-50">
      {open ? (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t('toolbarTitle')}
          aria-modal="false"
          className="mb-3 w-72 border border-rule-strong bg-cream p-4 shadow-none"
        >
          <div className="mb-4 flex items-center justify-between gap-3 border-b border-rule pb-3">
            <h2 className="text-[1rem] font-semibold text-ink">{t('toolbarTitle')}</h2>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                buttonRef.current?.focus();
              }}
              className="text-caption text-muted underline underline-offset-4 hover:text-burgundy"
            >
              {t('close')}
            </button>
          </div>

          <div className="mb-4">
            <span id="a11y-textsize-label" className="field-label">
              {t('textSize')}
            </span>
            <div className="flex items-center gap-2" role="group" aria-labelledby="a11y-textsize-label">
              <button
                type="button"
                onClick={() => scaleBy(-STEP)}
                disabled={state.scale <= MIN_SCALE}
                className="btn btn-quiet px-3 py-1.5"
                aria-label={t('decrease')}
              >
                −
              </button>
              <span className="min-w-14 text-center text-small tabular-nums text-muted" aria-live="polite">
                {Math.round(state.scale * 100)}%
              </span>
              <button
                type="button"
                onClick={() => scaleBy(STEP)}
                disabled={state.scale >= MAX_SCALE}
                className="btn btn-quiet px-3 py-1.5"
                aria-label={t('increase')}
              >
                +
              </button>
            </div>
          </div>

          <ul className="space-y-1 border-t border-rule pt-3">
            {(
              [
                ['contrast', t('contrast')],
                ['links', t('underlineLinks')],
                ['font', t('readableFont')],
                ['motion', t('stopMotion')],
              ] as [Toggles, string][]
            ).map(([key, label]) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-pressed={state[key]}
                  className="flex w-full items-center justify-between gap-3 py-2 text-start text-small text-ink-soft hover:text-burgundy"
                >
                  <span>{label}</span>
                  <span
                    className={`shrink-0 border px-2 py-0.5 text-caption ${
                      state[key]
                        ? 'border-burgundy bg-burgundy text-cream'
                        : 'border-rule-strong text-muted'
                    }`}
                  >
                    {state[key] ? t('on') : t('off')}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-rule pt-3">
            <button
              type="button"
              onClick={() => update(DEFAULT_STATE)}
              className="text-caption text-muted underline underline-offset-4 hover:text-burgundy"
            >
              {t('reset')}
            </button>
            <Link
              href="/accessibility"
              className="text-caption text-muted underline underline-offset-4 hover:text-burgundy"
            >
              {t('statementLink')}
            </Link>
          </div>
        </div>
      ) : null}

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={t('open')}
        className="flex h-12 w-12 items-center justify-center border border-rule-strong bg-cream text-ink transition-colors hover:border-ink hover:bg-cream-2"
      >
        {/* סמל הנגישות הבינלאומי — כאן האייקון הוא המידע עצמו, ולכן במקומו */}
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="4" r="2" />
          <path d="M20.5 7.4 15 8.6v3.3l3.1 8.3-1.9.7-3-8.1h-2.4l-3 8.1-1.9-.7L9 11.9V8.6L3.5 7.4l.4-1.9L12 7.2l8.1-1.7z" />
        </svg>
      </button>
    </div>
  );
}

/**
 * סקריפט שרץ לפני הצביעה הראשונה ומחיל את ההעדפות השמורות, כדי שלא
 * תהיה הבזקה של הגדרות ברירת מחדל אצל מי שכבר בחר ניגודיות או הגדלה.
 */
export const A11Y_INIT_SCRIPT = `(function(){try{
var r=document.documentElement;
// מסמן שסקריפטים רצים. ההופעה בגלילה מסתירה תוכן רק כשהדגל הזה קיים,
// כך שדפדפן בלי JS מקבל עמוד מלא ולא עמוד ריק.
r.classList.add('js');
var s=JSON.parse(localStorage.getItem('${STORAGE_KEY}')||'{}');
if(s.scale)r.style.setProperty('--a11y-scale',String(s.scale));
if(s.contrast)r.setAttribute('data-a11y-contrast','on');
if(s.links)r.setAttribute('data-a11y-links','on');
if(s.font)r.setAttribute('data-a11y-font','on');
if(s.motion)r.setAttribute('data-a11y-motion','off');
}catch(e){}})();`;
