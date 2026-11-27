/**
 * Lightweight per-destination summary generated at build time (vite-plugins/destinations.ts).
 * The globe, filters and comparison table only need these fields, so the full destination
 * records (and their photographs) are loaded lazily when a destination is opened.
 */
import type {
  Continent,
  CultureTag,
  DestinationId,
  GeographyTag,
  SecurityStatus,
  SuitabilityRating,
  TravelStyleTag,
} from './destination';
import type { BudgetStatus } from '../lib/budget';

export interface HeroImage {
  path: string;
  widths: number[];
  alt: string;
  attribution: string;
}

export interface DestinationSummary {
  id: DestinationId;
  slug: string;
  version: string;
  country: string;
  region: string;
  continent: Continent;
  title: string;
  subtitle: string;
  summary: string;
  coordinates: { lat: number; lng: number; label: string };
  totalDays: number;
  preferredMonth: 'February' | 'March' | 'Either';
  travelWindow: string;
  februaryRating: SuitabilityRating;
  marchRating: SuitabilityRating;
  travelStylePrimary: TravelStyleTag;
  travelStyleTags: TravelStyleTag[];
  geographyTags: GeographyTag[];
  cultureTags: CultureTag[];
  campingFeasibility: 'excellent' | 'good' | 'limited' | 'not-recommended' | 'not-permitted';
  campingNights: number;
  securityStatus: SecurityStatus;
  securitySummary: string;
  itineraryKind: 'operational' | 'informational';
  /** Realistic scenario, dataset flights. */
  flightsRealistic: number;
  /** Local expenditure per person including contingency (realistic). */
  localRealistic: number;
  totalRealistic: number;
  totalEconomical: number;
  totalComfortable: number;
  budgetStatus: BudgetStatus;
  materialUncertainty: boolean;
  physicalDifficulty: number;
  hero: HeroImage | null;
  lastUpdated: string;
}
