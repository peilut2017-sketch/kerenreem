'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { useReducedMotion } from '@/lib/client-hooks';
import type { LightboxImage } from './EventLightbox';

/**
 * פס זיכרונות — רגעים קטנים בין קטעי התוכן, לא עוד גלריה אינטראקטיבית.
 * לכן בלי Lightbox: התפקיד שלו קצבי-אווירתי, כמו פס פילם, ואותן תמונות
 * בדיוק ניתנות ללחיצה בהמשך בגלריה המסיימת.
 *
 * הפרלקס העדין (לא scale כמו ScrollFocus, אלא translateX) משתמש באותו
 * דפוס rAF+scroll כמו HeroBackground בעמוד הספר.
 */
export function MemoryStrip({ images }: { images: LightboxImage[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const node = trackRef.current;
    if (!node || reducedMotion) return;

    let ticking = false;
    function update() {
      const rect = node!.parentElement!.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const distance = rect.top + rect.height / 2 - viewportCenter;
      // תזוזה עדינה ומוגבלת: פרלקס, לא קרוסלה שנעה לבד
      const offset = Math.max(-24, Math.min(24, distance * -0.04));
      node!.style.transform = `translateX(${offset}px)`;
      ticking = false;
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [reducedMotion]);

  if (images.length === 0) return null;

  return (
    <div className="overflow-hidden py-1" aria-hidden="true">
      <div ref={trackRef} className="flex gap-3">
        {images.map((image) => (
          <div
            key={image.url}
            className="relative h-24 w-32 shrink-0 overflow-hidden rounded-[var(--radius-md)] sm:h-28 sm:w-40"
          >
            <Image src={image.url} alt="" fill sizes="160px" className="object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}
