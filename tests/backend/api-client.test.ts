import { describe, expect, it } from 'vitest';
import { ApiError, createApiClient, createDemoClient, DEMO_ACCESS_CODES, newRequestId, resetDemoBackend } from '../../src/lib/api';
import type { EmulatorState, EmulatorStorage } from '../../backend/emulator/index.js';
import { createTestBackend, ans } from './helpers';

const URL_EXEC = 'https://script.google.com/macros/s/AKfycbTEST/exec';
const ok = (data: unknown) => new Response(JSON.stringify({ ok: true, data, serverTime: '2027-01-01T00:00:00.000Z' }), { status: 200 });

describe('live client transport', () => {
  it('sends a CORS simple request: POST, text/plain, token in the body, no custom headers, no cookies', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchImpl = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return ok({ participant: { id: 'paco', name: 'Paco' }, expiresAt: 'x', completedCount: 0 });
    }) as unknown as typeof fetch;
    const api = createApiClient({ url: URL_EXEC, fetchImpl });
    expect(api.mode).toBe('live');
    await api.me('tok.en');
    const { url, init } = calls[0];
    expect(url).toBe(URL_EXEC);
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'text/plain;charset=utf-8' });
    expect(init.redirect).toBe('follow');
    expect(init.credentials).toBe('omit');
    expect((init as { mode?: string }).mode).toBeUndefined(); // never 'no-cors'
    expect(JSON.parse(init.body as string)).toEqual({ action: 'me', token: 'tok.en' });
  });

  it('submit carries requestId in the envelope and only the contract fields in the payload', async () => {
    let body: Record<string, unknown> = {};
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return ok({ response: {}, created: true, idempotentReplay: false, completedCount: 1 });
    }) as unknown as typeof fetch;
    const api = createApiClient({ url: URL_EXEC, fetchImpl });
    const requestId = newRequestId();
    const input = { destinationId: 'D01', answers: ans(7), comments: 'hi', questionnaireVersion: 'q1', destinationVersion: '1.0.0', participantId: 'victor' };
    await api.submit('t', input, requestId);
    expect(body).toEqual({
      action: 'submit', token: 't', requestId,
      payload: { destinationId: 'D01', answers: ans(7), comments: 'hi', questionnaireVersion: 'q1', destinationVersion: '1.0.0' },
    });
  });

  it('maps server error envelopes to ApiError with code and retryable', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ ok: false, error: { code: 'LOCK_TIMEOUT', message: 'busy', retryable: true } }))) as unknown as typeof fetch;
    const api = createApiClient({ url: URL_EXEC, fetchImpl });
    const err = await api.results('t').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'LOCK_TIMEOUT', message: 'busy', retryable: true });
  });

  it('NETWORK on fetch failure, TIMEOUT after timeoutMs, INTERNAL on HTML / HTTP errors', async () => {
    const failing = createApiClient({ url: URL_EXEC, fetchImpl: (async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch });
    await expect(failing.health()).rejects.toMatchObject({ code: 'NETWORK', retryable: true });

    const hanging = createApiClient({
      url: URL_EXEC,
      timeoutMs: 30,
      fetchImpl: ((_u: string, init: RequestInit) => new Promise((_res, rej) => {
        init.signal!.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError')));
      })) as unknown as typeof fetch,
    });
    await expect(hanging.health()).rejects.toMatchObject({ code: 'TIMEOUT', retryable: true });

    const html = createApiClient({ url: URL_EXEC, fetchImpl: (async () => new Response('<html>Sign in</html>', { status: 200 })) as unknown as typeof fetch });
    await expect(html.health()).rejects.toMatchObject({ code: 'INTERNAL', retryable: true });

    const http500 = createApiClient({ url: URL_EXEC, fetchImpl: (async () => new Response('oops', { status: 500 })) as unknown as typeof fetch });
    await expect(http500.health()).rejects.toMatchObject({ code: 'INTERNAL' });
  });

  it('refuses URLs with query strings (tokens must never travel in URLs)', () => {
    expect(() => createApiClient({ url: `${URL_EXEC}?token=abc` })).toThrow();
    expect(() => createApiClient({ url: 'http://example.com/exec' })).toThrow();
  });
});

