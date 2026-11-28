/**
 * A24: GitHub Pages serves a project site under https://USER.github.io/REPO/. This spec serves the production build
 * (dist/, built by the Playwright webServer) under a sub-path with a minimal static server and checks that every
 * asset — JS chunks, the MapLibre worker, globe textures, photographs — resolves inside that sub-path, and that hash
 * deep links work after a reload.
 */
import { expect, test } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { DESTINATION_IDS } from './qa-helpers';

const SUB = '/BoysTrip/';
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png',
  '.woff2': 'font/woff2', '.woff': 'font/woff',
};
let server: Server;
let base = '';
const outside: string[] = [];

test.beforeAll(async () => {
  const dist = join(process.cwd(), 'dist');
  server = createServer((req, res) => {
    const url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (url === SUB.slice(0, -1)) { res.writeHead(301, { Location: SUB }); res.end(); return; }
    if (!url.startsWith(SUB)) { outside.push(url); res.writeHead(404); res.end('outside the sub-path'); return; }
    let file = normalize(join(dist, url.slice(SUB.length)));
    if (!file.startsWith(dist)) { res.writeHead(403); res.end(); return; }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}${SUB}`;
});

test.afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

test('the production build works under a repository sub-path (GitHub Pages project site)', async ({ page }) => {
  test.setTimeout(180_000);
  const failed: string[] = [];
  page.on('response', (r) => { if (r.status() >= 400 && r.url().startsWith(base.slice(0, base.indexOf(SUB)))) failed.push(`${r.status()} ${r.url()}`); });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  await page.goto(`${base}#/explore/D07/2`);
  await expect(page.getByText('02 — The Journey · What would we actually do?')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('.ge-marker')).toHaveCount(DESTINATION_IDS.length, { timeout: 60_000 });
  const stops = await page.getByRole('list', { name: 'Stops' }).getByRole('listitem').count();
  await expect(page.locator('.ge-stop')).toHaveCount(stops, { timeout: 30_000 }); // MapLibre worker loaded from the sub-path

  await page.goto(`${base}#/explore/D07`);
  const hero = page.locator('[role="region"][aria-label$="presentation"] img').first();
  await expect(hero).toBeVisible();
  await expect.poll(() => hero.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  expect(await hero.evaluate((i: HTMLImageElement) => i.currentSrc)).toContain(SUB);

  for (const route of ['#/group-results', '#/my-evaluations', '#/explore/D20/3']) {
    await page.goto(`${base}${route}`);
    await page.reload();
    await expect(page.getByRole('banner')).toBeVisible();
  }
  // Without the trailing slash GitHub Pages redirects; our server does the same.
  await page.goto(base.slice(0, -1) + '#/explore/D01');
  await expect(page.getByText('01 — The Experience · Why should we go there?')).toBeVisible();

  expect(outside, 'requests that escaped the sub-path (absolute asset URLs)').toEqual([]);
  expect(failed, 'HTTP failures under the sub-path').toEqual([]);
  expect(errors).toEqual([]);
});
