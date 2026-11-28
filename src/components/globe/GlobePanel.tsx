import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DestinationSummary } from '../../types/summary';
import { SecurityBadge, SecurityGlyph } from '../ui/Badges';
import { formatEUR } from '../../lib/budget';
import { bestTimingLabel, tagLabel } from '../../lib/labels';
import { DestinationPicker } from './DestinationPicker';
import { useSession } from '../../state/session';
import { useEvaluations } from '../../state/evaluations';

const GlobeView = lazy(() => import('./GlobeView'));

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Phones and tablets: no hover, so a tapped marker shows a preview card instead of jumping straight to its slides. */
function isTouchOnly(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(hover: none)').matches;
}

class GlobeBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(err: unknown) {
    console.warn('Globe failed to render; using the destination list instead.', err);
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

interface Props {
  destinations: DestinationSummary[];
  visibleIds: Set<string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  totalFor: (s: DestinationSummary) => number;
  /** Extra controls shown under the search box (trip categories). */
  overlay?: ReactNode;
}

export function GlobePanel({ destinations, visibleIds, selectedId, onSelect, totalFor, overlay }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [satellite, setSatellite] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [glOk] = useState(() => (typeof document !== 'undefined' ? webglAvailable() : false));
  const [touch] = useState(isTouchOnly);
  const filtered = visibleIds.size !== destinations.length;
  const highlight = useMemo(() => (filtered ? visibleIds : null), [filtered, visibleIds]);

  // Full-screen globe (phones): lock the page behind it and close with Escape.
  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setExpanded(false);
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [expanded]);

  const open = (id: string) => {
    setPreview(null);
    setExpanded(false);
    onSelect(id);
  };
  const onMarker = (id: string) => {
    if (touch) {
      setHover(null);
      setLegendOpen(false);
      setPreview(id);
    } else open(id);
  };
  const onHover = (id: string | null, rect: DOMRect | null) => {
    if (touch) return;
    if (!id || !rect || !panelRef.current) return setHover(null);
    const p = panelRef.current.getBoundingClientRect();
    setHover({ id, x: rect.left - p.left + rect.width / 2, y: rect.top - p.top });
  };
  const hovered = hover ? destinations.find((d) => d.id === hover.id) : null;
  const previewed = preview ? destinations.find((d) => d.id === preview) : null;

  const fallback = (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-ivory/80">
      <p className="font-display text-xl text-ivory">The 3D globe is unavailable on this device</p>
      <p className="max-w-sm text-sm">WebGL could not start. Every destination remains available through the search above and the comparison table below.</p>
    </div>
  );

