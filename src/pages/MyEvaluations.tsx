import { useMemo, useState } from 'react';
import { useSession } from '../state/session';
import { useEvaluations } from '../state/evaluations';
import { summaries, summaryById, questionnaire } from '../lib/data';
import { navigate } from '../lib/router';
import { formatEUR } from '../lib/budget';
import { individualScore, QUESTION_KEYS, formatScore, type QuestionKey } from '../lib/statistics';
import { SecurityBadge, BudgetBadge } from '../components/ui/Badges';
import type { EvaluationRecord } from '../lib/api';

type SortKey = 'score-desc' | 'score-asc' | QuestionKey | 'budget' | 'security';
const SORTS: [SortKey, string][] = [
  ['score-desc', 'Highest individual score'],
  ['score-asc', 'Lowest individual score'],
  ['q1', 'Overall enthusiasm'],
  ['q2', 'Cultural appeal'],
  ['q3', 'Geographical appeal'],
  ['q4', 'Adventure appeal'],
  ['q5', 'Practical suitability'],
  ['budget', 'Budget (cheapest first)'],
  ['security', 'Security eligibility'],
];
const SEC = { eligible: 0, conditional: 1, excluded: 2 } as const;

export default function MyEvaluationsPage() {
  const { session, openSignIn } = useSession();
  const { responses, drafts, pending, loading, loadError, refresh } = useEvaluations();
  const [sort, setSort] = useState<SortKey>('score-desc');

  const evaluated = useMemo(() => {
    const list = [...responses.values()].filter((r) => summaryById.has(r.destinationId as never));
    const key = (r: EvaluationRecord): number => {
      const s = summaryById.get(r.destinationId as never)!;
      if (sort === 'score-desc') return -individualScore(r.answers);
      if (sort === 'score-asc') return individualScore(r.answers);
      if (sort === 'budget') return s.totalRealistic;
      if (sort === 'security') return SEC[s.securityStatus];
      return -r.answers[sort];
    };
    return list.sort((a, b) => key(a) - key(b) || a.destinationId.localeCompare(b.destinationId));
  }, [responses, sort]);
  const remaining = summaries.filter((s) => !responses.has(s.id));
  const nextUp = remaining.find((s) => s.securityStatus === 'eligible') ?? remaining[0];

  if (!session) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="eyebrow text-bronze-600">My evaluations</p>
        <h1 className="mt-2 text-4xl font-semibold">Your private evaluation notebook</h1>
        <p className="mx-auto mt-3 max-w-lg text-slate-600">Sign in with your personal access code to see your scores, comments, revision dates and what is left to evaluate.</p>
        <button type="button" className="btn-primary mt-6" onClick={openSignIn}>
          Sign in
        </button>
      </main>
    );
  }

  const done = responses.size;
  const total = summaries.length;
  const ranking = [...responses.values()].sort((a, b) => individualScore(b.answers) - individualScore(a.answers) || a.destinationId.localeCompare(b.destinationId));
  const rankOf = new Map(ranking.map((r, i) => [r.destinationId, i + 1]));

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-10 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow text-bronze-600">My evaluations</p>
          <h1 className="mt-1 text-4xl font-semibold">{session.participant.name}’s notebook</h1>
          <p className="mt-2 text-slate-600">
            <span className="num font-semibold text-slate-ink">{done}</span> of {total} destinations evaluated · <span className="num">{Math.round((done / total) * 100)}%</span>
          </p>
          <div className="mt-2 h-1.5 w-72 max-w-full overflow-hidden rounded-full bg-sand-200">
            <div className="h-full bg-bronze-600" style={{ width: `${(done / total) * 100}%` }} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-ghost text-xs" onClick={() => void refresh()} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh from server'}
          </button>
          {nextUp && (
            <button type="button" className="btn-bronze px-5 py-2.5" onClick={() => navigate({ page: 'explore', destinationId: nextUp.id })}>
              Continue evaluating — {nextUp.country} →
            </button>
          )}
        </div>
      </div>
      {loadError && <p className="mt-4 text-sm text-red-warn">Could not load your evaluations: {loadError}</p>}

      {(Object.keys(pending).length > 0 || Object.keys(drafts).length > 0) && (
        <section className="mt-8 rounded-sm border border-amber-warn/30 bg-amber-bg/50 p-4">
          <h2 className="text-sm font-semibold text-amber-warn">Not yet saved on the server</h2>
          <ul className="mt-2 space-y-1 text-sm">
            {[...new Set([...Object.keys(pending), ...Object.keys(drafts)])].map((id) => (
              <li key={id} className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{summaryById.get(id as never)?.country ?? id}</span>
                <span className="text-xs text-slate-600">{pending[id] ? `pending — ${pending[id].lastError ?? 'awaiting confirmation'}` : 'local draft on this device'}</span>
                <button type="button" className="text-xs font-semibold text-bronze-700 underline" onClick={() => navigate({ page: 'explore', destinationId: id, evaluate: true })}>
                  Open and save
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-2xl font-semibold">Evaluated ({done})</h2>
          <label className="flex items-center gap-2 text-xs">
            <span className="font-semibold">Sort by</span>
            <select className="input w-auto px-2 py-1" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORTS.map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        {done === 0 ? (
          <p className="mt-4 text-slate-600">No evaluations yet. Open a destination on the globe and press “Evaluate this expedition”.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-sm border border-slate-ink/12 bg-paper">
            <table className="w-full min-w-[62rem] text-sm">
              <thead className="border-b border-slate-ink/15 bg-sand-100/60 text-left text-[0.68rem] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2">My rank</th>
                  <th className="px-2 py-2">Destination</th>
                  <th className="px-2 py-2">Score</th>
                  {questionnaire.questions.map((q) => (
                    <th key={q.id} className="px-2 py-2 text-center" title={q.text}>
                      {q.label.replace(' appeal', '').replace('Overall ', '')}
                    </th>
                  ))}
                  <th className="px-2 py-2">Budget</th>
                  <th className="px-2 py-2">Security</th>
                  <th className="px-2 py-2">Evaluated</th>
                  <th className="px-2 py-2">Last revision</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {evaluated.map((r) => {
                  const s = summaryById.get(r.destinationId as never)!;
                  return (
                    <tr key={r.destinationId} className="border-b border-slate-ink/8 align-top">
                      <td className="num px-3 py-2.5 font-display text-lg font-semibold text-bronze-600">{rankOf.get(r.destinationId)}</td>
                      <td className="px-2 py-2.5">
                        <button type="button" className="text-left font-semibold hover:text-bronze-700" onClick={() => navigate({ page: 'explore', destinationId: r.destinationId })}>
                          {s.country}
                        </button>
                        <span className="block text-xs text-slate-500">{s.title.split('—').pop()?.trim()}</span>
                        {r.comments && <p className="mt-1 max-w-xs text-xs italic text-slate-600">“{r.comments}”</p>}
                      </td>
                      <td className="num px-2 py-2.5 font-display text-lg font-semibold">{formatScore(individualScore(r.answers))}</td>
                      {QUESTION_KEYS.map((k) => (
                        <td key={k} className="num px-2 py-2.5 text-center">
                          {r.answers[k]}
                        </td>
                      ))}
                      <td className="px-2 py-2.5">
                        <span className="num block text-xs font-semibold">{formatEUR(s.totalRealistic)}</span>
                        <BudgetBadge status={s.budgetStatus} />
                      </td>
                      <td className="px-2 py-2.5">
                        <SecurityBadge status={s.securityStatus} />
                      </td>
                      <td className="num px-2 py-2.5 text-xs">{new Date(r.createdAt).toLocaleDateString('en-GB')}</td>
                      <td className="num px-2 py-2.5 text-xs">
                        {new Date(r.updatedAt).toLocaleDateString('en-GB')}
                        <span className="block text-slate-500">rev. {r.revisionNumber}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <button type="button" className="text-xs font-semibold text-bronze-700 hover:underline" onClick={() => navigate({ page: 'explore', destinationId: r.destinationId, evaluate: true })}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Remaining ({remaining.length})</h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {remaining.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => navigate({ page: 'explore', destinationId: s.id })} className="flex w-full items-start justify-between gap-2 rounded-sm border border-slate-ink/12 bg-paper p-3 text-left hover:border-bronze-600">
                <span>
                  <span className="num text-xs text-bronze-600">{s.id.slice(1)}</span> <span className="font-semibold">{s.country}</span>
                  <span className="block text-xs text-slate-500">{s.title.split('—').pop()?.trim()}</span>
                </span>
                <SecurityBadge status={s.securityStatus} />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
