import { summaries } from '../../lib/data';
import { navigate } from '../../lib/router';
import { formatEUR, PREFERRED_MAX_EUR, EXCEPTIONAL_MAX_EUR } from '../../lib/budget';
import { SecurityGlyph } from '../ui/Badges';
import { numberWords } from '../../lib/labels';

/** Shown in the presentation panel before a destination is chosen: a typographic atlas index. */
export function PortfolioCover() {
  const counts = {
    eligible: summaries.filter((s) => s.securityStatus === 'eligible').length,
    conditional: summaries.filter((s) => s.securityStatus === 'conditional').length,
    excluded: summaries.filter((s) => s.securityStatus === 'excluded').length,
    preferred: summaries.filter((s) => s.totalRealistic <= PREFERRED_MAX_EUR).length,
    exceptional: summaries.filter((s) => s.totalRealistic > PREFERRED_MAX_EUR && s.totalRealistic <= EXCEPTIONAL_MAX_EUR).length,
    outside: summaries.filter((s) => s.totalRealistic > EXCEPTIONAL_MAX_EUR).length,
  };
  const byContinent = new Map<string, typeof summaries>();
  for (const s of summaries) byContinent.set(s.continent, [...(byContinent.get(s.continent) ?? []), s]);

  return (
    <div className="px-6 py-8 lg:px-10 lg:py-10">
      <p className="eyebrow text-bronze-600">Expedition atlas · {summaries.length} concepts</p>
      <h1 className="mt-2 max-w-xl text-4xl font-semibold leading-[1.05] lg:text-5xl">Four friends. One expedition. {numberWords(summaries.length).replace(/^./, (c) => c.toUpperCase())} possible worlds.</h1>
      <p className="mt-4 max-w-xl text-[1.02rem] leading-relaxed text-slate-600">
        Turn the globe, open an expedition and read its three pages — the experience, the journey, the practical reality. Then score it with the same five questions as everyone else. Scores stay hidden until all four of you have voted on a destination.
      </p>

      <dl className="mt-7 grid max-w-xl grid-cols-3 gap-px overflow-hidden rounded-sm border border-slate-ink/10 bg-slate-ink/10 text-center">
        <Stat label="Eligible" value={counts.eligible} />
        <Stat label="Conditional" value={counts.conditional} />
        <Stat label="Excluded" value={counts.excluded} />
        <Stat label="≤ €2,000" value={counts.preferred} />
        <Stat label="€2,001–2,500" value={counts.exceptional} />
        <Stat label="> €2,500" value={counts.outside} />
      </dl>

      <div className="mt-9 grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {[...byContinent.entries()].map(([continent, list]) => (
          <section key={continent}>
            <h2 className="eyebrow border-b border-slate-ink/15 pb-1 text-slate-500">{continent}</h2>
            <ul className="mt-1">
              {list.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => navigate({ page: 'explore', destinationId: s.id })} className="group flex w-full items-baseline gap-2 py-1.5 text-left">
                    <span className="num w-6 text-xs text-bronze-600">{s.id.slice(1)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="font-display text-[1.02rem] font-semibold group-hover:text-bronze-700">{s.country}</span>
                      <span className="block truncate text-xs text-slate-500">{s.title.split('—').pop()?.trim()}</span>
                    </span>
                    <span className="num text-xs text-slate-600">{formatEUR(s.totalRealistic)}</span>
                    <SecurityGlyph status={s.securityStatus} className={s.securityStatus === 'eligible' ? 'text-green-ok' : s.securityStatus === 'conditional' ? 'text-amber-warn' : 'text-red-warn'} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-8 border-t border-slate-ink/10 pt-4 text-sm text-slate-600">
        Missing somewhere?{' '}
        <button type="button" className="font-semibold text-bronze-700 hover:underline" onClick={() => navigate({ page: 'my-evaluations' })}>
          Propose a destination →
        </button>{' '}
        It will be researched into its own three-slide presentation.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-paper px-2 py-3">
      <dd className="num font-display text-2xl font-semibold">{value}</dd>
      <dt className="text-[0.68rem] text-slate-500">{label}</dt>
    </div>
  );
}
