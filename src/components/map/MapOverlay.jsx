import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { resolveTheme, prettyCategory } from '../../map/categories';
import {
  CategoryGlyph, IconSearch, IconClose, IconPlus, IconMinus,
  IconLocate, IconReset, IconGrid,
} from './icons';
import { InitiativeDetail } from './InitiativeDetail';

/* ---------- Search + autocomplete ---------- */
function SearchBar({ initiatives, themes, query, onQueryChange, onPickInitiative, onPickCategory }) {
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef(null);
  const boxRef = useRef(null);
  const listId = useId();

  const q = query.trim().toLowerCase();
  const suggestions = useMemo(() => {
    const cats = themes
      .filter((t) => !q || t.label.toLowerCase().includes(q))
      .map((t) => ({ type: 'category', key: `c-${t.id}`, theme: t }));
    const inits = initiatives
      .filter((it) => {
        if (!q) return false;
        const hay = `${it.title} ${prettyCategory(it.category)} ${it.location || it.building || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 6)
      .map((it) => ({ type: 'initiative', key: `i-${it.id}`, initiative: it }));
    // When empty, offer categories as quick picks; when typing, initiatives first.
    return q ? [...inits, ...cats.slice(0, 4)] : cats;
  }, [q, themes, initiatives]);

  const open = focused && suggestions.length > 0 || (focused && q.length > 0);

  useEffect(() => { setActive(-1); }, [query, focused]);

  // Close on outside click.
  useEffect(() => {
    if (!focused) return undefined;
    const onDown = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setFocused(false); };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [focused]);

  const choose = (s) => {
    if (!s) return;
    if (s.type === 'initiative') { onPickInitiative(s.initiative); onQueryChange(''); }
    else { onPickCategory(s.theme.id); onQueryChange(''); }
    setFocused(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, suggestions.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { if (active >= 0) { e.preventDefault(); choose(suggestions[active]); } }
    else if (e.key === 'Escape') { if (query) onQueryChange(''); else setFocused(false); inputRef.current?.blur(); }
  };

  return (
    <div className={`gm-search ${open ? 'is-open' : ''}`} ref={boxRef}>
      <div className="gm-search__box" role="combobox" aria-expanded={open} aria-owns={listId} aria-haspopup="listbox">
        <IconSearch className="gm-search__icon" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder="Search initiatives"
          aria-label="Search the campus map"
          aria-autocomplete="list"
          aria-controls={listId}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={onKeyDown}
        />
        {query && (
          <button type="button" className="gm-search__clear" onClick={() => { onQueryChange(''); inputRef.current?.focus(); }} aria-label="Clear search">
            <IconClose />
          </button>
        )}
      </div>

      {open && (
        <div className="gm-suggest" id={listId} role="listbox">
          {suggestions.length === 0 ? (
            <p className="gm-suggest__empty">No matches for <b>“{query}”</b>. Try a category like Water or Energy.</p>
          ) : (
            <div className="gm-suggest__group">
              {q && <p className="gm-suggest__label">Results</p>}
              {suggestions.map((s, i) => {
                const theme = s.type === 'category' ? s.theme : resolveTheme(s.initiative.category);
                const title = s.type === 'category' ? s.theme.label : s.initiative.title;
                const meta = s.type === 'category'
                  ? `${s.theme.count ?? ''} ${s.theme.count === 1 ? 'initiative' : 'initiatives'}`.trim()
                  : prettyCategory(s.initiative.category);
                return (
                  <button
                    key={s.key}
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    className={`gm-suggest__item ${i === active ? 'is-active' : ''}`}
                    style={{ '--cat': theme.color }}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(s)}
                  >
                    <span className="gm-glyph gm-glyph--28"><CategoryGlyph theme={theme} /></span>
                    <span className="gm-suggest__item-body">
                      <span className="gm-suggest__title">{title}</span>
                      <span className="gm-suggest__meta">{meta}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Category filter chips ---------- */
function CategoryFilter({ themes, active, onChange, total }) {
  return (
    <div className="gm-filters" role="tablist" aria-label="Filter initiatives by category">
      <button
        type="button" role="tab" aria-selected={active === 'all'}
        className={`gm-chip gm-chip--all ${active === 'all' ? 'is-active' : ''}`}
        onClick={() => onChange('all')}
      >
        <span className="gm-chip__glyph"><IconGrid /></span>
        All<span className="gm-chip__count">{total}</span>
      </button>
      {themes.map((t) => (
        <button
          key={t.id} type="button" role="tab" aria-selected={active === t.id}
          className={`gm-chip ${active === t.id ? 'is-active' : ''}`}
          style={{ '--cat': t.color }}
          onClick={() => onChange(active === t.id ? 'all' : t.id)}
        >
          <span className="gm-chip__glyph"><CategoryGlyph theme={t} /></span>
          {t.label}<span className="gm-chip__count">{t.count}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Map controls ---------- */
function MapControls({ onControl, locating }) {
  return (
    <div className="gm-controls">
      <div className="gm-ctrl-group">
        <button type="button" className="gm-ctrl" onClick={() => onControl('zoom-in')} aria-label="Zoom in"><IconPlus /></button>
        <button type="button" className="gm-ctrl" onClick={() => onControl('zoom-out')} aria-label="Zoom out"><IconMinus /></button>
      </div>
      <div className="gm-ctrl-group">
        <button type="button" className={`gm-ctrl ${locating ? 'is-busy' : ''}`} onClick={() => onControl('locate')} aria-label="Find my location"><IconLocate /></button>
        <button type="button" className="gm-ctrl" onClick={() => onControl('reset')} aria-label="Reset view"><IconReset /></button>
      </div>
    </div>
  );
}

/**
 * Full overlay layer for the campus map: search, category filters, controls and
 * the selected-initiative detail. Presentational + transient UI state only;
 * data, active category, query and selection are owned by the parent so the
 * MapLibre markers stay the single source of truth. (The filter row doubles as
 * the category key, so there is no separate legend.)
 */
export function MapOverlay({
  map, initiatives, themes, activeCategory, onCategoryChange,
  query, onQueryChange, selected, onSelect, onControl, locating,
}) {
  return (
    <div className="gm-overlay">
      <div className="gm-topbar">
        <SearchBar
          initiatives={initiatives}
          themes={themes}
          query={query}
          onQueryChange={onQueryChange}
          onPickInitiative={onSelect}
          onPickCategory={onCategoryChange}
        />
        <CategoryFilter themes={themes} active={activeCategory} onChange={onCategoryChange} total={initiatives.length} />
      </div>

      <MapControls onControl={onControl} locating={locating} />

      {/* GSAP-managed presence; pin-anchored card / bottom sheet. */}
      <InitiativeDetail map={map} selected={selected} onClose={() => onSelect(null)} />
    </div>
  );
}
