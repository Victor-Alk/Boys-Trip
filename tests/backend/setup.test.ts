import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createTestBackend, ans, snapshot, PIDS, SPREADSHEET_ID } from './helpers';
import type { EmulatorSpreadsheetState } from '../../backend/emulator/index.js';

function spreadsheetWith(sheets: { name: string; rows: unknown[][] }[]): Record<string, EmulatorSpreadsheetState> {
  return {
    [SPREADSHEET_ID]: {
      id: SPREADSHEET_ID,
      name: 'The Great Expedition',
      nextSheetId: sheets.length + 1,
      sheets: sheets.map((s, i) => ({
        name: s.name,
        sheetId: i,
        frozenRows: 0,
        rows: s.rows.map((r) => r.map((v) => ({ v: v as string | number }))),
      })),
    },
  };
}

describe('non-destructive setup', () => {
  it('creates Responses, Results and History after the existing tabs and never touches Sheet1', () => {
    const b = createTestBackend({ spreadsheets: spreadsheetWith([{ name: 'Sheet1', rows: [['keep me', 42], ['', 'and me']] }]) });
    const sheet1Before = snapshot(b.emu.sheet('Sheet1'));
    const report = b.emu.call('setup');
    expect(report.tabs).toEqual({ Responses: 'created', Results: 'created', History: 'created', Prompts: 'created' });
    expect(report.configured).toBe(true);
    expect(b.emu.spreadsheet()!.sheets.map((s) => s.name)).toEqual(['Sheet1', 'Responses', 'Results', 'History', 'Prompts']);
    expect(b.emu.sheet('Sheet1')).toEqual(sheet1Before);
    expect(b.emu.sheetValues('Responses')[0]).toEqual([
      'response_id', 'participant_id', 'participant_name', 'destination_id', 'destination_name', 'q1_overall_enthusiasm',
      'q2_cultural_appeal', 'q3_geographical_appeal', 'q4_adventure_appeal', 'q5_practical_suitability', 'individual_score',
      'comments', 'created_at', 'updated_at', 'questionnaire_version', 'destination_version', 'revision_number', 'last_request_id',
    ]);
    expect(b.emu.sheet('Responses')!.frozenRows).toBe(1);

    // Using the app afterwards still never touches Sheet1.
    const t = b.tokens();
    for (const p of PIDS) b.submit(t[p], 'D01', ans(7));
    b.emu.call('rebuildResults');
    b.emu.call('reconcile');
    expect(b.emu.sheet('Sheet1')).toEqual(sheet1Before);
  });

  it('is idempotent: running setup again changes nothing', () => {
    const b = createTestBackend();
    b.emu.call('setup');
    const t = b.login('paco');
    b.submit(t, 'D01', ans(8));
    const before = snapshot(b.emu.state.spreadsheets);
    const report = b.emu.call('setup');
    expect(report.tabs).toEqual({ Responses: 'ok', Results: 'ok', History: 'ok', Prompts: 'ok' });
    expect(b.emu.state.spreadsheets).toEqual(before);
  });

  it('refuses a tab with unexpected headers instead of overwriting it, and creates nothing else', () => {
    const b = createTestBackend({
      spreadsheets: spreadsheetWith([
        { name: 'Sheet1', rows: [] },
        { name: 'Responses', rows: [['name', 'score'], ['Someone', 3]] },
      ]),
    });
    const before = snapshot(b.emu.state.spreadsheets);
    expect(() => b.emu.call('setup')).toThrow(/Tab "Responses" already exists with unexpected headers.*column 1 should be "response_id" but is "name".*Nothing was changed/);
    expect(b.emu.state.spreadsheets).toEqual(before);
    const token = b.login('paco');
    const r = b.submit(token, 'D01', ans(5));
    expect(r.error).toMatchObject({ code: 'NOT_CONFIGURED', retryable: false });
    expect(b.post('results', { token }).error.code).toBe('NOT_CONFIGURED');
    expect(b.emu.state.spreadsheets).toEqual(before);
    // The menu reports the problem instead of crashing.
    b.emu.call('menuSetup');
    expect(b.emu.ui.alerts.at(-1)!.title).toContain('nothing was overwritten');
  });

  it('detects an extra column or a renamed column in an otherwise correct header', () => {
    const b = createTestBackend();
    b.emu.call('setup');
    const history = b.emu.sheet('History')!;
    history.rows[0].push({ v: 'my_notes' });
    expect(() => b.emu.call('setup')).toThrow(/Tab "History".*column 22/);
  });

  it('adds the header row to an existing but empty tab', () => {
    const b = createTestBackend({ spreadsheets: spreadsheetWith([{ name: 'Sheet1', rows: [] }, { name: 'Results', rows: [] }]) });
    expect(b.emu.call('setup').tabs).toEqual({ Responses: 'created', Results: 'initialised', History: 'created', Prompts: 'created' });
    expect(b.emu.sheetValues('Results')[0][0]).toBe('destination_id');
  });

  it('SHEET_NAMESPACE=TEST_ writes only to TEST_ tabs (safe integration testing)', () => {
    const b = createTestBackend({ properties: { SHEET_NAMESPACE: 'TEST_' } });
    const token = b.login('paco');
    expect(b.submit(token, 'D01', ans(5)).ok).toBe(true);
    expect(b.emu.spreadsheet()!.sheets.map((s) => s.name)).toEqual(['Sheet1', 'TEST_Responses', 'TEST_Results', 'TEST_History', 'TEST_Prompts']);
    expect(b.emu.sheetValues('TEST_Responses')).toHaveLength(2);
    // Removing the namespace switches to the real tabs, which start empty.
    b.emu.setProperty('SHEET_NAMESPACE', null);
    expect(b.post('myResponses', { token }).data.responses).toEqual([]);
  });

  it('an invalid SHEET_NAMESPACE is a configuration error', () => {
    const b = createTestBackend({ properties: { SHEET_NAMESPACE: 'Bad Name!' } });
    const token = b.login('paco');
    expect(b.submit(token, 'D01', ans(5)).error.code).toBe('NOT_CONFIGURED');
    expect(b.emu.doGet().data.configured).toBe(false);
  });

  it('read-only actions do not create tabs', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    expect(b.post('results', { token }).ok).toBe(true);
    expect(b.post('completion', { token }).data.totalActive).toBe(0);
    expect(b.emu.spreadsheet()!.sheets.map((s) => s.name)).toEqual(['Sheet1']);
  });
});

