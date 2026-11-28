/**
 * THE GREAT EXPEDITION 2027 — shared destination data schema.
 *
 * One schema for every destination (the 20 principal ones and later additions). Destination JSON files in data/destinations/
 * are validated against it at build time (scripts/validate-destinations.ts) and in CI.
 * Derived values (budget totals, budget status) are computed in src/lib/budget.ts and
 * are never stored in the JSON, so they cannot drift.
 *
 * Participant-specific information (travel histories, novelty) is NOT part of this
 * schema: it is private and is served only by the authenticated Apps Script backend.
 */
import { z } from 'zod';

export const DESTINATION_IDS = [
  'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10',
  'D11', 'D12', 'D13', 'D14', 'D15', 'D16', 'D17', 'D18', 'D19', 'D20',
] as const;
/** The original portfolio; destinations researched later from participants' proposals use D21, D22, … */
export const PRINCIPAL_DESTINATION_IDS = DESTINATION_IDS;
export const DestinationId = z.string().regex(/^D\d{2}$/, 'Destination ids look like D07');
export type DestinationId = z.infer<typeof DestinationId>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const text = z.string().trim().min(1);
const sourceId = z.string().regex(/^S\d{2,3}$/, 'Source ids look like S01');
const sourceIds = z.array(sourceId).default([]);
const imageId = z.string().regex(/^D\d{2}-\d{2}$/, 'Image ids look like D01-03');
const imageIds = z.array(imageId).default([]);

export const SuitabilityRating = z.enum(['excellent', 'good', 'fair', 'poor', 'unsuitable']);
export type SuitabilityRating = z.infer<typeof SuitabilityRating>;

export const SecurityStatus = z.enum(['eligible', 'conditional', 'excluded']);
export type SecurityStatus = z.infer<typeof SecurityStatus>;

export const Continent = z.enum([
  'Asia', 'Middle East', 'Africa', 'Europe', 'North America', 'Central America', 'South America', 'Oceania',
]);
export type Continent = z.infer<typeof Continent>;

export const GeographyTag = z.enum([
  'desert', 'mountains', 'volcanoes', 'tropical-rainforest', 'subtropical-forest', 'islands', 'coastline',
  'canyons', 'rivers', 'lakes', 'high-altitude-plateau', 'grasslands', 'rural-agricultural', 'urban',
  'caves', 'karst', 'oasis', 'marine', 'glaciers', 'wetlands', 'savanna', 'hot-springs',
]);
export type GeographyTag = z.infer<typeof GeographyTag>;

export const CultureTag = z.enum([
  'archaeology', 'ancient-civilisations', 'religious-heritage', 'islamic-heritage', 'buddhist-heritage',
  'christian-heritage', 'hindu-heritage', 'indigenous-cultures', 'minority-cultures', 'colonial-history',
  'historic-cities', 'architecture', 'markets', 'street-food', 'music', 'festivals', 'crafts', 'homestays',
  'contemporary-culture', 'museums', 'pilgrimage', 'nomadic-culture', 'rock-art', 'tea-culture', 'maritime-culture',
]);
export type CultureTag = z.infer<typeof CultureTag>;

export const TravelStyleTag = z.enum([
  'road-trip', 'self-drive', 'hired-driver', 'rail', 'public-transport', 'trekking', 'hiking', 'camping',
  'boat', 'island-hopping', 'desert-expedition', 'guided-expedition', 'cycling', 'wildlife', 'mixed',
]);
export type TravelStyleTag = z.infer<typeof TravelStyleTag>;

export const Requirement = z.enum([
  'guide', 'permit', 'technical-skills', 'special-equipment', 'driving-licence', 'fitness', 'weather-dependent',
]);
export type Requirement = z.infer<typeof Requirement>;

export const RiskLevel = z.enum(['low', 'moderate', 'elevated', 'high', 'severe']);
export type RiskLevel = z.infer<typeof RiskLevel>;

/* ------------------------------------------------------------------ */
/* Sources                                                            */
/* ------------------------------------------------------------------ */

export const SourceType = z.enum([
  'official-advisory', 'official-tourism', 'government', 'unesco', 'national-park', 'meteorological',
  'transport', 'operator', 'accommodation', 'rental', 'reference', 'news', 'flight-search', 'other',
]);

export const Source = z.object({
  id: sourceId,
  title: text,
  url: z.url(),
  publisher: text,
  type: SourceType,
  publishedAt: z.string().nullable().default(null),
  accessedAt: isoDate,
  claims: z.array(text).min(1),
});
export type Source = z.infer<typeof Source>;

/* ------------------------------------------------------------------ */
/* Climate & seasonality                                              */
/* ------------------------------------------------------------------ */

