import { useCallback, useMemo, useState } from 'react';
import { summaries } from '../lib/data';
import { navigate, useRoute } from '../lib/router';
import { GlobePanel } from '../components/globe/GlobePanel';
import { PresentationPanel, lastViewedSlide } from '../components/presentation/PresentationPanel';
import { FiltersBar } from '../components/comparison/FiltersBar';
import { ComparisonTable } from '../components/comparison/ComparisonTable';
import { DEFAULT_FILTERS, matches, type Filters } from '../lib/filters';
import { usePreferences } from '../state/preferences';
import { useEvaluations } from '../state/evaluations';
import { useSession } from '../state/session';
import type { DestinationSummary } from '../types/summary';
import { prefetchDestination } from '../hooks/useDestination';

export function ExplorePage() {
  const route = useRoute();
  const { session, mode } = useSession();
  const { novelty, responses } = useEvaluations();
  const { overrides } = usePreferences();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const selectedId = route.destinationId && summaries.some((s) => s.id === route.destinationId) ? route.destinationId : null;

  const totalFor = useCallback(
    (s: DestinationSummary) => (typeof overrides[s.id] === 'number' ? overrides[s.id] + s.localRealistic : s.totalRealistic),
    [overrides],
  );

  const visible = useMemo(
    () => summaries.filter((s) => matches(s, filters, { totalFor, novelty, evaluated: session ? new Set(responses.keys()) : null })),
    [filters, totalFor, novelty, responses, session],
  );
  const visibleIds = useMemo(() => new Set(visible.map((s) => s.id)), [visible]);

  const select = useCallback((id: string) => {
    prefetchDestination(id);
    navigate({ page: 'explore', destinationId: id });
    if (window.matchMedia('(max-width: 1023px)').matches) {
      setTimeout(() => document.getElementById('presentation')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    }
  }, []);

  const resume = selectedId && route.slide === 1 && !route.evaluate ? lastViewedSlide(selectedId) : null;

  return (
    <main className="mx-auto max-w-[1800px] overflow-x-clip">
      <section className={`grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,45fr)_minmax(0,55fr)] ${mode === 'demo' ? 'lg:h-[calc(100svh-5.05rem)]' : 'lg:h-[calc(100svh-3.25rem)]'}`}>
        <div className="relative h-[58svh] min-h-[22rem] lg:h-full">
          <GlobePanel destinations={summaries} visibleIds={visibleIds} selectedId={selectedId} onSelect={select} totalFor={totalFor} />
        </div>
        <div id="presentation" className="relative min-h-[70svh] min-w-0 border-slate-ink/10 lg:min-h-0 lg:border-l">
          <PresentationPanel destinationId={selectedId} slide={route.slide} evaluate={route.evaluate} />
          {resume && resume > 1 && (
            <button
              type="button"
              className="absolute bottom-14 right-4 z-10 rounded-sm bg-midnight-900 px-3 py-1.5 text-xs font-semibold text-ivory shadow-lg"
              onClick={() => navigate({ page: 'explore', destinationId: selectedId, slide: resume }, { replace: true })}
            >
              Resume at slide {resume} →
            </button>
          )}
        </div>
      </section>

      <section className="px-4 pb-16 pt-10 lg:px-6" aria-labelledby="compare-title">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="eyebrow text-bronze-600">All twenty expeditions</p>
            <h2 id="compare-title" className="text-3xl font-semibold">
              Comparison table
            </h2>
          </div>
          <p className="max-w-xl text-xs text-slate-500">
            Default order: security-eligible destinations first, then by realistic total cost — cheaper is not automatically better. Totals are per person with flights from Paris CDG (illustrative) unless you entered your own fare (*).
          </p>
        </div>
        <FiltersBar filters={filters} onChange={setFilters} signedIn={!!session} shown={visible.length} />
        <div className="mt-3">
          <ComparisonTable rows={visible} selectedId={selectedId} onSelect={select} totalFor={totalFor} />
        </div>
      </section>
    </main>
  );
}
