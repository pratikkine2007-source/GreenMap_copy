import { useEffect, useRef, useState } from 'react';
import {
  Ion, Viewer, Terrain, Cartesian3, Color, Math as CesiumMath,
  createOsmBuildingsAsync, SceneMode,
} from 'cesium';
import campusBoundaryText from '../data/iitb-circular-boundary.geojson?raw';

const CESIUM_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN?.trim();
if (CESIUM_TOKEN) Ion.defaultAccessToken = CESIUM_TOKEN;

const campusBoundary = JSON.parse(campusBoundaryText);
const campusRing = campusBoundary.features[0].geometry.coordinates[0];
const bbox = campusRing.reduce(
  (acc, [lng, lat]) => ({
    minLng: Math.min(acc.minLng, lng), minLat: Math.min(acc.minLat, lat),
    maxLng: Math.max(acc.maxLng, lng), maxLat: Math.max(acc.maxLat, lat),
  }),
  { minLng: 180, minLat: 90, maxLng: -180, maxLat: -90 },
);
const CENTER = [(bbox.minLng + bbox.maxLng) / 2, (bbox.minLat + bbox.maxLat) / 2];
const RING_FLAT = campusRing.flat();

/**
 * Cesium + Ion realistic Earth for the hero and the orbital descent only.
 * When the descent lands (near top-down over campus) it calls `onDescentComplete`
 * so the parent can cross-fade to the interactive OpenStreetMap view.
 */
export function CampusGlobe({ onDescentStart, onDescentComplete }) {
  const container = useRef(null);
  const viewerRef = useRef(null);
  const phaseRef = useRef('intro');
  const [phase, setPhase] = useState('intro');
  const hasToken = Boolean(CESIUM_TOKEN);

  function beginDescent() {
    const viewer = viewerRef.current;
    if (!viewer || phaseRef.current !== 'intro') return;
    phaseRef.current = 'descending';
    setPhase('descending');
    onDescentStart?.();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? 0 : 5;
    const arrive = () => {
      if (phaseRef.current === 'arrived') return;   // fire once
      phaseRef.current = 'arrived';
      onDescentComplete?.();
    };
    viewer.camera.flyTo({
      // Land almost straight down over campus centre so the frame lines up with
      // the OpenStreetMap handoff view; the OSM map then tilts up into 3D.
      destination: Cartesian3.fromDegrees(CENTER[0], CENTER[1], 2500),
      orientation: {
        heading: CesiumMath.toRadians(12),
        pitch: CesiumMath.toRadians(-85),
        roll: 0,
      },
      duration,
      complete: arrive,
    });
    // Safety net: if the flyTo `complete` callback never fires (e.g. the tab was
    // throttled in the background), force the handoff shortly after it should end.
    window.setTimeout(arrive, duration * 1000 + 900);
  }

  useEffect(() => {
    if (!hasToken) return undefined;
    const viewer = new Viewer(container.current, {
      terrain: Terrain.fromWorldTerrain(),
      animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
      homeButton: false, sceneModePicker: false, navigationHelpButton: false,
      fullscreenButton: false, infoBox: false, selectionIndicator: false,
      navigationInstructionsInitiallyVisible: false, requestRenderMode: false,
      scene3DOnly: true,
    });
    viewerRef.current = viewer;

    const { scene } = viewer;
    scene.mode = SceneMode.SCENE3D;
    scene.skyAtmosphere.show = true;
    scene.fog.enabled = true;
    scene.globe.enableLighting = false;
    scene.globe.showGroundAtmosphere = true;
    scene.highDynamicRange = false;
    scene.backgroundColor = Color.fromCssColorString('#02100b');
    viewer.cesiumWidget.creditContainer.style.display = 'none';

    // High orbit over the Arabian Sea — subcontinent framed on the right.
    viewer.camera.setView({ destination: Cartesian3.fromDegrees(69, 17, 10_200_000) });
    scene.screenSpaceCameraController.enableInputs = false;

    createOsmBuildingsAsync()
      .then((buildings) => {
        const live = viewerRef.current;
        if (live && !live.isDestroyed()) live.scene.primitives.add(buildings);
      })
      .catch((e) => console.warn('OSM Buildings unavailable:', e));

    viewer.entities.add({
      polyline: {
        positions: Cartesian3.fromDegreesArray(RING_FLAT),
        width: 3,
        clampToGround: true,
        material: Color.fromCssColorString('#4bf39c'),
      },
    });

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) beginDescent();

    return () => {
      viewerRef.current = null;
      viewer.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasToken]);

  return (
    <div className="globe-layer">
      <div ref={container} className="globe-canvas" aria-label="Interactive 3D globe of IIT Bombay campus" />
      <div className="campus-experience-vignette" aria-hidden="true" />

      {!hasToken && (
        <div className="globe-token-notice">
          <div>
            <h2>One step left</h2>
            <p>Paste your free Cesium Ion token into <code>.env</code> as <code>VITE_CESIUM_ION_TOKEN</code>, then restart the dev server to load the realistic Earth.</p>
          </div>
        </div>
      )}

      {/* ---- Hero cover (Earth visible behind) ---- */}
      <div className={`hero-cover hero-cover--globe ${phase === 'intro' ? '' : 'is-lifting'}`} aria-hidden={phase !== 'intro'}>
        <div className="hero-content">
          <div className="hero-brand">
      <img
        src="/assets/suscell-logo.svg"
        alt="Sustainability Cell IIT Bombay"
        className="hero-logo"
      />          
        <span className="hero-brand-text"><strong>GreenMap</strong><small>Sustainability Cell · IIT Bombay</small></span>
          </div>
          <h1 className="hero-title">A <span className="hero-accent">greener</span> IIT&nbsp;Bombay, mapped.</h1>
          <p className="hero-sub">
            Explore the projects making campus more sustainable - clean energy, water, waste and the research behind them.
          </p>
          <div className="hero-actions">
            <button type="button" className="hero-cta" onClick={beginDescent} disabled={!hasToken}>
              Explore the map
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m0 0-5-5m5 5-5 5" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
