import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateDestination, validatePortfolio, missingDestinations } from '../../src/lib/validation';
import { computeScenario, EXCEPTIONAL_MAX_EUR } from '../../src/lib/budget';
import { DESTINATION_IDS, type ImageCredit } from '../../src/types/destination';
import questionnaire from '../../data/questionnaire.json';
import configuration from '../../data/configuration.json';

const root = join(__dirname, '../..');
const files = readdirSync(join(root, 'data/destinations')).filter((f) => /^D\d{2}-.*\.json$/.test(f)).sort();
const load = (f: string) => JSON.parse(readFileSync(join(root, 'data/destinations', f), 'utf8'));
const credits = (id: string) => {
  const p = join(root, 'data/images', `${id}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : undefined;
};

describe('destination portfolio', () => {
  const results = files.map((f) => validateDestination(load(f), { fileName: f, imageCredits: credits(f.slice(0, 3)) }));

  it('contains exactly the 20 principal destinations', () => {
    expect(files).toHaveLength(20);
    expect(missingDestinations(results.map((r) => r.id))).toEqual([]);
  });

  it.each(files)('%s passes schema and semantic validation', (f) => {
    const r = results.find((x) => f.startsWith(x.id))!;
    expect(r.errors).toEqual([]);
  });

  it('has no duplicate ids and no photograph shared between destinations', () => {
    const all = new Map<string, ImageCredit[]>(DESTINATION_IDS.map((id) => [id, credits(id) ?? []]));
    expect(validatePortfolio(results, all)).toEqual([]);
  });

  it('keeps excluded destinations informational and every operational itinerary at 10–15 days', () => {
    for (const r of results) {
      const d = r.data!;
      if (d.security.status === 'excluded') expect(d.itinerary.kind).toBe('informational');
      if (d.itinerary.kind === 'operational') {
        expect(d.duration.totalDays).toBeGreaterThanOrEqual(10);
        expect(d.duration.totalDays).toBeLessThanOrEqual(15);
        expect(d.itinerary.days).toHaveLength(d.duration.totalDays);
      }
    }
  });

  it('includes international flights in every headline total', () => {
    for (const r of results) {
      const t = computeScenario(r.data!.budget, 'realistic');
      expect(t.flightsPerPerson).toBeGreaterThan(0);
      expect(t.totalPerPerson).toBeCloseTo(t.flightsPerPerson + t.localPerPerson, 6);
      if (t.totalPerPerson > 2000) expect(r.data!.budget.exceptionalJustification.length).toBeGreaterThan(40);
      if (t.totalPerPerson > EXCEPTIONAL_MAX_EUR) expect(t.status).toBe('outside-budget');
    }
  });

  it('never stores participant travel histories in public destination data', () => {
    for (const f of files) {
      const text = readFileSync(join(root, 'data/destinations', f), 'utf8');
      for (const p of configuration.participants) expect(text).not.toMatch(new RegExp(`\\b${p.name}\\b`, 'i'));
    }
  });
});

describe('questionnaire', () => {
  it('has exactly five 1–10 questions in the specified order', () => {
    expect(questionnaire.questions.map((q) => q.id)).toEqual(['q1', 'q2', 'q3', 'q4', 'q5']);
    expect(questionnaire.scale).toEqual({ min: 1, max: 10 });
    expect(questionnaire.questions[0].text).toBe('How much would you personally like to go on this expedition?');
  });
});
