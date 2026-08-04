'use client';

import { useId, useMemo, useState, useTransition } from 'react';
import { Drawer } from '@/components/Drawer';
import { AdminIcon } from './AdminIcons';
import { MessageToggle } from './MessageToggle';
import { Spinner } from './SubmitButton';
import { deleteContactMessage } from '@/lib/admin/messages-actions';
import type { ContactMessage } from '@/lib/admin/queries';
import type { ContactField } from '@/lib/supabase/types';

type StatusFilter = 'all' | 'open' | 'handled';

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'הכל' },
  { id: 'open', label: 'פתוחות' },
  { id: 'handled', label: 'טופלו' },
];

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Jerusalem',
  }).format(new Date(value));
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

/**
 * מסך "פניות מהאתר": רשימה עם חיפוש וסינון סטטוס, ומגירת תצוגה לפנייה
 * בודדת (כמו מגירת הוספה מהירה בטופס הספר — ראו Drawer.tsx) עם כל
 * הפרטים, סימון טופל/לא טופל ומחיקה.
 *
 * הנתונים מגיעים מוכנים מהעמוד (Server Component); הרכיב הזה מסנן ומציג
 * בצד הלקוח בלבד — אין כאן שאילתות. אחרי סימון סטטוס או מחיקה, ה-Server
 * Action עושה revalidatePath('/admin/messages') והעמוד מספק props
 * מעודכנים; selectedMessage נגזר מ-messages+selectedId ולא מועתק ל-state
 * נפרד, כך שהמגירה נסגרת מאליה אם הפנייה הפתוחה נמחקה.
 */
