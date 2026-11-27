/**
 * Test harness: runs the real backend/apps-script/*.gs sources through backend/emulator in Node.
 * Credentials are produced with node:crypto (an implementation independent of Auth.gs), so a login that succeeds
 * proves the stored-hash format and the server verification agree.
 */
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createAppsScriptEmulator, type AppsScriptEmulator, type EmulatorSpreadsheetState } from '../../backend/emulator/index.js';
import { loadBackendSources } from '../../backend/emulator/node.js';

export const PIDS = ['paco', 'gaetan', 'alvarinn', 'victor'] as const;
export type Pid = (typeof PIDS)[number];
export const SPREADSHEET_ID = '1uOCUsJwmmxZY1sQr4bMyh47uRAgnvp9wQfoHC-l4_Hg';
export const T0 = Date.parse('2027-01-15T10:00:00.000Z');
export const TEST_SECRET = 'test-session-secret-0123456789-abcdefghijklmnop';

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

export function randomCode(): string {
  const bytes = randomBytes(15);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  return out.match(/.{4}/g)!.join('-');
}

export function nodeCredential(pid: string, code: string, salt = randomBytes(16).toString('base64url')) {
  const normalized = code.toUpperCase().replace(/[\s\-_.]+/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return { salt, hash: createHmac('sha256', salt).update(`ge-access-v1:${pid}:${normalized}`).digest('base64url') };
}

export interface RegistryEntry {
  name: string;
  title: string | null;
  version: string | null;
  securityStatus: 'eligible' | 'conditional' | 'excluded' | null;
  realisticTotalEUR: number | null;
  budgetStatus: string | null;
  materialUncertainty: boolean | null;
  pending: boolean;
}

const entry = (name: string, securityStatus: RegistryEntry['securityStatus'], total: number | null, materialUncertainty = false): RegistryEntry => ({
  name, title: `${name} expedition`, version: '1.0.0', securityStatus, realisticTotalEUR: total,
  budgetStatus: total === null ? null : total > 2500 ? 'outside-budget' : total > 2000 ? 'exceptional' : 'within-preferred',
  materialUncertainty, pending: false,
});

/** Small fixed registry so tests do not depend on research files that are still being written. */
export const TEST_REGISTRY: Record<string, RegistryEntry> = {
  D01: entry('Alpha', 'eligible', 1800),
  D02: entry('Bravo', 'excluded', 1200),
  D03: entry('Charlie', 'eligible', 2600),
  D04: entry('Delta', 'eligible', 1900, true),
  D05: entry('Echo', 'eligible', 2500),
  D06: entry('Foxtrot', 'conditional', 1500),
  D07: { name: 'Golf', title: null, version: null, securityStatus: null, realisticTotalEUR: null, budgetStatus: null, materialUncertainty: null, pending: true },
};

export interface TestBackendOptions {
  properties?: Record<string, string | null>;
  /** 'real' = the generated Destinations.gs; default TEST_REGISTRY. */
  registry?: Record<string, RegistryEntry> | 'real';
  spreadsheets?: Record<string, EmulatorSpreadsheetState>;
  credentials?: Record<string, { salt: string; hash: string }>;
}

export type Answers = { q1: number; q2: number; q3: number; q4: number; q5: number };
export const ans = (q1: number, q2 = q1, q3 = q1, q4 = q1, q5 = q1): Answers => ({ q1, q2, q3, q4, q5 });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Json = any;

export function createTestBackend(opts: TestBackendOptions = {}) {
  const codes = Object.fromEntries(PIDS.map((p) => [p, randomCode()])) as Record<Pid, string>;
  const credentials = opts.credentials ?? Object.fromEntries(PIDS.map((p) => [p, nodeCredential(p, codes[p])]));
  let t = T0;
  const clock = {
    now: () => t,
    advance: (ms: number) => { t += ms; },
    set: (ms: number) => { t = ms; },
  };
  const sources = loadBackendSources();
  if (opts.registry !== 'real') {
    sources.push({ name: 'TestRegistry.gs', code: `DESTINATION_REGISTRY = ${JSON.stringify(opts.registry ?? TEST_REGISTRY)};` });
  }
  const emu: AppsScriptEmulator = createAppsScriptEmulator({
    sources,
    now: clock.now,
    spreadsheets: opts.spreadsheets,
    properties: {
      SESSION_SECRET: TEST_SECRET,
      PARTICIPANT_CREDENTIALS: JSON.stringify(credentials),
      ...opts.properties,
    },
  });

  const post = (action: string, extra: { token?: string; payload?: unknown; requestId?: string } = {}): Json =>
    emu.doPost(JSON.stringify({ action, ...extra }));

  const login = (pid: Pid): string => {
    const r = post('login', { payload: { participantId: pid, accessCode: codes[pid] } });
    if (!r.ok) throw new Error(`login failed for ${pid}: ${JSON.stringify(r.error)}`);
    return r.data.token as string;
  };

  const submit = (
    token: string,
    destinationId: string,
    answers: Partial<Answers> | Record<string, unknown>,
    extra: { comments?: unknown; requestId?: string; questionnaireVersion?: unknown; destinationVersion?: unknown; participantId?: unknown } = {},
  ): Json => {
    const payload: Record<string, unknown> = {
      destinationId,
      answers,
      comments: extra.comments ?? '',
      questionnaireVersion: extra.questionnaireVersion ?? 'q1',
      destinationVersion: extra.destinationVersion ?? '1.0.0',
    };
    if (extra.participantId !== undefined) payload.participantId = extra.participantId;
    return post('submit', { token, requestId: extra.requestId ?? randomUUID(), payload });
  };

  /** Data rows of a tab (header excluded) as objects keyed by header. */
  const rows = (tab: string): Record<string, unknown>[] => {
    const values = emu.sheetValues(tab);
    if (values.length < 2) return [];
    const header = values[0] as string[];
    return values.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
  };

  const tokens = (): Record<Pid, string> => Object.fromEntries(PIDS.map((p) => [p, login(p)])) as Record<Pid, string>;

  return { emu, codes, credentials, clock, post, login, submit, rows, tokens };
}

export function snapshot<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
