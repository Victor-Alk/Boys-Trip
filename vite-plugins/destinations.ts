/**
 * Vite plugin exposing `virtual:destination-index`: an array of DestinationSummary computed
 * at build time from data/destinations/*.json and data/images/*.json. Full records are loaded
 * lazily in the browser with import.meta.glob, so initial page weight stays small.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Plugin } from 'vite';
import { Destination, type ImageCredit } from '../src/types/destination';
import { computeScenario, hasMaterialUncertainty } from '../src/lib/budget';
import type { DestinationSummary } from '../src/types/summary';

const VIRTUAL_ID = 'virtual:destination-index';
const RESOLVED_ID = `\0${VIRTUAL_ID}`;

export function buildIndex(root: string): DestinationSummary[] {
  const destDir = join(root, 'data/destinations');
  const imgDir = join(root, 'data/images');
  if (!existsSync(destDir)) return [];
  const out: DestinationSummary[] = [];
  for (const file of readdirSync(destDir).filter((f) => /^D\d{2}-.*\.json$/.test(f)).sort()) {
    let parsed;
    try {
      parsed = Destination.safeParse(JSON.parse(readFileSync(join(destDir, file), 'utf8')));
    } catch {
      console.warn(`[destinations] ${file}: invalid JSON, skipped`);
      continue;
    }
    if (!parsed.success) {
      console.warn(`[destinations] ${file}: schema errors, skipped (run npm run validate)`);
      continue;
    }
    const d = parsed.data;
    const credits: ImageCredit[] = existsSync(join(imgDir, `${d.id}.json`))
      ? JSON.parse(readFileSync(join(imgDir, `${d.id}.json`), 'utf8'))
      : [];
    const heroCredit = credits.find((c) => c.id === d.images.hero) ?? null;
    const eco = computeScenario(d.budget, 'economical');
    const real = computeScenario(d.budget, 'realistic');
    const comf = computeScenario(d.budget, 'comfortable');
    out.push({
      id: d.id,
      slug: d.slug,
      version: d.version,
      country: d.country,
      region: d.region,
      continent: d.continent,
      title: d.title,
      subtitle: d.subtitle,
      summary: d.summary,
      coordinates: d.coordinates,
      totalDays: d.duration.totalDays,
      preferredMonth: d.recommendedTravelWindow.preferredMonth,
      travelWindow: d.recommendedTravelWindow.window,
      februaryRating: d.februarySuitability.rating,
      marchRating: d.marchSuitability.rating,
      travelStylePrimary: d.travelStyle.primary,
      travelStyleTags: d.travelStyle.tags,
      geographyTags: d.geography.tags,
      cultureTags: d.culture.tags,
      campingFeasibility: d.camping.feasibility,
      campingNights: d.camping.nights,
      securityStatus: d.security.status,
      securitySummary: d.security.summary,
      itineraryKind: d.itinerary.kind,
      flightsRealistic: real.flightsPerPerson,
      localRealistic: real.localPerPerson,
      totalRealistic: real.totalPerPerson,
      totalEconomical: eco.totalPerPerson,
      totalComfortable: comf.totalPerPerson,
      budgetStatus: real.status,
      materialUncertainty: hasMaterialUncertainty(d.budget),
      physicalDifficulty: d.physicalDifficulty.level,
      hero: heroCredit
        ? { path: heroCredit.path, widths: heroCredit.widths, alt: heroCredit.alt, attribution: heroCredit.attribution }
        : null,
      lastUpdated: d.lastUpdated,
    });
  }
  return out;
}

export function destinationsPlugin(): Plugin {
  let root = process.cwd();
  return {
    name: 'expedition-destinations',
    configResolved(cfg) {
      root = cfg.root;
    },
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID;
      return null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      const dir = join(root, 'data/destinations');
      if (existsSync(dir)) {
        for (const f of readdirSync(dir)) this.addWatchFile(join(dir, f));
      }
      const img = join(root, 'data/images');
      if (existsSync(img)) for (const f of readdirSync(img)) if (f.endsWith('.json')) this.addWatchFile(join(img, f));
      return `export default ${JSON.stringify(buildIndex(root))};`;
    },
    handleHotUpdate(ctx) {
      if (/data[\\/](destinations|images)[\\/]/.test(ctx.file)) {
        const mod = ctx.server.moduleGraph.getModuleById(RESOLVED_ID);
        if (mod) {
          ctx.server.moduleGraph.invalidateModule(mod);
          ctx.server.ws.send({ type: 'full-reload' });
        }
      }
    },
  };
}
