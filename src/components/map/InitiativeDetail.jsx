import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { resolveTheme, prettyCategory } from '../../map/categories';
import { CategoryGlyph, IconClose, IconPin, IconSpark } from './icons';

// True only for a real narrow viewport. A width of 0 (a transient layout/pane
// glitch) must NOT read as mobile, or `mode` flips sheet<->float and restarts
// the entrance animation mid-flight.
function isNarrow() {
  if (typeof window === 'undefined') return false;
  const w = window.innerWidth;
  return w > 0 && w <= 760;
}
function useIsMobile() {
  const [mobile, setMobile] = useState(isNarrow);
  useEffect(() => {
    const on = () => setMobile((prev) => {
      const w = window.innerWidth;
      if (w === 0) return prev; // ignore glitch frames
      return w <= 760;
    });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return mobile;
}

/**
 * Initiative detail — a floating glass side card on desktop, a bottom sheet on
 * mobile. Presence + choreography are driven by GSAP (scale/slide entrance,
 * staggered content, asymmetric faster exit). Mounted only while selected.
 */
export function InitiativeDetail({ map, selected, onClose }) {
  const isMobile = useIsMobile();
  const [data, setData] = useState(selected);
  const [shown, setShown] = useState(Boolean(selected));
  const cardRef = useRef(null);
  const closeRef = useRef(null);
  const exitingRef = useRef(false);
  const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const mode = isMobile ? 'sheet' : 'float';

  // Anchor the float card just to the right of the selected pin, tracking the
  // map as it pans/zooms. Flips to the pin's left near the screen edge and
  // clamps within the viewport so it never runs off-screen or under the topbar.
  // Positions via the DOM ref (not React state) so the per-frame updates during
  // the fly-to never re-render and interrupt the GSAP entrance.
  const canAnchor = mode === 'float' && Boolean(map) && Number.isFinite(data?.lng) && Number.isFinite(data?.lat);
  useLayoutEffect(() => {
    if (!shown || !canAnchor) return undefined;
    const GAP = 16;
    const MARGIN = 12;
    const TOP_SAFE = 168; // clear the search + filter toolbar
    const update = () => {
      const card = cardRef.current;
      if (!card) return;
      const p = map.project([data.lng, data.lat]);
      const w = card.offsetWidth || 336;
      const h = card.offsetHeight || 320;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      // Sit in the centre-right band: to the pin's right, but no further left
      // than the viewport centre. Flip to the pin's left only if that overflows.
      let left = Math.max(p.x + GAP, Math.round(vw * 0.5));
      if (left + w > vw - MARGIN) left = p.x - GAP - w; // flip left if it overflows
      left = Math.max(MARGIN, Math.min(left, vw - w - MARGIN));
      let top = p.y - h * 0.5 - 28;               // roughly centre on the pin body
      top = Math.max(TOP_SAFE, Math.min(top, vh - h - MARGIN));
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;
      card.style.right = 'auto';
    };
    update();
    map.on('move', update);
    window.addEventListener('resize', update);
    return () => {
      map.off('move', update);
      window.removeEventListener('resize', update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, canAnchor, data?.id, map]);

  // Presence: enter on select; animate out (faster) on deselect, then unmount.
  useEffect(() => {
    if (selected) {
      exitingRef.current = false;
      setData(selected);
      setShown(true);
    } else if (shown && !exitingRef.current) {
      exitingRef.current = true;
      const card = cardRef.current;
      if (!card || reduce) { setShown(false); return; }
      const done = () => setShown(false);
      if (mode === 'sheet') gsap.to(card, { yPercent: 100, autoAlpha: 0, duration: 0.28, ease: 'power2.in', onComplete: done });
      else gsap.to(card, { autoAlpha: 0, scale: 0.94, duration: 0.2, ease: 'power2.in', onComplete: done });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    if (!shown) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown, onClose]);

  // GSAP entrance per selection.
  useLayoutEffect(() => {
    if (!shown || !data) return undefined;
    const card = cardRef.current;
    const q = gsap.utils.selector(card);
    let tl;
    if (reduce) {
      gsap.set(card, { autoAlpha: 1, scale: 1, yPercent: 0 });
      gsap.set(q('[data-stagger]'), { autoAlpha: 1, y: 0 });
    } else {
      tl = gsap.timeline();
      if (mode === 'sheet') {
        tl.fromTo(card, { yPercent: 100 }, { yPercent: 0, duration: 0.5, ease: 'power3.out' });
      } else {
        tl.fromTo(card, { autoAlpha: 0, scale: 0.92, x: 14 }, { autoAlpha: 1, scale: 1, x: 0, duration: 0.42, ease: 'power3.out' });
      }
      tl.fromTo(q('[data-stagger]'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.4, stagger: 0.05, ease: 'power2.out' }, mode === 'sheet' ? '-=0.30' : '-=0.24');
      tl.fromTo(q('.gm-detail__badge'), { scale: 0.5, rotate: -8 }, { scale: 1, rotate: 0, duration: 0.5, ease: 'back.out(2)' }, '-=0.34');
    }
    closeRef.current?.focus({ preventScroll: true });

    return () => { tl?.kill(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, data?.id, mode]);

  if (!shown || !data) return null;
  const theme = resolveTheme(data.category);
  const hasImage = Boolean(data.image_url);
  const location = data.location || data.building;

  const card = (
    <aside
      ref={cardRef}
      className={`gm-detail gm-detail--${mode}`}
      data-placement="above"
      style={{ '--cat': theme.color }}
      role="dialog"
      aria-label={`${data.title} details`}
    >
      {mode === 'sheet' && <div className="gm-detail__grip" aria-hidden="true" />}

      <button ref={closeRef} type="button" className="gm-detail__close" onClick={onClose} aria-label="Close details">
        <IconClose />
      </button>

      {hasImage && (
        <div className="gm-detail__photo" data-stagger>
          <img src={data.image_url} alt={data.title} loading="lazy" />
        </div>
      )}

      <div className="gm-detail__body">
        <div className="gm-detail__kicker" data-stagger>
          <span className="gm-detail__badge"><CategoryGlyph theme={theme} /></span>
          <span className="gm-detail__eyebrow">{prettyCategory(data.category)}</span>
        </div>
        <h2 className="gm-detail__title" data-stagger>{data.title}</h2>
        {data.description && <p className="gm-detail__desc" data-stagger>{data.description}</p>}
        {location && <p className="gm-detail__meta" data-stagger><IconPin />{location}</p>}
        {data.image_stat && <div className="gm-detail__stat" data-stagger><IconSpark />{data.image_stat}</div>}
      </div>
    </aside>
  );

  return card;
}
