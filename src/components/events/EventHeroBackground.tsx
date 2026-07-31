'use client';

import { useEffect, useRef } from 'react';
import { Img as Image } from '@/components/Img';
import { useReducedMotion } from '@/lib/client-hooks';

/**
 * רקע ה-Hero של האירוע: תמונת השער עם פרלקס עדין בגלילה, אותו דפוס rAF
 * בדיוק כמו HeroBackground בעמוד הספר (שם הרקע הוא צבעי כריכה; כאן
 * תמונה אמיתית, ולכן scale קל נוסף כדי שהקצוות לא ייחשפו בתזוזה).
 */
export function EventHeroBackground({ src }: { src: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node || reducedMotion) return;

    let ticking = false;
    function update() {
      const offset = Math.min(window.scrollY * 0.25, 90);
      node!.style.transform = `translateY(${offset}px) scale(1.12)`;
      ticking = false;
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [reducedMotion]);

  return (
    <div ref={ref} className="absolute inset-0 scale-110">
      <Image src={src} alt="" fill sizes="100vw" priority className="object-cover" />
    </div>
  );
}
