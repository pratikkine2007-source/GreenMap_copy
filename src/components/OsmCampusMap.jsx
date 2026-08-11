import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import campusBoundaryText from '../data/iitb-circular-boundary.geojson?raw';
import { supabase } from '../lib/supabase';
import { MapOverlay } from './map/MapOverlay';
import { deriveThemes, resolveTheme } from '../map/categories';

const campusBoundary = JSON.parse(campusBoundaryText);
const campusRing = campusBoundary.features[0].geometry.coordinates[0];

// Tight bounding box from the boundary so the map can never drift beyond campus.
const bbox = campusRing.reduce(
  (acc, [lng, lat]) => ({
    minLng: Math.min(acc.minLng, lng),
    minLat: Math.min(acc.minLat, lat),
    maxLng: Math.max(acc.maxLng, lng),
    maxLat: Math.max(acc.maxLat, lat),
  }),
  { minLng: 180, minLat: 90, maxLng: -180, maxLat: -90 },
);
const PAD = 0.0026;
const CAMPUS_MAX_BOUNDS = [
  [bbox.minLng - PAD, bbox.minLat - PAD],
  [bbox.maxLng + PAD, bbox.maxLat + PAD],
];
const IITB_CENTER = [(bbox.minLng + bbox.maxLng) / 2, (bbox.minLat + bbox.maxLat) / 2];
// Handoff view — deliberately near top-down so it lines up with the Cesium
// descent's final frame, then we tilt into the 3D angle once revealed.
const HANDOFF = { center: IITB_CENTER, zoom: 15.05, pitch: 0, bearing: 12 };
const ARRIVED = { pitch: 46, zoom: 15.6, bearing: 12 };

const MAJOR_LANDMARK_NAMES = [
  'Central Library', 'SAC', 'Student Activity Centre', 'Gymkhana', 'IIT Hospital',
  'IIT Bombay Hospital', 'Main Gate', 'Guest House', 'Powai Lake',
  ...Array.from({ length: 18 }, (_, index) => `Hostel ${index + 1}`),
  ...Array.from({ length: 18 }, (_, index) => `H${index + 1}`),
];
const majorCampusPoiFilter = [
  'any',
  ['match', ['get', 'class'], ['education', 'university', 'college', 'library', 'hospital', 'sports_centre', 'accommodation'], true, false],
  ['match', ['get', 'subclass'], ['university', 'college', 'library', 'hospital', 'hostel', 'sports_centre', 'guest_house'], true, false],
  ['in', ['get', 'name'], ['literal', MAJOR_LANDMARK_NAMES]],
];
// Multiple rings replace the old hard mask. Their increasing opacity creates a
// gentle falloff from the clear campus to the subdued surrounding map.
function expandRing(ring, factor) {
  return ring.map(([lng, lat]) => [
    IITB_CENTER[0] + (lng - IITB_CENTER[0]) * factor,
    IITB_CENTER[1] + (lat - IITB_CENTER[1]) * factor,
  ]);
}

function createOutsideGradient(ring) {
  const bands = [
    { factor: 1.035, opacity: 0.06 },
    { factor: 1.09, opacity: 0.12 },
    { factor: 1.20, opacity: 0.22 },
  ];
  const features = [];
  let inner = ring;
  bands.forEach(({ factor, opacity }) => {
    const outer = expandRing(ring, factor);
    features.push({
      type: 'Feature', properties: { opacity },
      geometry: { type: 'Polygon', coordinates: [outer, [...inner].reverse()] },
    });
    inner = outer;
  });
  features.push({
    type: 'Feature', properties: { opacity: 0.40 },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [[70, 17], [75, 17], [75, 22], [70, 22], [70, 17]],
        [...inner].reverse(),
      ],
    },
  });
  return { type: 'FeatureCollection', features };
}

const outsideGradient = createOutsideGradient(campusRing);

