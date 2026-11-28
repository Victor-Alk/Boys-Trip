import { useEffect, useRef, useState } from 'react';
import type { ImageCredit } from '../../types/destination';
import { imageSrc, imageSrcSet } from '../../lib/data';

/** Every photograph of a trip with its description, place and credit; opens a full-screen viewer. */
export function PhotoGallery({ credits, title }: { credits: Map<string, ImageCredit>; title: string }) {
  const photos = [...credits.values()].sort((a, b) => a.id.localeCompare(b.id));
  const [open, setOpen] = useState<number | null>(null);
  if (photos.length === 0) return null;
  return (
    <section className="mt-10" aria-labelledby="gallery-title">
      <div className="flex items-end justify-between gap-3">
        <h2 id="gallery-title" className="text-2xl font-semibold">
          Photo gallery
        </h2>
        <span className="num text-xs text-slate-500">{photos.length} photographs of places on this route</span>
      </div>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {photos.map((c, i) => (
          <li key={c.id}>
            <figure>
              <button type="button" onClick={() => setOpen(i)} className="group block w-full overflow-hidden rounded-sm bg-sand-200" aria-label={`Enlarge: ${c.alt}`}>
                <img
                  src={imageSrc(c.path, c.widths.includes(960) ? 960 : c.widths[0])}
                  srcSet={imageSrcSet(c.path, c.widths)}
                  sizes="(min-width: 1280px) 18vw, (min-width: 640px) 27vw, 90vw"
                  alt={c.alt}
                  loading="lazy"
                  decoding="async"
                  className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
              </button>
              <figcaption className="mt-2 text-sm leading-snug">
                <span className="block font-medium text-slate-ink">{c.caption || c.alt}</span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  📍 {c.location} ·{' '}
                  <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline decoration-slate-300 underline-offset-2 hover:decoration-bronze-600">
                    {c.photographer}, {c.licence}
                  </a>
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
      {open !== null && <Lightbox photos={photos} index={open} onIndex={setOpen} onClose={() => setOpen(null)} title={title} />}
    </section>
  );
}

function Lightbox({ photos, index, onIndex, onClose, title }: { photos: ImageCredit[]; index: number; onIndex: (i: number) => void; onClose: () => void; title: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const touchX = useRef<number | null>(null);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  const c = photos[index];
  const prev = () => onIndex((index - 1 + photos.length) % photos.length);
  const next = () => onIndex((index + 1) % photos.length);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') next();
        else if (e.key === 'ArrowLeft') prev();
      }}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (Math.abs(dx) > 60) (dx < 0 ? next : prev)();
      }}
      className="m-auto h-full max-h-none w-full max-w-none bg-midnight-950 p-0 text-ivory backdrop:bg-black/85"
      aria-label={`${title} — photo ${index + 1} of ${photos.length}`}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
          <span className="truncate font-display">{title}</span>
          <span className="num text-ivory/60">
            {index + 1} / {photos.length}
          </span>
          <button type="button" className="rounded-sm px-2 py-1 text-ivory/80 hover:bg-white/10" onClick={() => ref.current?.close()} autoFocus>
            ✕ Close
          </button>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
          <img key={c.id} src={imageSrc(c.path, Math.max(...c.widths))} srcSet={imageSrcSet(c.path, c.widths)} sizes="100vw" alt={c.alt} className="max-h-full max-w-full object-contain" />
          <button type="button" onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-xl" aria-label="Previous photo">
            ‹
          </button>
          <button type="button" onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-xl" aria-label="Next photo">
            ›
          </button>
        </div>
        <div className="mx-auto w-full max-w-3xl px-4 pb-4 pt-3 text-sm">
          <p className="leading-relaxed">{c.caption || c.alt}</p>
          <p className="mt-1 text-xs text-ivory/60">
            📍 {c.location} · {c.attribution} ·{' '}
            <a href={c.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
              source
            </a>
          </p>
        </div>
      </div>
    </dialog>
  );
}
