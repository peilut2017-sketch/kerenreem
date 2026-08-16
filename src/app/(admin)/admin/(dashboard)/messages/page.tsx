import { requireScreenPermission } from '@/lib/admin/auth';
import {
  getContactAttachmentUrls,
  listContactFields,
  listContactMessages,
  listContactReplies,
} from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { InquiriesInbox } from '@/components/admin/InquiriesInbox';

export const dynamic = 'force-dynamic';

export default async function AdminMessagesPage() {
  const session = await requireScreenPermission('messages', 'view');
  const [messages, fields, replies] = await Promise.all([
    listContactMessages(),
    listContactFields(),
    listContactReplies(),
  ]);
  const attachmentUrls = await getContactAttachmentUrls(
    messages.flatMap((message) => message.attachments.map((attachment) => attachment.path)),
  );

  return (
    <>
      <AdminHeader
        title="פניות מהאתר"
        description="פניות כלליות והערות והארות על ספרים. לחיצה על פנייה פותחת אותה — עם אפשרות מענה בדואר, שינוי סטטוס ושרשור המענות."
      />
      <InquiriesInbox
        messages={messages}
        replies={replies}
        attachmentUrls={attachmentUrls}
        fields={fields}
        canDelete={session.profile.role === 'admin'}
      />
    </>
  );
}
