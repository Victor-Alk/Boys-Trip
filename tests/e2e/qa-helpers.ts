/**
 * Shared helpers for the A24 red-team e2e specs (qa-*.spec.ts).
 *
 * Demo mode runs the real backend/apps-script/*.gs sources in the page (backend/emulator) and persists the
 * emulated spreadsheet in localStorage under `ge-demo-backend-v1`. `seedDemoBackend` builds that state in
 * Node with the SAME .gs code (logins + submissions go through doPost), so a test can start from "three
 * participants have already voted" under any reveal policy without clicking through four sign-ins.
 */
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';
import { createAppsScriptEmulator } from '../../backend/emulator/index.js';
import { loadBackendSources } from '../../backend/emulator/node.js';

export const PARTICIPANTS = ['paco', 'gaetan', 'alvarinn', 'victor'] as const;
export type Pid = (typeof PARTICIPANTS)[number];
export const NAMES: Record<Pid, string> = { paco: 'Paco', gaetan: 'Gaetan', alvarinn: 'Alvarinn', victor: 'Victor' };
/** Fictitious demo codes (src/lib/api.ts → DEMO_ACCESS_CODES). */
export const DEMO_CODES: Record<Pid, string> = {
  paco: 'DEMO-PACO-2027',
  gaetan: 'DEMO-GAETAN-2027',
  alvarinn: 'DEMO-ALVARINN-2027',
  victor: 'DEMO-VICTOR-2027',
};
export const DEMO_STORAGE_KEY = 'ge-demo-backend-v1';
// Every destination on disk: the original 20 plus any added later from participants' proposals.
export const DESTINATION_IDS = readdirSync(fileURLToPath(new URL('../../data/destinations/', import.meta.url)))
  .filter((f) => /^D\d{2}-.*\.json$/.test(f))
  .map((f) => f.slice(0, 3))
  .sort();

export type Answers = { q1: number; q2: number; q3: number; q4: number; q5: number };
export interface SeedVote {
  pid: Pid;
  destinationId: string;
  answers: Answers;
  comments?: string;
}

/**
 * Builds a demo-backend state with the real .gs code: Script Properties (e.g. RESULTS_REVEAL_POLICY),
 * the demo credentials (same salts as src/lib/api.ts, so the browser can sign in with the demo codes) and
 * the given votes.
 */
export function seedDemoBackend(opts: { properties?: Record<string, string>; votes?: SeedVote[] } = {}): unknown {
  const emu = createAppsScriptEmulator({
    sources: loadBackendSources(),
    properties: { SESSION_SECRET: 'qa-seeded-demo-session-secret-0123456789abcdef', ...(opts.properties ?? {}) },
  });
  const creds: Record<string, unknown> = {};
  for (const p of PARTICIPANTS) creds[p] = emu.call('buildCredential_', p, DEMO_CODES[p], `demo-salt-${p}-2027`);
  emu.setProperty('PARTICIPANT_CREDENTIALS', JSON.stringify(creds));
  emu.call('setup');
  const tokens: Partial<Record<Pid, string>> = {};
  for (const v of opts.votes ?? []) {
    if (!tokens[v.pid]) {
      const r = emu.doPost({ action: 'login', payload: { participantId: v.pid, accessCode: DEMO_CODES[v.pid] } });
      if (!r.ok) throw new Error(`seed login failed: ${JSON.stringify(r.error)}`);
      tokens[v.pid] = r.data.token;
    }
    const r = emu.doPost({
      action: 'submit',
      token: tokens[v.pid],
      requestId: crypto.randomUUID(),
      payload: { destinationId: v.destinationId, answers: v.answers, comments: v.comments ?? '', questionnaireVersion: 'q1', destinationVersion: '1.0.0' },
    });
    if (!r.ok) throw new Error(`seed submit failed: ${JSON.stringify(r.error)}`);
  }
  // Clear the cache (login throttling / idempotency entries) so the browser starts clean.
  emu.clearCache();
  return JSON.parse(JSON.stringify(emu.state));
}

/** Installs a seeded demo state before any page script runs (only once per context, so reloads keep it). */
export async function useSeededDemo(page: Page, state: unknown): Promise<void> {
  await page.addInitScript(
    ([key, json]) => {
      if (!sessionStorage.getItem('qa-seeded')) {
        localStorage.clear();
        localStorage.setItem(key, json);
        sessionStorage.setItem('qa-seeded', '1');
      }
    },
    [DEMO_STORAGE_KEY, JSON.stringify(state)] as const,
  );
}

export async function signIn(page: Page, pid: Pid): Promise<void> {
  const name = NAMES[pid];
  await page.getByRole('button', { name: /sign in/i }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: new RegExp(name) }).click();
  await dialog.getByLabel('Personal access code').fill(DEMO_CODES[pid]);
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('banner').getByText(name, { exact: true })).toBeVisible();
  await expect(page.getByText('Loading your saved evaluations…')).toHaveCount(0);
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('button', { name: /sign in to evaluate/i })).toBeVisible();
}

export async function answerAll(page: Page, values: number[]): Promise<void> {
  const groups = page.getByRole('radiogroup').filter({ has: page.getByRole('radio', { name: /^10/ }) });
  await expect(groups).toHaveCount(5);
  for (let i = 0; i < 5; i++) await groups.nth(i).getByRole('radio', { name: new RegExp(`^${values[i]}(\\b| —)`) }).click();
}

/** Horizontal overflow of the document in CSS px (≤ 1 is treated as none). */
export async function horizontalOverflow(page: Page): Promise<{ overflow: number; offenders: string[] }> {
  return page.evaluate(() => {
    const de = document.documentElement;
    const overflow = Math.max(de.scrollWidth, document.body.scrollWidth) - de.clientWidth;
    const offenders: string[] = [];
    if (overflow > 1) {
      const vw = de.clientWidth;
      for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > vw + 1) {
          // Ignore descendants of horizontally scrollable containers (they do not widen the page).
          let p: HTMLElement | null = el.parentElement;
          let clipped = false;
          while (p && p !== document.body) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') { clipped = true; break; }
            p = p.parentElement;
          }
          if (!clipped) offenders.push(`${el.tagName.toLowerCase()}.${String(el.className).slice(0, 60)} right=${Math.round(r.right)}`);
        }
        if (offenders.length >= 8) break;
      }
    }
    return { overflow, offenders };
  });
}

/** Collects page errors, console errors and same-origin HTTP failures for the lifetime of the page. */
export function collectProblems(page: Page, origin: string) {
  const problems = { pageErrors: [] as string[], consoleErrors: [] as string[], httpErrors: [] as string[], externalFailures: [] as string[] };
  page.on('pageerror', (e) => problems.pageErrors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') problems.consoleErrors.push(m.text().slice(0, 300));
  });
  page.on('response', (r) => {
    if (r.status() >= 400) (r.url().startsWith(origin) ? problems.httpErrors : problems.externalFailures).push(`${r.status()} ${r.url()}`);
  });
  page.on('requestfailed', (r) => {
    const msg = `${r.failure()?.errorText ?? 'failed'} ${r.url()}`;
    if (r.url().startsWith(origin)) problems.httpErrors.push(msg);
    else problems.externalFailures.push(msg);
  });
  return problems;
}
