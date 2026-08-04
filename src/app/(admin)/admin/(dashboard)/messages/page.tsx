import { requireRole } from '@/lib/admin/auth';
import { getContactAttachmentUrls, listContactMessages } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { MessagesInbox } from '@/components/admin/MessagesInbox';

export const dynamic = 'force-dynamic';

export default async function AdminMessagesPage() {
  const session = await requireRole('editor');
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
      <MessagesInbox
        messages={messages}
        attachmentUrls={attachmentUrls}
        canDelete={session.profile.role === 'admin'}
      />
    </>
  );
}
