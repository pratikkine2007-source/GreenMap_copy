/** Shared marker markup so the live MapLibre map and the UI lab render identically. */
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Inner markup for a `.gm-marker` button: category-tinted pin + label. */
export function markerInnerHTML({ icon, label }) {
  return (
    `<span class="gm-marker__pin">` +
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${icon}</svg>` +
    `</span>` +
    `<span class="gm-marker__label">${escapeHtml(label)}</span>`
  );
}
