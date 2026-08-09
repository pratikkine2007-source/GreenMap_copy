/**
 * Canonical category ("theme") system for GreenMap.
 *
 * The Supabase `initiatives` table stores fine-grained category slugs
 * (e.g. `water_conservation`, `waste_to_energy`). For discovery we group these
 * into a small set of coherent, human-readable themes — each with a restrained
 * category colour and a single-line Lucide-style icon. Keeping the theme set
 * small (5–8) is what makes the filter row and legend scannable in five seconds.
 *
 * Icons are inline SVG inner-markup (viewBox 0 0 24 24, stroke=currentColor) so
 * markers, chips and the legend all render from one source and inherit colour.
 */

// Lucide-derived single-stroke glyphs (inner markup only).
// Exact Lucide icon geometry (viewBox 24, 2px round stroke) — crisp at badge size.
const ICONS = {
  droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  recycle: '<path d="M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5"/><path d="M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12"/><path d="m14 16-3 3 3 3"/><path d="M8.293 13.596 7.196 9.5 3.1 10.598"/><path d="m9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843"/><path d="m13.378 9.633 4.096 1.098 1.097-4.096"/>',
  building: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  flask: '<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/><path d="M6.453 15h11.094"/><path d="M8.5 2h7"/>',
  bike: '<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  wheat: '<path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/>',
  compass: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>',
};

/**
 * Theme registry. `order` controls filter/legend sequencing. Colours are tuned
 * for legibility on the dark map (roughly equal luminance, restrained saturation).
 */
export const THEMES = {
  water: { id: 'water', label: 'Water', color: '#4FC4E4', icon: ICONS.droplet, blurb: 'Conservation & reuse', order: 1 },
  energy: { id: 'energy', label: 'Energy', color: '#F0B43E', icon: ICONS.zap, blurb: 'Renewables & efficiency', order: 2 },
  waste: { id: 'waste', label: 'Waste', color: '#5FD08A', icon: ICONS.recycle, blurb: 'Recovery & composting', order: 3 },
  buildings: { id: 'buildings', label: 'Buildings', color: '#8FC2A0', icon: ICONS.building, blurb: 'Green-rated infrastructure', order: 4 },
  research: { id: 'research', label: 'Research', color: '#A99BF2', icon: ICONS.flask, blurb: 'Carbon & sustainability labs', order: 5 },
  mobility: { id: 'mobility', label: 'Mobility', color: '#F28D5C', icon: ICONS.bike, blurb: 'Low-carbon transport', order: 6 },
  biodiversity: { id: 'biodiversity', label: 'Biodiversity', color: '#76D68C', icon: ICONS.leaf, blurb: 'Green cover & habitats', order: 7 },
  food: { id: 'food', label: 'Food', color: '#EC9DC1', icon: ICONS.wheat, blurb: 'Sustainable dining', order: 8 },
  other: { id: 'other', label: 'Other', color: '#A6B7B0', icon: ICONS.compass, blurb: 'Further initiatives', order: 9 },
};

// Fine-grained DB slug (and legacy display strings) → theme id.
const RAW_TO_THEME = {
  water_conservation: 'water', water_reuse: 'water', water: 'water',
  renewable_energy: 'energy', energy_efficiency: 'energy', solar: 'energy', energy: 'energy',
  waste_management: 'waste', waste_to_energy: 'waste', composting: 'waste', waste: 'waste',
  green_buildings: 'buildings', green_building: 'buildings', green_infrastructure: 'buildings', buildings: 'buildings',
  carbon_research: 'research', sustainability_research: 'research', research: 'research',
  mobility: 'mobility', transport: 'mobility',
  biodiversity: 'biodiversity', greenery: 'biodiversity',
  food: 'food', dining: 'food',
};

/** Normalise any category value ("Water conservation", "water_conservation") to a slug. */
function slugify(value) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** Resolve a raw category to its theme metadata (falls back to `other`). */
export function resolveTheme(rawCategory) {
  return THEMES[RAW_TO_THEME[slugify(rawCategory)]] ?? THEMES.other;
}

/** Human label for a raw category slug, e.g. `waste_to_energy` → "Waste to energy". */
export function prettyCategory(rawCategory) {
  const s = String(rawCategory ?? '').replaceAll('_', ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Sustainability initiative';
}

/**
 * Given the loaded initiatives, return the themes actually present, in canonical
 * order, each annotated with its live count. Used to build the filter row/legend
 * so we never show a category with nothing behind it.
 */
export function deriveThemes(initiatives = []) {
  const counts = new Map();
  initiatives.forEach((it) => {
    const id = resolveTheme(it.category).id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  });
  return Object.values(THEMES)
    .filter((t) => counts.has(t.id))
    .sort((a, b) => a.order - b.order)
    .map((t) => ({ ...t, count: counts.get(t.id) }));
}
