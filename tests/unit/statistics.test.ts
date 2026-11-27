import { describe, expect, it } from 'vitest';
import {
  computeStats,
  individualScore,
  rankDestinations,
  buildShortlist,
  populationSD,
  median,
  EQUAL_WEIGHTS,
  type Answers,
  type ParticipantId,
  type RankingCandidate,
  type ScoreEntry,
} from '../../src/lib/statistics';

const uniform = (v: number): Answers => ({ q1: v, q2: v, q3: v, q4: v, q5: v });
const entries = (scores: Record<ParticipantId, number | Answers>): ScoreEntry[] =>
  (Object.entries(scores) as [ParticipantId, number | Answers][]).map(([p, s]) => ({
    participantId: p,
    answers: typeof s === 'number' ? uniform(s) : s,
  }));

describe('individual score', () => {
  it('is the unrounded mean of the five answers', () => {
    expect(individualScore({ q1: 7, q2: 8, q3: 9, q4: 6, q5: 5 })).toBe(7);
    expect(individualScore({ q1: 7, q2: 8, q3: 9, q4: 6, q5: 6 })).toBeCloseTo(7.2, 10);
    expect(individualScore({ q1: 1, q2: 2, q3: 2, q4: 2, q5: 2 })).toBeCloseTo(1.8, 10);
  });
  it('supports weights that sum to 100 and rejects others', () => {
    expect(individualScore({ q1: 10, q2: 0, q3: 0, q4: 0, q5: 0 }, { q1: 100, q2: 0, q3: 0, q4: 0, q5: 0 })).toBe(10);
    expect(() => individualScore(uniform(5), { ...EQUAL_WEIGHTS, q1: 30 })).toThrow();
  });
});

