/**
 * The single-file bundle (scripts/bundle-backend.mjs → ExpeditionBackend.gs) is what gets pasted into the Apps
 * Script editor. These tests build it into a temporary folder (backend/dist is git-ignored, so CI never has it),
 * then run ONLY that file through the emulator, following docs/deployment/apps-script.md step by step.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, cpSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BACKEND_SOURCE_FILES, createAppsScriptEmulator, type EmulatorSpreadsheetState } from '../../backend/emulator/index.js';
import { APPS_SCRIPT_DIR, loadBackendSources } from '../../backend/emulator/node.js';
import { PIDS, SPREADSHEET_ID, T0, ans, nodeCredential, randomCode, snapshot, type Json, type Pid } from './helpers';

const SCRIPT = fileURLToPath(new URL('../../scripts/bundle-backend.mjs', import.meta.url));
const ACCESS_CODE_RE = /\b[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){5}\b/g;

const runBundler = (args: string[]) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
const tempDir = (prefix: string) => mkdtempSync(join(tmpdir(), prefix));

/** The real spreadsheet today: a single, empty "Sheet1". */
const realSpreadsheet = (): Record<string, EmulatorSpreadsheetState> => ({
  [SPREADSHEET_ID]: {
    id: SPREADSHEET_ID,
    name: 'The Great Expedition',
    nextSheetId: 1,
    sheets: [{ name: 'Sheet1', sheetId: 0, frozenRows: 0, rows: [] }],
  },
});

let outDir: string;
let bundle: string;
let manifest: string;
let info: Json;

beforeAll(() => {
  outDir = tempDir('ge-bundle-');
  const r = runBundler(['--out', outDir, '--json']);
  if (r.status !== 0) throw new Error(`bundler failed: ${r.stderr}`);
  info = JSON.parse(r.stdout);
  bundle = readFileSync(join(outDir, 'ExpeditionBackend.gs'), 'utf8');
  manifest = readFileSync(join(outDir, 'appsscript.json'), 'utf8');
});

