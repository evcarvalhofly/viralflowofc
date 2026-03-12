// ============================================================
// ViralCut – Main Editor Page
// ============================================================
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  MediaFile, Track, TrackItem, Project, ExportState,
  DEFAULT_TEXT_DETAILS, DEFAULT_VIDEO_DETAILS, DEFAULT_AUDIO_DETAILS, DEFAULT_IMAGE_DETAILS
} from '@/viralcut/types';
import { createId, createDefaultProject } from '@/viralcut/store';
import { sanitizeTracks, sanitizeProject, MIN_CLIP_DURATION } from '@/viralcut/utils/sanitize';
import { useEditorHistory } from '@/viralcut/hooks/useEditorHistory';
import { useProjectPersistence } from '@/viralcut/hooks/useProjectPersistence';
import { MediaPanel } from '@/viralcut/components/MediaPanel';
import { PreviewPanel } from '@/viralcut/components/PreviewPanel';
import { Timeline } from '@/viralcut/components/Timeline';
import { Toolbar } from '@/viralcut/components/Toolbar';
import { PropertiesPanel } from '@/viralcut/components/PropertiesPanel';
import { ExportModal, ExportOptions } from '@/viralcut/components/ExportModal';
import { AutoCut, SilenceRegion, applySilenceCuts } from '@/viralcut/components/AutoCut';
import { exportTimelineContinuous } from '@/viralcut/export/exportTimelineContinuous';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  PanelLeft, PanelRight, Scissors, Music, Type, Layers, Zap,
  Upload, Plus, Wand2, X, ZoomIn, ZoomOut
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Helpers ──────────────────────────────────────────────────
async function generateThumbnail(file: File): Promise<string | undefined> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('video/')) { resolve(undefined); return; }
    const objUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    const timeout = setTimeout(() => { URL.revokeObjectURL(objUrl); resolve(undefined); }, 8000);
    const cleanup = () => { clearTimeout(timeout); URL.revokeObjectURL(objUrl); };
    video.onerror = () => { cleanup(); resolve(undefined); };
    video.onloadeddata = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 160; canvas.height = 90;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(video, 0, 0, 160, 90);
        cleanup();
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } catch { cleanup(); resolve(undefined); }
    };
    video.src = objUrl;
    video.currentTime = 1;
  });
}

function sanitizeDuration(d: number): number {
  if (!isFinite(d) || isNaN(d) || d <= 0) return 0;
  return Math.min(d, 3600 * 4);
}

async function getMediaDuration(file: File): Promise<{ duration: number; width?: number; height?: number }> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('video/') && !file.type.startsWith('audio/')) {
      resolve({ duration: 0 });
      return;
    }
    const isVideo = file.type.startsWith('video/');
    const objUrl = URL.createObjectURL(file);
    const el = document.createElement(isVideo ? 'video' : 'audio') as HTMLVideoElement;
    el.preload = 'metadata';
    el.muted = true;

    const extract = () => ({
      duration: sanitizeDuration(el.duration),
      width: el.videoWidth > 0 ? el.videoWidth : undefined,
      height: el.videoHeight > 0 ? el.videoHeight : undefined,
    });

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(objUrl);
      resolve(extract());
    }, 10000);

    const done = (ok: boolean) => {
      clearTimeout(timeout);
      URL.revokeObjectURL(objUrl);
      resolve(ok ? extract() : { duration: 0 });
    };

    el.onloadedmetadata = () => done(true);
    el.onerror = () => done(false);
    el.src = objUrl;
  });
}

/** Compute project duration from tracks */
function calcDuration(tracks: Track[]): number {
  let max = 0;
  for (const t of tracks) for (const i of t.items) if (i.endTime > max) max = i.endTime;
  return max;
}

type MobileTab = 'editar' | 'audio' | 'texto' | 'efeitos' | 'camada';

