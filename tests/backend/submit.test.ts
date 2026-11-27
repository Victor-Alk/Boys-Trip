import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createAppsScriptEmulator } from '../../backend/emulator/index.js';
import { createTestBackend, ans, snapshot, type Json } from './helpers';

describe('submit — validation', () => {
  it('stores a valid evaluation with the server-computed, unrounded individual score', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    const r = b.submit(token, 'D01', { q1: 9, q2: 8, q3: 8, q4: 8, q5: 8 }, { comments: 'Looks great' });
    expect(r.ok).toBe(true);
    expect(r.data).toMatchObject({ created: true, idempotentReplay: false, completedCount: 1 });
    expect(r.data.response).toMatchObject({
      participantId: 'paco', participantName: 'Paco', destinationId: 'D01', destinationName: 'Alpha',
      answers: { q1: 9, q2: 8, q3: 8, q4: 8, q5: 8 }, comments: 'Looks great', questionnaireVersion: 'q1',
      destinationVersion: '1.0.0', revisionNumber: 1,
    });
    expect(r.data.response.individualScore).toBeCloseTo(8.2, 12);
    const [row] = b.rows('Responses');
    expect(row.individual_score).toBeCloseTo(8.2, 12);
    expect(row.individual_score).not.toBe(8);
    expect(row).toMatchObject({ participant_id: 'paco', destination_id: 'D01', q1_overall_enthusiasm: 9, revision_number: 1 });
    expect(row.created_at).toBe('2027-01-15T10:00:00.000Z');
    expect(row.updated_at).toBe('2027-01-15T10:00:00.000Z');
  });

  it.each([
    ['0', { q1: 0, q2: 5, q3: 5, q4: 5, q5: 5 }],
    ['11', { q1: 5, q2: 11, q3: 5, q4: 5, q5: 5 }],
    ['5.5', { q1: 5, q2: 5, q3: 5.5, q4: 5, q5: 5 }],
    ['a numeric string', { q1: 5, q2: 5, q3: 5, q4: '5', q5: 5 }],
    ['a word', { q1: 5, q2: 5, q3: 5, q4: 5, q5: 'ten' }],
    ['null', { q1: null, q2: 5, q3: 5, q4: 5, q5: 5 }],
    ['a missing answer', { q1: 5, q2: 5, q4: 5, q5: 5 }],
    ['a sixth answer', { q1: 5, q2: 5, q3: 5, q4: 5, q5: 5, q6: 5 }],
    ['a boolean', { q1: true, q2: 5, q3: 5, q4: 5, q5: 5 }],
    ['negative', { q1: -3, q2: 5, q3: 5, q4: 5, q5: 5 }],
  ])('rejects %s', (_label, answers) => {
    const b = createTestBackend();
    const token = b.login('paco');
    const r = b.submit(token, 'D01', answers as Record<string, unknown>);
    expect(r.ok).toBe(false);
    expect(r.error).toMatchObject({ code: 'VALIDATION_FAILED', retryable: false });
    expect(b.rows('Responses')).toHaveLength(0);
  });

  it('rejects answers that are not an object', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    const r = b.post('submit', { token, requestId: randomUUID(), payload: { destinationId: 'D01', answers: [5, 5, 5, 5, 5], comments: '', questionnaireVersion: 'q1', destinationVersion: '1.0.0' } });
    expect(r.error.code).toBe('VALIDATION_FAILED');
  });

  it('rejects unknown destinations', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    for (const id of ['D99', 'd01', 'D1', '', 'Sheet1']) {
      expect(b.submit(token, id, ans(5)).error.code, id).toBe('VALIDATION_FAILED');
    }
    expect(b.rows('Responses')).toHaveLength(0);
  });

  it('accepts every id D01–D20 of the generated registry (even pending research) and nothing else', () => {
    const b = createTestBackend({ registry: 'real' });
    const token = b.login('victor');
    expect(b.post('config').data.destinationIds).toEqual(Array.from({ length: 20 }, (_, i) => `D${String(i + 1).padStart(2, '0')}`));
    for (let i = 1; i <= 20; i++) expect(b.submit(token, `D${String(i).padStart(2, '0')}`, ans(6)).ok).toBe(true);
    expect(b.submit(token, 'D21', ans(6)).error.code).toBe('VALIDATION_FAILED');
    expect(b.post('completion', { token }).data).toMatchObject({ totalActive: 20, maxActive: 80 });
  });

  it('restricts ids with ALLOWED_DESTINATION_IDS', () => {
    const b = createTestBackend({ properties: { ALLOWED_DESTINATION_IDS: 'D01, D05' } });
    const token = b.login('paco');
    expect(b.post('config').data.destinationIds).toEqual(['D01', 'D05']);
    expect(b.submit(token, 'D05', ans(6)).ok).toBe(true);
    expect(b.submit(token, 'D02', ans(6)).error.code).toBe('VALIDATION_FAILED');
  });

  it('enforces the comment length limit (2000)', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    expect(b.submit(token, 'D01', ans(5), { comments: 'x'.repeat(2001) }).error.code).toBe('VALIDATION_FAILED');
    expect(b.submit(token, 'D01', ans(5), { comments: 'x'.repeat(2000) }).ok).toBe(true);
    expect(b.submit(token, 'D05', ans(5), { comments: 42 }).error.code).toBe('VALIDATION_FAILED');
  });

  it('requires the current questionnaire version and a semver destination version', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    expect(b.submit(token, 'D01', ans(5), { questionnaireVersion: 'q0' }).error.code).toBe('VALIDATION_FAILED');
    expect(b.submit(token, 'D01', ans(5), { questionnaireVersion: undefined }).ok).toBe(true); // helper default q1
    for (const v of ['1.0', 'v1.0.0', '1.0.0-beta', '', 100]) {
      expect(b.submit(token, 'D05', ans(5), { destinationVersion: v }).error.code, String(v)).toBe('VALIDATION_FAILED');
    }
    const b2 = createTestBackend({ properties: { QUESTIONNAIRE_VERSION: 'q2' } });
    const t2 = b2.login('paco');
    expect(b2.submit(t2, 'D01', ans(5)).error.code).toBe('VALIDATION_FAILED');
    expect(b2.submit(t2, 'D01', ans(5), { questionnaireVersion: 'q2' }).ok).toBe(true);
  });

  it('requires a UUID requestId', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    const payload = { destinationId: 'D01', answers: ans(5), comments: '', questionnaireVersion: 'q1', destinationVersion: '1.0.0' };
    expect(b.post('submit', { token, payload }).error.code).toBe('BAD_REQUEST');
    expect(b.post('submit', { token, payload, requestId: 'abc' }).error.code).toBe('BAD_REQUEST');
    expect(b.rows('Responses')).toHaveLength(0);
  });
});

