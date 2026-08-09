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
const ICONS = {
  // Refreshed, more distinctive category glyphs. Drawn to read cleanly at badge
  // size, on a solid colour tile with a dark stroke.
  droplet: '<path d="M12 3c3.4 4.4 5.4 7.3 5.4 10.2a5.4 5.4 0 0 1-10.8 0C6.6 10.3 8.6 7.4 12 3Z"/><path d="M9.7 13.4c.2 1.2 1 2 2.2 2.2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.6v2.4M12 19v2.4M4.7 4.7l1.7 1.7M17.6 17.6l1.7 1.7M2.6 12h2.4M19 12h2.4M4.7 19.3l1.7-1.7M17.6 6.4l1.7-1.7"/>',
  recycle: '<path d="M8.9 5.6 11 2.9a1.3 1.3 0 0 1 2.1 0l2.3 3.5"/><path d="m15.4 6.4 3.9.1a1.3 1.3 0 0 1 1.1 2l-1.4 2.4"/><path d="M15 21h4.3M9.1 21H5.6a1.3 1.3 0 0 1-1.1-2l1.9-3.3"/><path d="m6.4 15.7-2.5 1.4M17 21l-2.3-1.3 2.3-1.3M14.2 6.9 12 3"/>',
  building: '<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M4 21h16"/><path d="M9.5 7h.01M14.5 7h.01M9.5 11h.01M14.5 11h.01M9.5 15h.01M14.5 15h.01"/><path d="M10.5 21v-3h3v3"/>',
  flask: '<path d="M9 3h6M10 3v5.8L5.4 16.8a2 2 0 0 0 1.7 3h9.8a2 2 0 0 0 1.7-3L14 8.8V3"/><path d="M8 15h8"/>',
  bike: '<circle cx="6" cy="17" r="3.2"/><circle cx="18" cy="17" r="3.2"/><path d="M6 17 10 8h4l2 4M9 8h5.5M14.5 8l1.5 3.5"/>',
  leaf: '<path d="M11 20A7 7 0 0 1 4 13c0-5 4.5-8.5 15-9-.5 9.5-4 14-11 14Z"/><path d="M4 21c4-5 7.5-7.5 12-9"/>',
  wheat: '<path d="M12 21V9"/><path d="M12 9c0-2.5-1.5-4-3.5-4C8.5 7.5 10 9 12 9ZM12 9c0-2.5 1.5-4 3.5-4C15.5 7.5 14 9 12 9ZM12 14c0-2.5-1.5-4-3.5-4C8.5 12.5 10 14 12 14ZM12 14c0-2.5 1.5-4 3.5-4C15.5 12.5 14 14 12 14Z"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
};

/**
 * Theme registry. `order` controls filter/legend sequencing. Colours are tuned
 * for legibility on the dark map (roughly equal luminance, restrained saturation).
 */
export const THEMES = {
  water: { id: 'water', label: 'Water', color: '#4FC4E4', icon: ICONS.droplet, blurb: 'Conservation & reuse', order: 1 },
  energy: { id: 'energy', label: 'Energy', color: '#F0B43E', icon: ICONS.sun, blurb: 'Renewables & efficiency', order: 2 },
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
