import { describe, expect, it } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { createTestBackend, ans } from './helpers';

const ADMIN_KEY = 'test-admin-key-0123456789-abcdefghijklmnopqrstuv';
const SALT = 'adminsalt123';
const ADMIN_KEY_HASH = `${SALT}:${createHmac('sha256', SALT).update(ADMIN_KEY).digest('base64url')}`;

function backend() {
  const b = createTestBackend({ properties: { ADMIN_KEY_HASH } });
  const admin = (action: string, payload: unknown = {}, adminKey = ADMIN_KEY) => b.emu.doPost(JSON.stringify({ action, adminKey, payload }));
  const propose = (token: string, prompt: string, requestId = randomUUID()) => b.post('submitPrompt', { token, requestId, payload: { prompt } });
  return { ...b, admin, propose };
}

describe('destination prompts', () => {
  it('stores a proposal as "new" and shows it to the whole group', () => {
    const b = backend();
    const t = b.tokens();
    const r = b.propose(t.victor, 'Kyrgyzstan in March: yurts, horse trekking and the Song-Kul plateau');
    expect(r.ok).toBe(true);
    expect(r.data.prompt).toMatchObject({ participantId: 'victor', status: 'new', destinationId: null });
    expect(b.rows('Prompts')).toHaveLength(1);
    const list = b.post('prompts', { token: t.paco });
    expect(list.ok).toBe(true);
    expect(list.data.prompts.map((p: { prompt: string }) => p.prompt)).toEqual(['Kyrgyzstan in March: yurts, horse trekking and the Song-Kul plateau']);
  });

  it('validates length, needs a session and is idempotent on requestId', () => {
    const b = backend();
    const t = b.login('paco');
    expect(b.propose(t, 'too short').error.code).toBe('VALIDATION_FAILED');
    expect(b.post('submitPrompt', { payload: { prompt: 'No token, so this must be refused' }, requestId: randomUUID() }).error.code).toBe('UNAUTHENTICATED');
    const id = randomUUID();
    const first = b.propose(t, 'Socotra island, if it is ever safe enough', id);
    const again = b.propose(t, 'Socotra island, if it is ever safe enough', id);
    expect(again.data.idempotentReplay).toBe(true);
    expect(again.data.prompt.promptId).toBe(first.data.prompt.promptId);
    expect(b.rows('Prompts')).toHaveLength(1);
  });

  it('limits each participant to five open proposals', () => {
    const b = backend();
    const t = b.login('gaetan');
    for (let i = 0; i < 5; i++) expect(b.propose(t, `Proposal number ${i} with enough words`).ok).toBe(true);
    expect(b.propose(t, 'One proposal too many for now').error.code).toBe('VALIDATION_FAILED');
  });

  it('stores formula-looking text as plain text', () => {
    const b = backend();
    const t = b.login('alvarinn');
    const text = '=HYPERLINK("http://evil.example","click") Mongolia please';
    expect(b.propose(t, text).ok).toBe(true);
    expect(b.post('prompts', { token: t }).data.prompts[0].prompt).toBe(text);
  });
});

describe('admin processing actions', () => {
  it('rejects missing or wrong admin keys and never accepts a participant session instead', () => {
    const b = backend();
    expect(b.admin('adminListPrompts', {}, 'wrong-key').error.code).toBe('FORBIDDEN');
    const t = b.login('paco');
    expect(b.post('adminListPrompts', { token: t }).error.code).toBe('FORBIDDEN');
    const unconfigured = createTestBackend();
    expect(unconfigured.emu.doPost(JSON.stringify({ action: 'adminListPrompts', adminKey: ADMIN_KEY })).error.code).toBe('NOT_CONFIGURED');
  });

  it('lists new prompts, moves them through processing to done, and never reopens a done prompt', () => {
    const b = backend();
    const t = b.login('victor');
    const id = b.propose(t, 'Uzbekistan Silk Road cities and the Nuratau mountains').data.prompt.promptId;
    expect(b.admin('adminListPrompts', { status: 'new' }).data.prompts).toHaveLength(1);
    expect(b.admin('adminUpdatePrompt', { promptId: id, status: 'processing' }).ok).toBe(true);
    expect(b.admin('adminListPrompts', { status: 'new' }).data.prompts).toHaveLength(0);
    const done = b.admin('adminUpdatePrompt', { promptId: id, status: 'done', destinationId: 'D21', note: 'Added as D21' });
    expect(done.data.prompt).toMatchObject({ status: 'done', destinationId: 'D21', note: 'Added as D21' });
    expect(b.admin('adminUpdatePrompt', { promptId: id, status: 'new' }).error.code).toBe('VALIDATION_FAILED');
    expect(b.rows('Prompts')[0]).toMatchObject({ status: 'done', destination_id: 'D21' });
  });

  it('registers a new destination so votes for it are accepted without re-pasting the backend', () => {
    const b = backend();
    const t = b.login('paco');
    expect(b.submit(t, 'D21', ans(8)).error.code).toBe('VALIDATION_FAILED');
    const before = b.post('completion', { token: t }).data.maxActive;
    const reg = b.admin('adminRegisterDestination', {
      entry: { id: 'D21', name: 'Uzbekistan', title: 'Uzbekistan — Test', version: '1.0.0', securityStatus: 'eligible', realisticTotalEUR: 1700, budgetStatus: 'within-preferred', materialUncertainty: false },
    });
    expect(reg.ok).toBe(true);
    expect(reg.data.destinationIds).toContain('D21');
    expect(b.submit(t, 'D21', ans(8)).ok).toBe(true);
    expect(b.post('completion', { token: t }).data.maxActive).toBe(before + 4);
    expect(b.admin('adminRegisterDestination', { entry: { id: 'D01', name: 'Override attempt' } }).error.code).toBe('VALIDATION_FAILED');
  });
});

describe('admin novelty update', () => {
  it('replaces NOVELTY_DATA from the admin API and serves it to signed-in participants only', () => {
    const b = backend();
    const r = b.admin('adminSetNovelty', { novelty: { D01: { visitedBy: ['alvarinn', 'nobody'], note: 'Visited before' }, D02: { visitedBy: [] }, bad: {} } });
    expect(r.data.destinations).toBe(2);
    const t = b.login('paco');
    const n = b.post('novelty', { token: t }).data.destinations;
    expect(n.D01).toEqual({ newToAll: false, visitedCount: 1, visitedBy: ['alvarinn'], note: 'Visited before' });
    expect(n.D02.newToAll).toBe(true);
    expect(b.post('novelty', {}).error.code).toBe('UNAUTHENTICATED');
  });
});
