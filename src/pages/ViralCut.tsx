/**
 * ViralCut — lightweight editor
 * Features: Auto-cut (silence removal) + Captions (Web Speech API)
 *
 * Preview: native video.play() with requestAnimationFrame.
 *          Gap-skip uses a SINGLE setTimeout + isJumping guard to prevent double-fire.
 *
 * Export:  FFmpeg.wasm — trims + concatenates segments offline (no real-time playback).
 *          Silent, fast, correct.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, Scissors, Download, Play, Pause,
  Volume2, VolumeX, ZoomIn, ZoomOut, Loader2, X,
  ChevronDown, ChevronUp, Mic, MicOff, Undo2, RotateCcw,
  Settings2, ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Clip {
  id: string;
  srcStart: number;
  srcEnd: number;
  tlStart: number;
  tlEnd: number;
}

interface Caption {
  id: string;
  text: string;
  start: number;
  end: number;
}

type CutLevel = "suave" | "medio" | "agressivo";
type WordMode = 1 | 2 | 3;

const SILENCE_THRESHOLDS: Record<CutLevel, number> = {
  suave: 0.7,
  medio: 0.5,
  agressivo: 0.3,
};

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${sec.toString().padStart(2, "0")}.${ms}`;
}

// ─── Silence detection ────────────────────────────────────────────────────────

async function detectSilence(
  src: string,
  dur: number,
  minSilence: number,
  onProgress: (p: number) => void,
): Promise<Array<{ start: number; end: number }>> {
  const ctx = new AudioContext();
  const buf = await (await fetch(src)).arrayBuffer();
  onProgress(30);
  const audio = await ctx.decodeAudioData(buf);
  ctx.close();
  onProgress(70);

  const data = audio.getChannelData(0);
  const sr = audio.sampleRate;
  const win = Math.floor(sr * 0.05);
  const threshold = Math.pow(10, -30 / 20);
  const marginBefore = 0.1;
  const marginAfter = 0.12;

  const keeps: Array<{ start: number; end: number }> = [];
  let lastEnd = 0;
  let silStart = 0;
  let inSil = false;

  for (let i = 0; i < data.length; i += win) {
    let sum = 0;
    for (let j = i; j < Math.min(i + win, data.length); j++) sum += data[j] * data[j];
    const rms = Math.sqrt(sum / win);
    const t = i / sr;
    if (rms < threshold && !inSil) { inSil = true; silStart = t; }
    if (rms >= threshold && inSil) {
      inSil = false;
      if (t - silStart >= minSilence) {
        const ke = Math.max(0, silStart - marginBefore);
        const ks = Math.min(dur, t + marginAfter);
        if (ke > lastEnd) keeps.push({ start: lastEnd, end: ke });
        lastEnd = ks;
      }
    }
  }
  keeps.push({ start: lastEnd, end: dur });
  onProgress(100);
  const result = keeps.filter(k => k.end - k.start > 0.1);
  return result.length > 0 ? result : [{ start: 0, end: dur }];
}

// ─── Build clips ──────────────────────────────────────────────────────────────

function buildClips(segs: Array<{ start: number; end: number }>): Clip[] {
  let cursor = 0;
  return segs.map((seg, i) => {
    const dur = seg.end - seg.start;
    const clip: Clip = { id: `c${i}`, srcStart: seg.start, srcEnd: seg.end, tlStart: cursor, tlEnd: cursor + dur };
    cursor += dur;
    return clip;
  });
}

function tlToSrc(tl: number, clips: Clip[]): number | null {
  for (const c of clips) {
    if (tl >= c.tlStart && tl <= c.tlEnd) return c.srcStart + (tl - c.tlStart);
  }
  return null;
}

function srcToTl(src: number, clips: Clip[]): number {
  for (const c of clips) {
    if (src >= c.srcStart && src <= c.srcEnd) return c.tlStart + (src - c.srcStart);
  }
  const last = clips[clips.length - 1];
  return last ? last.tlEnd : src;
}

// ─── ClipBlock ────────────────────────────────────────────────────────────────

const CLIP_COLORS = [
  "hsl(262,70%,52%)", "hsl(299,70%,45%)", "hsl(210,80%,48%)",
  "hsl(160,65%,38%)", "hsl(25,85%,50%)", "hsl(340,75%,50%)",
];

function ClipBlock({ clip, idx, pxPerSec, onDelete }: {
  clip: Clip; idx: number; pxPerSec: number; onDelete: (id: string) => void;
}) {
  const left = clip.tlStart * pxPerSec;
  const width = Math.max(8, (clip.tlEnd - clip.tlStart) * pxPerSec);
  const color = CLIP_COLORS[idx % CLIP_COLORS.length];
  return (
    <div
      className="absolute top-1 bottom-1 rounded flex items-center overflow-hidden border border-white/10 shadow group cursor-pointer"
      style={{ left, width, backgroundColor: color }}
    >
      <span className="text-[9px] text-white font-bold px-2 flex-1 text-center truncate pointer-events-none select-none">
        {idx + 1}
      </span>
      {width > 28 && (
        <button
          className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-black/60 items-center justify-center opacity-0 group-hover:opacity-100 flex z-10"
          onMouseDown={e => { e.stopPropagation(); onDelete(clip.id); }}
        >
          <X className="h-2.5 w-2.5 text-white" />
        </button>
      )}
    </div>
  );
}

// ─── FFmpeg export (offline, fast) ───────────────────────────────────────────

async function exportWithFFmpeg(
  videoFile: File,
  segs: Array<{ start: number; end: number }>,
  onProgress: (pct: number, msg: string) => void,
): Promise<Blob> {
  const ffmpeg = new FFmpeg();

  // Load FFmpeg core from CDN
  onProgress(2, "Carregando FFmpeg...");
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  onProgress(10, "Carregando vídeo...");
  await ffmpeg.writeFile("input.mp4", await fetchFile(videoFile));

  const toBlob = (fileData: Awaited<ReturnType<typeof ffmpeg.readFile>>, mime: string) => {
    const u8 = fileData as Uint8Array;
    const plain = new Uint8Array(u8.byteLength);
    plain.set(u8);
    return new Blob([plain.buffer as ArrayBuffer], { type: mime });
  };

  // Trim each segment
  // IMPORTANT: -ss is placed AFTER -i (input-seek = slow but frame-accurate).
  // This prevents FFmpeg from snapping to the nearest keyframe before the cut,
  // which caused repeated frames/scenes at segment boundaries.
  // -reset_timestamps 1 ensures each segment starts at t=0 for clean concatenation.
  const segFiles: string[] = [];
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i];
    const outName = `seg${i}.mp4`;
    const pct = 10 + Math.round((i / segs.length) * 70);
    onProgress(pct, `Cortando clipe ${i + 1}/${segs.length}...`);

    await ffmpeg.exec([
      "-i", "input.mp4",
      "-ss", String(seg.start.toFixed(6)),   // output-seek: frame-accurate
      "-t",  String((seg.end - seg.start).toFixed(6)),
      "-c", "copy",
      "-reset_timestamps", "1",             // reset pts to 0 per segment
      "-avoid_negative_ts", "make_zero",
      outName,
    ]);
    segFiles.push(outName);
  }

  onProgress(82, "Concatenando clipes...");

  if (segFiles.length === 1) {
    const data = await ffmpeg.readFile(segFiles[0]);
    return toBlob(data, "video/mp4");
  }

  // Concat — use -fflags +genpts to regenerate presentation timestamps
  // so the final file has a clean, monotonically increasing timeline.
  const concatList = segFiles.map(f => `file '${f}'`).join("\n");
  await ffmpeg.writeFile("list.txt", concatList);

  await ffmpeg.exec([
    "-f", "concat",
    "-safe", "0",
    "-i", "list.txt",
    "-c", "copy",
    "-fflags", "+genpts",   // regenerate pts → eliminates repeated frames
    "output.mp4",
  ]);

  onProgress(96, "Finalizando...");
  const data = await ffmpeg.readFile("output.mp4");
  return toBlob(data, "video/mp4");
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ViralCut() {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rafRef = useRef<number>(0);
  const clipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guard: prevents seeked from re-scheduling while a jump is in flight
  const isJumpingRef = useRef(false);

  // ── Media ──────────────────────────────────────────────────────────────────
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoName, setVideoName] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [duration, setDuration] = useState(0);

  // ── Playback ───────────────────────────────────────────────────────────────
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [tlTime, setTlTime] = useState(0);
  const playingRef = useRef(false);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  // ── Clips ──────────────────────────────────────────────────────────────────
  const [clips, setClips] = useState<Clip[]>([]);
  const clipsRef = useRef<Clip[]>([]);
  useEffect(() => { clipsRef.current = clips; }, [clips]);

  const tlDuration = clips.length > 0 ? clips[clips.length - 1].tlEnd : duration;

  // ── Cut controls ───────────────────────────────────────────────────────────
  const [cutLevel, setCutLevel] = useState<CutLevel>("medio");
  const [cutting, setCutting] = useState(false);
  const [cutPct, setCutPct] = useState(0);

  // ── Captions ───────────────────────────────────────────────────────────────
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [activeCaption, setActiveCaption] = useState<Caption | null>(null);
  const [wordMode, setWordMode] = useState<WordMode>(2);
  const [captionTranscribing, setCaptionTranscribing] = useState(false);
  const [captionStyle, setCaptionStyle] = useState({ color: "#ffffff", size: 32, posY: 80 });
  const captionStyleRef = useRef(captionStyle);
  useEffect(() => { captionStyleRef.current = captionStyle; }, [captionStyle]);
  const recognitionRef = useRef<any>(null);
  const wordTimingsRef = useRef<Array<{ text: string; start: number; end: number }>>([]);

  // ── Export ─────────────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState("");
  const [exportPct, setExportPct] = useState(0);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const [scale, setScale] = useState(1);
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);
  const [undoClips, setUndoClips] = useState<Clip[] | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pxPerSec = scale * 80;

  // ─── Video load ────────────────────────────────────────────────────────────
  const handleVideoLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setVideoName(file.name);
    setVideoSrc(url);
    setClips([]);
    clipsRef.current = [];
    setCaptions([]);
    setTlTime(0);
    setPlaying(false);
    playingRef.current = false;
    e.target.value = "";
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !videoSrc) return;
    v.src = videoSrc;
    v.load();
    const onMeta = () => setDuration(v.duration);
    v.addEventListener("loadedmetadata", onMeta);
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, [videoSrc]);

  useEffect(() => {
    const v = videoRef.current;
    if (v) { v.volume = volume / 100; v.muted = muted; }
  }, [volume, muted]);

  // ─── RAF loop ─────────────────────────────────────────────────────────────
  const captionsRef = useRef(captions);
  useEffect(() => { captionsRef.current = captions; }, [captions]);

  const rafLoop = useCallback(() => {
    const v = videoRef.current;
    if (!v || !playingRef.current) return;
    const src = v.currentTime;
    const cs = clipsRef.current;
    const tl = cs.length > 0 ? srcToTl(src, cs) : src;
    setTlTime(tl);
    const cap = captionsRef.current.find(c => tl >= c.start && tl < c.end) ?? null;
    setActiveCaption(cap);
    rafRef.current = requestAnimationFrame(rafLoop);
  }, []);

  useEffect(() => {
    if (playing) rafRef.current = requestAnimationFrame(rafLoop);
    else cancelAnimationFrame(rafRef.current);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing, rafLoop]);

  // ─── Clip-skip — single timer + isJumping guard ───────────────────────────
  const scheduleNextJump = useCallback((v: HTMLVideoElement) => {
    if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
    const cs = clipsRef.current;
    if (cs.length === 0) return;

    const src = v.currentTime;
    const clipIdx = cs.findIndex(c => src >= c.srcStart && src < c.srcEnd - 0.01);

    if (clipIdx === -1) {
      // In a gap — jump immediately
      const next = cs.find(c => c.srcStart > src);
      if (next) {
        isJumpingRef.current = true;
        v.currentTime = next.srcStart;
      } else {
        v.pause(); setPlaying(false); playingRef.current = false;
      }
      return;
    }

    const cur = cs[clipIdx];
    const next = cs[clipIdx + 1];
    const remaining = (cur.srcEnd - src) / Math.max(0.1, v.playbackRate);
    // Schedule 50ms early so we don't overshoot into the gap
    const delay = Math.max(0, remaining * 1000 - 50);

    clipTimerRef.current = setTimeout(() => {
      if (!playingRef.current || v.paused) return;
      if (next) {
        isJumpingRef.current = true;
        v.currentTime = next.srcStart;
        // onSeeked will reschedule after the seek completes
      } else {
        v.pause();
        setPlaying(false);
        playingRef.current = false;
        setTlTime(cs[cs.length - 1].tlEnd);
      }
    }, delay);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => {
      isJumpingRef.current = false;
      scheduleNextJump(v);
    };
    const onSeeked = () => {
      // Only reschedule if this seeked was triggered by our jump logic
      if (isJumpingRef.current) {
        isJumpingRef.current = false;
        if (playingRef.current) {
          // Small delay to let the video stabilise before rescheduling
          setTimeout(() => scheduleNextJump(v), 30);
        }
      }
    };
    const onPause = () => {
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
      isJumpingRef.current = false;
    };
    const onEnded = () => { setPlaying(false); playingRef.current = false; };

    v.addEventListener("play", onPlay);
    v.addEventListener("seeked", onSeeked);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("seeked", onSeeked);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
    };
  }, [scheduleNextJump, videoSrc]);

  // ─── Seek ──────────────────────────────────────────────────────────────────
  const seek = useCallback((tl: number) => {
    const v = videoRef.current;
    if (!v) return;
    const cs = clipsRef.current;
    const src = cs.length > 0 ? (tlToSrc(tl, cs) ?? cs[0].srcStart) : tl;
    // Manual seek is NOT a jump — clear the flag so onSeeked doesn't reschedule
    isJumpingRef.current = false;
    if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
    v.currentTime = src;
    setTlTime(tl);
    // If playing, reschedule after seek settles
    if (playingRef.current) {
      const onS = () => {
        v.removeEventListener("seeked", onS);
        scheduleNextJump(v);
      };
      v.addEventListener("seeked", onS);
    }
  }, [scheduleNextJump]);

  // ─── Play / pause ──────────────────────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
      setPlaying(false);
    } else {
      const cs = clipsRef.current;
      if (cs.length > 0 && tlTime >= cs[cs.length - 1].tlEnd - 0.05) {
        isJumpingRef.current = false;
        v.currentTime = cs[0].srcStart;
        setTlTime(cs[0].tlStart);
      }
      v.play().catch(() => {});
      setPlaying(true);
    }
  };

  // ─── Auto-cut ──────────────────────────────────────────────────────────────
  const handleAutoCut = async () => {
    if (!videoSrc || duration <= 0) {
      toast({ title: "Carregue um vídeo primeiro", variant: "destructive" });
      return;
    }
    setUndoClips(clips);
    setCutting(true);
    setCutPct(0);
    videoRef.current?.pause();
    setPlaying(false);
    try {
      const segs = await detectSilence(videoSrc, duration, SILENCE_THRESHOLDS[cutLevel], setCutPct);
      const newClips = buildClips(segs);
      setClips(newClips);
      clipsRef.current = newClips;
      seek(0);
      toast({ title: `✂️ ${newClips.length} clipes detectados`, description: `Silêncios removidos — nível: ${cutLevel}` });
    } catch (err) {
      toast({ title: "Erro no corte automático", description: String(err), variant: "destructive" });
    } finally {
      setCutting(false);
      setCutPct(0);
    }
  };

  const handleResetCuts = () => {
    if (!duration) return;
    const full: Clip = { id: "c0", srcStart: 0, srcEnd: duration, tlStart: 0, tlEnd: duration };
    setClips([full]);
    clipsRef.current = [full];
    setTlTime(0);
    if (videoRef.current) videoRef.current.currentTime = 0;
    toast({ title: "Cortes desfeitos" });
  };

  const handleDeleteClip = useCallback((id: string) => {
    setUndoClips(prev => prev ?? clipsRef.current);
    setClips(prev => {
      const next = prev.filter(c => c.id !== id);
      if (next.length === 0) {
        const full: Clip = { id: "c0", srcStart: 0, srcEnd: duration, tlStart: 0, tlEnd: duration };
        clipsRef.current = [full];
        return [full];
      }
      let cursor = 0;
      const repacked = next.map(c => {
        const d = c.srcEnd - c.srcStart;
        const nc = { ...c, tlStart: cursor, tlEnd: cursor + d };
        cursor += d;
        return nc;
      });
      clipsRef.current = repacked;
      return repacked;
    });
    toast({ title: "Clipe removido" });
  }, [duration]);

  // ─── Captions ──────────────────────────────────────────────────────────────
  const startTranscription = async () => {
    const v = videoRef.current;
    if (!v || !videoSrc) { toast({ title: "Carregue um vídeo primeiro", variant: "destructive" }); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast({ title: "Reconhecimento de voz não suportado", variant: "destructive" }); return; }

    wordTimingsRef.current = [];
    setCaptionTranscribing(true);

    const recognition = new SR();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "pt-BR";

    recognition.onresult = (event: any) => {
      const vt = videoRef.current?.currentTime ?? 0;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const words = event.results[i][0].transcript.trim().split(/\s+/).filter(Boolean);
          words.forEach((w: string, wi: number) => {
            wordTimingsRef.current.push({
              text: w,
              start: Math.max(0, vt - words.length * 0.4 + wi * 0.4),
              end: vt - words.length * 0.4 + (wi + 1) * 0.4,
            });
          });
        }
      }
    };

    recognition.onend = () => {
      v.pause();
      setPlaying(false);
      setCaptionTranscribing(false);
      const wt = wordTimingsRef.current;
      if (wt.length === 0) { toast({ title: "Nenhuma fala detectada", variant: "destructive" }); return; }
      const blocks: Caption[] = [];
      for (let i = 0; i < wt.length; i += wordMode) {
        const chunk = wt.slice(i, i + wordMode);
        blocks.push({ id: `cap-${i}`, text: chunk.map(w => w.text).join(" "), start: chunk[0].start, end: chunk[chunk.length - 1].end });
      }
      setCaptions(blocks);
      toast({ title: `${blocks.length} legendas geradas` });
    };

    recognition.onerror = () => { setCaptionTranscribing(false); };

    v.currentTime = clipsRef.current.length > 0 ? clipsRef.current[0].srcStart : 0;
    setTlTime(0);
    recognition.start();
    await v.play().catch(() => {});
    setPlaying(true);
  };

  const stopTranscription = () => {
    recognitionRef.current?.stop();
    videoRef.current?.pause();
    setPlaying(false);
    setCaptionTranscribing(false);
  };

  // ─── Export via FFmpeg.wasm (offline, no playback) ────────────────────────
  const handleExport = async () => {
    if (!videoSrc || !videoFile) { toast({ title: "Sem vídeo", variant: "destructive" }); return; }
    const segs = clips.length > 0
      ? clips.map(c => ({ start: c.srcStart, end: c.srcEnd }))
      : [{ start: 0, end: duration }];

    setExporting(true);
    setExportPct(0);
    setExportMsg("Preparando...");
    videoRef.current?.pause();
    setPlaying(false);

    try {
      const blob = await exportWithFFmpeg(videoFile, segs, (pct, msg) => {
        setExportPct(pct);
        setExportMsg(msg);
      });

      setExportPct(100);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = videoName.replace(/\.[^.]+$/, "") + "-viralcut.mp4";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      toast({ title: `✅ Exportado! ${segs.length} clipe${segs.length > 1 ? "s" : ""} concatenados.` });
    } catch (err) {
      toast({ title: "Erro na exportação", description: String(err), variant: "destructive" });
    } finally {
      setExporting(false);
      setExportMsg("");
      setExportPct(0);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const hasVideo = !!videoSrc;
  const displayTime = tlTime;
  const displayDuration = tlDuration;
  const progressPct = displayDuration > 0 ? (displayTime / displayDuration) * 100 : 0;

  return (
    <div className="flex flex-col h-full bg-[hsl(220,25%,8%)] text-foreground overflow-hidden select-none">

      {/* ── Top Bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-[hsl(220,25%,10%)] shrink-0">
        {/* Mobile sidebar toggle */}
        <button
          className="md:hidden text-muted-foreground hover:text-foreground mr-1"
          onClick={() => setSidebarOpen(s => !s)}
        >
          <Settings2 className="h-4 w-4" />
        </button>

        <Scissors className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-bold text-primary shrink-0">ViralCut</span>
        {videoName && <span className="text-[10px] text-muted-foreground truncate max-w-[100px] hidden sm:block">{videoName}</span>}

        <div className="flex items-center gap-1.5 ml-auto">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-2" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3 w-3" />
            <span className="hidden sm:inline">Vídeo</span>
          </Button>

          <Button
            size="sm" variant="outline" className="h-7 text-xs gap-1 px-2"
            onClick={handleAutoCut}
            disabled={!hasVideo || cutting}
          >
            {cutting
              ? <><Loader2 className="h-3 w-3 animate-spin" /><span className="hidden sm:inline">{cutPct}%</span></>
              : <><Scissors className="h-3 w-3" /><span className="hidden sm:inline">Corte Auto</span></>}
          </Button>

          {clips.length > 1 && undoClips && (
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => {
              setClips(undoClips); clipsRef.current = undoClips; setUndoClips(null);
              toast({ title: "↩ Desfeito" });
            }}>
              <Undo2 className="h-3 w-3" />
            </Button>
          )}
          {clips.length > 1 && (
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => { setUndoClips(null); handleResetCuts(); }}>
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}

          <Button
            size="sm" className="h-7 text-xs gap-1 px-2"
            onClick={handleExport}
            disabled={!hasVideo || exporting}
          >
            {exporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
            <span className="hidden sm:inline">Exportar</span>
          </Button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoLoad} />

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden relative">

        {/* ── Mobile sidebar overlay ───────────────────────────────────── */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
        <div className={cn(
          "shrink-0 border-r border-border/40 bg-[hsl(220,25%,10%)] flex flex-col overflow-y-auto z-50 transition-transform duration-200",
          "w-52",
          // Desktop: always visible
          "hidden md:flex",
          // Mobile: absolute overlay
          sidebarOpen && "!flex fixed inset-y-0 left-0 top-auto bottom-0 h-full",
        )}>
          {/* Mobile close */}
          <div className="md:hidden flex items-center justify-between px-3 pt-3 pb-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Configurações</span>
            <button onClick={() => setSidebarOpen(false)}><ChevronLeft className="h-4 w-4" /></button>
          </div>

          <div className="p-3 space-y-4">
            {/* Auto-cut */}
            <div className="space-y-2">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Corte Automático</p>
              <button
                onClick={() => { fileInputRef.current?.click(); setSidebarOpen(false); }}
                className="w-full border-2 border-dashed border-border hover:border-primary rounded-lg p-3 flex flex-col items-center gap-1.5 transition-colors group"
              >
                <Upload className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                <span className="text-[10px] text-muted-foreground text-center">Clique ou arraste um vídeo</span>
              </button>

              {hasVideo && (
                <div className="bg-card/60 rounded p-2 space-y-0.5">
                  <p className="text-[10px] text-foreground truncate">{videoName}</p>
                  <p className="text-[10px] text-muted-foreground">{fmtTime(duration)}</p>
                </div>
              )}

              <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Nível de corte</p>
              <div className="grid grid-cols-3 gap-1">
                {(["suave", "medio", "agressivo"] as CutLevel[]).map(lvl => (
                  <button
                    key={lvl}
                    onClick={() => setCutLevel(lvl)}
                    className={cn(
                      "text-[9px] py-1.5 rounded border transition-colors capitalize",
                      cutLevel === lvl ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary"
                    )}
                  >{lvl}</button>
                ))}
              </div>

              <Button size="sm" className="w-full h-8 text-xs" onClick={() => { handleAutoCut(); setSidebarOpen(false); }} disabled={!hasVideo || cutting}>
                {cutting
                  ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />{cutPct}%</>
                  : <><Scissors className="h-3 w-3 mr-1" />Cortar silêncio</>}
              </Button>

              {clips.length > 1 && (
                <div className="bg-primary/10 border border-primary/30 rounded p-2 space-y-1">
                  <p className="text-[10px] text-primary font-medium">{clips.length} clipes ativos</p>
                  <p className="text-[9px] text-muted-foreground">{fmtTime(displayDuration)} de conteúdo</p>
                  <button onClick={handleResetCuts} className="text-[9px] text-destructive hover:underline">Desfazer cortes</button>
                </div>
              )}
            </div>

            {/* Captions */}
            <div className="border-t border-border/40 pt-3 space-y-2">
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Legendas</p>
              <div className="bg-card/40 rounded p-2">
                <p className="text-[9px] text-muted-foreground leading-relaxed">
                  Transcreve o áudio em tempo real via reconhecimento de voz.
                </p>
              </div>

              <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Palavras por bloco</p>
              <div className="grid grid-cols-3 gap-1">
                {([1, 2, 3] as WordMode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setWordMode(m)}
                    className={cn(
                      "text-[9px] py-1.5 rounded border transition-colors",
                      wordMode === m ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground hover:border-primary"
                    )}
                  >{m}</button>
                ))}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-muted-foreground w-8">Cor</label>
                  <input type="color" value={captionStyle.color}
                    onChange={e => setCaptionStyle(s => ({ ...s, color: e.target.value }))}
                    className="h-5 w-8 cursor-pointer rounded border-0 bg-transparent" />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-muted-foreground w-8">Tam</label>
                  <Slider value={[captionStyle.size]} onValueChange={v => setCaptionStyle(s => ({ ...s, size: v[0] }))}
                    min={16} max={72} step={2} className="flex-1" />
                  <span className="text-[10px] w-5 text-right text-muted-foreground">{captionStyle.size}</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-[10px] text-muted-foreground w-8">Pos</label>
                  <Slider value={[captionStyle.posY]} onValueChange={v => setCaptionStyle(s => ({ ...s, posY: v[0] }))}
                    min={10} max={95} step={5} className="flex-1" />
                  <span className="text-[10px] w-5 text-right text-muted-foreground">{captionStyle.posY}%</span>
                </div>
              </div>

              {captionTranscribing ? (
                <Button size="sm" variant="destructive" className="w-full h-8 text-xs" onClick={stopTranscription}>
                  <MicOff className="h-3 w-3 mr-1" />Parar transcrição
                </Button>
              ) : (
                <Button size="sm" className="w-full h-8 text-xs" onClick={() => { startTranscription(); setSidebarOpen(false); }} disabled={!hasVideo || captionTranscribing}>
                  <Mic className="h-3 w-3 mr-1" />{captions.length > 0 ? "Retranscrever" : "Gerar legendas"}
                </Button>
              )}

              {captionTranscribing && (
                <div className="bg-destructive/10 border border-destructive/30 rounded p-1.5 flex items-center gap-2">
                  <div className="h-2 w-2 bg-destructive rounded-full animate-pulse shrink-0" />
                  <p className="text-[9px] text-destructive">Transcrevendo...</p>
                </div>
              )}

              {captions.length > 0 && (
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-primary">{captions.length} legendas</p>
                  <button onClick={() => setCaptions([])} className="text-[9px] text-muted-foreground hover:text-destructive">Limpar</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Preview + controls + timeline ────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">

          {/* Preview area */}
          <div className="flex-1 min-h-0 relative bg-black flex items-center justify-center overflow-hidden">
            {!hasVideo ? (
              <div
                className="flex flex-col items-center gap-3 text-muted-foreground cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="h-16 w-16 rounded-full border-2 border-dashed border-border group-hover:border-primary flex items-center justify-center transition-colors">
                  <Upload className="h-7 w-7 group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm text-center px-4">Toque para carregar um vídeo</p>
              </div>
            ) : (
              <>
                <video
                  ref={videoRef}
                  className="max-h-full max-w-full"
                  playsInline
                  onClick={togglePlay}
                />
                {/* Caption overlay */}
                {activeCaption && (
                  <div
                    className="absolute left-0 right-0 pointer-events-none flex justify-center px-4"
                    style={{ bottom: `${100 - captionStyle.posY}%` }}
                  >
                    <span
                      className="text-center font-bold px-3 py-1 rounded"
                      style={{
                        fontSize: captionStyle.size,
                        color: captionStyle.color,
                        textShadow: "0 2px 8px #000, 0 0 2px #000",
                        backgroundColor: "rgba(0,0,0,0.45)",
                        lineHeight: 1.2,
                      }}
                    >
                      {activeCaption.text}
                    </span>
                  </div>
                )}
                {!playing && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="h-14 w-14 rounded-full bg-black/50 flex items-center justify-center">
                      <Play className="h-7 w-7 text-white ml-1" />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Controls bar */}
          <div className="shrink-0 bg-[hsl(220,25%,10%)] border-t border-border/40 px-3 py-2 flex items-center gap-2">
            <button onClick={togglePlay} disabled={!hasVideo} className="text-foreground hover:text-primary disabled:opacity-40 shrink-0">
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>

            {/* Progress bar */}
            <div
              className="flex-1 relative h-3 bg-muted/40 rounded-full cursor-pointer group"
              onClick={e => {
                if (!displayDuration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                seek(Math.max(0, Math.min(displayDuration, ((e.clientX - rect.left) / rect.width) * displayDuration)));
              }}
            >
              <div className="absolute inset-y-0 left-0 bg-primary rounded-full transition-none" style={{ width: `${progressPct}%` }} />
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-4 bg-primary rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity touch-none"
                style={{ left: `${progressPct}%` }}
                onMouseDown={e => {
                  e.stopPropagation();
                  const bar = e.currentTarget.parentElement!;
                  const onMove = (ev: MouseEvent) => {
                    const r = bar.getBoundingClientRect();
                    seek(Math.max(0, Math.min(displayDuration, ((ev.clientX - r.left) / r.width) * displayDuration)));
                  };
                  const onUp = () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
                  window.addEventListener("mousemove", onMove);
                  window.addEventListener("mouseup", onUp);
                }}
                onTouchStart={e => {
                  e.stopPropagation();
                  const bar = e.currentTarget.parentElement!;
                  const onMove = (ev: TouchEvent) => {
                    const r = bar.getBoundingClientRect();
                    seek(Math.max(0, Math.min(displayDuration, ((ev.touches[0].clientX - r.left) / r.width) * displayDuration)));
                  };
                  const onEnd = () => { window.removeEventListener("touchmove", onMove); window.removeEventListener("touchend", onEnd); };
                  window.addEventListener("touchmove", onMove, { passive: true });
                  window.addEventListener("touchend", onEnd);
                }}
              />
            </div>

            <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap shrink-0">
              {fmtTime(displayTime)} / {fmtTime(displayDuration)}
            </span>

            <button onClick={() => setMuted(m => !m)} className="text-muted-foreground hover:text-foreground shrink-0">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <div className="w-16 shrink-0 hidden sm:block">
              <Slider value={[volume]} onValueChange={v => setVolume(v[0])} min={0} max={100} step={1} />
            </div>
          </div>

          {/* Timeline toolbar */}
          <div className="shrink-0 bg-[hsl(220,25%,9%)] border-t border-border/40 px-2 py-1.5 flex items-center gap-1.5">
            <span className="text-[9px] text-muted-foreground uppercase tracking-widest hidden sm:block">Zoom</span>
            <button onClick={() => setScale(s => Math.max(0.25, Math.round((s - 0.25) * 4) / 4))} className="text-muted-foreground hover:text-foreground p-0.5">
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="text-[9px] text-muted-foreground w-6 text-center">{scale}x</span>
            <button onClick={() => setScale(s => Math.min(8, Math.round((s + 0.25) * 4) / 4))} className="text-muted-foreground hover:text-foreground p-0.5">
              <ZoomIn className="h-3.5 w-3.5" />
            </button>

            {clips.length > 1 && (
              <span className="text-[9px] text-primary bg-primary/10 border border-primary/30 rounded px-1.5 ml-1">
                {clips.length} clips
              </span>
            )}

            <button
              className="text-muted-foreground hover:text-foreground ml-auto p-0.5"
              onClick={() => setTimelineCollapsed(c => !c)}
            >
              {timelineCollapsed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          {/* Timeline */}
          {!timelineCollapsed && hasVideo && (
            <div
              className="shrink-0 bg-[hsl(220,25%,9%)] border-t border-border/30 overflow-x-auto overflow-y-hidden"
              style={{ height: 72 }}
              onWheel={e => {
                if (e.ctrlKey) {
                  e.preventDefault();
                  setScale(s => Math.max(0.25, Math.min(8, s - e.deltaY * 0.002)));
                }
              }}
            >
              <div
                className="relative"
                style={{ width: Math.max(300, displayDuration * pxPerSec + 48), height: 72 }}
              >
                {/* Time ticks */}
                <div className="absolute top-0 left-0 right-0 h-5 border-b border-border/30 pointer-events-none">
                  {Array.from({ length: Math.max(1, Math.ceil(displayDuration) + 1) }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 flex items-end pb-0.5"
                      style={{ left: i * pxPerSec, borderLeft: "1px solid hsl(var(--border)/0.2)" }}
                    >
                      <span className="text-[7px] text-muted-foreground pl-0.5 select-none">{i}s</span>
                    </div>
                  ))}
                </div>

                {/* Clip track */}
                <div
                  className="absolute top-5 left-0 right-0 bottom-0 cursor-pointer"
                  onClick={e => {
                    if (!displayDuration) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    seek(Math.max(0, Math.min(displayDuration, (e.clientX - rect.left) / pxPerSec)));
                  }}
                >
                  {clips.map((clip, idx) => (
                    <ClipBlock
                      key={clip.id}
                      clip={clip}
                      idx={idx}
                      pxPerSec={pxPerSec}
                      onDelete={handleDeleteClip}
                    />
                  ))}

                  {/* Playhead */}
                  {displayDuration > 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-primary z-20 pointer-events-none"
                      style={{ left: displayTime * pxPerSec }}
                    >
                      {/* Playhead handle (triangle) */}
                      <div className="absolute -top-0.5 -left-1.5 w-3 h-2.5 bg-primary"
                        style={{ clipPath: "polygon(50% 100%, 0 0, 100% 0)" }} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Export overlay ─────────────────────────────────────────────── */}
      {exporting && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-4 w-full max-w-xs">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm font-medium text-center">{exportMsg}</p>
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div className="bg-primary h-2.5 rounded-full transition-all duration-300" style={{ width: `${exportPct}%` }} />
            </div>
            <p className="text-xs text-muted-foreground tabular-nums">{exportPct}% concluído</p>
          </div>
        </div>
      )}
    </div>
  );
}
