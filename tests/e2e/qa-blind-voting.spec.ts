/**
 * A24: blind voting as seen by a participant in the browser, under every reveal policy, plus the failure paths of
 * a submission (never shown as saved), session expiry/tampering and sign-in lockout.
 *
 * The demo backend is seeded in Node with the real .gs code (qa-helpers.seedDemoBackend). Victor signs in and
 * browses every page; the rendered DOM and the browser storage (except the demo backend's own state, which in
 * demo mode necessarily holds everyone's rows) must not contain anything the policy keeps hidden.
 */
import { expect, test, type Page } from '@playwright/test';
import { answerAll, DEMO_STORAGE_KEY, seedDemoBackend, signIn, signOut, useSeededDemo, type Answers, type SeedVote } from './qa-helpers';

const a = (q1: number, q2: number, q3: number, q4: number, q5: number): Answers => ({ q1, q2, q3, q4, q5 });

/** D08 (Tunisia, eligible): three of four have voted. D04 (India, eligible): all four have voted. */
const VOTES: SeedVote[] = [
  { pid: 'paco', destinationId: 'D08', answers: a(3, 9, 2, 10, 1), comments: 'QA-SECRET-paco-D08' },
  { pid: 'gaetan', destinationId: 'D08', answers: a(10, 1, 9, 2, 8), comments: 'QA-SECRET-gaetan-D08' },
  { pid: 'alvarinn', destinationId: 'D08', answers: a(1, 1, 10, 10, 4), comments: 'QA-SECRET-alvarinn-D08' },
  { pid: 'paco', destinationId: 'D04', answers: a(7, 7, 7, 7, 7), comments: 'QA-D04-paco' },
  { pid: 'gaetan', destinationId: 'D04', answers: a(8, 8, 8, 8, 8), comments: 'QA-D04-gaetan' },
  { pid: 'alvarinn', destinationId: 'D04', answers: a(6, 6, 6, 6, 6), comments: 'QA-D04-alvarinn' },
  { pid: 'victor', destinationId: 'D04', answers: a(9, 9, 9, 9, 9), comments: 'QA-D04-victor' },
];

async function browserText(page: Page): Promise<string> {
  return page.evaluate((demoKey) => {
    const store = (s: Storage) => Object.keys(s).filter((k) => k !== demoKey).map((k) => `${k}=${s.getItem(k)}`).join('\n');
    return `${document.documentElement.outerHTML}\n${store(localStorage)}\n${store(sessionStorage)}`;
  }, DEMO_STORAGE_KEY);
}

async function heatmapVisible(page: Page, country: string): Promise<number> {
  await page.goto('#/group-results');
  await expect(page.getByRole('heading', { name: 'Participant comparison' })).toBeVisible();
  const section = page.locator('section', { has: page.getByRole('heading', { name: 'Participant comparison' }) });
  const cells = section.locator('tbody tr', { hasText: country }).first().locator('td[title]');
  await expect(cells).toHaveCount(4);
  const titles = await cells.evaluateAll((els) => els.map((e) => e.getAttribute('title')));
  return titles.filter((t) => t !== 'Hidden or not yet evaluated').length;
}

const POLICIES = [
  { name: 'per-destination-complete (default)', props: {}, d08Visible: 0, d04Visible: 4 },
  { name: 'all-complete', props: { RESULTS_REVEAL_POLICY: 'all-complete' }, d08Visible: 0, d04Visible: 1 },
  { name: 'admin-only', props: { RESULTS_REVEAL_POLICY: 'admin-only' }, d08Visible: 0, d04Visible: 1 },
  { name: 'always + author-only comments', props: { RESULTS_REVEAL_POLICY: 'always', COMMENTS_VISIBILITY: 'author-only' }, d08Visible: 3, d04Visible: 4 },
  { name: 'BLIND_VOTING_ENABLED=false', props: { BLIND_VOTING_ENABLED: 'false', COMMENTS_VISIBILITY: 'author-only' }, d08Visible: 3, d04Visible: 4 },
] as const;

for (const policy of POLICIES) {
  test(`blind voting in the browser — ${policy.name}`, async ({ page }) => {
    test.setTimeout(240_000);
    await useSeededDemo(page, seedDemoBackend({ properties: policy.props, votes: VOTES }));
    await page.goto('#/explore/D08/evaluate');
    await signIn(page, 'victor');
    // Victor has not voted on D08: nothing pre-filled, no other participant's answer selected.
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);

    let seen = '';
    for (const r of ['#/explore', '#/explore/D08', '#/explore/D08/3', '#/explore/D08/evaluate', '#/my-evaluations', '#/group-results', '#/explore/D04/evaluate']) {
      await page.goto(r);
      await page.waitForTimeout(1200);
      seen += await browserText(page);
    }
    // Other participants' unrevealed comments never reach the screen or the browser storage under any policy.
    expect(seen).not.toMatch(/QA-SECRET-/);
    // Victor's own comment is his to see.
    expect(seen).toContain('QA-D04-victor');

    expect(await heatmapVisible(page, 'Tunisia'), 'visible D08 cells').toBe(policy.d08Visible);
    expect(await heatmapVisible(page, 'India'), 'visible D04 cells').toBe(policy.d04Visible);

    // My evaluations lists only Victor's own evaluation.
    await page.goto('#/my-evaluations');
    await expect(page.getByRole('heading', { name: 'Evaluated (1)' })).toBeVisible();
  });
}

