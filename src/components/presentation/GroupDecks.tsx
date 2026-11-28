import { useEffect, useRef, useState } from 'react';
import decksJson from '../../../data/decks.json';
import { assetUrl } from '../../lib/data';

interface Deck {
  id: string;
  title: string;
  description: string;
  source: string;
  pages: number;
  path: string;
  widths: number[];
  notes: string[];
}
const decks = decksJson as Record<string, Deck[]>;

const pageSrc = (d: Deck, page: number, w: number) => assetUrl(`${d.path}-${String(page).padStart(2, '0')}-${w}.webp`);
const pageSrcSet = (d: Deck, page: number) => d.widths.map((w) => `${pageSrc(d, page, w)} ${w}w`).join(', ');

/** Decks the group made themselves (e.g. exported from Canva), shown alongside the researched slides. */
export function GroupDecks({ destinationId }: { destinationId: string }) {
  const list = decks[destinationId] ?? [];
  if (list.length === 0) return null;
  return (
    <>
      {list.map((d) => (
        <DeckSection key={d.id} deck={d} />
      ))}
    </>
  );
}

function DeckSection({ deck }: { deck: Deck }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <section className="mt-10 border-t border-slate-ink/12 pt-8" aria-labelledby={`deck-${deck.id}`}>
      <p className="eyebrow text-bronze-600">From the group · {deck.pages} pages</p>
      <h2 id={`deck-${deck.id}`} className="mt-1 text-2xl font-semibold">
        {deck.title}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{deck.description}</p>
      <ul className="mt-4 flex snap-x gap-2 overflow-x-auto pb-2" data-noswipe>
        {Array.from({ length: deck.pages }, (_, i) => i + 1).map((p) => (
          <li key={p} className="flex-none snap-start">
            <button type="button" onClick={() => setOpen(p)} className="group block w-44 overflow-hidden rounded-sm border border-slate-ink/12 bg-midnight-900 sm:w-52" aria-label={`Open page ${p} of ${deck.title}`}>
              <img src={pageSrc(deck, p, 480)} alt="" loading="lazy" decoding="async" className="aspect-video w-full object-cover transition-opacity group-hover:opacity-85" />
              <span className="num block px-2 py-1 text-left text-[0.68rem] text-ivory/70">Page {p}</span>
            </button>
          </li>
        ))}
      </ul>
      <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
        {deck.notes.map((n) => (
          <li key={n}>· {n}</li>
        ))}
        <li>· {deck.source}</li>
      </ul>
      {open !== null && <DeckViewer deck={deck} page={open} onPage={setOpen} onClose={() => setOpen(null)} />}
    </section>
  );
}

function DeckViewer({ deck, page, onPage, onClose }: { deck: Deck; page: number; onPage: (p: number) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const prev = () => onPage(Math.max(1, page - 1));
  const next = () => onPage(Math.min(deck.pages, page + 1));
  const touchX = useRef<number | null>(null);
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
      className="m-auto h-full max-h-none w-full max-w-none bg-midnight-950 p-0 text-ivory backdrop:bg-black/80"
      aria-label={`${deck.title}, page ${page} of ${deck.pages}`}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
          <span className="truncate font-display">{deck.title}</span>
          <span className="num text-ivory/60">
            {page} / {deck.pages}
          </span>
          <button type="button" className="rounded-sm px-2 py-1 text-ivory/80 hover:bg-white/10" onClick={() => ref.current?.close()} autoFocus>
            ✕ Close
          </button>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
          <img key={page} src={pageSrc(deck, page, 1600)} srcSet={pageSrcSet(deck, page)} sizes="100vw" alt={`${deck.title} — page ${page}`} className="max-h-full max-w-full object-contain" />
          <button type="button" onClick={prev} disabled={page === 1} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-xl disabled:opacity-20" aria-label="Previous page">
            ‹
          </button>
          <button type="button" onClick={next} disabled={page === deck.pages} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-2 text-xl disabled:opacity-20" aria-label="Next page">
            ›
          </button>
        </div>
      </div>
    </dialog>
  );
}
