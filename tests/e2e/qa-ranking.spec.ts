/**
 * A24: the eligible ranking in the browser can never be led by an excluded/conditional destination, a destination
 * above €2,500, one with material budget uncertainty, or an incompletely evaluated one — whatever their scores.
 * Uses the current data (summaries built from data/destinations), so it re-checks A21's latest statuses.
 */
import { expect, test } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { PARTICIPANTS, seedDemoBackend, signIn, useSeededDemo, type SeedVote } from './qa-helpers';
import { Destination } from '../../src/types/destination';
import { EXCEPTIONAL_MAX_EUR, hasMaterialUncertainty, headlineTotals } from '../../src/lib/budget';

const facts = readdirSync('data/destinations').filter((f) => /^D\d{2}-.*\.json$/.test(f)).sort().map((f) => {
  const d = Destination.parse(JSON.parse(readFileSync(`data/destinations/${f}`, 'utf8')));
  return { id: d.id, country: d.country, security: d.security.status, materialUncertainty: hasMaterialUncertainty(d.budget), total: headlineTotals(d.budget).totalPerPerson };
});

test('perfect scores cannot lift ineligible, over-budget, uncertain or incomplete destinations into the ranking', async ({ page }) => {
  test.setTimeout(180_000);
  const tens = { q1: 10, q2: 10, q3: 10, q4: 10, q5: 10 };
  const fives = { q1: 5, q2: 5, q3: 5, q4: 5, q5: 5 };
  const votes: SeedVote[] = [];
  // Every destination gets 10/10 from all four, except Tunisia (D08, eligible, affordable) which gets 5/10 …
  for (const f of facts) for (const pid of PARTICIPANTS) votes.push({ pid, destinationId: f.id, answers: f.id === 'D08' ? fives : tens });
  // … and Taiwan (D01) lacks Victor's vote (incomplete), Sri Lanka (D10) lacks Paco's.
  const seeded = votes.filter((v) => !(v.destinationId === 'D01' && v.pid === 'victor') && !(v.destinationId === 'D10' && v.pid === 'paco'));
  await useSeededDemo(page, seedDemoBackend({ votes: seeded }));
  await page.goto('#/group-results');
  await signIn(page, 'gaetan');
  await expect(page.getByRole('heading', { name: 'Where the group is heading' })).toBeVisible();

  const section = page.locator('section', { has: page.getByRole('heading', { name: /^Eligible ranking/ }) });
  const nameCells = section.locator('tbody tr td:nth-child(2) > span.font-semibold');
  await expect(nameCells.first()).toBeVisible({ timeout: 30_000 }); // results loaded
  await expect(page.getByText('Refreshing…')).toHaveCount(0);
  const rankedNames = (await nameCells.allInnerTexts()).map((s) => s.trim());

  const neverRanked = facts.filter((f) => f.security !== 'eligible' || f.materialUncertainty || f.total > EXCEPTIONAL_MAX_EUR).map((f) => f.country);
  expect(neverRanked.length, 'the current data has ineligible destinations to test with').toBeGreaterThan(3);
  for (const n of neverRanked) expect(rankedNames, `${n} must not be ranked`).not.toContain(n);
  expect(rankedNames, 'incomplete Taiwan').not.toContain('Taiwan');
  expect(rankedNames, 'incomplete Sri Lanka').not.toContain('Sri Lanka');
  // Tunisia (5/10, eligible, complete) is ranked — last, since every other ranked destination has 10/10.
  expect(rankedNames).toContain('Tunisia');
  expect(rankedNames[rankedNames.length - 1]).toBe('Tunisia');
  // The ineligible 10/10 destinations are listed as informational, never as the leader.
  await expect(page.getByRole('heading', { name: /^Informational only/ })).toBeVisible();
  const leader = page.locator('p', { hasText: /^(Provisional leader|Highest-rated eligible destination)$/ }).locator('xpath=..');
  await expect(leader).toBeVisible();
  for (const n of neverRanked) await expect(leader).not.toContainText(n);
  await test.info().attach('ranked.json', { body: JSON.stringify({ rankedNames, neverRanked }, null, 2), contentType: 'application/json' });
});
