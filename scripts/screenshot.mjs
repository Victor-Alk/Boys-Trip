#!/usr/bin/env node
/**
 * Capture screenshots of the running site with headless Chromium (visual QA).
 *   node scripts/screenshot.mjs <baseUrl> <outDir> [route ...]
 * Routes are hash routes such as "#/explore/D01/2". Prefix with "m:" for a mobile viewport.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [base = 'http://localhost:5173/', outDir = 'reports/screenshots', ...routes] = process.argv.slice(2);
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const list = routes.length ? routes : ['#/explore'];
for (const r of list) {
  const mobile = r.startsWith('m:');
  const route = mobile ? r.slice(2) : r;
  const ctx = await browser.newContext(
    mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } },
  );
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base + route, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(9000);
  const name = `${mobile ? 'mobile-' : ''}${route.replace(/[#/]+/g, '-').replace(/^-|-$/g, '') || 'home'}.png`;
  await page.screenshot({ path: join(outDir, name) });
  if (mobile) {
    // Long mobile pages exceed the capture limit as one image: also capture the presentation area.
    await page.evaluate(() => document.getElementById('presentation')?.scrollIntoView());
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(outDir, name.replace('.png', '-2.png')) });
  }
  console.log(`${name}${errors.length ? `  errors: ${errors.join(' | ').slice(0, 300)}` : ''}`);
  await ctx.close();
}
await browser.close();
