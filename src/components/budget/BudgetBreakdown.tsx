import { useState } from 'react';
import type { Budget, Scenario } from '../../types/destination';
import {
  CATEGORY_LABEL,
  computeScenario,
  DISPLAY_GROUPS,
  EXCEPTIONAL_MAX_EUR,
  formatEUR,
  PREFERRED_MAX_EUR,
  type DisplayGroup,
  type ScenarioTotals,
} from '../../lib/budget';
import { BudgetBadge } from '../ui/Badges';
import { usePreferences } from '../../state/preferences';

export const GROUP_COLOR: Record<DisplayGroup, string> = {
  'Flights & baggage': '#223955',
  'Domestic transport': '#4a6a8a',
  Vehicle: '#2f4a3a',
  Accommodation: '#9a7446',
  'Food & water': '#c8a97e',
  'Activities & guides': '#6b8f73',
  'Visas, permits & insurance': '#5f6b75',
  Contingency: '#cfc4b0',
};

const SCENARIO_LABEL: Record<Scenario, string> = { economical: 'Economical', realistic: 'Realistic', comfortable: 'Comfortable' };
const CONF_LABEL = { observed: 'Observed quote', representative: 'Representative', estimate: 'Planning estimate' } as const;

export function BudgetBreakdown({ destinationId, budget }: { destinationId: string; budget: Budget }) {
  const [scenario, setScenario] = useState<Scenario>('realistic');
  const { flightOverride, setFlightOverride, departureAirport, setDepartureAirport } = usePreferences();
  const override = flightOverride(destinationId);
  const [draftFare, setDraftFare] = useState<string>(override !== null ? String(override) : '');
  const t = computeScenario(budget, scenario, { flightOverridePerPerson: override });
  const all = (['economical', 'realistic', 'comfortable'] as const).map((s) => computeScenario(budget, s, { flightOverridePerPerson: override }));
  const scaleMax = Math.max(2800, ...all.map((x) => x.totalPerPerson)) * 1.04;
  const pct = (v: number) => `${(v / scaleMax) * 100}%`;

  return (
    <section aria-labelledby="budget-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="budget-title" className="eyebrow text-bronze-600">
            Total estimated cost — flights included
          </h2>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
            <span className="num font-display text-5xl font-semibold leading-none">{formatEUR(t.totalPerPerson)}</span>
            <span className="text-sm text-slate-600">per person</span>
            <span className="num text-lg font-semibold text-slate-600">{formatEUR(t.totalGroup)}</span>
            <span className="text-sm text-slate-600">for four</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <BudgetBadge status={t.status} />
            <span className={`num ${t.remainingBelowPreferred >= 0 ? 'text-forest-700' : 'text-amber-warn'}`}>
              {t.remainingBelowPreferred >= 0 ? `${formatEUR(t.remainingBelowPreferred)} below €2,000` : `${formatEUR(-t.remainingBelowPreferred)} above €2,000`}
            </span>
            <span className={`num ${t.remainingBelowExceptional >= 0 ? 'text-slate-600' : 'text-red-warn'}`}>
              · {t.remainingBelowExceptional >= 0 ? `${formatEUR(t.remainingBelowExceptional)} below €2,500` : `${formatEUR(-t.remainingBelowExceptional)} above €2,500`}
            </span>
          </div>
        </div>
        <div role="radiogroup" aria-label="Budget scenario" className="flex rounded-sm border border-slate-ink/20 p-0.5">
          {(['economical', 'realistic', 'comfortable'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={scenario === s}
              onClick={() => setScenario(s)}
              className={`rounded-[2px] px-3 py-1.5 text-xs font-semibold ${scenario === s ? 'bg-midnight-900 text-ivory' : 'text-slate-600 hover:text-slate-ink'}`}
            >
              {SCENARIO_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Stacked bar against the two thresholds */}
      <div className="relative mt-6 pb-6 pt-5">
        <div className="flex h-9 w-full overflow-hidden rounded-[2px] bg-sand-100" role="img" aria-label={`Breakdown of ${formatEUR(t.totalPerPerson)} per person`}>
          {DISPLAY_GROUPS.map((g) =>
            t.byGroup[g] > 0 ? (
              <span key={g} style={{ width: pct(t.byGroup[g]), background: GROUP_COLOR[g] }} className="h-full border-r border-paper/60 last:border-0" title={`${g}: ${formatEUR(t.byGroup[g])}`} />
            ) : null,
          )}
        </div>
        <Threshold left={pct(PREFERRED_MAX_EUR)} label="€2,000 preferred" short="€2k" />
        <Threshold left={pct(EXCEPTIONAL_MAX_EUR)} label="€2,500 maximum" short="€2.5k" danger />
      </div>
      <ul className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        {DISPLAY_GROUPS.map((g) => (
          <li key={g} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 flex-none rounded-[1px]" style={{ background: GROUP_COLOR[g] }} aria-hidden />
            <span className="truncate text-slate-600">{g}</span>
            <span className="num ml-auto font-semibold">{formatEUR(t.byGroup[g])}</span>
          </li>
        ))}
      </ul>

      {/* Scenario comparison */}
      <div className="mt-6 space-y-1.5">
        {all.map((x) => (
          <div key={x.scenario} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-2 text-xs">
            <span className={x.scenario === scenario ? 'font-semibold' : 'text-slate-600'}>{SCENARIO_LABEL[x.scenario]}</span>
            <span className="relative h-2 rounded-full bg-sand-100">
              <span className={`absolute inset-y-0 left-0 rounded-full ${x.scenario === scenario ? 'bg-midnight-900' : 'bg-slate-300'}`} style={{ width: pct(x.totalPerPerson) }} />
              <span className="absolute -top-1 bottom-[-4px] w-px bg-forest-700" style={{ left: pct(PREFERRED_MAX_EUR) }} />
              <span className="absolute -top-1 bottom-[-4px] w-px bg-red-warn" style={{ left: pct(EXCEPTIONAL_MAX_EUR) }} />
            </span>
            <span className="num text-right font-semibold">{formatEUR(x.totalPerPerson)}</span>
          </div>
        ))}
        <p className="pt-1 text-xs text-slate-500">{budget.scenarioNotes[scenario]}</p>
      </div>

      {/* Flights + personal override */}
      <div className="mt-6 grid gap-4 rounded-sm border border-slate-ink/12 bg-white/55 p-4 md:grid-cols-[1fr_15rem]">
        <div className="text-sm">
          <h3 className="font-semibold">International flights</h3>
          <p className="mt-1 text-slate-600">
            <span className="num font-semibold text-slate-ink">{budget.flights.referenceDeparture.iata} → {budget.flights.arrival.iata}</span>
            {budget.flights.routing === 'open-jaw' && <span> · return from {budget.flights.returnFrom.iata} (open-jaw)</span>} · {budget.flights.indicativeDates} · {budget.flights.connections} · {budget.flights.journeyTime}
          </p>
          <p className="mt-1 text-slate-600">
            {budget.flights.airlinesOrSource} · Baggage: {budget.flights.baggage}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            <span className="chip mr-1 border-slate-ink/15 bg-white text-slate-600">{CONF_LABEL[budget.flights.confidence]}</span>
            Reference fare {formatEUR(budget.flights.perPersonEUR.economical)} / {formatEUR(budget.flights.perPersonEUR.realistic)} / {formatEUR(budget.flights.perPersonEUR.comfortable)} · checked {budget.flights.checkedAt}. {budget.flights.priceNote}
          </p>
          {budget.flights.alternatives.length > 0 && (
            <p className="mt-1 text-xs text-slate-500">
              Alternatives: {budget.flights.alternatives.map((a) => `${a.airport.iata} ≈ ${formatEUR(a.realisticPerPersonEUR)} (${CONF_LABEL[a.confidence].toLowerCase()})`).join(' · ')}
            </p>
          )}
          <p className="mt-2 text-[0.7rem] text-slate-500">Paris CDG is an illustrative reference airport: the group’s departure airports are not yet decided.</p>
        </div>
        <form
          className="text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const v = draftFare.trim() === '' ? null : Number(draftFare);
            setFlightOverride(destinationId, v !== null && Number.isFinite(v) ? v : null);
          }}
        >
          <label className="block text-xs font-semibold" htmlFor={`fare-${destinationId}`}>
            Your expected return fare (€ per person)
          </label>
          <div className="mt-1 flex gap-1.5">
            <input
              id={`fare-${destinationId}`}
              inputMode="numeric"
              type="number"
              min={0}
              max={10000}
              step={10}
              className="input num"
              placeholder={String(budget.flights.perPersonEUR.realistic)}
              value={draftFare}
              onChange={(e) => {
                setDraftFare(e.target.value);
                const v = e.target.value.trim() === '' ? null : Number(e.target.value);
                setFlightOverride(destinationId, v !== null && Number.isFinite(v) && v >= 0 ? v : null);
              }}
            />
          </div>
          <label className="mt-2 block text-xs font-semibold" htmlFor={`dep-${destinationId}`}>
            Your departure airport
          </label>
          <input id={`dep-${destinationId}`} className="input mt-1" placeholder="e.g. Brussels (BRU)" value={departureAirport} onChange={(e) => setDepartureAirport(e.target.value)} />
          {override !== null && (
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-bronze-700 hover:underline"
              onClick={() => {
                setDraftFare('');
                setFlightOverride(destinationId, null);
              }}
            >
              Reset to the indicative fare
            </button>
          )}
          <p className="mt-1 text-[0.68rem] text-slate-500">Saved on this device only. Totals update instantly; group rankings keep using the common reference fare.</p>
        </form>
      </div>

      <BudgetTable t={t} budget={budget} scenario={scenario} />
    </section>
  );
}

function Threshold({ left, label, short, danger = false }: { left: string; label: string; short: string; danger?: boolean }) {
  return (
    <span className="absolute top-0 bottom-0" style={{ left }} aria-hidden>
      <span className={`absolute top-3 bottom-4 w-0.5 ${danger ? 'bg-red-warn' : 'bg-forest-700'}`} />
      <span className={`num absolute bottom-0 -translate-x-1/2 whitespace-nowrap text-[0.65rem] font-semibold ${danger ? 'text-red-warn' : 'text-forest-700'}`}>
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{short}</span>
      </span>
    </span>
  );
}

function BudgetTable({ t, budget, scenario }: { t: ScenarioTotals; budget: Budget; scenario: Scenario }) {
  return (
    <div className="mt-6 overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <caption className="sr-only">Budget lines for the {scenario} scenario</caption>
        <thead>
          <tr className="border-b border-slate-ink/20 text-left text-xs text-slate-500">
            <th className="py-1.5 font-semibold">Item</th>
            <th className="py-1.5 font-semibold">Basis</th>
            <th className="py-1.5 text-right font-semibold">Per person</th>
            <th className="py-1.5 text-right font-semibold">Group of four</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-ink/8">
            <td className="py-1.5 font-medium">International return flights{t.flightOverridden ? ' (your fare)' : ''}</td>
            <td className="py-1.5 text-xs text-slate-500">individual · per person</td>
            <td className="num py-1.5 text-right">{formatEUR(t.flightsPerPerson)}</td>
            <td className="num py-1.5 text-right">{formatEUR(t.flightsGroup)}</td>
          </tr>
          {t.lines.map(({ line, perPerson, group }) => {
            const q = typeof line.quantity === 'number' ? line.quantity : line.quantity[scenario];
            const unit = line.unitCostEUR[scenario];
            return (
              <tr key={line.id} className={`border-b border-slate-ink/8 ${line.status === 'not-applicable' ? 'text-slate-500/80' : ''}`}>
                <td className="py-1.5">
                  <span className="font-medium">{line.label}</span>
                  <span className="block text-[0.7rem] text-slate-500">
                    {CATEGORY_LABEL[line.category]}
                    {line.status === 'applicable' && unit !== null && ` · ${formatEUR(unit)} × ${q} ${line.unit}${line.sharing === 'shared' ? ' ÷ 4' : ''}`}
                    {line.note && ` · ${line.note}`}
                  </span>
                </td>
                <td className="py-1.5 text-xs text-slate-500">
                  {line.sharing} · {line.basis.replace('per-', 'per ')}
                  <span className="block">{CONF_LABEL[line.confidence]}</span>
                </td>
                <td className="num py-1.5 text-right">
                  {line.status === 'not-applicable' ? <span title="Not applicable">n/a</span> : perPerson === null ? <span className="font-semibold text-amber-warn">Unknown</span> : formatEUR(perPerson)}
                </td>
                <td className="num py-1.5 text-right">{line.status === 'not-applicable' ? 'n/a' : group === null ? <span className="font-semibold text-amber-warn">Unknown</span> : formatEUR(group)}</td>
              </tr>
            );
          })}
          <tr className="border-b border-slate-ink/8">
            <td className="py-1.5 font-medium">Contingency ({t.contingencyPercent}% of local costs)</td>
            <td className="py-1.5 text-xs text-slate-500">computed, not double counted</td>
            <td className="num py-1.5 text-right">{formatEUR(t.contingencyPerPerson)}</td>
            <td className="num py-1.5 text-right">{formatEUR(t.contingencyPerPerson * 4)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr className="text-xs text-slate-600">
            <td className="pt-2">Local expenditure (incl. contingency)</td>
            <td />
            <td className="num pt-2 text-right">{formatEUR(t.localPerPerson)}</td>
            <td className="num pt-2 text-right">{formatEUR(t.localGroup)}</td>
          </tr>
          <tr className="text-xs text-slate-600">
            <td>Flights</td>
            <td />
            <td className="num text-right">{formatEUR(t.flightsPerPerson)}</td>
            <td className="num text-right">{formatEUR(t.flightsGroup)}</td>
          </tr>
          <tr className="border-t-2 border-slate-ink/30 font-semibold">
            <td className="pt-2">Complete expedition</td>
            <td />
            <td className="num pt-2 text-right">{formatEUR(t.totalPerPerson)}</td>
            <td className="num pt-2 text-right">{formatEUR(t.totalGroup)}</td>
          </tr>
        </tfoot>
      </table>
      {(t.unknownLines.length > 0 || budget.unknownCosts.length > 0) && (
        <p className="mt-2 rounded-sm bg-amber-bg/60 px-3 py-2 text-xs text-amber-warn">
          <span className="font-semibold">Unknown costs (excluded from the total, not counted as zero): </span>
          {[...t.unknownLines.map((l) => l.label), ...budget.unknownCosts].join(' · ')}
        </p>
      )}
      <details className="mt-3 text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold text-slate-ink">Assumptions</summary>
        <ul className="mt-1 list-disc space-y-0.5 pl-4">
          {budget.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        {budget.exceptionalJustification && (
          <p className="mt-2">
            <span className="font-semibold text-amber-warn">Why the extra expenditure may be justified: </span>
            {budget.exceptionalJustification}
          </p>
        )}
      </details>
    </div>
  );
}
