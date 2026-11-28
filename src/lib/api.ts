/**
 * Typed client for the Apps Script backend (contract: docs/architecture/api-contract.md).
 *
 *  - Live mode (`createApiClient({ url })`): POST text/plain JSON to the /exec URL (a CORS simple request: no
 *    preflight, no custom headers, no cookies). The token travels in the body, never in the URL.
 *  - Demo mode (`createDemoClient()`): the SAME .gs sources run in the browser through backend/emulator, with state
 *    persisted in localStorage (`ge-demo-backend-v1`). Demo access codes are fictitious; there is no novelty data.
 */
import type { Answers, ParticipantId } from './statistics';
import type { AppsScriptEmulator, EmulatorState, EmulatorStorage } from '../../backend/emulator/index.js';

export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNKNOWN_ACTION'
  | 'NOT_CONFIGURED'
  | 'INVALID_CREDENTIALS'
  | 'RATE_LIMITED'
  | 'UNAUTHENTICATED'
  | 'SESSION_EXPIRED'
  | 'FORBIDDEN'
  | 'VALIDATION_FAILED'
  | 'LOCK_TIMEOUT'
  | 'SHEET_ERROR'
  | 'INTERNAL'
  | 'NETWORK'
  | 'TIMEOUT';

const ERROR_CODES: readonly ApiErrorCode[] = [
  'BAD_REQUEST', 'UNKNOWN_ACTION', 'NOT_CONFIGURED', 'INVALID_CREDENTIALS', 'RATE_LIMITED', 'UNAUTHENTICATED',
  'SESSION_EXPIRED', 'FORBIDDEN', 'VALIDATION_FAILED', 'LOCK_TIMEOUT', 'SHEET_ERROR', 'INTERNAL', 'NETWORK', 'TIMEOUT',
];
const RETRYABLE_BY_DEFAULT: readonly ApiErrorCode[] = ['LOCK_TIMEOUT', 'SHEET_ERROR', 'INTERNAL', 'NETWORK', 'TIMEOUT'];

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly retryable: boolean;
  constructor(code: ApiErrorCode, message: string, retryable: boolean = RETRYABLE_BY_DEFAULT.includes(code)) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.retryable = retryable;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Contract types                                                                                                */
/* ------------------------------------------------------------------------------------------------------------ */

export type { Answers, ParticipantId };
export type RevealPolicy = 'per-destination-complete' | 'all-complete' | 'always' | 'admin-only';
export type CommentsVisibility = 'after-reveal' | 'author-only';

export interface Participant { id: ParticipantId; name: string }
export interface Session { token: string; participant: Participant; expiresAt: string }
export interface HealthData { status: 'ok'; configured: boolean; questionnaireVersion: string; backendVersion: string }
export interface PublicConfig {
  questionnaireVersion: string;
  blindVoting: boolean;
  revealPolicy: RevealPolicy;
  commentsVisibility: CommentsVisibility;
  sessionHours: number;
  participants: Participant[];
  destinationIds: string[];
  backendVersion: string;
}
export interface EvaluationRecord {
  responseId: string;
  participantId: ParticipantId;
  participantName: string;
  destinationId: string;
  destinationName: string;
  answers: Answers;
  /** Unrounded mean of the five answers, computed server-side. */
  individualScore: number;
  comments: string;
  createdAt: string;
  updatedAt: string;
  questionnaireVersion: string;
  destinationVersion: string;
  /** 1 = first submission. */
  revisionNumber: number;
}
export interface Completion {
  totalActive: number;
  /** participants × destinations accepted by the backend */
  maxActive: number;
  perParticipant: Record<ParticipantId, number>;
  perDestination: Record<string, number>;
  fullyEvaluated: number;
}
export interface RevealedResponse {
  participantId: ParticipantId;
  participantName: string;
  answers: Answers;
  individualScore: number;
  /** null when comments are not visible to the caller. */
  comments: string | null;
  updatedAt: string;
}
export interface ResultsPayload {
  policy: RevealPolicy;
  blindVoting: boolean;
  destinations: Record<string, {
    /** Active evaluations (0–4). */
    count: number;
    /** true → responses contains all participants' responses. */
    revealed: boolean;
    /** Empty when not revealed (the caller's own response is in myResponses). */
    responses: RevealedResponse[];
  }>;
}
export interface NoveltyEntry { newToAll: boolean; visitedCount: number; visitedBy: ParticipantId[]; note: string }
export interface SubmitInput {
  destinationId: string;
  answers: Answers;
  comments: string;
  questionnaireVersion: string;
  destinationVersion: string;
}
export interface SubmitResult { response: EvaluationRecord; created: boolean; idempotentReplay: boolean; completedCount: number }
export interface MeData { participant: Participant; expiresAt: string; completedCount: number }

