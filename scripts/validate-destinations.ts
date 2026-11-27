/**
 * Validate destination data.
 *   npm run validate            → validate every file; fails if any of the 20 are missing or invalid
 *   npm run validate -- D07     → validate one destination and print its budget totals
 *   npm run validate -- --partial → validate the files that exist without requiring all 20
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDestination, validatePortfolio, missingDestinations, type ValidationResult } from '../src/lib/validation';
import { computeScenario, BUDGET_STATUS_LABEL } from '../src/lib/budget';
import type { ImageCredit } from '../src/types/destination';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const destDir = join(root, 'data/destinations');
const imgDir = join(root, 'data/images');

const args = process.argv.slice(2);
const only = args.filter((a) => /^D\d{2}$/.test(a));
const partial = args.includes('--partial') || only.length > 0;

const files = readdirSync(destDir)
  .filter((f) => /^D\d{2}-.*\.json$/.test(f))
  .filter((f) => only.length === 0 || only.some((id) => f.startsWith(`${id}-`)))
  .sort();

const results: ValidationResult[] = [];
const allCredits = new Map<string, ImageCredit[]>();
for (const file of files) {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(join(destDir, file), 'utf8'));
  } catch (e) {
    results.push({ id: file.slice(0, 3), errors: [`invalid JSON: ${(e as Error).message}`], warnings: [] });
    continue;
  }
  const id = file.slice(0, 3);
  const creditPath = join(imgDir, `${id}.json`);
  const imageCredits = existsSync(creditPath) ? JSON.parse(readFileSync(creditPath, 'utf8')) : undefined;
  if (Array.isArray(imageCredits)) allCredits.set(id, imageCredits as ImageCredit[]);
  results.push(validateDestination(raw, { fileName: file, imageCredits }));
}

let failed = false;
for (const r of results) {
  const status = r.errors.length ? '✗' : '✓';
  console.log(`\n${status} ${r.id}${r.data ? ` — ${r.data.title}` : ''}`);
  for (const e of r.errors) console.log(`   ERROR   ${e}`);
  for (const w of r.warnings) console.log(`   warning ${w}`);
  if (r.errors.length) failed = true;
  if (r.data) {
    const rows = (['economical', 'realistic', 'comfortable'] as const).map((s) => computeScenario(r.data!.budget, s));
    for (const t of rows) {
      console.log(
        `   ${t.scenario.padEnd(12)} flights €${Math.round(t.flightsPerPerson)} + local €${Math.round(t.localSubtotalPerPerson)} + contingency €${Math.round(t.contingencyPerPerson)} = €${Math.round(t.totalPerPerson)} pp / €${Math.round(t.totalGroup)} group  [${BUDGET_STATUS_LABEL[t.status]}]${t.unknownLines.length ? ` (${t.unknownLines.length} unknown)` : ''}`,
      );
    }
    console.log(`   security: ${r.data.security.status} · itinerary: ${r.data.itinerary.kind} · ${r.data.duration.totalDays} days`);
  }
}

const portfolioErrors = validatePortfolio(results, allCredits);
for (const e of portfolioErrors) console.log(`\n✗ portfolio: ${e}`);
if (portfolioErrors.length) failed = true;

if (!partial) {
  const missing = missingDestinations(results.map((r) => r.id));
  if (missing.length) {
    console.log(`\n✗ missing destinations: ${missing.join(', ')}`);
    failed = true;
  }
}

console.log(`\n${failed ? 'FAILED' : 'OK'} — ${results.length} destination file(s) checked`);
process.exit(failed ? 1 : 0);
