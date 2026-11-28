import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { buildIndex } from '../../vite-plugins/destinations';
import { TRIP_CATEGORIES, matchesCategories } from '../../src/lib/categories';

const summaries = buildIndex(join(__dirname, '../..'));

describe('trip categories', () => {
  it.each(TRIP_CATEGORIES.map((c) => [c.label, c.id]))('"%s" matches at least one destination', (_l, id) => {
    expect(summaries.some((s) => matchesCategories(s, [id], 'any'))).toBe(true);
  });
  it('"all" is never broader than "any", and no selection keeps everything', () => {
    const pick = ['road-trip', 'culture'];
    const any = summaries.filter((s) => matchesCategories(s, pick, 'any')).length;
    const all = summaries.filter((s) => matchesCategories(s, pick, 'all')).length;
    expect(all).toBeLessThanOrEqual(any);
    expect(summaries.filter((s) => matchesCategories(s, [], 'all'))).toHaveLength(summaries.length);
  });
});