const ViralCut = () => {
  const isMobile = useIsMobile();
  const importRef = useRef<HTMLInputElement>(null);
  const importJsonRef = useRef<HTMLInputElement>(null);
  const autoCutImportRef = useRef<HTMLInputElement>(null);
  const splitAllRef = useRef<(() => void) | null>(null);

  // ── Core project state ────────────────────────────────────
  const [project, setProjectRaw] = useState<Project>(() => sanitizeProject(createDefaultProject()));
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // ── Playback state ────────────────────────────────────────
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(80);

  // ── UI state ──────────────────────────────────────────────
  const [exportOpen, setExportOpen] = useState(false);
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle', progress: 0, label: '' });
  const [showMedia, setShowMedia] = useState(true);
  const [showProperties, setShowProperties] = useState(true);
  const [mobileTab, setMobileTab] = useState<MobileTab>('editar');
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [showAutoCut, setShowAutoCut] = useState(false);
  const [pendingAutoCutFile, setPendingAutoCutFile] = useState<FileList | null>(null);

  const hasMedia = media.length > 0;

  // ── History ───────────────────────────────────────────────
  const history = useEditorHistory(project.tracks);

  // ── Central project updater – sanitizes + optionally pushes history ──
  const updateProject = useCallback((
    updater: (prev: Project) => Project,
    opts: { pushHistory?: boolean } = {}
  ) => {
    setProjectRaw((prev) => {
      const next = updater(prev);
      const sanitizedTracks = sanitizeTracks(next.tracks);
      const duration = calcDuration(sanitizedTracks);
      const safe: Project = { ...next, tracks: sanitizedTracks, duration };
      if (opts.pushHistory) history.push(sanitizedTracks);
      return safe;
    });
  }, [history]);

  // ── Undo / Redo ───────────────────────────────────────────
  const handleUndo = useCallback(() => {
    const tracks = history.undo();
    if (!tracks) return;
    setProjectRaw((p) => ({ ...p, tracks, duration: calcDuration(tracks) }));
  }, [history]);

  const handleRedo = useCallback(() => {
    const tracks = history.redo();
    if (!tracks) return;
    setProjectRaw((p) => ({ ...p, tracks, duration: calcDuration(tracks) }));
  }, [history]);

  const canUndo = history.canUndo();
  const canRedo = history.canRedo();

  // ── Persistence (autosave + JSON import/export) ───────────
  const persistence = useProjectPersistence(project, (restored) => {
    const safe = sanitizeProject(restored);
    setProjectRaw(safe);
  });

  // ── Keyboard shortcuts ────────────────────────────────────
  useEffect(() => {
    if (isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); setIsPlaying((p) => !p); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? handleRedo() : handleUndo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); persistence.saveNow(); }
      if (e.key === 's' || e.key === 'S') { e.preventDefault(); splitAllRef.current?.(); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItemId) {
          const track = project.tracks.find((t) => t.items.some((i) => i.id === selectedItemId));
          if (track) handleItemDelete(track.id, selectedItemId);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleUndo, handleRedo, selectedItemId, project.tracks, isMobile]);

  // ── Ref to latest tracks for RAF/effect callbacks ─────────
  const tracksRef = useRef(project.tracks);
  useEffect(() => { tracksRef.current = project.tracks; }, [project.tracks]);

  // ── Playback ticker ───────────────────────────────────────
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

  // ── Memoised derived data for Timeline / PreviewPanel ─────
  // Avoids rebuilding on unrelated state changes
  const stableTracks = useMemo(() => project.tracks, [project.tracks]);

  // ── Import media ──────────────────────────────────────────
  const handleImport = useCallback(async (files: FileList) => {
    for (const file of Array.from(files)) {
      const url = URL.createObjectURL(file);
      const { duration, width, height } = await getMediaDuration(file);
      const thumbnail = await generateThumbnail(file);
      const type: MediaFile['type'] = file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'image';
      const mf: MediaFile = { id: createId(), name: file.name, type, file, url, duration, thumbnail, width, height };
      setMedia((prev) => [...prev, mf]);
      setSelectedMediaId(mf.id);
      updateProject((p) => {
        const targetType: Track['type'] = type === 'audio' ? 'audio' : type === 'image' ? 'image' : 'video';
        let track = p.tracks.find((t) => t.type === targetType);
        let tracks = p.tracks;
        if (!track && targetType === 'image') {
          const newTrack: Track = { id: createId(), type: 'image', items: [], locked: false, muted: false };
          tracks = [...p.tracks, newTrack];
          track = newTrack;
        }
        if (!track) return p;
        const lastEnd = track.items.reduce((acc, i) => Math.max(acc, i.endTime), 0);
        const dur = duration > 0 ? duration : 5;
        const item: TrackItem = {
          id: createId(), mediaId: mf.id, trackId: track.id,
          startTime: lastEnd, endTime: lastEnd + dur,
          mediaStart: 0, mediaEnd: dur,
          name: file.name.replace(/\.[^.]+$/, ''),
          type: targetType,
          videoDetails: targetType === 'video' ? { ...DEFAULT_VIDEO_DETAILS } : undefined,
          audioDetails: targetType === 'audio' ? { ...DEFAULT_AUDIO_DETAILS } : undefined,
          imageDetails: targetType === 'image' ? { ...DEFAULT_IMAGE_DETAILS } : undefined,
        };
        const newTracks = tracks.map((t) => t.id === track!.id ? { ...t, items: [...t.items, item] } : t);
        return { ...p, tracks: newTracks };
      }, { pushHistory: true });
    }
  }, [updateProject]);

  const handleAutoCutImport = useCallback(async (files: FileList) => {
    await handleImport(files);
    setPendingAutoCutFile(files);
    setShowAutoCut(true);
    if (isMobile) { setShowMobilePanel(true); setMobileTab('editar'); }
  }, [handleImport, isMobile]);

  const handleDeleteMedia = useCallback((id: string) => {
    setMedia((prev) => {
      const mf = prev.find((m) => m.id === id);
      if (mf) URL.revokeObjectURL(mf.url);
      return prev.filter((m) => m.id !== id);
    });
    updateProject((p) => ({
      ...p,
      tracks: p.tracks.map((t) => ({ ...t, items: t.items.filter((i) => i.mediaId !== id) })),
    }));
  }, [updateProject]);

  const handleAddToTimeline = useCallback((mediaId: string) => {
    const mf = media.find((m) => m.id === mediaId);
    if (!mf) return;
    updateProject((p) => {
      const targetType: Track['type'] = mf.type === 'audio' ? 'audio' : mf.type === 'image' ? 'image' : 'video';
      let track = p.tracks.find((t) => t.type === targetType);
      let tracks = p.tracks;
      if (!track && targetType === 'image') {
        const newTrack: Track = { id: createId(), type: 'image', items: [], locked: false, muted: false };
        tracks = [...p.tracks, newTrack];
        track = newTrack;
      }
      if (!track) return p;
      const lastEnd = track.items.reduce((acc, i) => Math.max(acc, i.endTime), 0);
      const dur = mf.duration > 0 ? mf.duration : 5;
      const item: TrackItem = {
        id: createId(), mediaId, trackId: track.id,
        startTime: lastEnd, endTime: lastEnd + dur,
        mediaStart: 0, mediaEnd: dur,
        name: mf.name.replace(/\.[^.]+$/, ''),
        type: targetType,
        videoDetails: targetType === 'video' ? { ...DEFAULT_VIDEO_DETAILS } : undefined,
        audioDetails: targetType === 'audio' ? { ...DEFAULT_AUDIO_DETAILS } : undefined,
        imageDetails: targetType === 'image' ? { ...DEFAULT_IMAGE_DETAILS } : undefined,
      };
      const newTracks = tracks.map((t) => t.id === track!.id ? { ...t, items: [...t.items, item] } : t);
      return { ...p, tracks: newTracks };
    }, { pushHistory: true });
  }, [media, updateProject]);

  const handleDropMedia = useCallback((trackId: string, mediaId: string, startTime: number) => {
    const mf = media.find((m) => m.id === mediaId);
    if (!mf) return;
    const dur = mf.duration > 0 ? mf.duration : 5;
    const type: TrackItem['type'] = mf.type === 'audio' ? 'audio' : mf.type === 'image' ? 'image' : 'video';
    const item: TrackItem = {
      id: createId(), mediaId, trackId,
      startTime, endTime: startTime + dur,
      mediaStart: 0, mediaEnd: dur,
      name: mf.name.replace(/\.[^.]+$/, ''), type,
      videoDetails: type === 'video' ? { ...DEFAULT_VIDEO_DETAILS } : undefined,
      audioDetails: type === 'audio' ? { ...DEFAULT_AUDIO_DETAILS } : undefined,
      imageDetails: type === 'image' ? { ...DEFAULT_IMAGE_DETAILS } : undefined,
    };
    updateProject((p) => ({
      ...p,
      tracks: p.tracks.map((t) => t.id === trackId ? { ...t, items: [...t.items, item] } : t),
    }), { pushHistory: true });
  }, [media, updateProject]);

  const handleAddText = useCallback((preset: Partial<typeof DEFAULT_TEXT_DETAILS>) => {
    updateProject((p) => {
      const textTrack = p.tracks.find((t) => t.type === 'text');
      if (!textTrack) return p;
      const lastEnd = textTrack.items.reduce((acc, i) => Math.max(acc, i.endTime), 0);
      const startTime = lastEnd > 0 ? lastEnd : currentTime;
      const endTime = startTime + 5;
      const item: TrackItem = {
        id: createId(), mediaId: '', trackId: textTrack.id,
        startTime, endTime, mediaStart: 0, mediaEnd: 5,
        name: preset.text || 'Texto', type: 'text',
        textDetails: { ...DEFAULT_TEXT_DETAILS, ...preset },
      };
      const tracks = p.tracks.map((t) => t.id === textTrack.id ? { ...t, items: [...t.items, item] } : t);
      return { ...p, tracks };
    }, { pushHistory: true });
    if (isMobile) setShowMobilePanel(false);
  }, [currentTime, updateProject, isMobile]);

  const handleAddShape = useCallback((shape: 'rect' | 'circle' | 'triangle') => {
    const shapeText = shape === 'rect' ? '▬' : shape === 'circle' ? '●' : '▲';
    handleAddText({ text: shapeText, fontSize: 5, color: '#f472b6', posX: 50, posY: 50 });
  }, [handleAddText]);

  // ── Timeline ops (move/trim do NOT push history — history pushed on mouseup by caller) ──
  const handleItemMove = useCallback((trackId: string, itemId: string, newStart: number) => {
    setProjectRaw((p) => {
      const tracks = p.tracks.map((t) => {
        if (t.id !== trackId) return t;
        return { ...t, items: t.items.map((i) => {
          if (i.id !== itemId) return i;
          const dur = i.endTime - i.startTime;
          const safeStart = Math.max(0, newStart);
          return { ...i, startTime: safeStart, endTime: safeStart + dur };
        })};
      });
      return { ...p, tracks, duration: calcDuration(tracks) };
    });
  }, []);

  const handleItemTrim = useCallback((trackId: string, itemId: string, newStart: number, newEnd: number, newMediaStart: number, newMediaEnd: number) => {
    setProjectRaw((p) => {
      const tracks = p.tracks.map((t) => {
        if (t.id !== trackId) return t;
        return { ...t, items: t.items.map((i) =>
          i.id !== itemId ? i : { ...i, startTime: newStart, endTime: newEnd, mediaStart: newMediaStart, mediaEnd: newMediaEnd }
        )};
      });
      return { ...p, tracks, duration: calcDuration(tracks) };
    });
  }, []);

  const handleItemSplit = useCallback((trackId: string, itemId: string, atTime: number) => {
    updateProject((p) => {
      const track = p.tracks.find((t) => t.id === trackId);
      if (!track) return p;
      const item = track.items.find((i) => i.id === itemId);
      if (!item) return p;
      // Enforce minimum segment size
      if (atTime <= item.startTime + MIN_CLIP_DURATION || atTime >= item.endTime - MIN_CLIP_DURATION) return p;
      const mediaAtSplit = item.mediaStart + (atTime - item.startTime);
      const left: TrackItem = { ...item, id: createId(), endTime: atTime, mediaEnd: mediaAtSplit };
      const right: TrackItem = { ...item, id: createId(), startTime: atTime, mediaStart: mediaAtSplit };
      const tracks = p.tracks.map((t) => {
        if (t.id !== trackId) return t;
        return { ...t, items: t.items.flatMap((i) => i.id === itemId ? [left, right] : [i]) };
      });
      return { ...p, tracks };
    }, { pushHistory: true });
    setSelectedItemId(null);
  }, [updateProject]);

  const handleItemDelete = useCallback((trackId: string, itemId: string) => {
    updateProject((p) => ({
      ...p,
      tracks: p.tracks.map((t) =>
        t.id === trackId ? { ...t, items: t.items.filter((i) => i.id !== itemId) } : t
      ),
    }), { pushHistory: true });
    setSelectedItemId(null);
  }, [updateProject]);

  const handleUpdateItem = useCallback((trackId: string, itemId: string, updates: Partial<TrackItem>) => {
    setProjectRaw((p) => ({
      ...p,
      tracks: p.tracks.map((t) =>
        t.id !== trackId ? t : { ...t, items: t.items.map((i) => i.id !== itemId ? i : { ...i, ...updates }) }
      ),
    }));
  }, []);

  const handleToggleMute = useCallback((trackId: string) => {
    setProjectRaw((p) => ({ ...p, tracks: p.tracks.map((t) => t.id === trackId ? { ...t, muted: !t.muted } : t) }));
  }, []);

  const handleToggleLock = useCallback((trackId: string) => {
    setProjectRaw((p) => ({ ...p, tracks: p.tracks.map((t) => t.id === trackId ? { ...t, locked: !t.locked } : t) }));
  }, []);

  const handleApplyAutoCuts = useCallback((regions: SilenceRegion[]) => {
    updateProject((p) => {
      const newTracks = applySilenceCuts(p.tracks, regions);
      return { ...p, tracks: newTracks };
    }, { pushHistory: true });
    setShowAutoCut(false);
    if (isMobile) setShowMobilePanel(false);
  }, [updateProject, isMobile]);

  const handleSplitAllAtPlayhead = useCallback(() => {
    const t = currentTime;
    updateProject((p) => {
      let changed = false;
      const tracks = p.tracks.map((track) => {
        if (track.locked) return track;
        const newItems: typeof track.items = [];
        for (const item of track.items) {
          if (t > item.startTime + MIN_CLIP_DURATION && t < item.endTime - MIN_CLIP_DURATION) {
            const mediaAtSplit = item.mediaStart + (t - item.startTime);
            newItems.push({ ...item, id: createId(), endTime: t, mediaEnd: mediaAtSplit });
            newItems.push({ ...item, id: createId(), startTime: t, mediaStart: mediaAtSplit });
            changed = true;
          } else {
            newItems.push(item);
          }
        }
        return { ...track, items: newItems };
      });
      if (!changed) return p;
      return { ...p, tracks };
    }, { pushHistory: true });
    setSelectedItemId(null);
  }, [currentTime, updateProject]);
  splitAllRef.current = handleSplitAllAtPlayhead;

  // ── Export ────────────────────────────────────────────────
  const handleExport = useCallback(async (opts: ExportOptions) => {
    setExportState({ status: 'preparing', progress: 2, label: 'Preparando…' });
    if (isMobile) setShowMobilePanel(false);

    // ── Sanitize & validate before export ──────────────────
    let safeProject: Project;
    try {
      safeProject = sanitizeProject(project);
      validateProjectForExport(safeProject);
    } catch (err: any) {
      setExportState({ status: 'error', progress: 0, label: '', error: err.message });
      return;
    }

    const videoItems = safeProject.tracks
      .filter((t) => t.type === 'video' && !t.muted)
      .flatMap((t) => t.items)
      .sort((a, b) => a.startTime - b.startTime);

    const firstMf = media.find((m) => m.id === videoItems[0].mediaId);
    const srcW = firstMf?.width ?? 1920;
    const srcH = firstMf?.height ?? 1080;
    const targetLongSide = opts.resolution === '1080p' ? 1920 : 1280;
    const exportScale = Math.min(targetLongSide / Math.max(srcW, srcH), 1);
    const outW = Math.max(2, Math.round(srcW * exportScale / 2) * 2);
    const outH = Math.max(2, Math.round(srcH * exportScale / 2) * 2);
    const FPS = opts.fps ?? 30;

    try {
      setExportState({ status: 'encoding', progress: 5, label: 'Iniciando renderização…' });

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d', { alpha: false })!;

      const segmentBlobs: Blob[] = [];
      const webmMimePrefs = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
      ];
      const segMimeType = webmMimePrefs.find((c) => MediaRecorder.isTypeSupported(c)) ?? 'video/webm';

      // ── Helper: black segment for gaps ──────────────────
      const recordBlackSegment = async (gapDuration: number) => {
        const audioCtx = new AudioContext();
        const audioDestination = audioCtx.createMediaStreamDestination();
        const videoStream = canvas.captureStream(FPS);
        const combinedStream = new MediaStream([
          ...videoStream.getVideoTracks(),
          ...audioDestination.stream.getAudioTracks(),
        ]);
        const bitrate = opts.resolution === '1080p' ? 8_000_000 : 4_000_000;
        const chunks: BlobPart[] = [];
        const rec = new MediaRecorder(combinedStream, { mimeType: segMimeType, videoBitsPerSecond: bitrate });
        rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
        const stopped = new Promise<void>((res) => { rec.onstop = () => res(); });
        rec.start(100);

        await new Promise<void>((res) => {
          let rafId: number;
          let startTs: number | null = null;
          const loop = (ts: number) => {
            if (startTs === null) startTs = ts;
            const elapsed = (ts - startTs) / 1000;
            if (elapsed >= gapDuration) { cancelAnimationFrame(rafId); res(); return; }
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, outW, outH);
            rafId = requestAnimationFrame(loop);
          };
          rafId = requestAnimationFrame(loop);
          setTimeout(() => { cancelAnimationFrame(rafId); res(); }, (gapDuration + 5) * 1000);
        });

        rec.stop();
        await stopped;
        audioCtx.close();
        segmentBlobs.push(new Blob(chunks, { type: segMimeType }));
      };

      // ── Render each video segment ────────────────────────
      let timelineCursor = 0;
      const totalSegments = videoItems.length;

      for (let segIdx = 0; segIdx < totalSegments; segIdx++) {
        const item = videoItems[segIdx];
        const mf = media.find((m) => m.id === item.mediaId);
        if (!mf) { timelineCursor = item.endTime; continue; }

        // Gap before this clip → black frames
        if (item.startTime > timelineCursor + 0.05) {
          const gapDuration = item.startTime - timelineCursor;
          setExportState({
            status: 'encoding',
            progress: 5 + Math.round((segIdx / totalSegments) * 60),
            label: `Renderizando intervalo vazio (${gapDuration.toFixed(1)}s)…`,
          });
          await recordBlackSegment(gapDuration);
        }

        const vd = item.videoDetails;
        const playRate = Math.min(Math.max(vd?.playbackRate ?? 1, 0.1), 16);
        const wallClockDuration = (item.endTime - item.startTime) / playRate;

        setExportState({
          status: 'encoding',
          progress: 5 + Math.round((segIdx / totalSegments) * 60),
          label: `Renderizando segmento ${segIdx + 1} de ${totalSegments}…`,
        });

        const audioCtx = new AudioContext();
        const audioDestination = audioCtx.createMediaStreamDestination();
        const masterGain = audioCtx.createGain();
        masterGain.gain.value = 1;
        masterGain.connect(audioDestination);

        const videoStream = canvas.captureStream(FPS);
        const combinedStream = new MediaStream([
          ...videoStream.getVideoTracks(),
          ...audioDestination.stream.getAudioTracks(),
        ]);
        const bitrate = opts.resolution === '1080p' ? 8_000_000 : 4_000_000;
        const segChunks: BlobPart[] = [];
        const segRecorder = new MediaRecorder(combinedStream, { mimeType: segMimeType, videoBitsPerSecond: bitrate });
        segRecorder.ondataavailable = (e) => { if (e.data.size > 0) segChunks.push(e.data); };
        const segStopped = new Promise<void>((res) => { segRecorder.onstop = () => res(); });
        segRecorder.start(100);

        const vid = document.createElement('video');
        vid.src = mf.url;
        vid.muted = false;
        vid.playsInline = true;
        vid.crossOrigin = 'anonymous';
        vid.volume = Math.min(1, vd?.volume ?? 1);

        let sourceNode: MediaElementAudioSourceNode | null = null;
        let segGain: GainNode | null = null;
        try {
          sourceNode = audioCtx.createMediaElementSource(vid);
          segGain = audioCtx.createGain();
          segGain.gain.value = Math.min(1, vd?.volume ?? 1);
          sourceNode.connect(segGain);
          segGain.connect(masterGain);
        } catch { /* CORS – continue without audio */ }

        // ── Load + seek with single promise ────────────────
        await new Promise<void>((res, rej) => {
          let resolved = false;
          const done = () => { if (!resolved) { resolved = true; res(); } };
          const failTimer = setTimeout(() => done(), 10000);

          const onMeta = () => {
            vid.removeEventListener('loadedmetadata', onMeta);
            // Clamp mediaStart within actual file duration
            const safeStart = Math.min(item.mediaStart, (vid.duration || 9999) - 0.01);
            vid.currentTime = Math.max(0, safeStart);
            const onSeeked = () => {
              vid.removeEventListener('seeked', onSeeked);
              clearTimeout(failTimer);
              done();
            };
            vid.addEventListener('seeked', onSeeked);
            // Mobile fallback if seeked never fires
            setTimeout(done, 5000);
          };
          vid.addEventListener('loadedmetadata', onMeta);
          vid.addEventListener('error', () => {
            clearTimeout(failTimer);
            rej(new Error(`Falha ao carregar: ${mf.name}`));
          });
          vid.load();
        });

        vid.playbackRate = playRate;

        await new Promise<void>((res) => {
          let rafId: number;
          let startTs: number | null = null;
          // Precise mediaEnd clamped to actual file duration
          const safeMediaEnd = Math.min(item.mediaEnd, vid.duration || item.mediaEnd);

          const renderFrame = (ts: number) => {
            if (startTs === null) startTs = ts;
            const elapsed = (ts - startTs) / 1000;

            const overtime = elapsed >= wallClockDuration + 0.15;
            const mediaOver = vid.currentTime >= safeMediaEnd - 0.02;
            const ended = vid.ended;

            if (overtime || mediaOver || ended) {
              cancelAnimationFrame(rafId);
              vid.pause();
              sourceNode?.disconnect();
              segGain?.disconnect();
              vid.src = '';
              res();
              return;
            }

            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, outW, outH);
            ctx.save();
            const filters: string[] = [];
            if (vd?.brightness && vd.brightness !== 1) filters.push(`brightness(${vd.brightness})`);
            if (vd?.contrast && vd.contrast !== 1) filters.push(`contrast(${vd.contrast})`);
            if (vd?.saturation && vd.saturation !== 1) filters.push(`saturate(${vd.saturation})`);
            if (filters.length) (ctx as any).filter = filters.join(' ');
            ctx.globalAlpha = vd?.opacity ?? 1;
            if (vd?.flipH || vd?.flipV) {
              ctx.translate(vd.flipH ? outW : 0, vd.flipV ? outH : 0);
              ctx.scale(vd.flipH ? -1 : 1, vd.flipV ? -1 : 1);
            }
            ctx.drawImage(vid, 0, 0, outW, outH);
            ctx.restore();
            (ctx as any).filter = 'none';
            ctx.globalAlpha = 1;

            // Draw text overlays
            const currentProjectTime = item.startTime + elapsed * playRate;
            const textTracks = safeProject.tracks.filter((t) => t.type === 'text' && !t.muted);
            for (const tt of textTracks) {
              for (const ti of tt.items) {
                if (currentProjectTime < ti.startTime || currentProjectTime > ti.endTime) continue;
                const td = ti.textDetails;
                if (!td) continue;
                const x = (td.posX / 100) * outW;
                const y = (td.posY / 100) * outH;
                const maxW = (td.width / 100) * outW;
                const fontSize = Math.round((td.fontSize / 100) * outH);
                ctx.save();
                ctx.globalAlpha = td.opacity ?? 1;
                (ctx as any).filter = 'none';
                if (td.backgroundColor && td.backgroundColor !== 'transparent') {
                  ctx.fillStyle = td.backgroundColor;
                  ctx.fillRect(x - maxW / 2, y - fontSize * 1.2, maxW, fontSize * 1.5);
                }
                if (td.boxShadow?.blur > 0) {
                  ctx.shadowColor = td.boxShadow.color;
                  ctx.shadowOffsetX = td.boxShadow.x;
                  ctx.shadowOffsetY = td.boxShadow.y;
                  ctx.shadowBlur = td.boxShadow.blur;
                }
                ctx.font = `bold ${fontSize}px ${td.fontFamily || 'Inter, sans-serif'}`;
                ctx.fillStyle = td.color || '#ffffff';
                ctx.textAlign = (td.textAlign as CanvasTextAlign) || 'center';
                ctx.textBaseline = 'middle';
                const words = (td.text || '').split(' ');
                let line = '';
                const lineHeight = fontSize * 1.35;
                const lines: string[] = [];
                for (const word of words) {
                  const test = line ? `${line} ${word}` : word;
                  if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
                  else { line = test; }
                }
                if (line) lines.push(line);
                const totalH = lines.length * lineHeight;
                lines.forEach((l, li) => { ctx.fillText(l, x, y - totalH / 2 + li * lineHeight + lineHeight / 2, maxW); });
                ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
                ctx.restore();
              }
            }

            rafId = requestAnimationFrame(renderFrame);
          };

          vid.play()
            .then(() => { rafId = requestAnimationFrame(renderFrame); })
            .catch(() => res());

          // Hard timeout: wallClockDuration + 20s safety margin
          setTimeout(() => {
            cancelAnimationFrame(rafId);
            vid.pause();
            sourceNode?.disconnect();
            segGain?.disconnect();
            vid.src = '';
            res();
          }, (wallClockDuration + 20) * 1000);
        });

        segRecorder.stop();
        await segStopped;
        audioCtx.close();
        segmentBlobs.push(new Blob(segChunks, { type: segMimeType }));
        timelineCursor = item.endTime;
      }

      // ── FFmpeg concat → MP4 ──────────────────────────────
      setExportState({ status: 'encoding', progress: 68, label: 'Carregando FFmpeg…' });

      const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([
        import('@ffmpeg/ffmpeg'),
        import('@ffmpeg/util'),
      ]);
      const ffmpeg = new FFmpeg();

      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm';
      try {
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
      } catch {
        const fallbackURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${fallbackURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${fallbackURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
      }

      setExportState({ status: 'encoding', progress: 72, label: 'Processando com FFmpeg…' });

      const concatLines: string[] = [];
      for (let i = 0; i < segmentBlobs.length; i++) {
        const fname = `seg${i}.webm`;
        const data = await fetchFile(segmentBlobs[i]);
        await ffmpeg.writeFile(fname, data);
        concatLines.push(`file '${fname}'`);
      }
      const encoder = new TextEncoder();
      await ffmpeg.writeFile('concat.txt', encoder.encode(concatLines.join('\n')));

      setExportState({ status: 'encoding', progress: 78, label: 'Convertendo para MP4…' });

      ffmpeg.on('progress', ({ progress }) => {
        const safeP = Math.max(0, Math.min(1, isFinite(progress) ? progress : 0));
        setExportState((s) => ({ ...s, progress: Math.min(78 + Math.round(safeP * 18), 96), label: 'Convertendo para MP4…' }));
      });

      await ffmpeg.exec([
        '-f', 'concat', '-safe', '0', '-i', 'concat.txt',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        '-movflags', '+faststart',
        '-vf', `scale=${outW}:${outH}`,
        '-r', String(FPS),
        'output.mp4',
      ]);

      setExportState({ status: 'encoding', progress: 97, label: 'Preparando download…' });

      const outputData = await ffmpeg.readFile('output.mp4');
      let mp4Blob: Blob;
      if (typeof outputData === 'string') {
        mp4Blob = new Blob([outputData], { type: 'video/mp4' });
      } else {
        const buf = new ArrayBuffer(outputData.byteLength);
        new Uint8Array(buf).set(outputData);
        mp4Blob = new Blob([buf], { type: 'video/mp4' });
      }

      // Clean up FFmpeg virtual FS
      try {
        for (let i = 0; i < segmentBlobs.length; i++) await ffmpeg.deleteFile(`seg${i}.webm`).catch(() => {});
        await ffmpeg.deleteFile('concat.txt').catch(() => {});
        await ffmpeg.deleteFile('output.mp4').catch(() => {});
      } catch { /* ignore */ }

      const dlUrl = URL.createObjectURL(mp4Blob);
      const a = document.createElement('a');
      a.href = dlUrl;
      a.download = `${safeProject.name}_${opts.resolution}_${opts.fps}fps.mp4`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(dlUrl), 30_000);

      setExportState({ status: 'done', progress: 100, label: 'Download iniciado!' });

    } catch (err: any) {
      console.error('[ViralCut] Export error:', err);
      let errMsg = err?.message ?? 'Tente novamente';
      if (errMsg.includes('fetch') || errMsg.includes('network') || errMsg.includes('load')) {
        errMsg = 'Falha ao carregar FFmpeg (verifique a conexão com a internet)';
      }
      setExportState({ status: 'error', progress: 0, label: '', error: `Erro ao exportar: ${errMsg}` });
    }
  }, [project, media, isMobile]);

  // ── Derived selection ─────────────────────────────────────
  const selectedItem = useMemo(
    () => selectedItemId ? project.tracks.flatMap((t) => t.items).find((i) => i.id === selectedItemId) ?? null : null,
    [selectedItemId, project.tracks]
  );
  const selectedTrackId = useMemo(
    () => selectedItemId ? project.tracks.find((t) => t.items.some((i) => i.id === selectedItemId))?.id ?? null : null,
    [selectedItemId, project.tracks]
  );

  const handleItemSelect = useCallback((id: string | null) => setSelectedItemId(id), []);

  const handleItemDoubleClick = useCallback((id: string) => {
    setSelectedItemId(id);
    if (isMobile) { setMobileTab('editar'); setShowMobilePanel(true); }
    else { setShowProperties(true); }
  }, [isMobile]);

  // ── Mobile: no media yet ──────────────────────────────────
  if (isMobile && !hasMedia) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-card/60">
          <span className="text-base font-bold text-foreground">ViralCut</span>
          <button className="text-xs text-primary font-medium"
            onClick={() => { setExportState({ status: 'idle', progress: 0, label: '' }); setExportOpen(true); }}>
            Exportar
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-2">
            <Scissors className="h-9 w-9 text-primary" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground mb-1">Editor de Vídeo</h2>
            <p className="text-sm text-muted-foreground">Edite vídeos profissionais diretamente no seu celular</p>
          </div>
          <button
            className="w-full flex items-center gap-3 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 transition-all px-5 py-4"
            onClick={() => importRef.current?.click()}
          >
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">+ Adicione seu vídeo ou imagem</p>
              <p className="text-xs text-muted-foreground mt-0.5">Edição manual completa</p>
            </div>
          </button>
          <button
            className="w-full flex items-center gap-3 rounded-2xl border-2 border-dashed border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/60 transition-all px-5 py-4"
            onClick={() => autoCutImportRef.current?.click()}
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <Wand2 className="h-5 w-5 text-amber-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">+ Cortes Automáticos</p>
              <p className="text-xs text-muted-foreground mt-0.5">Remove silêncios e pausas do vídeo</p>
            </div>
          </button>
        </div>
        <input ref={importRef} type="file" accept="video/*,audio/*,image/*" multiple className="hidden"
          onChange={(e) => e.target.files && handleImport(e.target.files)} />
        <input ref={autoCutImportRef} type="file" accept="video/*" className="hidden"
          onChange={(e) => e.target.files && handleAutoCutImport(e.target.files)} />
        <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} onExport={handleExport} exportState={exportState} project={project} />
      </div>
    );
  }

  // ── Mobile editor ─────────────────────────────────────────
  if (isMobile) {
    const mobileTabs: { id: MobileTab; icon: React.ReactNode; label: string }[] = [
      { id: 'editar', icon: <Scissors className="h-5 w-5" />, label: 'Editar' },
      { id: 'audio', icon: <Music className="h-5 w-5" />, label: 'Áudio' },
      { id: 'texto', icon: <Type className="h-5 w-5" />, label: 'Texto' },
      { id: 'efeitos', icon: <Zap className="h-5 w-5" />, label: 'Efeitos' },
      { id: 'camada', icon: <Layers className="h-5 w-5" />, label: 'Camada' },
    ];
    return (
      <div className="h-full flex flex-col bg-background overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0 bg-card/80 z-10">
          <div className="flex items-center gap-2">
            <button className="p-1 text-muted-foreground" onClick={handleUndo} disabled={!canUndo}>
              <svg className={cn("h-4 w-4", !canUndo && "opacity-30")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>
            </button>
            <button className="p-1 text-muted-foreground" onClick={handleRedo} disabled={!canRedo}>
              <svg className={cn("h-4 w-4", !canRedo && "opacity-30")} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>
            </button>
          </div>
          <span className="text-sm font-semibold text-foreground">ViralCut</span>
          <button
            className="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold"
            onClick={() => { setExportState({ status: 'idle', progress: 0, label: '' }); setExportOpen(true); }}>
            Exportar
          </button>
        </div>
        <div className="shrink-0" style={{ height: '42vh' }}>
          <PreviewPanel
            tracks={stableTracks}
            media={media}
            currentTime={currentTime}
            duration={project.duration}
            isPlaying={isPlaying}
            onTimeChange={setCurrentTime}
            onPlayPause={() => setIsPlaying((p) => !p)}
            projectName={project.name}
            selectedItemId={selectedItemId}
            onSelectItem={handleItemSelect}
            onUpdateItem={handleUpdateItem}
            onOpenProperties={handleItemDoubleClick}
          />
        </div>
        <div className="flex-1 min-h-0 border-t border-border flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-2 py-1 bg-card/60 border-b border-border shrink-0">
            <span className="text-[10px] font-semibold text-foreground">Timeline</span>
            <div className="flex items-center gap-0.5 bg-muted/60 rounded-lg px-1 py-0.5">
              <button className="p-0.5 hover:text-foreground text-muted-foreground transition-colors" onClick={() => setZoom((z) => Math.max(20, z - 20))} title="Zoom out">
                <ZoomOut className="h-3 w-3" />
              </button>
              <span className="text-[10px] font-mono text-muted-foreground w-9 text-center tabular-nums">{zoom}px/s</span>
              <button className="p-0.5 hover:text-foreground text-muted-foreground transition-colors" onClick={() => setZoom((z) => Math.min(300, z + 20))} title="Zoom in">
                <ZoomIn className="h-3 w-3" />
              </button>
            </div>
            <div className="flex-1" />
            <button className="p-1 rounded bg-muted/60 text-muted-foreground hover:text-foreground"
              onClick={() => importRef.current?.click()} title="Adicionar mídia">
              <Plus className="h-3.5 w-3.5" />
            </button>
            <input ref={importRef} type="file" accept="video/*,audio/*,image/*" multiple className="hidden"
              onChange={(e) => e.target.files && handleImport(e.target.files)} />
          </div>
          <div className="flex-1 min-h-0">
            <Timeline
              tracks={stableTracks}
              media={media}
              currentTime={currentTime}
              duration={project.duration}
              zoom={zoom}
              selectedItemId={selectedItemId}
              onSeek={(t) => { setCurrentTime(t); setIsPlaying(false); }}
              onItemMove={handleItemMove}
              onItemTrim={handleItemTrim}
              onItemDelete={handleItemDelete}
              onItemSelect={handleItemSelect}
              onItemDoubleClick={handleItemDoubleClick}
              onItemSplit={handleItemSplit}
              onTrackToggleMute={handleToggleMute}
              onTrackToggleLock={handleToggleLock}
              onDropMedia={handleDropMedia}
              onSplitAllAtPlayhead={handleSplitAllAtPlayhead}
              onDeleteSelected={() => {
                if (selectedItemId) {
                  const track = project.tracks.find((t) => t.items.some((i) => i.id === selectedItemId));
                  if (track) handleItemDelete(track.id, selectedItemId);
                }
              }}
            />
          </div>
        </div>

        {showMobilePanel && (
          <div className="fixed inset-0 z-40" onClick={() => { setShowMobilePanel(false); setShowAutoCut(false); }}>
            <div className="absolute bottom-16 left-0 right-0 bg-card border-t border-border rounded-t-2xl shadow-2xl overflow-hidden"
              style={{ maxHeight: '50vh' }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <span className="text-xs font-semibold text-foreground capitalize">
                  {showAutoCut ? 'Corte Automático' : mobileTab}
                </span>
                <button onClick={() => { setShowMobilePanel(false); setShowAutoCut(false); }}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 'calc(50vh - 48px)' }}>
                {showAutoCut ? (
                  <AutoCut tracks={project.tracks} media={media} onApplyCuts={handleApplyAutoCuts}
                    onClose={() => { setShowAutoCut(false); setShowMobilePanel(false); }} />
                ) : mobileTab === 'texto' ? (
                  <MediaPanel media={media} selectedMediaId={selectedMediaId} onImport={handleImport}
                    onSelect={setSelectedMediaId} onDelete={handleDeleteMedia} onAddToTimeline={handleAddToTimeline}
                    onAddText={handleAddText} onAddShape={handleAddShape} onAddTransition={() => {}} defaultTab="text" />
                ) : mobileTab === 'camada' ? (
                  <MediaPanel media={media} selectedMediaId={selectedMediaId} onImport={handleImport}
                    onSelect={setSelectedMediaId} onDelete={handleDeleteMedia} onAddToTimeline={handleAddToTimeline}
                    onAddText={handleAddText} onAddShape={handleAddShape} onAddTransition={() => {}} defaultTab="uploads" />
                ) : mobileTab === 'editar' && selectedItem ? (
                  <PropertiesPanel selectedItem={selectedItem} selectedTrackId={selectedTrackId} media={media}
                    onDelete={handleItemDelete} onSplit={handleItemSplit} onUpdateItem={handleUpdateItem} currentTime={currentTime} />
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {mobileTab === 'editar' ? 'Selecione um clipe na timeline para editar' :
                     mobileTab === 'audio' ? 'Selecione um clipe de áudio na timeline' :
                     mobileTab === 'efeitos' ? 'Efeitos em breve' : 'Selecione uma opção'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="shrink-0 border-t border-border bg-card/95 safe-area-inset-bottom">
          <div className="flex">
            {mobileTabs.map((tab) => (
              <button key={tab.id}
                className={cn('flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors',
                  mobileTab === tab.id && showMobilePanel && !showAutoCut ? 'text-primary' : 'text-muted-foreground')}
                onClick={() => { setMobileTab(tab.id); setShowAutoCut(false); setShowMobilePanel(true); }}>
                {tab.icon}
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            ))}
            <button
              className={cn('flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors',
                showAutoCut && showMobilePanel ? 'text-amber-500' : 'text-muted-foreground')}
              onClick={() => { setShowAutoCut(true); setShowMobilePanel(true); }}>
              <Wand2 className="h-5 w-5" />
              <span className="text-[10px] font-medium">Auto</span>
            </button>
          </div>
        </div>

        <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} onExport={handleExport} exportState={exportState} project={project} />
      </div>
    );
  }

  // ── Desktop editor ────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      <Toolbar
        projectName={project.name}
        onProjectNameChange={(name) => setProjectRaw((p) => ({ ...p, name }))}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onExport={() => { setExportState({ status: 'idle', progress: 0, label: '' }); setExportOpen(true); }}
        onSave={persistence.saveNow}
        onExportJson={persistence.exportJson}
        onImportJson={() => importJsonRef.current?.click()}
      />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {showMedia && (
          <div className="w-[210px] xl:w-[230px] shrink-0 border-r border-border bg-card/50 flex flex-col overflow-hidden">
            {showAutoCut ? (
              <AutoCut tracks={project.tracks} media={media} onApplyCuts={handleApplyAutoCuts}
                onClose={() => setShowAutoCut(false)} />
            ) : (
              <MediaPanel media={media} selectedMediaId={selectedMediaId} onImport={handleImport}
                onSelect={setSelectedMediaId} onDelete={handleDeleteMedia} onAddToTimeline={handleAddToTimeline}
                onAddText={handleAddText} onAddShape={handleAddShape} onAddTransition={() => {}} />
            )}
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden border-r border-border">
          <PreviewPanel
            tracks={stableTracks}
            media={media}
            currentTime={currentTime}
            duration={project.duration}
            isPlaying={isPlaying}
            onTimeChange={setCurrentTime}
            onPlayPause={() => setIsPlaying((p) => !p)}
            projectName={project.name}
            selectedItemId={selectedItemId}
            onSelectItem={handleItemSelect}
            onUpdateItem={handleUpdateItem}
            onOpenProperties={handleItemDoubleClick}
          />
        </div>

        {showProperties && (
          <div className="w-[210px] xl:w-[230px] shrink-0 border-l border-border bg-card/50 overflow-hidden">
            <PropertiesPanel selectedItem={selectedItem} selectedTrackId={selectedTrackId} media={media}
              onDelete={handleItemDelete} onSplit={handleItemSplit} onUpdateItem={handleUpdateItem} currentTime={currentTime} />
          </div>
        )}
      </div>

      <div className="flex-none border-t border-border flex flex-col" style={{ height: 'clamp(160px, 28vh, 260px)' }}>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-card/60 border-b border-border shrink-0">
          <span className="text-[11px] font-semibold text-foreground uppercase tracking-wide">Timeline</span>
          <div className="flex items-center gap-0.5 bg-muted/60 rounded-lg px-1 py-0.5">
            <button className="p-0.5 hover:text-foreground text-muted-foreground transition-colors" onClick={() => setZoom((z) => Math.max(20, z - 20))} title="Zoom out">
              <ZoomOut className="h-3 w-3" />
            </button>
            <span className="text-[10px] font-mono text-muted-foreground w-9 text-center tabular-nums">{zoom}px/s</span>
            <button className="p-0.5 hover:text-foreground text-muted-foreground transition-colors" onClick={() => setZoom((z) => Math.min(300, z + 20))} title="Zoom in">
              <ZoomIn className="h-3 w-3" />
            </button>
          </div>
          <span className="text-[10px] text-muted-foreground hidden lg:block flex-1">
            Espaço = play/pause · Del = deletar · Arrastar borda = cortar
          </span>
          <div className="flex-1 hidden sm:block lg:hidden" />
          <button
            className={cn('flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors',
              showAutoCut ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40' : 'text-muted-foreground hover:text-foreground border border-transparent')}
            onClick={() => setShowAutoCut((v) => !v)} title="Corte Automático">
            <Wand2 className="h-3 w-3" />
            Auto Corte
          </button>
          <button
            className={cn('p-1 rounded transition-colors text-muted-foreground hover:text-foreground', showMedia && 'text-primary')}
            onClick={() => setShowMedia((v) => !v)} title="Painel de mídia">
            <PanelLeft className="h-3.5 w-3.5" />
          </button>
          <button
            className={cn('p-1 rounded transition-colors text-muted-foreground hover:text-foreground', showProperties && 'text-primary')}
            onClick={() => setShowProperties((v) => !v)} title="Propriedades">
            <PanelRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <Timeline
            tracks={stableTracks}
            media={media}
            currentTime={currentTime}
            duration={project.duration}
            zoom={zoom}
            selectedItemId={selectedItemId}
            onSeek={(t) => { setCurrentTime(t); setIsPlaying(false); }}
            onItemMove={handleItemMove}
            onItemTrim={handleItemTrim}
            onItemDelete={handleItemDelete}
            onItemSelect={handleItemSelect}
            onItemDoubleClick={handleItemDoubleClick}
            onItemSplit={handleItemSplit}
            onTrackToggleMute={handleToggleMute}
            onTrackToggleLock={handleToggleLock}
            onDropMedia={handleDropMedia}
            onSplitAllAtPlayhead={handleSplitAllAtPlayhead}
            onDeleteSelected={() => {
              if (selectedItemId) {
                const track = project.tracks.find((t) => t.items.some((i) => i.id === selectedItemId));
                if (track) handleItemDelete(track.id, selectedItemId);
              }
            }}
          />
        </div>
      </div>

      {/* Hidden file inputs */}
      <input ref={importJsonRef} type="file" accept=".json" className="hidden"
        onChange={(e) => { if (e.target.files?.[0]) { persistence.importJson(e.target.files[0]); e.target.value = ''; } }} />

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} onExport={handleExport} exportState={exportState} project={project} />
    </div>
  );
};

export default ViralCut;
