/**
 * A24: mobile layout at 390 × 844 (iPhone 12–15 class) — no horizontal page overflow on any page, touch swipe
 * between slides. The viewport is set here explicitly, so these checks also run in the desktop-chromium project
 * that CI executes (the config's mobile project is never run by .github/workflows/test.yml).
 */
import { expect, test } from '@playwright/test';
import { horizontalOverflow, seedDemoBackend, signIn, useSeededDemo, type Answers, type SeedVote } from './qa-helpers';

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

const a = (q1: number, q2 = q1, q3 = q1, q4 = q1, q5 = q1): Answers => ({ q1, q2, q3, q4, q5 });
const votes: SeedVote[] = [];
for (const [pid, s] of [['paco', 7], ['gaetan', 8], ['alvarinn', 6], ['victor', 9]] as const) {
  votes.push({ pid, destinationId: 'D08', answers: a(s, s - 1, s, s, s), comments: `${pid} likes Tunisia` });
  votes.push({ pid, destinationId: 'D04', answers: a(s - 1), comments: '' });
  votes.push({ pid, destinationId: 'D02', answers: a(10), comments: 'excluded but loved' });
}
votes.push({ pid: 'victor', destinationId: 'D10', answers: a(5, 6, 7, 8, 9), comments: 'a long comment '.repeat(30) });

const ROUTES = ['#/explore', '#/explore/D07', '#/explore/D07/2', '#/explore/D07/3', '#/explore/D07/evaluate', '#/explore/D02/2', '#/explore/D20/3'];

test('no horizontal overflow on Explore (cover, slides 1–3, evaluation) @mobile', async ({ page }) => {
  test.setTimeout(180_000);
  const failures: string[] = [];
  for (const r of ROUTES) {
    await page.goto(r);
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(1200);
    const { overflow, offenders } = await horizontalOverflow(page);
    if (overflow > 1) failures.push(`${r}: +${overflow}px ${offenders.join(' | ')}`);
  }
  expect(failures).toEqual([]);
});

test('no horizontal overflow on My evaluations and Group results, signed out and signed in @mobile', async ({ page }) => {
  test.setTimeout(180_000);
  await useSeededDemo(page, seedDemoBackend({ votes }));
  const failures: string[] = [];
  for (const r of ['#/my-evaluations', '#/group-results']) {
    await page.goto(r);
    await page.waitForTimeout(800);
    const o = await horizontalOverflow(page);
    if (o.overflow > 1) failures.push(`${r} (signed out): +${o.overflow}px ${o.offenders.join(' | ')}`);
  }
  await page.goto('#/explore/D08/evaluate');
  await signIn(page, 'victor');
  for (const r of ['#/my-evaluations', '#/group-results', '#/explore/D08/evaluate']) {
    await page.goto(r);
    await page.waitForTimeout(1500);
    const o = await horizontalOverflow(page);
    if (o.overflow > 1) failures.push(`${r} (signed in): +${o.overflow}px ${o.offenders.join(' | ')}`);
  }
  // Sanity: the seeded, revealed data is really on screen (Tunisia complete 4/4).
  await page.goto('#/group-results');
  await expect(page.getByRole('heading', { name: 'Where the group is heading' })).toBeVisible();
  expect(failures).toEqual([]);
});

test('touch swipe moves between slides; vertical scroll does not @mobile', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('#/explore/D07');
  await expect(page.getByText('01 — The Experience · Why should we go there?')).toBeVisible();
  const cdp = await page.context().newCDPSession(page);
  const swipe = async (x0: number, x1: number, y0: number, y1: number) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= 5; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / 5, y: y0 + ((y1 - y0) * i) / 5 }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  /** Vertical centre of a visible text element of the current slide (never the map, which opts out of swipes). */
  const yOf = async (text: string) => {
    const el = page.getByText(text).first();
    await el.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -200)); // clear the sticky header
    const b = (await el.boundingBox())!;
    return b.y + b.height / 2;
  };
  let y = await yOf('Signature experiences');
  await swipe(330, 60, y, y); // swipe left → next slide
  await expect(page).toHaveURL(/#\/explore\/D07\/2$/);
  y = await yOf('02 — The Journey · What would we actually do?');
  await swipe(60, 330, y, y + 10); // swipe right → previous slide
  await expect(page).toHaveURL(/#\/explore\/D07$/);
  y = await yOf('Signature experiences');
  await swipe(200, 180, y + 150, y - 150); // mostly vertical → no slide change
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/#\/explore\/D07$/);
});

test('after “Next →” at the bottom of a slide, the phone shows the START of the next slide @mobile', async ({ page }) => {
  // FIXME(A24-QA-06): PresentationPanel.tsx scrolls only its inner .panel-scroll container on slide change
  // (useEffect → scrollRef.scrollTo). Below the lg breakpoint that container does not scroll — the window does —
  // so the reader lands thousands of pixels into the middle of the next slide. Run with QA_RUN_FIXME=1 to see it fail.
  test.fixme(!process.env.QA_RUN_FIXME, 'Known defect A24-QA-06 (owner A22): mobile slide change keeps the old scroll offset');
  await page.goto('#/explore/D07');
  await expect(page.getByText('01 — The Experience · Why should we go there?')).toBeVisible();
  const next = page.getByRole('button', { name: 'Next →' });
  await next.scrollIntoViewIfNeeded();
  await next.click();
  const eyebrow = page.getByText('02 — The Journey · What would we actually do?');
  await expect(eyebrow).toBeAttached();
  await page.waitForTimeout(800);
  const top = (await eyebrow.boundingBox())!.y;
  expect(top, 'slide 2 heading position relative to the viewport (px)').toBeGreaterThan(-50);
  expect(top).toBeLessThan(844);
});
