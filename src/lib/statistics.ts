/**
 * Collective decision statistics (see AGENTS.md §7).
 *  - Individual score = mean of the five answers (unrounded), or a weighted mean in advanced mode.
 *  - Collective score = mean of individual scores, only meaningful once all four have evaluated.
 *  - Consensus: median, min, max, population SD, range, Q1 enthusiasm counts.
 *  - Ranking: security eligible → ≤ €2,500 → no material budget uncertainty → complete → collective
 *    score desc → lowest individual score desc → mean Q1 desc → destination id asc.
 */
import { EXCEPTIONAL_MAX_EUR, PREFERRED_MAX_EUR } from './budget';
import type { SecurityStatus } from '../types/destination';

export const PARTICIPANT_IDS = ['paco', 'gaetan', 'alvarinn', 'victor'] as const;
export type ParticipantId = (typeof PARTICIPANT_IDS)[number];
export const QUESTION_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5'] as const;
export type QuestionKey = (typeof QUESTION_KEYS)[number];
export type Answers = Record<QuestionKey, number>;
export type Weights = Record<QuestionKey, number>;

export const EQUAL_WEIGHTS: Weights = { q1: 20, q2: 20, q3: 20, q4: 20, q5: 20 };
export const RESERVATION_THRESHOLD = 4;
export const ENTHUSIASM_THRESHOLD = 8;

export function weightsValid(w: Weights): boolean {
  const vals = QUESTION_KEYS.map((k) => w[k]);
  return vals.every((v) => Number.isFinite(v) && v >= 0) && Math.abs(vals.reduce((a, b) => a + b, 0) - 100) < 1e-9;
}

export function individualScore(a: Answers, weights: Weights = EQUAL_WEIGHTS): number {
  if (!weightsValid(weights)) throw new Error('Weights must be non-negative and sum to 100');
  return QUESTION_KEYS.reduce((sum, k) => sum + a[k] * weights[k], 0) / 100;
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
/** Population standard deviation (divides by n). */
export function populationSD(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const mu = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - mu) ** 2)));
}

export interface ScoreEntry {
  participantId: ParticipantId;
  answers: Answers;
}

export interface DestinationStats {
  destinationId: string;
  count: number;
  complete: boolean;
  individual: Partial<Record<ParticipantId, number>>;
  mean: number;
  median: number;
  min: number;
  max: number;
  sd: number;
  range: number;
  meanByQuestion: Record<QuestionKey, number>;
  q1High: number;
  q1Low: number;
  reservation: boolean;
}

export function computeStats(destinationId: string, entries: ScoreEntry[], weights: Weights = EQUAL_WEIGHTS): DestinationStats | null {
  if (entries.length === 0) return null;
  const individual: Partial<Record<ParticipantId, number>> = {};
  for (const e of entries) individual[e.participantId] = individualScore(e.answers, weights);
  const scores = Object.values(individual) as number[];
  const meanByQuestion = Object.fromEntries(
    QUESTION_KEYS.map((k) => [k, mean(entries.map((e) => e.answers[k]))]),
  ) as Record<QuestionKey, number>;
  const q1s = entries.map((e) => e.answers.q1);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  return {
    destinationId,
    count: entries.length,
    complete: new Set(entries.map((e) => e.participantId)).size === PARTICIPANT_IDS.length,
    individual,
    mean: mean(scores),
    median: median(scores),
    min,
    max,
    sd: populationSD(scores),
    range: max - min,
    meanByQuestion,
    q1High: q1s.filter((x) => x >= ENTHUSIASM_THRESHOLD).length,
    q1Low: q1s.filter((x) => x <= RESERVATION_THRESHOLD).length,
    reservation: q1s.some((x) => x <= RESERVATION_THRESHOLD),
  };
}

export interface RankingCandidate {
  id: string;
  securityStatus: SecurityStatus;
  totalRealistic: number;
  materialUncertainty: boolean;
  stats: DestinationStats | null;
}

export type Exclusion = 'security' | 'budget' | 'budget-uncertainty' | 'incomplete';

export interface RankedEntry {
  rank: number;
  candidate: RankingCandidate;
  stats: DestinationStats;
}

export interface RankingResult {
  ranked: RankedEntry[];
  excluded: { candidate: RankingCandidate; reason: Exclusion }[];
}

