// ============================================================
// ViralCut – Main Editor Page (OpenCut-style, ViralFlow design)
// ============================================================
import { useState, useCallback, useRef, useEffect } from 'react';
import { MediaFile, Track, TrackItem, Project, ExportState } from '@/viralcut/types';
import { createId, createDefaultProject, calcProjectDuration } from '@/viralcut/store';
import { MediaPanel } from '@/viralcut/components/MediaPanel';
import { PreviewPanel } from '@/viralcut/components/PreviewPanel';
import { Timeline } from '@/viralcut/components/Timeline';
import { Toolbar } from '@/viralcut/components/Toolbar';
import { PropertiesPanel } from '@/viralcut/components/PropertiesPanel';
import { ExportModal, ExportOptions } from '@/viralcut/components/ExportModal';
import { useIsMobile } from '@/hooks/use-mobile';
import { PanelLeft, PanelRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Helpers ──────────────────────────────────────────────────
async function generateThumbnail(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('video/')) { resolve(undefined); return; }
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.currentTime = 1;
    video.muted = true;
    video.onloadeddata = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(video, 0, 0, 160, 90);
      URL.revokeObjectURL(video.src);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    video.onerror = () => resolve(undefined);
  });
}

async function getMediaDuration(file: File): Promise<{ duration: number; width?: number; height?: number }> {
  return new Promise((resolve) => {
    if (file.type.startsWith('video/') || file.type.startsWith('audio/')) {
      const el = document.createElement(file.type.startsWith('video/') ? 'video' : 'audio') as HTMLVideoElement;
      el.src = URL.createObjectURL(file);
      el.onloadedmetadata = () => {
        URL.revokeObjectURL(el.src);
        resolve({
          duration: el.duration || 0,
          width: (el as HTMLVideoElement).videoWidth,
          height: (el as HTMLVideoElement).videoHeight,
        });
      };
      el.onerror = () => resolve({ duration: 0 });
    } else {
      resolve({ duration: 0 });
    }
  });
}

const MAX_HISTORY = 30;