const tempRange = z.tuple([z.number().min(-40).max(55), z.number().min(-40).max(55)]);

export const MonthClimate = z.object({
  dayTempC: tempRange,
  nightTempC: tempRange,
  rainfall: text,
  humidity: z.string().default(''),
  notes: z.string().default(''),
});

export const Climate = z.object({
  regionNote: text,
  february: MonthClimate,
  march: MonthClimate,
  snowAndMountainAccess: z.string().default(''),
  seaConditions: z.string().default(''),
  airQuality: z.string().default(''),
  wildlifeSeasonality: z.string().default(''),
  holidaysAndFestivals: z.array(z.object({ name: text, dates: text, impact: text })).default([]),
  ramadan2027: z.string().default(''),
  lunarNewYear2027: z.string().default(''),
  tourismDemand: text,
  flightPriceSeasonality: text,
  sourceIds,
});

export const MonthSuitability = z.object({ rating: SuitabilityRating, summary: text });

/* ------------------------------------------------------------------ */
/* Experiences                                                        */
/* ------------------------------------------------------------------ */

export const SignatureExperience = z.object({
  title: text,
  description: text,
  whyDistinctive: text,
  location: text,
  howToOrganise: text,
  costPerPersonEUR: z.number().min(0).nullable(),
  costNote: z.string().default(''),
  requiresGuide: z.boolean(),
  requiresPermit: z.boolean(),
  imageId: imageId.optional(),
  sourceIds,
});

export const CulturalHighlight = z.object({
  name: text,
  kind: text,
  description: text,
  immersive: z.boolean().default(false),
});

export const AdventureHighlight = z.object({
  name: text,
  description: text,
  requires: z.array(Requirement).default([]),
});

/* ------------------------------------------------------------------ */
/* Itinerary & route                                                  */
/* ------------------------------------------------------------------ */

export const StopKind = z.enum([
  'airport', 'city', 'town', 'village', 'historic-site', 'archaeological-site', 'religious-site',
  'natural-site', 'national-park', 'campsite', 'hiking', 'hot-spring', 'viewpoint', 'beach',
  'transport-hub', 'region',
]);
export type StopKind = z.infer<typeof StopKind>;

export const Stop = z.object({
  id: z.string().regex(/^s\d{1,2}$/, 'Stop ids look like s1'),
  name: text,
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  kind: StopKind,
  days: z.array(z.number().int().min(1).max(15)).default([]),
  description: text,
  activities: z.array(text).default([]),
  culturalImportance: z.string().default(''),
  geography: z.string().default(''),
  transport: z.string().default(''),
  accommodation: z.string().default(''),
  estimatedCostEUR: z.number().min(0).nullable().default(null),
  costNote: z.string().default(''),
  imageIds,
});
export type Stop = z.infer<typeof Stop>;

export const LegMode = z.enum(['drive', '4x4', 'hired-driver', 'rail', 'bus', 'flight', 'boat', 'trek', 'bicycle', 'walk']);
export type LegMode = z.infer<typeof LegMode>;

export const Leg = z.object({
  from: z.string(),
  to: z.string(),
  mode: LegMode,
  /** Connections are never presented as verified road geometry. */
  geometry: z.enum(['schematic']).default('schematic'),
  durationText: z.string().default(''),
  distanceKm: z.number().min(0).nullable().default(null),
});

export const Route = z.object({
  stops: z.array(Stop).min(2),
  legs: z.array(Leg).default([]),
  routingNote: text,
});

export const ItineraryDay = z.object({
  day: z.number().int().min(1).max(15),
  from: text,
  to: text,
  title: text,
  activities: z.array(text).min(1),
  transport: text,
  travelTime: text,
  distanceKm: z.number().min(0).nullable(),
  accommodation: text,
  culturalHighlight: z.string().default(''),
  geographicalHighlight: z.string().default(''),
  practical: z.string().default(''),
  flexible: z.boolean().default(false),
  stopIds: z.array(z.string()).default([]),
  imageIds,
  sourceIds,
});
export type ItineraryDay = z.infer<typeof ItineraryDay>;

export const Itinerary = z.object({
  /** operational = a realistic, recommended day-by-day plan; informational = concept only (excluded routes). */
  kind: z.enum(['operational', 'informational']),
  summary: text,
  days: z.array(ItineraryDay).default([]),
  /** For informational itineraries: regions / themes described instead of a bookable plan. */
  overview: z.array(z.object({ name: text, description: text })).default([]),
});

/* ------------------------------------------------------------------ */
/* Budget                                                             */
/* ------------------------------------------------------------------ */

export const SCENARIOS = ['economical', 'realistic', 'comfortable'] as const;
export const Scenario = z.enum(SCENARIOS);
export type Scenario = z.infer<typeof Scenario>;

