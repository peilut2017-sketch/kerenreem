'use client';

import dynamic from 'next/dynamic';
import { useActionState, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { submitBookFeedback, type ContactFormState } from '@/app/(public)/[locale]/contact/actions';
import { restoreFormValues } from '@/lib/restore-form';
import { ContactAttachmentsField } from './ContactAttachmentsField';
import { Captcha } from './Captcha';

// tiptap נטען רק כשנכנסים לטופס הזה — לא במטען הראשוני של עמוד הקשר
const PublicRichTextField = dynamic(
  () => import('./PublicRichTextField').then((mod) => mod.PublicRichTextField),
  {
    ssr: false,
    loading: () => <div className="h-48 animate-pulse rounded-[var(--radius-md)] bg-cream-2" aria-hidden="true" />,
  },
);

const INITIAL: ContactFormState = { status: 'idle' };

export interface FeedbackBookOption {
  id: string;
  title: string;
  author: string | null;
}

/**
 * [1.11] טופס "הערות והארות על ספרים" — הטופס השני במערכת הפניות:
 * בחירת ספר מהקטלוג (עם סינון הקלדה), מספר עמוד, גוף עשיר וצירוף קבצים.
 * אותה שפת נגישות כמו ContactForm: label לכל שדה, שגיאות מקושרות,
 * מלכודת בוטים וקאפצ'ה.
 */
export function BookFeedbackForm({ books }: { books: FeedbackBookOption[] }) {
  const t = useTranslations('contact');
  const locale = useLocale();
  const formRef = useRef<HTMLFormElement>(null);
  const submitted = useRef<FormData | null>(null);
  const [bookFilter, setBookFilter] = useState('');

  const [state, action, pending] = useActionState(
    async (previous: ContactFormState, formData: FormData) => {
      submitted.current = formData;
      return submitBookFeedback(previous, formData);
    },
    INITIAL,
  );
  const id = useId();

  useEffect(() => {
    if (state.status !== 'error' || !formRef.current || !submitted.current) return;
    restoreFormValues(formRef.current, submitted.current);
  }, [state]);

  const filteredBooks = useMemo(() => {
    const needle = bookFilter.trim().toLowerCase();
    if (!needle) return books;
    return books.filter((book) =>
      `${book.title} ${book.author ?? ''}`.toLowerCase().includes(needle),
    );
  }, [books, bookFilter]);

  const field = (name: string) => ({
    id: `${id}-${name}`,
    name,
    'aria-invalid': state.fieldErrors?.[name] ? (true as const) : undefined,
    'aria-describedby': state.fieldErrors?.[name] ? `${id}-${name}-error` : undefined,
    className: 'field-input',
  });

  const errorFor = (name: string) =>
    state.fieldErrors?.[name] ? (
      <span id={`${id}-${name}-error`} className="field-error">
        {state.fieldErrors[name]}
      </span>
    ) : null;

  if (state.status === 'success') {
    return (
      <p role="status" className="border-s-2 border-burgundy bg-cream-2 px-5 py-4 text-ink">
        {t('success')}
      </p>
    );
  }

  return (
    <form ref={formRef} action={action} noValidate className="space-y-5">
      <div aria-hidden="true" className="sr-only">
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={`${id}-name`} className="field-label">
            {t('name')} <span aria-hidden="true">*</span>
          </label>
          <input type="text" autoComplete="name" required {...field('name')} />
          {errorFor('name')}
        </div>

        <div>
          <label htmlFor={`${id}-email`} className="field-label">
            {t('email')} <span aria-hidden="true">*</span>
          </label>
          <input type="email" autoComplete="email" required dir="ltr" {...field('email')} />
          {errorFor('email')}
        </div>

        <div>
          <label htmlFor={`${id}-phone`} className="field-label">
            {t('phone')}
          </label>
          <input type="tel" autoComplete="tel" dir="ltr" {...field('phone')} />
          {errorFor('phone')}
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] border border-rule bg-cream-2/40 p-4">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_9rem]">
          <div>
            <label htmlFor={`${id}-book_id`} className="field-label">
              {t('bookLabel')} <span aria-hidden="true">*</span>
            </label>
            {books.length > 12 ? (
              <input
                type="search"
                value={bookFilter}
                onChange={(event) => setBookFilter(event.target.value)}
                placeholder={t('bookSearch')}
                aria-label={t('bookSearch')}
                className="field-input mb-2"
              />
            ) : null}
            <select required {...field('book_id')}>
              <option value="">{t('bookEmpty')}</option>
              {filteredBooks.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.author ? `${book.title} — ${book.author}` : book.title}
                </option>
              ))}
            </select>
            {errorFor('book_id')}
          </div>

          <div>
            <label htmlFor={`${id}-page_reference`} className="field-label">
              {t('pageLabel')}
            </label>
            <input type="text" dir="auto" placeholder={t('pageHint')} {...field('page_reference')} />
            {errorFor('page_reference')}
          </div>
        </div>
      </div>

      <PublicRichTextField
        name="message_html"
        label={t('feedbackLabel')}
        labelId={`${id}-message_html-label`}
        placeholder={t('feedbackHint')}
        error={state.fieldErrors?.message_html ?? null}
        toolbarLabels={{
          bold: t('rtBold'),
          italic: t('rtItalic'),
          bulletList: t('rtBulletList'),
          orderedList: t('rtOrderedList'),
          quote: t('rtQuote'),
        }}
      />

      <ContactAttachmentsField name="attachments" />

      <div>
        <label htmlFor={`${id}-consent`} className="flex items-start gap-3 text-small text-ink-soft on-dark:text-cream-2">
          <input
            type="checkbox"
            id={`${id}-consent`}
            name="consent"
            required
            aria-invalid={state.fieldErrors?.consent ? true : undefined}
            aria-describedby={state.fieldErrors?.consent ? `${id}-consent-error` : undefined}
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-burgundy)]"
          />
          <span>
            {t('consentPrefix')}{' '}
            <Link href="/terms" className="link">
              {t('termsLinkLabel')}
            </Link>{' '}
            {t('consentSuffix')}
          </span>
        </label>
        {errorFor('consent')}
      </div>

      <Captcha resetSignal={state} />

      {state.status === 'error' && state.message ? (
        <p role="alert" className="field-error">
          {state.message}
        </p>
      ) : null}

      <button type="submit" disabled={pending} className="btn btn-solid">
        {pending ? t('sending') : t('send')}
      </button>

      {/* locale משתתף בטופס רק לצורך עקביות עתידית של הודעות המענה */}
      <input type="hidden" name="locale" value={locale} />
    </form>
  );
}
