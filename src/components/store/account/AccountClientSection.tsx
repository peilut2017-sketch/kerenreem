'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { useLocalList, useLocalMap } from '@/lib/client-hooks';
import { completeLogin, mergeSavedBooks, signOutCustomer } from '@/lib/commerce/account-actions';

/**
 * החלק החי של האזור האישי: השלמת ההתחברות (יצירת לקוח + שיוך הזמנות),
 * מיזוג המועדפים והמדף מהמכשיר (תרשים 3 — איחוד, בלי מחיקה), ויציאה.
 */
export function AccountClientSection() {
  const t = useTranslations('store');
  const router = useRouter();
  const { list: favourites } = useLocalList('kr:favourites');
  const { map: shelf } = useLocalMap('kr:shelf');
  const [synced, setSynced] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      // עוגן ה-Claim (טוקן הזמנת המקור) יושב בעוגיית kr-claim ה-httpOnly
      // ש-beginAccountClaim הציב — completeLogin קורא אותה בצד השרת בלבד.
      await completeLogin();
      if (favourites.length > 0 || Object.keys(shelf).length > 0) {
        const result = await mergeSavedBooks({ favourites, shelf });
        if (result.ok) {
          setSynced(true);
          router.refresh();
        }
      }
    })();
    // ריצה אחת בכניסה — הרשימות הרגעיות הן קלט ההתחלה של המיזוג
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      {synced ? (
        <p role="status" className="text-caption text-ink-soft">
          {t('accountSavedSynced')}
        </p>
      ) : null}
      <button
        type="button"
        onClick={async () => {
          await signOutCustomer();
          router.push('/');
          router.refresh();
        }}
        className="text-caption text-muted underline-offset-2 hover:text-burgundy hover:underline"
      >
        {t('accountSignOut')}
      </button>
    </div>
  );
}