describe('live client against the real .gs code (emulated)', () => {
  it('login → submit → myResponses → completion → results → novelty → logout', async () => {
    const b = createTestBackend();
    const fetchImpl = (async (_u: string, init: RequestInit) => new Response(JSON.stringify(b.emu.doPost(init.body as string)))) as unknown as typeof fetch;
    const api = createApiClient({ url: URL_EXEC, fetchImpl });
    const health = await api.health();
    expect(health).toMatchObject({ status: 'ok', configured: true });
    const session = await api.login('paco', b.codes.paco);
    expect(session.participant).toEqual({ id: 'paco', name: 'Paco' });
    const requestId = newRequestId();
    const res = await api.submit(session.token, { destinationId: 'D01', answers: ans(8), comments: '', questionnaireVersion: 'q1', destinationVersion: '1.0.0' }, requestId);
    expect(res).toMatchObject({ created: true, idempotentReplay: false, completedCount: 1 });
    const replay = await api.submit(session.token, { destinationId: 'D01', answers: ans(8), comments: '', questionnaireVersion: 'q1', destinationVersion: '1.0.0' }, requestId);
    expect(replay.idempotentReplay).toBe(true);
    expect(await api.myResponses(session.token)).toHaveLength(1);
    expect((await api.completion(session.token)).totalActive).toBe(1);
    expect((await api.results(session.token)).destinations.D01).toEqual({ count: 1, revealed: false, responses: [] });
    expect(await api.novelty(session.token)).toEqual({});
    await expect(api.logout(session.token)).resolves.toBeUndefined();
    await expect(api.me(session.token)).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(api.login('paco', 'WRONG')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', retryable: false });
  });
});

describe('demo client (same .gs sources loaded with Vite ?raw)', () => {
  function memoryStorage(): EmulatorStorage & { saved: EmulatorState | null } {
    const s = {
      saved: null as EmulatorState | null,
      load: () => (s.saved ? JSON.parse(JSON.stringify(s.saved)) : null),
      save: (state: EmulatorState) => { s.saved = JSON.parse(JSON.stringify(state)); },
    };
    return s;
  }

  it('works end to end with the fictitious demo codes and persists through its storage', async () => {
    const storage = memoryStorage();
    const demo = createDemoClient({ storage, latencyMs: 0 });
    expect(demo.mode).toBe('demo');
    const cfg = await demo.config();
    expect(cfg.destinationIds).toHaveLength(20);
    expect((await demo.health()).configured).toBe(true);
    await expect(demo.login('paco', 'DEMO-GAETAN-2027')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    const session = await demo.login('paco', DEMO_ACCESS_CODES.paco);
    // D20 is accepted even if its research file does not exist yet (pending entry in Destinations.gs).
    const r = await demo.submit(session.token, { destinationId: 'D20', answers: ans(9), comments: 'demo', questionnaireVersion: cfg.questionnaireVersion, destinationVersion: '1.0.0' }, newRequestId());
    expect(r.created).toBe(true);
    expect(await demo.novelty(session.token)).toEqual({});
    expect(storage.saved!.spreadsheets).toBeTruthy();
    expect(JSON.stringify(storage.saved)).not.toContain(DEMO_ACCESS_CODES.paco);

    // A fresh client over the same storage (≈ page reload) sees the evaluation and the session.
    const reloaded = createDemoClient({ storage, latencyMs: 0 });
    expect(await reloaded.myResponses(session.token)).toHaveLength(1);
  });

  it('resetDemoBackend is safe without localStorage', () => {
    expect(() => resetDemoBackend()).not.toThrow();
  });
});

describe('newRequestId', () => {
  it('returns RFC 4122 v4 UUIDs', () => {
    const ids = new Set(Array.from({ length: 100 }, newRequestId));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});
