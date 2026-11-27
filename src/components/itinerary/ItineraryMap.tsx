/**
 * Itinerary map (MapLibre GL JS). Base: bundled Natural Earth 1:50m countries (public domain),
 * which always works offline; optional Sentinel-2 cloudless satellite tiles by EOX (free, no key).
 * Connections between stops are drawn as dashed straight lines and labelled as schematic —
 * they are never presented as verified road geometry.
 */
import { useEffect, useRef, useState } from 'react';
import { Map as MLMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';

// MapLibre 6 locates its ES-module worker relative to its own module URL. In dev, maplibre-gl is
// excluded from pre-bundling (vite.config.ts) so that works as-is. In production the bundler moves
// the library, so the untouched worker + shared chunk are shipped under vendor/maplibre/
// (vite.config.ts → maplibreWorkerAssets) and the worker URL is set explicitly.
if (import.meta.env.PROD) setWorkerUrl(new URL('vendor/maplibre/maplibre-gl-worker.mjs', document.baseURI).href);
import { feature } from 'topojson-client';
import type { FeatureCollection } from 'geojson';
import type { Stop } from '../../types/destination';

interface Leg {
  from: string;
  to: string;
  mode: string;
}

export interface ItineraryMapProps {
  stops: Stop[];
  legs: Leg[];
  selectedStopId: string | null;
  onSelectStop: (id: string) => void;
  overview: boolean;
}

let countriesPromise: Promise<FeatureCollection> | null = null;
function loadCountries(): Promise<FeatureCollection> {
  countriesPromise ??= import('world-atlas/countries-50m.json').then((m) => {
    const topo = (m.default ?? m) as unknown as Parameters<typeof feature>[0];
    return feature(topo, (topo as unknown as { objects: { countries: never } }).objects.countries) as unknown as FeatureCollection;
  });
  return countriesPromise;
}

const SAT_TILES = 'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg';

const KIND_GLYPH: Record<string, string> = {
  airport: '✈',
  campsite: '⛺',
  hiking: '⛰',
  'hot-spring': '♨',
  'archaeological-site': '◬',
  'historic-site': '◬',
  'religious-site': '✦',
  'natural-site': '❖',
  'national-park': '❖',
  beach: '≈',
};

export default function ItineraryMap({ stops, legs, selectedStopId, onSelectStop, overview }: ItineraryMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const [satellite, setSatellite] = useState(true);
  const [ready, setReady] = useState(false);
  const satelliteRef = useRef(satellite);
  satelliteRef.current = satellite;
  const onSelectRef = useRef(onSelectStop);
  onSelectRef.current = onSelectStop;

  useEffect(() => {
    let cancelled = false;
    let map: MLMap | null = null;
    // Build the complete style up front (sources + layers) so nothing depends on async
    // 'load' callbacks; creation is deferred one tick to avoid StrictMode create/remove churn.
    const timer = window.setTimeout(async () => {
      const countries = regionalSubset(await loadCountries(), stops);
      if (cancelled || !ref.current) return;
      const byId = new Map(stops.map((s) => [s.id, s]));
      const lines = overview
        ? []
        : legs
            .map((l) => [byId.get(l.from), byId.get(l.to), l.mode] as const)
            .filter(([a, b]) => a && b)
            .map(([a, b, mode]) => ({
              type: 'Feature' as const,
              properties: { mode },
              geometry: { type: 'LineString' as const, coordinates: [[a!.lng, a!.lat], [b!.lng, b!.lat]] },
            }));
      map = new MLMap({
        container: ref.current,
        style: {
          version: 8,
          sources: {
            sat: { type: 'raster', tiles: [SAT_TILES], tileSize: 256, maxzoom: 14, attribution: 'Sentinel-2 cloudless — <a href="https://s2maps.eu" target="_blank" rel="noopener">s2maps.eu</a> by EOX IT Services GmbH (contains modified Copernicus Sentinel data)' },
            countries: { type: 'geojson', data: countries },
            legs: { type: 'geojson', data: { type: 'FeatureCollection', features: lines } },
          },
          layers: [
            { id: 'sea', type: 'background', paint: { 'background-color': '#c7d2d4' } },
            { id: 'land', type: 'fill', source: 'countries', paint: { 'fill-color': '#efe6d6' } },
            { id: 'sat', type: 'raster', source: 'sat', layout: { visibility: satelliteRef.current ? 'visible' : 'none' }, paint: { 'raster-saturation': -0.15 } },
            { id: 'borders', type: 'line', source: 'countries', paint: { 'line-color': satelliteRef.current ? '#f4eee2' : '#6b7280', 'line-width': 1, 'line-opacity': 0.75, 'line-dasharray': [3, 2] } },
            { id: 'legs-casing', type: 'line', source: 'legs', layout: { 'line-cap': 'round' }, paint: { 'line-color': '#08111d', 'line-width': 5, 'line-opacity': satelliteRef.current ? 0.55 : 0.15 } },
            {
              id: 'legs',
              type: 'line',
              source: 'legs',
              layout: { 'line-cap': 'round' },
              paint: {
                'line-color': ['match', ['get', 'mode'], 'flight', '#d6bd98', 'boat', '#7cc4dc', 'rail', '#f4eee2', 'trek', '#f0c47a', 'walk', '#f0c47a', '#fbf8f2'],
                'line-width': 2.4,
                'line-dasharray': [2, 1.6],
              },
            },
          ],
        },
        bounds: boundsOf(stops),
        fitBoundsOptions: { padding: 48, maxZoom: 9 },
        attributionControl: { compact: true, customAttribution: 'Borders: Natural Earth (public domain) · Route lines are schematic' },
        cooperativeGestures: true,
        dragRotate: false,
        pitchWithRotate: false,
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
      mapRef.current = map;
      if (import.meta.env.DEV || location.search.includes('debug')) (window as unknown as { __geMap?: MLMap }).__geMap = map;
      map.once('load', () => {
        ref.current?.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
        if (!cancelled) setReady(true);
      });

      stops.forEach((s, i) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = 'ge-stop';
        el.setAttribute('aria-label', `Stop ${i + 1}: ${s.name}`);
        el.innerHTML = `<span class="ge-stop-num">${s.kind === 'airport' || s.kind === 'campsite' ? KIND_GLYPH[s.kind] : i + 1}</span><span class="ge-stop-name">${escapeHtml(s.name)}</span>`;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelectRef.current(s.id);
        });
        const m = new Marker({ element: el, anchor: 'left', offset: [-12, 0] }).setLngLat([s.lng, s.lat]).addTo(map!);
        markersRef.current.set(s.id, m);
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      markersRef.current.clear();
      map?.remove();
      mapRef.current = null;
      setReady(false);
    };
  }, [stops, legs, overview]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setLayoutProperty('sat', 'visibility', satellite ? 'visible' : 'none');
    map.setPaintProperty('borders', 'line-color', satellite ? '#f4eee2' : '#6b7280');
    if (map.getLayer('legs')) map.setPaintProperty('legs-casing', 'line-opacity', satellite ? 0.55 : 0.15);
  }, [satellite, ready]);

  useEffect(() => {
    for (const [id, m] of markersRef.current) m.getElement().classList.toggle('is-active', id === selectedStopId);
    const s = stops.find((x) => x.id === selectedStopId);
    if (s && mapRef.current) mapRef.current.easeTo({ center: [s.lng, s.lat], duration: 600 });
  }, [selectedStopId, stops]);

  return (
    <div className="relative h-full w-full">
      <div ref={ref} className="h-full w-full" />
      <div className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1">
        <span className="rounded-sm bg-midnight-950/75 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wider text-ivory">
          {overview ? 'Geographical overview — not a recommended route' : 'Dashed connections are schematic, not road routes'}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setSatellite((v) => !v)}
        className="absolute bottom-8 left-2 rounded-sm bg-midnight-950/75 px-2 py-1 text-[0.7rem] font-medium text-ivory hover:bg-midnight-900"
        aria-pressed={satellite}
      >
        {satellite ? 'Plain map' : 'Satellite'}
      </button>
    </div>
  );
}

/** Keep only countries near the route: far less GeoJSON for the worker to tile. */
function regionalSubset(fc: FeatureCollection, stops: Stop[]): FeatureCollection {
  const [[w, s], [e, n]] = boundsOf(stops);
  const W = w - 20, S = s - 15, E = e + 20, N = n + 15;
  const features = fc.features.filter((f) => {
    let minX = 180, minY = 90, maxX = -180, maxY = -90;
    const visit = (c: unknown): void => {
      if (Array.isArray(c) && typeof c[0] === 'number') {
        const [x, y] = c as number[];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      } else if (Array.isArray(c)) c.forEach(visit);
    };
    visit((f.geometry as { coordinates?: unknown })?.coordinates);
    return maxX >= W && minX <= E && maxY >= S && minY <= N;
  });
  return { type: 'FeatureCollection', features };
}

function boundsOf(stops: Stop[]): [[number, number], [number, number]] {
  const lats = stops.map((s) => s.lat);
  const lngs = stops.map((s) => s.lng);
  const pad = 0.3;
  return [
    [Math.min(...lngs) - pad, Math.min(...lats) - pad],
    [Math.max(...lngs) + pad, Math.max(...lats) + pad],
  ];
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
