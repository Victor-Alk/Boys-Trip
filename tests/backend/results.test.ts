import { describe, expect, it } from 'vitest';
import { createTestBackend, ans, PIDS, TEST_REGISTRY, type Answers, type Json, type Pid } from './helpers';

const TWO_DESTINATIONS = { D01: TEST_REGISTRY.D01, D05: TEST_REGISTRY.D05 };

function fill(b: ReturnType<typeof createTestBackend>, t: Record<Pid, string>, dest: string, who: readonly Pid[], score = 7, comments = '') {
  for (const p of who) expect(b.submit(t[p], dest, ans(score), { comments: comments || `${p} on ${dest}` }).ok).toBe(true);
}

/** Every score value that could leak, as JSON fragments. */
function containsScores(payload: unknown): boolean {
  const s = JSON.stringify(payload);
  return /"answers"|"individualScore"|"mean"|"median"|"min"|"max"|"sd"/.test(s);
}

describe('blind voting — results reveal policy', () => {
  it('per-destination-complete (default): nothing about other scores before 4/4, everything after', () => {
    const b = createTestBackend();
    const t = b.tokens();
    fill(b, t, 'D01', ['paco', 'gaetan', 'alvarinn'], 3);
    for (const p of PIDS) {
      const r = b.post('results', { token: t[p] });
      expect(r.data.policy).toBe('per-destination-complete');
      expect(r.data.blindVoting).toBe(true);
      expect(r.data.destinations.D01).toEqual({ count: 3, revealed: false, responses: [] });
      expect(containsScores(r.data)).toBe(false);
      expect(JSON.stringify(r.data)).not.toContain('paco on D01');
    }
    const completion = b.post('completion', { token: t.victor });
    expect(completion.data).toMatchObject({ totalActive: 3, perDestination: { D01: 3 }, fullyEvaluated: 0 });
    expect(containsScores(completion.data)).toBe(false);

    fill(b, t, 'D01', ['victor'], 9);
    fill(b, t, 'D05', ['paco']);
    const after = b.post('results', { token: t.paco }).data;
    expect(after.destinations.D01.revealed).toBe(true);
    expect(after.destinations.D01.count).toBe(4);
    expect(after.destinations.D01.responses.map((r: Json) => r.participantId)).toEqual(['paco', 'gaetan', 'alvarinn', 'victor']);
    expect(after.destinations.D01.responses[3]).toMatchObject({ participantName: 'Victor', answers: ans(9), individualScore: 9, comments: 'victor on D01' });
    // Another destination at 1/4 stays hidden.
    expect(after.destinations.D05).toEqual({ count: 1, revealed: false, responses: [] });
    expect(b.post('completion', { token: t.paco }).data.fullyEvaluated).toBe(1);
  });

  it('all-complete: nothing is revealed until every participant has evaluated every destination', () => {
    const b = createTestBackend({ registry: TWO_DESTINATIONS, properties: { RESULTS_REVEAL_POLICY: 'all-complete' } });
    const t = b.tokens();
    fill(b, t, 'D01', PIDS);
    fill(b, t, 'D05', ['paco', 'gaetan', 'alvarinn']);
    let r = b.post('results', { token: t.paco }).data;
    expect(r.policy).toBe('all-complete');
    expect(r.destinations.D01).toEqual({ count: 4, revealed: false, responses: [] });
    expect(containsScores(r)).toBe(false);
    fill(b, t, 'D05', ['victor']);
    r = b.post('results', { token: t.paco }).data;
    expect(r.destinations.D01.revealed && r.destinations.D05.revealed).toBe(true);
    expect(r.destinations.D05.responses).toHaveLength(4);
    expect(b.post('completion', { token: t.paco }).data).toMatchObject({ totalActive: 8, maxActive: 8, fullyEvaluated: 2 });
  });

  it('admin-only: never revealed through the API, even when complete', () => {
    const b = createTestBackend({ properties: { RESULTS_REVEAL_POLICY: 'admin-only' } });
    const t = b.tokens();
    fill(b, t, 'D01', PIDS);
    const r = b.post('results', { token: t.paco }).data;
    expect(r.destinations.D01).toEqual({ count: 4, revealed: false, responses: [] });
    expect(containsScores(r)).toBe(false);
    // …but the owner's spreadsheet Results tab has the statistics.
    expect(b.rows('Results').find((x) => x.destination_id === 'D01')!.mean_score).toBe(7);
  });

  it('always: scores are visible as soon as they exist', () => {
    const b = createTestBackend({ properties: { RESULTS_REVEAL_POLICY: 'always' } });
    const t = b.tokens();
    fill(b, t, 'D01', ['gaetan'], 6);
    const r = b.post('results', { token: t.paco }).data;
    expect(r).toMatchObject({ policy: 'always', blindVoting: false });
    expect(r.destinations.D01.revealed).toBe(true);
    expect(r.destinations.D01.responses).toEqual([
      expect.objectContaining({ participantId: 'gaetan', answers: ans(6), individualScore: 6, comments: 'gaetan on D01' }),
    ]);
  });

  it('BLIND_VOTING_ENABLED=false is equivalent to always', () => {
    const b = createTestBackend({ properties: { BLIND_VOTING_ENABLED: 'false', RESULTS_REVEAL_POLICY: 'per-destination-complete' } });
    const t = b.tokens();
    fill(b, t, 'D01', ['gaetan'], 6);
    expect(b.post('config').data).toMatchObject({ blindVoting: false, revealPolicy: 'always' });
    const r = b.post('results', { token: t.paco }).data;
    expect(r.policy).toBe('always');
    expect(r.destinations.D01.responses).toHaveLength(1);
  });

  it('an unrecognised policy falls back to the default (never to always)', () => {
    const b = createTestBackend({ properties: { RESULTS_REVEAL_POLICY: 'everyone-sees-everything' } });
    const t = b.tokens();
    fill(b, t, 'D01', ['gaetan']);
    expect(b.post('results', { token: t.paco }).data.destinations.D01.revealed).toBe(false);
    expect(b.emu.call('checkConfiguration').warnings.join(' ')).toContain('RESULTS_REVEAL_POLICY');
  });

  it('COMMENTS_VISIBILITY=author-only: other participants’ comments are null, own comments kept', () => {
    const b = createTestBackend({ properties: { COMMENTS_VISIBILITY: 'author-only' } });
    const t = b.tokens();
    fill(b, t, 'D01', PIDS);
    const r = b.post('results', { token: t.alvarinn }).data;
    expect(r.destinations.D01.revealed).toBe(true);
    for (const resp of r.destinations.D01.responses) {
      if (resp.participantId === 'alvarinn') expect(resp.comments).toBe('alvarinn on D01');
      else expect(resp.comments).toBeNull();
    }
    expect(JSON.stringify(r)).not.toContain('paco on D01');
  });

  it('myResponses returns only the caller’s own active responses', () => {
    const b = createTestBackend();
    const t = b.tokens();
    fill(b, t, 'D01', PIDS);
    fill(b, t, 'D05', ['gaetan']);
    const mine = b.post('myResponses', { token: t.gaetan }).data.responses;
    expect(mine.map((r: Json) => `${r.participantId}:${r.destinationId}`)).toEqual(['gaetan:D01', 'gaetan:D05']);
    expect(b.post('me', { token: t.gaetan }).data.completedCount).toBe(2);
  });
});

