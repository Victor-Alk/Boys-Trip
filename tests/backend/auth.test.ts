import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createTestBackend, PIDS, TEST_SECRET, ans, type Pid } from './helpers';

const HOUR = 3600 * 1000;
const CODE_FORMAT = /^([0-9A-HJKMNP-TV-Z]{4}-){5}[0-9A-HJKMNP-TV-Z]{4}$/;

describe('health and config', () => {
  it('reports configured and exposes no secrets', () => {
    const b = createTestBackend();
    const health = b.emu.doGet({ action: 'health' });
    expect(health).toMatchObject({ ok: true, data: { status: 'ok', configured: true, questionnaireVersion: 'q1', backendVersion: '1.0.0' } });
    const cfg = b.post('config');
    expect(cfg.ok).toBe(true);
    expect(cfg.data).toMatchObject({
      questionnaireVersion: 'q1', blindVoting: true, revealPolicy: 'per-destination-complete', commentsVisibility: 'after-reveal', sessionHours: 168,
    });
    expect(cfg.data.participants).toEqual([
      { id: 'paco', name: 'Paco' }, { id: 'gaetan', name: 'Gaetan' }, { id: 'alvarinn', name: 'Alvarinn' }, { id: 'victor', name: 'Victor' },
    ]);
    const text = JSON.stringify([health, cfg]);
    expect(text).not.toContain(TEST_SECRET);
    for (const p of PIDS) expect(text).not.toContain(b.credentials[p].hash);
  });

  it('is NOT_CONFIGURED without SESSION_SECRET until setup generates one', () => {
    const b = createTestBackend({ properties: { SESSION_SECRET: null } });
    expect(b.emu.doGet().data.configured).toBe(false);
    const r = b.post('login', { payload: { participantId: 'paco', accessCode: b.codes.paco } });
    expect(r.error).toMatchObject({ code: 'NOT_CONFIGURED', retryable: false });
    expect(b.emu.call('generateSessionSecret')).toBe('created');
    expect(b.emu.call('generateSessionSecret')).toBe('exists');
    expect(b.emu.getProperty('SESSION_SECRET')!.length).toBeGreaterThanOrEqual(43);
    expect(b.emu.doGet().data.configured).toBe(true);
    expect(b.post('login', { payload: { participantId: 'paco', accessCode: b.codes.paco } }).ok).toBe(true);
  });
});

