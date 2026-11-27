/**
 * Minimal hash router (GitHub Pages cannot rewrite paths, so every route lives after "#").
 *   #/explore                 #/explore/D07          #/explore/D07/2 (slide 1–3)
 *   #/explore/D07/evaluate    #/my-evaluations        #/group-results
 */
import { useSyncExternalStore } from 'react';

export type Page = 'explore' | 'my-evaluations' | 'group-results';
export interface Route {
  page: Page;
  destinationId: string | null;
  slide: 1 | 2 | 3;
  evaluate: boolean;
}

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const page = (['explore', 'my-evaluations', 'group-results'] as const).find((p) => p === parts[0]) ?? 'explore';
  const route: Route = { page, destinationId: null, slide: 1, evaluate: false };
  if (page === 'explore' && parts[1] && /^D\d{2}$/.test(parts[1])) {
    route.destinationId = parts[1];
    if (parts[2] === 'evaluate') route.evaluate = true;
    else if (parts[2] === '2' || parts[2] === '3') route.slide = Number(parts[2]) as 2 | 3;
  }
  return route;
}

export function routeToHash(r: Partial<Route> & { page: Page }): string {
  if (r.page !== 'explore') return `#/${r.page}`;
  if (!r.destinationId) return '#/explore';
  if (r.evaluate) return `#/explore/${r.destinationId}/evaluate`;
  if (r.slide && r.slide > 1) return `#/explore/${r.destinationId}/${r.slide}`;
  return `#/explore/${r.destinationId}`;
}

export function navigate(r: Partial<Route> & { page: Page }, opts: { replace?: boolean } = {}): void {
  const hash = routeToHash(r);
  if (hash === window.location.hash) return;
  if (opts.replace) {
    history.replaceState(null, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = hash;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

let lastHash = '';
let lastRoute: Route = parseHash('');
function snapshot(): Route {
  const h = window.location.hash;
  if (h !== lastHash) {
    lastHash = h;
    lastRoute = parseHash(h);
  }
  return lastRoute;
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, snapshot, () => lastRoute);
}