describe('scripts/bundle-backend.mjs', () => {
  it('writes ExpeditionBackend.gs and an identical copy of appsscript.json', () => {
    expect(info.bundlePath).toBe(join(outDir, 'ExpeditionBackend.gs'));
    expect(manifest).toBe(readFileSync(join(APPS_SCRIPT_DIR, 'appsscript.json'), 'utf8'));
    const m = JSON.parse(manifest);
    expect(m).toMatchObject({ runtimeVersion: 'V8', webapp: { executeAs: 'USER_DEPLOYING', access: 'ANYONE_ANONYMOUS' } });
    expect(m.oauthScopes).toEqual([
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/script.container.ui',
    ]);
  });

  it('contains every source file once, in load order, after a header — and is deterministic', () => {
    expect(bundle.startsWith('/**\n * ExpeditionBackend.gs')).toBe(true);
    expect(bundle).toContain(`bundle id ${info.bundleId}`);
    const sections = Array.from(bundle.matchAll(/^\/\/ ([A-Za-z]+\.gs)$/gm), (m) => m[1]);
    expect(sections).toEqual([...BACKEND_SOURCE_FILES]);
    for (const s of loadBackendSources()) {
      expect(bundle.split(s.code.trimEnd()).length - 1, s.name).toBe(1);
    }
    // Pending destinations are announced so the owner knows to re-bundle when research is finished.
    expect(info.destinations.total).toBeGreaterThanOrEqual(20);
    if (info.destinations.pending.length) expect(bundle).toContain(`pending: ${info.destinations.pending.join(', ')}`);

    const again = tempDir('ge-bundle-again-');
    expect(runBundler(['--out', again]).status).toBe(0);
    expect(readFileSync(join(again, 'ExpeditionBackend.gs'), 'utf8')).toBe(bundle);
  });

  it('contains no access codes or credential hashes', () => {
    const codeLike = Array.from(bundle.matchAll(ACCESS_CODE_RE), (m) => m[0]).filter((s) => !/^[X-]+$/.test(s));
    expect(codeLike).toEqual([]);
    expect(bundle).not.toMatch(/"hash"\s*:\s*"[A-Za-z0-9_-]{43}"/);
    expect(bundle).not.toMatch(/SESSION_SECRET\s*[:=]\s*['"][A-Za-z0-9_-]{32,}/);
  });

  it('exposes exactly the same top-level functions as the separate .gs files', () => {
    const single = createAppsScriptEmulator({ sources: [{ name: 'ExpeditionBackend.gs', code: bundle }] });
    const multi = createAppsScriptEmulator({ sources: loadBackendSources() });
    expect([...single.functionNames].sort()).toEqual([...multi.functionNames].sort());
    for (const fn of ['doPost', 'doGet', 'onOpen', 'setup', 'checkConfiguration', 'rebuildResults', 'reconcile',
      'rotateAccessCode', 'rotateSessionSecret', 'revokeSessions', 'revokeAllSessions', 'menuSetup']) {
      expect(single.functionNames, fn).toContain(fn);
    }
  });

  it('refuses unsafe sources (unknown file, duplicate name, top-level call, syntax error, secret) and writes nothing', () => {
    const cases: [string, (dir: string) => void, RegExp][] = [
      ['extra file', (d) => writeFileSync(join(d, 'Extra.gs'), 'function extra() {}\n'), /Extra\.gs is not in the bundle order/],
      ['duplicate', (d) => appendFileSync(join(d, 'Code.gs'), '\nfunction setup() {}\n'), /"setup" is declared in both Setup\.gs and Code\.gs/],
      ['top-level call', (d) => appendFileSync(join(d, 'Code.gs'), '\nvar NOW = new Date();\nlogSomething();\n'), /top-level code calls something/],
      ['order-dependent var', (d) => appendFileSync(join(d, 'Code.gs'), '\nvar LATE = BACKEND_VERSION;\n'), /refers to "BACKEND_VERSION"/],
      ['syntax error', (d) => appendFileSync(join(d, 'Code.gs'), '\nfunction broken( {\n'), /./],
      ['secret', (d) => appendFileSync(join(d, 'Code.gs'), '\n// K7QF-3M9X-ABCD-EFGH-JKMN-PQRS\n'), /looks like an access code/],
      ['credential', (d) => appendFileSync(join(d, 'Auth.gs'), `\n// {"paco":{"salt":"s","hash":"${'a'.repeat(43)}"}}\n`), /credential hash/],
    ];
    for (const [label, mutate, message] of cases) {
      const src = tempDir('ge-bundle-src-');
      cpSync(APPS_SCRIPT_DIR, src, { recursive: true });
      mutate(src);
      const out = join(tempDir('ge-bundle-out-'), 'dist');
      const r = runBundler(['--source', src, '--out', out]);
      expect(r.status, label).toBe(1);
      expect(r.stderr, label).toMatch(/Bundle NOT written/);
      expect(r.stderr, label).toMatch(message);
      expect(existsSync(out), label).toBe(false);
    }
  }, 60_000); // seven bundler processes, each loading the TypeScript parser
});

describe('the bundled file, alone, follows the deployment guide end to end (emulated)', () => {
  it('setup → health → login → submit → replay → revision → blind results → reveal, then switches off TEST_', () => {
    let t = T0;
    const codes = Object.fromEntries(PIDS.map((p) => [p, randomCode()])) as Record<Pid, string>;
    const credentials = Object.fromEntries(PIDS.map((p) => [p, nodeCredential(p, codes[p])]));
    const emu = createAppsScriptEmulator({
      sources: [{ name: 'ExpeditionBackend.gs', code: bundle }],
      now: () => t,
      spreadsheets: realSpreadsheet(),
      // Guide §4–§5: only PARTICIPANT_CREDENTIALS and SHEET_NAMESPACE are typed in; SESSION_SECRET comes from Set up.
      properties: { PARTICIPANT_CREDENTIALS: JSON.stringify(credentials), SHEET_NAMESPACE: 'TEST_' },
    });
    const post = (action: string, extra: Record<string, unknown> = {}): Json => emu.doPost(JSON.stringify({ action, ...extra }));
    const submit = (token: string, destinationId: string, a: ReturnType<typeof ans>, opts: { comments?: string; requestId?: string } = {}): Json =>
      post('submit', {
        token,
        requestId: opts.requestId ?? randomUUID(),
        payload: { destinationId, answers: a, comments: opts.comments ?? '', questionnaireVersion: 'q1', destinationVersion: '1.0.0' },
      });
    const sheet1 = snapshot(emu.sheet('Sheet1'));
    const dataRows = (tab: string) => Math.max(0, emu.sheetValues(tab).length - 1);

    // Before Set up: reachable but not configured.
    expect(emu.doGet({ action: 'health' }).data).toMatchObject({ status: 'ok', configured: false });
    expect(post('login', { payload: { participantId: 'paco', accessCode: codes.paco } }).error.code).toBe('NOT_CONFIGURED');

    // Reloading the spreadsheet installs the menu; every item points at a function in the bundle.
    emu.call('onOpen');
    const menu = emu.ui.menus.at(-1)!;
    expect(menu.title).toBe('Expedition admin');
    for (const item of menu.items) if (item.fn) expect(emu.functionNames, item.fn).toContain(item.fn);

    // Expedition admin › Set up.
    emu.call('menuSetup');
    const alert = emu.ui.alerts.at(-1)!;
    expect(alert.title).toBe('Expedition setup');
    expect(alert.message).toContain('Session secret: created');
    expect(alert.message).toContain('Namespace: TEST_');
    for (const tab of ['TEST_Responses', 'TEST_Results', 'TEST_History', 'TEST_Prompts']) expect(alert.message).toContain(`Tab ${tab}: created`);
    expect(alert.message).toContain('Configuration complete.');
    const secret = emu.getProperty('SESSION_SECRET')!;
    expect(secret.length).toBeGreaterThanOrEqual(32);
    expect(alert.message).not.toContain(secret);
    expect(emu.spreadsheet()!.sheets.map((s) => s.name)).toEqual(['Sheet1', 'TEST_Responses', 'TEST_Results', 'TEST_History', 'TEST_Prompts']);
    expect(emu.sheet('Sheet1')).toEqual(sheet1);

    // Guide §8.1 — health over GET and over POST.
    const health = { status: 'ok', configured: true, questionnaireVersion: 'q1', backendVersion: info.backendVersion };
    expect(emu.doGet({ action: 'health' })).toMatchObject({ ok: true, data: health });
    expect(post('health')).toMatchObject({ ok: true, data: health });

    // Guide §8.2 — login: a wrong code is refused, the right one works for everyone.
    expect(post('login', { payload: { participantId: 'paco', accessCode: randomCode() } }).error.code).toBe('INVALID_CREDENTIALS');
    const tokens = Object.fromEntries(PIDS.map((p) => {
      const r = post('login', { payload: { participantId: p, accessCode: codes[p] } });
      expect(r.ok, p).toBe(true);
      return [p, r.data.token as string];
    })) as Record<Pid, string>;

    // Guide §8.3 — one submission lands in TEST_Responses; a retry with the same requestId writes nothing.
    const requestId = randomUUID();
    const first = submit(tokens.paco, 'D01', ans(7), { comments: '=HYPERLINK("https://evil.example","x")', requestId });
    expect(first.data).toMatchObject({ created: true, idempotentReplay: false, completedCount: 1 });
    expect(first.data.response.destinationName).toBe(emu.call('getDestinationMeta_', 'D01').name);
    expect(dataRows('TEST_Responses')).toBe(1);
    expect(emu.sheet('TEST_Responses')!.rows[1][11]!.f).toBeUndefined(); // the comment stayed inert text
    expect(submit(tokens.paco, 'D01', ans(7), { comments: '=HYPERLINK("https://evil.example","x")', requestId }).data.idempotentReplay).toBe(true);
    expect(dataRows('TEST_Responses')).toBe(1);

    // Blind voting: nobody sees paco's score yet, not even through counts-only endpoints.
    const blind = post('results', { token: tokens.victor }).data;
    expect(blind.destinations.D01).toEqual({ count: 1, revealed: false, responses: [] });
    expect(JSON.stringify(post('completion', { token: tokens.victor }).data)).not.toMatch(/score|answers/);

    // A revision replaces the row in place and archives the old version.
    t += 60_000;
    expect(submit(tokens.paco, 'D01', ans(9), { comments: 'changed my mind' }).data.response.revisionNumber).toBe(2);
    expect(dataRows('TEST_Responses')).toBe(1);
    expect(dataRows('TEST_History')).toBe(1);

    // 4/4 → revealed to everyone; Results tab rebuilt.
    for (const p of ['gaetan', 'alvarinn', 'victor'] as const) expect(submit(tokens[p], 'D01', ans(6)).ok, p).toBe(true);
    const revealed = post('results', { token: tokens.gaetan }).data.destinations.D01;
    expect(revealed.revealed).toBe(true);
    expect(revealed.responses.map((r: Json) => r.individualScore)).toEqual([9, 6, 6, 6]);
    expect(post('completion', { token: tokens.paco }).data.perDestination.D01).toBe(4);
    expect(emu.sheetValues('TEST_Results').find((row) => row[0] === 'D01')![6]).toBe(4);

    // Guide §8.5 — delete SHEET_NAMESPACE, run Set up again: real tabs are created, TEST_ tabs left alone.
    const testTabs = snapshot(['TEST_Responses', 'TEST_Results', 'TEST_History', 'TEST_Prompts'].map((n) => emu.sheet(n)));
    emu.setProperty('SHEET_NAMESPACE', null);
    emu.call('menuSetup');
    expect(emu.ui.alerts.at(-1)!.message).toContain('Session secret: exists');
    expect(emu.ui.alerts.at(-1)!.message).toContain('Tab Responses: created');
    expect(emu.spreadsheet()!.sheets.map((s) => s.name)).toEqual([
      'Sheet1', 'TEST_Responses', 'TEST_Results', 'TEST_History', 'TEST_Prompts', 'Responses', 'Results', 'History', 'Prompts',
    ]);
    expect(post('results', { token: tokens.paco }).data.destinations.D01).toEqual({ count: 0, revealed: false, responses: [] });
    expect(submit(tokens.paco, 'D01', ans(8)).data.created).toBe(true);
    expect(dataRows('Responses')).toBe(1);
    expect(['TEST_Responses', 'TEST_Results', 'TEST_History', 'TEST_Prompts'].map((n) => emu.sheet(n))).toEqual(testTabs);
    expect(emu.sheet('Sheet1')).toEqual(sheet1);

    // Nothing sensitive was logged along the way.
    const logs = JSON.stringify(emu.logs);
    expect(logs).not.toContain(secret);
    for (const p of PIDS) {
      expect(logs).not.toContain(codes[p]);
      expect(logs).not.toContain(tokens[p].split('.')[6]);
    }
  });
});
