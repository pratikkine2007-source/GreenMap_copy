import { useEffect, useRef } from 'react';
import { resolveTheme, prettyCategory } from '../../map/categories';
import { CategoryGlyph, IconClose, IconPin, IconSpark } from './icons';

/**
 * Selected-initiative detail. Renders as a floating card on desktop and a
 * bottom sheet on mobile (styling switches via CSS at the 760px breakpoint).
 * A category-coloured "app icon" badge straddles the header and body.
 * Purely presentational — parent owns selection state.
 */
export function InitiativeDetail({ initiative, onClose }) {
  const closeRef = useRef(null);

  // Focus the close control on open + support Escape to dismiss.
  useEffect(() => {
    if (!initiative) return undefined;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [initiative, onClose]);

  if (!initiative) return null;
  const theme = resolveTheme(initiative.category);
  const hasImage = Boolean(initiative.image_url);
  const location = initiative.location || initiative.building;

  return (
    <aside
      className={`gm-detail ${hasImage ? 'has-media' : 'no-media'}`}
      style={{ '--cat': theme.color }}
      role="dialog"
      aria-label={`${initiative.title} details`}
    >
      <div className="gm-detail__grip" aria-hidden="true" />

      <div className="gm-detail__header">
        {hasImage && <img src={initiative.image_url} alt={initiative.title} loading="lazy" />}
      </div>

      <span className="gm-detail__badge" aria-hidden="true">
        <CategoryGlyph theme={theme} />
      </span>

      <button ref={closeRef} type="button" className="gm-detail__close" onClick={onClose} aria-label="Close details">
        <IconClose />
      </button>

      <div className="gm-detail__body">
        <span className="gm-detail__eyebrow">{prettyCategory(initiative.category)}</span>
        <h2 className="gm-detail__title">{initiative.title}</h2>
        {initiative.description && <p className="gm-detail__desc">{initiative.description}</p>}
        {location && <p className="gm-detail__meta"><IconPin />{location}</p>}
        {initiative.image_stat && <p className="gm-detail__stat"><IconSpark />{initiative.image_stat}</p>}
      </div>
    </aside>
  );
}
