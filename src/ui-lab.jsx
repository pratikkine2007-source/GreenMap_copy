/*
 * UI lab — dev-only harness for the map overlay + markers.
 * Renders the real overlay components over a darkened campus image with mock
 * data, so the design can be verified in-sandbox without external map tiles.
 * Open /ui-lab.html. Not shipped in the app entry (main.jsx).
 */
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MapOverlay } from './components/map/MapOverlay';
import { deriveThemes, resolveTheme } from './map/categories';
import { markerInnerHTML } from './map/marker';
import './styles.css';

const MOCK = [
  { id: 'biogas', title: 'Biogas Plant', category: 'waste_to_energy', location: 'Hostel 12 mess block', description: 'Converts hostel food waste into biogas used for cooking in nearby messes.', image_stat: '≈ 250 kg waste diverted daily', x: 62, y: 40 },
  { id: 'compost', title: 'Composting Unit', category: 'waste_management', location: 'Near Hostel 5', description: 'Turns leftover food into nutrient-rich compost for campus gardens.', x: 34, y: 55 },
  { id: 'solar-pv', title: 'Solar PV Array', category: 'renewable_energy', location: 'Academic rooftops', description: 'Photovoltaic panels generate renewable electricity across academic blocks.', image_stat: '1.2 MW installed capacity', image_url: '/assets/iitb-sustainability-map.png', x: 52, y: 30 },
  { id: 'solar-heat', title: 'Solar Water Heaters', category: 'renewable_energy', location: 'Hostel rooftops', description: 'Rooftop systems use sunshine to provide hot water to hostels.', x: 58, y: 60 },
  { id: 'carbon-lab', title: 'Carbon Capture Lab', category: 'carbon_research', location: 'Chemical Engineering', description: 'A research facility focused on capturing, reusing and safely storing carbon dioxide.', x: 76, y: 47 },
  { id: 'urinals', title: 'Water-free Urinals', category: 'water_conservation', location: 'Hostel 16', description: 'A pilot that saves water while keeping facilities odour-free.', image_stat: '≈ 1.5 L saved per use', x: 28, y: 68 },
  { id: 'motion', title: 'Motion-sensor Washrooms', category: 'energy_efficiency', location: 'Hostel 15', description: 'Sensors keep lights on only when needed, cutting electricity use.', x: 44, y: 78 },
  { id: 'green-bldg', title: 'Green-rated Buildings', category: 'green_buildings', location: 'New academic complex', description: 'New buildings are designed to reduce energy, water and waste use.', x: 70, y: 72 },
  { id: 'wet-waste', title: 'Wet Waste Plant', category: 'waste_management', location: 'Service road, north', description: 'Processes biodegradable campus waste close to source.', x: 22, y: 84 },
];

function App() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [hoverId, setHoverId] = useState(null);
  const [locating, setLocating] = useState(false);

  const themes = useMemo(() => deriveThemes(MOCK), []);
  const q = query.trim().toLowerCase();
  const visible = MOCK.filter((it) => {
    const inCat = activeCategory === 'all' || resolveTheme(it.category).id === activeCategory;
    const inQ = !q || `${it.title} ${it.category} ${it.location}`.toLowerCase().includes(q);
    return inCat && inQ;
  });
  const selected = MOCK.find((it) => it.id === selectedId) || null;

  const onControl = (action) => {
    if (action === 'locate') { setLocating(true); setTimeout(() => setLocating(false), 1400); }
    if (action === 'reset') { setActiveCategory('all'); setQuery(''); setSelectedId(null); }
  };

  return (
    <section className="campus-experience is-globe is-map">
      <div className="osm-map-layer" style={{
        backgroundImage: 'linear-gradient(180deg, rgba(4,16,11,.62), rgba(4,16,11,.82)), url(/assets/iitb-sustainability-map.png)',
        backgroundSize: 'cover', backgroundPosition: 'center', filter: 'saturate(.7)',
      }}>
        {visible.map((it) => {
          const theme = resolveTheme(it.category);
          const cls = `gm-marker ${selectedId === it.id ? 'is-selected' : ''} ${hoverId === it.id ? 'is-hover' : ''}`;
          return (
            <button
              key={it.id}
              type="button"
              className={cls}
              style={{ '--cat': theme.color, position: 'absolute', left: `${it.x}%`, top: `${it.y}%`, transform: 'translate(-50%, -100%)' }}
              onMouseEnter={() => setHoverId(it.id)}
              onMouseLeave={() => setHoverId(null)}
              onClick={() => setSelectedId(it.id)}
              aria-label={`Show details for ${it.title}`}
              dangerouslySetInnerHTML={{ __html: markerInnerHTML({ icon: theme.icon, label: it.title }) }}
            />
          );
        })}
      </div>

      <div className="campus-hud">
        <div className="hud-brand">
          <img src="/assets/suscell-logo.svg" alt="" className="hud-logo" />
          <span><strong>GreenMap</strong><small>Sustainability Cell · IIT Bombay</small></span>
        </div>
      </div>

      <MapOverlay
        initiatives={MOCK}
        themes={themes}
        activeCategory={activeCategory}
        onCategoryChange={(id) => setActiveCategory(id)}
        query={query}
        onQueryChange={setQuery}
        selected={selected}
        onSelect={(it) => setSelectedId(it ? it.id : null)}
        onControl={onControl}
        locating={locating}
      />
    </section>
  );
}

createRoot(document.getElementById('root')).render(<App />);
