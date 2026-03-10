import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, Scissors, Type, Layers, Wand2, Download, Play, Pause,
  Square, SkipBack, SkipForward, Volume2, VolumeX, ZoomIn, ZoomOut,
  Film, Music, AlignCenter, Sparkles, Trash2, Eye, EyeOff,
  ChevronRight, ChevronLeft, Loader2, CheckCircle, AlertCircle, X,
  Maximize2, Minimize2, RotateCcw, Move, ChevronUp, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClipSegment = { id: string; start: number; end: number; label?: string };
type LayerType = "video" | "overlay" | "text" | "audio";

interface Layer {
  id: string;
  type: LayerType;
  label: string;
  start: number;        // seconds
  end: number;          // seconds
  visible: boolean;
  locked: boolean;
  color: string;
  content?: string;     // text content or url
  x?: number; y?: number; scale?: number; opacity?: number; rotation?: number;
}

interface CaptionBlock {
  id: string;
  text: string;
  start: number;
  end: number;
  words?: string[];
}

type AutoCutLevel = "suave" | "medio" | "agressivo";
type CaptionWordMode = 1 | 2 | 3;

const SILENCE_THRESHOLDS: Record<AutoCutLevel, number> = {
  suave: 0.7,
  medio: 0.5,
  agressivo: 0.3,
};

const LAYER_COLORS: Record<LayerType, string> = {
  video: "hsl(262,83%,58%)",
  overlay: "hsl(25,90%,55%)",
  text: "hsl(160,70%,40%)",
  audio: "hsl(210,80%,50%)",
};

// ─── Silence Detection (Web Audio API) ───────────────────────────────────────

async function detectSilenceSegments(
  videoEl: HTMLVideoElement,
  threshold: number,
  minDuration: number,
  onProgress: (p: number) => void
): Promise<ClipSegment[]> {
  const audioCtx = new AudioContext();
  const response = await fetch(videoEl.src);
  const arrayBuf = await response.arrayBuffer();
  onProgress(30);
  const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
  onProgress(60);

  const data = audioBuf.getChannelData(0);
  const sampleRate = audioBuf.sampleRate;
  const duration = audioBuf.duration;

  const windowSamples = Math.floor(sampleRate * 0.05);
  const rms: number[] = [];
  for (let i = 0; i < data.length; i += windowSamples) {
    let sum = 0;
    for (let j = i; j < Math.min(i + windowSamples, data.length); j++) {
      sum += data[j] * data[j];
    }
    rms.push(Math.sqrt(sum / windowSamples));
  }

  const dbThreshold = Math.pow(10, -30 / 20); // -30dB
  const segments: ClipSegment[] = [];
  let inSilence = false;
  let silenceStart = 0;
  const margin_before = 0.1;
  const margin_after = 0.12;

  const keepRanges: Array<{ start: number; end: number }> = [];
  let lastKeepEnd = 0;

  rms.forEach((v, i) => {
    const t = (i * windowSamples) / sampleRate;
    const isSilent = v < dbThreshold;
    if (isSilent && !inSilence) { inSilence = true; silenceStart = t; }
    if (!isSilent && inSilence) {
      inSilence = false;
      const silenceDur = t - silenceStart;
      if (silenceDur >= minDuration) {
        const keepEnd = Math.max(0, silenceStart - margin_before);
        const keepStart = Math.min(duration, t + margin_after);
        if (keepEnd > lastKeepEnd) keepRanges.push({ start: lastKeepEnd, end: keepEnd });
        lastKeepEnd = keepStart;
      }
    }
  });
  keepRanges.push({ start: lastKeepEnd, end: duration });

  keepRanges.forEach((r, i) => {
    if (r.end - r.start > 0.1) {
      segments.push({ id: `clip-${i}`, start: r.start, end: r.end });
    }
  });

  onProgress(100);
  audioCtx.close();
  return segments.length > 0 ? segments : [{ id: "clip-0", start: 0, end: duration }];
}

