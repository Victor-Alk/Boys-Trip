/**
 * Budget methodology (single source of truth, see docs/methodology/budget.md).
 *
 *  - Each budget line has a unit cost and a quantity per scenario.
 *  - sharing = "individual": every traveller pays unitCost × quantity.
 *  - sharing = "shared": the group pays unitCost × quantity, divided by groupSize (4).
 *  - Contingency = contingencyPercent × local subtotal (all non-flight lines). It is never a
 *    line in the data, so it cannot be double counted, and it does not scale with flight prices.
 *  - Headline total per person = international flights + local subtotal + contingency.
 *  - Unknown unit costs (null) are excluded from the arithmetic and reported, never treated as 0.
 */
import type { Budget, BudgetCategory, BudgetLine, Scenario } from '../types/destination';

export const PREFERRED_MAX_EUR = 2000;
export const EXCEPTIONAL_MAX_EUR = 2500;
export const BUDGET_THRESHOLDS = [1000, 1500, 2000, 2500] as const;

export type BudgetStatus =
  | 'very-affordable'
  | 'affordable'
  | 'within-preferred'
  | 'exceptional'
  | 'outside-budget';

export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  'very-affordable': 'Very affordable',
  affordable: 'Affordable',
  'within-preferred': 'Within preferred budget',
  exceptional: 'Exceptional expenditure',
  'outside-budget': 'Outside budget',
};

/** Classification table from the brief (per person, flights included). */
export function classifyBudget(totalPerPerson: number): BudgetStatus {
  if (totalPerPerson < 1000) return 'very-affordable';
  if (totalPerPerson < 1500) return 'affordable';
  if (totalPerPerson <= PREFERRED_MAX_EUR) return 'within-preferred';
  if (totalPerPerson <= EXCEPTIONAL_MAX_EUR) return 'exceptional';
  return 'outside-budget';
}

/** Coarse tier used for filters and the ranking rule. */
export function budgetTier(status: BudgetStatus): 'preferred' | 'exceptional' | 'outside' {
  if (status === 'exceptional') return 'exceptional';
  if (status === 'outside-budget') return 'outside';
  return 'preferred';
}

export function lineQuantity(line: BudgetLine, scenario: Scenario): number {
  return typeof line.quantity === 'number' ? line.quantity : line.quantity[scenario];
}

export interface LineCost {
  line: BudgetLine;
  /** null when the unit cost is unknown for this scenario */
  perPerson: number | null;
  group: number | null;
}

export function lineCost(line: BudgetLine, scenario: Scenario, groupSize = 4): LineCost {
  if (line.status === 'not-applicable') return { line, perPerson: 0, group: 0 };
  const unit = line.unitCostEUR[scenario];
  if (unit === null) return { line, perPerson: null, group: null };
  const qty = lineQuantity(line, scenario);
  const raw = unit * qty;
  const perPerson = line.sharing === 'individual' ? raw : raw / groupSize;
  return { line, perPerson, group: perPerson * groupSize };
}

/** Display groups for charts (kept small so bars stay legible). */
export const CATEGORY_GROUP: Record<BudgetCategory, string> = {
  baggage: 'Flights & baggage',
  'domestic-flights': 'Domestic transport',
  'public-transport': 'Domestic transport',
  'private-drivers': 'Domestic transport',
  'vehicle-rental': 'Vehicle',
  'vehicle-insurance': 'Vehicle',
  fuel: 'Vehicle',
  'tolls-parking': 'Vehicle',
  accommodation: 'Accommodation',
  'campsite-fees': 'Accommodation',
  'camping-equipment': 'Accommodation',
  food: 'Food & water',
  'drinking-water': 'Food & water',
  'entrance-fees': 'Activities & guides',
  activities: 'Activities & guides',
  guides: 'Activities & guides',
  visas: 'Visas, permits & insurance',
  permits: 'Visas, permits & insurance',
  'travel-insurance': 'Visas, permits & insurance',
};

export const DISPLAY_GROUPS = [
  'Flights & baggage',
  'Domestic transport',
  'Vehicle',
  'Accommodation',
  'Food & water',
  'Activities & guides',
  'Visas, permits & insurance',
  'Contingency',
] as const;
export type DisplayGroup = (typeof DISPLAY_GROUPS)[number];

