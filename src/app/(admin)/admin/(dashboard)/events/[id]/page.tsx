import { notFound } from 'next/navigation';
import { screenAccess, requireScreenPermission } from '@/lib/admin/auth';
import { getEvent, getEventBlocks } from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { EventForm } from '@/components/admin/EventForm';
import { EventBlocksEditor } from '@/components/admin/EventBlocksEditor';

export const dynamic = 'force-dynamic';

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, requireScreenPermission('events', 'view')]);
  const canWrite = (await screenAccess(session, 'events')).edit;
  const [event, blocks] = await Promise.all([getEvent(id), getEventBlocks(id)]);
  if (!event) notFound();

  return (
    <>
      <AdminHeader title={event.title_he} />
      <EventForm event={event} canWrite={canWrite} />

      {/* מחוץ לטופס הראשי בכוונה: טבלה נפרדת עם שמירה משלה (ראו
          saveEventBlocks) — בתוך אותו <form> היה הופך Enter בתוך textarea
          כאן לשליחה בטעות של כל טופס האירוע. */}
      <div className="mt-10 border-t border-rule pt-8">
        <h2 className="eyebrow mb-4">רצף הסיפור</h2>
        <p className="mb-4 text-caption text-muted">
          הרצף שמחליף את &quot;כל הטקסט ואז כל הגלריה בסוף&quot;: פסקאות, תמונות
          וסרטון לפי הסדר שבו הם יופיעו בעמוד. תקציר האירוע למעלה נשאר נפרד —
          הוא מוצג ליד ה-Hero, לפני תחילת הרצף.
        </p>
        <EventBlocksEditor eventId={id} blocks={blocks} />
      </div>
    </>
  );
}
