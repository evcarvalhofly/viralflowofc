// ============================================================
// ViralCut – Main Editor Page
// Desktop: sidebar left + preview + props right + timeline bottom
// Mobile: CapCut-style (preview top → timeline → bottom tab bar)
// ============================================================
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  MediaFile, Track, TrackItem, Project, ExportState,
  DEFAULT_TEXT_DETAILS, DEFAULT_VIDEO_DETAILS, DEFAULT_AUDIO_DETAILS, DEFAULT_IMAGE_DETAILS
} from '@/viralcut/types';
import { createId, createDefaultProject, calcProjectDuration } from '@/viralcut/store';
import { MediaPanel } from '@/viralcut/components/MediaPanel';
import { PreviewPanel } from '@/viralcut/components/PreviewPanel';
import { Timeline } from '@/viralcut/components/Timeline';
import { Toolbar } from '@/viralcut/components/Toolbar';
import { PropertiesPanel } from '@/viralcut/components/PropertiesPanel';
import { ExportModal, ExportOptions } from '@/viralcut/components/ExportModal';
import { AutoCut, SilenceRegion, applySilenceCuts } from '@/viralcut/components/AutoCut';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  PanelLeft, PanelRight, Scissors, Music, Type, Layers, Image, Zap,
  Upload, Plus, Wand2, X, ChevronUp
} from 'lucide-react';
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
      canvas.width = 160; canvas.height = 90;
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
        resolve({ duration: el.duration || 0, width: (el as HTMLVideoElement).videoWidth, height: (el as HTMLVideoElement).videoHeight });
      };
      el.onerror = () => resolve({ duration: 0 });
    } else {
      resolve({ duration: 0 });
    }
  });
}

const MAX_HISTORY = 30;

// Mobile bottom tab type
type MobileTab = 'editar' | 'audio' | 'texto' | 'efeitos' | 'camada';

