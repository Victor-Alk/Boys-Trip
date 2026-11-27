import type { SecurityStatus, SuitabilityRating } from '../types/destination';

const OVERRIDES: Record<string, string> = {
  'road-trip': 'Road trip',
  'self-drive': 'Self-drive',
  'hired-driver': 'Hired driver',
  'public-transport': 'Public transport',
  'island-hopping': 'Island hopping',
  'desert-expedition': 'Desert expedition',
  'guided-expedition': 'Guided expedition',
  'tropical-rainforest': 'Rainforest',
  'subtropical-forest': 'Subtropical forest',
  'high-altitude-plateau': 'High plateau',
  'rural-agricultural': 'Rural farmland',
  'hot-springs': 'Hot springs',
  'ancient-civilisations': 'Ancient civilisations',
  'religious-heritage': 'Religious heritage',
  'islamic-heritage': 'Islamic heritage',
  'buddhist-heritage': 'Buddhist heritage',
  'christian-heritage': 'Christian heritage',
  'hindu-heritage': 'Hindu heritage',
  'indigenous-cultures': 'Indigenous cultures',
  'minority-cultures': 'Minority cultures',
  'colonial-history': 'Colonial history',
  'historic-cities': 'Historic cities',
  'street-food': 'Street food',
  'contemporary-culture': 'Contemporary culture',
  'nomadic-culture': 'Nomadic culture',
  'rock-art': 'Rock art',
  'tea-culture': 'Tea culture',
  'maritime-culture': 'Maritime culture',
  'not-recommended': 'Not recommended',
  'not-permitted': 'Not permitted',
  '4x4': '4×4',
};

export function tagLabel(tag: string): string {
  if (OVERRIDES[tag]) return OVERRIDES[tag];
  const s = tag.replace(/-/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const SECURITY_LABEL: Record<SecurityStatus, string> = {
  eligible: 'Eligible',
  conditional: 'Conditional',
  excluded: 'Excluded',
};
export const SECURITY_DESCRIPTION: Record<SecurityStatus, string> = {
  eligible: 'No identified material conflict with the group’s security requirements on the assessed route.',
  conditional: 'Significant uncertainty or unresolved route restrictions — cannot enter the eligible ranking.',
  excluded: 'Conflicts with the group’s security requirements — informational only.',
};

export const RATING_LABEL: Record<SuitabilityRating, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  unsuitable: 'Unsuitable',
};
export const RATING_SCORE: Record<SuitabilityRating, number> = { excellent: 4, good: 3, fair: 2, poor: 1, unsuitable: 0 };

export function bestTimingLabel(feb: SuitabilityRating, mar: SuitabilityRating, preferred: string): string {
  const febOk = RATING_SCORE[feb] >= 3;
  const marOk = RATING_SCORE[mar] >= 3;
  if (febOk && marOk) return preferred === 'Either' ? 'Feb or Mar' : `Both · ${preferred.slice(0, 3)} best`;
  if (febOk) return 'February';
  if (marOk) return 'March';
  return preferred === 'Either' ? 'Marginal' : `${preferred} (marginal)`;
}

export const pad2 = (n: number) => String(n).padStart(2, '0');
export const destNumber = (id: string) => id.slice(1);
