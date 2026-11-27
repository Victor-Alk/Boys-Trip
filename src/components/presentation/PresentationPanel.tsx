import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { navigate } from '../../lib/router';
import { useDestination } from '../../hooks/useDestination';
import { summaries } from '../../lib/data';
import { SlideExperience } from './SlideExperience';
import { SlideJourney } from './SlideJourney';
import { SlideReality } from './SlideReality';
import { EvaluationPanel } from '../voting/EvaluationPanel';
import { PortfolioCover } from './PortfolioCover';
import { useEvaluations } from '../../state/evaluations';
import { useSession } from '../../state/session';

export const SLIDES = [
  { n: 1, label: 'The Experience', question: 'Why should we go there?' },
  { n: 2, label: 'The Journey', question: 'What would we actually do?' },
  { n: 3, label: 'The Practical Reality', question: 'Can we realistically do it?' },
] as const;

const LAST_SLIDE_KEY = 'ge-last-slide';

interface Props {
  destinationId: string | null;
  slide: 1 | 2 | 3;
  evaluate: boolean;
}

export function PresentationPanel({ destinationId, slide, evaluate }: Props) {
  const { data, credits, loading, error } = useDestination(destinationId);
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [pseudoFs, setPseudoFs] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const { responses, pending, drafts } = useEvaluations();
  const { session } = useSession();

  const go = useCallback(
    (target: { slide?: 1 | 2 | 3; evaluate?: boolean }) => {
      if (!destinationId) return;
      navigate({ page: 'explore', destinationId, slide: target.slide ?? 1, evaluate: !!target.evaluate }, { replace: true });
    },
    [destinationId],
  );

  // Remember the last viewed slide per destination so the user can explicitly resume it.
  useEffect(() => {
    if (!destinationId || evaluate) return;
    try {
      const all = JSON.parse(sessionStorage.getItem(LAST_SLIDE_KEY) ?? '{}');
      all[destinationId] = slide;
      sessionStorage.setItem(LAST_SLIDE_KEY, JSON.stringify(all));
    } catch {
      /* ignore */
    }
  }, [destinationId, slide, evaluate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [destinationId, slide, evaluate]);

  const next = useCallback(() => {
    if (evaluate) return;
    if (slide < 3) go({ slide: (slide + 1) as 2 | 3 });
    else go({ evaluate: true });
  }, [slide, evaluate, go]);
  const prev = useCallback(() => {
    if (evaluate) go({ slide: 3 });
    else if (slide > 1) go({ slide: (slide - 1) as 1 | 2 });
  }, [slide, evaluate, go]);

  // Keyboard navigation (ignored while typing or inside the map).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable], .maplibregl-map, [role="radiogroup"], dialog')) return;
      if (!destinationId) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prev();
      } else if (e.key === 'Escape' && pseudoFs) setPseudoFs(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, destinationId, pseudoFs]);

  // Touch swipe on the slide body.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.maplibregl-map, input, textarea, [data-noswipe]')) return;
    touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touch.current) return;
    const dx = e.changedTouches[0].clientX - touch.current.x;
    const dy = e.changedTouches[0].clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) (dx < 0 ? next : prev)();
  };

  useEffect(() => {
    const onFs = () => setIsFs(document.fullscreenElement === panelRef.current);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  const toggleFullscreen = async () => {
    const el = panelRef.current;
    if (!el) return;
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (pseudoFs) setPseudoFs(false);
    else if (el.requestFullscreen && document.fullscreenEnabled) await el.requestFullscreen().catch(() => setPseudoFs(true));
    else setPseudoFs(true);
  };
  const fullscreen = isFs || pseudoFs;

  if (!destinationId) {
    return (
      <div className="h-full overflow-y-auto panel-scroll bg-paper">
        <PortfolioCover />
      </div>
    );
  }

  const idx = summaries.findIndex((s) => s.id === destinationId);
  const prevDest = summaries[(idx - 1 + summaries.length) % summaries.length];
  const nextDest = summaries[(idx + 1) % summaries.length];
  const summary = summaries[idx];
  const evaluated = responses.has(destinationId);
  const hasPending = !!pending[destinationId];
  const hasDraft = !!drafts[destinationId];

  let body: ReactNode;
  if (error) body = <p className="p-8 text-red-warn">Could not load this destination: {error}</p>;
  else if (loading || !data) body = <SlideSkeleton />;
  // Keyed by participant: switching identity on a shared device must never show the previous person's answers.
  else if (evaluate) body = <EvaluationPanel key={`${destinationId}-${session?.participant.id ?? 'anonymous'}`} destination={data} onBack={() => go({ slide: 3 })} />;
  else if (slide === 1) body = <SlideExperience d={data} credits={credits} />;
  else if (slide === 2) body = <SlideJourney d={data} credits={credits} />;
  else body = <SlideReality d={data} credits={credits} onEvaluate={() => go({ evaluate: true })} />;

  return (
    <div
      ref={panelRef}
      className={`flex flex-col bg-paper ${pseudoFs ? 'fixed inset-0 z-50' : 'h-full'} ${fullscreen ? 'text-[1.03rem]' : ''}`}
      role="region"
      aria-label={`${summary?.country ?? ''} presentation`}
    >
      <div className="flex flex-none flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-ink/10 bg-paper/95 px-4 py-2 backdrop-blur lg:px-6">
        <div className="min-w-0 flex-1">
          <p className="eyebrow truncate text-bronze-600">
            {destinationId} · {summary?.country} <span className="text-slate-500">— {summary?.region}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <button type="button" className="rounded-sm px-2 py-1 text-slate-500 hover:bg-sand-100 hover:text-slate-ink" onClick={() => navigate({ page: 'explore', destinationId: prevDest.id })} title={`Previous destination: ${prevDest.country}`}>
            ↑ <span className="sr-only">Previous destination</span>
          </button>
          <button type="button" className="rounded-sm px-2 py-1 text-slate-500 hover:bg-sand-100 hover:text-slate-ink" onClick={() => navigate({ page: 'explore', destinationId: nextDest.id })} title={`Next destination: ${nextDest.country}`}>
            ↓ <span className="sr-only">Next destination</span>
          </button>
          <button type="button" className="rounded-sm px-2 py-1 text-slate-500 hover:bg-sand-100 hover:text-slate-ink" onClick={() => void toggleFullscreen()} aria-pressed={fullscreen}>
            {fullscreen ? 'Exit full screen' : 'Full screen'}
          </button>
          <button type="button" className="rounded-sm px-2 py-1 text-slate-500 hover:bg-sand-100 hover:text-slate-ink" onClick={() => navigate({ page: 'explore' })} aria-label="Close presentation">
            ✕
          </button>
        </div>
        <nav className="flex w-full gap-1 overflow-x-auto" aria-label="Slides">
          {SLIDES.map((s) => {
            const active = !evaluate && slide === s.n;
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => go({ slide: s.n })}
                aria-current={active ? 'step' : undefined}
                className={`group flex min-w-0 flex-1 items-baseline gap-1.5 border-b-2 px-1 pb-1.5 pt-1 text-left transition-colors ${
                  active ? 'border-bronze-600 text-slate-ink' : 'border-transparent text-slate-500 hover:border-slate-ink/20 hover:text-slate-ink'
                }`}
              >
                <span className="num font-display text-sm font-semibold">0{s.n}</span>
                <span className="truncate text-[0.8rem] font-medium">— {s.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => go({ evaluate: true })}
            aria-current={evaluate ? 'step' : undefined}
            className={`flex flex-none items-center gap-1.5 border-b-2 px-2 pb-1.5 pt-1 text-[0.8rem] font-semibold transition-colors ${
              evaluate ? 'border-bronze-600 text-bronze-700' : 'border-transparent text-bronze-600 hover:text-bronze-700'
            }`}
          >
            {evaluated ? '✓ Evaluated' : hasPending ? '⟳ Pending' : hasDraft ? '✎ Draft' : 'Evaluate'}
          </button>
        </nav>
      </div>

      <div ref={scrollRef} className="panel-scroll min-h-0 flex-1 overflow-y-auto" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div key={`${destinationId}-${slide}-${evaluate}`} className="fade-in">
          {body}
        </div>
      </div>

      {!evaluate && (
        <div className="flex flex-none items-center justify-between gap-3 border-t border-slate-ink/10 bg-paper px-4 py-2 lg:px-6">
          <button type="button" className="btn-ghost py-1.5 text-xs" onClick={prev} disabled={slide === 1}>
            ← Previous
          </button>
          <span className="num text-xs text-slate-500" aria-live="polite">
            Slide {slide} of 3 · {SLIDES[slide - 1].question}
          </span>
          {slide < 3 ? (
            <button type="button" className="btn-ghost py-1.5 text-xs" onClick={next}>
              Next →
            </button>
          ) : (
            <button type="button" className="btn-bronze py-1.5 text-xs" onClick={() => go({ evaluate: true })}>
              {evaluated ? 'Review my evaluation' : session ? 'Evaluate this expedition' : 'Evaluate this expedition'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function lastViewedSlide(id: string): 1 | 2 | 3 | null {
  try {
    const v = JSON.parse(sessionStorage.getItem(LAST_SLIDE_KEY) ?? '{}')[id];
    return v === 2 || v === 3 ? v : null;
  } catch {
    return null;
  }
}

function SlideSkeleton() {
  return (
    <div className="animate-pulse p-6">
      <div className="aspect-[16/8] w-full bg-sand-200" />
      <div className="mt-6 h-8 w-2/3 bg-sand-200" />
      <div className="mt-3 h-4 w-full bg-sand-100" />
      <div className="mt-2 h-4 w-5/6 bg-sand-100" />
    </div>
  );
}
