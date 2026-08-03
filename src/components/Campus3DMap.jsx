import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import campusBoundaryText from '../data/iitb-circular-boundary.geojson?raw';
import { supabase } from '../lib/supabase';

const IITB_CENTER = [72.913, 19.132];
const CAMPUS_MAX_BOUNDS = [[72.898, 19.121], [72.925, 19.147]];
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
  const validInitiatives = data.filter((item) => Number.isFinite(Number(item.longitude)) && Number.isFinite(Number(item.latitude)));
  validInitiatives.forEach((initiative) => {
    const coordinates = [Number(initiative.longitude), Number(initiative.latitude)];
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'sustainability-map-marker';
    element.setAttribute('aria-label', `Show details for ${initiative.title}`);
    const visual = markerVisual(initiative.category);
    element.style.setProperty('--initiative-color', visual.color);
    element.innerHTML = `<span class="marker-label">${initiative.title}</span><span class="marker-pin"><img src="/initiative-icons/${visual.file}" alt="" aria-hidden="true" /></span>`;
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 20,
      maxWidth: '300px',
    })
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
  const [isArriving, setIsArriving] = useState(true);
  const [showIntro, setShowIntro] = useState(true);
  const [markerStatus, setMarkerStatus] = useState('Loading sustainability markers…');

  useEffect(() => {
    let disposed = false;
    const initiativeMarkers = [];
    let arrivalMarker;
    const map = new maplibregl.Map({
      container: container.current,
      style: 'https://tiles.openfreemap.org/styles/bright',
      center: IITB_CENTER,
      zoom: 2.7,
      renderWorldCopies: false,
      pitch: 0,
      bearing: -12,
      maxPitch: 75,
      projection: 'globe',
      attributionControl: true,
      canvasContextAttributes: { antialias: true },
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: 'metric' }));
    map.dragPan.disable();
    map.scrollZoom.disable();
    map.boxZoom.disable();
    map.dragRotate.disable();
    map.keyboard.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();
    map.getCanvas().style.cursor = 'wait';

    map.on('load', () => {
      const arrivalElement = document.createElement('div');
      arrivalElement.className = 'arrival-campus-marker';
      arrivalElement.setAttribute('aria-label', 'IIT Bombay');
      arrivalElement.innerHTML = '<span>IIT Bombay</span><i aria-hidden="true"></i>';
      arrivalMarker = new maplibregl.Marker({
        element: arrivalElement,
        anchor: 'bottom',
        rotationAlignment: 'viewport',
        pitchAlignment: 'viewport',
      })
        .setLngLat(IITB_CENTER)
        .addTo(map);

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
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, ['*', ['coalesce', ['get', 'render_height'], 8], 1.75]],
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

      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const arrivalDelay = reducedMotion ? 0 : 1100;
      const flightDuration = reducedMotion ? 0 : 7200;
      const introDuration = reducedMotion ? 0 : 1800;
      const introTimer = window.setTimeout(() => {
        if (!disposed) setShowIntro(false);
      }, introDuration);
      const startFlight = window.setTimeout(() => {
        map.flyTo({
          center: IITB_CENTER,
          zoom: 15.8,
          pitch: 55,
          bearing: -28,
          duration: flightDuration,
          essential: true,
        });
        const arrivalTimer = window.setTimeout(() => {
          if (!disposed) {
            map.setMaxBounds(CAMPUS_MAX_BOUNDS);
            map.setMinZoom(14.2);
            map.setMaxZoom(18.5);
            map.dragPan.enable();
            map.scrollZoom.enable();
            map.boxZoom.enable();
            map.dragRotate.enable();
            map.keyboard.enable();
            map.doubleClickZoom.enable();
            map.touchZoomRotate.enable();
            map.getCanvas().style.cursor = '';
            arrivalMarker?.remove();
            setIsArriving(false);
            addInitiativeMarkers(map, initiativeMarkers)
              .then((count) => { if (!disposed) setMarkerStatus(`${count} sustainability markers loaded`); })
              .catch((error) => {
                console.error('Could not load initiatives from Supabase:', error);
                if (!disposed) setMarkerStatus(`Markers could not load: ${error.message}`);
              });
          }
        }, flightDuration);
        map.once('remove', () => window.clearTimeout(arrivalTimer));
      }, arrivalDelay);

      map.once('remove', () => {
        window.clearTimeout(introTimer);
        window.clearTimeout(startFlight);
      });
    });

    return () => {
      disposed = true;
      initiativeMarkers.forEach(({ marker, popup }) => { marker.remove(); popup.remove(); });
      arrivalMarker?.remove();
      map.remove();
    };
  }, []);

  return (
    <section className={`campus-experience ${isArriving ? 'is-arriving' : ''}`} aria-label="Immersive 3D IIT Bombay sustainability map">
      <div ref={container} className="campus-experience-map" aria-label="Interactive 3D map of IIT Bombay campus" />
      <div className="campus-experience-vignette" aria-hidden="true" />
      <div className="campus-experience-clouds" aria-hidden="true">
        <span className="cloud cloud-one" />
        <span className="cloud cloud-two" />
        <span className="cloud cloud-three" />
      </div>
      <div className={`campus-experience-intro ${showIntro ? '' : 'is-hidden'}`} aria-hidden={!showIntro}>
        <h1>Discover a greener campus</h1>
        <span>Arriving at IIT Bombay</span>
      </div>
      <div className="campus-experience-ui">
        <div className="campus-experience-brand">
          <span>GreenMap</span>
          <small>Sustainability Cell, IIT Bombay</small>
        </div>
      </div>
      <p className="campus-experience-status" aria-live="polite">{markerStatus}</p>
    </section>
  );
}
