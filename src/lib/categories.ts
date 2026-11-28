/**
 * Trip categories participants can pick ("what kind of trip?"). Each is derived from the researched tags of a
 * destination, so new destinations are categorised automatically and nobody has to maintain a second list.
 */
import type { DestinationSummary } from '../types/summary';

export interface TripCategory {
  id: string;
  label: string;
  icon: string;
  test: (s: DestinationSummary) => boolean;
}

const has = <T extends string>(list: readonly T[], ...values: string[]) => values.some((v) => (list as readonly string[]).includes(v));

export const TRIP_CATEGORIES: TripCategory[] = [
  { id: 'road-trip', label: 'Road trip', icon: '🚙', test: (s) => s.travelStylePrimary === 'road-trip' || has(s.travelStyleTags, 'road-trip', 'self-drive') },
  {
    id: 'nature',
    label: 'Nature',
    icon: '🌿',
    test: (s) => has(s.geographyTags, 'mountains', 'tropical-rainforest', 'subtropical-forest', 'lakes', 'rivers', 'karst', 'glaciers', 'wetlands', 'savanna', 'volcanoes', 'canyons', 'caves', 'hot-springs'),
  },
  {
    id: 'culture',
    label: 'Culture & history',
    icon: '🏛',
    test: (s) => has(s.cultureTags, 'archaeology', 'ancient-civilisations', 'historic-cities', 'religious-heritage', 'islamic-heritage', 'buddhist-heritage', 'christian-heritage', 'hindu-heritage', 'architecture', 'museums', 'colonial-history', 'rock-art'),
  },
  { id: 'food', label: 'Food', icon: '🍜', test: (s) => has(s.cultureTags, 'street-food', 'markets', 'tea-culture') },
  { id: 'people', label: 'Local communities', icon: '🤝', test: (s) => has(s.cultureTags, 'indigenous-cultures', 'minority-cultures', 'homestays', 'nomadic-culture', 'maritime-culture') },
  {
    id: 'adventure',
    label: 'Adventure',
    icon: '🧭',
    test: (s) => s.physicalDifficulty >= 3 || has(s.travelStyleTags, 'trekking', 'desert-expedition', 'guided-expedition', 'boat', 'cycling'),
  },
  { id: 'hiking', label: 'Hiking & trekking', icon: '🥾', test: (s) => has(s.travelStyleTags, 'trekking', 'hiking') || s.travelStylePrimary === 'trekking' },
  { id: 'camping', label: 'Camping', icon: '⛺', test: (s) => s.campingFeasibility === 'excellent' || s.campingFeasibility === 'good' },
  { id: 'wildlife', label: 'Wildlife', icon: '🐘', test: (s) => has(s.travelStyleTags, 'wildlife') || has(s.geographyTags, 'savanna', 'marine') },
  { id: 'coast', label: 'Islands & coast', icon: '🏝', test: (s) => has(s.geographyTags, 'islands', 'coastline', 'marine') || has(s.travelStyleTags, 'island-hopping', 'boat') },
  { id: 'desert', label: 'Desert', icon: '🏜', test: (s) => has(s.geographyTags, 'desert', 'oasis') || has(s.travelStyleTags, 'desert-expedition') },
  { id: 'mountains', label: 'Mountains & volcanoes', icon: '🏔', test: (s) => has(s.geographyTags, 'mountains', 'volcanoes', 'high-altitude-plateau', 'glaciers') },
  { id: 'cities', label: 'Cities', icon: '🏙', test: (s) => has(s.geographyTags, 'urban') || has(s.cultureTags, 'historic-cities', 'contemporary-culture') },
];

export const categoryById = new Map(TRIP_CATEGORIES.map((c) => [c.id, c]));

export function matchesCategories(s: DestinationSummary, ids: string[], mode: 'any' | 'all'): boolean {
  if (ids.length === 0) return true;
  const tests = ids.map((id) => categoryById.get(id)).filter(Boolean) as TripCategory[];
  return mode === 'all' ? tests.every((c) => c.test(s)) : tests.some((c) => c.test(s));
}
