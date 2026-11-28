import { Component, lazy, Suspense, useMemo, useRef, useState, type ReactNode } from 'react';
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
  const [satellite, setSatellite] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);
  const [glOk] = useState(() => (typeof document !== 'undefined' ? webglAvailable() : false));
  const { session } = useSession();
  const { novelty, completion } = useEvaluations();
  const filtered = visibleIds.size !== destinations.length;
  const highlight = useMemo(() => (filtered ? visibleIds : null), [filtered, visibleIds]);

  const onHover = (id: string | null, rect: DOMRect | null) => {
    if (!id || !rect || !panelRef.current) return setHover(null);
    const p = panelRef.current.getBoundingClientRect();
    setHover({ id, x: rect.left - p.left + rect.width / 2, y: rect.top - p.top });
  };
  const hovered = hover ? destinations.find((d) => d.id === hover.id) : null;

  const fallback = (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-ivory/80">
      <p className="font-display text-xl text-ivory">The 3D globe is unavailable on this device</p>
      <p className="max-w-sm text-sm">WebGL could not start. Every destination remains available through the search above and the comparison table below.</p>
    </div>
  );

  return (
    <div ref={panelRef} className="relative h-full min-h-[22rem] overflow-hidden bg-midnight-950 text-ivory" aria-label="Interactive globe of the 20 expeditions">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(52,80,111,0.55),rgba(8,17,29,0)_62%)]" />
      {glOk ? (
        <GlobeBoundary fallback={fallback}>
          <Suspense fallback={<div className="absolute inset-0 grid place-items-center text-sm text-ivory/60">Loading the globe…</div>}>
            <GlobeView
              destinations={destinations}
              selectedId={selectedId}
              highlightedIds={highlight}
              onSelect={onSelect}
              onHover={onHover}
              satellite={satellite}
              resetSignal={resetSignal}
            />
          </Suspense>
        </GlobeBoundary>
      ) : (
        fallback
      )}

      <div className="absolute inset-x-3 top-3 z-20 flex flex-col items-start gap-2">
        <DestinationPicker destinations={destinations} selectedId={selectedId} onSelect={onSelect} />
        {overlay && <div className="max-w-full">{overlay}</div>}
      </div>

      <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-1.5 rounded-sm bg-midnight-950/70 px-3 py-2 text-[0.68rem] text-ivory/75 backdrop-blur-sm">
        <span className="eyebrow text-[0.6rem] text-sand-400">Security</span>
        {(['eligible', 'conditional', 'excluded'] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <SecurityGlyph status={s} className={s === 'eligible' ? 'text-emerald-300' : s === 'conditional' ? 'text-amber-300' : 'text-red-300'} />
            {s === 'eligible' ? 'Eligible (circle)' : s === 'conditional' ? 'Conditional (diamond)' : 'Excluded (square)'}
          </span>
        ))}
        <span className="mt-0.5 text-ivory/55">€+ exceptional · €! over €2,500</span>
      </div>

      {glOk && (
        <div className="absolute bottom-3 right-3 z-20 flex gap-1.5">
          <button type="button" className="btn-ghost-dark bg-midnight-950/60 px-2.5 py-1.5 text-xs backdrop-blur-sm" onClick={() => setSatellite((v) => !v)} aria-pressed={satellite} title="Satellite detail tiles: Sentinel-2 cloudless by EOX (free, loaded on demand)">
            {satellite ? 'Standard globe' : 'Satellite detail'}
          </button>
          <button type="button" className="btn-ghost-dark bg-midnight-950/60 px-2.5 py-1.5 text-xs backdrop-blur-sm" onClick={() => setResetSignal((n) => n + 1)}>
            Reset view
          </button>
        </div>
      )}
      {satellite && (
        <p className="absolute bottom-14 right-3 z-20 max-w-[16rem] text-right text-[0.6rem] text-ivory/55">
          Sentinel-2 cloudless — s2maps.eu by EOX IT Services GmbH (contains modified Copernicus Sentinel data)
        </p>
      )}

      {hovered && hover && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-30 w-72 -translate-x-1/2 -translate-y-full rounded-sm border border-white/15 bg-midnight-900/95 p-3 text-xs shadow-2xl backdrop-blur"
          style={{ left: Math.min(Math.max(hover.x, 150), (panelRef.current?.clientWidth ?? 600) - 150), top: Math.max(hover.y - 10, 150) }}
        >
          <p className="eyebrow text-[0.6rem] text-sand-400">
            {hovered.id} · {hovered.country} — {hovered.region}
          </p>
          <p className="mt-1 font-display text-[0.95rem] leading-snug text-ivory">{hovered.title.split('—').pop()?.trim()}</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-ivory/80">
            <dt className="text-ivory/50">Duration</dt>
            <dd className="num">{hovered.totalDays} days</dd>
            <dt className="text-ivory/50">Best timing</dt>
            <dd>{bestTimingLabel(hovered.februaryRating, hovered.marchRating, hovered.preferredMonth)}</dd>
            <dt className="text-ivory/50">Total pp</dt>
            <dd className="num font-semibold text-ivory">{formatEUR(totalFor(hovered))}</dd>
            <dt className="text-ivory/50">Style</dt>
            <dd>{tagLabel(hovered.travelStylePrimary)}</dd>
            <dt className="text-ivory/50">Novelty</dt>
            <dd>{session ? (novelty?.[hovered.id] ? (novelty[hovered.id].newToAll ? 'New to all four' : `${4 - novelty[hovered.id].visitedCount}/4 new`) : '—') : 'Sign in'}</dd>
            <dt className="text-ivory/50">Evaluations</dt>
            <dd className="num">{session && completion ? `${completion.perDestination[hovered.id] ?? 0}/4` : 'Sign in'}</dd>
          </dl>
          <div className="mt-2">
            <SecurityBadge status={hovered.securityStatus} dark />
          </div>
        </div>
      )}
    </div>
  );
}
