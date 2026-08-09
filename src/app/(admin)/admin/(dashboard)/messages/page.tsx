import { requireScreenPermission } from '@/lib/admin/auth';
import { getContactAttachmentUrls, listContactFields, listContactMessages } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { MessagesInbox } from '@/components/admin/MessagesInbox';

export const dynamic = 'force-dynamic';

export default async function AdminMessagesPage() {
  const session = await requireScreenPermission('messages', 'view');
  const [messages, fields] = await Promise.all([listContactMessages(), listContactFields()]);
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
        fields={fields}
        canDelete={session.profile.role === 'admin'}
      />
    </>
  );
}
