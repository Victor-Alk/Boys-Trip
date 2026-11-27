import type { Destination } from '../../types/destination';
import { computeScenario, EXCEPTIONAL_MAX_EUR, formatEUR, hasMaterialUncertainty } from '../../lib/budget';

/** Unambiguous warnings for destinations that cannot enter the eligible ranking. */
export function StatusBanner({ d }: { d: Destination }) {
  const total = computeScenario(d.budget, 'realistic').totalPerPerson;
  const items: { tone: 'red' | 'amber'; title: string; text: string }[] = [];
  if (d.security.status === 'excluded')
    items.push({
      tone: 'red',
      title: 'Excluded — informational concept only',
      text: `${d.security.summary} This presentation describes the cultural and geographical potential; it is not a recommended or bookable itinerary.`,
    });
  else if (d.security.status === 'conditional')
    items.push({
      tone: 'amber',
      title: 'Conditional — cannot enter the eligible ranking',
      text: d.security.summary,
    });
  if (total > EXCEPTIONAL_MAX_EUR)
    items.push({
      tone: 'red',
      title: `Outside the €2,500 maximum (${formatEUR(total)} per person)`,
      text: 'Retained for comparison only; it cannot win the eligible ranking unless a credible cheaper itinerary is adopted.',
    });
  if (total > EXCEPTIONAL_MAX_EUR - 100 && total <= EXCEPTIONAL_MAX_EUR)
    items.push({
      tone: 'amber',
      title: `Close to the €2,500 maximum (${formatEUR(total)} per person)`,
      text: 'Within €100 of the exceptional maximum: a modest rise in flight or local prices would make it ineligible. Check real quotations before relying on it.',
    });
  if (hasMaterialUncertainty(d.budget))
    items.push({
      tone: 'amber',
      title: 'Material budget uncertainty',
      text: d.budget.materialUncertaintyNote || 'Some essential costs are unknown, so this destination is kept out of the definitive ranking until they are confirmed.',
    });
  if (items.length === 0) return null;
  return (
    <div className="mb-6 space-y-2">
      {items.map((it) => (
        <div
          key={it.title}
          role="note"
          className={`rounded-sm border-l-4 px-4 py-3 text-sm ${it.tone === 'red' ? 'border-red-warn bg-red-bg/70 text-slate-ink' : 'border-amber-warn bg-amber-bg/70 text-slate-ink'}`}
        >
          <p className={`font-semibold ${it.tone === 'red' ? 'text-red-warn' : 'text-amber-warn'}`}>{it.title}</p>
          <p className="mt-0.5 leading-relaxed">{it.text}</p>
        </div>
      ))}
    </div>
  );
}
