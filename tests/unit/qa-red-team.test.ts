import { join } from 'node:path';
import { readdirSync } from 'node:fs';
/**
 * A24 independent red-team checks (unit level).
 *
 *  1. Blind voting: every API action, through the DEMO CLIENT (the same .gs sources the browser runs), under every
 *     reveal policy — no unrevealed score, partial aggregate or comment may appear in any payload.
 *  2. Statistics: the backend (Results.gs, run in the emulator) and the frontend (src/lib/statistics.ts) compute the
 *     same numbers from the same evaluations.
 *  3. Known defects, reproduced. They are skipped by default (fixes belong to other agents); run them with
 *     `QA_RUN_FIXME=1 npx vitest run tests/unit/qa-red-team.test.ts` to see them fail.
 */
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createDemoClient, DEMO_ACCESS_CODES, type ApiClient, type Session } from '../../src/lib/api';
import type { EmulatorState, EmulatorStorage } from '../../backend/emulator/index.js';
import { createAppsScriptEmulator } from '../../backend/emulator/index.js';
import { loadBackendSources } from '../../backend/emulator/node.js';
import { buildIndex } from '../../vite-plugins/destinations';
import {
  computeStats,
  rankDestinations,
  PARTICIPANT_IDS,
  type Answers,
  type ParticipantId,
  type RankingCandidate,
} from '../../src/lib/statistics';

const a = (q1: number, q2 = q1, q3 = q1, q4 = q1, q5 = q1): Answers => ({ q1, q2, q3, q4, q5 });
const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/* ------------------------------------------------------------------------------------------------------------ */
/* 1. Blind voting through the demo client                                                                       */
/* ------------------------------------------------------------------------------------------------------------ */

function seededStorage(properties: Record<string, string>): EmulatorStorage {
  let state: EmulatorState | null = { version: 1, properties: { ...properties }, userProperties: {}, cache: {}, spreadsheets: {} };
  return { load: () => (state ? JSON.parse(JSON.stringify(state)) : null), save: (s) => { state = JSON.parse(JSON.stringify(s)); } };
}

const POLICIES: { name: string; props: Record<string, string>; d08Revealed: boolean; othersCommentsVisible: boolean }[] = [
  { name: 'default (per-destination-complete, after-reveal)', props: {}, d08Revealed: false, othersCommentsVisible: false },
  { name: 'all-complete', props: { RESULTS_REVEAL_POLICY: 'all-complete' }, d08Revealed: false, othersCommentsVisible: false },
  { name: 'admin-only', props: { RESULTS_REVEAL_POLICY: 'admin-only' }, d08Revealed: false, othersCommentsVisible: false },
  { name: 'unrecognised policy value', props: { RESULTS_REVEAL_POLICY: 'everyone-now' }, d08Revealed: false, othersCommentsVisible: false },
  { name: 'always + after-reveal', props: { RESULTS_REVEAL_POLICY: 'always' }, d08Revealed: true, othersCommentsVisible: true },
  { name: 'always + author-only', props: { RESULTS_REVEAL_POLICY: 'always', COMMENTS_VISIBILITY: 'author-only' }, d08Revealed: true, othersCommentsVisible: false },
  { name: 'always + unrecognised comments value', props: { RESULTS_REVEAL_POLICY: 'always', COMMENTS_VISIBILITY: 'public' }, d08Revealed: true, othersCommentsVisible: false },
  { name: 'BLIND_VOTING_ENABLED=false', props: { BLIND_VOTING_ENABLED: 'false' }, d08Revealed: true, othersCommentsVisible: true },
];

/** Every action a signed-in participant can call (submit included). */
async function everything(client: ApiClient, s: Session) {
  const cfg = await client.config();
  return {
    health: await client.health(),
    config: cfg,
    me: await client.me(s.token),
    myResponses: await client.myResponses(s.token),
    completion: await client.completion(s.token),
    results: await client.results(s.token),
    novelty: await client.novelty(s.token),
    submit: await client.submit(s.token, { destinationId: 'D10', answers: a(5), comments: `own-${s.participant.id}`, questionnaireVersion: cfg.questionnaireVersion, destinationVersion: '1.0.0' }, randomUUID()),
  };
}

