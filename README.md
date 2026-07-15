# IIT Bombay Sustainability Map

## Run locally

```bash
npm install
npm run dev
```

## Integrate into the main site

Import `SustainabilityMap` from `src/components/SustainabilityMap.jsx` and render `<SustainabilityMap />` on any React page. The current data lives in `src/data/initiatives.js`; replace it later with a Supabase query without changing the component API. `Campus3DMap` is an optional OpenStreetMap-based 3D campus view, built with MapLibre GL JS and filtered to remove transport clutter.

## Data model for Supabase

Use an `initiatives` table with: `id`, `slug`, `title`, `category`, `description`, `map_x`, `map_y`, `location_status`, `image_url`, and `published`.
