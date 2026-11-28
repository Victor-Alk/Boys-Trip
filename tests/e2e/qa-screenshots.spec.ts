/**
 * A24 visual QA capture (not an assertion suite). Skipped unless QA_SCREENSHOTS=1:
 *   QA_SCREENSHOTS=1 npx playwright test tests/e2e/qa-screenshots.spec.ts --project=desktop-chromium
 * Writes compressed JPEGs to docs/qa/screenshots/ (desktop 1440 × 900, mobile 390 × 844), using a demo backend
 * seeded with fictitious evaluations so the private pages show realistic content.
 */
import { chromium, expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { DESTINATION_IDS, seedDemoBackend, signIn, useSeededDemo, PARTICIPANTS, type SeedVote } from './qa-helpers';

test.skip(!process.env.QA_SCREENSHOTS, 'Visual capture only: set QA_SCREENSHOTS=1');

const OUT = 'docs/qa/screenshots';
test.beforeAll(() => { mkdirSync(OUT, { recursive: true }); });

function demoVotes(): SeedVote[] {
  // Fictitious, deterministic scores: eight destinations complete (revealed), three partially evaluated.
  const base: Record<string, number[]> = {
    D08: [8, 7, 9, 8], D10: [9, 8, 8, 7], D12: [7, 9, 6, 8], D04: [6, 7, 8, 6], D16: [8, 8, 7, 9],
    D14: [7, 6, 8, 7], D11: [6, 8, 7, 5], D02: [9, 9, 8, 9], D03: [5, 7, 6], D17: [8, 6], D19: [7],
  };
  const votes: SeedVote[] = [];
  for (const [dest, scores] of Object.entries(base)) {
    scores.forEach((s, i) => {
      const q1 = Math.max(1, Math.min(10, s + ((i + dest.charCodeAt(2)) % 3) - 1));
      votes.push({ pid: PARTICIPANTS[i], destinationId: dest, answers: { q1, q2: s, q3: Math.min(10, s + 1), q4: s, q5: Math.max(1, s - 1) }, comments: i === 3 ? 'Fictitious demo comment' : '' });
    });
  }
  return votes;
}

async function shot(page: Page, name: string, opts: { fullPage?: boolean; scrollToHeading?: RegExp } = {}) {
  if (opts.scrollToHeading) {
    await page.getByRole('heading', { name: opts.scrollToHeading }).first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.evaluate(() => window.scrollBy(0, -70));
  }
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/${name}.jpg`, type: 'jpeg', quality: 62, fullPage: opts.fullPage ?? false });
}

test('desktop captures', async ({ page }) => {
  test.setTimeout(300_000);
  await useSeededDemo(page, seedDemoBackend({ votes: demoVotes() }));
  await page.goto('#/explore');
  await expect(page.locator('.ge-marker')).toHaveCount(DESTINATION_IDS.length, { timeout: 60_000 });
  await shot(page, 'desktop-01-explore-cover');
  await page.goto('#/explore/D07');
  await shot(page, 'desktop-02-slide1-experience-D07');
  await page.goto('#/explore/D07/2');
  await expect(page.locator('.ge-stop').first()).toBeVisible({ timeout: 30_000 });
  await shot(page, 'desktop-03-slide2-journey-D07');
  await page.goto('#/explore/D07/3');
  await shot(page, 'desktop-04-slide3-reality-D07');
  await page.goto('#/explore/D08/evaluate');
  await signIn(page, 'victor');
  await shot(page, 'desktop-05-evaluation-form-D08');
  await page.goto('#/my-evaluations');
  await expect(page.getByRole('heading', { name: /Victor’s notebook/ })).toBeVisible();
  await shot(page, 'desktop-06-my-evaluations');
  await page.goto('#/group-results');
  await expect(page.getByRole('heading', { name: 'Where the group is heading' })).toBeVisible();
  await shot(page, 'desktop-07-group-results-top');
  await shot(page, 'desktop-08-group-results-ranking', { scrollToHeading: /^Eligible ranking/ });
});

test.describe('mobile 390 × 844', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  test('mobile captures', async ({ page }) => {
    test.setTimeout(300_000);
    await useSeededDemo(page, seedDemoBackend({ votes: demoVotes() }));
    await page.goto('#/explore');
    await shot(page, 'mobile-09-explore-globe');
    await page.goto('#/explore/D07');
    await page.locator('#presentation').scrollIntoViewIfNeeded();
    await shot(page, 'mobile-10-slide1-D07');
    await page.goto('#/explore/D07/3');
    await page.locator('#presentation').scrollIntoViewIfNeeded();
    await shot(page, 'mobile-11-slide3-budget-D07');
    await page.goto('#/explore/D08/evaluate');
    await signIn(page, 'victor');
    await page.getByText('Who is evaluating this expedition?').first().scrollIntoViewIfNeeded();
    await shot(page, 'mobile-12-evaluation-form');
    await page.goto('#/my-evaluations');
    await shot(page, 'mobile-13-my-evaluations');
    await page.goto('#/group-results');
    await shot(page, 'mobile-14-group-results');
  });
});

test('no-WebGL fallback capture', async ({ baseURL }) => {
  const browser = await chromium.launch({ args: ['--disable-webgl', '--disable-3d-apis', '--disable-gpu'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${baseURL}#/explore/D10/2`);
  await expect(page.getByText('The 3D globe is unavailable on this device')).toBeVisible();
  await shot(page, 'desktop-15-no-webgl-fallback-slide2');
  await browser.close();
});