describe('submit — identity', () => {
  it('a participant cannot submit or edit another participant’s evaluation', () => {
    const b = createTestBackend();
    const t = b.tokens();
    expect(b.submit(t.gaetan, 'D01', ans(9), { comments: 'Gaetan original' }).ok).toBe(true);
    // participantId naming someone else is rejected outright…
    const forged = b.submit(t.paco, 'D01', ans(1), { participantId: 'gaetan', comments: 'overwrite' });
    expect(forged.error).toMatchObject({ code: 'FORBIDDEN', retryable: false });
    // …and a matching participantId is ignored: the row always belongs to the token's participant.
    const own = b.submit(t.paco, 'D01', ans(4), { participantId: 'paco' });
    expect(own.data.response.participantId).toBe('paco');
    const rows = b.rows('Responses');
    expect(rows).toHaveLength(2);
    const gaetan = rows.find((r) => r.participant_id === 'gaetan')!;
    expect(gaetan).toMatchObject({ q1_overall_enthusiasm: 9, comments: 'Gaetan original', revision_number: 1 });
    expect(b.post('myResponses', { token: t.paco }).data.responses.map((r: Json) => r.participantId)).toEqual(['paco']);
  });
});

describe('submit — uniqueness, revisions and History', () => {
  it('re-sending identical content with a new requestId keeps one active row and writes no History', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    expect(b.submit(token, 'D01', ans(7), { comments: 'same' }).data.created).toBe(true);
    const second = b.submit(token, 'D01', ans(7), { comments: 'same' });
    expect(second.data).toMatchObject({ created: false, idempotentReplay: false });
    expect(second.data.response.revisionNumber).toBe(1);
    expect(b.rows('Responses')).toHaveLength(1);
    expect(b.rows('History')).toHaveLength(0);
  });

  it('a revision replaces the active row in place, archives the previous version and sets revision_number 2', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    const first = b.submit(token, 'D01', ans(6, 6, 6, 6, 6), { comments: 'first thoughts' });
    b.clock.advance(60_000);
    const reqId = randomUUID();
    const second = b.submit(token, 'D01', ans(9, 8, 8, 8, 8), { comments: 'changed my mind', requestId: reqId });
    expect(second.data).toMatchObject({ created: false, idempotentReplay: false, completedCount: 1 });
    expect(second.data.response).toMatchObject({ responseId: first.data.response.responseId, revisionNumber: 2, comments: 'changed my mind' });
    expect(second.data.response.createdAt).toBe(first.data.response.createdAt);
    expect(second.data.response.updatedAt).not.toBe(first.data.response.updatedAt);

    const rows = b.rows('Responses');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ revision_number: 2, q1_overall_enthusiasm: 9, comments: 'changed my mind', last_request_id: reqId });
    const history = b.rows('History');
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      original_response_id: first.data.response.responseId, participant_id: 'paco', destination_id: 'D01',
      previous_q1: 6, previous_q5: 6, previous_individual_score: 6, previous_comments: 'first thoughts',
      revision_number: 1, superseded_by_revision: 2, revision_timestamp: second.data.response.updatedAt,
      request_id: reqId, reason: 'revision',
    });

    b.clock.advance(60_000);
    expect(b.submit(token, 'D01', ans(3), { comments: '' }).data.response.revisionNumber).toBe(3);
    expect(b.rows('Responses')).toHaveLength(1);
    expect(b.rows('History')).toHaveLength(2);
    // History is never counted.
    expect(b.post('completion', { token }).data.totalActive).toBe(1);
    expect(b.post('myResponses', { token }).data.responses).toHaveLength(1);
  });
});

