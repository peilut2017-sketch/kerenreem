import { SectionHeading } from '@/components/SectionHeading';
import { Reveal } from '@/components/Reveal';
import { localized } from '@/lib/localized';
import type { Tag } from '@/lib/supabase/types';

/** תגיות מערכת (ראו SYSTEM_EXPLANATIONS ב-SmartTag.tsx) — תג שיווקי, לא נושא תוכן */
const SYSTEM_TAG_SLUGS = new Set(['new', 'bestseller']);

/**
 * "מרחב ידע" (ט.17, ביקורת ב.10) — תגיות הנושא של הספר עם ההסבר שלהן
 * (tags.description_he), שעד כה היו חבויות כ-Tooltip קטן ב-Hero בלבד
 * (SmartTag) ומוגבלות לשלוש התגיות הראשונות שמוצגות שם.
 */
export function KnowledgeSpace({
  tags,
  locale,
  title,
}: {
  tags: Pick<Tag, 'id' | 'slug' | 'name_he' | 'name_en' | 'description_he'>[];
  locale: string;
  title: string;
}) {
  const entries = tags.filter((tag) => !SYSTEM_TAG_SLUGS.has(tag.slug) && tag.description_he);
  if (entries.length === 0) return null;

  return (
    <section aria-labelledby="book-knowledge">
      <SectionHeading level={2} title={title} id="book-knowledge" />
      <div className="grid gap-6 sm:grid-cols-2">
        {entries.map((tag, index) => (
          <Reveal key={tag.id} delay={index * 80}>
            <div className="h-full rounded-[var(--radius-lg)] border border-rule bg-cream px-7 py-6 shadow-[var(--shadow-soft)]">
              <h3 className="font-serif text-lead text-ink">{localized(tag, 'name', locale)}</h3>
              <p className="mt-2 text-small leading-relaxed text-ink-soft">{tag.description_he}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
