/**
 * Semantic validation for destination data, shared by the CLI validator, unit tests and CI.
 * Schema validation (types, enums, ranges) is done by zod; this adds cross-field rules.
 */
import {
  BUDGET_CATEGORIES,
  Destination,
  DESTINATION_IDS,
  ImageCreditFile,
  type ImageCredit,
  type Destination as DestinationT,
} from '../types/destination';
import { computeScenario, PREFERRED_MAX_EUR, EXCEPTIONAL_MAX_EUR } from './budget';

export interface ValidationResult {
  id: string;
  errors: string[];
  warnings: string[];
  data?: DestinationT;
}

export function wordCount(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function validateDestination(
  raw: unknown,
  opts: { fileName?: string; imageCredits?: unknown } = {},
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const parsed = Destination.safeParse(raw);
  const rawId = (raw as { id?: string } | null)?.id ?? '???';
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`schema: ${issue.path.join('.')} — ${issue.message}`);
    }
    return { id: rawId, errors, warnings };
  }
  const d = parsed.data;

  if (opts.fileName && !opts.fileName.startsWith(`${d.id}-`)) {
    errors.push(`file name ${opts.fileName} must start with "${d.id}-"`);
  }

  // ---- Sources -------------------------------------------------------
  const sourceIdSet = new Set<string>();
  for (const s of d.sources) {
    if (sourceIdSet.has(s.id)) errors.push(`duplicate source id ${s.id}`);
    sourceIdSet.add(s.id);
  }
  const checkRefs = (where: string, ids: string[] | undefined) => {
    for (const id of ids ?? []) if (!sourceIdSet.has(id)) errors.push(`${where} references unknown source ${id}`);
  };
  checkRefs('climate', d.climate.sourceIds);
  checkRefs('transport', d.transport.sourceIds);
  checkRefs('drivingRequirements', d.drivingRequirements.sourceIds);
  checkRefs('budget', d.budget.sourceIds);
  checkRefs('budget.flights', d.budget.flights.sourceIds);
  d.budget.lines.forEach((l) => checkRefs(`budget line ${l.id}`, l.sourceIds));
  d.signatureExperiences.forEach((e, i) => checkRefs(`signatureExperiences[${i}]`, e.sourceIds));
  d.itinerary.days.forEach((day) => checkRefs(`itinerary day ${day.day}`, day.sourceIds));
  d.security.advisories.forEach((a, i) => checkRefs(`security.advisories[${i}]`, [a.sourceId]));
  const officialAdvisories = d.sources.filter((s) => s.type === 'official-advisory');
  if (officialAdvisories.length < 2) errors.push('security needs at least two official-advisory sources');
  const usedSourceIds = new Set<string>([
    ...d.climate.sourceIds, ...d.transport.sourceIds, ...d.drivingRequirements.sourceIds, ...d.budget.sourceIds,
    ...d.budget.flights.sourceIds, ...d.budget.lines.flatMap((l) => l.sourceIds),
    ...d.signatureExperiences.flatMap((e) => e.sourceIds), ...d.itinerary.days.flatMap((x) => x.sourceIds),
    ...d.security.advisories.map((a) => a.sourceId),
  ]);
  const unused = d.sources.filter((s) => !usedSourceIds.has(s.id)).map((s) => s.id);
  if (unused.length > Math.max(3, d.sources.length / 2)) {
    warnings.push(`many sources are never referenced by a claim: ${unused.join(', ')}`);
  }

  // ---- Presentation text --------------------------------------------
  const introWords = wordCount(d.introduction);
  if (introWords < 60 || introWords > 150) errors.push(`introduction has ${introWords} words (target 80–120)`);
  else if (introWords < 80 || introWords > 120) warnings.push(`introduction has ${introWords} words (target 80–120)`);
  if (/^(discover|visit|explore)\s/i.test(d.title.split('—').pop()?.trim() ?? '')) {
    warnings.push('title looks generic ("Discover/Visit/Explore …")');
  }

  // ---- Route ---------------------------------------------------------
  const stopIds = new Set<string>();
  for (const s of d.route.stops) {
    if (stopIds.has(s.id)) errors.push(`duplicate stop id ${s.id}`);
    stopIds.add(s.id);
    const km = haversineKm(d.coordinates, s);
    if (km > 2500) errors.push(`stop ${s.id} (${s.name}) is ${Math.round(km)} km from the marker — lat/lng swapped?`);
  }
  for (const leg of d.route.legs) {
    if (!stopIds.has(leg.from)) errors.push(`leg references unknown stop ${leg.from}`);
    if (!stopIds.has(leg.to)) errors.push(`leg references unknown stop ${leg.to}`);
  }

  // ---- Itinerary -----------------------------------------------------
  const it = d.itinerary;
  if (d.security.status === 'excluded' && it.kind === 'operational') {
    errors.push('excluded destinations must use an informational itinerary (no bookable-looking plan)');
  }
  if (it.kind === 'operational') {
    if (d.duration.totalDays < 10 || d.duration.totalDays > 15) {
      errors.push(`operational itineraries must last 10–15 days (got ${d.duration.totalDays})`);
    }
    if (it.days.length !== d.duration.totalDays) {
      errors.push(`itinerary has ${it.days.length} days but duration.totalDays is ${d.duration.totalDays}`);
    }
    it.days.forEach((day, idx) => {
      if (day.day !== idx + 1) errors.push(`itinerary day #${idx + 1} is numbered ${day.day}`);
      for (const sid of day.stopIds) if (!stopIds.has(sid)) errors.push(`day ${day.day} references unknown stop ${sid}`);
    });
    if (!it.days.some((x) => x.flexible)) warnings.push('no flexible/contingency day flagged');
    if (d.route.legs.length === 0) warnings.push('operational route has no legs');
  } else if (it.overview.length < 3) {
    errors.push('informational itineraries need at least three overview entries');
  }

  // ---- Budget --------------------------------------------------------
  const lineIds = new Set<string>();
  for (const l of d.budget.lines) {
    if (lineIds.has(l.id)) errors.push(`duplicate budget line id ${l.id}`);
    lineIds.add(l.id);
    const costs = [l.unitCostEUR.economical, l.unitCostEUR.realistic, l.unitCostEUR.comfortable];
    if (l.status === 'not-applicable' && costs.some((c) => c !== 0)) {
      errors.push(`budget line ${l.id} is not-applicable, so all unit costs must be 0`);
    }
    if (l.status === 'applicable' && costs.some((c) => c === null)) {
      errors.push(`budget line ${l.id} is applicable but has an unknown (null) cost — mark it "unknown"`);
    }
    if (l.status === 'unknown' && !costs.some((c) => c === null)) {
      errors.push(`budget line ${l.id} is "unknown" but every cost is filled in`);
    }
    if (l.status !== 'not-applicable') {
      const [e, r, c] = costs;
      if (e !== null && r !== null && c !== null) {
        const q = (s: 'economical' | 'realistic' | 'comfortable') => (typeof l.quantity === 'number' ? l.quantity : l.quantity[s]);
        if (e * q('economical') > r * q('realistic') + 0.01 || r * q('realistic') > c * q('comfortable') + 0.01) {
          warnings.push(`budget line ${l.id} (${l.label}) is not monotonic economical ≤ realistic ≤ comfortable`);
        }
      }
    }
  }
  for (const cat of BUDGET_CATEGORIES) {
    if (!d.budget.lines.some((l) => l.category === cat)) errors.push(`budget is missing category "${cat}" (use not-applicable if irrelevant)`);
  }
  const f = d.budget.flights.perPersonEUR;
  if (!(f.economical <= f.realistic && f.realistic <= f.comfortable)) errors.push('flight prices must satisfy economical ≤ realistic ≤ comfortable');

  const totals = (['economical', 'realistic', 'comfortable'] as const).map((s) => computeScenario(d.budget, s));
  const [eco, real, comf] = totals;
  if (!(eco.totalPerPerson <= real.totalPerPerson && real.totalPerPerson <= comf.totalPerPerson)) {
    errors.push(`scenario totals are incoherent: ${Math.round(eco.totalPerPerson)} / ${Math.round(real.totalPerPerson)} / ${Math.round(comf.totalPerPerson)}`);
  }
  if (real.totalPerPerson > PREFERRED_MAX_EUR && d.budget.exceptionalJustification.trim().length < 40) {
    errors.push(`realistic total €${Math.round(real.totalPerPerson)} exceeds €2,000: exceptionalJustification is required`);
  }
  if (real.unknownLines.length > 0 && !d.budget.materialUncertainty && d.budget.unknownCosts.length === 0) {
    warnings.push('unknown cost lines exist but budget.unknownCosts is empty');
  }
  if (real.totalPerPerson > EXCEPTIONAL_MAX_EUR) {
    warnings.push(`realistic total €${Math.round(real.totalPerPerson)} is outside the €2,500 maximum (informational only)`);
  }

  // ---- Images --------------------------------------------------------
  const referencedImages = new Set<string>([
    d.images.hero, ...d.images.experience, ...d.images.journey, ...d.images.reality,
    ...d.route.stops.flatMap((s) => s.imageIds), ...d.itinerary.days.flatMap((x) => x.imageIds),
    ...d.signatureExperiences.flatMap((e) => (e.imageId ? [e.imageId] : [])),
  ]);
  for (const img of referencedImages) {
    if (!img.startsWith(`${d.id}-`)) errors.push(`image ${img} does not belong to ${d.id}`);
  }
  if (opts.imageCredits === undefined) {
    errors.push(`no resolved image credits found (run: npm run images -- ${d.id})`);
  } else {
    const credits = ImageCreditFile.safeParse(opts.imageCredits);
    if (!credits.success) {
      errors.push(`image credits file is invalid: ${credits.error.issues[0]?.message}`);
    } else {
      const ids = new Set(credits.data.map((c: ImageCredit) => c.id));
      for (const img of referencedImages) if (!ids.has(img)) errors.push(`image ${img} is referenced but has no resolved credit`);
      if (credits.data.length < 6) warnings.push(`only ${credits.data.length} images (target 6–10)`);
    }
  }

  // ---- Security ------------------------------------------------------
  if (d.security.status !== 'eligible' && d.security.reassessmentRequired.length < 20) {
    errors.push('conditional/excluded destinations need an explicit reassessment note');
  }

  return { id: d.id, errors, warnings, data: d };
}

export function validatePortfolio(results: ValidationResult[], allCredits: Map<string, ImageCredit[]>): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const r of results) {
    if (seen.has(r.id)) errors.push(`duplicate destination id ${r.id}`);
    seen.add(r.id);
  }
  // A Commons file may only be used by one destination (no reused hero images).
  const fileOwner = new Map<string, string>();
  for (const [dest, credits] of allCredits) {
    for (const c of credits) {
      const prev = fileOwner.get(c.commonsFile);
      if (prev && prev !== dest) errors.push(`${c.commonsFile} is used by both ${prev} and ${dest}`);
      fileOwner.set(c.commonsFile, dest);
    }
  }
  return errors;
}

export function missingDestinations(ids: string[]): string[] {
  return DESTINATION_IDS.filter((id) => !ids.includes(id));
}
