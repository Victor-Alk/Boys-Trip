import { useMemo, useRef, useState } from 'react';
import type { DestinationSummary } from '../../types/summary';
import { BudgetBadge, NoveltyBadge, SecurityBadge } from '../ui/Badges';
import { formatEUR, budgetTier } from '../../lib/budget';
import { bestTimingLabel, tagLabel } from '../../lib/labels';
import { formatScore } from '../../lib/statistics';
import { defaultOrder } from '../../lib/filters';
import { useEvaluations } from '../../state/evaluations';
import { useSession } from '../../state/session';
import { useCollective } from '../../hooks/useCollective';
import { usePreferences } from '../../state/preferences';

type SortKey = 'default' | 'destination' | 'days' | 'total' | 'local' | 'security' | 'novelty' | 'evaluations' | 'score';

interface Props {
  rows: DestinationSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  totalFor: (s: DestinationSummary) => number;
}

export function ComparisonTable({ rows, selectedId, onSelect, totalFor }: Props) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'default', dir: 1 });
  const { session } = useSession();
  const { novelty } = useEvaluations();
  const { overrides } = usePreferences();
  const { stats, count } = useCollective();
  const selectedRef = useRef<HTMLTableRowElement>(null);

  const sorted = useMemo(() => {
    const val = (s: DestinationSummary): number | string => {
      switch (sort.key) {
        case 'destination':
          return s.country;
        case 'days':
          return s.totalDays;
        case 'total':
          return totalFor(s);
        case 'local':
          return s.localRealistic;
        case 'security':
          return { eligible: 0, conditional: 1, excluded: 2 }[s.securityStatus];
        case 'novelty':
          return novelty?.[s.id] ? novelty[s.id].visitedCount : 99;
        case 'evaluations':
          return count(s.id) ?? -1;
        case 'score':
          return stats.get(s.id)?.mean ?? -1;
        default:
          return 0;
      }
    };
    const list = [...rows];
    if (sort.key === 'default') return list.sort((a, b) => defaultOrder(a, b, totalFor));
    return list.sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const c = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number);
      return c * sort.dir || a.id.localeCompare(b.id);
    });
  }, [rows, sort, totalFor, novelty, count, stats]);

  const head = (key: SortKey, label: string, cls = '') => (
    <th scope="col" className={`whitespace-nowrap px-2 py-2 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-slate-500 ${cls}`} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className="hover:text-slate-ink"
        onClick={() => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === 'score' ? -1 : 1 }))}
      >
        {label}
        {sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  );
  const plain = (label: string, cls = '') => (
    <th scope="col" className={`whitespace-nowrap px-2 py-2 text-left text-[0.68rem] font-semibold uppercase tracking-wider text-slate-500 ${cls}`}>
      {label}
    </th>
  );

  const scoreCell = (s: DestinationSummary) => {
    if (!session) return <span className="text-xs text-slate-500">Sign in</span>;
    const st = stats.get(s.id);
    const c = count(s.id);
    if (st && st.complete) return <span className="num font-display text-base font-semibold">{formatScore(st.mean)}</span>;
    if (st) return <span className="num text-xs text-slate-600">{formatScore(st.mean)} <span className="text-slate-500">(partial)</span></span>;
    return <span className="text-xs text-slate-500" title="Blind voting: revealed once all four have evaluated">Hidden{c !== null ? ` · ${c}/4` : ''}</span>;
  };

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-sm border border-slate-ink/12 bg-paper lg:block">
        <table className="w-full min-w-[78rem] text-sm">
          <caption className="sr-only">Comparison of all expeditions. Select a row to open it on the globe.</caption>
          <thead className="border-b border-slate-ink/15 bg-sand-100/60">
            <tr>
              {head('destination', 'Destination', 'pl-4')}
              {plain('Expedition')}
              {head('days', 'Days')}
              {plain('Best timing')}
              {head('total', 'Total pp')}
              {head('local', 'Local pp')}
              {plain('Budget')}
              {plain('Style')}
              {plain('Geography')}
              {plain('Culture')}
              {plain('Camping')}
              {head('novelty', 'Novelty')}
              {head('security', 'Security')}
              {head('evaluations', 'Evals')}
              {head('score', 'Collective', 'pr-4')}
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const selected = s.id === selectedId;
              const override = typeof overrides[s.id] === 'number';
              return (
                <tr
                  key={s.id}
                  ref={selected ? selectedRef : undefined}
                  onClick={() => onSelect(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelect(s.id);
                    }
                  }}
                  tabIndex={0}
                  aria-selected={selected}
                  className={`cursor-pointer border-b border-slate-ink/8 align-top transition-colors focus:outline-none focus-visible:bg-sand-100 ${
                    selected ? 'bg-midnight-900 text-ivory' : 'hover:bg-sand-100/70'
                  } ${s.securityStatus === 'excluded' && !selected ? 'text-slate-500' : ''}`}
                >
                  <td className="py-2 pl-4 pr-2">
                    <span className={`num mr-1.5 text-xs ${selected ? 'text-sand-400' : 'text-bronze-600'}`}>{s.id.slice(1)}</span>
                    <span className="font-semibold">{s.country}</span>
                    <span className={`block text-xs ${selected ? 'text-ivory/70' : 'text-slate-500'}`}>{s.region}</span>
                  </td>
                  <td className="max-w-[16rem] px-2 py-2 font-display leading-snug">{s.title.split('—').pop()?.trim()}</td>
                  <td className="num px-2 py-2">{s.totalDays}</td>
                  <td className="px-2 py-2 text-xs">{bestTimingLabel(s.februaryRating, s.marchRating, s.preferredMonth)}</td>
                  <td className="num px-2 py-2 font-semibold">
                    {formatEUR(totalFor(s))}
                    {override && <span className="ml-0.5 text-[0.6rem] font-normal" title="Includes your own flight estimate">*</span>}
                  </td>
                  <td className="num px-2 py-2">{formatEUR(s.localRealistic)}</td>
                  <td className="px-2 py-2">
                    <BudgetBadge status={s.budgetStatus} dark={selected} />
                    {s.materialUncertainty && <span className={`mt-1 block text-[0.65rem] ${selected ? 'text-amber-200' : 'text-amber-warn'}`}>uncertain costs</span>}
                  </td>
                  <td className="px-2 py-2 text-xs">{tagLabel(s.travelStylePrimary)}</td>
                  <td className="max-w-[9rem] px-2 py-2 text-xs">{s.geographyTags.slice(0, 3).map(tagLabel).join(', ')}</td>
                  <td className="max-w-[9rem] px-2 py-2 text-xs">{s.cultureTags.slice(0, 3).map(tagLabel).join(', ')}</td>
                  <td className="px-2 py-2 text-xs">{tagLabel(s.campingFeasibility)}</td>
                  <td className="px-2 py-2">
                    <NoveltyBadge entry={novelty?.[s.id]} signedIn={!!session} compact />
                  </td>
                  <td className="px-2 py-2">
                    <SecurityBadge status={s.securityStatus} dark={selected} />
                  </td>
                  <td className="num px-2 py-2 text-xs">{session ? `${count(s.id) ?? 0}/4` : '—'}</td>
                  <td className="py-2 pl-2 pr-4">{scoreCell(s)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="space-y-2 lg:hidden">
        {sorted.map((s) => {
          const selected = s.id === selectedId;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-pressed={selected}
                className={`w-full rounded-sm border p-3 text-left ${selected ? 'border-midnight-900 bg-midnight-900 text-ivory' : 'border-slate-ink/12 bg-paper'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs">
                      <span className={`num ${selected ? 'text-sand-400' : 'text-bronze-600'}`}>{s.id.slice(1)}</span> · {s.country} — {s.region}
                    </p>
                    <p className="mt-0.5 font-display font-semibold leading-snug">{s.title.split('—').pop()?.trim()}</p>
                  </div>
                  <span className="num text-right font-semibold">
                    {formatEUR(totalFor(s))}
                    <span className={`block text-[0.65rem] font-normal ${selected ? 'text-ivory/60' : 'text-slate-500'}`}>{s.totalDays} days</span>
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <SecurityBadge status={s.securityStatus} dark={selected} />
                  <BudgetBadge status={s.budgetStatus} dark={selected} />
                  <span className={`chip ${selected ? 'border-white/20' : 'border-slate-ink/15 bg-white/60 text-slate-600'}`}>{tagLabel(s.travelStylePrimary)}</span>
                  <span className={`chip ${selected ? 'border-white/20' : 'border-slate-ink/15 bg-white/60 text-slate-600'}`}>{bestTimingLabel(s.februaryRating, s.marchRating, s.preferredMonth)}</span>
                  {session && <span className="text-xs">{scoreCell(s)}</span>}
                  {budgetTier(s.budgetStatus) === 'outside' && <span className="text-[0.65rem] text-red-warn">not eligible</span>}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