  return (
    <div
      ref={panelRef}
      className={`${expanded ? 'fixed inset-0 z-50 h-[100svh]' : 'relative h-full min-h-[22rem]'} overflow-hidden bg-midnight-950 text-ivory`}
      aria-label={`Interactive globe of the ${destinations.length} expeditions`}
      role={expanded ? 'dialog' : undefined}
      aria-modal={expanded || undefined}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(52,80,111,0.55),rgba(8,17,29,0)_62%)]" />
      {glOk ? (
        <GlobeBoundary fallback={fallback}>
          <Suspense fallback={<div className="absolute inset-0 grid place-items-center text-sm text-ivory/60">Loading the globe…</div>}>
            <GlobeView
              destinations={destinations}
              selectedId={preview ?? selectedId}
              highlightedIds={highlight}
              onSelect={onMarker}
              onHover={onHover}
              satellite={satellite}
              resetSignal={resetSignal}
            />
          </Suspense>
        </GlobeBoundary>
      ) : (
        fallback
      )}

      {/* Fade behind the search and chips so markers passing underneath don't clutter them. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-32 bg-gradient-to-b from-midnight-950/85 via-midnight-950/45 to-transparent" />
      <div className="absolute inset-x-3 top-3 z-20 flex flex-col items-start gap-2">
        <DestinationPicker destinations={destinations} selectedId={selectedId} onSelect={open} />
        {overlay && <div className="max-w-full">{overlay}</div>}
      </div>

      {/* Bottom bar. Desktop: legend panel + buttons. Phones: a legend toggle and compact buttons. */}
      <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex items-end justify-between gap-2">
        <div className="pointer-events-auto flex flex-col items-start gap-1.5">
          <div id="globe-legend" className={`${legendOpen ? 'flex' : 'hidden'} flex-col gap-1.5 rounded-sm bg-midnight-950/80 px-3 py-2 text-[0.68rem] text-ivory/75 backdrop-blur-sm lg:flex`}>
            <span className="eyebrow text-[0.6rem] text-sand-400">Security</span>
            {(['eligible', 'conditional', 'excluded'] as const).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <SecurityGlyph status={s} className={s === 'eligible' ? 'text-emerald-300' : s === 'conditional' ? 'text-amber-300' : 'text-red-300'} />
                {s === 'eligible' ? 'Eligible (circle)' : s === 'conditional' ? 'Conditional (diamond)' : 'Excluded (square)'}
              </span>
            ))}
            <span className="mt-0.5 text-ivory/55">€+ exceptional · €! over €2,500</span>
          </div>
          <button type="button" className="btn-ghost-dark bg-midnight-950/60 px-2.5 py-1.5 text-xs backdrop-blur-sm lg:hidden" aria-expanded={legendOpen} aria-controls="globe-legend" onClick={() => setLegendOpen((v) => !v)}>
            {legendOpen ? 'Hide legend' : 'Legend'}
          </button>
        </div>
        <div className="pointer-events-auto flex flex-wrap justify-end gap-1.5">
          {glOk && (
            <>
              <button type="button" className="btn-ghost-dark bg-midnight-950/60 px-2.5 py-1.5 text-xs backdrop-blur-sm" onClick={() => setSatellite((v) => !v)} aria-pressed={satellite} title="Satellite detail tiles: Sentinel-2 cloudless by EOX (free, loaded on demand)">
                {satellite ? 'Standard' : 'Satellite'}
                <span className="hidden sm:inline">{satellite ? ' globe' : ' detail'}</span>
              </button>
              <button type="button" className="btn-ghost-dark bg-midnight-950/60 px-2.5 py-1.5 text-xs backdrop-blur-sm" onClick={() => setResetSignal((n) => n + 1)}>
                Reset<span className="hidden sm:inline"> view</span>
              </button>
            </>
          )}
          <button
            type="button"
            className={`btn-ghost-dark bg-midnight-950/60 px-2.5 py-1.5 text-xs backdrop-blur-sm ${expanded ? '' : 'lg:hidden'}`}
            onClick={() => setExpanded((v) => !v)}
            aria-pressed={expanded}
          >
            {expanded ? '✕ Close' : '⤢ Full screen'}
          </button>
        </div>
      </div>
      {satellite && (
        <p className="absolute bottom-14 right-3 z-20 max-w-[16rem] text-right text-[0.6rem] text-ivory/55">
          Sentinel-2 cloudless — s2maps.eu by EOX IT Services GmbH (contains modified Copernicus Sentinel data)
        </p>
      )}

      {previewed && (
        <div role="region" aria-label={`Preview: ${previewed.country}`} className="absolute inset-x-3 bottom-14 z-30 rounded-sm border border-white/15 bg-midnight-900/95 p-3 text-xs shadow-2xl backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <DestinationFacts d={previewed} total={totalFor(previewed)} />
            <button type="button" className="-mr-1 -mt-1 rounded-sm px-2 py-1 text-base text-ivory/70 hover:bg-white/10" aria-label="Close preview" onClick={() => setPreview(null)}>
              ✕
            </button>
          </div>
          <button type="button" className="mt-3 w-full rounded-sm bg-sand-400 px-3 py-2 text-sm font-semibold text-midnight-900" onClick={() => open(previewed.id)}>
            Open this expedition →
          </button>
        </div>
      )}

      {hovered && hover && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-30 w-72 -translate-x-1/2 -translate-y-full rounded-sm border border-white/15 bg-midnight-900/95 p-3 text-xs shadow-2xl backdrop-blur"
          style={{ left: Math.min(Math.max(hover.x, 150), (panelRef.current?.clientWidth ?? 600) - 150), top: Math.max(hover.y - 10, 150) }}
        >
          <DestinationFacts d={hovered} total={totalFor(hovered)} />
        </div>
      )}
    </div>
  );
}

/** Key facts of one destination: shared by the desktop hover tooltip and the touch preview card. */
function DestinationFacts({ d, total }: { d: DestinationSummary; total: number }) {
  const { session } = useSession();
  const { novelty, completion } = useEvaluations();
  return (
    <div className="min-w-0 flex-1">
      <p className="eyebrow text-[0.6rem] text-sand-400">
        {d.id} · {d.country} — {d.region}
      </p>
      <p className="mt-1 font-display text-[0.95rem] leading-snug text-ivory">{d.title.split('—').pop()?.trim()}</p>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-ivory/80">
        <dt className="text-ivory/50">Duration</dt>
        <dd className="num">{d.totalDays} days</dd>
        <dt className="text-ivory/50">Best timing</dt>
        <dd>{bestTimingLabel(d.februaryRating, d.marchRating, d.preferredMonth)}</dd>
        <dt className="text-ivory/50">Total pp</dt>
        <dd className="num font-semibold text-ivory">{formatEUR(total)}</dd>
        <dt className="text-ivory/50">Style</dt>
        <dd>{tagLabel(d.travelStylePrimary)}</dd>
        <dt className="text-ivory/50">Novelty</dt>
        <dd>{session ? (novelty?.[d.id] ? (novelty[d.id].newToAll ? 'New to all four' : `${4 - novelty[d.id].visitedCount}/4 new`) : '—') : 'Sign in'}</dd>
        <dt className="text-ivory/50">Evaluations</dt>
        <dd className="num">{session && completion ? `${completion.perDestination[d.id] ?? 0}/4` : 'Sign in'}</dd>
      </dl>
      <div className="mt-2">
        <SecurityBadge status={d.securityStatus} dark />
      </div>
    </div>
  );
}
