import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import campusBoundaryText from '../data/iitb-circular-boundary.geojson?raw';
import { supabase } from '../lib/supabase';

const IITB_CENTER = [72.913, 19.132];
const campusBoundary = JSON.parse(campusBoundaryText);
const campusPolygon = campusBoundary.features[0].geometry;
const campusRing = campusPolygon.coordinates[0];
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
      // A large local extent avoids antimeridian/world-wrap behaviour while
      // keeping the entire useful interaction area outside campus blank.
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
      const filter = layer.filter
        ? ['all', layer.filter, majorCampusPoiFilter]
        : majorCampusPoiFilter;
      map.setFilter(layer.id, filter);
      return;
    }
    if (layer.type === 'symbol' && hiddenTerms.some((term) => identity.includes(term))) {
      map.setLayoutProperty(layer.id, 'visibility', 'none');
    }
  });
}

function makePopupContent(initiative) {
  const content = document.createElement('article');
  content.className = 'initiative-popup';
  const title = document.createElement('h3');
  title.textContent = initiative.title;
  content.append(title);
  return content;
}

async function addInitiativeMarkers(map, markers) {
  if (!supabase) throw new Error('Supabase environment variables are missing.');
  const { data, error } = await supabase.from('initiatives')
    .select('title, longitude, latitude')
    .eq('is_published', true);
  if (error) throw error;
  const validInitiatives = data.filter((item) => Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude)));
  validInitiatives.forEach((initiative) => {
    const coordinates = [Number(initiative.longitude), Number(initiative.latitude)];
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'sustainability-map-marker';
    element.setAttribute('aria-label', `Show details for ${initiative.title}`);
    element.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-5.1 7-12A7 7 0 1 0 5 9c0 6.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.2"/></svg>';
    const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 20 })
      .setLngLat(coordinates)
      .setDOMContent(makePopupContent(initiative));
    const marker = new maplibregl.Marker({ element, anchor: 'bottom', rotationAlignment: 'viewport', pitchAlignment: 'viewport' })
      .setLngLat(coordinates)
      .addTo(map);
    element.addEventListener('mouseenter', () => popup.addTo(map));
    element.addEventListener('mouseleave', () => popup.remove());
    element.addEventListener('click', () => popup.isOpen() ? popup.remove() : popup.addTo(map));
    markers.push({ marker, popup });
  });
  return validInitiatives.length;
}

/** Real-world 3D view with an intentionally reduced landmark set. */
export function Campus3DMap() {
  const container = useRef(null);
  const [markerStatus, setMarkerStatus] = useState('Loading sustainability markers…');

  useEffect(() => {
    let disposed = false;
    const initiativeMarkers = [];
    const map = new maplibregl.Map({
      container: container.current,
      style: 'https://tiles.openfreemap.org/styles/bright',
      center: IITB_CENTER,
      zoom: 15.8,
      renderWorldCopies: false,
      pitch: 55,
      bearing: -28,
      maxPitch: 75,
      attributionControl: true,
      canvasContextAttributes: { antialias: true },
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }));

    map.on('load', () => {
      addInitiativeMarkers(map, initiativeMarkers)
        .then((count) => { if (!disposed) setMarkerStatus(`${count} sustainability markers loaded`); })
        .catch((error) => {
          console.error('Could not load initiatives from Supabase:', error);
          if (!disposed) setMarkerStatus(`Markers could not load: ${error.message}`);
        });
      try {
        hideNonCampusLandmarks(map);
      } catch (error) {
        console.warn('Campus label filtering was skipped:', error);
      }
      const labelLayer = map.getStyle().layers?.find(
        (layer) => layer.type === 'symbol' && layer.layout?.['text-field'],
      )?.id;
      map.addSource('osm-buildings', { type: 'vector', url: 'https://tiles.openfreemap.org/planet' });
      map.addLayer({
        id: 'iitb-3d-buildings',
        type: 'fill-extrusion',
        source: 'osm-buildings',
        'source-layer': 'building',
        minzoom: 15,
        // Keep the original MapLibre building layer unmodified. The campus
        // GeoJSON is used only by the visual inverse mask below.
        filter: ['!=', ['get', 'hide_3d'], true],
        paint: {
          'fill-extrusion-color': '#72966e',
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, ['coalesce', ['get', 'render_height'], 8]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.85,
        },
      }, labelLayer);

      map.addSource('iitb-campus-boundary', { type: 'geojson', data: campusBoundary });
      map.addSource('outside-campus-mask', { type: 'geojson', data: outsideMask });
      map.addLayer({
        id: 'outside-campus-mask',
        type: 'fill',
        source: 'outside-campus-mask',
        paint: { 'fill-color': '#f7f4e9', 'fill-opacity': 1 },
      });
      map.addLayer({
        id: 'iitb-campus-outline',
        type: 'line',
        source: 'iitb-campus-boundary',
        paint: { 'line-color': '#446b45', 'line-width': 2.5, 'line-opacity': 0.9 },
      });
    });

    return () => {
      disposed = true;
      initiativeMarkers.forEach(({ marker, popup }) => { marker.remove(); popup.remove(); });
      map.remove();
    };
  }, []);

  return (
    <section className="map-section" aria-labelledby="map-3d-heading">
      <div className="map-toolbar">
        <div>
          <h2 id="map-3d-heading">3D IIT Bombay campus</h2>
          <p>Major campus landmarks remain visible; minor transport, retail, and service POIs are hidden.</p>
        </div>
      </div>
      <div ref={container} className="map-frame maplibre-frame" aria-label="Interactive 3D map of IIT Bombay campus" />
      <p className="map-note">{markerStatus} · Drag to rotate, right-click to tilt, and use the controls to zoom.</p>
    </section>
  );
}
