// ============================================================
// CropModal — interactive crop region selector
// The crop is a clipping mask: the video renders at its normal
// size/position, but only the selected region is visible.
// Values stored as 0–1 fractions of the rendered video area.
// ============================================================
import { useRef, useState, useEffect, useCallback } from 'react';
import { X, RotateCcw, Check } from 'lucide-react';
import { TrackItem, MediaFile } from '../types';

interface CropModalProps {
  item:      TrackItem;
  mediaFile: MediaFile;
  onApply:   (cropX: number, cropY: number, cropW: number, cropH: number) => void;
  onClose:   () => void;
}

type Corner = 'tl' | 'tr' | 'bl' | 'br';

function clientPos(e: MouseEvent | TouchEvent) {
  if ('touches' in e) return { x: (e as TouchEvent).touches[0].clientX, y: (e as TouchEvent).touches[0].clientY };
  return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };
}

export function CropModal({ item, mediaFile, onApply, onClose }: CropModalProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [ready, setReady] = useState(false);
  const [crop, setCrop] = useState({
    x: item.videoDetails?.cropX ?? item.imageDetails?.cropX ?? 0,
    y: item.videoDetails?.cropY ?? item.imageDetails?.cropY ?? 0,
    w: item.videoDetails?.cropW ?? item.imageDetails?.cropW ?? 1,
    h: item.videoDetails?.cropH ?? item.imageDetails?.cropH ?? 1,
  });

  // Seek video to clip start for preview
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onLoaded = () => {
      v.currentTime = item.mediaStart ?? 0;
      setReady(true);
    };
    v.addEventListener('loadedmetadata', onLoaded);
    if (v.readyState >= 1) onLoaded();
    return () => v.removeEventListener('loadedmetadata', onLoaded);
  }, [item.mediaStart]);

  // ── Drag move (center) ──────────────────────────────────────
  const handleCenterDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const start = clientPos(e.nativeEvent as MouseEvent | TouchEvent);
    const origX = crop.x;
    const origY = crop.y;
    const w = crop.w;
    const h = crop.h;

    const onMove = (ev: MouseEvent | TouchEvent) => {
      ev.preventDefault();
      const cur = clientPos(ev);
      const dx = (cur.x - start.x) / rect.width;
      const dy = (cur.y - start.y) / rect.height;
      const nx = Math.max(0, Math.min(1 - w, origX + dx));
      const ny = Math.max(0, Math.min(1 - h, origY + dy));
      setCrop((c) => ({ ...c, x: nx, y: ny }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
  }, [crop]);

  // ── Drag corner ─────────────────────────────────────────────
  const handleCorner = useCallback((corner: Corner) => (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const start  = clientPos(e.nativeEvent as MouseEvent | TouchEvent);
    const origCrop = { ...crop };

    const onMove = (ev: MouseEvent | TouchEvent) => {
      ev.preventDefault();
      const cur = clientPos(ev);
      const dx = (cur.x - start.x) / rect.width;
      const dy = (cur.y - start.y) / rect.height;
      const MIN = 0.1;

      setCrop((c) => {
        let { x, y, w, h } = { ...origCrop };
        if (corner === 'tl') {
          const nx = Math.max(0, Math.min(x + w - MIN, x + dx));
          const ny = Math.max(0, Math.min(y + h - MIN, y + dy));
          w = w + (x - nx);
          h = h + (y - ny);
          x = nx;
          y = ny;
        } else if (corner === 'tr') {
          const ny = Math.max(0, Math.min(y + h - MIN, y + dy));
          w = Math.max(MIN, Math.min(1 - x, w + dx));
          h = h + (y - ny);
          y = ny;
        } else if (corner === 'bl') {
          const nx = Math.max(0, Math.min(x + w - MIN, x + dx));
          w = w + (x - nx);
          h = Math.max(MIN, Math.min(1 - y, h + dy));
          x = nx;
        } else {
          w = Math.max(MIN, Math.min(1 - x, w + dx));
          h = Math.max(MIN, Math.min(1 - y, h + dy));
        }
        return { x, y, w, h };
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMove, { passive: false });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);
  }, [crop]);

  const handleReset = () => setCrop({ x: 0, y: 0, w: 1, h: 1 });
  const handleApply = () => onApply(crop.x, crop.y, crop.w, crop.h);

  // CSS for the 4 dark overlay strips outside the crop rect
  const pct = {
    left:   `${crop.x * 100}%`,
    top:    `${crop.y * 100}%`,
    right:  `${(1 - crop.x - crop.w) * 100}%`,
    bottom: `${(1 - crop.y - crop.h) * 100}%`,
    width:  `${crop.w * 100}%`,
    height: `${crop.h * 100}%`,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-xl shadow-2xl flex flex-col sm:flex-row overflow-hidden w-[95vw] max-w-3xl max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Left panel: controls ────────────────────────── */}
        <div className="flex flex-col gap-4 p-5 sm:w-52 shrink-0 border-b sm:border-b-0 sm:border-r border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Recortar</h2>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-muted/60 text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="text-xs text-muted-foreground">
            Arraste o retângulo para definir a região visível. O resto ficará invisível.
          </div>

          <div className="text-xs space-y-1 text-muted-foreground/70">
            <div>X: {(crop.x * 100).toFixed(1)}%  Y: {(crop.y * 100).toFixed(1)}%</div>
            <div>L: {(crop.w * 100).toFixed(1)}%  A: {(crop.h * 100).toFixed(1)}%</div>
          </div>

          <div className="flex flex-col gap-2 mt-auto">
            <button
              onClick={handleReset}
              className="flex items-center justify-center gap-2 h-9 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Redefinir
            </button>
            <button
              onClick={handleApply}
              className="flex items-center justify-center gap-2 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
              Aplicar
            </button>
          </div>
        </div>

        {/* ── Right panel: preview ────────────────────────── */}
        <div className="flex-1 flex items-center justify-center bg-black/60 p-4 min-h-[260px]">
          <div
            ref={containerRef}
            className="relative select-none"
            style={{ maxWidth: '100%', maxHeight: '100%' }}
          >
            {/* Video element for frame preview */}
            <video
              ref={videoRef}
              src={mediaFile.url}
              muted
              playsInline
              preload="metadata"
              style={{
                display: 'block',
                maxWidth: '480px',
                maxHeight: '360px',
                width: 'auto',
                height: 'auto',
                objectFit: 'contain',
              }}
            />

            {ready && (
              <>
                {/* Dark overlays outside crop */}
                {/* Top strip */}
                <div className="absolute inset-x-0 top-0 bg-black/60 pointer-events-none" style={{ height: pct.top }} />
                {/* Bottom strip */}
                <div className="absolute inset-x-0 bottom-0 bg-black/60 pointer-events-none" style={{ height: pct.bottom }} />
                {/* Left strip (between top and bottom) */}
                <div
                  className="absolute left-0 bg-black/60 pointer-events-none"
                  style={{ top: pct.top, bottom: pct.bottom, width: pct.left }}
                />
                {/* Right strip */}
                <div
                  className="absolute right-0 bg-black/60 pointer-events-none"
                  style={{ top: pct.top, bottom: pct.bottom, width: pct.right }}
                />

                {/* Crop rectangle — draggable center */}
                <div
                  className="absolute cursor-move"
                  style={{
                    left: pct.left,
                    top: pct.top,
                    width: pct.width,
                    height: pct.height,
                    border: '2px dashed #22d3ee',
                    boxSizing: 'border-box',
                  }}
                  onMouseDown={handleCenterDrag}
                  onTouchStart={handleCenterDrag}
                />

                {/* Corner handles */}
                {(['tl', 'tr', 'bl', 'br'] as Corner[]).map((corner) => (
                  <div
                    key={corner}
                    className="absolute w-4 h-4 bg-white border-2 border-cyan-400 rounded-full z-10 cursor-pointer"
                    style={{
                      left:      corner.includes('l') ? `calc(${pct.left} - 8px)` : `calc(${pct.left} + ${pct.width} - 8px)`,
                      top:       corner.includes('t') ? `calc(${pct.top} - 8px)`  : `calc(${pct.top} + ${pct.height} - 8px)`,
                      transform: 'none',
                    }}
                    onMouseDown={handleCorner(corner)}
                    onTouchStart={handleCorner(corner)}
                  />
                ))}
              </>
            )}

            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center text-white/50 text-sm">
                Carregando…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
