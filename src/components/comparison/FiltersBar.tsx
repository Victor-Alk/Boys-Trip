import { useState } from 'react';
import { DEFAULT_FILTERS, activeFilterCount, type Filters } from '../../lib/filters';
import { summaries, CONTINENTS } from '../../lib/data';
import { CultureTag, GeographyTag, TravelStyleTag } from '../../types/destination';
import { tagLabel } from '../../lib/labels';
import { formatEUR } from '../../lib/budget';

const SLIDER_MIN = 800;
const SLIDER_MAX = 3200;

export function FiltersBar({ filters, onChange, signedIn, shown }: { filters: Filters; onChange: (f: Filters) => void; signedIn: boolean; shown: number }) {
  const [open, setOpen] = useState(false);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });
  const n = activeFilterCount(filters);
  const countries = Array.from(new Set(summaries.map((s) => s.country))).sort();
  const usedStyles = TravelStyleTag.options.filter((t) => summaries.some((s) => s.travelStyleTags.includes(t) || s.travelStylePrimary === t));
  const usedGeo = GeographyTag.options.filter((t) => summaries.some((s) => s.geographyTags.includes(t)));
  const usedCulture = CultureTag.options.filter((t) => summaries.some((s) => s.cultureTags.includes(t)));
  const sliderValue = Number.isFinite(filters.maxBudget) ? filters.maxBudget : SLIDER_MAX;

  return (
    <div className="rounded-sm border border-slate-ink/12 bg-paper">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <input
          type="search"
          className="input max-w-xs"
          placeholder="Search country, region, landscape…"
          value={filters.q}
          onChange={(e) => set('q', e.target.value)}
          aria-label="Search destinations"
        />
        <div className="flex min-w-[16rem] flex-1 items-center gap-3">
          <label htmlFor="budget-slider" className="whitespace-nowrap text-xs font-semibold">
            Max total pp
          </label>
          <div className="relative flex-1 pb-4">
            <input
              id="budget-slider"
              type="range"
              min={SLIDER_MIN}
              max={SLIDER_MAX}
              step={50}
              value={sliderValue}
              onChange={(e) => {
                const v = Number(e.target.value);
                set('maxBudget', v >= SLIDER_MAX ? Infinity : v);
              }}
              className="w-full accent-bronze-600"
              aria-valuetext={Number.isFinite(filters.maxBudget) ? formatEUR(filters.maxBudget) : 'Any budget'}
            />
            {[1000, 1500, 2000, 2500].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set('maxBudget', t)}
                className={`num absolute top-5 -translate-x-1/2 text-[0.62rem] ${t >= 2000 ? 'font-semibold' : ''} ${filters.maxBudget === t ? 'text-bronze-700 underline' : 'text-slate-500 hover:text-slate-ink'}`}
                style={{ left: `${((t - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100}%` }}
              >
                €{t / 1000}k
              </button>
            ))}
          </div>
          <span className="num w-14 text-right text-xs font-semibold">{Number.isFinite(filters.maxBudget) ? formatEUR(filters.maxBudget) : 'Any'}</span>
        </div>
        <Toggle label="Security-eligible only" checked={filters.eligibleOnly} onChange={(v) => set('eligibleOnly', v)} />
        <button type="button" className="btn-ghost py-1.5 text-xs" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Fewer filters' : 'More filters'}
          {n > 0 && <span className="num rounded-full bg-bronze-600 px-1.5 text-[0.65rem] text-ivory">{n}</span>}
        </button>
        {n > 0 && (
          <button type="button" className="text-xs font-semibold text-bronze-700 hover:underline" onClick={() => onChange(DEFAULT_FILTERS)}>
            Reset
          </button>
        )}
        <span className="num ml-auto text-xs text-slate-500" aria-live="polite">
          {shown} of {summaries.length} shown
        </span>
      </div>
      {open && (
        <div className="grid gap-3 border-t border-slate-ink/10 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <Select label="Continent" value={filters.continent} onChange={(v) => set('continent', v)} options={CONTINENTS.map((c) => [c, c])} />
          <Select label="Country" value={filters.country} onChange={(v) => set('country', v)} options={countries.map((c) => [c, c])} />
          <Select label="Travel style" value={filters.style} onChange={(v) => set('style', v)} options={usedStyles.map((t) => [t, tagLabel(t)])} />
          <Select label="Geography" value={filters.geography} onChange={(v) => set('geography', v)} options={usedGeo.map((t) => [t, tagLabel(t)])} />
          <Select label="Culture" value={filters.culture} onChange={(v) => set('culture', v)} options={usedCulture.map((t) => [t, tagLabel(t)])} />
          <div className="text-xs">
            <span className="font-semibold">Duration (days)</span>
            <div className="mt-1 flex items-center gap-1.5">
              <input type="number" min={0} max={21} className="input num px-2 py-1" aria-label="Minimum days" value={filters.minDays || ''} placeholder="min" onChange={(e) => set('minDays', Number(e.target.value) || 0)} />
              –
              <input type="number" min={0} max={21} className="input num px-2 py-1" aria-label="Maximum days" value={filters.maxDays === 99 ? '' : filters.maxDays} placeholder="max" onChange={(e) => set('maxDays', Number(e.target.value) || 99)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 sm:col-span-2 lg:col-span-4 xl:col-span-6">
            <Toggle label="Good in February" checked={filters.febSuitable} onChange={(v) => set('febSuitable', v)} />
            <Toggle label="Good in March" checked={filters.marSuitable} onChange={(v) => set('marSuitable', v)} />
            <Toggle label="Camping (good or excellent)" checked={filters.camping} onChange={(v) => set('camping', v)} />
            <Toggle label="New to all four" checked={filters.newToAll} onChange={(v) => set('newToAll', v)} disabled={!signedIn} hint={!signedIn ? 'sign in' : undefined} />
            <span className="flex items-center gap-2 text-xs">
              <span className="font-semibold">My evaluations</span>
              {(['all', 'done', 'todo'] as const).map((m) => (
                <label key={m} className={`flex items-center gap-1 ${!signedIn && m !== 'all' ? 'opacity-50' : ''}`}>
                  <input type="radio" name="mine" checked={filters.mine === m} disabled={!signedIn && m !== 'all'} onChange={() => set('mine', m)} className="accent-bronze-600" />
                  {m === 'all' ? 'All' : m === 'done' ? 'Completed' : 'Remaining'}
                </label>
              ))}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange, disabled, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string }) {
  return (
    <label className={`flex items-center gap-1.5 text-xs ${disabled ? 'opacity-50' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-bronze-600" />
      <span className="font-medium">{label}</span>
      {hint && <span className="text-slate-500">({hint})</span>}
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <label className="text-xs">
      <span className="font-semibold">{label}</span>
      <select className="input mt-1 px-2 py-1" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Any</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