describe('submit — idempotency', () => {
  it('replaying the same requestId returns the stored result and writes nothing', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    const requestId = randomUUID();
    const first = b.submit(token, 'D01', ans(8), { requestId, comments: 'once' });
    const before = snapshot(b.emu.state.spreadsheets);
    let writes = 0;
    b.emu.hooks.onWrite = () => { writes++; };
    const replay = b.submit(token, 'D01', ans(8), { requestId, comments: 'once' });
    expect(replay.data).toMatchObject({ idempotentReplay: true, created: true });
    expect(replay.data.response).toEqual(first.data.response);
    expect(writes).toBe(0);
    expect(b.emu.state.spreadsheets).toEqual(before);
  });

  it('still detects the replay from the sheet when the cache has been evicted', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    const requestId = randomUUID();
    b.submit(token, 'D01', ans(8), { requestId });
    b.emu.clearCache();
    const before = snapshot(b.emu.state.spreadsheets);
    const replay = b.submit(token, 'D01', ans(8), { requestId });
    expect(replay.data.idempotentReplay).toBe(true);
    expect(b.emu.state.spreadsheets).toEqual(before);
  });

  it('a late replay of an older request (after a newer revision) does not roll the evaluation back', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    const old = randomUUID();
    b.submit(token, 'D01', ans(2), { requestId: old });
    b.clock.advance(1000);
    b.submit(token, 'D01', ans(9));
    b.emu.clearCache();
    const before = snapshot(b.emu.state.spreadsheets);
    const replay = b.submit(token, 'D01', ans(2), { requestId: old });
    expect(replay.data.idempotentReplay).toBe(true);
    expect(replay.data.response.answers.q1).toBe(9);
    expect(b.emu.state.spreadsheets).toEqual(before);
  });

  it('a retried no-change submission does not roll back a newer revision', () => {
    // A re-send of identical content writes nothing; if its response is lost and the client retries it after the
    // participant has saved a newer version, the retry must be recognised as already applied.
    const b = createTestBackend();
    const token = b.login('paco');
    b.submit(token, 'D01', ans(4), { comments: 'v1' });
    const noChange = randomUUID();
    expect(b.submit(token, 'D01', ans(4), { comments: 'v1', requestId: noChange }).data).toMatchObject({ created: false, idempotentReplay: false });
    b.clock.advance(1000);
    expect(b.submit(token, 'D01', ans(9), { comments: 'v2' }).data.response.revisionNumber).toBe(2);
    const before = snapshot(b.emu.state.spreadsheets);
    const retry = b.submit(token, 'D01', ans(4), { comments: 'v1', requestId: noChange });
    expect(retry.data.idempotentReplay).toBe(true);
    expect(b.emu.state.spreadsheets).toEqual(before);
    expect(b.post('myResponses', { token }).data.responses[0]).toMatchObject({ comments: 'v2', revisionNumber: 2 });
  });

  it('a requestId used by one participant does not affect another participant', () => {
    const b = createTestBackend();
    const t = b.tokens();
    const requestId = randomUUID();
    b.submit(t.paco, 'D01', ans(8), { requestId });
    const other = b.submit(t.victor, 'D01', ans(3), { requestId });
    expect(other.data).toMatchObject({ created: true, idempotentReplay: false });
    expect(b.rows('Responses')).toHaveLength(2);
  });
});

