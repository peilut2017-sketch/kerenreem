'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { SectionHeading } from '@/components/SectionHeading';

export interface KnowledgeMapNode {
  id: string;
  label: string;
  count: number;
}

const WIDTH = 900;
const HEIGHT = 360;
const CENTER_RADIUS = 60;
const BRANCH_RADIUS = 46;
const ORBIT = 180;

/**
 * מרחב הידע כגרף רדיאלי: הספר הזה במרכז, וענפים (מחבר, נושא, סדרה,
 * תגיות) פזורים סביבו לפי טריגונומטריה — לא רשימה אופקית של שבבים.
 *
 * זו גרסה ברמה אחת ולא עץ מתרחב: לכל ענף כבר יש רק את המספר שלו (כמה
 * ספרים), לא תת-רשימה של קטגוריות-משנה אמיתיות שהיה אפשר לפרוש מתחתיו.
 * "עלים" מדומים היו בדיוק הניחוש-כעובדה שהמסמך המקורי של שלב ג׳ נמנע
 * ממנו במכוון (ראו ההערה בתחתית 10_book_page_stage_c.sql). לחיצה על ענף
 * גוללת אל הקרוסלה שלו במקום לפתוח עלים שאין מאחוריהם נתון אמיתי.
 *
 * הפריסה מחושבת ב-JS ולא בספריית גרפים: יש כאן צומת מרכזי קבוע וכמה
 * ענפים במעגל סביבו — טריגונומטריה פשוטה, בלי צורך בפיזיקה או גרירה.
 */
export function KnowledgeMap({ nodes, title }: { nodes: KnowledgeMapNode[]; title: string }) {
  const t = useTranslations('books');
  const visible = nodes.filter((node) => node.count > 0);

  const positioned = useMemo(() => {
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2;
    return visible.map((node, index) => {
      const angle = (-90 + index * (360 / visible.length)) * (Math.PI / 180);
      return {
        ...node,
        x: cx + Math.cos(angle) * ORBIT,
        y: cy + Math.sin(angle) * ORBIT,
      };
    });
  }, [visible]);

  if (visible.length === 0) return null;

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const cx = WIDTH / 2;
  const cy = HEIGHT / 2;

  return (
    <section aria-labelledby="book-knowledge-map" className="on-dark overflow-hidden rounded-[var(--radius-lg)] p-6 sm:p-9">
      <SectionHeading level={2} title={t('navKnowledgeMap')} id="book-knowledge-map" />
      <p className="-mt-6 mb-6 text-caption text-cream-2/70">{t('knowledgeMapHint')}</p>

      <div className="overflow-x-auto">
        <div
          className="relative mx-auto"
          style={{ width: WIDTH, height: HEIGHT, minWidth: WIDTH }}
        >
          <svg
            aria-hidden="true"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="absolute inset-0 h-full w-full"
          >
            {positioned.map((node) => (
              <line
                key={node.id + node.label}
                x1={cx}
                y1={cy}
                x2={node.x}
                y2={node.y}
                stroke="rgb(216 196 155 / 0.35)"
              />
            ))}
          </svg>

          {/* צומת מרכזי — הספר הזה */}
          <div
            className="absolute flex flex-col items-center justify-center rounded-full text-center"
            style={{
              left: cx - CENTER_RADIUS,
              top: cy - CENTER_RADIUS,
              width: CENTER_RADIUS * 2,
              height: CENTER_RADIUS * 2,
              background:
                'radial-gradient(circle at 35% 30%, color-mix(in srgb, var(--color-gold-bright) 92%, white), var(--color-gold))',
              boxShadow: '0 0 40px color-mix(in srgb, var(--color-gold) 45%, transparent)',
            }}
          >
            <span className="px-3 font-serif text-small leading-tight text-navy">{title}</span>
            <span className="mt-0.5 text-[0.6875rem] text-navy/70">{t('knowledgeMapCenterLabel')}</span>
          </div>

          {positioned.map((node) => (
            <button
              key={node.id + node.label}
              type="button"
              onClick={() => scrollToSection(node.id)}
              className="absolute flex flex-col items-center justify-center gap-0.5 rounded-full border border-gold/40 bg-white/[0.06] text-center backdrop-blur-sm transition-all duration-300 ease-[var(--ease-spring)] hover:border-gold hover:bg-white/[0.12]"
              style={{
                left: node.x - BRANCH_RADIUS,
                top: node.y - BRANCH_RADIUS,
                width: BRANCH_RADIUS * 2,
                height: BRANCH_RADIUS * 2,
              }}
            >
              <span className="px-2 font-serif text-small leading-tight text-cream">{node.label}</span>
              <span className="text-caption text-gold-bright tabular-nums">{node.count}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