describe('rebuildResults and reconcile', () => {
  it('rebuildResults reproduces the Results tab from Responses', () => {
    const b = createTestBackend();
    const t = b.tokens();
    PIDS.forEach((p, i) => {
      b.submit(t[p], 'D01', ans(5 + i));
      b.submit(t[p], 'D02', ans(9 - i));
      if (i < 2) b.submit(t[p], 'D05', ans(3 + i), { comments: `note ${p}` });
    });
    b.clock.advance(1000);
    b.submit(t.paco, 'D01', ans(10)); // a revision (History must not be counted)
    const expected = snapshot(b.emu.sheetValues('Results'));
    expect(expected).toHaveLength(1 + 7);

    // Wipe and corrupt the derived tab, then rebuild.
    const results = b.emu.sheet('Results')!;
    results.rows = [results.rows[0], [{ v: 'garbage' }]];
    expect(b.emu.call('rebuildResults')).toEqual({ rows: 7 });
    expect(b.emu.sheetValues('Results')).toEqual(expected);
    const d01 = b.rows('Results').find((r) => r.destination_id === 'D01')!;
    expect(d01).toMatchObject({ active_responses: 4, score_paco: 10, score_gaetan: 6, score_alvarinn: 7, score_victor: 8 });
  });

  it('reconcile keeps the latest duplicate, archives the others to History and is idempotent', () => {
    const b = createTestBackend();
    const t = b.tokens();
    b.submit(t.paco, 'D01', ans(5));
    b.submit(t.victor, 'D01', ans(6));
    const sheet = b.emu.sheet('Responses')!;
    const newer = snapshot(sheet.rows[1]);
    newer[0] = { v: randomUUID(), n: '@' };
    newer[5] = { v: 9, n: '0' };
    newer[13] = { v: '2027-01-15T11:00:00.000Z', n: '@' };
    const older = snapshot(sheet.rows[1]);
    older[0] = { v: randomUUID(), n: '@' };
    older[13] = { v: '2027-01-15T08:00:00.000Z', n: '@' };
    sheet.rows.push(newer, older);
    sheet.rows.push([{ v: randomUUID() }, { v: 'gaetan' }, { v: 'Gaetan' }, { v: 'D05' }, { v: 'Echo' }, { v: 42 }, { v: 5 }, { v: 5 }, { v: 5 }, { v: 5 }]);
    expect(b.rows('Responses')).toHaveLength(5);

    const report = b.emu.call('reconcile');
    expect(report).toMatchObject({ checkedRows: 5, duplicateGroups: 1, archived: 2 });
    expect(report.invalidRows).toEqual([{ row: 6, reason: 'q1 is not an integer from 1 to 10' }]);
    const rows = b.rows('Responses');
    expect(rows.filter((r) => r.participant_id === 'paco')).toHaveLength(1);
    expect(rows.find((r) => r.participant_id === 'paco')!.q1_overall_enthusiasm).toBe(9);
    expect(rows.some((r) => r.participant_id === 'gaetan')).toBe(true); // invalid rows are reported, never deleted
    const history = b.rows('History');
    expect(history).toHaveLength(2);
    expect(history.every((h) => h.reason === 'reconcile-duplicate')).toBe(true);
    // The invalid row is ignored by the API.
    expect(b.post('completion', { token: t.paco }).data.totalActive).toBe(2);

    const again = b.emu.call('reconcile');
    expect(again).toMatchObject({ duplicateGroups: 0, archived: 0 });
    expect(b.rows('History')).toHaveLength(2);
  });

  it('a hand-edited individual_score is ignored: scores are recomputed from the answers', () => {
    const b = createTestBackend();
    const t = b.tokens();
    for (const p of PIDS) b.submit(t[p], 'D01', ans(6));
    b.emu.sheet('Responses')!.rows[1][10] = { v: 10, n: '0.00' };
    b.emu.call('rebuildResults');
    expect(b.rows('Results').find((r) => r.destination_id === 'D01')!.score_paco).toBe(6);
    expect(b.post('results', { token: t.paco }).data.destinations.D01.responses[0].individualScore).toBe(6);
  });
});