describe('login', () => {
  it('accepts the right code (case, spaces and Crockford look-alikes tolerated)', () => {
    const b = createTestBackend();
    const r = b.post('login', { payload: { participantId: 'paco', accessCode: b.codes.paco } });
    expect(r.ok).toBe(true);
    expect(r.data.participant).toEqual({ id: 'paco', name: 'Paco' });
    expect(Date.parse(r.data.expiresAt) - b.clock.now()).toBeGreaterThan(167 * HOUR);
    const sloppy = b.codes.gaetan.toLowerCase().replace(/-/g, ' ').replace(/0/g, 'o').replace(/1/g, 'l');
    expect(b.post('login', { payload: { participantId: 'gaetan', accessCode: sloppy } }).ok).toBe(true);
  });

  it('rejects a wrong code, another participant’s code and an unknown participant', () => {
    const b = createTestBackend();
    const wrong = b.post('login', { payload: { participantId: 'paco', accessCode: 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF' } });
    expect(wrong).toMatchObject({ ok: false, error: { code: 'INVALID_CREDENTIALS', retryable: false } });
    expect(b.post('login', { payload: { participantId: 'paco', accessCode: b.codes.victor } }).error.code).toBe('INVALID_CREDENTIALS');
    expect(b.post('login', { payload: { participantId: 'mallory', accessCode: b.codes.victor } }).error.code).toBe('INVALID_CREDENTIALS');
    expect(b.post('login', { payload: { participantId: 'paco' } }).error.code).toBe('BAD_REQUEST');
  });

  it('locks a participant out after 5 failures, even for the right code, then recovers after 15 minutes', () => {
    const b = createTestBackend();
    for (let i = 0; i < 5; i++) {
      expect(b.post('login', { payload: { participantId: 'paco', accessCode: `WRONG-${i}` } }).error.code).toBe('INVALID_CREDENTIALS');
    }
    const locked = b.post('login', { payload: { participantId: 'paco', accessCode: b.codes.paco } });
    expect(locked.error).toMatchObject({ code: 'RATE_LIMITED', retryable: false });
    // Other participants are not affected by one participant's lockout.
    expect(b.post('login', { payload: { participantId: 'victor', accessCode: b.codes.victor } }).ok).toBe(true);
    b.clock.advance(15 * 60 * 1000 + 1000);
    expect(b.post('login', { payload: { participantId: 'paco', accessCode: b.codes.paco } }).ok).toBe(true);
  });

  it('a successful login resets the participant failure counter', () => {
    const b = createTestBackend();
    for (let i = 0; i < 4; i++) b.post('login', { payload: { participantId: 'paco', accessCode: 'nope' } });
    expect(b.post('login', { payload: { participantId: 'paco', accessCode: b.codes.paco } }).ok).toBe(true);
    for (let i = 0; i < 4; i++) b.post('login', { payload: { participantId: 'paco', accessCode: 'nope' } });
    expect(b.post('login', { payload: { participantId: 'paco', accessCode: b.codes.paco } }).ok).toBe(true);
  });

  it('applies a global lockout after 25 failures across participant ids', () => {
    const b = createTestBackend();
    for (let i = 0; i < 25; i++) b.post('login', { payload: { participantId: `ghost${i}`, accessCode: 'nope' } });
    expect(b.post('login', { payload: { participantId: 'alvarinn', accessCode: b.codes.alvarinn } }).error.code).toBe('RATE_LIMITED');
    b.clock.advance(15 * 60 * 1000 + 1000);
    expect(b.post('login', { payload: { participantId: 'alvarinn', accessCode: b.codes.alvarinn } }).ok).toBe(true);
  });
});

describe('session tokens', () => {
  it('requires a token for private actions', () => {
    const b = createTestBackend();
    for (const action of ['me', 'myResponses', 'submit', 'completion', 'results', 'novelty', 'logout']) {
      expect(b.post(action).error.code, action).toBe('UNAUTHENTICATED');
    }
  });

  it('rejects tampered tokens', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    expect(b.post('me', { token }).data.participant.id).toBe('paco');
    const parts = token.split('.');
    const forgedId = [...parts.slice(0, 1), 'victor', ...parts.slice(2)].join('.');
    const forgedExp = [...parts.slice(0, 4), String(Number(parts[4]) + 10 * 24 * 3600), ...parts.slice(5)].join('.');
    const sig = parts[6];
    const flipped = [...parts.slice(0, 6), (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1)].join('.');
    for (const bad of [forgedId, forgedExp, flipped, token.slice(0, -1), `${token}x`, 'ge1.paco', 'garbage']) {
      expect(b.post('me', { token: bad }).error.code).toBe('UNAUTHENTICATED');
    }
    // Same structure signed with a different secret.
    const other = createTestBackend({ properties: { SESSION_SECRET: 'another-secret-0123456789-abcdefghijklmnopqrst' } });
    const foreign = other.post('login', { payload: { participantId: 'paco', accessCode: other.codes.paco } }).data.token;
    expect(b.post('me', { token: foreign }).error.code).toBe('UNAUTHENTICATED');
  });

  it('expires after SESSION_EXPIRY_HOURS (default 168 h)', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    b.clock.advance(167 * HOUR);
    expect(b.post('me', { token }).ok).toBe(true);
    b.clock.advance(HOUR + 1000);
    expect(b.post('me', { token }).error).toMatchObject({ code: 'SESSION_EXPIRED', retryable: false });
  });

  it('honours a shorter SESSION_EXPIRY_HOURS, including for sessions issued before the change', () => {
    const b = createTestBackend();
    const token = b.login('gaetan');
    b.clock.advance(2 * HOUR);
    expect(b.post('me', { token }).ok).toBe(true);
    b.emu.setProperty('SESSION_EXPIRY_HOURS', '1');
    expect(b.post('me', { token }).error.code).toBe('SESSION_EXPIRED');
  });

  it('logout invalidates every session of that participant only', () => {
    const b = createTestBackend();
    const phone = b.login('paco');
    const laptop = b.login('paco');
    const victor = b.login('victor');
    expect(b.post('logout', { token: phone })).toMatchObject({ ok: true, data: { loggedOut: true } });
    expect(b.post('me', { token: phone }).error.code).toBe('UNAUTHENTICATED');
    expect(b.post('me', { token: laptop }).error.code).toBe('UNAUTHENTICATED');
    expect(b.post('me', { token: victor }).ok).toBe(true);
    const fresh = b.login('paco');
    expect(b.post('me', { token: fresh }).ok).toBe(true);
  });

  it('revokeAllSessions and rotateSessionSecret sign everyone out', () => {
    const b = createTestBackend();
    const t1 = b.tokens();
    b.emu.call('revokeAllSessions');
    for (const p of PIDS) expect(b.post('me', { token: t1[p] }).error.code).toBe('UNAUTHENTICATED');
    const t2 = b.tokens();
    b.emu.call('rotateSessionSecret');
    for (const p of PIDS) expect(b.post('me', { token: t2[p] }).error.code).toBe('UNAUTHENTICATED');
  });

  it('identity comes from the token: me returns the token’s participant whatever the payload says', () => {
    const b = createTestBackend();
    const token = b.login('alvarinn');
    const r = b.post('me', { token, payload: { participantId: 'victor' } });
    expect(r.data.participant.id).toBe('alvarinn');
  });
});

describe('access-code rotation', () => {
  it('rotateAccessCode issues a new 120-bit code, kills the old code and old sessions', () => {
    const b = createTestBackend();
    const oldToken = b.login('paco');
    const newCode: string = b.emu.call('rotateAccessCode', 'paco');
    expect(newCode).toMatch(CODE_FORMAT);
    expect(newCode.replace(/-/g, '')).toHaveLength(24); // 24 × 5 bits = 120 bits
    expect(b.post('me', { token: oldToken }).error.code).toBe('UNAUTHENTICATED');
    expect(b.post('login', { payload: { participantId: 'paco', accessCode: b.codes.paco } }).error.code).toBe('INVALID_CREDENTIALS');
    expect(b.post('login', { payload: { participantId: 'paco', accessCode: newCode } }).ok).toBe(true);
    // Others keep their codes; the stored property contains only salt + hash.
    expect(b.post('login', { payload: { participantId: 'gaetan', accessCode: b.codes.gaetan } }).ok).toBe(true);
    expect(b.emu.getProperty('PARTICIPANT_CREDENTIALS')).not.toContain(newCode);
    expect(b.emu.getProperty('PARTICIPANT_CREDENTIALS')).not.toContain(newCode.replace(/-/g, ''));
    expect(() => b.emu.call('rotateAccessCode', 'mallory')).toThrow(/Unknown participant/);
  });

  it('the admin menu shows the rotated code once and never logs it', () => {
    const b = createTestBackend();
    b.emu.ui.promptQueue.push('victor');
    b.emu.call('menuRotateAccessCode');
    const alert = b.emu.ui.alerts.at(-1)!;
    const code = alert.message.split('\n')[0];
    expect(code).toMatch(CODE_FORMAT);
    expect(b.post('login', { payload: { participantId: 'victor', accessCode: code } }).ok).toBe(true);
    expect(JSON.stringify(b.emu.logs)).not.toContain(code);
  });
});

describe('scripts/generate-access-codes.mjs', () => {
  it('produces credentials in exactly the format Auth.gs verifies', () => {
    const script = fileURLToPath(new URL('../../scripts/generate-access-codes.mjs', import.meta.url));
    const out = JSON.parse(execFileSync(process.execPath, [script, '--json'], { encoding: 'utf8' }));
    const b = createTestBackend({ credentials: out.credentials });
    for (const p of PIDS as readonly Pid[]) {
      expect(out.codes[p]).toMatch(CODE_FORMAT);
      expect(out.credentials[p].salt.length).toBeGreaterThanOrEqual(16);
      expect(b.post('login', { payload: { participantId: p, accessCode: out.codes[p] } }).ok).toBe(true);
    }
    expect(new Set(Object.values(out.codes)).size).toBe(4);
    expect(new Set(Object.values(out.credentials).map((c) => (c as { salt: string }).salt)).size).toBe(4);
  });
});

describe('logging policy', () => {
  it('never logs codes, tokens, secrets or comments', () => {
    const b = createTestBackend();
    const token = b.login('paco');
    b.post('login', { payload: { participantId: 'paco', accessCode: 'WRONG-CODE-123' } });
    b.submit(token, 'D01', ans(7), { comments: 'secret plans for the desert' });
    b.post('results', { token });
    b.emu.doPost('{"action":"login","payload":{"participantId":"paco","accessCode":"' + b.codes.paco + '"');
    b.emu.hooks.onWrite = () => { throw new Error('Service Spreadsheets timed out'); };
    expect(b.submit(token, 'D05', ans(6), { comments: 'another private note' }).error.code).toBe('SHEET_ERROR');
    b.emu.hooks.onWrite = null;
    b.emu.call('setup');
    b.emu.call('checkConfiguration');
    const logs = JSON.stringify(b.emu.logs);
    expect(logs).not.toContain(b.codes.paco);
    expect(logs).not.toContain(b.codes.paco.replace(/-/g, ''));
    expect(logs).not.toContain('WRONG-CODE-123');
    expect(logs).not.toContain(token);
    expect(logs).not.toContain(token.split('.')[6]);
    expect(logs).not.toContain(TEST_SECRET);
    expect(logs).not.toContain('secret plans');
    expect(logs).not.toContain('private note');
    for (const p of PIDS) expect(logs).not.toContain(b.credentials[p].hash);
  });
});
