/**
 * הטמעת וידאו מ-YouTube או Vimeo.
 *
 * מקבל את הכתובת כפי שהעורך הדביק (צפייה, share, embed) וממיר לכתובת
 * הטמעה. כל מקור אחר מוחזר כ-null — לא מטמיעים iframe שרירותי.
 */

export function toEmbedUrl(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1);
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }

    if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'm.youtube.com') {
      if (parsed.pathname.startsWith('/embed/')) {
        return `https://www.youtube-nocookie.com${parsed.pathname}`;
      }
      const id = parsed.searchParams.get('v');
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }

    if (host === 'vimeo.com') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return /^\d+$/.test(id ?? '') ? `https://player.vimeo.com/video/${id}` : null;
    }

    if (host === 'player.vimeo.com') return parsed.toString();

    return null;
  } catch {
    return null;
  }
}

export function VideoEmbed({
  url,
  title,
  className = '',
}: {
  url: string | null | undefined;
  /** חובה: iframe בלי שם נגיש הוא מלכודת לקורא מסך. */
  title: string;
  className?: string;
}) {
  const embedUrl = toEmbedUrl(url);
  if (!embedUrl) return null;

  return (
    <iframe
      src={embedUrl}
      title={title}
      loading="lazy"
      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      referrerPolicy="strict-origin-when-cross-origin"
      allowFullScreen
      className={`aspect-video w-full border border-rule ${className}`}
    />
  );
}
