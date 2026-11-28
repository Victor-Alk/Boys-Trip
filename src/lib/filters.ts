import type { DestinationSummary } from '../types/summary';
import { RATING_SCORE } from './labels';
import type { NoveltyEntry } from './api';
import { matchesCategories } from './categories';

export interface Filters {
  q: string;
  continent: string;
  country: string;
  maxBudget: number; // per person, flights included (Infinity = any)
  febSuitable: boolean;
  marSuitable: boolean;
  minDays: number;
  maxDays: number;
  style: string;
  geography: string;
  culture: string;
  camping: boolean;
  newToAll: boolean;
  eligibleOnly: boolean;
  mine: 'all' | 'done' | 'todo';
  categories: string[];
  categoryMode: 'any' | 'all';
}

export const DEFAULT_FILTERS: Filters = {
  q: '',
  continent: '',
  country: '',
  maxBudget: Infinity,
  febSuitable: false,
  marSuitable: false,
  minDays: 0,
  maxDays: 99,
  style: '',
  geography: '',
  culture: '',
  camping: false,
  newToAll: false,
  eligibleOnly: false,
  mine: 'all',
  categories: [],
  categoryMode: 'any',
};

export function activeFilterCount(f: Filters): number {
  let n = 0;
  for (const k of Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]) {
    if (k === 'categories' || k === 'categoryMode') continue;
    if (f[k] !== DEFAULT_FILTERS[k]) n++;
  }
  return n + (f.categories.length > 0 ? 1 : 0);
}

export interface FilterContext {
  totalFor: (s: DestinationSummary) => number;
  novelty: Record<string, NoveltyEntry> | null;
  evaluated: Set<string> | null;
}

export function matches(s: DestinationSummary, f: Filters, ctx: FilterContext): boolean {
  if (f.q) {
    const hay = `${s.country} ${s.region} ${s.title} ${s.subtitle} ${s.summary} ${s.geographyTags.join(' ')} ${s.cultureTags.join(' ')}`.toLowerCase();
    if (!f.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
  }
  if (!matchesCategories(s, f.categories, f.categoryMode)) return false;
  if (f.continent && s.continent !== f.continent) return false;
  if (f.country && s.country !== f.country) return false;
  if (Number.isFinite(f.maxBudget) && ctx.totalFor(s) > f.maxBudget) return false;
  if (f.febSuitable && RATING_SCORE[s.februaryRating] < 3) return false;
  if (f.marSuitable && RATING_SCORE[s.marchRating] < 3) return false;
  if (s.totalDays < f.minDays || s.totalDays > f.maxDays) return false;
  if (f.style && !s.travelStyleTags.includes(f.style as never) && s.travelStylePrimary !== f.style) return false;
  if (f.geography && !s.geographyTags.includes(f.geography as never)) return false;
  if (f.culture && !s.cultureTags.includes(f.culture as never)) return false;
  if (f.camping && !['excellent', 'good'].includes(s.campingFeasibility)) return false;
  if (f.newToAll && !ctx.novelty?.[s.id]?.newToAll) return false;
  if (f.eligibleOnly && s.securityStatus !== 'eligible') return false;
  if (f.mine !== 'all' && ctx.evaluated) {
    const done = ctx.evaluated.has(s.id);
    if (f.mine === 'done' ? !done : done) return false;
  }
  return true;
}

const SECURITY_ORDER = { eligible: 0, conditional: 1, excluded: 2 } as const;
/** Default order: security-eligible first, then by affordability (not a quality judgement). */
export function defaultOrder(a: DestinationSummary, b: DestinationSummary, totalFor: (s: DestinationSummary) => number): number {
  return SECURITY_ORDER[a.securityStatus] - SECURITY_ORDER[b.securityStatus] || totalFor(a) - totalFor(b) || a.id.localeCompare(b.id);
}
