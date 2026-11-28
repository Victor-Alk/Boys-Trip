/**
 * A24 red-team sweep: every destination × the three principal slides + the evaluation view (80 routes).
 *
 * For each route it checks that the right view renders, that the slide navigation has exactly three slides
 * (+ Evaluate), that every photograph in the presentation actually loads (lazy images are forced eager),
 * that the evaluation view shows the same five questions from data/questionnaire.json with no default
 * selection, and it records page errors, console errors and same-origin HTTP failures.
 *
 * Navigation uses hash changes inside one page (as a user would), so the globe is created only once.
 */
import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { collectProblems, DESTINATION_IDS } from './qa-helpers';

const questionnaire = JSON.parse(readFileSync('data/questionnaire.json', 'utf8')) as {
  questions: { id: string; label: string; text: string; minLabel: string; maxLabel: string }[];
};

const VIEWS = [
  { suffix: '', marker: '01 — The Experience · Why should we go there?' },
  { suffix: '/2', marker: '02 — The Journey · What would we actually do?' },
  { suffix: '/3', marker: '03 — The Practical Reality · Can we realistically do it?' },
  { suffix: '/evaluate', marker: 'Who is evaluating this expedition?' },
] as const;

test('every destination × 3 slides + evaluation render without errors or missing images', async ({ page, baseURL }) => {
  test.setTimeout(1_800_000);
  const origin = new URL(baseURL!).origin;
  const problems = collectProblems(page, origin);
  const report: { route: string; images: number; broken: string[]; placeholders: number; errors: string[] }[] = [];

  await page.goto('#/explore');
  await expect(page.locator('.ge-marker')).toHaveCount(DESTINATION_IDS.length, { timeout: 60_000 });

  for (const id of DESTINATION_IDS) {
    for (const view of VIEWS) {
      const route = `#/explore/${id}${view.suffix}`;
      const before = problems.pageErrors.length + problems.consoleErrors.length;
      await page.evaluate((h) => { window.location.hash = h; }, route);
      const region = page.locator('[role="region"][aria-label$="presentation"]');
      await expect(region.getByText(view.marker).first(), route).toBeVisible({ timeout: 30_000 });

      // Exactly three principal slides + the Evaluate entry.
      const nav = region.getByRole('navigation', { name: 'Slides' });
      await expect(nav.getByRole('button'), route).toHaveCount(4);
      await expect(nav.getByRole('button').filter({ hasText: /^0[1-3]/ }), route).toHaveCount(3);

      if (view.suffix === '/evaluate') {
        const groups = region.getByRole('radiogroup').filter({ has: page.getByRole('radio', { name: /^10/ }) });
        await expect(groups, route).toHaveCount(5);
        await expect(region.getByRole('radio', { checked: true }), `${route}: no default answer`).toHaveCount(0);
        const legends = await region.locator('fieldset legend').allInnerTexts();
        expect(legends.length, route).toBe(5);
        legends.forEach((l, i) => {
          expect(l, `${route} question ${i + 1}`).toContain(questionnaire.questions[i].text);
          expect(l.toLowerCase(), `${route} question ${i + 1}`).toContain(questionnaire.questions[i].label.toLowerCase());
        });
        for (let i = 0; i < 5; i++) await expect(groups.nth(i).getByRole('radio'), route).toHaveCount(10);
      }
      if (view.suffix === '/2') {
        // Stop list and map markers agree.
        const stops = await region.getByRole('list', { name: 'Stops' }).getByRole('listitem').count();
        expect(stops, `${route}: stops`).toBeGreaterThanOrEqual(2);
        await expect(region.locator('.ge-stop'), `${route}: map markers`).toHaveCount(stops, { timeout: 30_000 });
      }
      if (view.suffix === '/3') {
        await expect(region.getByRole('heading', { name: 'Total estimated cost — flights included' }), route).toBeVisible();
        await expect(region.getByRole('heading', { name: 'February or March?' }), route).toBeVisible();
        await expect(region.getByText(/Sources \(\d+\) · last verified \d{4}-\d{2}-\d{2}/), route).toBeVisible();
        await expect(region.getByRole('button', { name: /Evaluate this expedition|Review or edit my evaluation/ }).first(), route).toBeVisible();
      }

      // Force lazy photographs to load and check each one decoded.
      const imgs = await region.evaluate(async (el) => {
        const list = Array.from(el.querySelectorAll('img'));
        list.forEach((i) => { i.loading = 'eager'; });
        await Promise.all(list.map((i) => (i.complete ? Promise.resolve() : new Promise((r) => { i.addEventListener('load', r, { once: true }); i.addEventListener('error', r, { once: true }); setTimeout(r, 15000); }))));
        return {
          total: list.length,
          broken: list.filter((i) => !(i.complete && i.naturalWidth > 0)).map((i) => i.currentSrc || i.src),
          placeholders: Array.from(el.querySelectorAll('div')).filter((d) => /^(Photograph unavailable|No photograph)$/.test(d.textContent?.trim() ?? '')).length,
        };
      });
      const errors = [...problems.pageErrors, ...problems.consoleErrors].slice(before);
      report.push({ route, images: imgs.total, broken: imgs.broken, placeholders: imgs.placeholders, errors });
    }
  }

  const json = JSON.stringify({ report, problems }, null, 2);
  writeFileSync(test.info().outputPath('sweep-report.json'), json);
  await test.info().attach('sweep-report.json', { body: json, contentType: 'application/json' });
  const totalImages = report.reduce((n, r) => n + r.images, 0);
  console.log(`[qa-sweep] routes=${report.length} photographs-loaded=${totalImages} console-errors=${problems.consoleErrors.length} page-errors=${problems.pageErrors.length} same-origin-http-failures=${problems.httpErrors.length} external-failures=${problems.externalFailures.length}`);
  const broken = report.filter((r) => r.broken.length || r.placeholders);
  const withErrors = report.filter((r) => r.errors.length);
  expect(report.length).toBe(80);
  expect(broken, `routes with missing/broken photographs:\n${JSON.stringify(broken, null, 1)}`).toEqual([]);
  expect(problems.httpErrors, 'same-origin HTTP failures').toEqual([]);
  expect(problems.pageErrors, 'uncaught page errors').toEqual([]);
  expect(withErrors, `routes with console errors:\n${JSON.stringify(withErrors, null, 1)}`).toEqual([]);
  // Slides 1 and 2 must show photographs on every destination.
  for (const r of report.filter((x) => !x.route.endsWith('/3') && !x.route.endsWith('/evaluate'))) {
    expect(r.images, `${r.route}: photographs`).toBeGreaterThan(0);
  }
});
