import { useMemo, useState } from 'react';
import { ImageOverlay, MapContainer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { categories, initiatives } from '../data/initiatives';

const imageBounds = [[0, 0], [1332, 1880]];

function MapBounds() {
  const map = useMap();
  map.fitBounds(imageBounds);
  return null;
}

function markerIcon(category) {
  const colorByCategory = {
    'Waste management': '#ba4264',
    'Renewable energy': '#e19a18',
    Research: '#5d64b1',
    'Water conservation': '#2d8eaa',
    'Energy efficiency': '#6354a6',
    'Green infrastructure': '#57893b',
  };
  const color = colorByCategory[category] ?? '#596f41';
  return L.divIcon({
    className: 'initiative-marker',
    html: `<span style="--marker-color:${color}" aria-hidden="true"></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

/** Reusable component: import this into the main IITB website. */
export function SustainabilityMap() {
  const [activeCategory, setActiveCategory] = useState('All');
  const [query, setQuery] = useState('');
  const filteredInitiatives = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return initiatives.filter((initiative) => (
      (activeCategory === 'All' || initiative.category === activeCategory)
      && (!normalizedQuery || `${initiative.title} ${initiative.category}`.toLowerCase().includes(normalizedQuery))
    ));
  }, [activeCategory, query]);

  return (
    <section className="map-section" aria-labelledby="map-heading">
      <div className="map-toolbar">
        <div>
          <h2 id="map-heading">Campus sustainability map</h2>
          <p>{filteredInitiatives.length} initiatives shown</p>
        </div>
        <label className="search-field">
          <span className="sr-only">Search initiatives</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search initiatives" />
        </label>
      </div>
      <div className="category-controls" aria-label="Filter initiatives by category">
        {categories.map((category) => (
          <button
            type="button"
            key={category}
            className={activeCategory === category ? 'is-active' : ''}
            onClick={() => setActiveCategory(category)}
            aria-pressed={activeCategory === category}
          >
            {category}
          </button>
        ))}
      </div>
      <div className="map-frame">
        <MapContainer
          crs={L.CRS.Simple}
          bounds={imageBounds}
          maxBounds={imageBounds}
          minZoom={-1}
          maxZoom={2}
          scrollWheelZoom
          aria-label="Interactive IIT Bombay sustainability campus map"
        >
          <ImageOverlay url="/assets/iitb-sustainability-map.png" bounds={imageBounds} />
          <MapBounds />
          {filteredInitiatives.map((initiative) => (
            <Marker key={initiative.id} position={initiative.position} icon={markerIcon(initiative.category)}>
              <Popup>
                <article className="map-popup">
                  <p>{initiative.category}</p>
                  <h3>{initiative.title}</h3>
                  <span>{initiative.status} location</span>
                  <p>{initiative.description}</p>
                </article>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <p className="map-note">Marker positions are based on the current illustrated campus map and can be refined through the Supabase admin workflow.</p>
    </section>
  );
}