describe('consensus statistics (brief §24.5)', () => {
  it('Example 1: 8, 8, 8, 8 → mean 8, min 8, SD 0', () => {
    const s = computeStats('D01', entries({ paco: 8, gaetan: 8, alvarinn: 8, victor: 8 }))!;
    expect(s.mean).toBe(8);
    expect(s.min).toBe(8);
    expect(s.sd).toBe(0);
    expect(s.complete).toBe(true);
    expect(s.reservation).toBe(false);
  });
  it('Example 2: 10, 10, 10, 2 → mean 8, min 2, SD ≈ 3.4641', () => {
    const s = computeStats('D02', entries({ paco: 10, gaetan: 10, alvarinn: 10, victor: 2 }))!;
    expect(s.mean).toBe(8);
    expect(s.min).toBe(2);
    expect(s.sd).toBeCloseTo(3.4641, 4);
    expect(s.range).toBe(8);
    expect(s.median).toBe(10);
    expect(s.reservation).toBe(true);
    expect(s.q1Low).toBe(1);
    expect(s.q1High).toBe(3);
  });
  it('reservations come from Q1, not from individual averages', () => {
    const lowQ1HighAverage: Answers = { q1: 4, q2: 10, q3: 10, q4: 10, q5: 10 }; // average 8.8
    const s = computeStats('D03', entries({ paco: lowQ1HighAverage, gaetan: 8, alvarinn: 8, victor: 8 }))!;
    expect(s.individual.paco).toBeCloseTo(8.8, 10);
    expect(s.reservation).toBe(true);
    const highQ1LowAverage: Answers = { q1: 5, q2: 1, q3: 1, q4: 1, q5: 1 }; // average 1.8
    const t = computeStats('D04', entries({ paco: highQ1LowAverage, gaetan: 8, alvarinn: 8, victor: 8 }))!;
    expect(t.reservation).toBe(false);
  });
  it('incomplete evaluations are flagged and missing votes are not zeros', () => {
    const s = computeStats('D05', entries({ paco: 9, gaetan: 7 } as Record<ParticipantId, number>))!;
    expect(s.complete).toBe(false);
    expect(s.count).toBe(2);
    expect(s.mean).toBe(8);
  });
  it('helpers', () => {
    expect(median([1, 3, 2, 4])).toBe(2.5);
    expect(populationSD([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
  });
});

describe('ranking rules (brief §16.4)', () => {
  const full = (id: string, v: number) => computeStats(id, entries({ paco: v, gaetan: v, alvarinn: v, victor: v }));
  const cand = (id: string, over: Partial<RankingCandidate>): RankingCandidate => ({
    id,
    securityStatus: 'eligible',
    totalRealistic: 1500,
    materialUncertainty: false,
    stats: full(id, 7),
    ...over,
  });

  it('an excluded destination with a perfect score never leads the eligible ranking', () => {
    const r = rankDestinations([cand('D02', { securityStatus: 'excluded', stats: full('D02', 10) }), cand('D01', {})]);
    expect(r.ranked[0].candidate.id).toBe('D01');
    expect(r.excluded.find((e) => e.candidate.id === 'D02')?.reason).toBe('security');
  });
  it('conditional destinations are excluded too', () => {
    const r = rankDestinations([cand('D05', { securityStatus: 'conditional', stats: full('D05', 10) })]);
    expect(r.ranked).toHaveLength(0);
  });
  it('a destination above €2,500 never leads, even at 10/10', () => {
    const r = rankDestinations([cand('D20', { totalRealistic: 2600, stats: full('D20', 10) }), cand('D10', {})]);
    expect(r.ranked.map((e) => e.candidate.id)).toEqual(['D10']);
    expect(r.excluded[0].reason).toBe('budget');
  });
  it('€2,000–2,500 stays eligible (exceptional expenditure)', () => {
    const r = rankDestinations([cand('D14', { totalRealistic: 2400 })]);
    expect(r.ranked).toHaveLength(1);
  });
  it('material budget uncertainty and incomplete evaluations are excluded', () => {
    const partial = computeStats('D11', entries({ paco: 10 } as Record<ParticipantId, number>));
    const r = rankDestinations([cand('D09', { materialUncertainty: true }), cand('D11', { stats: partial }), cand('D12', { stats: null })]);
    expect(r.ranked).toHaveLength(0);
    expect(r.excluded.map((e) => e.reason)).toEqual(['budget-uncertainty', 'incomplete', 'incomplete']);
  });
  it('tie-breakers: lowest score, then mean Q1, then id', () => {
    const a = computeStats('D03', entries({ paco: 9, gaetan: 9, alvarinn: 7, victor: 7 })); // mean 8, min 7
    const b = computeStats('D01', entries({ paco: 8, gaetan: 8, alvarinn: 8, victor: 8 })); // mean 8, min 8
    const r1 = rankDestinations([cand('D03', { stats: a }), cand('D01', { stats: b })]);
    expect(r1.ranked.map((e) => e.candidate.id)).toEqual(['D01', 'D03']);

    const q1hi: Answers = { q1: 10, q2: 8, q3: 8, q4: 7, q5: 7 }; // 8
    const q1lo: Answers = { q1: 6, q2: 9, q3: 9, q4: 8, q5: 8 }; // 8
    const c = computeStats('D07', entries({ paco: q1lo, gaetan: q1lo, alvarinn: q1lo, victor: q1lo }));
    const d = computeStats('D08', entries({ paco: q1hi, gaetan: q1hi, alvarinn: q1hi, victor: q1hi }));
    const r2 = rankDestinations([cand('D07', { stats: c }), cand('D08', { stats: d })]);
    expect(r2.ranked.map((e) => e.candidate.id)).toEqual(['D08', 'D07']);

    const r3 = rankDestinations([cand('D09', { stats: full('D09', 6) }), cand('D06', { stats: full('D06', 6) })]);
    expect(r3.ranked.map((e) => e.candidate.id)).toEqual(['D06', 'D09']);
  });
  it('shortlist distinguishes popularity from consensus', () => {
    const popular = computeStats('D01', entries({ paco: 10, gaetan: 10, alvarinn: 10, victor: 3 }))!; // 8.25
    const consensual = computeStats('D10', entries({ paco: 8, gaetan: 8, alvarinn: 8, victor: 8 }))!;
    const r = rankDestinations([cand('D01', { stats: popular, totalRealistic: 2200 }), cand('D10', { stats: consensual, totalRealistic: 1200 })]);
    const s = buildShortlist(r);
    expect(s.highestRated?.candidate.id).toBe('D01');
    expect(s.strongestConsensus?.candidate.id).toBe('D10');
    expect(s.highestBelowPreferred?.candidate.id).toBe('D10');
    expect(s.bestAffordable?.candidate.id).toBe('D10');
  });
});
