import { describe, expect, it } from 'vitest';
import { classifyBudget, computeScenario, hasMaterialUncertainty, formatEUR } from '../../src/lib/budget';
import { BUDGET_CATEGORIES, type Budget, type BudgetLine } from '../../src/types/destination';

const zero = { economical: 0, realistic: 0, comfortable: 0 };
function na(category: BudgetLine['category'], id: string): BudgetLine {
  return {
    id, category, label: category, sharing: 'individual', basis: 'per-person', unit: 'n/a', quantity: 0,
    unitCostEUR: zero, status: 'not-applicable', confidence: 'estimate', note: '', sourceIds: [],
  };
}

function makeBudget(lines: BudgetLine[], contingency = 10): Budget {
  const present = new Set(lines.map((l) => l.category));
  const filler = BUDGET_CATEGORIES.filter((c) => !present.has(c)).map((c, i) => na(c, `b${50 + i}`));
  return {
    currency: 'EUR', groupSize: 4, priceDate: '2026-11-27',
    flights: {
      methodology: 'test', referenceDeparture: { name: 'CDG', iata: 'CDG' }, arrival: { name: 'X', iata: 'XXX' },
      returnFrom: { name: 'X', iata: 'XXX' }, routing: 'return', indicativeDates: 'x', airlinesOrSource: 'x',
      connections: '1', journeyTime: 'x', baggage: 'x', perPersonEUR: { economical: 500, realistic: 650, comfortable: 900 },
      confidence: 'estimate', checkedAt: '2026-11-27', priceNote: 'x', alternatives: [], sourceIds: [],
    },
    lines: [...lines, ...filler],
    contingencyPercent: { economical: contingency, realistic: contingency, comfortable: contingency },
    assumptions: ['a', 'b', 'c'], unknownCosts: [], materialUncertainty: false, materialUncertaintyNote: '',
    exceptionalJustification: '', scenarioNotes: { economical: 'e', realistic: 'r', comfortable: 'c' }, sourceIds: [],
  };
}

const rental: BudgetLine = {
  id: 'b1', category: 'vehicle-rental', label: '4×4 rental', sharing: 'shared', basis: 'per-vehicle', unit: 'vehicle-day',
  quantity: 10, unitCostEUR: { economical: 80, realistic: 100, comfortable: 150 }, status: 'applicable',
  confidence: 'representative', note: '', sourceIds: [],
};
const insurance: BudgetLine = {
  id: 'b2', category: 'travel-insurance', label: 'Travel insurance', sharing: 'individual', basis: 'per-person',
  unit: 'policy', quantity: 1, unitCostEUR: { economical: 60, realistic: 80, comfortable: 120 }, status: 'applicable',
  confidence: 'estimate', note: '', sourceIds: [],
};
const rooms: BudgetLine = {
  id: 'b3', category: 'accommodation', label: 'Guesthouses, 2 rooms', sharing: 'shared', basis: 'per-room',
  unit: 'room-night', quantity: { economical: 16, realistic: 20, comfortable: 20 },
  unitCostEUR: { economical: 30, realistic: 40, comfortable: 80 }, status: 'applicable', confidence: 'estimate', note: '', sourceIds: [],
};

describe('budget arithmetic', () => {
  it('splits shared costs by four and keeps individual costs per person', () => {
    const t = computeScenario(makeBudget([rental, insurance, rooms]), 'realistic');
    // rental 100×10/4 = 250; insurance 80; rooms 40×20/4 = 200 → 530 local
    expect(t.localSubtotalPerPerson).toBe(530);
    expect(t.contingencyPerPerson).toBeCloseTo(53, 10);
    expect(t.flightsPerPerson).toBe(650);
    expect(t.totalPerPerson).toBeCloseTo(650 + 530 + 53, 10);
    expect(t.totalGroup).toBeCloseTo(4 * (650 + 583), 10);
    expect(t.flightsGroup).toBe(2600);
    expect(t.remainingBelowPreferred).toBeCloseTo(2000 - 1233, 10);
    expect(t.remainingBelowExceptional).toBeCloseTo(2500 - 1233, 10);
  });
  it('uses per-scenario quantities', () => {
    const t = computeScenario(makeBudget([rooms]), 'economical');
    expect(t.byCategory.accommodation).toBe(120); // 30×16/4
  });
  it('contingency applies to local costs only and is never double counted', () => {
    const b = makeBudget([rental], 10);
    const a = computeScenario(b, 'realistic');
    const withOverride = computeScenario(b, 'realistic', { flightOverridePerPerson: 2000 });
    expect(withOverride.contingencyPerPerson).toBe(a.contingencyPerPerson);
    expect(withOverride.totalPerPerson - a.totalPerPerson).toBe(2000 - 650);
    expect(withOverride.flightOverridden).toBe(true);
    const sumGroups = Object.values(a.byGroup).reduce((x, y) => x + y, 0);
    expect(sumGroups).toBeCloseTo(a.totalPerPerson, 10);
  });
  it('unknown costs are reported, not counted as zero silently', () => {
    const unknown: BudgetLine = { ...insurance, id: 'b9', category: 'permits', status: 'unknown', unitCostEUR: { economical: null, realistic: null, comfortable: null } };
    const b = makeBudget([rental, unknown]);
    const t = computeScenario(b, 'realistic');
    expect(t.unknownLines.map((l) => l.id)).toEqual(['b9']);
    expect(hasMaterialUncertainty(b)).toBe(true);
  });
  it('classification thresholds', () => {
    expect(classifyBudget(999)).toBe('very-affordable');
    expect(classifyBudget(1000)).toBe('affordable');
    expect(classifyBudget(1499)).toBe('affordable');
    expect(classifyBudget(1500)).toBe('within-preferred');
    expect(classifyBudget(2000)).toBe('within-preferred');
    expect(classifyBudget(2000.5)).toBe('exceptional');
    expect(classifyBudget(2500)).toBe('exceptional');
    expect(classifyBudget(2501)).toBe('outside-budget');
  });
  it('formats euros', () => {
    expect(formatEUR(1920)).toBe('€1,920');
    expect(formatEUR(-80)).toBe('−€80');
  });
});
