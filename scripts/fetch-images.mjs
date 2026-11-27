#!/usr/bin/env node
/**
 * Resolve, licence-check, download and optimise Wikimedia Commons photographs.
 *
 *   npm run images -- D01            (one destination)
 *   npm run images -- D01 --force    (re-download even if files exist)
 *
 * Input : data/images/manifests/D01.json  — [{ id, commonsFile, location, alt, caption }]
 * Output: public/images/destinations/D01/D01-01-{480,960,1440}.webp
 *         data/images/D01.json            — authoritative credits read from the Commons API
 *
 * Licence metadata is taken from the Commons API (never typed by hand), so attributions
 * cannot be fabricated. Only public-domain, CC0, CC BY and CC BY-SA files are accepted;
 * NC / ND / non-free / unknown licences are rejected and reported.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'TheGreatExpeditionAtlas/1.0 (private non-commercial trip-planning site; attributions retained)';
const WIDTHS = [480, 960, 1440];
const API = 'https://commons.wikimedia.org/w/api.php';

const args = process.argv.slice(2);
const force = args.includes('--force');
const ids = args.filter((a) => /^D\d{2}$/.test(a));
if (ids.length === 0) {
  console.error('usage: npm run images -- D01 [D02 …] [--force]');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function fetchWithRetry(url, opts = {}, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(url, { ...opts, headers: { 'User-Agent': UA, ...(opts.headers ?? {}) } });
    if (res.ok) return res;
    if (res.status === 429 || res.status >= 500) {
      await sleep(1500 * (i + 1) ** 2);
      continue;
    }
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  throw new Error(`gave up after ${tries} attempts: ${url}`);
}

const stripHtml = (s = '') =>
  s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function licenceAccepted(meta) {
  const short = stripHtml(meta.LicenseShortName?.value ?? '');
  const code = (meta.License?.value ?? '').toLowerCase();
  const nonFree = (meta.NonFree?.value ?? '').toString().toLowerCase() === 'true';
  const s = `${short} ${code}`.toLowerCase();
  if (nonFree) return { ok: false, short, reason: 'non-free' };
  if (/\bnc\b|-nc|noncommercial|\bnd\b|-nd|noderiv|fair use/.test(s)) return { ok: false, short, reason: 'NC/ND' };
  if (/cc0|public domain|^pd|\bpd\b|pd-/.test(s)) return { ok: true, short: short || 'Public domain' };
  if (/cc[- ]by(-sa)?[- ]?\d|cc-by(-sa)?-\d|cc by(-sa)? \d/.test(s)) return { ok: true, short };
  return { ok: false, short, reason: `unrecognised licence "${short || code}"` };
}

async function resolveFile(title) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', formatversion: '2', titles: title, prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1920',
  });
  const res = await fetchWithRetry(`${API}?${params}`);
  const json = await res.json();
  const page = json.query?.pages?.[0];
  if (!page || page.missing || !page.imageinfo?.[0]) throw new Error(`not found on Commons: ${title}`);
  return { page, info: page.imageinfo[0] };
}

async function processDestination(id) {
  const manifestPath = join(root, 'data/images/manifests', `${id}.json`);
  if (!existsSync(manifestPath)) throw new Error(`missing manifest ${manifestPath}`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const outDir = join(root, 'public/images/destinations', id);
  mkdirSync(outDir, { recursive: true });
  const credits = [];
  const failures = [];
  for (const entry of manifest) {
    try {
      if (!/^D\d{2}-\d{2}$/.test(entry.id) || !entry.id.startsWith(`${id}-`)) throw new Error(`bad image id ${entry.id}`);
      const { page, info } = await resolveFile(entry.commonsFile);
      if (!/^image\/(jpeg|png|webp|tiff)$/.test(info.mime)) throw new Error(`unsupported mime ${info.mime}`);
      const meta = info.extmetadata ?? {};
      const lic = licenceAccepted(meta);
      if (!lic.ok) throw new Error(`licence rejected (${lic.reason}) for ${entry.commonsFile}`);
      const artist = stripHtml(meta.Artist?.value ?? '') || 'Unknown author (see source page)';
      const licenceUrl = meta.LicenseUrl?.value ?? '';
      const attributionField = stripHtml(meta.Attribution?.value ?? '');
      const attribution = attributionField
        ? `${attributionField} — ${lic.short}, via Wikimedia Commons`
        : `${artist} — ${lic.short}, via Wikimedia Commons`;

      const src = info.thumburl ?? info.url;
      const firstOut = join(outDir, `${entry.id}-${WIDTHS[0]}.webp`);
      let width = info.width;
      let height = info.height;
      const widths = [];
      if (force || !existsSync(firstOut)) {
        const buf = Buffer.from(await (await fetchWithRetry(src)).arrayBuffer());
        const img = sharp(buf, { failOn: 'none' }).rotate();
        const meta2 = await img.metadata();
        width = meta2.width ?? width;
        height = meta2.height ?? height;
        for (const w of WIDTHS) {
          if (w > width && w !== WIDTHS[0]) continue;
          await sharp(buf, { failOn: 'none' }).rotate().resize({ width: Math.min(w, width), withoutEnlargement: true })
            .webp({ quality: w >= 1440 ? 64 : 72, effort: 5 }).toFile(join(outDir, `${entry.id}-${w}.webp`));
          widths.push(w);
        }
        await sleep(400);
      } else {
        for (const w of WIDTHS) if (existsSync(join(outDir, `${entry.id}-${w}.webp`))) widths.push(w);
        const m = await sharp(join(outDir, `${entry.id}-${widths[widths.length - 1]}.webp`)).metadata();
        const scale = info.width / (m.width ?? info.width);
        width = m.width ?? width;
        height = Math.round(info.height / scale);
      }
      const largest = Math.max(...widths);
      const ratio = height / width;
      credits.push({
        id: entry.id,
        destinationId: id,
        path: `images/destinations/${id}/${entry.id}`,
        widths,
        width: Math.min(largest, width),
        height: Math.round(Math.min(largest, width) * ratio),
        commonsFile: page.title,
        sourceUrl: info.descriptionurl,
        photographer: artist,
        licence: lic.short,
        licenceUrl,
        attribution,
        location: entry.location,
        alt: entry.alt,
        caption: entry.caption ?? '',
      });
      console.log(`  ✓ ${entry.id} ${page.title} [${lic.short}] by ${artist.slice(0, 60)}`);
    } catch (e) {
      failures.push(`${entry.id}: ${e.message}`);
      console.log(`  ✗ ${entry.id} ${entry.commonsFile}: ${e.message}`);
    }
  }
  mkdirSync(join(root, 'data/images'), { recursive: true });
  writeFileSync(join(root, 'data/images', `${id}.json`), `${JSON.stringify(credits, null, 2)}\n`);
  console.log(`${id}: ${credits.length} image(s) resolved, ${failures.length} failure(s)`);
  return failures;
}

let anyFail = false;
for (const id of ids) {
  console.log(`\n${id}`);
  try {
    const failures = await processDestination(id);
    if (failures.length) anyFail = true;
  } catch (e) {
    console.error(`  ✗ ${e.message}`);
    anyFail = true;
  }
}
process.exit(anyFail ? 1 : 0);
