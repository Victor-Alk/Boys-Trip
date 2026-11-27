/**
 * A24: the site must stay usable when WebGL is unavailable (old devices, locked-down browsers, GPU blocklists).
 * Chromium is launched with WebGL and all 3D APIs disabled; the globe and the MapLibre itinerary map cannot start.
 */
import { expect, test } from '@playwright/test';
import { answerAll, collectProblems, signIn } from './qa-helpers';

test.use({ launchOptions: { args: ['--disable-webgl', '--disable-3d-apis', '--disable-gpu'] } });

test('without WebGL: fallback message, search, table, all three slides and voting still work', async ({ page, baseURL }) => {
  test.setTimeout(180_000);
  const problems = collectProblems(page, new URL(baseURL!).origin);
  await page.goto('#/explore');

  // WebGL really is off in this browser.
  expect(await page.evaluate(() => !!document.createElement('canvas').getContext('webgl'))).toBe(false);
  await expect(page.getByText('The 3D globe is unavailable on this device')).toBeVisible();
  await expect(page.locator('.ge-marker')).toHaveCount(0);

  // Search picker still selects a destination.
  const search = page.getByRole('combobox');
  await search.fill('Jordan');
  await page.getByRole('option', { name: /Jordan/ }).first().click();
  await expect(page).toHaveURL(/#\/explore\/D07$/);
  await expect(page.getByText('01 — The Experience · Why should we go there?')).toBeVisible();

  // Comparison table still selects a destination.
  await page.locator('table tbody tr', { hasText: 'Sri Lanka' }).click();
  await expect(page).toHaveURL(/#\/explore\/D10$/);

  // Slide 2 (MapLibre needs WebGL): the stop list and timeline must remain readable even if the map cannot start.
  await page.getByRole('button', { name: 'Next →' }).click();
  await expect(page.getByText('02 — The Journey · What would we actually do?')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Stops' }).getByRole('listitem').first()).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: test.info().outputPath('no-webgl-slide2.png') });
  await page.getByRole('button', { name: 'Next →' }).click();
  await expect(page.getByRole('heading', { name: 'Total estimated cost — flights included' })).toBeVisible();

  // Voting works without WebGL.
  await page.getByRole('button', { name: 'Evaluate this expedition' }).first().click();
  await signIn(page, 'paco');
  await answerAll(page, [6, 7, 8, 9, 5]);
  await page.getByRole('button', { name: /save my evaluation/i }).click();
  await expect(page.getByText('✓ Saved on the server')).toBeVisible();

  await test.info().attach('no-webgl-problems.json', { body: JSON.stringify(problems, null, 2), contentType: 'application/json' });
  // The app itself must not crash (React tree still mounted after visiting every slide).
  await expect(page.getByRole('banner')).toBeVisible();
});

test('without WebGL: the itinerary map degrades without an uncaught error', async ({ page, baseURL }) => {
  // FIXME(A24-QA-05): MapLibre's constructor throws "Failed to initialize WebGL" inside an async setTimeout
  // callback in src/components/itinerary/ItineraryMap.tsx (no try/catch, no error boundary), which surfaces as an
  // uncaught page error and leaves an empty grey map box with no explanation. Run with QA_RUN_FIXME=1 to see it fail.
  test.fixme(!process.env.QA_RUN_FIXME, 'Known defect A24-QA-05 (owner A22): no WebGL fallback for the itinerary map');
  const problems = collectProblems(page, new URL(baseURL!).origin);
  await page.goto('#/explore/D07/2');
  await expect(page.getByText('02 — The Journey · What would we actually do?')).toBeVisible();
  await page.waitForTimeout(3000);
  expect(problems.pageErrors, 'uncaught errors on slide 2 without WebGL').toEqual([]);
  await expect(page.getByText(/map (is )?unavailable|cannot display the map|WebGL/i)).toBeVisible();
});
