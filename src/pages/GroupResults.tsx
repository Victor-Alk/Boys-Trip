import { useMemo, useState } from 'react';
import { useSession } from '../state/session';
import { useEvaluations } from '../state/evaluations';
import { useCollective } from '../hooks/useCollective';
import { summaries, summaryById, configuration, questionnaire, participantName } from '../lib/data';
import { navigate } from '../lib/router';
import { EXCEPTIONAL_MAX_EUR, formatEUR, PREFERRED_MAX_EUR } from '../lib/budget';
import {
  buildShortlist,
  EQUAL_WEIGHTS,
  formatScore,
  individualScore,
  participantProfile,
  PARTICIPANT_IDS,
  QUESTION_KEYS,
  weightsValid,
  type DestinationStats,
  type ParticipantId,
  type QuestionKey,
  type RankedEntry,
  type Weights,
} from '../lib/statistics';
import { SecurityBadge, BudgetBadge, NoveltyBadge } from '../components/ui/Badges';
import { BudgetScatter, ConsensusScatter, GroupedBars, PARTICIPANT_COLOR, SERIES, type ScatterDatum } from '../components/results/charts';
import { tagLabel } from '../lib/labels';
import type { Exclusion } from '../lib/statistics';

const DIM_LABEL: Record<QuestionKey, string> = { q1: 'Enthusiasm', q2: 'Culture', q3: 'Geography', q4: 'Adventure', q5: 'Practical' };
const EXCLUSION_LABEL: Record<Exclusion, string> = {
  security: 'Security: not eligible',
  budget: 'Above €2,500 per person',
  'budget-uncertainty': 'Material budget uncertainty',
  incomplete: 'Awaiting all four evaluations',
};

function consensusLabel(st: DestinationStats): { label: string; cls: string } {
  if (st.sd < 1) return { label: 'Strong', cls: 'text-green-ok' };
  if (st.sd < 2) return { label: 'Moderate', cls: 'text-slate-600' };
  return { label: 'Divided', cls: 'text-amber-warn' };
}

