/**
 * Per-participant planning preferences kept on this device: departure airport label and own
 * flight-price estimates per destination (replacing the indicative CDG reference fare).
 * These are personal planning inputs, not votes, so they are never sent to the backend.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useSession } from './session';

interface ParticipantPrefs {
  departureAirport: string;
  flights: Record<string, number>;
}
interface PrefsState {
  owner: string;
  departureAirport: string;
  setDepartureAirport: (v: string) => void;
  flightOverride: (destinationId: string) => number | null;
  setFlightOverride: (destinationId: string, value: number | null) => void;
  overrides: Record<string, number>;
}

const KEY = 'ge-prefs-v1';
const Ctx = createContext<PrefsState | null>(null);

function readAll(): Record<string, ParticipantPrefs> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { session, selectedParticipant } = useSession();
  const owner = session?.participant.id ?? selectedParticipant ?? 'guest';
  const [all, setAll] = useState<Record<string, ParticipantPrefs>>(readAll);
  const mine = all[owner] ?? { departureAirport: '', flights: {} };

  const write = useCallback(
    (next: ParticipantPrefs) => {
      setAll((prev) => {
        const merged = { ...prev, [owner]: next };
        localStorage.setItem(KEY, JSON.stringify(merged));
        return merged;
      });
    },
    [owner],
  );

  const value = useMemo<PrefsState>(
    () => ({
      owner,
      departureAirport: mine.departureAirport,
      setDepartureAirport: (v) => write({ ...mine, departureAirport: v.slice(0, 60) }),
      flightOverride: (id) => (typeof mine.flights[id] === 'number' ? mine.flights[id] : null),
      setFlightOverride: (id, v) => {
        const flights = { ...mine.flights };
        if (v === null || !Number.isFinite(v) || v < 0) delete flights[id];
        else flights[id] = Math.round(v);
        write({ ...mine, flights });
      },
      overrides: mine.flights,
    }),
    [owner, mine, write],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePreferences(): PrefsState {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePreferences outside PreferencesProvider');
  return v;
}