describe('submit — concurrency', () => {
  it('answers LOCK_TIMEOUT (retryable) while another execution holds the lock, then succeeds', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    const release = b.emu.holdLock();
    const requestId = randomUUID();
    const busy = b.submit(token, 'D01', ans(5), { requestId });
    expect(busy.error).toMatchObject({ code: 'LOCK_TIMEOUT', retryable: true });
    expect(b.rows('Responses')).toHaveLength(0);
    release();
    expect(b.submit(token, 'D01', ans(5), { requestId }).data.created).toBe(true);
  });

  it('two overlapping submits for the same participant + destination never create two active rows', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    const reqB = randomUUID();
    let inner: Json = null;
    b.emu.hooks.onWrite = (e) => {
      if (e.sheet === 'Responses' && e.type === 'setValues' && !inner) {
        // A second request arrives while the first one is half-way through its critical section.
        inner = b.submit(token, 'D01', ans(9), { requestId: reqB });
      }
    };
    const outer = b.submit(token, 'D01', ans(4));
    b.emu.hooks.onWrite = null;
    expect(outer.data.created).toBe(true);
    expect(inner.error).toMatchObject({ code: 'LOCK_TIMEOUT', retryable: true });
    // The client retries with the same requestId.
    b.clock.advance(500);
    const retry = b.submit(token, 'D01', ans(9), { requestId: reqB });
    expect(retry.data).toMatchObject({ created: false, idempotentReplay: false });
    expect(retry.data.response.revisionNumber).toBe(2);
    const rows = b.rows('Responses');
    expect(rows).toHaveLength(1);
    expect(rows[0].q1_overall_enthusiasm).toBe(9);
  });

  it('overlapping submits from different participants both land after a retry', () => {
    const b = createTestBackend();
    const t = b.tokens();
    const reqVictor = randomUUID();
    let inner: Json = null;
    b.emu.hooks.onWrite = (e) => {
      if (e.sheet === 'Responses' && !inner) inner = b.submit(t.victor, 'D01', ans(6), { requestId: reqVictor });
    };
    b.submit(t.paco, 'D01', ans(7));
    b.emu.hooks.onWrite = null;
    expect(inner.error.code).toBe('LOCK_TIMEOUT');
    expect(b.submit(t.victor, 'D01', ans(6), { requestId: reqVictor }).data.created).toBe(true);
    expect(b.rows('Responses').map((r) => r.participant_id).sort()).toEqual(['paco', 'victor']);
  });

  it('if duplicates ever exist (e.g. a manual copy), the next submit for that key resolves them first', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    b.submit(token, 'D01', ans(5));
    const sheet = b.emu.sheet('Responses')!;
    const dup = snapshot(sheet.rows[1]);
    dup[0] = { v: randomUUID(), n: '@' };
    dup[13] = { v: '2027-01-15T09:00:00.000Z', n: '@' }; // older copy
    sheet.rows.push(dup);
    expect(b.rows('Responses')).toHaveLength(2);
    b.clock.advance(1000);
    const r = b.submit(token, 'D01', ans(8));
    expect(r.ok).toBe(true);
    const rows = b.rows('Responses');
    expect(rows).toHaveLength(1);
    expect(rows[0].q1_overall_enthusiasm).toBe(8);
    expect(b.rows('History').map((h) => h.reason).sort()).toEqual(['reconcile-duplicate', 'revision']);
  });
});