export default function GroupResultsPage() {
  const { session, openSignIn } = useSession();
  const { completion, results, novelty, responses, loading, refresh, loadError } = useEvaluations();
  const [weightMode, setWeightMode] = useState(false);
  const [weights, setWeights] = useState<Weights>(EQUAL_WEIGHTS);
  const effectiveWeights = weightMode && weightsValid(weights) ? weights : EQUAL_WEIGHTS;
  const collective = useCollective(effectiveWeights);
  const equal = useCollective(EQUAL_WEIGHTS);
  const [metric, setMetric] = useState<'overall' | QuestionKey>('overall');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [includeInformational, setIncludeInformational] = useState(false);

  const shortlist = useMemo(() => buildShortlist(equal.ranking), [equal.ranking]);

  if (!session) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="eyebrow text-bronze-600">Group results</p>
        <h1 className="mt-2 text-4xl font-semibold">Collective results are private</h1>
        <p className="mx-auto mt-3 max-w-lg text-slate-600">Sign in to see completion, consensus and the eligible ranking. Scores for a destination are revealed only after all four participants have evaluated it.</p>
        <button type="button" className="btn-primary mt-6" onClick={openSignIn}>
          Sign in
        </button>
      </main>
    );
  }

  const ranked = collective.ranking.ranked;
  const excluded = collective.ranking.excluded;
  const incomplete = excluded.filter((e) => e.reason === 'incomplete');
  const informational = excluded.filter((e) => e.reason !== 'incomplete');
  const rankable = summaries.filter((s) => s.securityStatus === 'eligible' && s.totalRealistic <= EXCEPTIONAL_MAX_EUR && !s.materialUncertainty);
  const allRankableComplete = rankable.length > 0 && rankable.every((s) => collective.stats.get(s.id)?.complete);

  const fully = summaries.filter((s) => (collective.count(s.id) ?? 0) >= 4).length;
  const tracking: [string, string | number][] = [
    ['Evaluations submitted', `${completion?.totalActive ?? '—'} / 80`],
    ['Fully evaluated destinations', `${completion?.fullyEvaluated ?? fully} / 20`],
    ['Eligible', summaries.filter((s) => s.securityStatus === 'eligible').length],
    ['Conditional', summaries.filter((s) => s.securityStatus === 'conditional').length],
    ['Excluded', summaries.filter((s) => s.securityStatus === 'excluded').length],
    ['Within €2,000', summaries.filter((s) => s.totalRealistic <= PREFERRED_MAX_EUR).length],
    ['Exceptional (€2,001–2,500)', summaries.filter((s) => s.totalRealistic > PREFERRED_MAX_EUR && s.totalRealistic <= EXCEPTIONAL_MAX_EUR).length],
    ['Above €2,500', summaries.filter((s) => s.totalRealistic > EXCEPTIONAL_MAX_EUR).length],
  ];

  const name = (id: string) => summaryById.get(id as never)?.country ?? id;
  const consensusData: ScatterDatum[] = [...collective.stats.entries()]
    .filter(([, st]) => st?.complete)
    .filter(([id]) => includeInformational || ranked.some((r) => r.candidate.id === id))
    .map(([id, st]) => ({ id, name: name(id), x: st!.mean, y: st!.min }));
  const budgetData: ScatterDatum[] = [...collective.stats.entries()]
    .filter(([, st]) => st?.complete)
    .filter(([id]) => includeInformational || ranked.some((r) => r.candidate.id === id))
    .map(([id, st]) => ({ id, name: name(id), x: summaryById.get(id as never)!.totalRealistic, y: st!.mean, tone: ranked.some((r) => r.candidate.id === id) ? 'eligible' : 'other' }));

  // Heatmap values: revealed responses for everyone; own responses always.
  const cellValue = (destId: string, pid: ParticipantId): number | null => {
    const revealed = results?.destinations[destId]?.revealed ? results.destinations[destId].responses.find((r) => r.participantId === pid) : undefined;
    const own = pid === session.participant.id ? responses.get(destId) : undefined;
    const answers = revealed?.answers ?? own?.answers;
    if (!answers) return null;
    return metric === 'overall' ? individualScore(answers) : answers[metric];
  };

  const profiles = PARTICIPANT_IDS.map((pid) => {
    const list: { destinationId: string; answers: Record<QuestionKey, number> }[] = [];
    for (const s of summaries) {
      const r = results?.destinations[s.id]?.revealed ? results.destinations[s.id].responses.find((x) => x.participantId === pid) : undefined;
      const own = pid === session.participant.id ? responses.get(s.id) : undefined;
      const a = r?.answers ?? own?.answers;
      if (a) list.push({ destinationId: s.id, answers: a });
    }
    return participantProfile(pid, list);
  });

  const compareData = QUESTION_KEYS.map((k) => {
    const row: Record<string, string | number | null> = { dimension: DIM_LABEL[k] };
    for (const id of compareIds) row[id] = collective.stats.get(id)?.complete ? collective.stats.get(id)!.meanByQuestion[k] : null;
    return row;
  });

  return (
    <main className="mx-auto max-w-[1500px] px-4 py-10 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-bronze-600">Group results</p>
          <h1 className="mt-1 text-4xl font-semibold">Where the group is heading</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Subjective preferences, not travel facts. Reveal policy: <span className="font-semibold">{results?.policy ?? '—'}</span>
            {results?.blindVoting ? ' — scores appear only once all four have evaluated a destination.' : '.'} Destinations that fail security or exceed €2,500 can never enter the eligible ranking.
          </p>
        </div>
        <button type="button" className="btn-ghost text-xs" onClick={() => void refresh()} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      {loadError && <p className="mt-3 text-sm text-red-warn">Could not load results: {loadError}</p>}

      <section className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-slate-ink/10 bg-slate-ink/10 sm:grid-cols-4 lg:grid-cols-8" aria-label="Completion tracking">
        {tracking.map(([l, v]) => (
          <div key={l} className="bg-paper px-3 py-3">
            <p className="num font-display text-2xl font-semibold">{v}</p>
            <p className="text-[0.7rem] leading-tight text-slate-500">{l}</p>
          </div>
        ))}
      </section>
      <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-600">
        {configuration.participants.map((p) => (
          <span key={p.id} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: PARTICIPANT_COLOR[p.id] }} />
            {p.name}: <span className="num font-semibold text-slate-ink">{completion?.perParticipant[p.id] ?? 0}/20</span>
          </span>
        ))}
      </div>

      {/* Shortlist */}
      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Shortlist</h2>
        <p className="mt-1 text-sm text-slate-600">
          {allRankableComplete
            ? 'All rankable destinations have been evaluated by all four participants.'
            : `Provisional — ${rankable.filter((s) => !collective.stats.get(s.id)?.complete).length} rankable destination(s) still await all four evaluations. No winner is declared yet.`}
        </p>
        {equal.ranking.ranked.length === 0 ? (
          <p className="mt-4 rounded-sm border border-dashed border-slate-ink/20 p-6 text-center text-sm text-slate-500">Nothing to show yet: no eligible destination has been evaluated by all four participants.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ShortCard title={allRankableComplete ? 'Highest-rated eligible destination' : 'Provisional leader'} e={shortlist.highestRated} metric={(e) => e.stats.mean} />
            <ShortCard title="Highest-rated below €2,000" e={shortlist.highestBelowPreferred} metric={(e) => e.stats.mean} />
            <ShortCard title="Strongest consensus" e={shortlist.strongestConsensus} metric={(e) => e.stats.sd} metricLabel="spread (SD)" />
            <ShortCard title="Most popular (enthusiasm)" e={shortlist.mostPopular} metric={(e) => e.stats.meanByQuestion.q1} />
            <ShortCard title="Best cultural appeal" e={shortlist.bestCultural} metric={(e) => e.stats.meanByQuestion.q2} />
            <ShortCard title="Best geographical appeal" e={shortlist.bestGeographical} metric={(e) => e.stats.meanByQuestion.q3} />
            <ShortCard title="Best adventure appeal" e={shortlist.bestAdventure} metric={(e) => e.stats.meanByQuestion.q4} />
            <ShortCard title="Best practical suitability" e={shortlist.bestPractical} metric={(e) => e.stats.meanByQuestion.q5} />
            <ShortCard title="Best-rated affordable (< €1,500)" e={shortlist.bestAffordable} metric={(e) => e.stats.mean} />
            <NoveltyCard ranked={equal.ranking.ranked} novelty={novelty} />
          </div>
        )}
      </section>

      {/* Ranking */}
      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-semibold">Eligible ranking{weightMode ? ' — custom weights' : ''}</h2>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" className="accent-bronze-600" checked={weightMode} onChange={(e) => setWeightMode(e.target.checked)} />
            <span className="font-semibold">Advanced: change criteria weights</span>
          </label>
        </div>
        {weightMode && <WeightsEditor weights={weights} onChange={setWeights} />}
        <p className="mt-1 text-xs text-slate-500">
          Rules: security-eligible → ≤ €2,500 → no material budget uncertainty → evaluated by all four → collective score, then lowest individual score, then mean enthusiasm, then destination number. Weights never alter submitted answers.
        </p>
        <div className="mt-3 overflow-x-auto rounded-sm border border-slate-ink/12 bg-paper">
          <table className="w-full min-w-[70rem] text-sm">
            <thead className="border-b border-slate-ink/15 bg-sand-100/60 text-left text-[0.68rem] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2">Rank</th>
                <th className="px-2 py-2">Destination</th>
                <th className="px-2 py-2">Collective</th>
                <th className="px-2 py-2">Lowest</th>
                <th className="px-2 py-2">Consensus</th>
                <th className="px-2 py-2">Culture</th>
                <th className="px-2 py-2">Geography</th>
                <th className="px-2 py-2">Adventure</th>
                <th className="px-2 py-2">Practical</th>
                <th className="px-2 py-2">Total pp</th>
                <th className="px-2 py-2">Novelty</th>
                <th className="px-2 py-2">Completion</th>
                <th className="px-3 py-2">Security</th>
              </tr>
            </thead>
            <tbody>
              {ranked.length === 0 && (
                <tr>
                  <td colSpan={13} className="px-3 py-6 text-center text-slate-500">
                    No eligible destination is fully evaluated yet.
                  </td>
                </tr>
              )}
              {ranked.map((e) => {
                const s = summaryById.get(e.candidate.id as never)!;
                const c = consensusLabel(e.stats);
                return (
                  <tr key={e.candidate.id} className="cursor-pointer border-b border-slate-ink/8 hover:bg-sand-100/60" onClick={() => navigate({ page: 'explore', destinationId: s.id })}>
                    <td className="num px-3 py-2.5 font-display text-2xl font-semibold text-bronze-600">{e.rank}</td>
                    <td className="px-2 py-2.5">
                      <span className="font-semibold">{s.country}</span>
                      <span className="block text-xs text-slate-500">{s.title.split('—').pop()?.trim()}</span>
                      {e.stats.reservation && <span className="chip mt-1 border-amber-warn/40 bg-amber-bg text-amber-warn">Significant individual reservation</span>}
                    </td>
                    <td className="num px-2 py-2.5 font-display text-xl font-semibold">{formatScore(e.stats.mean)}</td>
                    <td className="num px-2 py-2.5">{formatScore(e.stats.min, 1)}</td>
                    <td className={`px-2 py-2.5 text-xs font-semibold ${c.cls}`}>
                      {c.label}
                      <span className="num block font-normal text-slate-500">SD {e.stats.sd.toFixed(2)} · range {e.stats.range.toFixed(1)}</span>
                    </td>
                    <td className="num px-2 py-2.5">{formatScore(e.stats.meanByQuestion.q2)}</td>
                    <td className="num px-2 py-2.5">{formatScore(e.stats.meanByQuestion.q3)}</td>
                    <td className="num px-2 py-2.5">{formatScore(e.stats.meanByQuestion.q4)}</td>
                    <td className="num px-2 py-2.5">{formatScore(e.stats.meanByQuestion.q5)}</td>
                    <td className="px-2 py-2.5">
                      <span className="num block font-semibold">{formatEUR(s.totalRealistic)}</span>
                      <BudgetBadge status={s.budgetStatus} />
                    </td>
                    <td className="px-2 py-2.5">
                      <NoveltyBadge entry={novelty?.[s.id]} signedIn compact />
                    </td>
                    <td className="num px-2 py-2.5 text-xs">4/4</td>
                    <td className="px-3 py-2.5">
                      <SecurityBadge status={s.securityStatus} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {ranked.length > 0 && (
          <details className="mt-2 text-xs text-slate-600">
            <summary className="cursor-pointer font-semibold">Full statistics (median, max, enthusiasm counts)</summary>
            <table className="mt-2 w-full min-w-[40rem] text-xs">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="py-1">Destination</th>
                  <th>Mean</th>
                  <th>Median</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Pop. SD</th>
                  <th>Range</th>
                  <th>Mean Q1</th>
                  <th>Q1 ≥ 8</th>
                  <th>Q1 ≤ 4</th>
                </tr>
              </thead>
              <tbody className="num">
                {ranked.map((e) => (
                  <tr key={e.candidate.id} className="border-t border-slate-ink/8">
                    <td className="py-1 font-sans font-semibold">{name(e.candidate.id)}</td>
                    <td>{e.stats.mean.toFixed(3)}</td>
                    <td>{e.stats.median.toFixed(2)}</td>
                    <td>{e.stats.min.toFixed(2)}</td>
                    <td>{e.stats.max.toFixed(2)}</td>
                    <td>{e.stats.sd.toFixed(4)}</td>
                    <td>{e.stats.range.toFixed(2)}</td>
                    <td>{e.stats.meanByQuestion.q1.toFixed(2)}</td>
                    <td>{e.stats.q1High}</td>
                    <td>{e.stats.q1Low}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-2">
        <div>
          <h3 className="text-lg font-semibold">Awaiting evaluations ({incomplete.length})</h3>
          <ul className="mt-2 divide-y divide-slate-ink/8 text-sm">
            {incomplete.map((e) => (
              <li key={e.candidate.id} className="flex items-center justify-between py-1.5">
                <button type="button" className="font-medium hover:text-bronze-700" onClick={() => navigate({ page: 'explore', destinationId: e.candidate.id })}>
                  {name(e.candidate.id)}
                </button>
                <span className="num text-xs text-slate-500">{collective.count(e.candidate.id) ?? 0}/4 evaluated · scores hidden</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-lg font-semibold">Informational only ({informational.length})</h3>
          <p className="text-xs text-slate-500">Can be inspected and evaluated, but never ranked, whatever their scores.</p>
          <ul className="mt-2 divide-y divide-slate-ink/8 text-sm">
            {informational.map((e) => {
              const st = collective.stats.get(e.candidate.id);
              return (
                <li key={e.candidate.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                  <span className="flex items-center gap-2">
                    <span className="font-medium">{name(e.candidate.id)}</span>
                    <SecurityBadge status={e.candidate.securityStatus} />
                  </span>
                  <span className="text-xs text-slate-500">
                    {EXCLUSION_LABEL[e.reason]}
                    {st?.complete ? ` · group score ${formatScore(st.mean)}` : ` · ${collective.count(e.candidate.id) ?? 0}/4`}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Heatmap */}
      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-semibold">Participant comparison</h2>
          <div role="radiogroup" aria-label="Heatmap metric" className="flex flex-wrap gap-1">
            {(['overall', ...QUESTION_KEYS] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={metric === m}
                onClick={() => setMetric(m)}
                className={`rounded-sm px-2.5 py-1 text-xs font-semibold ${metric === m ? 'bg-midnight-900 text-ivory' : 'border border-slate-ink/15 text-slate-600 hover:text-slate-ink'}`}
              >
                {m === 'overall' ? 'Overall score' : DIM_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-500">Other participants’ cells appear only for revealed destinations; your own column is always visible to you.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-auto min-w-[34rem] border-separate border-spacing-0.5 text-sm">
            <thead>
              <tr>
                <th className="px-2 py-1 text-left text-xs text-slate-500">Destination</th>
                {configuration.participants.map((p) => (
                  <th key={p.id} className="px-2 py-1 text-center text-xs font-semibold">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.id}>
                  <td className="whitespace-nowrap px-2 py-1 text-xs font-medium">
                    {s.country}
                    {s.securityStatus !== 'eligible' && <span className="ml-1 text-[0.65rem] text-slate-500">({s.securityStatus})</span>}
                  </td>
                  {PARTICIPANT_IDS.map((pid) => {
                    const v = cellValue(s.id, pid);
                    return (
                      <td key={pid} className="num h-8 w-24 text-center text-xs font-semibold" style={heatStyle(v)} title={v === null ? 'Hidden or not yet evaluated' : v.toFixed(2)}>
                        {v === null ? <span className="font-normal text-slate-300">·</span> : metric === 'overall' ? v.toFixed(1) : v}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex items-center gap-2 text-[0.68rem] text-slate-500">
            <span>1</span>
            <span className="h-2 w-40 rounded-full" style={{ background: 'linear-gradient(90deg, #f4eee2, #c8a97e, #6b8f73, #1f3a2a)' }} />
            <span>10</span>
          </div>
        </div>
      </section>

      {/* Charts */}
      <section className="mt-12 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-xl font-semibold">Consensus: average vs lowest score</h2>
          <p className="text-xs text-slate-500">Top-right destinations are both highly rated and acceptable to everyone.</p>
          {consensusData.length ? <ConsensusScatter data={consensusData} /> : <EmptyChart />}
        </div>
        <div>
          <h2 className="text-xl font-semibold">Budget vs enthusiasm</h2>
          <p className="text-xs text-slate-500">Realistic total per person (flights from CDG) against collective score.</p>
          {budgetData.length ? <BudgetScatter data={budgetData} /> : <EmptyChart />}
        </div>
        <label className="flex items-center gap-2 text-xs lg:col-span-2">
          <input type="checkbox" className="accent-bronze-600" checked={includeInformational} onChange={(e) => setIncludeInformational(e.target.checked)} />
          Include fully evaluated informational destinations (grey diamonds) — they remain ineligible.
        </label>
      </section>

      {/* Compare */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Compare two to four destinations</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {summaries.map((s) => {
            const on = compareIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={on}
                disabled={!on && compareIds.length >= 4}
                onClick={() => setCompareIds((ids) => (on ? ids.filter((x) => x !== s.id) : [...ids, s.id]))}
                className={`rounded-sm border px-2 py-1 text-xs font-medium disabled:opacity-40 ${on ? 'border-midnight-900 bg-midnight-900 text-ivory' : 'border-slate-ink/15 hover:border-slate-ink/40'}`}
              >
                {s.country}
              </button>
            );
          })}
        </div>
        {compareIds.length >= 2 ? (
          <div className="mt-5 grid gap-6 xl:grid-cols-[1fr_1fr]">
            <div>
              <GroupedBars data={compareData} series={compareIds.map((id, i) => ({ key: id, label: name(id), color: SERIES[i] }))} />
              <p className="text-xs text-slate-500">Collective means per dimension; empty bars mean the destination is not yet revealed.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-xs">
                <tbody>
                  {(
                    [
                      ['Collective score', (id: string) => formatScore(collective.stats.get(id)?.complete ? collective.stats.get(id)!.mean : null)],
                      ...PARTICIPANT_IDS.map((pid) => [participantName(pid), (id: string) => formatScore(cellValueOverall(results, responses, session.participant.id, id, pid))] as const),
                      ['Total pp', (id: string) => formatEUR(summaryById.get(id as never)!.totalRealistic)],
                      ['Duration', (id: string) => `${summaryById.get(id as never)!.totalDays} days`],
                      ['Style', (id: string) => tagLabel(summaryById.get(id as never)!.travelStylePrimary)],
                      ['Geography', (id: string) => summaryById.get(id as never)!.geographyTags.slice(0, 4).map(tagLabel).join(', ')],
                      ['Culture', (id: string) => summaryById.get(id as never)!.cultureTags.slice(0, 4).map(tagLabel).join(', ')],
                      ['Novelty', (id: string) => (novelty?.[id] ? (novelty[id].newToAll ? 'New to all four' : `${4 - novelty[id].visitedCount}/4 new`) : '—')],
                      ['Security', (id: string) => summaryById.get(id as never)!.securityStatus],
                      ['Camping', (id: string) => tagLabel(summaryById.get(id as never)!.campingFeasibility)],
                      ['Difficulty', (id: string) => `${summaryById.get(id as never)!.physicalDifficulty}/5`],
                    ] as [string, (id: string) => string][]
                  ).map(([label, fn]) => (
                    <tr key={label} className="border-b border-slate-ink/8">
                      <th className="py-1.5 pr-3 text-left font-semibold text-slate-600">{label}</th>
                      {compareIds.map((id) => (
                        <td key={id} className="num px-2 py-1.5">
                          {fn(id)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">Select at least two destinations.</p>
        )}
      </section>

      {/* Profiles */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold">Personal preference profiles</h2>
        <p className="mt-1 text-xs text-slate-500">Average scores per dimension across the evaluations visible to you. Travel preferences only — no inference about personality.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {profiles.map((p) => (
            <div key={p.participantId} className="rounded-sm border border-slate-ink/12 bg-paper p-4">
              <p className="flex items-center gap-2 font-semibold">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: PARTICIPANT_COLOR[p.participantId] }} />
                {participantName(p.participantId)}
                <span className="num ml-auto text-xs font-normal text-slate-500">{p.count} visible</span>
              </p>
              {p.count < 3 ? (
                <p className="mt-3 text-xs text-slate-500">Not enough visible evaluations yet.</p>
              ) : (
                <>
                  <ul className="mt-3 space-y-1.5">
                    {QUESTION_KEYS.map((k) => (
                      <li key={k} className="grid grid-cols-[5rem_1fr_2rem] items-center gap-2 text-xs">
                        <span className="text-slate-600">{DIM_LABEL[k]}</span>
                        <span className="h-1.5 rounded-full bg-sand-100">
                          <span className="block h-full rounded-full" style={{ width: `${(p.meanByQuestion[k] / 10) * 100}%`, background: PARTICIPANT_COLOR[p.participantId] }} />
                        </span>
                        <span className="num text-right font-semibold">{p.meanByQuestion[k].toFixed(1)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-slate-600">
                    Top: {p.top.map((t) => `${name(t.destinationId)} (${t.score.toFixed(1)})`).join(' · ')}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      </section>
      <p className="mt-10 text-center text-[0.7rem] text-slate-500">Questionnaire version {questionnaire.version} · statistics computed from responses the server has revealed to you.</p>
    </main>
  );
}

function EmptyChart() {
  return <p className="mt-4 rounded-sm border border-dashed border-slate-ink/20 p-10 text-center text-sm text-slate-500">No fully evaluated destination to plot yet.</p>;
}

function cellValueOverall(
  results: ReturnType<typeof useEvaluations>['results'],
  responses: ReturnType<typeof useEvaluations>['responses'],
  me: string,
  destId: string,
  pid: ParticipantId,
): number | null {
  const r = results?.destinations[destId]?.revealed ? results.destinations[destId].responses.find((x) => x.participantId === pid) : undefined;
  const own = pid === me ? responses.get(destId) : undefined;
  const a = r?.answers ?? own?.answers;
  return a ? individualScore(a) : null;
}

function heatStyle(v: number | null): React.CSSProperties {
  if (v === null) return { background: '#f7f3ea' };
  const t = Math.max(0, Math.min(1, (v - 1) / 9));
  const stops = [
    [244, 238, 226],
    [200, 169, 126],
    [107, 143, 115],
    [31, 58, 42],
  ];
  const seg = Math.min(2, Math.floor(t * 3));
  const local = t * 3 - seg;
  const [a, b] = [stops[seg], stops[seg + 1]];
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * local));
  return { background: `rgb(${c.join(',')})`, color: t > 0.55 ? '#faf7f0' : '#26303a' };
}

function ShortCard({ title, e, metric, metricLabel = 'score' }: { title: string; e: RankedEntry | undefined; metric: (e: RankedEntry) => number; metricLabel?: string }) {
  return (
    <div className="rounded-sm border border-slate-ink/12 bg-paper p-4">
      <p className="eyebrow text-[0.6rem] text-bronze-600">{title}</p>
      {e ? (
        <button type="button" className="mt-1 text-left" onClick={() => navigate({ page: 'explore', destinationId: e.candidate.id })}>
          <span className="font-display text-xl font-semibold">{summaryById.get(e.candidate.id as never)?.country}</span>
          <span className="num block text-xs text-slate-500">
            {metricLabel} {metric(e).toFixed(2)} · collective {e.stats.mean.toFixed(2)} · {formatEUR(e.candidate.totalRealistic)}
          </span>
        </button>
      ) : (
        <p className="mt-1 text-sm text-slate-500">None qualifies yet</p>
      )}
    </div>
  );
}

function NoveltyCard({ ranked, novelty }: { ranked: RankedEntry[]; novelty: Record<string, { newToAll: boolean; visitedCount: number }> | null }) {
  const best = ranked.filter((e) => novelty?.[e.candidate.id]).sort((a, b) => novelty![a.candidate.id].visitedCount - novelty![b.candidate.id].visitedCount || a.rank - b.rank)[0];
  return (
    <div className="rounded-sm border border-slate-ink/12 bg-paper p-4">
      <p className="eyebrow text-[0.6rem] text-bronze-600">Most collectively novel (ranked)</p>
      {best ? (
        <p className="mt-1">
          <span className="font-display text-xl font-semibold">{summaryById.get(best.candidate.id as never)?.country}</span>
          <span className="block text-xs text-slate-500">{novelty![best.candidate.id].newToAll ? 'New to all four, based on provided travel histories' : `${4 - novelty![best.candidate.id].visitedCount}/4 new`}</span>
        </p>
      ) : (
        <p className="mt-1 text-sm text-slate-500">Novelty data unavailable</p>
      )}
    </div>
  );
}

function WeightsEditor({ weights, onChange }: { weights: Weights; onChange: (w: Weights) => void }) {
  const sum = QUESTION_KEYS.reduce((a, k) => a + weights[k], 0);
  return (
    <div className="mt-3 rounded-sm border border-slate-ink/12 bg-white/50 p-4">
      <div className="grid gap-3 sm:grid-cols-5">
        {QUESTION_KEYS.map((k) => (
          <label key={k} className="text-xs">
            <span className="font-semibold">{DIM_LABEL[k]}</span>
            <div className="mt-1 flex items-center gap-2">
              <input type="range" min={0} max={100} step={5} value={weights[k]} onChange={(e) => onChange({ ...weights, [k]: Number(e.target.value) })} className="flex-1 accent-bronze-600" />
              <span className="num w-9 text-right">{weights[k]}%</span>
            </div>
          </label>
        ))}
      </div>
      <p className={`mt-2 text-xs ${sum === 100 ? 'text-green-ok' : 'text-red-warn'}`}>
        Total {sum}% {sum === 100 ? '— applied.' : '— weights must sum to 100%; the equal-weight ranking is shown until they do.'}
        <button type="button" className="ml-3 font-semibold text-bronze-700 underline" onClick={() => onChange(EQUAL_WEIGHTS)}>
          Reset to 20% each
        </button>
      </p>
    </div>
  );
}