/** Every destination must include at least one line for each category (use status not-applicable where genuinely irrelevant). */
export const BUDGET_CATEGORIES = [
  'baggage', 'domestic-flights', 'vehicle-rental', 'vehicle-insurance', 'fuel', 'tolls-parking',
  'public-transport', 'private-drivers', 'accommodation', 'campsite-fees', 'camping-equipment', 'food',
  'drinking-water', 'entrance-fees', 'activities', 'guides', 'visas', 'permits', 'travel-insurance',
] as const;
export const BudgetCategory = z.enum(BUDGET_CATEGORIES);
export type BudgetCategory = z.infer<typeof BudgetCategory>;

const perScenarioNumber = z.object({ economical: z.number().min(0), realistic: z.number().min(0), comfortable: z.number().min(0) });
const perScenarioCost = z.object({
  economical: z.number().min(0).nullable(),
  realistic: z.number().min(0).nullable(),
  comfortable: z.number().min(0).nullable(),
});

export const BudgetLine = z.object({
  id: z.string().regex(/^b\d{1,2}$/, 'Budget line ids look like b1'),
  category: BudgetCategory,
  label: text,
  /** individual = each traveller pays unitCost × quantity; shared = group pays unitCost × quantity, split by groupSize. */
  sharing: z.enum(['individual', 'shared']),
  basis: z.enum(['per-person', 'per-group', 'per-day', 'per-vehicle', 'per-room', 'per-activity']),
  unit: text,
  quantity: z.union([z.number().min(0), perScenarioNumber]),
  unitCostEUR: perScenarioCost,
  status: z.enum(['applicable', 'not-applicable', 'unknown']),
  confidence: z.enum(['observed', 'representative', 'estimate']),
  note: z.string().default(''),
  sourceIds,
});
export type BudgetLine = z.infer<typeof BudgetLine>;

export const Airport = z.object({ name: text, iata: z.string().regex(/^[A-Z]{3}$/) });

export const Flights = z.object({
  methodology: text,
  referenceDeparture: Airport,
  arrival: Airport,
  returnFrom: Airport,
  routing: z.enum(['return', 'open-jaw']),
  indicativeDates: text,
  airlinesOrSource: text,
  connections: text,
  journeyTime: text,
  baggage: text,
  perPersonEUR: perScenarioNumber,
  confidence: z.enum(['observed', 'representative', 'estimate']),
  checkedAt: isoDate,
  priceNote: text,
  alternatives: z.array(z.object({
    airport: Airport,
    realisticPerPersonEUR: z.number().min(0),
    confidence: z.enum(['observed', 'representative', 'estimate']),
    note: z.string().default(''),
  })).default([]),
  sourceIds,
});

export const Budget = z.object({
  currency: z.literal('EUR'),
  groupSize: z.literal(4),
  priceDate: isoDate,
  flights: Flights,
  lines: z.array(BudgetLine).min(BUDGET_CATEGORIES.length),
  /** Contingency is computed from the local subtotal (never a line) to prevent double counting. */
  contingencyPercent: z.object({
    economical: z.number().min(0).max(25),
    realistic: z.number().min(0).max(25),
    comfortable: z.number().min(0).max(25),
  }),
  assumptions: z.array(text).min(3),
  unknownCosts: z.array(text).default([]),
  materialUncertainty: z.boolean(),
  materialUncertaintyNote: z.string().default(''),
  exceptionalJustification: z.string().default(''),
  scenarioNotes: z.object({ economical: text, realistic: text, comfortable: text }),
  sourceIds,
});
export type Budget = z.infer<typeof Budget>;

/* ------------------------------------------------------------------ */
/* Security                                                           */
/* ------------------------------------------------------------------ */

export const Advisory = z.object({
  authority: text,
  level: text,
  regionsAffected: text,
  routeImpact: text,
  sourceId,
  checkedAt: isoDate,
});

const riskEntry = z.object({ level: RiskLevel, note: text });

export const Security = z.object({
  status: SecurityStatus,
  summary: text,
  assessedRoute: text,
  checkedAt: isoDate,
  advisories: z.array(Advisory).min(2),
  conflictRisk: riskEntry,
  terrorismRisk: riskEntry,
  kidnappingRisk: riskEntry,
  regionalRestrictions: z.array(text).default([]),
  ordinaryRisks: z.array(text).default([]),
  medicalAccess: text,
  insuranceConsiderations: text,
  reassessmentRequired: text,
});
export type Security = z.infer<typeof Security>;

/* ------------------------------------------------------------------ */
/* Destination                                                        */
/* ------------------------------------------------------------------ */

