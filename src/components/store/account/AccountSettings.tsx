'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import { deleteMyAccount, updateMyDetails, updateMyNotificationPreferences } from '@/lib/commerce/account-actions';

/**
 * [1.3] הגדרות חשבון (פרק 4.8): עריכת שם/טלפון/מייל + מחיקת חשבון.
 * שינוי מייל מפעיל קישור אישור לכתובת החדשה (זרימת Supabase). מחיקה —
 * אישור כפול (דיאלוג + הקלדת מילת אימות); ההזמנות והמסמכים נשמרים כדין.
 * [1.6] העדפות התראה (ט.20) — טופס שלישי, נפרד: שמירה כותבת גם ל-
 * customers.*_opt_in וגם ל-consent_events (עוגן ראיה לכל שינוי הסכמה).
 */

const inputCls =
  'w-full rounded-[var(--radius-md)] border border-rule bg-white/70 px-4 py-2.5 text-ink outline-none focus-visible:ring-2 focus-visible:ring-gold/60';

export function AccountSettings({
  initialName,
  initialPhone,
  initialEmail,
  initialMarketingEmail,
  initialChannelSms,
  initialChannelWhatsapp,
}: {
  initialName: string;
  initialPhone: string;
  initialEmail: string;
  initialMarketingEmail: boolean;
  initialChannelSms: boolean;
  initialChannelWhatsapp: boolean;
}) {
  const t = useTranslations('store');
  const router = useRouter();
  const [fullName, setFullName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<'saved' | 'emailSent' | 'error' | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [marketingEmail, setMarketingEmail] = useState(initialMarketingEmail);
  const [channelSms, setChannelSms] = useState(initialChannelSms);
  const [channelWhatsapp, setChannelWhatsapp] = useState(initialChannelWhatsapp);
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifNotice, setNotifNotice] = useState<'saved' | 'error' | null>(null);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const result = await updateMyDetails({ fullName, email, phone });
      if (!result.ok) {
        setNotice('error');
        return;
      }
      setNotice(result.emailConfirmationSent ? 'emailSent' : 'saved');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function saveNotifications(event: React.FormEvent) {
    event.preventDefault();
    setNotifBusy(true);
    setNotifNotice(null);
    try {
      const result = await updateMyNotificationPreferences({
        marketingEmail,
        channelSms,
        channelWhatsapp,
      });
      setNotifNotice(result.ok ? 'saved' : 'error');
    } finally {
      setNotifBusy(false);
    }
  }

  async function removeAccount() {
    if (!window.confirm(t('accountDeleteConfirm1'))) return;
    const typed = window.prompt(t('accountDeleteConfirm2', { word: t('accountDeleteWord') }));
    if (typed?.trim() !== t('accountDeleteWord')) return;
    setDeleting(true);
    try {
      const result = await deleteMyAccount();
      if (result.ok) {
        router.push('/');
        router.refresh();
      } else {
        setNotice('error');
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={save}
        className="space-y-4 rounded-[var(--radius-lg)] border border-rule bg-cream p-5 shadow-[var(--shadow-soft)] sm:p-6"
      >
        <h2 className="flex items-center gap-2 font-serif text-h3 text-ink">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-burgundy" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
          </svg>
          {t('accountDetailsTitle')}
        </h2>
        <div>
          <label htmlFor="st-name" className="mb-1.5 block text-small font-semibold text-ink">
            {t('settingsFullName')}
          </label>
          <input id="st-name" type="text" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputCls} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="st-phone" className="mb-1.5 block text-small font-semibold text-ink">
              {t('settingsPhone')}
            </label>
            <input id="st-phone" type="tel" dir="ltr" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="st-email" className="mb-1.5 block text-small font-semibold text-ink">
              {t('settingsEmail')}
            </label>
            <input id="st-email" type="email" dir="ltr" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            <p className="mt-1 text-caption text-muted">{t('settingsEmailHint')}</p>
          </div>
        </div>
        {notice === 'saved' ? (
          <p role="status" className="text-small font-semibold text-forest">
            {t('accountDetailsSaved')}
          </p>
        ) : null}
        {notice === 'emailSent' ? (
          <p role="status" className="text-small font-semibold text-forest">
            {t('settingsEmailConfirmSent')}
          </p>
        ) : null}
        {notice === 'error' ? (
          <p role="alert" className="text-small text-burgundy">
            {t('settingsError')}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className="btn btn-solid">
          {t('settingsSave')}
        </button>
      </form>

      <form
        onSubmit={saveNotifications}
        className="space-y-4 rounded-[var(--radius-lg)] border border-rule bg-cream p-5 shadow-[var(--shadow-soft)] sm:p-6"
      >
        <h2 className="flex items-center gap-2 font-serif text-h3 text-ink">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 text-burgundy" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          {t('notificationsTitle')}
        </h2>
        <p className="text-small text-muted">{t('notificationsIntro')}</p>
        <div className="space-y-3">
          <label className="flex items-center gap-3 text-small text-ink">
            <input
              type="checkbox"
              checked={marketingEmail}
              onChange={(e) => setMarketingEmail(e.target.checked)}
              className="h-4 w-4 rounded border-rule text-burgundy focus-visible:ring-2 focus-visible:ring-gold/60"
            />
            {t('notificationsMarketingEmail')}
          </label>
          <label className="flex items-center gap-3 text-small text-ink">
            <input
              type="checkbox"
              checked={channelSms}
              onChange={(e) => setChannelSms(e.target.checked)}
              className="h-4 w-4 rounded border-rule text-burgundy focus-visible:ring-2 focus-visible:ring-gold/60"
            />
            {t('notificationsSms')}
          </label>
          <label className="flex items-center gap-3 text-small text-ink">
            <input
              type="checkbox"
              checked={channelWhatsapp}
              onChange={(e) => setChannelWhatsapp(e.target.checked)}
              className="h-4 w-4 rounded border-rule text-burgundy focus-visible:ring-2 focus-visible:ring-gold/60"
            />
            {t('notificationsWhatsapp')}
          </label>
        </div>
        {notifNotice === 'saved' ? (
          <p role="status" className="text-small font-semibold text-forest">
            {t('notificationsSaved')}
          </p>
        ) : null}
        {notifNotice === 'error' ? (
          <p role="alert" className="text-small text-burgundy">
            {t('settingsError')}
          </p>
        ) : null}
        <button type="submit" disabled={notifBusy} className="btn btn-solid">
          {t('notificationsSave')}
        </button>
      </form>

      <section className="rounded-[var(--radius-lg)] border border-burgundy/25 bg-burgundy/[0.04] p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-serif text-h3 text-burgundy">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          {t('accountDeleteTitle')}
        </h2>
        <p className="mt-2 text-small text-ink-soft">{t('accountDeleteBody')}</p>
        <button
          type="button"
          disabled={deleting}
          onClick={removeAccount}
          className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-burgundy px-5 py-2 text-small font-semibold text-burgundy transition-colors hover:bg-burgundy hover:text-white disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4h8v2m1 0v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V6" />
          </svg>
          {deleting ? t('accountDeleting') : t('accountDeleteCta')}
        </button>
      </section>
    </div>
  );
}
