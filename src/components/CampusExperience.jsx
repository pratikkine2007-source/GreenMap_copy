import { useCallback, useRef, useState } from 'react';
import { CampusGlobe } from './CampusGlobe';
import { OsmCampusMap } from './OsmCampusMap';

/**
 * Orchestrates the two engines:
 *   1. Cesium realistic globe for the hero + orbital descent.
 *   2. The original MapLibre / OpenStreetMap + Supabase map for the campus.
 *
 * The OSM map mounts (hidden, top-down) the moment the descent starts so it can
 * preload. When BOTH the descent has landed and the map is ready, we cross-fade:
 * the globe blurs out, the OSM map tilts up into 3D — one continuous move.
 */
export function CampusExperience() {
  const [phase, setPhase] = useState('intro'); // intro | descending | map
  const [cesiumGone, setCesiumGone] = useState(false);
  const descentDone = useRef(false);
  const osmReady = useRef(false);

  const maybeHandoff = useCallback(() => {
    if (!descentDone.current || !osmReady.current) return;
    setPhase('map');
    // Retire the Cesium viewer once the cross-fade has finished.
    window.setTimeout(() => setCesiumGone(true), 1500);
  }, []);

  const handleDescentStart = useCallback(() => {
    setPhase((p) => (p === 'intro' ? 'descending' : p));
  }, []);

  const handleDescentComplete = useCallback(() => {
    descentDone.current = true;
    maybeHandoff();
  }, [maybeHandoff]);

  const handleOsmReady = useCallback(() => {
    osmReady.current = true;
    maybeHandoff();
  }, [maybeHandoff]);

  return (
    <section className={`campus-experience is-globe is-${phase}`} aria-label="Immersive IIT Bombay sustainability map">
      {phase !== 'intro' && (
        <OsmCampusMap active={phase === 'map'} onReady={handleOsmReady} />
      )}

      {!cesiumGone && (
        <CampusGlobe onDescentStart={handleDescentStart} onDescentComplete={handleDescentComplete} />
      )}

      <div className="campus-hud">
        <div className="hud-brand">
          <span className="hud-mark" aria-hidden="true" />
          <span><strong>GreenMap</strong><small>IIT Bombay</small></span>
        </div>
      </div>
    </section>
  );
}
