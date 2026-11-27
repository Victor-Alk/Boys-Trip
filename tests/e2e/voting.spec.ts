import { expect, test, type Page } from '@playwright/test';

const CODES: Record<string, string> = {
  Paco: 'DEMO-PACO-2027',
  Gaetan: 'DEMO-GAETAN-2027',
  Alvarinn: 'DEMO-ALVARINN-2027',
  Victor: 'DEMO-VICTOR-2027',
};

async function signIn(page: Page, name: string) {
  await page.getByRole('button', { name: /sign in/i }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: new RegExp(name) }).click();
  await dialog.getByLabel('Personal access code').fill(CODES[name]);
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('banner').getByText(name, { exact: true })).toBeVisible();
  // Wait until the participant's saved evaluations have loaded (avoids layout shifts mid-click).
  await expect(page.getByText('Loading your saved evaluations…')).toHaveCount(0);
}

async function answerAll(page: Page, values: number[]) {
  const groups = page.getByRole('radiogroup').filter({ has: page.getByRole('radio', { name: /^10/ }) });
  await expect(groups).toHaveCount(5);
  for (let i = 0; i < 5; i++) await groups.nth(i).getByRole('radio', { name: new RegExp(`^${values[i]}(\\b| —)`) }).click();
}

async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: /sign in to evaluate/i })).toBeVisible();
}

test('evaluate, revise, and reveal results only after all four have voted', async ({ page }) => {
  test.setTimeout(300_000); // four participants; every navigation reloads the WebGL globe in software rendering
  await page.goto('#/explore/D04/evaluate');
  await expect(page.getByRole('region', { name: 'India presentation' }).getByText('Who is evaluating this expedition?')).toBeVisible();

  // Exactly five identical questions, no default selection.
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);

  await signIn(page, 'Paco');
  const save = page.getByRole('button', { name: /save my evaluation/i });
  await answerAll(page, [7, 8, 6, 7, 7]);
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText('✓ Saved on the server')).toBeVisible();
  await expect(page.getByText('7.00')).toBeVisible();

  // Revise → revision 2, still one active evaluation.
  await page.getByRole('button', { name: 'Edit this evaluation' }).click();
  await page.getByRole('radiogroup').first().getByRole('radio', { name: /^9/ }).click();
  await page.getByRole('button', { name: /save my evaluation/i }).click();
  await expect(page.getByText(/revision 2/)).toBeVisible();

  await page.goto('#/my-evaluations');
  await expect(page.getByRole('heading', { name: /Paco’s notebook/ })).toBeVisible();
  await expect(page.getByText('rev. 2')).toBeVisible();
  await expect(page.getByText(/^1$/).first()).toBeVisible();

  // Blind voting: nothing revealed with 1/4.
  await page.goto('#/group-results');
  await expect(page.getByText(/1\/4 evaluated · scores hidden|1\/4/).first()).toBeVisible();

  for (const [name, v] of [['Gaetan', 8], ['Alvarinn', 6], ['Victor', 9]] as const) {
    await signOut(page);
    await page.goto('#/explore/D04/evaluate');
    await signIn(page, name);
    // Regression: the previous participant's confirmation/answers must never remain on screen.
    await expect(page.getByText('✓ Saved on the server')).toHaveCount(0);
    await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
    await answerAll(page, [v, v, v, v, v]);
    await page.getByRole('button', { name: /save my evaluation/i }).click();
    await expect(page.getByText('✓ Saved on the server')).toBeVisible();
  }

  await page.goto('#/group-results');
  // After 4/4, India's collective score is revealed (Paco 7.4, Gaetan 8, Alvarinn 6, Victor 9 → mean 7.6).
  await expect(page.getByText('7.60').first()).toBeVisible();
});
