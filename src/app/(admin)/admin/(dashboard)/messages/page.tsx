import { requireRole } from '@/lib/admin/auth';
import { getContactAttachmentUrls, listContactMessages } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { MessageToggle } from '@/components/admin/MessageToggle';
import { AdminIcon } from '@/components/admin/AdminIcons';

export const dynamic = 'force-dynamic';

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

export default async function AdminMessagesPage() {
  await requireRole('editor');
  const messages = await listContactMessages();
  const attachmentUrls = await getContactAttachmentUrls(
    messages.flatMap((message) => message.attachments.map((attachment) => attachment.path)),
  );

  return (
    <>
      <AdminHeader
        title="פניות מהאתר"
        description="פניות שהתקבלו בטופס יצירת הקשר. נשמרות במסד ואינן נשלחות בדואר."
      />

      {messages.length === 0 ? (
        <p className="text-muted">אין פניות.</p>
      ) : (
        <ul className="border-t border-rule">
          {messages.map((message) => (
            <li key={message.id} className="border-b border-rule py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <p className="font-semibold text-ink">
                    {message.name}
                    {message.subject ? (
                      <span className="font-normal text-muted"> — {message.subject}</span>
                    ) : null}
                  </p>
                  <p className="mt-1 text-caption text-muted" dir="ltr">
                    <a href={`mailto:${message.email}`} className="underline underline-offset-4">
                      {message.email}
                    </a>
                    {message.phone ? ` · ${message.phone}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <time
                    dateTime={message.created_at}
                    className="text-caption tabular-nums text-muted"
                  >
                    {new Intl.DateTimeFormat('he-IL', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                      timeZone: 'Asia/Jerusalem',
                    }).format(new Date(message.created_at))}
                  </time>
                  <MessageToggle id={message.id} handled={message.is_handled} />
                </div>
              </div>
              <p className="mt-3 max-w-[70ch] whitespace-pre-wrap text-small text-ink-soft">
                {message.message}
              </p>
              {message.attachments.length > 0 ? (
                <ul className="mt-3 flex flex-wrap gap-2">
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
                          <span className="admin-badge admin-badge-neutral">
                            {attachment.name} — הקישור אינו זמין כרגע
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