export const Destination = z.object({
  id: DestinationId,
  slug: z.string().regex(/^[a-z0-9-]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  lastUpdated: isoDate,
  country: text,
  region: text,
  continent: Continent,
  title: text,
  subtitle: text,
  summary: text,
  introduction: text,
  exceptional: z.object({ vsOman: text, vsPackageTourism: text, vsPortfolio: text }),
  coordinates: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), label: text }),
  duration: z.object({
    totalDays: z.number().int().min(1).max(21),
    internationalTravelDays: z.number().int().min(0).max(4),
    note: z.string().default(''),
  }),
  recommendedTravelWindow: z.object({
    preferredMonth: z.enum(['February', 'March', 'Either']),
    window: text,
    rationale: text,
  }),
  februarySuitability: MonthSuitability,
  marchSuitability: MonthSuitability,
  climate: Climate,
  geography: z.object({
    tags: z.array(GeographyTag).min(1),
    summary: text,
    distinctive: text,
    landscapes: z.array(z.object({ name: text, type: GeographyTag, description: text })).min(2),
  }),
  culture: z.object({ tags: z.array(CultureTag).min(1), summary: text }),
  culturalHighlights: z.array(CulturalHighlight).min(3),
  adventureHighlights: z.array(AdventureHighlight).min(2),
  signatureExperiences: z.array(SignatureExperience).min(3).max(5),
  travelStyle: z.object({ primary: TravelStyleTag, tags: z.array(TravelStyleTag).min(1), summary: text }),
  transport: z.object({
    summary: text,
    modes: z.array(z.object({ mode: text, description: text })).min(1),
    carRental: text,
    sourceIds,
  }),
  drivingRequirements: z.object({
    selfDriveFeasible: z.boolean(),
    summary: text,
    internationalDrivingPermit: text,
    licenceNotes: text,
    motorcycleNotes: text,
    recommendedApproach: text,
    sourceIds,
  }),
  accommodation: z.object({ summary: text, types: z.array(text).min(1) }),
  camping: z.object({
    feasibility: z.enum(['excellent', 'good', 'limited', 'not-recommended', 'not-permitted']),
    nights: z.number().int().min(0).max(15),
    summary: text,
  }),
  physicalDifficulty: z.object({
    level: z.number().int().min(1).max(5),
    label: z.enum(['easy', 'moderate', 'demanding', 'strenuous', 'very strenuous']),
    summary: text,
  }),
  itinerary: Itinerary,
  route: Route,
  budget: Budget,
  security: Security,
  practicalRequirements: z.object({
    visa: text,
    entry: text,
    passportValidity: text,
    permits: z.array(text).default([]),
    insurance: text,
    connectivity: text,
    payments: text,
    medical: text,
    fuel: z.string().default(''),
    equipment: z.array(text).default([]),
  }),
  advantages: z.array(text).min(3),
  disadvantages: z.array(text).min(3),
  uncertainties: z.array(text).min(1),
  images: z.object({
    hero: imageId,
    experience: z.array(imageId).min(2).max(3),
    journey: z.array(imageId).min(1),
    reality: z.array(imageId).default([]),
  }),
  sources: z.array(Source).min(8),
  portfolioNote: z.string().default(''),
  /** principal = one of the original 20; participant-proposal = researched from a prompt in the Prompts tab. */
  origin: z
    .object({
      type: z.enum(['principal', 'participant-proposal']),
      promptId: z.string().regex(/^P[A-Z0-9]{6,16}$/).optional(),
      proposedAt: isoDate.optional(),
    })
    .default({ type: 'principal' }),
});
export type Destination = z.infer<typeof Destination>;
export type DestinationInput = z.input<typeof Destination>;

/* ------------------------------------------------------------------ */
/* Resolved image credits (written by scripts/fetch-images.mjs)       */
/* ------------------------------------------------------------------ */

export const ImageCredit = z.object({
  id: imageId,
  destinationId: DestinationId,
  /** Path (relative to the site base) without width suffix, e.g. images/destinations/D01/D01-01 */
  path: z.string(),
  widths: z.array(z.number().int()).min(1),
  width: z.number().int(),
  height: z.number().int(),
  commonsFile: z.string(),
  sourceUrl: z.url(),
  photographer: text,
  licence: text,
  licenceUrl: z.string().default(''),
  attribution: text,
  location: text,
  alt: text,
  caption: z.string().default(''),
});
export type ImageCredit = z.infer<typeof ImageCredit>;
export const ImageCreditFile = z.array(ImageCredit);

export const ImageManifestEntry = z.object({
  id: imageId,
  commonsFile: z.string().regex(/^File:.+/),
  location: text,
  alt: text,
  caption: z.string().default(''),
});
export const ImageManifest = z.array(ImageManifestEntry).min(6).max(16);
