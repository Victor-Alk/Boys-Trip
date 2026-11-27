import { expect, test } from '@playwright/test';

test('globe, deep links, slides and table stay in sync', async ({ page }) => {
  await page.goto('#/explore/D01');
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  // The globe (software WebGL in CI) can take longer than the default 15 s to place its markers under load.
  await expect(page.locator('table tbody tr').first()).toBeVisible();
  await expect(page.locator('.ge-marker')).toHaveCount(await page.locator('table tbody tr').count(), { timeout: 60_000 });
  await expect(page.getByText('01 — The Experience · Why should we go there?')).toBeVisible();

  // Keyboard navigation through the three slides, then the evaluation view.
  await page.locator('body').click({ position: { x: 900, y: 120 } });
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#\/explore\/D01\/2$/);
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/#\/explore\/D01\/3$/);
  await expect(page.getByRole('heading', { name: 'Total estimated cost — flights included' })).toBeVisible();

  // Refreshing a deep link works (hash routing — no 404 on GitHub Pages).
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Total estimated cost — flights included' })).toBeVisible();

  // Clicking a table row selects that destination and resets to slide 1.
  const row = page.locator('table tbody tr', { hasText: 'Sri Lanka' });
  await row.click();
  await expect(page).toHaveURL(/#\/explore\/D10$/);
  await expect(page.locator('.ge-marker.is-selected')).toHaveAttribute('data-id', 'D10');
});

test('own flight price updates the total immediately', async ({ page }) => {
  await page.goto('#/explore/D04/3');
  const headline = page.locator('section[aria-labelledby="budget-title"] .font-display').first();
  const before = await headline.textContent();
  await page.getByLabel('Your expected return fare (€ per person)').fill('1500');
  await expect(headline).not.toHaveText(before ?? '');
  await page.getByRole('button', { name: 'Reset to the indicative fare' }).click();
  await expect(headline).toHaveText(before ?? '');
});

test('mobile layout has no horizontal overflow @mobile', async ({ page }) => {
  await page.goto('#/explore/D07/3');
  await expect(page.getByRole('heading', { name: 'Total estimated cost — flights included' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
