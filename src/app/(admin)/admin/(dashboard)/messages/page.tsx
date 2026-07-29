import { requireRole } from '@/lib/admin/auth';
import { listContactMessages } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { MessageToggle } from '@/components/admin/MessageToggle';

export const dynamic = 'force-dynamic';

export default async function AdminMessagesPage() {
  await requireRole('editor');
  const messages = await listContactMessages();

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
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