describe('admin menu', () => {
  it('onOpen installs the Expedition admin menu with existing functions only', () => {
    const b = createTestBackend();
    b.emu.call('onOpen');
    const menu = b.emu.ui.menus[0];
    expect(menu.title).toBe('Expedition admin');
    const fns = menu.items.filter((i) => i.fn).map((i) => i.fn!);
    expect(fns).toEqual(expect.arrayContaining(['menuSetup', 'menuCheckConfiguration', 'menuRebuildResults', 'menuReconcile', 'menuRotateAccessCode']));
    for (const fn of fns) {
      expect(b.emu.functionNames).toContain(fn);
      expect(fn.endsWith('_')).toBe(false);
    }
  });

  it('checkConfiguration lists property names and statuses, never values', () => {
    const b = createTestBackend({ properties: { NOVELTY_DATA: '{"D01":{"newToAll":true,"visitedCount":0,"visitedBy":[],"note":"private"}}' } });
    b.emu.call('setup');
    const report = b.emu.call('checkConfiguration');
    expect(report).toMatchObject({ configured: true, namespace: '', participantsWithCodes: ['alvarinn', 'gaetan', 'paco', 'victor'] });
    expect(report.propertiesSet).toEqual(expect.arrayContaining(['NOVELTY_DATA', 'PARTICIPANT_CREDENTIALS', 'SESSION_SECRET']));
    const text = JSON.stringify(report);
    expect(text).not.toContain(b.emu.getProperty('SESSION_SECRET')!);
    expect(text).not.toContain(b.credentials.paco.hash);
    expect(text).not.toContain('private');
    b.emu.call('menuCheckConfiguration');
    expect(b.emu.ui.alerts.at(-1)!.message).toContain('Configured: yes');
  });

  it('reports missing credentials clearly', () => {
    const b = createTestBackend({ properties: { PARTICIPANT_CREDENTIALS: null } });
    const report = b.emu.call('setup');
    expect(report.configured).toBe(false);
    expect(report.problems.join(' ')).toContain('PARTICIPANT_CREDENTIALS is not set');
    expect(b.post('login', { payload: { participantId: 'paco', accessCode: b.codes.paco } }).error.code).toBe('NOT_CONFIGURED');
  });
});

