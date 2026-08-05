import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import campusBoundaryText from '../data/iitb-circular-boundary.geojson?raw';
import { supabase } from '../lib/supabase';

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
const outsideMask = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [[70, 17], [75, 17], [75, 22], [70, 22], [70, 17]],
      [...campusRing].reverse(),
    ],
  },
};

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

function markerVisual(category) {
  const key = String(category ?? '').toLowerCase();
  const visuals = {
    water_conservation: { color: '#25829c', file: 'water-conservation.svg' },
    water_reuse: { color: '#25829c', file: 'water-reuse.svg' },
    renewable_energy: { color: '#d88918', file: 'renewable-energy.svg' },
    waste_management: { color: '#5f913e', file: 'waste-management.svg' },
    waste_to_energy: { color: '#a85d31', file: 'waste-to-energy.svg' },
    green_buildings: { color: '#487a50', file: 'green-buildings.svg' },
    energy_efficiency: { color: '#7a5aa6', file: 'energy-efficiency.svg' },
    carbon_research: { color: '#5469a8', file: 'carbon-research.svg' },
    sustainability_research: { color: '#326f71', file: 'sustainability-research.svg' },
  };
  return visuals[key] ?? { color: '#bd3455', file: 'default.svg' };
}

function makePopupContent(initiative) {
  const content = document.createElement('article');
  content.className = 'initiative-popup';
  const category = document.createElement('p');
  category.className = 'initiative-popup-category';
  category.textContent = String(initiative.category ?? 'Sustainability initiative').replaceAll('_', ' ');
  const title = document.createElement('h3');
  title.textContent = initiative.title;
  content.append(category, title);
  if (initiative.image_url) {
    const image = document.createElement('img');
    image.src = initiative.image_url;
    image.alt = initiative.title;
    image.loading = 'lazy';
    content.append(image);
  }
  if (initiative.description) {
    const description = document.createElement('p');
    description.textContent = initiative.description;
    content.append(description);
  }
  if (initiative.image_stat) {
    const stat = document.createElement('p');
    stat.className = 'initiative-popup-impact';
    stat.textContent = initiative.image_stat;
    content.append(stat);
  }
  return content;
}

async function addInitiativeMarkers(map, markers) {
  if (!supabase) throw new Error('Supabase environment variables are missing.');
  const { data, error } = await supabase.from('initiatives')
    .select('title, category, longitude, latitude, description, image_url, image_stat')
    .eq('is_published', true);
  if (error) throw error;
  const valid = data.filter((item) => Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude)));
  valid.forEach((initiative) => {
    const coordinates = [Number(initiative.longitude), Number(initiative.latitude)];
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'sustainability-map-marker';
    element.setAttribute('aria-label', `Show details for ${initiative.title}`);
    const visual = markerVisual(initiative.category);
    element.style.setProperty('--initiative-color', visual.color);
    element.innerHTML = `<span class="marker-label">${initiative.title}</span><span class="marker-pin"><img src="/initiative-icons/${visual.file}" alt="" aria-hidden="true" /></span>`;
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 20, maxWidth: '300px' })
      .setLngLat(coordinates)
      .setDOMContent(makePopupContent(initiative));
    const marker = new maplibregl.Marker({ element, anchor: 'bottom', rotationAlignment: 'viewport', pitchAlignment: 'viewport' })
      .setLngLat(coordinates)
      .addTo(map);
    element.addEventListener('mouseenter', () => popup.addTo(map));
    element.addEventListener('mouseleave', () => popup.remove());
    element.addEventListener('click', () => (popup.isOpen() ? popup.remove() : popup.addTo(map)));
    markers.push({ marker, popup });
  });
  return valid.length;
}

/**
 * The original OpenStreetMap (MapLibre) + Supabase campus map. It mounts
 * top-down (matching the Cesium descent's final frame), preloads quietly, and
 * once `active` turns true it tilts into the 3D view and locks to campus.
 */
export function OsmCampusMap({ active, onReady }) {
  const container = useRef(null);
  const mapRef = useRef(null);
  const revealedRef = useRef(false);

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
    map.__markers = [];

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-left');
    // Interaction is disabled until the reveal completes.
    ['dragPan', 'scrollZoom', 'boxZoom', 'dragRotate', 'keyboard', 'doubleClickZoom', 'touchZoomRotate']
      .forEach((h) => map[h].disable());
    map.getCanvas().style.cursor = 'default';

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
          // Soft height-based shading reads more like a real city than a flat fill.
          'fill-extrusion-color': [
            'interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 8],
            0, '#e9e3d6', 12, '#cfd3c2', 40, '#aeb6a4',
          ],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14.5, 0, 16, ['*', ['coalesce', ['get', 'render_height'], 8], 1.7]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.92,
        },
      }, labelLayer);

      map.addSource('iitb-campus-boundary', { type: 'geojson', data: campusBoundary });
      map.addSource('outside-campus-mask', { type: 'geojson', data: outsideMask });
      // Spotlight the campus: dim the surroundings instead of hiding them, so it
      // reads as a real place with context rather than a cut-out.
      map.addLayer({
        id: 'outside-campus-mask',
        type: 'fill',
        source: 'outside-campus-mask',
        paint: { 'fill-color': '#06140f', 'fill-opacity': 0.55 },
      });
      map.addLayer({
        id: 'iitb-campus-glow',
        type: 'line',
        source: 'iitb-campus-boundary',
        paint: { 'line-color': '#8ff0b8', 'line-width': 8, 'line-blur': 7, 'line-opacity': 0.6 },
      });
      map.addLayer({
        id: 'iitb-campus-outline',
        type: 'line',
        source: 'iitb-campus-boundary',
        paint: { 'line-color': '#4bf39c', 'line-width': 2.2, 'line-opacity': 0.95 },
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
      (map.__markers ?? []).forEach(({ marker, popup }) => { marker.remove(); popup.remove(); });
      mapRef.current = null;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reveal: tilt from top-down into the 3D campus, then lock + drop markers.
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
      const markers = map.__markers ?? [];
      addInitiativeMarkers(map, markers).catch((e) => console.error('Could not load initiatives:', e));
    }, reduced ? 0 : 2050);
    return () => window.clearTimeout(settle);
  }, [active]);

  return <div ref={container} className="osm-map-layer" aria-label="Interactive 3D map of IIT Bombay campus" />;
}
