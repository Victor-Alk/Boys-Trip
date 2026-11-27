import { useEffect, useState } from 'react';
import { loadDestination, loadImageCredits } from '../lib/data';
import type { Destination, ImageCredit } from '../types/destination';

export interface LoadedDestination {
  data: Destination | null;
  credits: Map<string, ImageCredit>;
  loading: boolean;
  error: string | null;
}

export function useDestination(id: string | null): LoadedDestination {
  const [state, setState] = useState<LoadedDestination>({ data: null, credits: new Map(), loading: !!id, error: null });
  useEffect(() => {
    if (!id) {
      setState({ data: null, credits: new Map(), loading: false, error: null });
      return;
    }
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));
    Promise.all([loadDestination(id), loadImageCredits(id)])
      .then(([data, credits]) => alive && setState({ data, credits, loading: false, error: null }))
      .catch((e: Error) => alive && setState({ data: null, credits: new Map(), loading: false, error: e.message }));
    return () => {
      alive = false;
    };
  }, [id]);
  return state;
}

/** Preload neighbouring destinations' data (not photographs) for snappy navigation. */
export function prefetchDestination(id: string) {
  void loadDestination(id).catch(() => undefined);
  void loadImageCredits(id).catch(() => undefined);
}
