import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SustainabilityMap } from './components/SustainabilityMap';
import { Campus3DMap } from './components/Campus3DMap';
import './styles.css';

function App() {
  const [view, setView] = useState('3d');
  if (view === '3d') {
    return <Campus3DMap onShowIllustrated={() => setView('story')} />;
  }

  return (
    <main className="site-shell">
      <header className="site-header">
        <p className="eyebrow">IIT Bombay · Sustainability</p>
        <h1>Spot sustainability across campus</h1>
        <p className="intro">Explore the initiatives that reduce waste, conserve water, and generate clean energy.</p>
      </header>
      <div className="view-switch" aria-label="Choose map view">
        <button type="button" className={view === 'story' ? 'is-active' : ''} aria-pressed={view === 'story'} onClick={() => setView('story')}>Illustrated map</button>
        <button type="button" className={view === '3d' ? 'is-active' : ''} aria-pressed={view === '3d'} onClick={() => setView('3d')}>3D campus view</button>
      </div>
      <SustainabilityMap />
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