describe('A24 blind voting — no unrevealed data in ANY action, under EVERY policy (demo client)', () => {
  for (const p of POLICIES) {
    it(p.name, async () => {
      const client = createDemoClient({ storage: seededStorage(p.props), latencyMs: 0 });
      const sessions = {} as Record<ParticipantId, Session>;
      for (const pid of PARTICIPANT_IDS) sessions[pid] = await client.login(pid, DEMO_ACCESS_CODES[pid]);
      const cfg = await client.config();
      const submit = (pid: ParticipantId, dest: string, ans: Answers, comments: string) =>
        client.submit(sessions[pid].token, { destinationId: dest, answers: ans, comments, questionnaireVersion: cfg.questionnaireVersion, destinationVersion: '1.0.0' }, randomUUID());
      // D08: three of four. Distinctive answers so any leaked number is recognisable.
      await submit('paco', 'D08', a(3, 9, 2, 10, 1), 'SECRET-paco-D08');
      await submit('gaetan', 'D08', a(10, 1, 9, 2, 8), 'SECRET-gaetan-D08');
      await submit('alvarinn', 'D08', a(1, 1, 10, 10, 4), 'SECRET-alvarinn-D08');
      // A revision must not leak either (History is never served).
      await submit('paco', 'D08', a(3, 9, 2, 10, 2), 'SECRET-paco-D08-v2');

      for (const viewer of PARTICIPANT_IDS) {
        const out = await everything(client, sessions[viewer]);
        const json = JSON.stringify(out);
        const others = PARTICIPANT_IDS.filter((x) => x !== viewer);
        // No other participant's comment, ever — unless revealed AND comments are visible after reveal.
        for (const o of others) {
          const leaked = json.includes(`SECRET-${o}-D08`);
          expect(leaked, `${p.name}: ${viewer} sees ${o}'s comment`).toBe(p.d08Revealed && p.othersCommentsVisible && o !== 'victor');
        }
        // The superseded comment is never served to anyone (History stays in the spreadsheet).
        expect(json.includes('SECRET-paco-D08"'), `${p.name}: archived revision visible to ${viewer}`).toBe(false);
        // Results: unrevealed → no responses at all, only a count.
        const d08 = out.results.destinations.D08;
        expect(d08.count).toBe(3);
        expect(d08.revealed, `${p.name}: D08 revealed flag`).toBe(p.d08Revealed);
        if (!p.d08Revealed) expect(d08.responses, `${p.name}: D08 responses for ${viewer}`).toEqual([]);
        else expect(d08.responses.map((r) => r.participantId)).toEqual(['paco', 'gaetan', 'alvarinn']);
        // No aggregate of any kind is ever computed for the browser.
        expect(json, `${p.name}: aggregate keys`).not.toMatch(/"(mean|median|sd|stdDev|average|min|max|meanByQuestion|collective)"\s*:/);
        // Own data only in me / myResponses / submit.
        expect(out.myResponses.every((r) => r.participantId === viewer)).toBe(true);
        expect(out.submit.response.participantId).toBe(viewer);
        expect(Object.keys(out.me).sort()).toEqual(['completedCount', 'expiresAt', 'participant']);
        // completion: counts only.
        expect(JSON.stringify(out.completion)).not.toMatch(/answers|individualScore|comments|q1/);
        // health / config: nothing private.
        expect(JSON.stringify([out.health, out.config])).not.toMatch(/SECRET-|"salt"|"hash"|SESSION_SECRET|"answers"|"token"|"comments"/);
        // When not revealed, the viewer's answers must not include another participant's distinctive answer sets.
        if (!p.d08Revealed) {
          for (const pattern of ['"q1":3,"q2":9,"q3":2', '"q1":10,"q2":1,"q3":9', '"q1":1,"q2":1,"q3":10']) {
            const ownPattern = (viewer === 'paco' && pattern.startsWith('"q1":3')) || (viewer === 'gaetan' && pattern.startsWith('"q1":10')) || (viewer === 'alvarinn' && pattern.startsWith('"q1":1,'));
            if (!ownPattern) expect(json.includes(pattern), `${p.name}: ${viewer} sees answers ${pattern}`).toBe(false);
          }
        }
      }
    });
  }

  it('unauthenticated callers get nothing but health and config', async () => {
    const client = createDemoClient({ storage: seededStorage({ RESULTS_REVEAL_POLICY: 'always' }), latencyMs: 0 });
    for (const call of [() => client.me(''), () => client.results('x'), () => client.myResponses('ge1.paco.1.1.9999999999.x.y'), () => client.completion('')]) {
      await expect(call()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    }
  });
});

/* ------------------------------------------------------------------------------------------------------------ */
/* 2. Backend (Results.gs) and frontend (statistics.ts) agree                                                    */
/* ------------------------------------------------------------------------------------------------------------ */

function backendWithRegistry(registry?: Record<string, unknown>) {
  const sources = loadBackendSources();
  if (registry) sources.push({ name: 'QaRegistry.gs', code: `DESTINATION_REGISTRY = ${JSON.stringify(registry)};` });
  return createAppsScriptEmulator({ sources, properties: { SESSION_SECRET: 'qa-secret-0123456789-0123456789-abcdef' } });
}

function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** Random complete evaluations for all 20 destinations, as records shaped like Responses rows. */
function randomRecords(seed: number) {
  const rnd = seededRandom(seed);
  const records: Record<string, unknown>[] = [];
  const ids = readdirSync(join(ROOT, 'data/destinations')).filter((f) => /^D\d{2}-.*\.json$/.test(f)).map((f) => f.slice(0, 3)).sort();
  for (const id of ids) {
    for (const pid of PARTICIPANT_IDS) {
      const ans = { q1: 1 + Math.floor(rnd() * 10), q2: 1 + Math.floor(rnd() * 10), q3: 1 + Math.floor(rnd() * 10), q4: 1 + Math.floor(rnd() * 10), q5: 1 + Math.floor(rnd() * 10) };
      records.push({ rowIndex: records.length + 2, participantId: pid, destinationId: id, answers: ans, updatedAt: '2027-01-01T00:00:00.000Z', revisionNumber: 1 });
    }
  }
  return records as { participantId: ParticipantId; destinationId: string; answers: Answers }[];
}

describe('A24 statistics — backend Results tab ≡ frontend Group results', () => {
  it('mean, median, min, max, population SD, per-question means and Q1 reservations agree on 5 random data sets', () => {
    const emu = backendWithRegistry();
    for (const seed of [1, 2, 3, 4, 5]) {
      const records = randomRecords(seed);
      const backend = emu.call('computeAllStats_', records) as {
        destinationId: string; mean: number; median: number; min: number; max: number; sd: number; reservations: number; meanByQuestion: Record<string, number>;
      }[];
      for (const b of backend) {
        const entries = records.filter((r) => r.destinationId === b.destinationId).map((r) => ({ participantId: r.participantId, answers: r.answers }));
        const f = computeStats(b.destinationId, entries)!;
        expect(f.mean, `${seed}/${b.destinationId} mean`).toBeCloseTo(b.mean, 12);
        expect(f.median).toBeCloseTo(b.median, 12);
        expect(f.min).toBeCloseTo(b.min, 12);
        expect(f.max).toBeCloseTo(b.max, 12);
        expect(f.sd).toBeCloseTo(b.sd, 12);
        expect(f.q1Low, `${seed}/${b.destinationId} reservations (Q1 ≤ 4)`).toBe(b.reservations);
        for (const q of ['q1', 'q2', 'q3', 'q4', 'q5'] as const) expect(f.meanByQuestion[q]).toBeCloseTo(b.meanByQuestion[q], 12);
      }
    }
  });

  it('with the same eligibility inputs, both rank the destinations in the same order', () => {
    const summaries = buildIndex(ROOT);
    expect(summaries.length).toBeGreaterThanOrEqual(20);
    // Registry built from the CURRENT data, exactly like scripts/build-backend-registry.ts would.
    const registry = Object.fromEntries(summaries.map((s) => [s.id, {
      name: s.country, title: s.title, version: s.version, securityStatus: s.securityStatus,
      realisticTotalEUR: Math.round(s.totalRealistic * 100) / 100, budgetStatus: s.budgetStatus,
      materialUncertainty: s.materialUncertainty, pending: false,
    }]));
    const emu = backendWithRegistry(registry);
    for (const seed of [11, 12, 13]) {
      const records = randomRecords(seed);
      const backend = emu.call('computeAllStats_', records) as { destinationId: string; rank: number | null; eligible: boolean }[];
      const candidates: RankingCandidate[] = summaries.map((s) => ({
        id: s.id, securityStatus: s.securityStatus, totalRealistic: s.totalRealistic, materialUncertainty: s.materialUncertainty,
        stats: computeStats(s.id, records.filter((r) => r.destinationId === s.id).map((r) => ({ participantId: r.participantId, answers: r.answers }))),
      }));
      const front = rankDestinations(candidates).ranked.map((r) => r.candidate.id);
      const back = backend.filter((b) => b.eligible).sort((x, y) => x.rank! - y.rank!).map((b) => b.destinationId);
      expect(back, `seed ${seed}`).toEqual(front);
    }
  });
});

/* ------------------------------------------------------------------------------------------------------------ */
/* 3. Known defects (reproductions)                                                                              */
/* ------------------------------------------------------------------------------------------------------------ */

describe('A24 known defects (skipped unless QA_RUN_FIXME=1)', () => {
  it('A24-QA-01: the deployed registry (Destinations.gs) matches the current destination data', () => {
    // Destinations.gs still marks D14–D20 as "pending" although all 20 data files now validate. The Results tab
    // (and therefore the spreadsheet's ranking_position) would exclude Japan, Senegal, South Africa and Mexico —
    // all eligible — while the website ranks them: two different "winners" are possible.
    const emu = backendWithRegistry();
    const registry = emu.call('getDestinationRegistry_') as Record<string, { pending: boolean; securityStatus: string | null; realisticTotalEUR: number | null; materialUncertainty: boolean | null }>;
    const summaries = buildIndex(ROOT);
    expect(summaries.length).toBeGreaterThanOrEqual(20);
    const drift = summaries.filter((s) => {
      const r = registry[s.id];
      return !r || r.pending || r.securityStatus !== s.securityStatus || r.materialUncertainty !== s.materialUncertainty
        || Math.abs((r.realisticTotalEUR ?? -1) - Math.round(s.totalRealistic * 100) / 100) > 0.005;
    }).map((s) => s.id);
    expect(drift).toEqual([]);
  });

  it('A24-QA-02: equal collective scores fall through to the documented tie-breakers (float-safe comparison)', () => {
    // Collective score = mean of four individual scores (k/5 values). Floating-point addition is order-dependent,
    // so two destinations whose collective scores are EXACTLY equal (same total points) can differ by 1 ulp and the
    // ranking is then decided by rounding noise instead of "lowest individual score → mean Q1 → id".
    // A: individual scores 1.6, 3.6, 4.4, 4.4 (mean Q1 1.75)   B: 4.4, 3.6, 1.6, 4.4 (mean Q1 5.5)
    // Both have total 70 points → collective 3.5, lowest 1.6 → B must win on mean Q1.
    const A: Record<ParticipantId, Answers> = { paco: a(1, 1, 2, 2, 2), gaetan: a(2, 4, 4, 4, 4), alvarinn: a(2, 5, 5, 5, 5), victor: a(2, 5, 5, 5, 5) };
    const B: Record<ParticipantId, Answers> = { paco: a(6, 4, 4, 4, 4), gaetan: a(6, 3, 3, 3, 3), alvarinn: a(4, 1, 1, 1, 1), victor: a(6, 4, 4, 4, 4) };
    const entries = (m: Record<ParticipantId, Answers>) => PARTICIPANT_IDS.map((p) => ({ participantId: p, answers: m[p] }));
    const cand = (id: string, m: Record<ParticipantId, Answers>): RankingCandidate => ({ id, securityStatus: 'eligible', totalRealistic: 1800, materialUncertainty: false, stats: computeStats(id, entries(m)) });
    const front = rankDestinations([cand('D01', A), cand('D05', B)]).ranked.map((r) => r.candidate.id);

    const emu = backendWithRegistry({
      D01: { name: 'A', title: 'A', version: '1.0.0', securityStatus: 'eligible', realisticTotalEUR: 1800, budgetStatus: 'within-preferred', materialUncertainty: false, pending: false },
      D05: { name: 'B', title: 'B', version: '1.0.0', securityStatus: 'eligible', realisticTotalEUR: 1800, budgetStatus: 'within-preferred', materialUncertainty: false, pending: false },
    });
    const recs = [...entries(A).map((e, i) => ({ ...e, destinationId: 'D01', rowIndex: i + 2, updatedAt: 'x', revisionNumber: 1 })),
      ...entries(B).map((e, i) => ({ ...e, destinationId: 'D05', rowIndex: i + 10, updatedAt: 'x', revisionNumber: 1 }))];
    const back = (emu.call('computeAllStats_', recs) as { destinationId: string; rank: number | null }[])
      .filter((s) => s.rank !== null).sort((x, y) => x.rank! - y.rank!).map((s) => s.destinationId);

    expect.soft(front, 'frontend ranking (src/lib/statistics.ts compareRanked)').toEqual(['D05', 'D01']);
    expect.soft(back, 'backend Results tab ranking (Results.gs rankEligible_)').toEqual(['D05', 'D01']);
  });
});