export function MessagesInbox({
  messages,
  attachmentUrls,
  fields,
  canDelete,
}: {
  messages: ContactMessage[];
  attachmentUrls: Record<string, string>;
  fields: ContactField[];
  canDelete: boolean;
}) {
  const titleId = useId();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const openCount = useMemo(() => messages.filter((message) => !message.is_handled).length, [messages]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return messages.filter((message) => {
      if (status === 'open' && message.is_handled) return false;
      if (status === 'handled' && !message.is_handled) return false;
      if (!needle) return true;
      const haystack = [message.name, message.email, message.phone, message.subject, message.message]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [messages, query, status]);

  const selected = messages.find((message) => message.id === selectedId) ?? null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <AdminIcon
            name="search"
            className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="חיפוש בשם, דוא״ל, נושא או תוכן"
            aria-label="חיפוש בפניות"
            className="admin-field-input ps-9"
          />
        </div>

        <div role="group" aria-label="סינון לפי סטטוס" className="admin-nav-shell">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={status === tab.id}
              onClick={() => setStatus(tab.id)}
              className={`admin-nav-link ${status === tab.id ? 'admin-nav-link-active' : ''}`}
            >
              {tab.label}
              {tab.id === 'open' && openCount > 0 ? (
                <span className="admin-badge admin-badge-warning">{openCount}</span>
              ) : null}
            </button>
          ))}
        </div>

        <span className="text-caption text-muted">
          {filtered.length} מתוך {messages.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <p className="border-t border-rule px-1 py-10 text-center text-muted">
          {messages.length === 0 ? 'אין פניות.' : 'אין פנייה התואמת את החיפוש.'}
        </p>
      ) : (
        <ul className="border-t border-rule">
          {filtered.map((message) => (
            <li key={message.id} className="border-b border-rule">
              <button
                type="button"
                onClick={() => setSelectedId(message.id)}
                className="flex w-full flex-wrap items-center gap-3 py-4 text-start transition-colors hover:bg-cream-2"
              >
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full ${message.is_handled ? 'bg-rule-strong' : 'bg-burgundy'}`}
                />

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-semibold text-ink">{message.name}</span>
                    {message.topic ? (
                      <span className="admin-badge admin-badge-neutral">{message.topic.name_he}</span>
                    ) : null}
                    {message.subject ? (
                      <span className="truncate text-small text-muted">{message.subject}</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block truncate text-caption text-muted" dir="ltr">
                    {message.email}
                  </span>
                </span>

                {message.attachments.length > 0 ? (
                  <span className="flex items-center gap-1 text-caption text-muted" title="קבצים מצורפים">
                    <AdminIcon name="external" className="h-3.5 w-3.5" />
                    {message.attachments.length}
                  </span>
                ) : null}

                <time dateTime={message.created_at} className="shrink-0 text-caption tabular-nums text-muted">
                  {formatDateTime(message.created_at)}
                </time>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Drawer
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        titleId={titleId}
        title={selected?.name ?? ''}
        widthClassName="max-w-xl"
        variant="center"
      >
        {selected ? (
          <MessageDetail
            message={selected}
            attachmentUrls={attachmentUrls}
            fields={fields}
            canDelete={canDelete}
            onDeleted={() => setSelectedId(null)}
          />
        ) : null}
      </Drawer>
    </div>
  );
}

function MessageDetail({
  message,
  attachmentUrls,
  fields,
  canDelete,
  onDeleted,
}: {
  message: ContactMessage;
  attachmentUrls: Record<string, string>;
  fields: ContactField[];
  canDelete: boolean;
  onDeleted: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MessageToggle id={message.id} handled={message.is_handled} className="admin-btn admin-btn-quiet" />
        <time dateTime={message.created_at} className="text-caption tabular-nums text-muted">
          {formatDateTime(message.created_at)}
        </time>
      </div>

      <dl className="grid gap-3 text-small sm:grid-cols-2">
        {message.topic ? (
          <div className="sm:col-span-2">
            <dt className="text-caption text-muted">תחום פנייה</dt>
            <dd className="mt-0.5">
              <span className="admin-badge admin-badge-neutral">{message.topic.name_he}</span>
            </dd>
          </div>
        ) : null}
        {message.subject ? (
          <div className="sm:col-span-2">
            <dt className="text-caption text-muted">נושא</dt>
            <dd className="mt-0.5 font-semibold text-ink">{message.subject}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-caption text-muted">דוא״ל</dt>
          <dd className="mt-0.5" dir="ltr">
            <a href={`mailto:${message.email}`} className="underline underline-offset-4 hover:text-[var(--admin-accent)]">
              {message.email}
            </a>
          </dd>
        </div>
        {message.phone ? (
          <div>
            <dt className="text-caption text-muted">טלפון</dt>
            <dd className="mt-0.5" dir="ltr">
              <a href={`tel:${message.phone}`} className="underline underline-offset-4 hover:text-[var(--admin-accent)]">
                {message.phone}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="border-t border-rule pt-5">
        <p className="whitespace-pre-wrap text-small leading-relaxed text-ink-soft">{message.message}</p>
      </div>

      {Object.keys(message.custom_field_values).length > 0 ? (
        <div className="border-t border-rule pt-5">
          <h3 className="admin-field-label mb-2">שדות מותאמים</h3>
          <dl className="space-y-3 text-small">
            {Object.entries(message.custom_field_values).map(([fieldId, value]) => {
              const definition = fields.find((candidate) => candidate.id === fieldId);
              return (
                <div key={fieldId}>
                  <dt className="text-caption text-muted">{definition?.label_he ?? 'שדה שנמחק'}</dt>
                  <dd className="mt-0.5 text-ink-soft">
                    {typeof value === 'boolean' ? (value ? 'כן' : 'לא') : value}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      ) : null}

      {message.attachments.length > 0 ? (
        <div className="border-t border-rule pt-5">
          <h3 className="admin-field-label mb-2">קבצים מצורפים</h3>
          <ul className="flex flex-wrap gap-2">
            {message.attachments.map((attachment) => {
              const url = attachmentUrls[attachment.path];
              return (
                <li key={attachment.path}>
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="admin-badge admin-badge-neutral inline-flex items-center gap-1.5 hover:text-[var(--admin-accent)]"
                    >
                      <AdminIcon name="external" className="h-3.5 w-3.5" />
                      {attachment.name}
                      <span className="text-muted">({formatSize(attachment.size)})</span>
                    </a>
                  ) : (
                    <span className="admin-badge admin-badge-neutral">{attachment.name} — הקישור אינו זמין כרגע</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {canDelete ? (
        <div className="border-t border-rule pt-5">
          {confirmingDelete ? (
            <div className="flex flex-wrap items-center gap-3">
              <span role="alert" className="text-small font-semibold text-[var(--admin-danger)]">
                למחוק את הפנייה לצמיתות?
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const result = await deleteContactMessage(message.id);
                    if (result?.error) {
                      setError(result.error);
                      return;
                    }
                    onDeleted();
                  })
                }
                className="admin-btn admin-btn-danger"
              >
                {pending ? <Spinner className="h-3.5 w-3.5" /> : <AdminIcon name="check" className="h-4 w-4" />}
                כן, למחוק
              </button>
              <button type="button" onClick={() => setConfirmingDelete(false)} className="admin-btn admin-btn-ghost">
                ביטול
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)} className="admin-btn admin-btn-danger">
              <AdminIcon name="trash" className="h-4 w-4" />
              מחיקת הפנייה
            </button>
          )}
          {error ? (
            <p role="alert" className="mt-2 text-caption text-[var(--admin-danger)]">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
