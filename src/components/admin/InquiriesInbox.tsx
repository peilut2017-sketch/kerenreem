'use client';

import Link from 'next/link';
import { useId, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer } from '../Drawer';
import { AdminIcon } from './AdminIcons';
import { RichTextEditor } from './RichTextEditor';
import { Spinner } from './SubmitButton';
import {
  deleteContactMessage,
  markInquiryOpened,
  replyToInquiry,
  setInquiryStatus,
} from '@/lib/admin/messages-actions';
import type {
  ContactMessage,
  ContactReply,
  InquiryKind,
  InquiryStatus,
} from '@/lib/admin/queries';
import type { ContactField } from '@/lib/supabase/types';

/**
 * [1.11] מערכת הפניות המחודשת בדשבורד: רשימה מודרנית עם חלוקה לסוגי
 * פנייה, חמישה סטטוסי טיפול, כניסה לפנייה בלחיצה, מענה בדואר עם עורך
 * טקסט עשיר, ושרשור המענות שנשלחו.
 */

const KIND_LABELS: Record<InquiryKind, string> = {
  general: 'פנייה כללית',
  book_feedback: 'הערות על ספר',
};

const STATUS_META: Record<InquiryStatus, { label: string; badge: string; dot: string }> = {
  new: { label: 'חדשה', badge: 'admin-badge-danger', dot: 'bg-[var(--admin-danger)]' },
  read: { label: 'נקראה', badge: 'admin-badge-neutral', dot: 'bg-[var(--admin-muted,#8a8578)]' },
  in_progress: { label: 'בטיפול', badge: 'admin-badge-accent', dot: 'bg-[var(--admin-accent)]' },
  todo: { label: 'לטיפול', badge: 'admin-badge-warning', dot: 'bg-amber-500' },
  resolved: { label: 'נפתרה', badge: 'admin-badge-success', dot: 'bg-emerald-600' },
};

const STATUS_ORDER: InquiryStatus[] = ['new', 'read', 'in_progress', 'todo', 'resolved'];

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(value));
}