describe('statistics', () => {
  const stats = (b: ReturnType<typeof createTestBackend>, answersByPid: Partial<Record<Pid, Answers>>) => {
    const responses = Object.entries(answersByPid).map(([participantId, answers]) => ({ participantId, answers, updatedAt: '2027-01-01T00:00:00.000Z' }));
    return b.emu.call('computeDestinationStats_', 'D01', TEST_REGISTRY.D01, responses);
  };

  it('8, 8, 8, 8 → mean 8, median 8, min 8, max 8, population SD 0', () => {
    const b = createTestBackend();
    const s = stats(b, { paco: ans(8), gaetan: ans(8), alvarinn: ans(8), victor: ans(8) });
    expect(s).toMatchObject({ count: 4, complete: true, mean: 8, median: 8, min: 8, max: 8, sd: 0, reservations: 0, eligible: true });
  });

  it('10, 10, 10, 2 → mean 8, min 2, population SD ≈ 3.4641', () => {
    const b = createTestBackend();
    const s = stats(b, { paco: ans(10), gaetan: ans(10), alvarinn: ans(10), victor: ans(2) });
    expect(s.mean).toBe(8);
    expect(s.median).toBe(10);
    expect(s.min).toBe(2);
    expect(s.max).toBe(10);
    expect(s.sd).toBeCloseTo(Math.sqrt(12), 10);
    expect(s.sd).toBeCloseTo(3.4641, 4);
    expect(s.reservations).toBe(1);
  });

  it('counts reservations from Q1 answers, not from averages', () => {
    const b = createTestBackend();
    const s = stats(b, {
      paco: { q1: 4, q2: 10, q3: 10, q4: 10, q5: 10 }, // individual 8.8, but Q1 = 4 → reservation
      gaetan: { q1: 5, q2: 1, q3: 1, q4: 1, q5: 1 }, // individual 1.8, Q1 = 5 → not a reservation
      alvarinn: ans(9),
      victor: { q1: 1, q2: 9, q3: 9, q4: 9, q5: 9 },
    });
    expect(s.reservations).toBe(2);
    expect(s.meanByQuestion.q1).toBeCloseTo(4.75, 12);
    expect(s.individual.paco).toBeCloseTo(8.8, 12);
    expect(s.individual.gaetan).toBeCloseTo(1.8, 12);
  });

  it('keeps individual scores unrounded', () => {
    const b = createTestBackend();
    const s = stats(b, { paco: { q1: 7, q2: 8, q3: 8, q4: 8, q5: 8 }, gaetan: { q1: 1, q2: 2, q3: 2, q4: 2, q5: 2 } });
    expect(s.individual.paco).toBeCloseTo(7.8, 12);
    expect(s.individual.gaetan).toBeCloseTo(1.8, 12);
    expect(s.mean).toBeCloseTo(4.8, 12);
    expect(s.complete).toBe(false);
  });
});

