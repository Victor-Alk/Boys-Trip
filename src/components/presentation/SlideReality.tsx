import type { Destination, ImageCredit } from '../../types/destination';
import { BudgetBreakdown } from '../budget/BudgetBreakdown';
import { SecurityBadge } from '../ui/Badges';
import { Photo } from '../ui/Photo';
import { RATING_LABEL, tagLabel } from '../../lib/labels';
import { StatusBanner } from './StatusBanner';
import { useEvaluations } from '../../state/evaluations';

const RISK_TONE: Record<string, string> = {
  low: 'text-green-ok',
  moderate: 'text-slate-600',
  elevated: 'text-amber-warn',
  high: 'text-red-warn',
  severe: 'text-red-warn font-bold',
};

export function SlideReality({ d, credits, onEvaluate }: { d: Destination; credits: Map<string, ImageCredit>; onEvaluate: () => void }) {
  const { responses } = useEvaluations();
  const reality = d.images.reality.map((id) => credits.get(id)).filter(Boolean) as ImageCredit[];
  const sourceById = new Map(d.sources.map((s) => [s.id, s]));
  const latestAccess = d.sources.reduce((m, s) => (s.accessedAt > m ? s.accessedAt : m), '');

  return (
    <article className="px-5 py-6 lg:px-8">
      <p className="eyebrow text-bronze-600">03 — The Practical Reality · Can we realistically do it?</p>
      <div className="mt-4">
        <StatusBanner d={d} />
      </div>

      <BudgetBreakdown destinationId={d.id} budget={d.budget} />

      <section className="mt-10" aria-labelledby="months">
        <h2 id="months" className="text-2xl font-semibold">
          February or March?
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Recommended: <span className="font-semibold text-slate-ink">{d.recommendedTravelWindow.window}</span> — {d.recommendedTravelWindow.rationale}
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(['february', 'march'] as const).map((m) => {
            const c = d.climate[m];
            const s = m === 'february' ? d.februarySuitability : d.marchSuitability;
            const preferred = d.recommendedTravelWindow.preferredMonth.toLowerCase() === m;
            return (
              <div key={m} className={`rounded-sm border p-4 ${preferred ? 'border-bronze-600/50 bg-sand-100/60' : 'border-slate-ink/12 bg-white/50'}`}>
                <div className="flex items-baseline justify-between">
                  <h3 className="font-display text-lg font-semibold capitalize">{m}</h3>
                  <span className="chip border-slate-ink/15 bg-white text-slate-600">{RATING_LABEL[s.rating]}{preferred ? ' · preferred' : ''}</span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Day</dt>
                    <dd className="num font-semibold">
                      {c.dayTempC[0]}–{c.dayTempC[1]} °C
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Night</dt>
                    <dd className="num font-semibold">
                      {c.nightTempC[0]}–{c.nightTempC[1]} °C
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  <span className="font-semibold text-slate-ink">Rain:</span> {c.rainfall}
                  {c.humidity && (
                    <>
                      {' '}
                      <span className="font-semibold text-slate-ink">Humidity:</span> {c.humidity}
                    </>
                  )}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{s.summary}</p>
                {c.notes && <p className="mt-1 text-xs leading-relaxed text-slate-500">{c.notes}</p>}
              </div>
            );
          })}
        </div>
        <div className="mt-4 grid gap-x-6 gap-y-2 text-xs text-slate-600 md:grid-cols-2">
          {d.climate.ramadan2027 && <Info label="Ramadan 2027" value={d.climate.ramadan2027} />}
          {d.climate.lunarNewYear2027 && <Info label="Lunar New Year 2027" value={d.climate.lunarNewYear2027} />}
          {d.climate.snowAndMountainAccess && <Info label="Snow & mountain access" value={d.climate.snowAndMountainAccess} />}
          {d.climate.seaConditions && <Info label="Sea conditions" value={d.climate.seaConditions} />}
          {d.climate.airQuality && <Info label="Air quality" value={d.climate.airQuality} />}
          {d.climate.wildlifeSeasonality && <Info label="Wildlife" value={d.climate.wildlifeSeasonality} />}
          <Info label="Tourist demand" value={d.climate.tourismDemand} />
          <Info label="Flight prices" value={d.climate.flightPriceSeasonality} />
        </div>
        {d.climate.holidaysAndFestivals.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
            {d.climate.holidaysAndFestivals.map((h) => (
              <li key={h.name} className="chip border-slate-ink/15 bg-white/60 text-slate-600" title={h.impact}>
                {h.name} · {h.dates}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 grid gap-x-8 gap-y-6 md:grid-cols-2">
        <Block title="Driving">
          <p className="font-semibold">{d.drivingRequirements.selfDriveFeasible ? 'Self-drive feasible for the two licensed drivers' : 'Self-drive not recommended'}</p>
          <p className="mt-1">{d.drivingRequirements.summary}</p>
          <p className="mt-1">
            <span className="font-semibold">Permit:</span> {d.drivingRequirements.internationalDrivingPermit}
          </p>
          <p className="mt-1">
            <span className="font-semibold">Motorbikes &amp; scooters:</span> {d.drivingRequirements.motorcycleNotes}
          </p>
          <p className="mt-1">
            <span className="font-semibold">Recommended:</span> {d.drivingRequirements.recommendedApproach}
          </p>
        </Block>
        <Block title="Camping & difficulty">
          <p>
            <span className="font-semibold">Camping: {tagLabel(d.camping.feasibility)}.</span> {d.camping.summary}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-semibold">Physical difficulty</span>
            <span className="flex gap-0.5" aria-label={`${d.physicalDifficulty.level} out of 5`}>
              {[1, 2, 3, 4, 5].map((i) => (
                <span key={i} className={`h-2 w-5 rounded-[1px] ${i <= d.physicalDifficulty.level ? 'bg-bronze-600' : 'bg-sand-200'}`} />
              ))}
            </span>
            <span className="text-xs capitalize text-slate-600">{d.physicalDifficulty.label}</span>
          </div>
          <p className="mt-1">{d.physicalDifficulty.summary}</p>
        </Block>
        <Block title="Entry & logistics">
          <Info label="Visa" value={d.practicalRequirements.visa} />
          <Info label="Entry" value={d.practicalRequirements.entry} />
          <Info label="Passport" value={d.practicalRequirements.passportValidity} />
          {d.practicalRequirements.permits.length > 0 && <Info label="Permits" value={d.practicalRequirements.permits.join(' · ')} />}
          <Info label="Insurance" value={d.practicalRequirements.insurance} />
        </Block>
        <Block title="On the ground">
          <Info label="Connectivity" value={d.practicalRequirements.connectivity} />
          <Info label="Payments" value={d.practicalRequirements.payments} />
          <Info label="Medical" value={d.practicalRequirements.medical} />
          {d.practicalRequirements.fuel && <Info label="Fuel" value={d.practicalRequirements.fuel} />}
          {d.practicalRequirements.equipment.length > 0 && <Info label="Equipment" value={d.practicalRequirements.equipment.join(' · ')} />}
        </Block>
      </section>

      <section className="mt-10 rounded-sm border border-slate-ink/12 bg-white/50 p-5" aria-labelledby="security-title">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="security-title" className="text-2xl font-semibold">
            Security
          </h2>
          <SecurityBadge status={d.security.status} size="md" />
          <span className="text-xs text-slate-500">assessed {d.security.checkedAt}</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed">{d.security.summary}</p>
        <p className="mt-1 text-xs text-slate-600">
          <span className="font-semibold">Route assessed:</span> {d.security.assessedRoute}
        </p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          {(
            [
              ['Armed conflict', d.security.conflictRisk],
              ['Terrorism', d.security.terrorismRisk],
              ['Kidnapping', d.security.kidnappingRisk],
            ] as const
          ).map(([label, r]) => (
            <div key={label}>
              <p className="text-xs text-slate-500">{label}</p>
              <p className={`font-semibold capitalize ${RISK_TONE[r.level]}`}>{r.level}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{r.note}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] text-xs">
            <thead>
              <tr className="border-b border-slate-ink/20 text-left text-slate-500">
                <th className="py-1 pr-2 font-semibold">Authority</th>
                <th className="py-1 pr-2 font-semibold">Level</th>
                <th className="py-1 pr-2 font-semibold">Effect on the route</th>
                <th className="py-1 font-semibold">Checked</th>
              </tr>
            </thead>
            <tbody>
              {d.security.advisories.map((a) => {
                const src = sourceById.get(a.sourceId);
                return (
                  <tr key={`${a.authority}-${a.sourceId}`} className="border-b border-slate-ink/8 align-top">
                    <td className="py-1.5 pr-2 font-semibold">
                      {src ? (
                        <a href={src.url} target="_blank" rel="noopener noreferrer" className="underline decoration-slate-300 underline-offset-2 hover:decoration-bronze-600">
                          {a.authority}
                        </a>
                      ) : (
                        a.authority
                      )}
                    </td>
                    <td className="py-1.5 pr-2">{a.level}</td>
                    <td className="py-1.5 pr-2 text-slate-600">
                      {a.routeImpact} <span className="text-slate-500">({a.regionsAffected})</span>
                    </td>
                    <td className="num py-1.5">{a.checkedAt}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
          {d.security.regionalRestrictions.length > 0 && <Info label="Restrictions" value={d.security.regionalRestrictions.join(' · ')} />}
          {d.security.ordinaryRisks.length > 0 && <Info label="Ordinary risks" value={d.security.ordinaryRisks.join(' · ')} />}
          <Info label="Medical & evacuation" value={d.security.medicalAccess} />
          <Info label="Insurance" value={d.security.insuranceConsiderations} />
        </div>
        <p className="mt-3 rounded-sm bg-sand-100 px-3 py-2 text-xs">
          <span className="font-semibold">Reassessment: </span>
          {d.security.reassessmentRequired}
        </p>
      </section>

      <section className="mt-10 grid gap-6 md:grid-cols-3">
        <ListBlock title="Major advantages" items={d.advantages} tone="green" />
        <ListBlock title="Major disadvantages" items={d.disadvantages} tone="amber" />
        <ListBlock title="Important uncertainties" items={d.uncertainties} tone="slate" />
      </section>

      {reality.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-2 md:grid-cols-3">
          {reality.map((c) => (
            <Photo key={c.id} credit={c} caption aspect="3 / 2" sizes="(min-width: 1024px) 18vw, 50vw" />
          ))}
        </div>
      )}

      <details className="mt-8 rounded-sm border border-slate-ink/12 bg-white/40 px-4 py-3">
        <summary className="cursor-pointer text-sm font-semibold">
          Sources ({d.sources.length}) · last verified {latestAccess} · data version {d.version}
        </summary>
        <ol className="mt-3 space-y-2 text-xs">
          {d.sources.map((s) => (
            <li key={s.id} className="grid grid-cols-[2.5rem_1fr] gap-2">
              <span className="num font-semibold text-slate-500">{s.id}</span>
              <span>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-semibold underline decoration-slate-300 underline-offset-2 hover:decoration-bronze-600">
                  {s.title}
                </a>{' '}
                <span className="text-slate-500">
                  — {s.publisher} · {tagLabel(s.type)} · accessed {s.accessedAt}
                  {s.publishedAt ? ` · published ${s.publishedAt}` : ''}
                </span>
                <span className="block text-slate-600">Supports: {s.claims.join('; ')}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-[0.7rem] text-slate-500">
          Figures marked as estimates are planning assumptions, not quotations. Prices, advisories and access conditions must be rechecked before booking and shortly before departure.
        </p>
      </details>

      <div className="mt-10 flex flex-col items-center gap-2 border-t border-slate-ink/10 pt-8 text-center">
        <p className="text-sm text-slate-600">Five identical questions · about two minutes · saved privately to the group’s spreadsheet</p>
        <button type="button" className="btn-bronze px-6 py-3 text-base" onClick={onEvaluate}>
          {responses.has(d.id) ? 'Review or edit my evaluation' : 'Evaluate this expedition'}
        </button>
      </div>
    </article>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="text-sm leading-relaxed">
      <h2 className="eyebrow mb-2 text-forest-700">{title}</h2>
      {children}
    </div>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <p className="mt-1">
      <span className="font-semibold text-slate-ink">{label}: </span>
      {value}
    </p>
  );
}
function ListBlock({ title, items, tone }: { title: string; items: string[]; tone: 'green' | 'amber' | 'slate' }) {
  const mark = tone === 'green' ? '+' : tone === 'amber' ? '−' : '?';
  const cls = tone === 'green' ? 'text-green-ok' : tone === 'amber' ? 'text-amber-warn' : 'text-slate-500';
  return (
    <div>
      <h2 className="eyebrow text-slate-600">{title}</h2>
      <ul className="mt-2 space-y-1.5 text-sm leading-relaxed">
        {items.map((it) => (
          <li key={it} className="grid grid-cols-[1rem_1fr] gap-1">
            <span className={`font-bold ${cls}`} aria-hidden>
              {mark}
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