const ViralCut = () => {
  const isMobile = useIsMobile();
  const importRef = useRef<HTMLInputElement>(null);
  const autoCutImportRef = useRef<HTMLInputElement>(null);

  const [project, setProject] = useState<Project>(createDefaultProject());
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(80);

  const [exportOpen, setExportOpen] = useState(false);
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle', progress: 0, label: '' });

  const [showMedia, setShowMedia] = useState(true);
  const [showProperties, setShowProperties] = useState(true);

  // Mobile state
  const [mobileTab, setMobileTab] = useState<MobileTab>('editar');
  const [showMobilePanel, setShowMobilePanel] = useState(false);
  const [showAutoCut, setShowAutoCut] = useState(false);
  const [pendingAutoCutFile, setPendingAutoCutFile] = useState<FileList | null>(null);

  // Has any media been imported?
  const hasMedia = media.length > 0;

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

  // Keyboard shortcuts (desktop only)
  useEffect(() => {
    if (isMobile) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); setIsPlaying((p) => !p); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); e.shiftKey ? handleRedo() : handleUndo(); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedItemId) {
          const track = project.tracks.find((t) => t.items.some((i) => i.id === selectedItemId));
          if (track) handleItemDelete(track.id, selectedItemId);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleUndo, handleRedo, selectedItemId, project.tracks, isMobile]);

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
            if (project.duration > 0 && next >= project.duration) { setIsPlaying(false); return project.duration; }
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
      // Auto-add first file to timeline on mobile
      setProject((p) => {
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
        return { ...p, tracks: newTracks, duration: calcProjectDuration(newTracks) };
      });
    }
  }, []);

  // ── Import for auto-cut: import then analyze ──────────────
  const handleAutoCutImport = useCallback(async (files: FileList) => {
    await handleImport(files);
    setPendingAutoCutFile(files);
    setShowAutoCut(true);
    if (isMobile) {
      setShowMobilePanel(true);
      setMobileTab('editar');
    }
  }, [handleImport, isMobile]);

  const handleDeleteMedia = useCallback((id: string) => {
    setMedia((prev) => {
      const mf = prev.find((m) => m.id === id);
      if (mf) URL.revokeObjectURL(mf.url);
      return prev.filter((m) => m.id !== id);
    });
    setProject((p) => {
      const tracks = p.tracks.map((t) => ({ ...t, items: t.items.filter((i) => i.mediaId !== id) }));
      return { ...p, tracks, duration: calcProjectDuration(tracks) };
    });
  }, []);

  // ── Add media to timeline ─────────────────────────────────
  const handleAddToTimeline = useCallback((mediaId: string) => {
    const mf = media.find((m) => m.id === mediaId);
    if (!mf) return;
    setProject((p) => {
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
      pushHistory(newTracks);
      return { ...p, tracks: newTracks, duration: calcProjectDuration(newTracks) };
    });
  }, [media, pushHistory]);

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
    setProject((p) => {
      const tracks = p.tracks.map((t) => t.id === trackId ? { ...t, items: [...t.items, item] } : t);
      pushHistory(tracks);
      return { ...p, tracks, duration: calcProjectDuration(tracks) };
    });
  }, [media, pushHistory]);

  const handleAddText = useCallback((preset: Partial<typeof DEFAULT_TEXT_DETAILS>) => {
    setProject((p) => {
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
      pushHistory(tracks);
      return { ...p, tracks, duration: calcProjectDuration(tracks) };
    });
    if (isMobile) setShowMobilePanel(false);
  }, [currentTime, pushHistory, isMobile]);

  const handleAddShape = useCallback((shape: 'rect' | 'circle' | 'triangle') => {
    const shapeText = shape === 'rect' ? '▬' : shape === 'circle' ? '●' : '▲';
    handleAddText({ text: shapeText, fontSize: 80, color: '#f472b6', posX: 50, posY: 50 });
  }, [handleAddText]);

  const handleItemMove = useCallback((trackId: string, itemId: string, newStart: number) => {
    setProject((p) => {
      const tracks = p.tracks.map((t) => {
        if (t.id !== trackId) return t;
        return { ...t, items: t.items.map((i) => {
          if (i.id !== itemId) return i;
          const dur = i.endTime - i.startTime;
          return { ...i, startTime: newStart, endTime: newStart + dur };
        })};
      });
      return { ...p, tracks, duration: calcProjectDuration(tracks) };
    });
  }, []);

  const handleItemTrim = useCallback((trackId: string, itemId: string, newStart: number, newEnd: number, newMediaStart: number, newMediaEnd: number) => {
    setProject((p) => {
      const tracks = p.tracks.map((t) => {
        if (t.id !== trackId) return t;
        return { ...t, items: t.items.map((i) =>
          i.id !== itemId ? i : { ...i, startTime: newStart, endTime: newEnd, mediaStart: newMediaStart, mediaEnd: newMediaEnd }
        )};
      });
      return { ...p, tracks, duration: calcProjectDuration(tracks) };
    });
  }, []);

  const handleItemSplit = useCallback((trackId: string, itemId: string, atTime: number) => {
    setProject((p) => {
      const track = p.tracks.find((t) => t.id === trackId);
      if (!track) return p;
      const item = track.items.find((i) => i.id === itemId);
      if (!item || atTime <= item.startTime || atTime >= item.endTime) return p;
      const mediaAtSplit = item.mediaStart + (atTime - item.startTime);
      const left: TrackItem = { ...item, id: createId(), endTime: atTime, mediaEnd: mediaAtSplit };
      const right: TrackItem = { ...item, id: createId(), startTime: atTime, mediaStart: mediaAtSplit };
      const tracks = p.tracks.map((t) => {
        if (t.id !== trackId) return t;
        return { ...t, items: t.items.flatMap((i) => i.id === itemId ? [left, right] : [i]) };
      });
      pushHistory(tracks);
      return { ...p, tracks, duration: calcProjectDuration(tracks) };
    });
    setSelectedItemId(null);
  }, [pushHistory]);

  const handleItemDelete = useCallback((trackId: string, itemId: string) => {
    setProject((p) => {
      const tracks = p.tracks.map((t) =>
        t.id === trackId ? { ...t, items: t.items.filter((i) => i.id !== itemId) } : t
      );
      pushHistory(tracks);
      return { ...p, tracks, duration: calcProjectDuration(tracks) };
    });
    setSelectedItemId(null);
  }, [pushHistory]);

  const handleUpdateItem = useCallback((trackId: string, itemId: string, updates: Partial<TrackItem>) => {
    setProject((p) => ({
      ...p,
      tracks: p.tracks.map((t) =>
        t.id !== trackId ? t : { ...t, items: t.items.map((i) => i.id !== itemId ? i : { ...i, ...updates }) }
      ),
    }));
  }, []);

  const handleToggleMute = useCallback((trackId: string) => {
    setProject((p) => ({ ...p, tracks: p.tracks.map((t) => t.id === trackId ? { ...t, muted: !t.muted } : t) }));
  }, []);

  const handleToggleLock = useCallback((trackId: string) => {
    setProject((p) => ({ ...p, tracks: p.tracks.map((t) => t.id === trackId ? { ...t, locked: !t.locked } : t) }));
  }, []);

  // ── Apply auto-cut silence regions ───────────────────────
  const handleApplyAutoCuts = useCallback((regions: SilenceRegion[]) => {
    setProject((p) => {
      const newTracks = applySilenceCuts(p.tracks, regions);
      pushHistory(newTracks);
      return { ...p, tracks: newTracks, duration: calcProjectDuration(newTracks) };
    });
    setShowAutoCut(false);
    if (isMobile) setShowMobilePanel(false);
  }, [pushHistory, isMobile]);

  // ── Export: Canvas+MediaRecorder (works without SharedArrayBuffer) ──
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
      // ── Try FFmpeg first (requires SharedArrayBuffer / COOP headers) ──
      const hasSharedBuffer = typeof SharedArrayBuffer !== 'undefined';

      if (hasSharedBuffer) {
        setExportState({ status: 'encoding', progress: 10, label: 'Carregando FFmpeg…' });
        const { FFmpeg } = await import('@ffmpeg/ffmpeg');
        const { fetchFile, toBlobURL } = await import('@ffmpeg/util');
        const ffmpeg = new FFmpeg();
        ffmpeg.on('progress', ({ progress }) => {
          setExportState((s) => ({ ...s, progress: 20 + Math.round(progress * 75), label: `Codificando… ${Math.round(progress * 100)}%` }));
        });
        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });
        setExportState((s) => ({ ...s, progress: 25, label: 'Importando clipes…' }));
        const writtenFiles = new Set<string>();
        for (const item of videoItems) {
          const mf = media.find((m) => m.id === item.mediaId);
          if (!mf || writtenFiles.has(mf.id)) continue;
          const filename = `input_${mf.id}.${mf.name.split('.').pop() ?? 'mp4'}`;
          await ffmpeg.writeFile(filename, await fetchFile(mf.url));
          writtenFiles.add(mf.id);
        }
        let filterParts: string[] = [];
        let concatInputs = '';
        videoItems.forEach((item, idx) => {
          filterParts.push(`[${idx}:v]trim=start=${item.mediaStart.toFixed(3)}:end=${item.mediaEnd.toFixed(3)},setpts=PTS-STARTPTS[v${idx}]`);
          concatInputs += `[v${idx}]`;
        });
        filterParts.push(`${concatInputs}concat=n=${videoItems.length}:v=1:a=0[outv]`);
        const inputArgs: string[] = [];
        videoItems.forEach((item) => {
          const mf = media.find((m) => m.id === item.mediaId)!;
          inputArgs.push('-i', `input_${mf.id}.${mf.name.split('.').pop() ?? 'mp4'}`);
        });
        setExportState((s) => ({ ...s, progress: 30, label: 'Processando vídeo…' }));
        await ffmpeg.exec([...inputArgs, '-filter_complex', filterParts.join(';'), '-map', '[outv]', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-movflags', '+faststart', 'output.mp4']);
        setExportState((s) => ({ ...s, progress: 97, label: 'Gerando download…' }));
        const rawData = await ffmpeg.readFile('output.mp4');
        const copy = new Uint8Array((rawData as Uint8Array).length);
        copy.set(rawData as Uint8Array);
        const blob = new Blob([copy.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${project.name}.mp4`; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setExportState({ status: 'done', progress: 100, label: 'Download iniciado!' });
        return;
      }

      // ── Fallback: Canvas + MediaRecorder (no WASM needed) ────────────
      // Renders each video segment to a canvas at 30fps and records it
      setExportState({ status: 'encoding', progress: 10, label: 'Preparando canvas…' });

      // Determine output size from first video
      const firstMf = media.find((m) => m.id === videoItems[0].mediaId);
      const outW = firstMf?.width ?? 1280;
      const outH = firstMf?.height ?? 720;

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d')!;

      // Pick best supported codec
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm';

      const chunks: BlobPart[] = [];
      const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType, videoBitsPerSecond: 8_000_000 });
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      const recorderStopped = new Promise<void>((res) => { recorder.onstop = () => res(); });
      recorder.start(100); // collect every 100ms

      const totalDuration = videoItems.reduce((acc, i) => acc + (i.endTime - i.startTime), 0);
      let elapsed = 0;
      const FPS = 30;
      const frameDuration = 1 / FPS;

      for (let segIdx = 0; segIdx < videoItems.length; segIdx++) {
        const item = videoItems[segIdx];
        const mf = media.find((m) => m.id === item.mediaId);
        if (!mf) continue;

        const segDuration = item.endTime - item.startTime;
        const rate = item.videoDetails?.playbackRate ?? 1;
        const vd = item.videoDetails;

        // Create a hidden video element for this segment
        const vid = document.createElement('video');
        vid.src = mf.url;
        vid.muted = true;
        vid.playsInline = true;
        if (rate !== 1) vid.playbackRate = rate;

        // Wait for video metadata + seek to start
        await new Promise<void>((res, rej) => {
          vid.onloadedmetadata = () => {
            vid.currentTime = item.mediaStart;
            vid.onseeked = () => res();
          };
          vid.onerror = rej;
          vid.load();
        });

        // Render frame by frame
        const frameCount = Math.ceil(segDuration * FPS);
        for (let f = 0; f < frameCount; f++) {
          const targetMedia = item.mediaStart + (f * frameDuration * rate);
          if (Math.abs(vid.currentTime - targetMedia) > frameDuration * 1.5) {
            vid.currentTime = Math.min(targetMedia, item.mediaEnd - 0.01);
            await new Promise<void>((r) => { vid.onseeked = () => r(); });
          }

          // Draw with CSS filters applied via canvas filter
          ctx.save();
          if (vd) {
            const filters: string[] = [];
            if (vd.brightness !== 1) filters.push(`brightness(${vd.brightness})`);
            if (vd.contrast !== 1) filters.push(`contrast(${vd.contrast})`);
            if (vd.saturation !== 1) filters.push(`saturate(${vd.saturation})`);
            if (filters.length) (ctx as any).filter = filters.join(' ');
            if (vd.opacity !== 1) ctx.globalAlpha = vd.opacity;
            if (vd.flipH || vd.flipV) {
              ctx.translate(vd.flipH ? outW : 0, vd.flipV ? outH : 0);
              ctx.scale(vd.flipH ? -1 : 1, vd.flipV ? -1 : 1);
            }
          }
          ctx.drawImage(vid, 0, 0, outW, outH);
          ctx.restore();
          (ctx as any).filter = 'none';
          ctx.globalAlpha = 1;

          elapsed += frameDuration;
          const prog = Math.round((elapsed / totalDuration) * 85) + 10;
          if (f % 15 === 0) {
            setExportState((s) => ({ ...s, progress: Math.min(95, prog), label: `Renderizando seg. ${segIdx + 1}/${videoItems.length}…` }));
            // Yield to browser to stay responsive
            await new Promise((r) => setTimeout(r, 0));
          }
        }

        vid.src = '';
      }

      setExportState((s) => ({ ...s, progress: 96, label: 'Finalizando…' }));
      recorder.stop();
      await recorderStopped;

      const blob = new Blob(chunks, { type: mimeType });
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${project.name}.${ext}`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setExportState({ status: 'done', progress: 100, label: 'Download iniciado!' });

    } catch (err: any) {
      console.error('Export error:', err);
      setExportState({
        status: 'error', progress: 0, label: '',
        error: `Erro ao exportar: ${err?.message ?? 'Tente novamente'}`,
      });
    }
  }, [project, media]);

  const selectedItem = selectedItemId ? project.tracks.flatMap((t) => t.items).find((i) => i.id === selectedItemId) ?? null : null;
  const selectedTrackId = selectedItemId ? project.tracks.find((t) => t.items.some((i) => i.id === selectedItemId))?.id ?? null : null;

  // On mobile: selecting an item automatically opens the Editar panel
  const handleItemSelect = useCallback((id: string | null) => {
    setSelectedItemId(id);
    if (isMobile && id) {
      setMobileTab('editar');
      setShowAutoCut(false);
      setShowMobilePanel(true);
    }
  }, [isMobile]);

  // ────────────────────────────────────────────────────────────
  // MOBILE LANDING (no media yet)
  // ────────────────────────────────────────────────────────────
  if (isMobile && !hasMedia) {
    // All hooks called above – safe early return
    return (
      <div className="h-full flex flex-col bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0 bg-card/60">
          <span className="text-base font-bold text-foreground">ViralCut</span>
          <button
            className="text-xs text-primary font-medium"
            onClick={() => { setExportState({ status: 'idle', progress: 0, label: '' }); setExportOpen(true); }}
          >
            Exportar
          </button>
        </div>

        {/* Landing content */}
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
          <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mb-2">
            <Scissors className="h-9 w-9 text-primary" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground mb-1">Editor de Vídeo</h2>
            <p className="text-sm text-muted-foreground">Edite vídeos profissionais diretamente no seu celular</p>
          </div>

          {/* Button 1: Normal upload */}
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

          {/* Button 2: Auto-cut */}
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

        {/* Hidden inputs */}
        <input ref={importRef} type="file" accept="video/*,audio/*,image/*" multiple className="hidden"
          onChange={(e) => e.target.files && handleImport(e.target.files)} />
        <input ref={autoCutImportRef} type="file" accept="video/*" className="hidden"
          onChange={(e) => e.target.files && handleAutoCutImport(e.target.files)} />

        <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} onExport={handleExport} exportState={exportState} project={project} />
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // MOBILE EDITOR (CapCut-style)
  // ────────────────────────────────────────────────────────────
  if (isMobile) {
    const mobileTabs = [
      { id: 'editar' as MobileTab, icon: <Scissors className="h-5 w-5" />, label: 'Editar' },
      { id: 'audio' as MobileTab, icon: <Music className="h-5 w-5" />, label: 'Áudio' },
      { id: 'texto' as MobileTab, icon: <Type className="h-5 w-5" />, label: 'Texto' },
      { id: 'efeitos' as MobileTab, icon: <Zap className="h-5 w-5" />, label: 'Efeitos' },
      { id: 'camada' as MobileTab, icon: <Layers className="h-5 w-5" />, label: 'Camada' },
    ];

    return (
      <div className="h-full flex flex-col bg-background overflow-hidden">
        {/* Top bar */}
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
            onClick={() => { setExportState({ status: 'idle', progress: 0, label: '' }); setExportOpen(true); }}
          >
            Exportar
          </button>
        </div>

        {/* Preview */}
        <div className="shrink-0" style={{ height: '42vh' }}>
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

        {/* Timeline */}
        <div className="flex-1 min-h-0 border-t border-border flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-2 py-1 bg-card/60 border-b border-border shrink-0">
            <span className="text-[10px] font-semibold text-foreground flex-1">Timeline</span>
            <button
              className="p-1 rounded bg-muted/60 text-muted-foreground hover:text-foreground"
              onClick={() => importRef.current?.click()}
              title="Adicionar mídia"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <input ref={importRef} type="file" accept="video/*,audio/*,image/*" multiple className="hidden"
              onChange={(e) => e.target.files && handleImport(e.target.files)} />
          </div>
          <div className="flex-1 min-h-0">
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
              onItemSelect={handleItemSelect}
              onItemSplit={handleItemSplit}
              onTrackToggleMute={handleToggleMute}
              onTrackToggleLock={handleToggleLock}
              onDropMedia={handleDropMedia}
            />
          </div>
        </div>

        {/* Sliding panel for tools */}
        {showMobilePanel && (
          <div className="fixed inset-0 z-40" onClick={() => { setShowMobilePanel(false); setShowAutoCut(false); }}>
            <div
              className="absolute bottom-16 left-0 right-0 bg-card border-t border-border rounded-t-2xl shadow-2xl overflow-hidden"
              style={{ maxHeight: '50vh' }}
              onClick={(e) => e.stopPropagation()}
            >
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
                  <AutoCut
                    tracks={project.tracks}
                    media={media}
                    onApplyCuts={handleApplyAutoCuts}
                    onClose={() => { setShowAutoCut(false); setShowMobilePanel(false); }}
                  />
                ) : mobileTab === 'texto' ? (
                  <MediaPanel
                    media={media}
                    selectedMediaId={selectedMediaId}
                    onImport={handleImport}
                    onSelect={setSelectedMediaId}
                    onDelete={handleDeleteMedia}
                    onAddToTimeline={handleAddToTimeline}
                    onAddText={handleAddText}
                    onAddShape={handleAddShape}
                    onAddTransition={() => {}}
                    defaultTab="text"
                  />
                ) : mobileTab === 'camada' ? (
                  <MediaPanel
                    media={media}
                    selectedMediaId={selectedMediaId}
                    onImport={handleImport}
                    onSelect={setSelectedMediaId}
                    onDelete={handleDeleteMedia}
                    onAddToTimeline={handleAddToTimeline}
                    onAddText={handleAddText}
                    onAddShape={handleAddShape}
                    onAddTransition={() => {}}
                    defaultTab="uploads"
                  />
                ) : mobileTab === 'editar' && selectedItem ? (
                  <PropertiesPanel
                    selectedItem={selectedItem}
                    selectedTrackId={selectedTrackId}
                    media={media}
                    onDelete={handleItemDelete}
                    onSplit={handleItemSplit}
                    onUpdateItem={handleUpdateItem}
                    currentTime={currentTime}
                  />
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

        {/* Bottom tab bar */}
        <div className="shrink-0 border-t border-border bg-card/95 safe-area-inset-bottom">
          <div className="flex">
            {mobileTabs.map((tab) => (
              <button
                key={tab.id}
                className={cn(
                  'flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors',
                  mobileTab === tab.id && showMobilePanel && !showAutoCut
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
                onClick={() => {
                  setMobileTab(tab.id);
                  setShowAutoCut(false);
                  setShowMobilePanel(true);
                }}
              >
                {tab.icon}
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            ))}
            {/* Auto-cut shortcut button */}
            <button
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2.5 transition-colors',
                showAutoCut && showMobilePanel ? 'text-amber-500' : 'text-muted-foreground'
              )}
              onClick={() => {
                setShowAutoCut(true);
                setShowMobilePanel(true);
              }}
            >
              <Wand2 className="h-5 w-5" />
              <span className="text-[10px] font-medium">Auto</span>
            </button>
          </div>
        </div>

        <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} onExport={handleExport} exportState={exportState} project={project} />
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────
  // DESKTOP EDITOR (original layout)
  // ────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
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

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left panel */}
        {showMedia && (
          <div className="w-[210px] xl:w-[230px] shrink-0 border-r border-border bg-card/50 flex flex-col overflow-hidden">
            {showAutoCut ? (
              <AutoCut
                tracks={project.tracks}
                media={media}
                onApplyCuts={handleApplyAutoCuts}
                onClose={() => setShowAutoCut(false)}
              />
            ) : (
              <MediaPanel
                media={media}
                selectedMediaId={selectedMediaId}
                onImport={handleImport}
                onSelect={setSelectedMediaId}
                onDelete={handleDeleteMedia}
                onAddToTimeline={handleAddToTimeline}
                onAddText={handleAddText}
                onAddShape={handleAddShape}
                onAddTransition={() => {}}
              />
            )}
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

        {/* Right panel */}
        {showProperties && (
          <div className="w-[210px] xl:w-[230px] shrink-0 border-l border-border bg-card/50 overflow-hidden">
            <PropertiesPanel
              selectedItem={selectedItem}
              selectedTrackId={selectedTrackId}
              media={media}
              onDelete={handleItemDelete}
              onSplit={handleItemSplit}
              onUpdateItem={handleUpdateItem}
              currentTime={currentTime}
            />
          </div>
        )}
      </div>

      {/* Timeline — flex layout: fills remaining height */}
      <div className="flex-none border-t border-border flex flex-col" style={{ height: 'clamp(160px, 28vh, 260px)' }}>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-card/60 border-b border-border shrink-0">
          <span className="text-[11px] font-semibold text-foreground uppercase tracking-wide flex-1">Timeline</span>
          <span className="text-[10px] text-muted-foreground hidden sm:block">
            Espaço = play/pause · Del = deletar · Arrastar borda = cortar
          </span>
          {/* Auto-cut toggle */}
          <button
            className={cn('flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors',
              showAutoCut ? 'bg-amber-500/20 text-amber-500 border border-amber-500/40' : 'text-muted-foreground hover:text-foreground border border-transparent')}
            onClick={() => setShowAutoCut((v) => !v)}
            title="Corte Automático"
          >
            <Wand2 className="h-3 w-3" />
            Auto Corte
          </button>
          <button
            className={cn('p-1 rounded transition-colors text-muted-foreground hover:text-foreground', showMedia && 'text-primary')}
            onClick={() => setShowMedia((v) => !v)}
            title="Painel de mídia"
          >
            <PanelLeft className="h-3.5 w-3.5" />
          </button>
          <button
            className={cn('p-1 rounded transition-colors text-muted-foreground hover:text-foreground', showProperties && 'text-primary')}
            onClick={() => setShowProperties((v) => !v)}
            title="Propriedades"
          >
            <PanelRight className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1 min-h-0">
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
