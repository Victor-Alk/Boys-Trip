import { lazy, Suspense, useMemo, useState } from 'react';
import type { Destination, ImageCredit, Stop } from '../../types/destination';
import { Photo } from '../ui/Photo';
import { formatEUR } from '../../lib/budget';
import { tagLabel } from '../../lib/labels';
import { StatusBanner } from './StatusBanner';
import { splitTitle } from './SlideExperience';

const ItineraryMap = lazy(() => import('../itinerary/ItineraryMap'));

const REQ_LABEL: Record<string, string> = {
  guide: 'Guide',
  permit: 'Permit',
  'technical-skills': 'Technical skills',
  'special-equipment': 'Special equipment',
  'driving-licence': 'Driving licence',
  fitness: 'Fitness',
  'weather-dependent': 'Weather-dependent',
};

export function SlideJourney({ d, credits }: { d: Destination; credits: Map<string, ImageCredit> }) {
  const overview = d.itinerary.kind === 'informational';
  const [selectedStop, setSelectedStop] = useState<string | null>(null);
  const [expandAll, setExpandAll] = useState(false);
  const stop = d.route.stops.find((s) => s.id === selectedStop) ?? null;
  const stopIndex = useMemo(() => new Map(d.route.stops.map((s, i) => [s.id, i + 1])), [d.route.stops]);
  const journeyPhotos = d.images.journey.map((id) => credits.get(id)).filter(Boolean) as ImageCredit[];
  const { main } = splitTitle(d.title);

  return (
    <article className="px-5 py-6 lg:px-8">
      <p className="eyebrow text-bronze-600">02 — The Journey · What would we actually do?</p>
      <h1 className="mt-1 text-3xl font-semibold leading-tight">{main}</h1>
      <p className="mt-2 max-w-3xl text-[0.95rem] leading-relaxed text-slate-600">{d.itinerary.summary}</p>
      <div className="mt-4">
        <StatusBanner d={d} />
      </div>

      <div className="mt-2 grid gap-4 xl:grid-cols-[1fr_17rem]">
        <div className="relative h-[22rem] overflow-hidden rounded-sm border border-slate-ink/10 bg-sand-200 lg:h-[27rem]" data-noswipe>
          <Suspense fallback={<div className="grid h-full place-items-center text-sm text-slate-500">Loading map…</div>}>
            <ItineraryMap stops={d.route.stops} legs={d.route.legs} selectedStopId={selectedStop} onSelectStop={setSelectedStop} overview={overview} />
          </Suspense>
        </div>
        <ol className="panel-scroll max-h-[27rem] space-y-0.5 overflow-y-auto text-sm" aria-label="Stops">
          {d.route.stops.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setSelectedStop(s.id === selectedStop ? null : s.id)}
                aria-pressed={s.id === selectedStop}
                className={`flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left ${s.id === selectedStop ? 'bg-midnight-900 text-ivory' : 'hover:bg-sand-100'}`}
              >
                <span className={`num mt-0.5 grid h-5 min-w-5 place-items-center rounded-full text-[0.65rem] font-bold ${s.id === selectedStop ? 'bg-bronze-600 text-ivory' : 'bg-midnight-900 text-ivory'}`}>{i + 1}</span>
                <span className="min-w-0">
                  <span className="block font-medium leading-tight">{s.name}</span>
                  <span className={`block text-[0.7rem] ${s.id === selectedStop ? 'text-ivory/70' : 'text-slate-500'}`}>
                    {tagLabel(s.kind)}
                    {s.days.length > 0 && ` · day ${s.days.join(', ')}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
      <p className="mt-2 text-xs text-slate-500">{d.route.routingNote}</p>

      {stop && <StopDetail stop={stop} index={stopIndex.get(stop.id)!} credits={credits} onClose={() => setSelectedStop(null)} />}

      {overview ? (
        <section className="mt-8">
          <h2 className="text-2xl font-semibold">Regions and themes</h2>
          <p className="mt-1 text-sm text-slate-600">No operational day-by-day plan is published for this destination because its route conflicts with the group’s security requirements.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {d.itinerary.overview.map((o) => (
              <div key={o.name} className="border-t-2 border-bronze-600/40 pt-3">
                <h3 className="font-display text-lg font-semibold">{o.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{o.description}</p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-8">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold">Day by day</h2>
            <button type="button" className="text-xs font-semibold text-bronze-700 hover:underline" onClick={() => setExpandAll((v) => !v)}>
              {expandAll ? 'Collapse all days' : 'Expand the full programme'}
            </button>
          </div>
          <ol className="mt-3 border-l border-slate-ink/15">
            {d.itinerary.days.map((day) => (
              <li key={`${day.day}-${expandAll}`} className="relative pl-5">
                <span className={`absolute -left-[5px] top-4 h-2.5 w-2.5 rounded-full ${day.flexible ? 'border-2 border-bronze-600 bg-paper' : 'bg-midnight-900'}`} aria-hidden />
                <details open={expandAll} className="group border-b border-slate-ink/8 py-3">
                  <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="num w-14 flex-none font-display text-sm font-semibold text-bronze-600">Day {day.day}</span>
                    <span className="min-w-0 flex-1 font-semibold leading-snug">
                      {day.title}
                      {day.flexible && <span className="chip ml-2 border-bronze-600/40 bg-sand-100 text-bronze-700">Flexible day</span>}
                    </span>
                    <span className="w-full pl-[4.25rem] text-xs text-slate-500 sm:w-auto sm:pl-0">
                      {day.from === day.to ? day.to : `${day.from} → ${day.to}`} · {day.transport} · {day.travelTime}
                      {day.distanceKm ? ` · ${day.distanceKm} km` : ''}
                    </span>
                  </summary>
                  <div className="mt-2 grid gap-3 pl-[4.25rem] text-sm sm:grid-cols-[1fr_auto]">
                    <div>
                      <ul className="list-disc space-y-0.5 pl-4 leading-relaxed">
                        {day.activities.map((a) => (
                          <li key={a}>{a}</li>
                        ))}
                      </ul>
                      <dl className="mt-2 grid gap-x-4 gap-y-1 text-[0.8rem] sm:grid-cols-2">
                        <Row label="Sleep" value={day.accommodation} />
                        {day.culturalHighlight && <Row label="Culture" value={day.culturalHighlight} />}
                        {day.geographicalHighlight && <Row label="Landscape" value={day.geographicalHighlight} />}
                        {day.practical && <Row label="Practical" value={day.practical} />}
                      </dl>
                    </div>
                    {day.imageIds[0] && credits.get(day.imageIds[0]) && (
                      <Photo credit={credits.get(day.imageIds[0])} aspect="4 / 3" showCredit={false} sizes="10rem" className="hidden w-40 rounded-sm sm:block" />
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ol>
        </section>
      )}

      {journeyPhotos.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-2 md:grid-cols-3">
          {journeyPhotos.map((c) => (
            <Photo key={c.id} credit={c} caption aspect="3 / 2" sizes="(min-width: 1024px) 18vw, 50vw" />
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <section>
          <h2 className="eyebrow text-forest-700">Getting around</h2>
          <p className="mt-2 text-sm leading-relaxed">{d.transport.summary}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {d.transport.modes.map((m) => (
              <li key={m.mode}>
                <span className="font-semibold">{m.mode}:</span> <span className="text-slate-600">{m.description}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2 className="eyebrow text-forest-700">Where we sleep</h2>
          <p className="mt-2 text-sm leading-relaxed">{d.accommodation.summary}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {d.accommodation.types.map((t) => (
              <li key={t} className="chip border-slate-ink/15 bg-white/60 text-slate-600">
                {t}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">
            Camping: {tagLabel(d.camping.feasibility)} · {d.camping.nights} night{d.camping.nights === 1 ? '' : 's'} planned
          </p>
        </section>
        <section>
          <h2 className="eyebrow text-forest-700">Adventure</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {d.adventureHighlights.map((a) => (
              <li key={a.name}>
                <span className="font-semibold">{a.name}</span> <span className="text-slate-600">— {a.description}</span>
                {a.requires.length > 0 && (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {a.requires.map((r) => (
                      <span key={r} className="chip border-amber-warn/30 bg-amber-bg/60 text-amber-warn">
                        {REQ_LABEL[r] ?? r}
                      </span>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="eyebrow text-bronze-700">Cultural highlights</h2>
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {d.culturalHighlights.map((c) => (
            <li key={c.name} className="text-sm">
              <span className="font-semibold">{c.name}</span>
              <span className="text-slate-500"> · {c.kind}</span>
              {c.immersive && <span className="chip ml-1.5 border-forest-700/25 bg-forest-100 text-forest-800">Immersive</span>}
              <p className="mt-0.5 leading-relaxed text-slate-600">{c.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="inline font-semibold text-slate-ink">{label}: </dt>
      <dd className="inline text-slate-600">{value}</dd>
    </div>
  );
}

function StopDetail({ stop, index, credits, onClose }: { stop: Stop; index: number; credits: Map<string, ImageCredit>; onClose: () => void }) {
  const photos = stop.imageIds.map((id) => credits.get(id)).filter(Boolean) as ImageCredit[];
  return (
    <section className="fade-in mt-4 rounded-sm border border-slate-ink/12 bg-white/60 p-4" aria-label={`Stop ${index}: ${stop.name}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow text-bronze-600">
            Stop {index} · {tagLabel(stop.kind)}
            {stop.days.length > 0 && ` · day ${stop.days.join(', ')}`}
          </p>
          <h3 className="mt-0.5 font-display text-xl font-semibold">{stop.name}</h3>
        </div>
        <button type="button" className="text-sm text-slate-500 hover:text-slate-ink" onClick={onClose} aria-label="Close stop details">
          ✕
        </button>
      </div>
      <div className={`mt-3 grid gap-4 ${photos.length ? 'md:grid-cols-[1fr_14rem]' : ''}`}>
        <div className="space-y-2 text-sm leading-relaxed">
          <p>{stop.description}</p>
          {stop.activities.length > 0 && (
            <ul className="list-disc pl-4 text-slate-600">
              {stop.activities.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
          <dl className="grid gap-1 text-[0.8rem]">
            {stop.culturalImportance && <Row label="Cultural importance" value={stop.culturalImportance} />}
            {stop.geography && <Row label="Geography" value={stop.geography} />}
            {stop.transport && <Row label="Transport" value={stop.transport} />}
            {stop.accommodation && <Row label="Accommodation" value={stop.accommodation} />}
            <Row label="Estimated cost" value={stop.estimatedCostEUR === null ? stop.costNote || 'Not estimated separately' : `${formatEUR(stop.estimatedCostEUR)} per person${stop.costNote ? ` — ${stop.costNote}` : ''}`} />
          </dl>
        </div>
        {photos.length > 0 && (
          <div className="grid gap-2">
            {photos.slice(0, 2).map((c) => (
              <Photo key={c.id} credit={c} aspect="4 / 3" sizes="14rem" />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