const ViralCut = () => {
  const isMobile = useIsMobile();

  const [project, setProject] = useState<Project>(createDefaultProject());
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(80);

  const [exportOpen, setExportOpen] = useState(false);
  const [exportState, setExportState] = useState<ExportState>({
    status: 'idle', progress: 0, label: '',
  });

  const [showMedia, setShowMedia] = useState(true);
  const [showProperties, setShowProperties] = useState(true);

  // Undo/Redo
  const historyRef = useRef<Track[][]>([JSON.parse(JSON.stringify(project.tracks))]);
  const historyIndexRef = useRef(0);

  const pushHistory = useCallback((tracks: Track[]) => {
    const idx = historyIndexRef.current + 1;
    historyRef.current = historyRef.current.slice(0, idx);
    historyRef.current.push(JSON.parse(JSON.stringify(tracks)));
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    else historyIndexRef.current = historyRef.current.length - 1;
  }, []);

  const canUndo = historyIndexRef.current > 0;
  const canRedo = historyIndexRef.current < historyRef.current.length - 1;

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    historyIndexRef.current--;
    const tracks = JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current]));
    setProject((p) => ({ ...p, tracks, duration: calcProjectDuration(tracks) }));
  }, [canUndo]);

  const handleRedo = useCallback(() => {
    if (!canRedo) return;
    historyIndexRef.current++;
    const tracks = JSON.parse(JSON.stringify(historyRef.current[historyIndexRef.current]));
    setProject((p) => ({ ...p, tracks, duration: calcProjectDuration(tracks) }));
  }, [canRedo]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItemId) {
          const track = project.tracks.find((t) => t.items.some((i) => i.id === selectedItemId));
          if (track) handleItemDelete(track.id, selectedItemId);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo, selectedItemId, project.tracks]);

  // Playback ticker
  const tickRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPlaying) {
      const tick = (ts: number) => {
        if (lastTsRef.current !== null) {
          const dt = (ts - lastTsRef.current) / 1000;
          setCurrentTime((t) => {
            const next = t + dt;
            if (project.duration > 0 && next >= project.duration) {
              setIsPlaying(false);
              return project.duration;
            }
            return next;
          });
        }
        lastTsRef.current = ts;
        tickRef.current = requestAnimationFrame(tick);
      };
      tickRef.current = requestAnimationFrame(tick);
    } else {
      if (tickRef.current) cancelAnimationFrame(tickRef.current);
      lastTsRef.current = null;
    }
    return () => { if (tickRef.current) cancelAnimationFrame(tickRef.current); };
  }, [isPlaying, project.duration]);

  // ── Import media ─────────────────────────────────────────
  const handleImport = useCallback(async (files: FileList) => {
    for (const file of Array.from(files)) {
      const url = URL.createObjectURL(file);
      const { duration, width, height } = await getMediaDuration(file);
      const thumbnail = await generateThumbnail(file);
      const type: MediaFile['type'] = file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
        ? 'audio'
        : 'image';
      const mf: MediaFile = {
        id: createId(),
        name: file.name,
        type,
        file,
        url,
        duration,
        thumbnail,
        width,
        height,
      };
      setMedia((prev) => [...prev, mf]);
      setSelectedMediaId(mf.id);
    }
  }, []);

  const handleDeleteMedia = useCallback((id: string) => {
    setMedia((prev) => {
      const mf = prev.find((m) => m.id === id);
      if (mf) URL.revokeObjectURL(mf.url);
      return prev.filter((m) => m.id !== id);
    });
    setProject((p) => {
      const tracks = p.tracks.map((t) => ({
        ...t,
        items: t.items.filter((i) => i.mediaId !== id),
      }));
      const duration = calcProjectDuration(tracks);
      return { ...p, tracks, duration };
    });
  }, []);

  // ── Add media to timeline ─────────────────────────────────
  const handleAddToTimeline = useCallback((mediaId: string) => {
    const mf = media.find((m) => m.id === mediaId);
    if (!mf) return;
    setProject((p) => {
      const targetTrackType: Track['type'] = mf.type === 'audio' ? 'audio' : 'video';
      const track = p.tracks.find((t) => t.type === targetTrackType);
      if (!track) return p;

      const lastEnd = track.items.reduce((acc, i) => Math.max(acc, i.endTime), 0);
      const dur = mf.duration > 0 ? mf.duration : 5;

      const item: TrackItem = {
        id: createId(),
        mediaId,
        trackId: track.id,
        startTime: lastEnd,
        endTime: lastEnd + dur,
        mediaStart: 0,
        mediaEnd: dur,
        name: mf.name.replace(/\.[^.]+$/, ''),
        type: targetTrackType,
      };

      const tracks = p.tracks.map((t) =>
        t.id === track.id ? { ...t, items: [...t.items, item] } : t
      );
      const duration = calcProjectDuration(tracks);
      pushHistory(tracks);
      return { ...p, tracks, duration };
    });
  }, [media, pushHistory]);

  // ── Drop from media panel onto timeline ──────────────────
  const handleDropMedia = useCallback((trackId: string, mediaId: string, startTime: number) => {
    const mf = media.find((m) => m.id === mediaId);
    if (!mf) return;
    const dur = mf.duration > 0 ? mf.duration : 5;
    const item: TrackItem = {
      id: createId(),
      mediaId,
      trackId,
      startTime,
      endTime: startTime + dur,
      mediaStart: 0,
      mediaEnd: dur,
      name: mf.name.replace(/\.[^.]+$/, ''),
      type: mf.type === 'audio' ? 'audio' : 'video',
    };
    setProject((p) => {
      const tracks = p.tracks.map((t) =>
        t.id === trackId ? { ...t, items: [...t.items, item] } : t
      );
      const duration = calcProjectDuration(tracks);
      pushHistory(tracks);
      return { ...p, tracks, duration };
    });
  }, [media, pushHistory]);

  // ── Move item on timeline ─────────────────────────────────
  const handleItemMove = useCallback((trackId: string, itemId: string, newStart: number) => {
    setProject((p) => {
      const tracks = p.tracks.map((t) => {
        if (t.id !== trackId) return t;
        return {
          ...t,
          items: t.items.map((i) => {
            if (i.id !== itemId) return i;
            const dur = i.endTime - i.startTime;
            return { ...i, startTime: newStart, endTime: newStart + dur };
          }),
        };
      });
      const duration = calcProjectDuration(tracks);
      return { ...p, tracks, duration };
    });
  }, []);

  // ── Trim item (resize handles) ────────────────────────────
  const handleItemTrim = useCallback((
    trackId: string,
    itemId: string,
    newStart: number,
    newEnd: number,
    newMediaStart: number,
    newMediaEnd: number,
  ) => {
    setProject((p) => {
      const tracks = p.tracks.map((t) => {
        if (t.id !== trackId) return t;
        return {
          ...t,
          items: t.items.map((i) => {
            if (i.id !== itemId) return i;
            return { ...i, startTime: newStart, endTime: newEnd, mediaStart: newMediaStart, mediaEnd: newMediaEnd };
          }),
        };
      });
      const duration = calcProjectDuration(tracks);
      return { ...p, tracks, duration };
    });
  }, []);

  // ── Split item at time ────────────────────────────────────
  const handleItemSplit = useCallback((trackId: string, itemId: string, atTime: number) => {
    setProject((p) => {
      const track = p.tracks.find((t) => t.id === trackId);
      if (!track) return p;
      const item = track.items.find((i) => i.id === itemId);
      if (!item) return p;
      if (atTime <= item.startTime || atTime >= item.endTime) return p;

      const mediaAtSplit = item.mediaStart + (atTime - item.startTime);

      const left: TrackItem = {
        ...item,
        id: createId(),
        endTime: atTime,
        mediaEnd: mediaAtSplit,
      };
      const right: TrackItem = {
        ...item,
        id: createId(),
        startTime: atTime,
        mediaStart: mediaAtSplit,
      };

      const tracks = p.tracks.map((t) => {
        if (t.id !== trackId) return t;
        const newItems = t.items.flatMap((i) =>
          i.id === itemId ? [left, right] : [i]
        );
        return { ...t, items: newItems };
      });

      pushHistory(tracks);
      return { ...p, tracks, duration: calcProjectDuration(tracks) };
    });
    setSelectedItemId(null);
  }, [pushHistory]);

  // ── Delete item from timeline ─────────────────────────────
  const handleItemDelete = useCallback((trackId: string, itemId: string) => {
    setProject((p) => {
      const tracks = p.tracks.map((t) =>
        t.id === trackId ? { ...t, items: t.items.filter((i) => i.id !== itemId) } : t
      );
      const duration = calcProjectDuration(tracks);
      pushHistory(tracks);
      return { ...p, tracks, duration };
    });
    setSelectedItemId(null);
  }, [pushHistory]);

  // ── Track controls ────────────────────────────────────────
  const handleToggleMute = useCallback((trackId: string) => {
    setProject((p) => ({
      ...p,
      tracks: p.tracks.map((t) => t.id === trackId ? { ...t, muted: !t.muted } : t),
    }));
  }, []);

  const handleToggleLock = useCallback((trackId: string) => {
    setProject((p) => ({
      ...p,
      tracks: p.tracks.map((t) => t.id === trackId ? { ...t, locked: !t.locked } : t),
    }));
  }, []);

  // ── Export with FFmpeg ────────────────────────────────────
  const handleExport = useCallback(async (_opts: ExportOptions) => {
    setExportState({ status: 'preparing', progress: 5, label: 'Preparando…' });

    const videoItems = project.tracks
      .filter((t) => t.type === 'video')
      .flatMap((t) => t.items)
      .sort((a, b) => a.startTime - b.startTime);

    if (!videoItems.length) {
      setExportState({ status: 'error', progress: 0, label: '', error: 'Nenhum vídeo na timeline.' });
      return;
    }

    try {
      setExportState({ status: 'encoding', progress: 20, label: 'Carregando FFmpeg…' });

      // Dynamic import of FFmpeg
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

      const ffmpeg = new FFmpeg();

      ffmpeg.on('progress', ({ progress }) => {
        setExportState((s) => ({
          ...s,
          progress: 20 + Math.round(progress * 75),
          label: `Codificando… ${Math.round(progress * 100)}%`,
        }));
      });

      // Load FFmpeg WASM
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      setExportState((s) => ({ ...s, progress: 25, label: 'Importando clipes…' }));

      // Write all needed media files
      const writtenFiles = new Set<string>();
      for (const item of videoItems) {
        const mf = media.find((m) => m.id === item.mediaId);
        if (!mf || writtenFiles.has(mf.id)) continue;
        const filename = `input_${mf.id}.${mf.name.split('.').pop() ?? 'mp4'}`;
        await ffmpeg.writeFile(filename, await fetchFile(mf.url));
        writtenFiles.add(mf.id);
      }

      // Build filter_complex for concat with trim
      let filterParts: string[] = [];
      let concatInputs = '';
      videoItems.forEach((item, idx) => {
        const mf = media.find((m) => m.id === item.mediaId)!;
        const filename = `input_${mf.id}.${mf.name.split('.').pop() ?? 'mp4'}`;
        filterParts.push(
          `[${idx}:v]trim=start=${item.mediaStart.toFixed(3)}:end=${item.mediaEnd.toFixed(3)},setpts=PTS-STARTPTS[v${idx}]`
        );
        concatInputs += `[v${idx}]`;
      });

      filterParts.push(`${concatInputs}concat=n=${videoItems.length}:v=1:a=0[outv]`);
      const filterComplex = filterParts.join(';');

      // Build input args
      const inputArgs: string[] = [];
      videoItems.forEach((item) => {
        const mf = media.find((m) => m.id === item.mediaId)!;
        const filename = `input_${mf.id}.${mf.name.split('.').pop() ?? 'mp4'}`;
        inputArgs.push('-i', filename);
      });

      setExportState((s) => ({ ...s, progress: 30, label: 'Processando vídeo…' }));

      await ffmpeg.exec([
        ...inputArgs,
        '-filter_complex', filterComplex,
        '-map', '[outv]',
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-movflags', '+faststart',
        'output.mp4',
      ]);

      setExportState((s) => ({ ...s, progress: 97, label: 'Gerando download…' }));

      const rawData = await ffmpeg.readFile('output.mp4');
      // Convert FileData to Blob-compatible format
      let blobParts: BlobPart[];
      if (typeof rawData === 'string') {
        blobParts = [rawData];
      } else {
        // Copy Uint8Array to a plain ArrayBuffer to avoid SharedArrayBuffer issues
        const copy = new Uint8Array(rawData.length);
        copy.set(rawData as Uint8Array);
        blobParts = [copy.buffer];
      }
      const blob = new Blob(blobParts, { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name}.mp4`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      setExportState({ status: 'done', progress: 100, label: 'Download iniciado!' });
    } catch (err: any) {
      console.error('Export error:', err);
      setExportState({ status: 'error', progress: 0, label: '', error: err?.message ?? 'Erro ao exportar' });
    }
  }, [project, media]);

  // ── Selected item ─────────────────────────────────────────
  const selectedItem = selectedItemId
    ? project.tracks.flatMap((t) => t.items).find((i) => i.id === selectedItemId) ?? null
    : null;

  const selectedTrackId = selectedItemId
    ? project.tracks.find((t) => t.items.some((i) => i.id === selectedItemId))?.id ?? null
    : null;

  // ── Drag from media panel ─────────────────────────────────
  const handleMediaDragStart = (e: React.DragEvent, mediaId: string) => {
    e.dataTransfer.setData('mediaId', mediaId);
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* Toolbar */}
      <Toolbar
        projectName={project.name}
        onProjectNameChange={(name) => setProject((p) => ({ ...p, name }))}
        zoom={zoom}
        onZoomIn={() => setZoom((z) => Math.min(300, z + 20))}
        onZoomOut={() => setZoom((z) => Math.max(20, z - 20))}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onExport={() => { setExportState({ status: 'idle', progress: 0, label: '' }); setExportOpen(true); }}
      />

      {/* Main editor area */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* Left panel: Media library */}
        {showMedia && !isMobile && (
          <div className="w-[200px] xl:w-[220px] shrink-0 border-r border-border bg-card/50 flex flex-col overflow-hidden">
            {media.map((m) => (
              <div
                key={m.id}
                draggable
                onDragStart={(e) => handleMediaDragStart(e, m.id)}
                className="hidden"
              />
            ))}
            <MediaPanel
              media={media}
              selectedMediaId={selectedMediaId}
              onImport={handleImport}
              onSelect={setSelectedMediaId}
              onDelete={handleDeleteMedia}
              onAddToTimeline={handleAddToTimeline}
            />
          </div>
        )}

        {/* Center: Preview */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-r border-border">
          <PreviewPanel
            tracks={project.tracks}
            media={media}
            currentTime={currentTime}
            duration={project.duration}
            isPlaying={isPlaying}
            onTimeChange={setCurrentTime}
            onPlayPause={() => setIsPlaying((p) => !p)}
            projectName={project.name}
          />
        </div>

        {/* Right panel: Properties */}
        {showProperties && !isMobile && (
          <div className="w-[200px] xl:w-[220px] shrink-0 border-l border-border bg-card/50 overflow-hidden">
            <PropertiesPanel
              selectedItem={selectedItem}
              selectedTrackId={selectedTrackId}
              media={media}
              onDelete={handleItemDelete}
              onSplit={handleItemSplit}
              currentTime={currentTime}
            />
          </div>
        )}
      </div>

      {/* Timeline */}
      <div
        className="shrink-0 border-t border-border"
        style={{ height: isMobile ? 160 : 220 }}
      >
        {/* Timeline header */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-card/60 border-b border-border">
          <span className="text-[11px] font-semibold text-foreground uppercase tracking-wide flex-1">
            Timeline
          </span>
          <span className="text-[10px] text-muted-foreground hidden sm:block">
            Espaço = play/pause · Del = deletar · Arrastar borda = cortar
          </span>
          {!isMobile && (
            <>
              <button
                className={cn(
                  'p-1 rounded transition-colors text-muted-foreground hover:text-foreground',
                  showMedia && 'text-primary'
                )}
                onClick={() => setShowMedia((v) => !v)}
                title="Painel de mídia"
              >
                <PanelLeft className="h-3.5 w-3.5" />
              </button>
              <button
                className={cn(
                  'p-1 rounded transition-colors text-muted-foreground hover:text-foreground',
                  showProperties && 'text-primary'
                )}
                onClick={() => setShowProperties((v) => !v)}
                title="Propriedades"
              >
                <PanelRight className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Timeline body */}
        <div style={{ height: isMobile ? 128 : 188 }}>
          <Timeline
            tracks={project.tracks}
            media={media}
            currentTime={currentTime}
            duration={project.duration}
            zoom={zoom}
            selectedItemId={selectedItemId}
            onSeek={(t) => { setCurrentTime(t); setIsPlaying(false); }}
            onItemMove={handleItemMove}
            onItemTrim={handleItemTrim}
            onItemDelete={handleItemDelete}
            onItemSelect={setSelectedItemId}
            onItemSplit={handleItemSplit}
            onTrackToggleMute={handleToggleMute}
            onTrackToggleLock={handleToggleLock}
            onDropMedia={handleDropMedia}
          />
        </div>
      </div>

      {/* Export modal */}
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onExport={handleExport}
        exportState={exportState}
        project={project}
      />
    </div>
  );
};

export default ViralCut;