export const CATEGORY_LABEL: Record<BudgetCategory, string> = {
  baggage: 'Checked baggage',
  'domestic-flights': 'Domestic flights',
  'vehicle-rental': 'Vehicle rental',
  'vehicle-insurance': 'Vehicle insurance',
  fuel: 'Fuel',
  'tolls-parking': 'Tolls & parking',
  'public-transport': 'Public transport',
  'private-drivers': 'Private drivers',
  accommodation: 'Accommodation',
  'campsite-fees': 'Campsite fees',
  'camping-equipment': 'Camping equipment',
  food: 'Food',
  'drinking-water': 'Drinking water',
  'entrance-fees': 'Entrance fees',
  activities: 'Activities',
  guides: 'Guides',
  visas: 'Visas',
  permits: 'Permits',
  'travel-insurance': 'Travel insurance',
};

export interface ScenarioTotals {
  scenario: Scenario;
  flightsPerPerson: number;
  flightsGroup: number;
  /** Sum of known local lines, per person (excludes contingency). */
  localSubtotalPerPerson: number;
  contingencyPercent: number;
  contingencyPerPerson: number;
  /** Local subtotal + contingency, per person. */
  localPerPerson: number;
  localGroup: number;
  totalPerPerson: number;
  totalGroup: number;
  remainingBelowPreferred: number;
  remainingBelowExceptional: number;
  status: BudgetStatus;
  unknownLines: BudgetLine[];
  lines: LineCost[];
  byCategory: Record<BudgetCategory, number>;
  byGroup: Record<DisplayGroup, number>;
  flightOverridden: boolean;
}

export function computeScenario(
  budget: Budget,
  scenario: Scenario,
  opts: { flightOverridePerPerson?: number | null } = {},
): ScenarioTotals {
  const groupSize = budget.groupSize;
  const override = opts.flightOverridePerPerson;
  const flightOverridden = typeof override === 'number' && Number.isFinite(override) && override >= 0;
  const flightsPerPerson = flightOverridden ? (override as number) : budget.flights.perPersonEUR[scenario];

  const lines = budget.lines.map((l) => lineCost(l, scenario, groupSize));
  const unknownLines = lines.filter((l) => l.perPerson === null).map((l) => l.line);
  const byCategory = Object.fromEntries(
    (Object.keys(CATEGORY_GROUP) as BudgetCategory[]).map((c) => [c, 0]),
  ) as Record<BudgetCategory, number>;
  let localSubtotalPerPerson = 0;
  for (const l of lines) {
    if (l.perPerson === null) continue;
    byCategory[l.line.category] += l.perPerson;
    localSubtotalPerPerson += l.perPerson;
  }
  const contingencyPercent = budget.contingencyPercent[scenario];
  const contingencyPerPerson = (localSubtotalPerPerson * contingencyPercent) / 100;
  const localPerPerson = localSubtotalPerPerson + contingencyPerPerson;
  const totalPerPerson = flightsPerPerson + localPerPerson;

  const byGroup = Object.fromEntries(DISPLAY_GROUPS.map((g) => [g, 0])) as Record<DisplayGroup, number>;
  byGroup['Flights & baggage'] += flightsPerPerson;
  for (const [cat, v] of Object.entries(byCategory) as [BudgetCategory, number][]) {
    byGroup[CATEGORY_GROUP[cat] as DisplayGroup] += v;
  }
  byGroup.Contingency = contingencyPerPerson;

  return {
    scenario,
    flightsPerPerson,
    flightsGroup: flightsPerPerson * groupSize,
    localSubtotalPerPerson,
    contingencyPercent,
    contingencyPerPerson,
    localPerPerson,
    localGroup: localPerPerson * groupSize,
    totalPerPerson,
    totalGroup: totalPerPerson * groupSize,
    remainingBelowPreferred: PREFERRED_MAX_EUR - totalPerPerson,
    remainingBelowExceptional: EXCEPTIONAL_MAX_EUR - totalPerPerson,
    status: classifyBudget(totalPerPerson),
    unknownLines,
    lines,
    byCategory,
    byGroup,
    flightOverridden,
  };
}

/** Realistic scenario with dataset flights: the principal comparison figure. */
export function headlineTotals(budget: Budget, flightOverridePerPerson?: number | null): ScenarioTotals {
  return computeScenario(budget, 'realistic', { flightOverridePerPerson });
}

/** Material uncertainty blocks definitive ranking (rule 3). */
export function hasMaterialUncertainty(budget: Budget): boolean {
  if (budget.materialUncertainty) return true;
  return budget.lines.some((l) => l.status !== 'not-applicable' && l.unitCostEUR.realistic === null);
}

export function formatEUR(value: number, opts: { compact?: boolean } = {}): string {
  const rounded = Math.round(value);
  const s = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(Math.abs(rounded));
  return `${rounded < 0 ? '−' : ''}€${opts.compact && Math.abs(rounded) >= 10000 ? `${(Math.abs(rounded) / 1000).toFixed(1)}k` : s}`;
}
