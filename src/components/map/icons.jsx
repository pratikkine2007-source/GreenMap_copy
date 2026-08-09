/* Single-stroke UI icons (Lucide-derived). Category glyphs live in ../../map/categories. */
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
const svg = (children, extra = {}) => (
  <svg viewBox="0 0 24 24" {...S} {...extra} aria-hidden="true">{children}</svg>
);

export const IconSearch = (p) => svg(<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>, p);
export const IconClose = (p) => svg(<path d="M18 6 6 18M6 6l12 12" />, p);
export const IconPlus = (p) => svg(<path d="M12 5v14M5 12h14" />, p);
export const IconMinus = (p) => svg(<path d="M5 12h14" />, p);
export const IconLocate = (p) => svg(<><circle cx="12" cy="12" r="3.2" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></>, p);
export const IconReset = (p) => svg(<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>, p);
export const IconChevron = (p) => svg(<path d="m6 9 6 6 6-6" />, p);
export const IconPin = (p) => svg(<><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>, p);
export const IconLayers = (p) => svg(<><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>, p);
export const IconSpark = (p) => svg(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.4 2.4M15.3 15.3l2.4 2.4M17.7 6.3l-2.4 2.4M8.7 15.3l-2.4 2.4" />, p);
export const IconGrid = (p) => svg(<><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>, p);

/** Render a category theme's inline-SVG glyph (trusted, from our registry). */
export function CategoryGlyph({ theme, className }) {
  if (!theme) return null;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: theme.icon }} />
  );
}