export function compareRanked(a: DestinationStats, b: DestinationStats, aId: string, bId: string): number {
  if (b.mean !== a.mean) return b.mean - a.mean;
  if (b.min !== a.min) return b.min - a.min;
  if (b.meanByQuestion.q1 !== a.meanByQuestion.q1) return b.meanByQuestion.q1 - a.meanByQuestion.q1;
  return aId < bId ? -1 : aId > bId ? 1 : 0;
}

/** First applicable exclusion reason, in the order of the ranking rules. */
export function exclusionReason(c: RankingCandidate): Exclusion | null {
  if (c.securityStatus !== 'eligible') return 'security';
  if (!(c.totalRealistic <= EXCEPTIONAL_MAX_EUR)) return 'budget';
  if (c.materialUncertainty) return 'budget-uncertainty';
  if (!c.stats || !c.stats.complete) return 'incomplete';
  return null;
}

export function rankDestinations(candidates: RankingCandidate[]): RankingResult {
  const eligible: { candidate: RankingCandidate; stats: DestinationStats }[] = [];
  const excluded: RankingResult['excluded'] = [];
  for (const c of candidates) {
    const reason = exclusionReason(c);
    if (reason) excluded.push({ candidate: c, reason });
    else eligible.push({ candidate: c, stats: c.stats! });
  }
  eligible.sort((x, y) => compareRanked(x.stats, y.stats, x.candidate.id, y.candidate.id));
  return {
    ranked: eligible.map((e, i) => ({ rank: i + 1, candidate: e.candidate, stats: e.stats })),
    excluded,
  };
}

export interface Shortlist {
  highestRated?: RankedEntry;
  highestBelowPreferred?: RankedEntry;
  strongestConsensus?: RankedEntry;
  mostPopular?: RankedEntry;
  bestCultural?: RankedEntry;
  bestGeographical?: RankedEntry;
  bestAdventure?: RankedEntry;
  bestPractical?: RankedEntry;
  bestAffordable?: RankedEntry;
}

function best(list: RankedEntry[], score: (e: RankedEntry) => number): RankedEntry | undefined {
  let top: RankedEntry | undefined;
  for (const e of list) {
    if (!top) top = e;
    else {
      const d = score(e) - score(top);
      if (d > 1e-12 || (Math.abs(d) <= 1e-12 && e.rank < top.rank)) top = e;
    }
  }
  return top;
}

export function buildShortlist(ranking: RankingResult): Shortlist {
  const r = ranking.ranked;
  return {
    highestRated: r[0],
    highestBelowPreferred: r.find((e) => e.candidate.totalRealistic <= PREFERRED_MAX_EUR),
    // Strongest consensus: smallest spread; ties broken by higher lowest score, then ranking.
    strongestConsensus: best(r, (e) => -e.stats.sd * 1000 + e.stats.min),
    mostPopular: best(r, (e) => e.stats.meanByQuestion.q1),
    bestCultural: best(r, (e) => e.stats.meanByQuestion.q2),
    bestGeographical: best(r, (e) => e.stats.meanByQuestion.q3),
    bestAdventure: best(r, (e) => e.stats.meanByQuestion.q4),
    bestPractical: best(r, (e) => e.stats.meanByQuestion.q5),
    bestAffordable: r.find((e) => e.candidate.totalRealistic < 1500),
  };
}

export interface ParticipantProfile {
  participantId: ParticipantId;
  count: number;
  meanByQuestion: Record<QuestionKey, number>;
  top: { destinationId: string; score: number }[];
}

export function participantProfile(participantId: ParticipantId, entries: { destinationId: string; answers: Answers }[]): ParticipantProfile {
  const meanByQuestion = Object.fromEntries(
    QUESTION_KEYS.map((k) => [k, mean(entries.map((e) => e.answers[k]))]),
  ) as Record<QuestionKey, number>;
  const top = entries
    .map((e) => ({ destinationId: e.destinationId, score: individualScore(e.answers) }))
    .sort((a, b) => b.score - a.score || (a.destinationId < b.destinationId ? -1 : 1))
    .slice(0, 3);
  return { participantId, count: entries.length, meanByQuestion, top };
}

export function formatScore(x: number | undefined | null, digits = 2): string {
  if (x === undefined || x === null || !Number.isFinite(x)) return '—';
  return x.toFixed(digits);
}
