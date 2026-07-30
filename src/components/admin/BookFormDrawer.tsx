'use client';

import { useId } from 'react';
import { useRouter } from 'next/navigation';
import { Drawer } from '../Drawer';

/**
 * מעטפת המגירה למסך עריכה/יצירה מיורט. הסגירה חוזרת בהיסטוריה — לא
 * מנווטת אל /admin/books במפורש — כדי שאם המשתמש הגיע דרך קישור אחר
 * (למשל מרשימת מחברים) הוא יחזור לשם ולא ל"רשימת ספרים" תמיד.
 */
export function BookFormDrawer({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  const titleId = useId();

  return (
    <Drawer
      open
      onClose={() => router.back()}
      titleId={titleId}
      title={title}
      widthClassName="max-w-3xl"
    >
      {children}
    </Drawer>
  );
}
