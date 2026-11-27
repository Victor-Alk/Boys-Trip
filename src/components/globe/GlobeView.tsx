/**
 * Interactive 3D globe (react-globe.gl / Three.js). Loaded lazily; if WebGL is unavailable the
 * Explore page falls back to the searchable destination list, which is always present anyway.
 *
 * Markers are HTML elements so they are keyboard focusable, screen-reader labelled and can encode
 * security status by SHAPE (circle / diamond / square) as well as colour.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { feature } from 'topojson-client';
import type { FeatureCollection } from 'geojson';
import type { DestinationSummary } from '../../types/summary';
import { assetUrl } from '../../lib/data';
import { budgetTier } from '../../lib/budget';

export interface GlobeViewProps {
  destinations: DestinationSummary[];
  selectedId: string | null;
  highlightedIds: Set<string> | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null, anchor: DOMRect | null) => void;
  satellite: boolean;
  resetSignal: number;
}

const HOME_VIEW = { lat: 18, lng: 38, altitude: 2.35 };
const SAT_URL = (x: number, y: number, l: number) =>
  `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/${l}/${y}/${x}.jpg`;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export default function GlobeView({ destinations, selectedId, highlightedIds, onSelect, onHover, satellite, resetSignal }: GlobeViewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const [size, setSize] = useState({ w: 600, h: 600 });
  const [countries, setCountries] = useState<object[]>([]);
  const [zoomedIn, setZoomedIn] = useState(false);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const destsRef = useRef(destinations);
  destsRef.current = destinations;
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  onSelectRef.current = onSelect;
  onHoverRef.current = onHover;

  // Responsive canvas size.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.max(200, Math.round(width)), h: Math.max(240, Math.round(height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Country outlines (Natural Earth 1:110m via world-atlas, public domain), loaded lazily.
  useEffect(() => {
    let alive = true;
    import('world-atlas/countries-110m.json').then((m) => {
      const topo = (m.default ?? m) as unknown as Parameters<typeof feature>[0];
      const fc = feature(topo, (topo as unknown as { objects: { countries: never } }).objects.countries) as unknown as FeatureCollection;
      if (alive) setCountries(fc.features);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Pause rendering when the globe is off-screen or the tab is hidden.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let visible = true;
    const apply = () => {
      const g = globeRef.current;
      if (!g) return;
      if (visible && document.visibilityState === 'visible') g.resumeAnimation();
      else g.pauseAnimation();
    };
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      apply();
    });
    io.observe(el);
    document.addEventListener('visibilitychange', apply);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', apply);
    };
  }, []);

  const onReady = useCallback(() => {
    const g = globeRef.current;
    if (!g) return;
    g.renderer().setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    const controls = g.controls() as unknown as { autoRotate: boolean; autoRotateSpeed: number; minDistance: number; maxDistance: number; enableDamping: boolean; addEventListener: (t: string, f: () => void) => void };
    controls.minDistance = 130;
    controls.maxDistance = 520;
    controls.enableDamping = true;
    controls.autoRotate = !prefersReducedMotion() && !selectedRef.current;
    controls.autoRotateSpeed = 0.35;
    controls.addEventListener('start', () => {
      controls.autoRotate = false;
    });
    const sel = destsRef.current.find((x) => x.id === selectedRef.current);
    g.pointOfView(sel ? { lat: sel.coordinates.lat - 4, lng: sel.coordinates.lng, altitude: 1.45 } : HOME_VIEW, 0);
  }, []);

  // Centre on the selected destination.
  useEffect(() => {
    const g = globeRef.current;
    if (!g || !selectedId) return;
    const d = destinations.find((x) => x.id === selectedId);
    if (!d) return;
    const controls = g.controls() as unknown as { autoRotate: boolean };
    controls.autoRotate = false;
    const alt = Math.min(g.pointOfView().altitude, 1.45);
    g.pointOfView({ lat: d.coordinates.lat - 4, lng: d.coordinates.lng, altitude: Math.max(alt, 0.9) }, prefersReducedMotion() ? 0 : 1200);
  }, [selectedId, destinations]);

  useEffect(() => {
    if (resetSignal === 0) return;
    globeRef.current?.pointOfView(HOME_VIEW, prefersReducedMotion() ? 0 : 1000);
  }, [resetSignal]);

  // Marker DOM elements are created once per destination and restyled in place.
  const elements = useRef(new Map<string, HTMLElement>());
  const makeMarker = useCallback((obj: object) => {
    const d = obj as DestinationSummary;
    const existing = elements.current.get(d.id);
    if (existing) return existing;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `ge-marker ge-${d.securityStatus} ge-budget-${budgetTier(d.budgetStatus)}`;
    el.dataset.id = d.id;
    el.setAttribute('aria-label', `${d.country}${d.region ? ` — ${d.region}` : ''}: ${d.title}. Security ${d.securityStatus}.`);
    el.innerHTML = `<span class="ge-pin"><span class="ge-num">${d.id.slice(1)}</span></span><span class="ge-label">${d.country}${
      budgetTier(d.budgetStatus) !== 'preferred' ? `<em>${budgetTier(d.budgetStatus) === 'exceptional' ? '€+' : '€!'}</em>` : ''
    }</span>`;
    el.style.pointerEvents = 'auto';
    el.addEventListener('click', (ev) => {
      ev.stopPropagation();
      onSelectRef.current(d.id);
    });
    el.addEventListener('pointerenter', () => onHoverRef.current(d.id, el.getBoundingClientRect()));
    el.addEventListener('pointerleave', () => onHoverRef.current(null, null));
    el.addEventListener('focus', () => onHoverRef.current(d.id, el.getBoundingClientRect()));
    el.addEventListener('blur', () => onHoverRef.current(null, null));
    elements.current.set(d.id, el);
    return el;
  }, []);

  useEffect(() => {
    for (const [id, el] of elements.current) {
      el.classList.toggle('is-selected', id === selectedId);
      el.classList.toggle('marker-pulse', id === selectedId);
      el.classList.toggle('is-dimmed', !!highlightedIds && !highlightedIds.has(id));
      el.setAttribute('aria-pressed', String(id === selectedId));
    }
  });

  const visibility = useCallback((el: HTMLElement, isVisible: boolean) => {
    el.style.opacity = isVisible ? '' : '0';
    el.style.pointerEvents = isVisible ? 'auto' : 'none';
    el.tabIndex = isVisible ? 0 : -1;
  }, []);

  const markers = useMemo(() => destinations.map((d) => ({ ...d, lat: d.coordinates.lat, lng: d.coordinates.lng })), [destinations]);

  return (
    <div ref={wrapRef} className={`ge-globe absolute inset-0 ${zoomedIn ? 'ge-zoomed' : ''}`}>
      <Globe
        ref={globeRef}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        globeImageUrl={satellite ? null : assetUrl('globe/earth-blue-marble.jpg')}
        bumpImageUrl={satellite ? null : assetUrl('globe/earth-topology.png')}
        globeTileEngineUrl={satellite ? SAT_URL : null}
        showAtmosphere
        atmosphereColor="#d6bd98"
        atmosphereAltitude={0.17}
        showGraticules
        polygonsData={countries}
        polygonCapColor={() => 'rgba(0,0,0,0)'}
        polygonSideColor={() => 'rgba(0,0,0,0)'}
        polygonStrokeColor={() => 'rgba(244,238,226,0.30)'}
        polygonAltitude={0.0035}
        polygonsTransitionDuration={0}
        htmlElementsData={markers}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={0.012}
        htmlElement={makeMarker}
        htmlElementVisibilityModifier={visibility}
        htmlTransitionDuration={0}
        onGlobeReady={onReady}
        onZoom={(pov) => setZoomedIn(pov.altitude < 1.25)}
        animateIn={!prefersReducedMotion()}
        rendererConfig={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      />
    </div>
  );
}
