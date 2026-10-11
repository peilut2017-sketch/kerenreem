'use client';

import { useEffect } from 'react';

/**
 * מזין את מיקום הסמן לכרטיסים עם המחלקה .spotlight (globals.css) ולכרטיסי
 * הסטטיסטיקה של הניהול, .admin-stat (admin.css), כדי שיציירו זוהר שעוקב אחריו.
 *
 * מאזין אחד על המסמך לכל האתר, ולא מאזין וחישוב לכל כרטיס: בדף עם עשרות
 * כרטיסים זה ההבדל בין עלות אפסית לעלות שגדלה עם התוכן. הכתיבה היא למשתני
 * CSS ישירות על ה-DOM, בלי state של React, ורק פעם אחת בפריים.
 *
 * מופעל רק במכשיר עם עכבר. במגע אין hover, והזוהר לא היה מופיע ממילא.
 */
export function PointerGlow() {
  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

    let frame = 0;
    let latest: PointerEvent | null = null;

    function update() {
      frame = 0;
      const event = latest;
      latest = null;
      if (!event || !(event.target instanceof Element)) return;
      const card = event.target.closest<HTMLElement>('.spotlight, .admin-stat');
      if (!card) return;
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--sx', `${event.clientX - rect.left}px`);
      card.style.setProperty('--sy', `${event.clientY - rect.top}px`);
    }

    function onMove(event: PointerEvent) {
      latest = event;
      if (!frame) frame = requestAnimationFrame(update);
    }

    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
