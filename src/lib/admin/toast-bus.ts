'use client';

/**
 * [1.10] ערוץ מינימלי להודעות "נשמר בהצלחה" בממשק הניהול.
 *
 * לא Context: EntityForm קורא ל-showAdminToast() ברגע שהשמירה מצליחה,
 * ואז בדרך כלל מנווט משם מיד (סגירת כרטיס / חזרה לרשימה) — כדי
 * שההודעה תישאר גלויה גם אחרי הניווט, ToastHost מורכב פעם אחת ברמת
 * הפריסה (DashboardLayout), לא בתוך העמוד שמתחלף. Context היה עובד
 * טכנית (הפריסה אכן לא נטענת מחדש בניווט בין עמודי הניהול), אבל היה
 * מחייב לספק Provider בפריסה ולצרוך אותו בכל טופס — מנוי/פרסום גלובלי
 * פשוט יותר לאותו צורך: קורא יחיד (ToastHost) ומפרסמים רבים (כל טופס).
 */

type Listener = (message: string) => void;

const listeners = new Set<Listener>();

export function showAdminToast(message: string): void {
  listeners.forEach((listener) => listener(message));
}

export function subscribeAdminToast(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