export interface ApiClient {
  readonly mode: 'live' | 'demo';
  health(): Promise<HealthData>;
  config(): Promise<PublicConfig>;
  login(participantId: ParticipantId, accessCode: string): Promise<Session>;
  logout(token: string): Promise<void>;
  me(token: string): Promise<MeData>;
  myResponses(token: string): Promise<EvaluationRecord[]>;
  /** Reuse the same requestId when retrying the same submission: the server applies it at most once. */
  submit(token: string, input: SubmitInput, requestId: string): Promise<SubmitResult>;
  completion(token: string): Promise<Completion>;
  results(token: string): Promise<ResultsPayload>;
  /** Unwraps data.destinations. Always {} in demo mode. */
  novelty(token: string): Promise<Record<string, NoveltyEntry>>;
  /** Propose a destination to be researched (idempotent on requestId). */
  submitPrompt(token: string, prompt: string, requestId: string): Promise<{ prompt: PromptRecord; idempotentReplay: boolean }>;
  /** Every proposal from the group, newest first. */
  prompts(token: string): Promise<PromptRecord[]>;
}

export interface PromptRecord {
  promptId: string;
  participantId: ParticipantId;
  participantName: string;
  prompt: string;
  createdAt: string;
  status: 'new' | 'processing' | 'done' | 'declined';
  updatedAt: string;
  destinationId: string | null;
  note: string;
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Envelope handling                                                                                             */
/* ------------------------------------------------------------------------------------------------------------ */

type Action = 'health' | 'config' | 'login' | 'logout' | 'me' | 'myResponses' | 'submit' | 'completion' | 'results' | 'novelty' | 'submitPrompt' | 'prompts';

interface RequestEnvelope {
  action: Action;
  token?: string;
  requestId?: string;
  payload?: Record<string, unknown>;
}

type Transport = (envelope: RequestEnvelope) => Promise<unknown>;

function unwrap<T>(body: unknown): T {
  if (!body || typeof body !== 'object' || typeof (body as { ok?: unknown }).ok !== 'boolean') {
    throw new ApiError('INTERNAL', 'The server returned an unexpected response.', true);
  }
  const b = body as { ok: boolean; data?: unknown; error?: { code?: unknown; message?: unknown; retryable?: unknown } };
  if (b.ok) return b.data as T;
  const rawCode = b.error && typeof b.error.code === 'string' ? b.error.code : 'INTERNAL';
  const code = (ERROR_CODES as readonly string[]).includes(rawCode) ? (rawCode as ApiErrorCode) : 'INTERNAL';
  const message = b.error && typeof b.error.message === 'string' ? b.error.message : 'The request failed.';
  const retryable = b.error && typeof b.error.retryable === 'boolean' ? b.error.retryable : RETRYABLE_BY_DEFAULT.includes(code);
  throw new ApiError(code, message, retryable);
}

function buildClient(mode: 'live' | 'demo', transport: Transport): ApiClient {
  const call = async <T>(envelope: RequestEnvelope): Promise<T> => unwrap<T>(await transport(envelope));
  return {
    mode,
    health: () => call<HealthData>({ action: 'health' }),
    config: () => call<PublicConfig>({ action: 'config' }),
    login: (participantId, accessCode) => call<Session>({ action: 'login', payload: { participantId, accessCode } }),
    logout: async (token) => {
      await call<{ loggedOut: true }>({ action: 'logout', token });
    },
    me: (token) => call<MeData>({ action: 'me', token }),
    myResponses: async (token) => (await call<{ responses: EvaluationRecord[] }>({ action: 'myResponses', token })).responses,
    submit: (token, input, requestId) =>
      call<SubmitResult>({
        action: 'submit',
        token,
        requestId,
        payload: {
          destinationId: input.destinationId,
          answers: { q1: input.answers.q1, q2: input.answers.q2, q3: input.answers.q3, q4: input.answers.q4, q5: input.answers.q5 },
          comments: input.comments,
          questionnaireVersion: input.questionnaireVersion,
          destinationVersion: input.destinationVersion,
        },
      }),
    completion: (token) => call<Completion>({ action: 'completion', token }),
    results: (token) => call<ResultsPayload>({ action: 'results', token }),
    novelty: async (token) =>
      (await call<{ destinations: Record<string, NoveltyEntry> }>({ action: 'novelty', token })).destinations ?? {},
    submitPrompt: (token, prompt, requestId) =>
      call<{ prompt: PromptRecord; idempotentReplay: boolean }>({ action: 'submitPrompt', token, requestId, payload: { prompt } }),
    prompts: async (token) => (await call<{ prompts: PromptRecord[] }>({ action: 'prompts', token })).prompts ?? [],
  };
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Live mode                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------ */

export const DEFAULT_TIMEOUT_MS = 25_000;

export function createApiClient(opts: { url: string; timeoutMs?: number; fetchImpl?: typeof fetch }): ApiClient {
  const url = opts.url;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!/^https:\/\//.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url)) {
    throw new Error('createApiClient: url must be the https:// …/exec URL of the Apps Script deployment');
  }
  if (/[?#]/.test(url)) throw new Error('createApiClient: url must not contain a query string or fragment');

  const transport: Transport = async (envelope) => {
    const doFetch = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const failed = (): ApiError =>
      controller.signal.aborted
        ? new ApiError('TIMEOUT', 'The server took too long to answer. Please try again.', true)
        : new ApiError('NETWORK', 'Could not reach the server. Check your connection and try again.', true);
    let text: string;
    let status: number;
    try {
      const res = await doFetch(url, {
        method: 'POST',
        // text/plain keeps this a CORS simple request: no preflight (Apps Script cannot answer OPTIONS).
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(envelope),
        redirect: 'follow',
        credentials: 'omit',
        signal: controller.signal,
      });
      status = res.status;
      text = await res.text();
    } catch {
      throw failed();
    } finally {
      clearTimeout(timer);
    }
    if (status < 200 || status >= 300) {
      throw new ApiError('INTERNAL', `The server answered with HTTP ${status}. Please try again later.`, true);
    }
    try {
      return JSON.parse(text);
    } catch {
      // Typically an HTML page: a Google sign-in page (deployment access is not "Anyone") or an error page.
      throw new ApiError('INTERNAL', 'The server returned an unexpected (non-JSON) response.', true);
    }
  };
  return buildClient('live', transport);
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Demo mode                                                                                                     */
/* ------------------------------------------------------------------------------------------------------------ */

export const DEMO_STORAGE_KEY = 'ge-demo-backend-v1';

/** Fictitious codes, shown on the sign-in screen in demo mode only. They protect nothing. */
export const DEMO_ACCESS_CODES: Record<ParticipantId, string> = {
  paco: 'DEMO-PACO-2027',
  gaetan: 'DEMO-GAETAN-2027',
  alvarinn: 'DEMO-ALVARINN-2027',
  victor: 'DEMO-VICTOR-2027',
};

/** Fixture secret for the in-browser emulator only (it never reaches Apps Script). */
const DEMO_SESSION_SECRET = 'demo-only-session-secret-not-used-by-the-real-backend-2027';

function localStorageAdapter(): EmulatorStorage | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    ls.getItem(DEMO_STORAGE_KEY);
    return {
      load: () => {
        const raw = ls.getItem(DEMO_STORAGE_KEY);
        return raw ? (JSON.parse(raw) as EmulatorState) : null;
      },
      save: (state) => ls.setItem(DEMO_STORAGE_KEY, JSON.stringify(state)),
    };
  } catch {
    return null;
  }
}

async function loadBackendSources(): Promise<{ name: string; code: string }[]> {
  const mods = await Promise.all([
    import('../../backend/apps-script/Configuration.gs?raw'),
    import('../../backend/apps-script/Destinations.gs?raw'),
    import('../../backend/apps-script/Validation.gs?raw'),
    import('../../backend/apps-script/Auth.gs?raw'),
    import('../../backend/apps-script/Setup.gs?raw'),
    import('../../backend/apps-script/Responses.gs?raw'),
    import('../../backend/apps-script/Results.gs?raw'),
    import('../../backend/apps-script/Prompts.gs?raw'),
    import('../../backend/apps-script/Code.gs?raw'),
  ]);
  const names = ['Configuration.gs', 'Destinations.gs', 'Validation.gs', 'Auth.gs', 'Setup.gs', 'Responses.gs', 'Results.gs', 'Prompts.gs', 'Code.gs'];
  return mods.map((m, i) => ({ name: names[i], code: m.default }));
}

async function startDemoBackend(storage: EmulatorStorage | null): Promise<AppsScriptEmulator> {
  const [{ createAppsScriptEmulator }, sources] = await Promise.all([import('../../backend/emulator/index.js'), loadBackendSources()]);
  const emu = createAppsScriptEmulator({ sources, storage, properties: { SESSION_SECRET: DEMO_SESSION_SECRET } });
  if (!emu.getProperty('PARTICIPANT_CREDENTIALS')) {
    const credentials: Record<string, unknown> = {};
    for (const id of Object.keys(DEMO_ACCESS_CODES) as ParticipantId[]) {
      // Hashed by the real Auth.gs code, so the demo exercises exactly the production verification path.
      credentials[id] = emu.call('buildCredential_', id, DEMO_ACCESS_CODES[id], `demo-salt-${id}-2027`);
    }
    emu.setProperty('PARTICIPANT_CREDENTIALS', JSON.stringify(credentials));
  }
  if (!emu.sheet('Responses')) emu.call('setup');
  return emu;
}

let sharedDemo: Promise<AppsScriptEmulator> | null = null;

/** Clears the demo localStorage state; the next demo call starts from an empty spreadsheet. */
export function resetDemoBackend(): void {
  sharedDemo = null;
  try {
    globalThis.localStorage?.removeItem(DEMO_STORAGE_KEY);
  } catch {
    // storage unavailable: nothing persisted
  }
}

/**
 * Demo client. Lazily loads the emulator and the .gs sources on the first call.
 * Options are for tests: `storage: null` = in-memory only (isolated instance); `latencyMs` simulates the network.
 */
export function createDemoClient(opts: { storage?: EmulatorStorage | null; latencyMs?: number } = {}): ApiClient {
  const latencyMs = opts.latencyMs ?? 150;
  let own: Promise<AppsScriptEmulator> | null = null;
  const getBackend = (): Promise<AppsScriptEmulator> => {
    if (opts.storage !== undefined) return (own ??= startDemoBackend(opts.storage));
    return (sharedDemo ??= startDemoBackend(localStorageAdapter()));
  };
  const transport: Transport = async (envelope) => {
    let emu: AppsScriptEmulator;
    try {
      emu = await getBackend();
    } catch {
      throw new ApiError('INTERNAL', 'The demo backend could not be started.', false);
    }
    if (latencyMs > 0) await new Promise((r) => setTimeout(r, latencyMs));
    try {
      // Round-trip through JSON exactly like the network would.
      return emu.doPost(JSON.stringify(envelope));
    } catch {
      throw new ApiError('INTERNAL', 'The demo backend failed unexpectedly.', true);
    }
  };
  return buildClient('demo', transport);
}

/** Live client when an Apps Script URL is configured, demo client otherwise. */
export function createBackendClient(appsScriptUrl: string | null | undefined): ApiClient {
  return appsScriptUrl && appsScriptUrl.trim() ? createApiClient({ url: appsScriptUrl.trim() }) : createDemoClient();
}

/* ------------------------------------------------------------------------------------------------------------ */
/* Request ids                                                                                                   */
/* ------------------------------------------------------------------------------------------------------------ */

/** UUID v4 for `submit` idempotency (crypto.randomUUID, with a getRandomValues fallback for older Safari). */
export function newRequestId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