export function InquiriesInbox({
  messages,
  replies,
  fields,
  attachmentUrls,
  canDelete,
}: {
  messages: ContactMessage[];
  replies: ContactReply[];
  fields: ContactField[];
  attachmentUrls: Record<string, string>;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [kindFilter, setKindFilter] = useState<'all' | InquiryKind>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | InquiryStatus>('all');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  // עדכון אופטימי: הסטטוס שנבחר מוצג מיד, גם לפני שהרענון מהשרת חוזר
  const [statusOverrides, setStatusOverrides] = useState<Record<string, InquiryStatus>>({});

  const statusOf = (message: ContactMessage): InquiryStatus =>
    statusOverrides[message.id] ?? message.status;

  const repliesByMessage = useMemo(() => {
    const map = new Map<string, ContactReply[]>();
    for (const reply of replies) {
      const list = map.get(reply.message_id) ?? [];
      list.push(reply);
      map.set(reply.message_id, list);
    }
    return map;
  }, [replies]);

  const kindCounts = useMemo(
    () => ({
      all: messages.length,
      general: messages.filter((m) => m.kind === 'general').length,
      book_feedback: messages.filter((m) => m.kind === 'book_feedback').length,
    }),
    [messages],
  );

  const statusCounts = useMemo(() => {
    const counts = { all: messages.length } as Record<'all' | InquiryStatus, number>;
    for (const status of STATUS_ORDER) counts[status] = 0;
    for (const message of messages) counts[statusOf(message)] += 1;
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- statusOf תלוי ב-overrides בלבד
  }, [messages, statusOverrides]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return messages.filter((message) => {
      if (kindFilter !== 'all' && message.kind !== kindFilter) return false;
      if (statusFilter !== 'all' && statusOf(message) !== statusFilter) return false;
      if (needle) {
        const haystack = [
          message.name,
          message.email,
          message.phone,
          message.subject,
          message.message,
          message.book?.title_he,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- statusOf תלוי ב-overrides בלבד
  }, [messages, kindFilter, statusFilter, query, statusOverrides]);

  const open = openId ? (messages.find((message) => message.id === openId) ?? null) : null;

  function openInquiry(message: ContactMessage) {
    setOpenId(message.id);
    if (statusOf(message) === 'new') {
      // פתיחה ראשונה מסמנת "נקראה" — אופטימי בלקוח, מאושר בשרת
      setStatusOverrides((current) => ({ ...current, [message.id]: 'read' }));
      void markInquiryOpened(message.id).then(() => router.refresh());
    }
  }

  return (
    <div>
      {/* חלוקה לסוגי פנייה */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            { key: 'all', label: 'כל הפניות' },
            { key: 'general', label: KIND_LABELS.general },
            { key: 'book_feedback', label: KIND_LABELS.book_feedback },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setKindFilter(tab.key)}
            aria-pressed={kindFilter === tab.key}
            className={`admin-btn ${kindFilter === tab.key ? 'admin-btn-solid' : 'admin-btn-quiet'}`}
          >
            {tab.label}
            <span className="admin-badge admin-badge-neutral">{kindCounts[tab.key]}</span>
          </button>
        ))}

        <div className="relative ms-auto max-w-xs flex-1">
          <AdminIcon
            name="search"
            className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש בשם, נושא או תוכן"
            aria-label="חיפוש בפניות"
            className="admin-field-input ps-9"
          />
        </div>
      </div>

      {/* סינון לפי סטטוס */}
      <div className="mb-5 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setStatusFilter('all')}
          aria-pressed={statusFilter === 'all'}
          className={`admin-badge cursor-pointer ${statusFilter === 'all' ? 'admin-badge-accent' : 'admin-badge-neutral'}`}
        >
          הכל · {statusCounts.all}
        </button>
        {STATUS_ORDER.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
            aria-pressed={statusFilter === status}
            className={`admin-badge cursor-pointer transition-opacity ${STATUS_META[status].badge} ${
              statusFilter !== 'all' && statusFilter !== status ? 'opacity-45' : ''
            }`}
          >
            {STATUS_META[status].label} · {statusCounts[status]}
          </button>
        ))}
      </div>

      {/* הרשימה */}
      {filtered.length === 0 ? (
        <div className="admin-card px-6 py-12 text-center text-small text-muted">
          {messages.length === 0 ? 'טרם התקבלו פניות.' : 'אין פנייה התואמת את הסינון.'}
        </div>
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((message) => {
            const status = statusOf(message);
            const meta = STATUS_META[status];
            const replyCount = repliesByMessage.get(message.id)?.length ?? 0;
            const isNew = status === 'new';
            return (
              <li key={message.id}>
                <button
                  type="button"
                  onClick={() => openInquiry(message)}
                  className={`admin-card group w-full px-5 py-4 text-start transition-all duration-200 hover:-translate-y-px hover:shadow-[var(--shadow-card,0_10px_28px_-18px_rgba(20,20,20,0.4))] motion-reduce:transform-none ${
                    isNew ? 'border-s-2 border-s-[var(--admin-danger)]' : ''
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
                    <span className={`text-small ${isNew ? 'font-bold text-ink' : 'font-semibold text-ink-soft'}`}>
                      {message.name}
                    </span>
                    <span className={`admin-badge ${meta.badge}`}>{meta.label}</span>
                    <span className="admin-badge admin-badge-neutral">{KIND_LABELS[message.kind]}</span>
                    {message.attachments.length > 0 ? (
                      <span className="text-caption text-muted">📎 {message.attachments.length}</span>
                    ) : null}
                    {replyCount > 0 ? (
                      <span className="text-caption text-muted">↩ {replyCount} מענות</span>
                    ) : null}
                    <span className="ms-auto text-caption text-muted tabular-nums">
                      {formatDateTime(message.created_at)}
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-small text-ink-soft">
                    {message.kind === 'book_feedback' && message.book ? (
                      <span className="font-semibold">
                        {message.book.title_he}
                        {message.page_reference ? ` · עמ' ${message.page_reference}` : ''} —{' '}
                      </span>
                    ) : message.subject ? (
                      <span className="font-semibold">{message.subject} — </span>
                    ) : null}
                    <span className="text-muted">{message.message.slice(0, 160)}</span>
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open ? (
        <InquiryDetail
          message={open}
          status={statusOf(open)}
          replies={repliesByMessage.get(open.id) ?? []}
          fields={fields}
          attachmentUrls={attachmentUrls}
          canDelete={canDelete}
          onStatusChange={(status) => {
            setStatusOverrides((current) => ({ ...current, [open.id]: status }));
          }}
          onClose={() => setOpenId(null)}
          onDeleted={() => {
            setOpenId(null);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}

function InquiryDetail({
  message,
  status,
  replies,
  fields,
  attachmentUrls,
  canDelete,
  onStatusChange,
  onClose,
  onDeleted,
}: {
  message: ContactMessage;
  status: InquiryStatus;
  replies: ContactReply[];
  fields: ContactField[];
  attachmentUrls: Record<string, string>;
  canDelete: boolean;
  onStatusChange: (status: InquiryStatus) => void;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const titleId = useId();
  const replyFormId = useId();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  // מיחדוש העורך אחרי שליחה מוצלחת — מרוקן את תוכן המענה
  const [composerToken, setComposerToken] = useState(0);

  const fieldLabel = useMemo(() => new Map(fields.map((field) => [field.id, field.label_he])), [fields]);
  const customEntries = Object.entries(message.custom_field_values ?? {});

  function changeStatus(next: InquiryStatus) {
    const previous = status;
    onStatusChange(next);
    startTransition(async () => {
      setError(null);
      const result = await setInquiryStatus(message.id, next);
      if (result?.error) {
        setError(result.error);
        // העדכון האופטימי מוחזר: בלי זה הרשימה הציגה "טופלה" בזמן שהמסד
        // עדיין אומר "חדשה", עד רענון קשיח
        onStatusChange(previous);
      }
      router.refresh();
    });
  }

  function sendReply(formData: FormData) {
    const html = String(formData.get('reply_html') ?? '');
    startTransition(async () => {
      setError(null);
      setNotice(null);
      const result = await replyToInquiry(message.id, html);
      if (result?.error) {
        setError(result.error);
      } else {
        setNotice('המענה נשלח לכתובת הפונה ונשמר בשרשור.');
        setComposerToken((token) => token + 1);
        setShowComposer(false);
      }
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      setError(null);
      const result = await deleteContactMessage(message.id);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onDeleted();
    });
  }

  return (
    <Drawer
      open
      onClose={onClose}
      titleId={titleId}
      title={message.kind === 'book_feedback' ? 'הערות והארות על ספר' : 'פנייה מהאתר'}
      widthClassName="max-w-2xl"
      variant="center"
    >
      <div className="space-y-6">
        {/* פרטי הפונה */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-h3 font-semibold text-ink">{message.name}</p>
            <p className="mt-1 flex flex-wrap gap-3 text-small">
              <a href={`mailto:${message.email}`} dir="ltr" className="link">
                {message.email}
              </a>
              {message.phone ? (
                <a href={`tel:${message.phone.replace(/[^+\d]/g, '')}`} dir="ltr" className="link">
                  {message.phone}
                </a>
              ) : null}
            </p>
            <p className="mt-1 text-caption text-muted tabular-nums">{formatDateTime(message.created_at)}</p>
          </div>

          <label className="flex items-center gap-2 text-caption text-muted">
            סטטוס
            <select
              value={status}
              onChange={(event) => changeStatus(event.target.value as InquiryStatus)}
              disabled={pending}
              className="admin-field-input w-auto py-1.5"
            >
              {STATUS_ORDER.map((option) => (
                <option key={option} value={option}>
                  {STATUS_META[option].label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* הקשר: ספר / נושא / תחום */}
        {message.kind === 'book_feedback' && message.book ? (
          <p className="rounded-[var(--radius-md)] bg-cream-2 px-4 py-3 text-small text-ink-soft">
            <span className="font-semibold">הספר: </span>
            <Link href={`/books/${message.book.slug}`} target="_blank" className="link">
              {message.book.title_he}
            </Link>
            {message.page_reference ? <span> · עמ&#39; {message.page_reference}</span> : null}
          </p>
        ) : null}
        {message.kind === 'general' && (message.subject || message.topic) ? (
          <p className="rounded-[var(--radius-md)] bg-cream-2 px-4 py-3 text-small text-ink-soft">
            {message.topic ? <span className="admin-badge admin-badge-neutral me-2">{message.topic.name_he}</span> : null}
            {message.subject ? <span className="font-semibold">{message.subject}</span> : null}
          </p>
        ) : null}

        {/* גוף הפנייה */}
        {message.message_html ? (
          <div
            className="prose-reem max-w-none border-s-2 border-rule ps-4 text-small"
            // תוכן שנוקה בשרת בזמן הקליטה (sanitizeHtml) — לא HTML גולמי מהציבור
            dangerouslySetInnerHTML={{ __html: message.message_html }}
          />
        ) : (
          <p className="whitespace-pre-wrap border-s-2 border-rule ps-4 text-small leading-relaxed text-ink-soft">
            {message.message}
          </p>
        )}

        {/* שדות מותאמים */}
        {customEntries.length > 0 ? (
          <dl className="space-y-2 text-small">
            {customEntries.map(([fieldId, value]) => (
              <div key={fieldId} className="flex flex-wrap gap-2">
                <dt className="text-muted">{fieldLabel.get(fieldId) ?? 'שדה שהוסר'}:</dt>
                <dd className="text-ink-soft">{typeof value === 'boolean' ? (value ? 'כן' : 'לא') : value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {/* קבצים מצורפים */}
        {message.attachments.length > 0 ? (
          <div>
            <h3 className="eyebrow mb-2">קבצים מצורפים</h3>
            <ul className="space-y-1.5 text-small">
              {message.attachments.map((attachment) => (
                <li key={attachment.path}>
                  {attachmentUrls[attachment.path] ? (
                    <a
                      href={attachmentUrls[attachment.path]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link"
                    >
                      {attachment.name}
                    </a>
                  ) : (
                    <span className="text-muted">{attachment.name} (הקישור פג — רעננו את העמוד)</span>
                  )}
                  <span className="ms-2 text-caption text-muted">
                    {(attachment.size / 1024 / 1024).toFixed(1)}MB
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* שרשור המענות */}
        {replies.length > 0 ? (
          <div>
            <h3 className="eyebrow mb-2">מענות שנשלחו</h3>
            <ul className="space-y-3">
              {replies.map((reply) => (
                <li key={reply.id} className="rounded-[var(--radius-md)] bg-cream-2/70 px-4 py-3">
                  <p className="mb-1.5 flex flex-wrap items-center gap-2 text-caption text-muted">
                    <span className="font-semibold text-ink-soft">{reply.user_name ?? 'צוות המכון'}</span>
                    <span className="tabular-nums">{formatDateTime(reply.created_at)}</span>
                    {reply.delivery_status !== 'sent' ? (
                      <span className="admin-badge admin-badge-warning">לא נשלח בדואר</span>
                    ) : null}
                  </p>
                  <div
                    className="prose-reem max-w-none text-small"
                    dangerouslySetInnerHTML={{ __html: reply.body_html }}
                  />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* מענה חדש */}
        {showComposer ? (
          <form id={replyFormId} action={sendReply} className="space-y-3 border-t border-rule pt-4">
            <RichTextEditor
              key={composerToken}
              name="reply_html"
              label="מענה לפונה"
              hint="המענה יישלח בדואר אלקטרוני לכתובת הפונה ויישמר כאן בשרשור."
            />
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" disabled={pending} className="admin-btn admin-btn-solid">
                {pending ? <Spinner className="h-3.5 w-3.5" /> : <AdminIcon name="messages" className="h-4 w-4" />}
                שליחת מענה בדואר
              </button>
              <button
                type="button"
                onClick={() => setShowComposer(false)}
                className="admin-btn admin-btn-ghost"
              >
                ביטול
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-3 border-t border-rule pt-4">
            <button type="button" onClick={() => setShowComposer(true)} className="admin-btn admin-btn-solid">
              <AdminIcon name="messages" className="h-4 w-4" />
              מענה בדואר
            </button>
            {canDelete ? (
              confirmingDelete ? (
                <>
                  <span role="alert" className="text-small font-semibold text-[var(--admin-danger)]">
                    למחוק את הפנייה לצמיתות?
                  </span>
                  <button type="button" disabled={pending} onClick={remove} className="admin-btn admin-btn-danger">
                    {pending ? <Spinner className="h-3.5 w-3.5" /> : <AdminIcon name="check" className="h-4 w-4" />}
                    כן, למחוק
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="admin-btn admin-btn-ghost"
                  >
                    ביטול
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="admin-btn admin-btn-danger ms-auto"
                >
                  <AdminIcon name="trash" className="h-4 w-4" />
                  מחיקה
                </button>
              )
            ) : null}
          </div>
        )}

        {notice ? (
          <p role="status" className="text-small text-emerald-700">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-small text-[var(--admin-danger)]">
            {error}
          </p>
        ) : null}
      </div>
    </Drawer>
  );
}
