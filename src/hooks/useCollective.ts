import { useMemo } from 'react';
import { useEvaluations } from '../state/evaluations';
import { summaries } from '../lib/data';
import { computeStats, rankDestinations, EQUAL_WEIGHTS, type DestinationStats, type RankingCandidate, type Weights, type ScoreEntry } from '../lib/statistics';

/**
 * Collective statistics derived ONLY from responses the backend has revealed to this participant.
 * Unrevealed destinations expose nothing but their completion count.
 */
export function useCollective(weights: Weights = EQUAL_WEIGHTS) {
  const { results, completion } = useEvaluations();
  return useMemo(() => {
    const stats = new Map<string, DestinationStats | null>();
    const entries = new Map<string, ScoreEntry[]>();
    for (const s of summaries) {
      const r = results?.destinations[s.id];
      if (r?.revealed && r.responses.length > 0) {
        const e = r.responses.map((x) => ({ participantId: x.participantId, answers: x.answers }));
        entries.set(s.id, e);
        stats.set(s.id, computeStats(s.id, e, weights));
      } else stats.set(s.id, null);
    }
    const candidates: RankingCandidate[] = summaries.map((s) => ({
      id: s.id,
      securityStatus: s.securityStatus,
      totalRealistic: s.totalRealistic,
      materialUncertainty: s.materialUncertainty,
      stats: stats.get(s.id) ?? null,
    }));
    const ranking = rankDestinations(candidates);
    const count = (id: string) => completion?.perDestination[id] ?? results?.destinations[id]?.count ?? null;
    const revealed = (id: string) => !!results?.destinations[id]?.revealed;
    return { stats, entries, ranking, candidates, count, revealed, hasResults: !!results };
  }, [results, completion, weights]);
}
