import React, { useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '../stores/useCanvasStore';
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity';

const profanityMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;
const COLORS = ['#111111', '#e73c3c', '#3498db', '#2ecc71', '#f1c40f', '#ffffff'];
const DEFAULT_ARTWORK = {
  title: '',
  artist: '',
  description: '',
};

const getArtworkData = (entry) => {
  if (!entry) return null;
  if (typeof entry === 'string') {
    return {
      imageData: entry,
      ...DEFAULT_ARTWORK,
    };
  }

  return {
    imageData: entry.imageData ?? '',
    title: entry.title ?? '',
    artist: entry.artist ?? '',
    description: entry.description ?? '',
  };
};

export const DrawingUI = () => {
  const activeCanvas = useCanvasStore((state) => state.activeCanvas);
  const setActiveCanvas = useCanvasStore((state) => state.setActiveCanvas);
  const requestRelock = useCanvasStore((state) => state.requestRelock);
  const paintings = useCanvasStore((state) => state.paintings);
  const savePainting = useCanvasStore((state) => state.savePainting);

  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);

  const [currentColor, setCurrentColor] = useState('#111111');
  const [brushSize, setBrushSize] = useState(10);
  const [brushHardness, setBrushHardness] = useState(1.0);
  const [opacity, setOpacity] = useState(1.0);
  const [currentTool, setCurrentTool] = useState('brush');
  const [cursorPos, setCursorPos] = useState(null);
  const lineStart = useRef(null);
  const lastDrawPos = useRef(null);
  const [artworkMeta, setArtworkMeta] = useState(DEFAULT_ARTWORK);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [isPlaqueModalOpen, setIsPlaqueModalOpen] = useState(true);

  const hasProfanity = profanityMatcher.hasMatch([artworkMeta.title, artworkMeta.artist, artworkMeta.description].join(' '));

  const canSave =
    artworkMeta.title.trim() &&
    artworkMeta.artist.trim() &&
    !hasProfanity;

  const commitSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const snapshot = canvas.toDataURL('image/png');
    const lastSnapshot = undoStackRef.current[undoStackRef.current.length - 1];
    if (snapshot === lastSnapshot) return;

    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > 25) undoStackRef.current.shift();
    redoStackRef.current = [];
    setHistoryVersion((value) => value + 1);
  };

  const restoreSnapshot = (dataUrl, callback) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      ctx.drawImage(img, 0, 0);
      if (callback) callback(ctx);
    };
    img.src = dataUrl;
  };

  const fillCanvas = (fillStyle) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = fillStyle;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  };

  useEffect(() => {
    if (!activeCanvas || !canvasRef.current) return;

    const existingArtwork = getArtworkData(paintings[activeCanvas]);
    setArtworkMeta(
      existingArtwork
        ? {
            title: existingArtwork.title,
            artist: existingArtwork.artist,
            description: existingArtwork.description,
          }
        : DEFAULT_ARTWORK,
    );
    setIsPlaqueModalOpen(true);

    undoStackRef.current = [];
    redoStackRef.current = [];

    if (existingArtwork?.imageData) {
      restoreSnapshot(existingArtwork.imageData);
    } else {
      fillCanvas('#ffffff');
    }

    requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      undoStackRef.current = [canvas.toDataURL('image/png')];
      redoStackRef.current = [];
      setHistoryVersion((value) => value + 1);
    });
  }, [activeCanvas, paintings]);

  useEffect(() => {
    if (!activeCanvas) return undefined;

    const handleKeyDown = (event) => {
      if (!(event.metaKey || event.ctrlKey)) return;

      if (event.key.toLowerCase() === 'z' && event.shiftKey) {
        event.preventDefault();
        handleRedo();
        return;
      }

      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        handleUndo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCanvas]);

  if (!activeCanvas) return null;

  const hexToRgb = (hex) => {
    const bigint = parseInt(hex.replace('#', ''), 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255, 255];
  };

  const doFloodFill = (startX, startY) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    const fillRgb = currentTool === 'eraser' ? [255, 255, 255, 0] : hexToRgb(currentColor);

    const startPos = (Math.floor(startY) * canvas.width + Math.floor(startX)) * 4;
    const sr = data[startPos];
    const sg = data[startPos + 1];
    const sb = data[startPos + 2];
    const sa = data[startPos + 3];

    if (sr === fillRgb[0] && sg === fillRgb[1] && sb === fillRgb[2] && sa === fillRgb[3]) return;

    const matchColor = (pos) => data[pos] === sr && data[pos + 1] === sg && data[pos + 2] === sb && data[pos + 3] === sa;
    const colorPixel = (pos) => {
      data[pos] = fillRgb[0];
      data[pos + 1] = fillRgb[1];
      data[pos + 2] = fillRgb[2];
      data[pos + 3] = currentTool === 'eraser' ? 0 : Math.round(opacity * 255);
    };

    const stack = [[Math.floor(startX), Math.floor(startY)]];

    while (stack.length > 0) {
      const [x, y] = stack.pop();
      let cx = x;
      let pos = (y * canvas.width + x) * 4;

      while (cx >= 0 && matchColor(pos)) {
        cx--;
        pos -= 4;
      }
      cx++;
      pos += 4;

      let spanAbove = false;
      let spanBelow = false;

      while (cx < canvas.width && matchColor(pos)) {
        colorPixel(pos);

        if (y > 0) {
          if (matchColor(pos - canvas.width * 4)) {
            if (!spanAbove) {
              stack.push([cx, y - 1]);
              spanAbove = true;
            }
          } else if (spanAbove) {
            spanAbove = false;
          }
        }

        if (y < canvas.height - 1) {
          if (matchColor(pos + canvas.width * 4)) {
            if (!spanBelow) {
              stack.push([cx, y + 1]);
              spanBelow = true;
            }
          } else if (spanBelow) {
            spanBelow = false;
          }
        }

        cx++;
        pos += 4;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  };

  const getCoordinates = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const applyBrushPath = (ctx, start, end) => {
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = `rgba(0, 0, 0, ${opacity})`;
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = currentColor;
      ctx.globalAlpha = opacity;
      
      if (brushHardness < 1.0) {
        ctx.shadowBlur = (1 - brushHardness) * brushSize;
        ctx.shadowColor = currentColor;
      } else {
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
      }
    }

    ctx.beginPath();
    if (start) ctx.moveTo(start.x, start.y);
    if (end) {
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }
    
    ctx.globalAlpha = 1.0;
  };

  const startDrawing = (event) => {
    const coords = getCoordinates(event);

    if (currentTool === 'fill') {
      doFloodFill(coords.x, coords.y);
      commitSnapshot();
      return;
    }

    isDrawing.current = true;
    lineStart.current = coords;
    lastDrawPos.current = coords;

    const ctx = canvasRef.current.getContext('2d');
    applyBrushPath(ctx, coords, currentTool === 'line' ? null : coords);
  };

  const draw = (event) => {
    const coords = getCoordinates(event);
    setCursorPos({ x: event.clientX, y: event.clientY });

    if (!isDrawing.current || currentTool === 'fill') return;

    const ctx = canvasRef.current.getContext('2d');

    if (currentTool === 'line') {
      const lastSnapshot = undoStackRef.current[undoStackRef.current.length - 1];
      if (lastSnapshot) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          ctx.drawImage(img, 0, 0);
          applyBrushPath(ctx, lineStart.current, coords);
        };
        img.src = lastSnapshot;
      }
    } else {
      applyBrushPath(ctx, lastDrawPos.current, coords);
      lastDrawPos.current = coords;
    }
  };

  const stopDrawing = (event) => {
    if (!isDrawing.current) {
        setCursorPos(null);
        return;
    }
    isDrawing.current = false;
    
    if (currentTool === 'line') {
       const ctx = canvasRef.current.getContext('2d');
       const coords = getCoordinates(event);
       restoreSnapshot(undoStackRef.current[undoStackRef.current.length - 1], (c) => {
          applyBrushPath(c, lineStart.current, coords);
          commitSnapshot();
       });
       setCursorPos(null);
       return;
    }

    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    
    setCursorPos(null);
    commitSnapshot();
  };

  const handleUndo = () => {
    if (undoStackRef.current.length <= 1) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const currentSnapshot = undoStackRef.current.pop();
    redoStackRef.current.push(currentSnapshot);
    restoreSnapshot(undoStackRef.current[undoStackRef.current.length - 1]);
    setHistoryVersion((value) => value + 1);
  };

  const handleRedo = () => {
    if (!redoStackRef.current.length) return;

    const nextSnapshot = redoStackRef.current.pop();
    undoStackRef.current.push(nextSnapshot);
    restoreSnapshot(nextSnapshot);
    setHistoryVersion((value) => value + 1);
  };

  const handleClear = () => {
    fillCanvas('#ffffff');
    commitSnapshot();
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${artworkMeta.title || 'Artwork'}.png`;
    a.click();
  };

  const handleMetaChange = (field) => (event) => {
    const { value } = event.target;
    setArtworkMeta((current) => ({ ...current, [field]: value }));
  };

  const closeEditor = () => {
    requestRelock();
    setActiveCanvas(null);
  };

  const handleSave = () => {
    if (!canSave) return;

    const canvas = canvasRef.current;
    const snapshotCanvas = document.createElement('canvas');
    snapshotCanvas.width = CANVAS_WIDTH;
    snapshotCanvas.height = CANVAS_HEIGHT;

    const ctx = snapshotCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.drawImage(canvas, 0, 0);

    savePainting(activeCanvas, {
      imageData: snapshotCanvas.toDataURL('image/png'),
      title: artworkMeta.title.trim(),
      artist: artworkMeta.artist.trim(),
      description: artworkMeta.description.trim(),
    });

    closeEditor();
  };

  return (
    <div className="drawing-ui-overlay">
      <div className="drawing-container">
        <div className="drawing-header">
          <div>
            <h2>Canvas Editor</h2>
            <p className="drawing-subtitle">
              Register the work first, then step into the canvas editor.
            </p>
          </div>

          <div className="header-actions">
            <button onClick={() => setIsPlaqueModalOpen(true)} className="btn-ghost">
              Edit Plaque
            </button>
            <button onClick={closeEditor} className="btn-ghost">
              Abandon Art
            </button>
            <button
              onClick={handleSave}
              className="btn-primary"
              disabled={!canSave}
              title={canSave ? 'Hang this work on the wall' : 'Add title, artist, and plaque text first'}
            >
              Hang on Wall
            </button>
          </div>
        </div>

        <div className={`drawing-workspace ${isPlaqueModalOpen ? 'drawing-workspace-locked' : ''}`}>
          <div className="drawing-tools">
            <div className="tool-group">
              <label>Medium</label>
              <div className="tool-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '8px' }}>
                <button
                  className={`btn-tool ${currentTool === 'brush' ? 'active-tool' : ''}`}
                  onClick={() => setCurrentTool('brush')}
                >
                  Brush
                </button>
                <button
                  className={`btn-tool ${currentTool === 'eraser' ? 'active-tool' : ''}`}
                  onClick={() => setCurrentTool('eraser')}
                >
                  Eraser
                </button>
                <button
                  className={`btn-tool ${currentTool === 'line' ? 'active-tool' : ''}`}
                  onClick={() => setCurrentTool('line')}
                >
                  Line
                </button>
                <button
                  className={`btn-tool ${currentTool === 'fill' ? 'active-tool' : ''}`}
                  onClick={() => setCurrentTool('fill')}
                >
                  Fill
                </button>
              </div>
            </div>

            <div className="tool-group">
              <label>Colors</label>
              <div className="color-palette">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    className={`color-swatch ${currentColor === color && currentTool !== 'eraser' ? 'active' : ''}`}
                    style={{ background: color, border: color === '#ffffff' ? '1px solid #ddd' : 'none' }}
                    onClick={() => {
                      setCurrentColor(color);
                      if (currentTool === 'eraser') setCurrentTool('brush');
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="tool-group">
              <label>Canvas Actions</label>
              <div className="tool-grid">
                <button
                  key={`undo-${historyVersion}`}
                  className="btn-tool"
                  onClick={handleUndo}
                  disabled={undoStackRef.current.length <= 1}
                >
                  Undo
                </button>
                <button
                  key={`redo-${historyVersion}`}
                  className="btn-tool"
                  onClick={handleRedo}
                  disabled={!redoStackRef.current.length}
                >
                  Redo
                </button>
                <button className="btn-tool" onClick={handleExport}>
                  Export
                </button>
                <button className="btn-tool" onClick={handleClear}>
                  Clear
                </button>
              </div>
              <p className="tool-hint">Shortcuts: Ctrl/Cmd+Z for undo, Shift+Ctrl/Cmd+Z for redo.</p>
            </div>

            <div className="tool-group">
              <label>Brush Size</label>
              <div className="range-header">
                <span>{brushSize}px</span>
              </div>
              <input
                type="range"
                min="2"
                max="100"
                value={brushSize}
                onChange={(event) => setBrushSize(Number.parseInt(event.target.value, 10))}
              />
            </div>

            <div className="tool-group">
              <label>Hardness</label>
              <div className="range-header">
                <span>{Math.round(brushHardness * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={brushHardness}
                onChange={(event) => setBrushHardness(Number.parseFloat(event.target.value))}
              />
            </div>

            <div className="tool-group">
              <label>Opacity</label>
              <div className="range-header">
                <span>{Math.round(opacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={opacity}
                onChange={(event) => setOpacity(Number.parseFloat(event.target.value))}
              />
            </div>

            <div className="tool-group tool-group-grow">
              <label>Plaque</label>
              <input
                className="text-input"
                type="text"
                placeholder="Artwork title"
                value={artworkMeta.title}
                onChange={handleMetaChange('title')}
              />
              <input
                className="text-input"
                type="text"
                placeholder="Artist name"
                value={artworkMeta.artist}
                onChange={handleMetaChange('artist')}
              />
              <textarea
                className="text-input text-area"
                placeholder="A short statement or wall text for visitors"
                value={artworkMeta.description}
                onChange={handleMetaChange('description')}
                maxLength={180}
              />
              <div className="plaque-status">
                <span>{artworkMeta.description.length}/180</span>
                {!canSave && hasProfanity && <span style={{ color: '#ff4444' }}>Profanity detected. Please revise.</span>}
                {!canSave && !hasProfanity && <span>Title and Artist required to hang the work.</span>}
              </div>
            </div>
          </div>

          <div className="canvas-wrapper">
            <div className="art-frame-preview" style={{ cursor: 'crosshair', position: 'relative', overflow: 'hidden' }}>
              <canvas
                ref={canvasRef}
                id="paintCanvas"
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); startDrawing(e); }}
                onPointerMove={draw}
                onPointerUp={(e) => { e.currentTarget.releasePointerCapture(e.pointerId); stopDrawing(e); }}
                onPointerCancel={stopDrawing}
                onPointerLeave={stopDrawing}
              />
              {cursorPos && currentTool !== 'fill' && (
                <div 
                  style={{
                    position: 'fixed',
                    left: cursorPos.x,
                    top: cursorPos.y,
                    width: brushSize,
                    height: brushSize,
                    borderRadius: '50%',
                    transform: 'translate(-50%, -50%)',
                    pointerEvents: 'none',
                    backgroundColor: currentTool === 'eraser' ? 'rgba(255,255,255,0.5)' : currentColor,
                    opacity: opacity,
                    boxShadow: brushHardness < 1 ? `0 0 ${brushSize * (1-brushHardness)}px ${currentColor}` : 'none',
                    border: '1px solid rgba(100,100,100,0.5)',
                    zIndex: 9999
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {isPlaqueModalOpen && (
          <div className="plaque-modal-backdrop">
            <div className="plaque-modal">
              <span className="plaque-modal-kicker">Before You Paint</span>
              <h3>Name the work</h3>
              <p>
                Add the wall plaque details now. Visitors will see this text under the painting once it is hung.
              </p>

              <input
                className="text-input"
                type="text"
                placeholder="Artwork title"
                value={artworkMeta.title}
                onChange={handleMetaChange('title')}
              />
              <input
                className="text-input"
                type="text"
                placeholder="Artist name"
                value={artworkMeta.artist}
                onChange={handleMetaChange('artist')}
              />
              <textarea
                className="text-input text-area"
                placeholder="A short statement or wall text for visitors"
                value={artworkMeta.description}
                onChange={handleMetaChange('description')}
                maxLength={180}
              />

              <div className="plaque-status">
                <span>{artworkMeta.description.length}/180</span>
                {!canSave && hasProfanity && <span style={{ color: '#ff4444' }}>Profanity detected. Please revise.</span>}
                {!canSave && !hasProfanity && <span>Add a Title and Artist to begin painting.</span>}
              </div>

              <div className="plaque-modal-actions">
                <button onClick={closeEditor} className="btn-ghost">
                  Exit Editor
                </button>
                <button
                  onClick={() => setIsPlaqueModalOpen(false)}
                  className="btn-primary"
                  disabled={!canSave}
                >
                  Start Painting
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
