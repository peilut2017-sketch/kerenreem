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

/**
 * תמונת תצוגה מקדימה ל"וידאו דינמי" — כרזה איכותית שנפתחת ל-iframe
 * בלחיצה, ולא iframe מיד. YouTube חושף thumbnail קבוע לפי מזהה הסרטון
 * בלי שום קריאת API; Vimeo דורש קריאת oEmbed נפרדת לכך, ולכן מוחזר null
 * (הרכיב הקורא נופל לרקע גנרי עם כפתור נגן).
 */
export function getYouTubeThumbnail(url: string | null | undefined): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    let id: string | null = null;

    if (host === 'youtu.be') id = parsed.pathname.slice(1) || null;
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'm.youtube.com') {
      id = parsed.pathname.startsWith('/embed/')
        ? parsed.pathname.slice('/embed/'.length)
        : parsed.searchParams.get('v');
    }

    // i.ytimg.com ולא img.youtube.com: זה המקור המותר ב-CSP img-src של
    // האתר (ראו next.config / middleware) — הראשון נחסם בפועל בדפדפן
    // בלי לזרוק שגיאת JS, רק תמונה שבורה בשקט.
    return id ? `https://i.ytimg.com/vi/${id}/maxresdefault.jpg` : null;
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