describe('router and envelope', () => {
  it('rejects malformed requests with BAD_REQUEST / UNKNOWN_ACTION', () => {
    const b = createTestBackend();
    expect(b.emu.doPost('not json').error).toMatchObject({ code: 'BAD_REQUEST', retryable: false });
    expect(b.emu.doPost('').error.code).toBe('BAD_REQUEST');
    expect(b.emu.doPost('[1,2]').error.code).toBe('BAD_REQUEST');
    expect(b.emu.doPost('{}').error.code).toBe('BAD_REQUEST');
    expect(b.emu.doPost(JSON.stringify({ action: 'dropTables' })).error.code).toBe('UNKNOWN_ACTION');
    expect(b.emu.doPost(JSON.stringify({ action: '__proto__' })).error.code).toBe('UNKNOWN_ACTION');
    expect(b.emu.doPost(JSON.stringify({ action: 'me', token: 42 })).error.code).toBe('BAD_REQUEST');
    expect(b.emu.doPost(JSON.stringify({ action: 'login', payload: [1] })).error.code).toBe('BAD_REQUEST');
    expect(b.emu.doPost(JSON.stringify({ action: 'health', pad: 'x'.repeat(20000) })).error.code).toBe('BAD_REQUEST');
  });

  it('every response carries ok + serverTime; errors carry code, message and retryable', () => {
    const b = createTestBackend();
    const ok = b.post('health');
    expect(ok).toEqual({ ok: true, data: expect.any(Object), serverTime: '2027-01-15T10:00:00.000Z' });
    const err = b.post('me');
    expect(err).toEqual({ ok: false, error: { code: 'UNAUTHENTICATED', message: expect.any(String), retryable: false }, serverTime: '2027-01-15T10:00:00.000Z' });
  });

  it('GET serves health only and ignores any token in the query string', () => {
    const b = createTestBackend();
    expect(b.emu.doGet().data.status).toBe('ok');
    expect(b.emu.doGet({ action: 'health' }).data.status).toBe('ok');
    const token = b.login('paco');
    for (const action of ['results', 'myResponses', 'novelty', 'login', 'config']) {
      expect(b.emu.doGet({ action, token }).error.code).toBe('BAD_REQUEST');
    }
  });

  it('maps unexpected internal errors to retryable INTERNAL without leaking details', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    b.emu.call('setup');
    // Simulate an unexpected runtime error in the middle of a write.
    b.emu.hooks.onWrite = () => { throw new TypeError('Cannot read properties of undefined (reading \'q1\')'); };
    const r = b.submit(token, 'D01', ans(5));
    b.emu.hooks.onWrite = null;
    expect(r.error).toEqual({ code: 'INTERNAL', message: 'Unexpected server error; please try again', retryable: true });
  });
});

describe('spreadsheet grid limits', () => {
  it('fits the 26-column Results tab in a new 1000 × 26 tab and grows the grid when rows run out', () => {
    const b = createTestBackend();
    b.emu.call('setup');
    expect(b.emu.sheetValues('Results')[0]).toHaveLength(26);
    const history = b.emu.sheet('History')!;
    history.maxRows = 3; // header + 2 archived versions fill the grid
    const token = b.login('paco');
    for (let i = 1; i <= 5; i++) {
      b.clock.advance(1000);
      expect(b.submit(token, 'D01', ans(i)).ok).toBe(true);
    }
    expect(b.rows('History')).toHaveLength(4);
    expect(history.maxRows).toBeGreaterThanOrEqual(5);
  });

  it('treats a narrow existing tab that cannot hold the header as a mismatch', () => {
    const b = createTestBackend();
    b.emu.call('setup');
    const results = b.emu.sheet('Results')!;
    results.rows[0] = results.rows[0].slice(0, 20);
    results.maxColumns = 20;
    expect(() => b.emu.call('setup')).toThrow(/Tab "Results".*column 21/);
  });
});