describe('submit — partial failures (Sheets is not transactional)', () => {
  it('a failed revision is completed by retrying the same requestId without a duplicate History row', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    b.submit(token, 'D01', ans(5), { comments: 'v1' });
    const sheet = b.emu.sheet('Responses')!;
    const beforeFailure = snapshot(sheet.rows[1]);
    b.clock.advance(60_000);
    const requestId = randomUUID();
    // History append succeeds, then the in-place update of the active row fails.
    b.emu.hooks.onWrite = (e) => {
      if (e.sheet === 'Responses' && e.type === 'setValues') throw new Error('Service Spreadsheets timed out while accessing document');
    };
    const failed = b.submit(token, 'D01', ans(9), { comments: 'v2', requestId });
    b.emu.hooks.onWrite = null;
    expect(failed.error).toMatchObject({ code: 'SHEET_ERROR', retryable: true });
    expect(b.rows('History')).toHaveLength(1);
    // The fake applies a write before the hook throws; restore the row to model the write being lost.
    sheet.rows[1] = beforeFailure;
    expect(b.rows('Responses')[0]).toMatchObject({ comments: 'v1', revision_number: 1 });
    b.clock.advance(5_000);
    b.emu.clearCache();
    const retry = b.submit(token, 'D01', ans(9), { comments: 'v2', requestId });
    expect(retry.ok).toBe(true);
    expect(retry.data.response.revisionNumber).toBe(2);
    expect(b.rows('History')).toHaveLength(1);
    expect(b.rows('Responses')).toHaveLength(1);
  });

  it('a Results rebuild failure does not fail the submission; the stale tab is repaired by the next write', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    b.emu.call('setup'); // tabs exist; only the derived rebuild will fail
    b.emu.hooks.onWrite = (e) => {
      if (e.sheet === 'Results') throw new Error('Service Spreadsheets timed out');
    };
    const r = b.submit(token, 'D01', ans(7));
    b.emu.hooks.onWrite = null;
    expect(r.ok).toBe(true);
    expect(b.emu.getProperty('RESULTS_STALE_SINCE')).toBeTruthy();
    expect(b.emu.call('checkConfiguration').resultsStaleSince).toBeTruthy();
    b.submit(token, 'D05', ans(6));
    expect(b.emu.getProperty('RESULTS_STALE_SINCE')).toBeNull();
    expect(b.rows('Results').find((x) => x.destination_id === 'D01')!.active_responses).toBe(1);
  });
});

describe('formula-injection protection', () => {
  const payloads = [
    '=HYPERLINK("https://evil.example","Click me")',
    '+SUM(1,2)',
    '-1+2',
    '@IMPORTRANGE("x","y")',
    '\t=1+1',
    "'quoted",
  ];

  it.each(payloads)('stores %j as inert text and returns it unchanged', (comment) => {
    const b = createTestBackend();
    const token = b.login('paco');
    const r = b.submit(token, 'D01', ans(5), { comments: comment });
    expect(r.ok).toBe(true);
    const expected = comment.trim();
    expect(r.data.response.comments).toBe(expected);
    const cell = b.emu.sheet('Responses')!.rows[1][11]!;
    expect(cell.f).toBeUndefined();
    expect(cell.n).toBe('@');
    expect(String(cell.v).startsWith("'")).toBe(true);
    expect(b.post('myResponses', { token }).data.responses[0].comments).toBe(expected);
  });

  it('the fake Sheets would have created a formula without the protection (sanity check of the emulator)', () => {
    const emu = createAppsScriptEmulator({
      sources: [{
        name: 'Raw.gs',
        code: `function writeRaw(v, fmt) {
          var sh = SpreadsheetApp.openById('raw').getSheetByName('Sheet1');
          var r = sh.getRange(1, 1, 1, 1);
          if (fmt) r.setNumberFormat(fmt);
          r.setValues([[v]]);
          return { formula: r.getFormulas()[0][0], value: r.getValues()[0][0] };
        }`,
      }],
    });
    expect(emu.call('writeRaw', '=HYPERLINK("https://evil.example","x")')).toEqual({ formula: '=HYPERLINK("https://evil.example","x")', value: '' });
    expect(emu.call('writeRaw', '0012')).toEqual({ formula: '', value: 12 });
    expect(emu.call('writeRaw', '0012', '@')).toEqual({ formula: '', value: '0012' });
  });
});
