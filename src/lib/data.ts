/**
 * Static content access. Summaries are bundled (small); full destination records and image
 * credits are split into lazy chunks and fetched only when a destination is opened.
 */
import index from 'virtual:destination-index';
import questionnaireJson from '../../data/questionnaire.json';
import configurationJson from '../../data/configuration.json';
import { Destination, ImageCreditFile, type Destination as DestinationT, type ImageCredit } from '../types/destination';
import type { DestinationSummary } from '../types/summary';
import type { ParticipantId, QuestionKey } from './statistics';

export const summaries: DestinationSummary[] = index;
export const summaryById = new Map(summaries.map((s) => [s.id, s]));

export interface Question {
  id: QuestionKey;
  key: string;
  label: string;
  text: string;
  minLabel: string;
  maxLabel: string;
}
export const questionnaire = questionnaireJson as { version: string; scale: { min: number; max: number }; commentMaxLength: number; questions: Question[] };

export const configuration = configurationJson as {
  appsScriptUrl: string;
  expedition: { name: string; dates: string; minDays: number; maxDays: number };
  budget: { preferredMaxPerPersonEUR: number; exceptionalMaxPerPersonEUR: number; thresholds: number[]; groupSize: number };
  participants: { id: ParticipantId; name: string }[];
  referenceDepartureAirport: { name: string; iata: string };
};

/** Build-time override (GitHub Actions variable) wins over the committed configuration. */
export const APPS_SCRIPT_URL: string = (import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined)?.trim() || configuration.appsScriptUrl.trim();

export const participantName = (id: string): string => configuration.participants.find((p) => p.id === id)?.name ?? id;

const destinationModules = import.meta.glob<{ default: unknown }>('../../data/destinations/D*.json');
const creditModules = import.meta.glob<{ default: unknown }>('../../data/images/D*.json');

const destCache = new Map<string, Promise<DestinationT>>();
export function loadDestination(id: string): Promise<DestinationT> {
  let p = destCache.get(id);
  if (!p) {
    const key = Object.keys(destinationModules).find((k) => k.split('/').pop()!.startsWith(`${id}-`));
    if (!key) return Promise.reject(new Error(`Unknown destination ${id}`));
    p = destinationModules[key]().then((m) => Destination.parse(m.default));
    p.catch(() => destCache.delete(id));
    destCache.set(id, p);
  }
  return p;
}

const creditCache = new Map<string, Promise<Map<string, ImageCredit>>>();
export function loadImageCredits(id: string): Promise<Map<string, ImageCredit>> {
  let p = creditCache.get(id);
  if (!p) {
    const key = Object.keys(creditModules).find((k) => k.endsWith(`/${id}.json`));
    p = key
      ? creditModules[key]().then((m) => new Map(ImageCreditFile.parse(m.default).map((c) => [c.id, c])))
      : Promise.resolve(new Map());
    creditCache.set(id, p);
  }
  return p;
}

const BASE = import.meta.env.BASE_URL;
export function imageSrc(path: string, width: number): string {
  return `${BASE}${path}-${width}.webp`;
}
export function imageSrcSet(path: string, widths: number[]): string {
  return widths.map((w) => `${imageSrc(path, w)} ${w}w`).join(', ');
}
export function assetUrl(path: string): string {
  return `${BASE}${path.replace(/^\//, '')}`;
}

export const CONTINENTS = Array.from(new Set(summaries.map((s) => s.continent))).sort();