test('a rejected submission is never shown as saved; a later retry saves exactly once', async ({ page }) => {
  test.setTimeout(180_000);
  // The server will refuse every submission (questionnaire version mismatch), like a misconfigured backend.
  await useSeededDemo(page, seedDemoBackend({ properties: { QUESTIONNAIRE_VERSION: 'q9' } }));
  await page.goto('#/explore/D08/evaluate');
  await signIn(page, 'paco');
  await answerAll(page, [8, 7, 6, 5, 4]);
  await page.getByRole('button', { name: /save my evaluation/i }).click();
  await expect(page.getByRole('alert').getByText('Not saved.')).toBeVisible();
  await expect(page.getByText('✓ Saved on the server')).toHaveCount(0);
  await expect(page.getByText('Pending — not yet confirmed by the server')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Slides' }).getByRole('button', { name: /Pending/ })).toBeVisible();

  await page.goto('#/my-evaluations');
  await expect(page.getByRole('heading', { name: 'Not yet saved on the server' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Evaluated (0)' })).toBeVisible();

  // The administrator fixes the backend; the participant retries from the kept draft.
  await page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key)!);
    delete s.properties.QUESTIONNAIRE_VERSION;
    localStorage.setItem(key, JSON.stringify(s));
  }, DEMO_STORAGE_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Open and save' }).click();
  await expect(page.getByRole('radiogroup').first().getByRole('radio', { name: /^8/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('button', { name: /Retry — save my evaluation|save my evaluation/i }).click();
  await expect(page.getByText('✓ Saved on the server')).toBeVisible();
  await expect(page.getByText(/revision 1/)).toBeVisible();
  await page.goto('#/my-evaluations');
  await expect(page.getByRole('heading', { name: 'Evaluated (1)' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Not yet saved on the server' })).toHaveCount(0);
  const rows = await page.evaluate((key) => {
    const s = JSON.parse(localStorage.getItem(key)!);
    const ss = Object.values(s.spreadsheets as Record<string, { sheets: { name: string; rows: unknown[][] }[] }>)[0];
    return ss.sheets.find((x) => x.name === 'Responses')!.rows.filter((r) => r && r.length).length - 1;
  }, DEMO_STORAGE_KEY);
  expect(rows, 'exactly one active Responses row').toBe(1);
});

test('a tampered or expired session is refused and the user is asked to sign in again', async ({ page }) => {
  await useSeededDemo(page, seedDemoBackend());
  await page.goto('#/my-evaluations');
  await signIn(page, 'gaetan');
  await expect(page.getByRole('heading', { name: /Gaetan’s notebook/ })).toBeVisible();

  // Forge: claim to be Paco with Gaetan's signature (identity is only ever taken from a verified token).
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('ge-session-v1')!);
    s.token = s.token.replace(/^ge1\.gaetan\./, 'ge1.paco.');
    s.participant = { id: 'paco', name: 'Paco' };
    localStorage.setItem('ge-session-v1', JSON.stringify(s));
  });
  await page.reload();
  await expect(page.getByText(/session has expired|sign in again/i).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Paco’s notebook/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /sign in to evaluate/i })).toBeVisible();

  // Client-side expiry.
  await signIn(page, 'gaetan');
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('ge-session-v1')!);
    s.expiresAt = new Date(Date.now() - 1000).toISOString();
    localStorage.setItem('ge-session-v1', JSON.stringify(s));
  });
  await page.reload();
  await expect(page.getByRole('button', { name: /sign in to evaluate/i })).toBeVisible();
  await expect(page.getByText('Your private evaluation notebook')).toBeVisible();
});

test('five wrong codes lock the name for 15 minutes, even with the right code afterwards', async ({ page }) => {
  await useSeededDemo(page, seedDemoBackend());
  await page.goto('#/explore');
  await page.getByRole('button', { name: /sign in/i }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: /Alvarinn/ }).click();
  for (let i = 0; i < 5; i++) {
    await dialog.getByLabel('Personal access code').fill(`WRONG-${i}-CODE`);
    await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(dialog.getByRole('alert')).toHaveText('That access code is not valid for this participant.');
  }
  await dialog.getByLabel('Personal access code').fill('DEMO-ALVARINN-2027');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(dialog.getByRole('alert')).toHaveText(/Too many attempts/);
  // Another participant is not locked by Alvarinn's failures.
  await dialog.getByRole('radio', { name: /Victor/ }).click();
  await dialog.getByLabel('Personal access code').fill('DEMO-VICTOR-2027');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('banner').getByText('Victor', { exact: true })).toBeVisible();
  await signOut(page);
});