describe('ranking eligibility', () => {
  function completeAll(b: ReturnType<typeof createTestBackend>, scores: Record<string, number>) {
    const t = b.tokens();
    for (const [dest, score] of Object.entries(scores)) fill(b, t, dest, PIDS, score);
    return Object.fromEntries(b.rows('Results').map((r) => [r.destination_id as string, r]));
  }

  it('excluded security, > €2,500, material uncertainty, conditional, pending and incomplete are never eligible', () => {
    const b = createTestBackend();
    const results = completeAll(b, { D01: 6, D02: 10, D03: 10, D04: 10, D05: 5, D06: 10, D07: 10 });
    expect(results.D02).toMatchObject({ security_status: 'excluded', ranking_eligible: 'no', ranking_position: '' });
    expect(String(results.D02.exclusion_reasons)).toContain('security excluded');
    expect(results.D03).toMatchObject({ realistic_total_eur: 2600, ranking_eligible: 'no', ranking_position: '' });
    expect(String(results.D03.exclusion_reasons)).toContain('over €2500');
    expect(results.D04).toMatchObject({ material_budget_uncertainty: 'yes', ranking_eligible: 'no' });
    expect(results.D06).toMatchObject({ security_status: 'conditional', ranking_eligible: 'no' });
    expect(results.D07).toMatchObject({ security_status: 'pending', budget_status: 'pending', ranking_eligible: 'no' });
    // Exactly €2,500 is allowed (≤ €2,500).
    expect(results.D05).toMatchObject({ realistic_total_eur: 2500, ranking_eligible: 'yes', ranking_position: 2 });
    expect(results.D01).toMatchObject({ ranking_eligible: 'yes', ranking_position: 1, mean_score: 6 });
    expect(results.D02.mean_score).toBe(10); // perfect scores do not override the exclusion
  });

  it('an incomplete destination is not eligible however high its scores', () => {
    const b = createTestBackend();
    const t = b.tokens();
    fill(b, t, 'D01', ['paco', 'gaetan', 'alvarinn'], 10);
    const row = b.rows('Results').find((r) => r.destination_id === 'D01')!;
    expect(row).toMatchObject({ active_responses: 3, ranking_eligible: 'no', ranking_position: '' });
    expect(String(row.exclusion_reasons)).toContain('incomplete (3/4)');
  });

  it('orders by collective score, then lowest individual score, then mean Q1, then id', () => {
    const b = createTestBackend({
      registry: {
        D01: TEST_REGISTRY.D01,
        D05: TEST_REGISTRY.D05,
        D08: { ...TEST_REGISTRY.D01, name: 'Hotel' },
        D09: { ...TEST_REGISTRY.D01, name: 'India' },
      },
    });
    const t = b.tokens();
    const put = (dest: string, byPid: Record<Pid, Answers>) => { for (const p of PIDS) b.submit(t[p], dest, byPid[p]); };
    // D01 and D05: same mean 7; D05 has the higher minimum → D05 first.
    put('D01', { paco: ans(10), gaetan: ans(10), alvarinn: ans(4), victor: ans(4) });
    put('D05', { paco: ans(8), gaetan: ans(8), alvarinn: ans(6), victor: ans(6) });
    // D08 and D09: same mean 7 and same minimum 6; D09 has the higher mean Q1 → D09 before D08.
    put('D08', { paco: { q1: 6, q2: 8, q3: 8, q4: 8, q5: 8 }, gaetan: ans(6), alvarinn: ans(8), victor: ans(6) });
    put('D09', { paco: { q1: 10, q2: 7, q3: 7, q4: 7, q5: 7 }, gaetan: ans(6), alvarinn: { q1: 8, q2: 8, q3: 8, q4: 8, q5: 8 }, victor: { q1: 6, q2: 6, q3: 6, q4: 6, q5: 6 } });
    const rows = Object.fromEntries(b.rows('Results').map((r) => [r.destination_id as string, r]));
    // Means: D08 = (7.6 + 6 + 8 + 6)/4 = 6.9 ; D09 = (7.6 + 6 + 8 + 6)/4 = 6.9
    expect(rows.D08.mean_score).toBeCloseTo(6.9, 12);
    expect(rows.D09.mean_score).toBeCloseTo(6.9, 12);
    expect(rows.D05.ranking_position).toBe(1);
    expect(rows.D01.ranking_position).toBe(2);
    expect(rows.D09.ranking_position).toBe(3);
    expect(rows.D08.ranking_position).toBe(4);
  });

  it('writes per-participant scores, mean Q1–Q5 and reservations to the Results tab', () => {
    const b = createTestBackend();
    const t = b.tokens();
    b.submit(t.paco, 'D01', ans(10));
    b.submit(t.gaetan, 'D01', ans(10));
    b.submit(t.alvarinn, 'D01', ans(10));
    b.submit(t.victor, 'D01', { q1: 2, q2: 2, q3: 2, q4: 2, q5: 2 });
    const row = b.rows('Results').find((r) => r.destination_id === 'D01')!;
    expect(row).toMatchObject({
      destination_name: 'Alpha', security_status: 'eligible', budget_status: 'within-preferred', realistic_total_eur: 1800,
      active_responses: 4, score_paco: 10, score_gaetan: 10, score_alvarinn: 10, score_victor: 2,
      mean_score: 8, median_score: 10, min_score: 2, max_score: 10, mean_q1: 8, mean_q5: 8,
      significant_reservations: 1, ranking_eligible: 'yes', ranking_position: 1,
    });
    expect(row.pop_std_dev as number).toBeCloseTo(3.4641, 4);
    expect(row.last_updated).toBe('2027-01-15T10:00:00.000Z');
  });
});

describe('novelty', () => {
  it('returns NOVELTY_DATA to authenticated users only, filtered to known destinations', () => {
    const novelty = {
      D01: { newToAll: false, visitedCount: 1, visitedBy: ['victor', 'mallory'], note: 'Victor went in 2019' },
      D99: { newToAll: true, visitedCount: 0, visitedBy: [], note: 'unknown id' },
    };
    const b = createTestBackend({ properties: { NOVELTY_DATA: JSON.stringify(novelty) } });
    expect(b.post('novelty').error.code).toBe('UNAUTHENTICATED');
    const r = b.post('novelty', { token: b.login('paco') });
    expect(r.data.destinations).toEqual({ D01: { newToAll: false, visitedCount: 1, visitedBy: ['victor'], note: 'Victor went in 2019' } });
  });

  it('returns an empty map when NOVELTY_DATA is unset or invalid', () => {
    const b = createTestBackend();
    expect(b.post('novelty', { token: b.login('paco') }).data).toEqual({ destinations: {} });
    const bad = createTestBackend({ properties: { NOVELTY_DATA: '{not json' } });
    expect(bad.post('novelty', { token: bad.login('paco') }).data).toEqual({ destinations: {} });
  });
});