function hideNonCampusLandmarks(map) {
  const hiddenTerms = ['bus', 'transit', 'public_transport', 'rail', 'aeroway', 'traffic', 'housenumber', 'shop', 'atm', 'bank', 'cafe', 'restaurant', 'fast_food', 'viewpoint'];
  (map.getStyle().layers ?? []).forEach((layer) => {
    const identity = `${layer.id} ${layer['source-layer'] ?? ''}`.toLowerCase();
    if (layer.type === 'symbol' && layer['source-layer'] === 'poi') {
      const filter = layer.filter ? ['all', layer.filter, majorCampusPoiFilter] : majorCampusPoiFilter;
      map.setFilter(layer.id, filter);
      return;
    }
    if (layer.type === 'symbol' && hiddenTerms.some((term) => identity.includes(term))) {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  });
}

/** Apply the campus colour system to the OpenFreeMap base-style layers. */
function applyCampusPalette(map) {
  const colours = {
    water: '#72CAEB',
    greenery: '#95E0B7',
    builtUp: '#BEC6CE',
    road: '#EFE5CE',
    roadBorder: '#D4D8DC',
  };

  (map.getStyle().layers ?? []).forEach((layer) => {
    const identity = `${layer.id} ${layer['source-layer'] ?? ''}`.toLowerCase();
    const isWater = /water|waterway/.test(identity);
    const isGreenery = /park|green|landcover|landuse|wood|forest|grass|garden|cemetery/.test(identity);
    const isBuilding = /building/.test(identity);
    const isRoad = /road|street|highway|transportation/.test(identity);
    const isRoadBorder = /casing|border|outline/.test(identity);

    try {
      if (layer.type === 'fill' && isWater) map.setPaintProperty(layer.id, 'fill-color', colours.water);
      if (layer.type === 'line' && isWater) map.setPaintProperty(layer.id, 'line-color', colours.water);
      if (layer.type === 'fill' && isGreenery) map.setPaintProperty(layer.id, 'fill-color', colours.greenery);
      if (layer.type === 'fill' && isBuilding) map.setPaintProperty(layer.id, 'fill-color', colours.builtUp);
      if (layer.type === 'line' && isRoad) map.setPaintProperty(layer.id, 'line-color', isRoadBorder ? colours.roadBorder : colours.road);
    } catch (error) {
      // Some provider layers do not expose a colour paint property; leave them intact.
    }
  });
}

/** Original per-category pin colour + icon file (the teardrop marker look). */
function markerVisual(category) {
  const key = String(category ?? '').toLowerCase();
  const visuals = {
    water_conservation: { color: '#0040B7', file: 'water-conservation.svg' },
    water_reuse: { color: '#0040B7', file: 'water-reuse.svg' },
    renewable_energy: { color: '#FFBF3F', file: 'renewable-energy.svg' },
    waste_management: { color: '#326f71', file: 'waste-management.svg' },
    waste_to_energy: { color: '#FF7824', file: 'waste-to-energy.svg' },
    green_buildings: { color: '#326f71', file: 'green-buildings.svg' },
    energy_efficiency: { color: '#FF48A0', file: 'energy-efficiency.svg' },
    carbon_research: { color: '#8900B4', file: 'carbon-research.svg' },
    sustainability_research: { color: '#8900B4', file: 'sustainability-research.svg' },
  };
  return visuals[key] ?? { color: '#bd3455', file: 'default.svg' };
}

/** Load published initiatives from Supabase, normalised for the overlay + markers. */
async function loadInitiatives() {
  if (!supabase) throw new Error('Supabase environment variables are missing.');
  // Select only columns known to exist; keep this resilient to schema drift.
  const { data, error } = await supabase.from('initiatives')
    .select('*')
    .eq('is_published', true);
  if (error) throw error;
  return (data ?? [])
    .filter((it) => Number.isFinite(Number(it.longitude)) && Number.isFinite(Number(it.latitude)))
    .map((it, i) => ({
      id: it.id ?? `${String(it.title ?? 'initiative').toLowerCase().replace(/\W+/g, '-')}-${i}`,
      title: it.title,
      category: it.category,
      description: it.description,
      image_url: it.image_url,
      image_stat: it.image_stat,
      // `location`/`building` are optional and only render if present in the row.
      location: it.location ?? it.building ?? it.location_status,
      lng: Number(it.longitude),
      lat: Number(it.latitude),
    }));
}

/** True when a coordinate falls within the padded campus bounding box. */
function insideCampus(lng, lat) {
  return lng >= CAMPUS_MAX_BOUNDS[0][0] && lng <= CAMPUS_MAX_BOUNDS[1][0]
    && lat >= CAMPUS_MAX_BOUNDS[0][1] && lat <= CAMPUS_MAX_BOUNDS[1][1];
}

/**
 * The interactive OpenStreetMap (MapLibre) + Supabase campus map. It mounts
 * top-down (matching the Cesium descent's final frame), preloads quietly, and
 * once `active` turns true it tilts into the 3D view, locks to campus and drops
 * the initiative markers. The React overlay (search, filters, controls, legend,
 * detail) is layered above the canvas and drives the markers as a controlled UI.
 */
export function OsmCampusMap({ active, onReady }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef(new Map());       // id -> maplibregl.Marker
  const revealedRef = useRef(false);

  const [initiatives, setInitiatives] = useState([]);
  const [ready, setReady] = useState(false);  // markers may be dropped
  const [activeCategory, setActiveCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [locating, setLocating] = useState(false);

  const themes = useMemo(() => deriveThemes(initiatives), [initiatives]);
  const selected = useMemo(
    () => initiatives.find((it) => it.id === selectedId) ?? null,
    [initiatives, selectedId],
  );

  // Keep a live ref to the selection setter so imperative marker handlers and
  // map events always reach the latest state without recreating markers.
  const selectRef = useRef(setSelectedId);
  selectRef.current = setSelectedId;

  /* ---- Load initiatives up front so they're ready by the time we reveal ---- */
  useEffect(() => {
    let cancelled = false;
    loadInitiatives()
      .then((data) => { if (!cancelled) setInitiatives(data); })
      .catch((e) => console.error('Could not load initiatives:', e));
    return () => { cancelled = true; };
  }, []);

  /* ---- Map setup (once) ---- */
  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current,
      style: 'https://tiles.openfreemap.org/styles/bright',
      center: HANDOFF.center,
      zoom: HANDOFF.zoom,
      pitch: HANDOFF.pitch,
      bearing: HANDOFF.bearing,
      renderWorldCopies: false,
      maxPitch: 72,
      projection: 'mercator',
      attributionControl: false,
      canvasContextAttributes: { antialias: true },
    });
    mapRef.current = map;

    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    // Interaction is disabled until the reveal completes.
    ['dragPan', 'scrollZoom', 'boxZoom', 'dragRotate', 'keyboard', 'doubleClickZoom', 'touchZoomRotate']
      .forEach((h) => map[h].disable());
    map.getCanvas().style.cursor = 'default';
    // Clicking empty map dismisses the open detail.
    map.on('click', () => selectRef.current?.(null));

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(container.current);

    // Add campus layers as soon as the style JSON is parsed (survives slow tiles).
    let didSetup = false;
    const setupCampus = () => {
      if (didSetup) return;
      let style;
      try { style = map.getStyle(); } catch { return; }
      if (!style?.layers?.length) return;
      didSetup = true;
      try { hideNonCampusLandmarks(map); } catch (e) { console.warn('Campus label filtering skipped:', e); }
      try { applyCampusPalette(map); } catch (e) { console.warn('Campus colour palette skipped:', e); }
      const labelLayer = map.getStyle().layers?.find((l) => l.type === 'symbol' && l.layout?.['text-field'])?.id;

      map.addSource('osm-buildings', { type: 'vector', url: 'https://tiles.openfreemap.org/planet' });
      map.addLayer({
        id: 'iitb-3d-buildings',
        type: 'fill-extrusion',
        source: 'osm-buildings',
        'source-layer': 'building',
        minzoom: 14.5,
        filter: ['!=', ['get', 'hide_3d'], true],
        paint: {
          'fill-extrusion-color': '#BEC6CE',
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14.5, 0, 16, ['*', ['coalesce', ['get', 'render_height'], 8], 1.7]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.95,
        },
      }, labelLayer);

      map.addSource('outside-campus-gradient', { type: 'geojson', data: outsideGradient });
      map.addLayer({
        id: 'outside-campus-gradient',
        type: 'fill',
        source: 'outside-campus-gradient',
        paint: { 'fill-color': '#0b2516', 'fill-opacity': ['get', 'opacity'] },
      });
    };
    map.on('styledata', setupCampus);
    setupCampus();

    // Signal readiness once the first frame renders (or a fallback timeout).
    let readyFired = false;
    const fireReady = () => { if (!readyFired) { readyFired = true; onReady?.(); } };
    map.once('idle', fireReady);
    const readyFallback = window.setTimeout(fireReady, 4500);

    return () => {
      window.clearTimeout(readyFallback);
      resizeObserver.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      mapRef.current = null;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- Reveal: tilt from top-down into the 3D campus, then lock ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!active || !map || revealedRef.current) return;
    revealedRef.current = true;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    map.easeTo({
      pitch: ARRIVED.pitch,
      zoom: ARRIVED.zoom,
      bearing: ARRIVED.bearing,
      duration: reduced ? 0 : 2000,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    });
    const settle = window.setTimeout(() => {
      if (!mapRef.current) return;
      map.setMaxBounds(CAMPUS_MAX_BOUNDS);
      map.setMinZoom(14.6);
      map.setMaxZoom(18.5);
      ['dragPan', 'scrollZoom', 'boxZoom', 'dragRotate', 'keyboard', 'doubleClickZoom', 'touchZoomRotate']
        .forEach((h) => map[h].enable());
      map.getCanvas().style.cursor = '';
      setReady(true);
    }, reduced ? 0 : 2050);
    return () => window.clearTimeout(settle);
  }, [active]);

  /* ---- Create markers once the map is revealed and data has loaded ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || initiatives.length === 0 || markersRef.current.size > 0) return;
    initiatives.forEach((it) => {
      const visual = markerVisual(it.category);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'sustainability-map-marker';
      el.style.setProperty('--initiative-color', visual.color);
      el.setAttribute('aria-label', `Show details for ${it.title}`);
      const label = document.createElement('span');
      label.className = 'marker-label';
      label.textContent = it.title;
      const pin = document.createElement('span');
      pin.className = 'marker-pin';
      const img = document.createElement('img');
      img.src = `/initiative-icons/${visual.file}`;
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');
      pin.append(img);
      el.append(label, pin);
      el.addEventListener('click', (e) => { e.stopPropagation(); selectRef.current?.(it.id); });
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom', rotationAlignment: 'viewport', pitchAlignment: 'viewport' })
        .setLngLat([it.lng, it.lat])
        .addTo(map);
      markersRef.current.set(it.id, marker);
    });
  }, [ready, initiatives]);

  /* ---- Apply filter / search / selection to the markers ---- */
  useEffect(() => {
    const q = query.trim().toLowerCase();
    markersRef.current.forEach((marker, id) => {
      const it = initiatives.find((x) => x.id === id);
      if (!it) return;
      const el = marker.getElement();
      const inCat = activeCategory === 'all' || resolveTheme(it.category).id === activeCategory;
      const inQ = !q || `${it.title} ${it.category} ${it.location ?? ''}`.toLowerCase().includes(q);
      // The selected marker always stays visible so the detail never orphans.
      const visible = (inCat && inQ) || id === selectedId;
      el.classList.toggle('is-hidden', !visible);
      el.classList.toggle('is-selected', id === selectedId);
    });
  }, [activeCategory, query, selectedId, initiatives]);

  /* ---- Fly to the selected initiative, clearing the panel/sheet ---- */
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected) return;
    // Keep the marker clear of the UI: left of the right-side card on desktop,
    // above the bottom sheet on mobile.
    const isMobile = window.matchMedia('(max-width: 760px)').matches;
    const offset = isMobile ? [0, -170] : [-140, 0];
    map.easeTo({
      center: [selected.lng, selected.lat],
      zoom: Math.max(map.getZoom(), 16.4),
      offset,
      duration: 700,
      easing: (t) => 1 - Math.pow(1 - t, 3),
    });
  }, [selected]);

  /* ---- Overlay controls ---- */
  const handleControl = useCallback((action) => {
    const map = mapRef.current;
    if (!map) return;
    if (action === 'zoom-in') map.zoomIn();
    else if (action === 'zoom-out') map.zoomOut();
    else if (action === 'reset') {
      setActiveCategory('all'); setQuery(''); setSelectedId(null);
      map.easeTo({ center: IITB_CENTER, zoom: ARRIVED.zoom, pitch: ARRIVED.pitch, bearing: ARRIVED.bearing, duration: 900, easing: (t) => 1 - Math.pow(1 - t, 3) });
    } else if (action === 'locate') {
      if (!navigator.geolocation) return;
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          setLocating(false);
          const { longitude, latitude } = coords;
          if (insideCampus(longitude, latitude)) {
            map.easeTo({ center: [longitude, latitude], zoom: 16.6, duration: 900 });
          } else {
            // Off campus — just recentre on IITB rather than leaving the bounds.
            map.easeTo({ center: IITB_CENTER, zoom: ARRIVED.zoom, duration: 900 });
          }
        },
        () => setLocating(false),
        { enableHighAccuracy: true, timeout: 8000 },
      );
    }
  }, []);

  const handleSelect = useCallback((it) => setSelectedId(it ? it.id : null), []);

  return (
    <>
      <div ref={container} className="osm-map-layer" aria-label="Interactive 3D map of IIT Bombay campus" />
      {ready && (
        <MapOverlay
          initiatives={initiatives}
          themes={themes}
          activeCategory={activeCategory}
          onCategoryChange={(id) => { setActiveCategory(id); }}
          query={query}
          onQueryChange={setQuery}
          selected={selected}
          onSelect={handleSelect}
          onControl={handleControl}
          locating={locating}
        />
      )}
    </>
  );
}