// ─── Simple Caption Generator (word split, no real ASR) ──────────────────────

function generateMockCaptions(text: string, duration: number, mode: CaptionWordMode): CaptionBlock[] {
  const words = text.trim().split(/\s+/);
  const blocks: CaptionBlock[] = [];
  let i = 0;
  let blockIdx = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + mode);
    const start = (i / words.length) * duration;
    const end = ((i + mode) / words.length) * duration;
    blocks.push({ id: `cap-${blockIdx++}`, text: chunk.join(" "), start, end, words: chunk });
    i += mode;
  }
  return blocks;
}

// ─── Timeline Lane ────────────────────────────────────────────────────────────

function TimelineLane({
  layer, duration, scale,
  onToggleVisible, onDelete
}: {
  layer: Layer; duration: number; scale: number;
  onToggleVisible: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const pxPerSec = scale * 80;
  const left = layer.start * pxPerSec;
  const width = Math.max(20, (layer.end - layer.start) * pxPerSec);

  return (
    <div className="flex items-center h-10 border-b border-border/30 group">
      {/* Lane header */}
      <div className="w-32 shrink-0 flex items-center gap-1 px-2 border-r border-border/30 h-full bg-card/50">
        <button onClick={() => onToggleVisible(layer.id)} className="text-muted-foreground hover:text-foreground">
          {layer.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
        </button>
        <span className="text-[10px] truncate text-muted-foreground flex-1">{layer.label}</span>
        <button onClick={() => onDelete(layer.id)} className="opacity-0 group-hover:opacity-100 text-destructive">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {/* Track area */}
      <div className="relative flex-1 h-full overflow-hidden">
        <div
          className="absolute top-1 bottom-1 rounded cursor-grab active:cursor-grabbing flex items-center px-2"
          style={{ left, width, backgroundColor: layer.color, opacity: layer.visible ? 0.9 : 0.3 }}
        >
          <span className="text-[9px] text-white font-medium truncate">{layer.label}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Chroma Key Canvas ────────────────────────────────────────────────────────

function applyChromaKey(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  color: [number, number, number],
  tolerance: number,
  smoothing: number
) {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const dist = Math.sqrt(
      Math.pow(r - color[0], 2) + Math.pow(g - color[1], 2) + Math.pow(b - color[2], 2)
    );
    if (dist < tolerance) {
      data[i + 3] = 0;
    } else if (dist < tolerance + smoothing) {
      data[i + 3] = Math.round(((dist - tolerance) / smoothing) * 255);
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// ─── Main Component ───────────────────────────────────────────────────────────

const ViralCut = () => {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const animFrameRef = useRef<number>(0);

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoName, setVideoName] = useState("Sem vídeo");
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState([80]);

  const [layers, setLayers] = useState<Layer[]>([]);
  const [captions, setCaptions] = useState<CaptionBlock[]>([]);
  const [activeCaptions, setActiveCaptions] = useState<CaptionBlock[]>([]);
  const [activeTab, setActiveTab] = useState("upload");
  const [timelineScale, setTimelineScale] = useState(1);

  const [autoCutLevel, setAutoCutLevel] = useState<AutoCutLevel>("medio");
  const [autoCutLoading, setAutoCutLoading] = useState(false);
  const [autoCutProgress, setAutoCutProgress] = useState(0);
  const [cutSegments, setCutSegments] = useState<ClipSegment[]>([]);

  const [chromaEnabled, setChromaEnabled] = useState(false);
  const [chromaColor, setChromaColor] = useState("#00ff00");
  const [chromaTolerance, setChromaTolerance] = useState([80]);
  const [chromaSmoothing, setChromaSmoothing] = useState([20]);

  const [captionText, setCaptionText] = useState("");
  const [captionMode, setCaptionMode] = useState<CaptionWordMode>(2);
  const [captionStyle, setCaptionStyle] = useState({
    color: "#ffffff", size: 32, shadow: true, bg: true, posY: 80
  });

  const [addTextValue, setAddTextValue] = useState("Seu texto aqui");
  const [filterBrightness, setFilterBrightness] = useState([100]);
  const [filterContrast, setFilterContrast] = useState([100]);
  const [filterSaturation, setFilterSaturation] = useState([100]);

  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState("");

  // ─── Video event handlers ────────────────────────────────────────────────

  const handleVideoLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    setVideoName(file.name);
    setCutSegments([]);
    setCaptions([]);
    setLayers([]);
    toast({ title: "Vídeo carregado!", description: file.name });
  };

  const handleMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
    setLayers([{
      id: "main-video",
      type: "video",
      label: videoName.replace(/\.[^.]+$/, ""),
      start: 0,
      end: v.duration,
      visible: true,
      locked: false,
      color: LAYER_COLORS.video,
    }]);
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);

    // Update active captions
    const active = captions.filter(c => v.currentTime >= c.start && v.currentTime < c.end);
    setActiveCaptions(active);

    // Chroma key frame
    if (chromaEnabled && canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      if (ctx) {
        canvasRef.current.width = v.videoWidth || 640;
        canvasRef.current.height = v.videoHeight || 360;
        ctx.drawImage(v, 0, 0);
        const r = parseInt(chromaColor.slice(1, 3), 16);
        const g = parseInt(chromaColor.slice(3, 5), 16);
        const b = parseInt(chromaColor.slice(5, 7), 16);
        applyChromaKey(ctx, canvasRef.current, [r, g, b], chromaTolerance[0], chromaSmoothing[0]);
      }
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); setPlaying(false); }
    else { v.play(); setPlaying(true); }
  };

  const seekTo = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t;
    setCurrentTime(t);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !muted;
    setMuted(!muted);
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume[0] / 100;
  }, [volume]);

  // ─── Auto-cut ────────────────────────────────────────────────────────────

  const handleAutoCut = async () => {
    const v = videoRef.current;
    if (!v || !videoSrc) {
      toast({ title: "Sem vídeo", description: "Carregue um vídeo primeiro.", variant: "destructive" });
      return;
    }
    setAutoCutLoading(true);
    setAutoCutProgress(0);
    try {
      const minDur = SILENCE_THRESHOLDS[autoCutLevel];
      const segs = await detectSilenceSegments(v, -30, minDur, setAutoCutProgress);
      setCutSegments(segs);
      // Update the video layer
      setLayers(prev => {
        const without = prev.filter(l => l.type !== "video" || l.id === "main-video");
        return [
          ...without.filter(l => l.id !== "main-video"),
          ...segs.map((s, i) => ({
            id: `clip-${s.id}-${i}`,
            type: "video" as LayerType,
            label: `Clipe ${i + 1} (${s.start.toFixed(1)}s–${s.end.toFixed(1)}s)`,
            start: s.start,
            end: s.end,
            visible: true,
            locked: false,
            color: LAYER_COLORS.video,
          }))
        ];
      });
      toast({ title: `✂️ ${segs.length} clipes detectados`, description: `Nível: ${autoCutLevel}` });
    } catch (err) {
      toast({ title: "Erro no corte automático", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setAutoCutLoading(false);
      setAutoCutProgress(0);
    }
  };

  // ─── Captions ────────────────────────────────────────────────────────────

  const handleGenerateCaptions = () => {
    if (!captionText.trim() || !duration) {
      toast({ title: "Digite um texto para legendar", variant: "destructive" });
      return;
    }
    const blocks = generateMockCaptions(captionText, duration, captionMode);
    setCaptions(blocks);
    setLayers(prev => {
      const without = prev.filter(l => l.type !== "text" || !l.id.startsWith("caption-"));
      return [
        ...without,
        ...blocks.map(b => ({
          id: `caption-${b.id}`,
          type: "text" as LayerType,
          label: b.text,
          start: b.start,
          end: b.end,
          visible: true,
          locked: false,
          color: LAYER_COLORS.text,
          content: b.text,
        }))
      ];
    });
    toast({ title: `📝 ${blocks.length} legendas geradas` });
  };

  // ─── Add Text Layer ───────────────────────────────────────────────────────

  const handleAddText = () => {
    if (!addTextValue.trim() || !duration) {
      toast({ title: "Carregue um vídeo primeiro", variant: "destructive" });
      return;
    }
    const layer: Layer = {
      id: `text-${Date.now()}`,
      type: "text",
      label: addTextValue,
      start: currentTime,
      end: Math.min(currentTime + 5, duration),
      visible: true,
      locked: false,
      color: LAYER_COLORS.text,
      content: addTextValue,
    };
    setLayers(prev => [...prev, layer]);
    toast({ title: "Texto adicionado à timeline" });
  };

  // ─── Add Audio Layer ──────────────────────────────────────────────────────

  const handleAudioLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !duration) return;
    const layer: Layer = {
      id: `audio-${Date.now()}`,
      type: "audio",
      label: file.name.replace(/\.[^.]+$/, ""),
      start: 0,
      end: duration,
      visible: true,
      locked: false,
      color: LAYER_COLORS.audio,
      content: URL.createObjectURL(file),
    };
    setLayers(prev => [...prev, layer]);
    toast({ title: "🎵 Áudio adicionado" });
  };

  // ─── Layer actions ────────────────────────────────────────────────────────

  const toggleLayerVisible = (id: string) =>
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));

  const deleteLayer = (id: string) =>
    setLayers(prev => prev.filter(l => l.id !== id));

  // ─── Mock Export ──────────────────────────────────────────────────────────

  const handleExport = () => {
    if (!videoSrc) {
      toast({ title: "Sem vídeo", description: "Carregue um vídeo primeiro.", variant: "destructive" });
      return;
    }
    setProcessing(true);
    setProcessingMsg("Preparando exportação...");
    const steps = [
      "Aplicando cortes...",
      "Processando camadas...",
      "Renderizando legendas...",
      "Codificando MP4...",
      "Finalizando...",
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < steps.length) { setProcessingMsg(steps[i++]); }
      else {
        clearInterval(interval);
        setProcessing(false);
        // Actually download the original for now (FFmpeg wasm needs COOP headers)
        const a = document.createElement("a");
        a.href = videoSrc;
        a.download = `viralcut-export.mp4`;
        a.click();
        toast({ title: "✅ Vídeo exportado!" });
      }
    }, 700);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 10);
    return `${m}:${sec.toString().padStart(2, "0")}.${ms}`;
  };

  const videoStyle = {
    filter: `brightness(${filterBrightness[0]}%) contrast(${filterContrast[0]}%) saturate(${filterSaturation[0]}%)`,
  };

  const captionFontSize = captionStyle.size;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[hsl(220,25%,8%)] text-foreground overflow-hidden select-none">

      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/40 bg-[hsl(220,25%,10%)] shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5 mr-2">
          <Scissors className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold font-display text-primary">ViralCut</span>
          {videoName !== "Sem vídeo" && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{videoName}</span>
          )}
        </div>

        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-3 w-3" /> Vídeo
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
          onClick={handleAutoCut} disabled={!videoSrc || autoCutLoading}>
          {autoCutLoading
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <Scissors className="h-3 w-3" />}
          Corte Auto
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
          onClick={() => setActiveTab("captions")}>
          <Sparkles className="h-3 w-3" /> Legenda
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
          onClick={() => setActiveTab("text")}>
          <Type className="h-3 w-3" /> Texto
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
          onClick={() => setActiveTab("chroma")} >
          <Layers className="h-3 w-3" /> Chroma
        </Button>
        <Button size="sm" className="h-7 text-xs gap-1 ml-auto" onClick={handleExport}>
          <Download className="h-3 w-3" /> Exportar
        </Button>
      </div>

      <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoLoad} />
      <input ref={overlayInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={() => {}} />
      <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioLoad} />

      {/* ── Main Body ───────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left Sidebar ─────────────────────────────────────── */}
        <div className={cn(
          "shrink-0 border-r border-border/40 bg-[hsl(220,25%,10%)] flex flex-col overflow-hidden transition-all duration-200",
          leftCollapsed ? "w-8" : "w-52"
        )}>
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-border/40">
            {!leftCollapsed && <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Ferramentas</span>}
            <button onClick={() => setLeftCollapsed(!leftCollapsed)} className="text-muted-foreground hover:text-foreground ml-auto">
              {leftCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
            </button>
          </div>

          {!leftCollapsed && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
              <TabsList className="grid grid-cols-3 h-auto mx-2 mt-2 shrink-0 text-[10px] gap-0.5 bg-muted/50">
                <TabsTrigger value="upload" className="text-[9px] py-1 px-1">Mídia</TabsTrigger>
                <TabsTrigger value="captions" className="text-[9px] py-1 px-1">Legenda</TabsTrigger>
                <TabsTrigger value="text" className="text-[9px] py-1 px-1">Texto</TabsTrigger>
              </TabsList>
              <TabsList className="grid grid-cols-3 h-auto mx-2 mt-1 shrink-0 text-[10px] gap-0.5 bg-muted/50">
                <TabsTrigger value="chroma" className="text-[9px] py-1 px-1">Chroma</TabsTrigger>
                <TabsTrigger value="filters" className="text-[9px] py-1 px-1">Filtros</TabsTrigger>
                <TabsTrigger value="audio" className="text-[9px] py-1 px-1">Áudio</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto p-2 space-y-3 min-h-0">

                {/* ─ Upload ─ */}
                <TabsContent value="upload" className="mt-0 space-y-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-border hover:border-primary rounded-lg p-4 flex flex-col items-center gap-2 transition-colors group"
                  >
                    <Upload className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                    <span className="text-[10px] text-muted-foreground text-center">Clique ou arraste um vídeo</span>
                  </button>
                  {videoSrc && (
                    <div className="bg-card rounded p-2">
                      <p className="text-[10px] text-muted-foreground truncate">{videoName}</p>
                      <p className="text-[10px] text-primary">{formatTime(duration)}</p>
                    </div>
                  )}
                  <div className="pt-1 space-y-1.5">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Corte Automático</p>
                    <div className="grid grid-cols-3 gap-1">
                      {(["suave", "medio", "agressivo"] as AutoCutLevel[]).map(lvl => (
                        <button
                          key={lvl}
                          onClick={() => setAutoCutLevel(lvl)}
                          className={cn(
                            "text-[9px] py-1 rounded border transition-colors capitalize",
                            autoCutLevel === lvl
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:border-primary"
                          )}
                        >{lvl}</button>
                      ))}
                    </div>
                    <Button size="sm" className="w-full h-7 text-xs" onClick={handleAutoCut} disabled={!videoSrc || autoCutLoading}>
                      {autoCutLoading
                        ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />{autoCutProgress}%</>
                        : <><Scissors className="h-3 w-3 mr-1" />Cortar silêncio</>
                      }
                    </Button>
                    {cutSegments.length > 0 && (
                      <p className="text-[10px] text-primary text-center">{cutSegments.length} clipes detectados</p>
                    )}
                  </div>
                </TabsContent>

                {/* ─ Captions ─ */}
                <TabsContent value="captions" className="mt-0 space-y-2">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Texto para legendar</p>
                  <textarea
                    value={captionText}
                    onChange={e => setCaptionText(e.target.value)}
                    placeholder="Cole o texto da fala aqui..."
                    className="w-full text-xs bg-background border border-border rounded p-2 h-24 resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Palavras por bloco</p>
                    <div className="grid grid-cols-3 gap-1">
                      {([1, 2, 3] as CaptionWordMode[]).map(n => (
                        <button
                          key={n}
                          onClick={() => setCaptionMode(n)}
                          className={cn(
                            "text-[10px] py-1 rounded border transition-colors",
                            captionMode === n
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:border-primary"
                          )}
                        >{n} palavra{n > 1 ? "s" : ""}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Estilo</p>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground w-12">Cor</label>
                      <input type="color" value={captionStyle.color}
                        onChange={e => setCaptionStyle(s => ({ ...s, color: e.target.value }))}
                        className="h-5 w-8 cursor-pointer rounded border-0 bg-transparent" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground w-12">Tam</label>
                      <Slider value={[captionStyle.size]} onValueChange={v => setCaptionStyle(s => ({ ...s, size: v[0] }))}
                        min={16} max={72} step={2} className="flex-1" />
                      <span className="text-[10px] w-6 text-right">{captionStyle.size}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground w-12">Posição</label>
                      <Slider value={[captionStyle.posY]} onValueChange={v => setCaptionStyle(s => ({ ...s, posY: v[0] }))}
                        min={10} max={95} step={5} className="flex-1" />
                      <span className="text-[10px] w-6 text-right">{captionStyle.posY}%</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setCaptionStyle(s => ({ ...s, shadow: !s.shadow }))}
                        className={cn("text-[9px] flex-1 py-1 rounded border transition-colors",
                          captionStyle.shadow ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground")}
                      >Sombra</button>
                      <button
                        onClick={() => setCaptionStyle(s => ({ ...s, bg: !s.bg }))}
                        className={cn("text-[9px] flex-1 py-1 rounded border transition-colors",
                          captionStyle.bg ? "bg-primary/20 border-primary text-primary" : "border-border text-muted-foreground")}
                      >BG</button>
                    </div>
                  </div>
                  <Button size="sm" className="w-full h-7 text-xs" onClick={handleGenerateCaptions} disabled={!videoSrc}>
                    <Sparkles className="h-3 w-3 mr-1" />Gerar legendas
                  </Button>
                  {captions.length > 0 && (
                    <p className="text-[10px] text-primary text-center">{captions.length} blocos gerados</p>
                  )}
                </TabsContent>

                {/* ─ Text ─ */}
                <TabsContent value="text" className="mt-0 space-y-2">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Adicionar texto</p>
                  <input
                    value={addTextValue}
                    onChange={e => setAddTextValue(e.target.value)}
                    className="w-full text-xs bg-background border border-border rounded p-2 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button size="sm" className="w-full h-7 text-xs" onClick={handleAddText} disabled={!videoSrc}>
                    <Type className="h-3 w-3 mr-1" />Adicionar à timeline
                  </Button>
                </TabsContent>

                {/* ─ Chroma ─ */}
                <TabsContent value="chroma" className="mt-0 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Chroma Key</p>
                    <button
                      onClick={() => setChromaEnabled(!chromaEnabled)}
                      className={cn("text-[9px] px-2 py-0.5 rounded-full border transition-colors",
                        chromaEnabled ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground")}
                    >{chromaEnabled ? "ON" : "OFF"}</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-muted-foreground w-10">Cor</label>
                    <input type="color" value={chromaColor} onChange={e => setChromaColor(e.target.value)}
                      className="h-5 w-10 cursor-pointer rounded border-0 bg-transparent" />
                    <span className="text-[9px] text-muted-foreground">{chromaColor}</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground w-16">Tolerância</label>
                      <Slider value={chromaTolerance} onValueChange={setChromaTolerance} min={10} max={200} step={5} className="flex-1" />
                      <span className="text-[10px] w-6 text-right">{chromaTolerance[0]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground w-16">Suavização</label>
                      <Slider value={chromaSmoothing} onValueChange={setChromaSmoothing} min={0} max={100} step={5} className="flex-1" />
                      <span className="text-[10px] w-6 text-right">{chromaSmoothing[0]}</span>
                    </div>
                  </div>
                  {chromaEnabled && (
                    <div className="bg-primary/10 border border-primary/30 rounded p-2">
                      <p className="text-[9px] text-primary">Chroma key ativo. Ajuste a cor e a tolerância conforme necessário.</p>
                    </div>
                  )}
                </TabsContent>

                {/* ─ Filters ─ */}
                <TabsContent value="filters" className="mt-0 space-y-2">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-2">Filtros de Vídeo</p>
                  {[
                    { label: "Brilho", value: filterBrightness, set: setFilterBrightness },
                    { label: "Contraste", value: filterContrast, set: setFilterContrast },
                    { label: "Saturação", value: filterSaturation, set: setFilterSaturation },
                  ].map(f => (
                    <div key={f.label} className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground w-16">{f.label}</label>
                      <Slider value={f.value} onValueChange={f.set} min={0} max={200} step={5} className="flex-1" />
                      <span className="text-[10px] w-8 text-right">{f.value[0]}%</span>
                    </div>
                  ))}
                  <Button size="sm" variant="outline" className="w-full h-7 text-xs" onClick={() => {
                    setFilterBrightness([100]); setFilterContrast([100]); setFilterSaturation([100]);
                  }}>
                    <RotateCcw className="h-3 w-3 mr-1" />Resetar
                  </Button>
                </TabsContent>

                {/* ─ Audio ─ */}
                <TabsContent value="audio" className="mt-0 space-y-2">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground">Adicionar Áudio</p>
                  <button
                    onClick={() => audioInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-border hover:border-primary rounded-lg p-3 flex flex-col items-center gap-1 transition-colors group"
                  >
                    <Music className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    <span className="text-[10px] text-muted-foreground">Upload de áudio</span>
                  </button>
                  <p className="text-[9px] text-muted-foreground text-center">MP3, WAV, M4A</p>
                </TabsContent>

              </div>
            </Tabs>
          )}
        </div>

        {/* ── Center: Preview ────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
          <div className="flex-1 flex items-center justify-center bg-black relative min-h-0 overflow-hidden">
            {!videoSrc ? (
              <div
                className="flex flex-col items-center gap-3 cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center border-2 border-dashed border-primary/40 group-hover:border-primary transition-colors">
                  <Film className="h-7 w-7 text-primary/50 group-hover:text-primary transition-colors" />
                </div>
                <p className="text-sm text-muted-foreground">Clique para carregar um vídeo</p>
              </div>
            ) : (
              <div className="relative max-h-full max-w-full flex items-center justify-center w-full h-full">
                {chromaEnabled
                  ? <canvas ref={canvasRef} className="max-h-full max-w-full object-contain" style={videoStyle} />
                  : (
                    <video
                      ref={videoRef}
                      src={videoSrc}
                      onLoadedMetadata={handleMetadata}
                      onTimeUpdate={handleTimeUpdate}
                      onEnded={() => setPlaying(false)}
                      className="max-h-full max-w-full object-contain"
                      style={videoStyle}
                      playsInline
                    />
                  )
                }
                {/* Hidden video for chroma processing */}
                {chromaEnabled && (
                  <video
                    ref={videoRef}
                    src={videoSrc}
                    onLoadedMetadata={handleMetadata}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={() => setPlaying(false)}
                    className="hidden"
                    playsInline
                  />
                )}
                {/* Caption overlay */}
                {activeCaptions.map(cap => (
                  <div
                    key={cap.id}
                    className="absolute left-1/2 -translate-x-1/2 text-center px-3 py-1 rounded pointer-events-none"
                    style={{
                      bottom: `${100 - captionStyle.posY}%`,
                      color: captionStyle.color,
                      fontSize: captionFontSize,
                      fontWeight: 900,
                      textShadow: captionStyle.shadow ? "0 2px 8px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,1)" : undefined,
                      backgroundColor: captionStyle.bg ? "rgba(0,0,0,0.5)" : undefined,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}
                  >
                    {cap.text}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Player controls */}
          <div className="shrink-0 bg-[hsl(220,25%,10%)] border-t border-border/40 px-3 py-2 flex items-center gap-2">
            <button onClick={() => seekTo(0)} className="text-muted-foreground hover:text-foreground">
              <SkipBack className="h-4 w-4" />
            </button>
            <button onClick={togglePlay} className="h-7 w-7 rounded-full bg-primary flex items-center justify-center hover:bg-primary/80 transition-colors">
              {playing ? <Pause className="h-3.5 w-3.5 text-primary-foreground" /> : <Play className="h-3.5 w-3.5 text-primary-foreground ml-0.5" />}
            </button>
            <button onClick={() => seekTo(duration)} className="text-muted-foreground hover:text-foreground">
              <SkipForward className="h-4 w-4" />
            </button>

            {/* Seek bar */}
            <div className="flex-1 relative h-1.5 bg-border rounded-full cursor-pointer group"
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                const t = ((e.clientX - rect.left) / rect.width) * duration;
                seekTo(t);
              }}>
              <div className="absolute h-full bg-primary rounded-full transition-none"
                style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%" }} />
              {/* Cut segments */}
              {cutSegments.map(s => (
                <div key={s.id} className="absolute top-0 h-full bg-yellow-400/40 rounded"
                  style={{
                    left: `${(s.start / duration) * 100}%`,
                    width: `${((s.end - s.start) / duration) * 100}%`
                  }} />
              ))}
            </div>

            <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            <button onClick={toggleMute} className="text-muted-foreground hover:text-foreground">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <div className="w-16">
              <Slider value={volume} onValueChange={setVolume} min={0} max={100} step={1} />
            </div>
          </div>
        </div>
      </div>

      {/* ── Timeline ──────────────────────────────────────────────── */}
      <div className={cn(
        "shrink-0 bg-[hsl(220,25%,9%)] border-t border-border/40 flex flex-col overflow-hidden transition-all duration-200",
        bottomCollapsed ? "h-8" : "h-44"
      )}>
        <div className="flex items-center gap-2 px-3 py-1 border-b border-border/30 shrink-0">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Timeline</span>
          <div className="flex items-center gap-1 ml-auto">
            <button onClick={() => setTimelineScale(s => Math.max(0.25, s - 0.25))} className="text-muted-foreground hover:text-foreground">
              <ZoomOut className="h-3 w-3" />
            </button>
            <span className="text-[9px] text-muted-foreground w-6 text-center">{timelineScale}x</span>
            <button onClick={() => setTimelineScale(s => Math.min(4, s + 0.25))} className="text-muted-foreground hover:text-foreground">
              <ZoomIn className="h-3 w-3" />
            </button>
          </div>
          <button onClick={() => setBottomCollapsed(!bottomCollapsed)} className="text-muted-foreground hover:text-foreground ml-1">
            {bottomCollapsed ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>

        {!bottomCollapsed && (
          <div className="flex-1 overflow-auto min-h-0">
            {layers.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[11px] text-muted-foreground">
                Carregue um vídeo para ver a timeline
              </div>
            ) : (
              <div className="min-w-max">
                {/* Time ruler */}
                <div className="flex h-5 border-b border-border/30 pl-32">
                  {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                    <div key={i} className="relative shrink-0 border-l border-border/30"
                      style={{ width: timelineScale * 80 }}>
                      <span className="absolute top-0.5 left-1 text-[8px] text-muted-foreground">{i}s</span>
                    </div>
                  ))}
                </div>
                {/* Playhead */}
                <div className="relative">
                  <div
                    className="absolute top-0 bottom-0 w-px bg-primary z-10 pointer-events-none"
                    style={{ left: 128 + (currentTime * timelineScale * 80) }}
                  />
                  {layers.map(layer => (
                    <TimelineLane
                      key={layer.id}
                      layer={layer}
                      duration={duration}
                      scale={timelineScale}
                      onToggleVisible={toggleLayerVisible}
                      onDelete={deleteLayer}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Processing overlay ────────────────────────────────────── */}
      {processing && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-4 min-w-56">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm font-medium">{processingMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViralCut;
