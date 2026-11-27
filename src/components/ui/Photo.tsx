import { useState } from 'react';
import type { ImageCredit } from '../../types/destination';
import { imageSrc, imageSrcSet } from '../../lib/data';

interface PhotoProps {
  credit: ImageCredit | undefined;
  sizes?: string;
  className?: string;
  imgClassName?: string;
  priority?: boolean;
  showCredit?: boolean;
  caption?: boolean;
  aspect?: string;
}

/** Responsive, lazy-loaded documentary photograph with visible attribution. */
export function Photo({ credit, sizes = '(min-width: 1024px) 50vw, 100vw', className = '', imgClassName = '', priority = false, showCredit = true, caption = false, aspect }: PhotoProps) {
  const [failed, setFailed] = useState(false);
  if (!credit || failed) {
    return (
      <div className={`flex items-center justify-center bg-sand-200/70 text-xs text-slate-500 ${className}`} style={aspect ? { aspectRatio: aspect } : undefined}>
        {credit ? 'Photograph unavailable' : 'No photograph'}
      </div>
    );
  }
  return (
    <figure className={`relative overflow-hidden bg-sand-200 ${className}`} style={aspect ? { aspectRatio: aspect } : undefined}>
      <img
        src={imageSrc(credit.path, credit.widths.includes(960) ? 960 : credit.widths[0])}
        srcSet={imageSrcSet(credit.path, credit.widths)}
        sizes={sizes}
        alt={credit.alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={priority ? 'high' : 'auto'}
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover ${imgClassName}`}
      />
      {caption && credit.caption && (
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2 pt-8 text-[0.72rem] leading-snug text-ivory">
          {credit.caption}
        </figcaption>
      )}
      {showCredit && (
        <a
          href={credit.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-1 top-1 max-w-[70%] truncate rounded-sm bg-black/45 px-1.5 py-0.5 text-[0.6rem] text-ivory/85 opacity-80 transition-opacity hover:opacity-100"
          title={`${credit.attribution} — ${credit.location}`}
        >
          © {credit.photographer} · {credit.licence}
        </a>
      )}
    </figure>
  );
}
