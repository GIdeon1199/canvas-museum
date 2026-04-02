import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { MuseumScene } from './components/MuseumScene';
import { Player } from './components/Player';
import { DrawingUI } from './components/DrawingUI';
import { useCanvasStore } from './stores/useCanvasStore';
import * as THREE from 'three';
import './index.css';

const App = () => {
  const activeCanvas = useCanvasStore(state => state.activeCanvas);
  const isLocked = useCanvasStore(state => state.isLocked);
  const hasPlayedIntro = useCanvasStore(state => state.hasPlayedIntro);
  const isMobile = useCanvasStore(state => state.isMobile);
  const hasStartedMobile = useCanvasStore(state => state.hasStartedMobile);
  const setHasStartedMobile = useCanvasStore(state => state.setHasStartedMobile);
  const paintings = useCanvasStore(state => state.paintings);

  const handleJumpToCanvas = () => {
    const currentPaintings = useCanvasStore.getState().paintings;
    if (!currentPaintings['station_1']) {
      useCanvasStore.getState().setTeleportTarget({ x: -6.9, z: -65, rotationY: Math.PI / 2 });
    } else if (!currentPaintings['station_2']) {
      useCanvasStore.getState().setTeleportTarget({ x: 6.9, z: -65, rotationY: -Math.PI / 2 });
    } else {
      if (document.pointerLockElement) document.exitPointerLock();
      alert("Both Creation Stations are occupied and saving artworks to the gallery. Please explore while they finish.");
    }
  };

  React.useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't trigger if user is typing in an input field (e.g. inside DrawingUI)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key.toLowerCase() === 'j') {
        const state = useCanvasStore.getState();
        if (!state.activeCanvas && (state.hasPlayedIntro || state.hasStartedMobile)) {
          handleJumpToCanvas();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      {/* 3D WebGL Context */}
      <Canvas 
        shadows 
        style={{ pointerEvents: activeCanvas ? 'none' : 'auto' }}
        gl={{ 
          antialias: true, 
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.9,
          outputColorSpace: THREE.SRGBColorSpace
        }}
      >
        <color attach="background" args={[0x0a0a0a]} />
        <fog attach="fog" args={[0x0a0a0a, 0, 50]} />
        <Suspense fallback={null}>
          <MuseumScene />
        </Suspense>
        {!activeCanvas && <Player />}
      </Canvas>

      {/* 2D HTML Overlays */}
      {!isMobile && <div id="crosshair" className={activeCanvas || !isLocked ? 'hidden' : ''}></div>}
      {isMobile && hasStartedMobile && !activeCanvas && (
        <div id="crosshair"></div>
      )}
      
      {!activeCanvas && ((!isMobile && !isLocked) || (isMobile && !hasStartedMobile)) && (
        <div 
          id="instructions" 
          className={hasPlayedIntro ? 'ready' : 'animating'} 
          onClick={() => { if (isMobile) setHasStartedMobile(true) }}
          onTouchStart={() => {
            useCanvasStore.getState().forceMobileMode();
            setHasStartedMobile(true);
          }}
        >
          {hasPlayedIntro ? (
            <div className="tutorial-content">
              <h1>The Kunstraum Gallery</h1>
              <div className="tutorial-sections">
                <div className="tutorial-box">
                  <h3>What this is</h3>
                  <p>A collaborative blank canvas digital museum.</p>
                </div>
                <div className="tutorial-box">
                  <h3>What to do</h3>
                  <p>Walk around and paint your own artwork on any blank canvas.</p>
                </div>
                <div className="tutorial-box">
                  <h3>How to do it</h3>
                  <p>Walk: <strong>Hold Click</strong> or <strong>Scroll</strong></p>
                  <p>Look around: <strong>Move Mouse</strong></p>
                  <p>Paint: <strong>Short Click</strong> near a canvas</p>
                </div>
              </div>
              <p className="click-pulse" style={{ marginTop: '40px' }}>
                [ {isMobile ? "TAP ANYWHERE TO START" : "CLICK TO ENTER"} ]
              </p>
            </div>
          ) : (
            <h1 className="entering-text">Descending...</h1>
          )}
        </div>
      )}

      {isMobile && hasStartedMobile && !activeCanvas && (
        <button 
          id="mobile-walk-btn"
          onPointerDown={() => useCanvasStore.setState({ isMobileWalking: true })}
          onPointerUp={() => useCanvasStore.setState({ isMobileWalking: false })}
          onPointerLeave={() => useCanvasStore.setState({ isMobileWalking: false })}
          onPointerCancel={() => useCanvasStore.setState({ isMobileWalking: false })}
        >
          HOLD TO WALK
        </button>  
      )}

      {!isMobile && isLocked && !activeCanvas && (
        <div id="hud-controls">
          <div className="hud-item"><span>⇕ Scroll / Hold Click</span> Move</div>
          <div className="hud-item"><span>⤡ Mouse</span> Look</div>
          <div className="hud-item"><span>◎ Aim + Click</span> Paint</div>
          <div className="hud-item"><span>ESC</span> Pause</div>
        </div>
      )}

      {!activeCanvas && (hasPlayedIntro || hasStartedMobile) && (
        <button id="jump-canvas-btn" onClick={handleJumpToCanvas}>
          {isMobile ? "START PAINTING" : "[ J ] START PAINTING"}
        </button>  
      )}

      {/* React UI Editor Overlay */}
      <DrawingUI />
    </>
  );
};

export default App;
