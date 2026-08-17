import { notFound } from 'next/navigation';
import { screenAccess, requireScreenPermission } from '@/lib/admin/auth';
import {
  getEvent,
  getEventBlocks,
  getEventChaptersAdmin,
  getEventMediaAdmin,
  getEventViewCount,
} from '@/lib/admin/queries';
import { AdminHeader } from '@/components/admin/AdminList';
import { EventForm } from '@/components/admin/EventForm';
import { EventBlocksEditor } from '@/components/admin/EventBlocksEditor';
import { EventStoryMediaManager } from '@/components/admin/EventStoryMediaManager';

export const dynamic = 'force-dynamic';

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, requireScreenPermission('events', 'view')]);
  const canWrite = (await screenAccess(session, 'events')).edit;
  const [event, blocks, media, chapters] = await Promise.all([
    getEvent(id),
    getEventBlocks(id),
    getEventMediaAdmin(id),
    getEventChaptersAdmin(id),
  ]);
  if (!event) notFound();
  const viewCount = await getEventViewCount(event.slug);

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <AdminHeader title={event.title_he} />
        <span className="admin-badge admin-badge-neutral shrink-0" title="צפיות בעמוד האירוע (משתי השפות)">
          {viewCount.toLocaleString('he-IL')} צפיות
        </span>
      </div>
      <EventForm event={event} canWrite={canWrite} />

      {/* [1.11] Event Story Gallery — מדיית האירוע: העלאה מרובה, גרירה
          לסדר, שלבים, כתוביות. מחליף את גלריית ה-jsonb הישנה; אירוע בלי
          פריטים כאן ממשיך להציג את הגלריה הישנה באתר. */}
      {canWrite ? (
        <div className="mt-10">
          <EventStoryMediaManager eventId={id} media={media} chapters={chapters} />
        </div>
      ) : null}

      {/* מחוץ לטופס הראשי בכוונה: טבלה נפרדת עם שמירה משלה (ראו
          saveEventBlocks) — בתוך אותו <form> היה הופך Enter בתוך textarea
          כאן לשליחה בטעות של כל טופס האירוע. */}
      <div className="mt-10 border-t border-rule pt-8">
        <h2 className="eyebrow mb-4">רצף הסיפור (טקסט שזור)</h2>
        <p className="mb-4 text-caption text-muted">
          פסקאות, ציטוטים ותמונות בודדות השזורים בגוף העמוד, לפני הגלריה. תקציר האירוע
          למעלה נשאר נפרד — הוא מוצג ליד ה-Hero, לפני תחילת הרצף.
        </p>
        <EventBlocksEditor eventId={id} blocks={blocks} />
      </div>
    </>
  );
}
