/**
 * A24: globe ↔ table ↔ presentation linkage, slide navigation (buttons, tabs, keyboard, full screen),
 * deep links + refresh for every page, robustness against unknown routes.
 */
import { expect, test } from '@playwright/test';
import { collectProblems, DESTINATION_IDS } from './qa-helpers';

test('every destination has a globe marker; every marker opens its own destination; every table row selects its marker', async ({ page, baseURL }) => {
  test.setTimeout(600_000);
  const problems = collectProblems(page, new URL(baseURL!).origin);
  await page.goto('#/explore');
  const markers = page.locator('.ge-marker');
  await expect(markers).toHaveCount(DESTINATION_IDS.length, { timeout: 60_000 });
  const ids = await markers.evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));
  expect([...ids].sort()).toEqual(DESTINATION_IDS);

  // Each marker (dispatching the click, since half of them are on the far side of the globe).
  for (const id of DESTINATION_IDS) {
    await page.locator(`.ge-marker[data-id="${id}"]`).dispatchEvent('click');
    await expect(page, `marker ${id}`).toHaveURL(new RegExp(`#/explore/${id}$`));
    await expect(page.getByRole('region', { name: /presentation$/ }).getByText(new RegExp(`^${id} ·`)), `marker ${id}`).toBeVisible();
    await expect(page.locator('.ge-marker.is-selected'), `marker ${id}`).toHaveAttribute('data-id', id);
  }

  // Each table row (desktop table) selects the corresponding marker and opens slide 1.
  const rows = page.locator('table tbody tr[tabindex="0"]');
  await expect(rows).toHaveCount(DESTINATION_IDS.length);
  for (let i = 0; i < DESTINATION_IDS.length; i++) {
    const row = rows.nth(i);
    const label = (await row.locator('td').first().innerText()).trim();
    const id = `D${label.match(/^(\d{2})/)![1]}`;
    await row.click();
    await expect(page, `row ${label}`).toHaveURL(new RegExp(`#/explore/${id}$`));
    await expect(page.locator('.ge-marker.is-selected'), `row ${label}`).toHaveAttribute('data-id', id);
  }
  expect(problems.pageErrors).toEqual([]);
});

test('slide navigation: buttons, tabs, keyboard, evaluate entry, destination arrows, full screen', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('#/explore/D12');
  const region = page.getByRole('region', { name: 'Vietnam presentation' });
  await expect(region.getByText('01 — The Experience · Why should we go there?')).toBeVisible();
  await expect(region.getByRole('button', { name: '← Previous' })).toBeDisabled();

  await region.getByRole('button', { name: 'Next →' }).click();
  await expect(page).toHaveURL(/#\/explore\/D12\/2$/);
  await region.getByRole('button', { name: 'Next →' }).click();
  await expect(page).toHaveURL(/#\/explore\/D12\/3$/);
  await region.getByRole('button', { name: '← Previous' }).click();
  await expect(page).toHaveURL(/#\/explore\/D12\/2$/);

  // Tabs.
  await region.getByRole('navigation', { name: 'Slides' }).getByRole('button', { name: /03/ }).click();
  await expect(page).toHaveURL(/#\/explore\/D12\/3$/);
  await region.getByRole('navigation', { name: 'Slides' }).getByRole('button', { name: /^Evaluate/ }).click();
  await expect(page).toHaveURL(/#\/explore\/D12\/evaluate$/);
  await region.getByRole('button', { name: '← Back to the practical reality' }).click();
  await expect(page).toHaveURL(/#\/explore\/D12\/3$/);

  // Keyboard: ← → move between slides; → on slide 3 opens the evaluation; arrows inside a 1–10 scale change the answer, not the slide.
  await page.locator('body').click({ position: { x: 1300, y: 860 } }).catch(() => undefined);
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/#\/explore\/D12\/2$/);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#\/explore\/D12\/evaluate$/);
  const firstScale = region.getByRole('radiogroup').first();
  await firstScale.getByRole('radio', { name: /^5/ }).click();
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#\/explore\/D12\/evaluate$/);
  await expect(firstScale.getByRole('radio', { name: /^6/ })).toHaveAttribute('aria-checked', 'true');

  // Previous / next destination.
  await region.getByRole('button', { name: /Next destination/ }).click();
  await expect(page).toHaveURL(/#\/explore\/D13$/);
  await page.getByRole('region', { name: 'Philippines presentation' }).getByRole('button', { name: /Previous destination/ }).click();
  await expect(page).toHaveURL(/#\/explore\/D12$/);

  // Full screen (native or the CSS fallback) and back.
  const fs = page.getByRole('region', { name: 'Vietnam presentation' }).getByRole('button', { name: 'Full screen' });
  await fs.click();
  const exit = page.getByRole('button', { name: 'Exit full screen' });
  await expect(exit).toBeVisible();
  await expect(exit).toHaveAttribute('aria-pressed', 'true');
  const box = await page.getByRole('region', { name: 'Vietnam presentation' }).boundingBox();
  expect(box!.width).toBeGreaterThan(1300); // covers the viewport, not just the right-hand panel
  await exit.click();
  await expect(page.getByRole('region', { name: 'Vietnam presentation' }).getByRole('button', { name: 'Full screen' })).toBeVisible();
});

test('deep links survive a reload on every page; unknown routes fall back safely', async ({ page }) => {
  test.setTimeout(240_000);
  const checks: [string, RegExp | string][] = [
    ['#/explore/D20/3', 'Total estimated cost — flights included'],
    ['#/explore/D15/2', '02 — The Journey · What would we actually do?'],
    ['#/explore/D01/evaluate', 'Who is evaluating this expedition?'],
    ['#/my-evaluations', 'Your private evaluation notebook'],
    ['#/group-results', 'Collective results are private'],
    ['#/explore', /twenty|20/i],
  ];
  for (const [route, text] of checks) {
    await page.goto(route);
    // Scoped to the page content: the (closed) sign-in dialog repeats "Who is evaluating this expedition?".
    const main = page.locator('#main-content');
    await expect(main.getByText(text).first(), route).toBeVisible({ timeout: 30_000 });
    await page.reload();
    await expect(main.getByText(text).first(), `${route} after reload`).toBeVisible({ timeout: 30_000 });
    await expect(page, route).toHaveURL(new RegExp(route.replace(/[/#]/g, '\\$&') + '$'));
  }
  // Unknown destination id and unknown page: no crash, the atlas still works.
  for (const bad of ['#/explore/D99', '#/explore/D07/9', '#/nowhere', '#/explore/d07']) {
    await page.goto(bad);
    await expect(page.getByRole('banner'), bad).toBeVisible();
    await expect(page.locator('.ge-marker'), bad).toHaveCount(DESTINATION_IDS.length, { timeout: 60_000 });
  }
});

test('“Skip to content” keeps the reader on the current page', async ({ page }) => {
  // FIXME(A24-QA-07): App.tsx renders <a href="#main-content">. With hash routing, activating it replaces the route
  // hash with "#main-content", which parseHash() maps to the Explore cover — a keyboard user on Group results or
  // My evaluations is thrown back to the globe. Run with QA_RUN_FIXME=1 to see it fail.
  test.fixme(!process.env.QA_RUN_FIXME, 'Known defect A24-QA-07 (owner A22): skip link breaks hash routing');
  await page.goto('#/group-results');
  await expect(page.getByText('Collective results are private')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Collective results are private')).toBeVisible();
  await expect(page).toHaveURL(/#\/group-results$/);
});
