import { useState, useRef } from "react";
import { X, Download, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useProjectStore } from "../stores/project-store";
import { useMediaStore } from "../stores/media-store";
import type { ExportQuality, ExportFormat } from "../types/export";
import { QUALITY_HEIGHTS, DEFAULT_EXPORT_OPTIONS } from "../types/export";

type ExportStatus = "idle" | "exporting" | "done" | "error";

export function ExportModal({ onClose }: { onClose: () => void }) {
  const [quality, setQuality] = useState<ExportQuality>(DEFAULT_EXPORT_OPTIONS.quality);
  const [format, setFormat] = useState<ExportFormat>(DEFAULT_EXPORT_OPTIONS.format);
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const projects = useProjectStore((s) => s.projects);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  );
  const getAsset = useMediaStore((s) => s.getAsset);

  const handleExport = async () => {
    if (!activeProject) return;
    setStatus("exporting");
    setProgress(0);
    setErrorMsg("");

    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    try {
      const tracks = activeProject.tracks;
      const { canvasSize } = activeProject.settings;
      const targetH = QUALITY_HEIGHTS[quality];
      const scale = targetH / canvasSize.height;
      const outW = Math.round(canvasSize.width * scale);
      const outH = targetH;

      // Find total duration
      let duration = 0;
      for (const track of tracks) {
        for (const el of track.elements as any[]) {
          const end = el.startTime + el.duration - el.trimStart - el.trimEnd;
          if (end > duration) duration = end;
        }
      }

      if (duration === 0) {
        setErrorMsg("Projeto vazio — adicione mídia à timeline.");
        setStatus("error");
        return;
      }

      // Build canvas + encoder
      const canvas = new OffscreenCanvas(outW, outH);
      const ctx = canvas.getContext("2d")!;
      const fps = activeProject.settings.fps ?? 30;
      const totalFrames = Math.ceil(duration * fps);

      // Check WebCodecs support
      if (!("VideoEncoder" in window)) {
        setErrorMsg("Seu navegador não suporta exportação avançada. Use Chrome 94+ ou Edge.");
        setStatus("error");
        return;
      }

      // We'll use a simpler approach: render frames to a MediaRecorder via a visible canvas
      const liveCanvas = document.createElement("canvas");
      liveCanvas.width = outW;
      liveCanvas.height = outH;
      const liveCtx = liveCanvas.getContext("2d")!;

      const stream = liveCanvas.captureStream(fps);
      const mimeType = format === "mp4" ? "video/mp4" : "video/webm;codecs=vp9";
      const supportedMime = MediaRecorder.isTypeSupported(mimeType)
        ? mimeType
        : MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";

      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: supportedMime,
        videoBitsPerSecond: quality === "1080p" ? 8_000_000 : quality === "720p" ? 4_000_000 : 2_000_000,
      });

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      const videoElements = new Map<string, HTMLVideoElement>();

      // Preload videos
      for (const track of tracks) {
        for (const el of track.elements as any[]) {
          if (el.type === "video") {
            const asset = getAsset(el.mediaId);
            if (asset && !videoElements.has(el.mediaId)) {
              const video = document.createElement("video");
              video.src = asset.url;
              video.preload = "auto";
              video.muted = true;
              videoElements.set(el.mediaId, video);
              await new Promise<void>((r) => { video.onloadeddata = () => r(); video.load(); setTimeout(r, 2000); });
            }
          }
        }
      }

      recorder.start(100);

      // Render frames
      for (let frame = 0; frame < totalFrames; frame++) {
        if (signal.aborted) {
          recorder.stop();
          setStatus("idle");
          return;
        }

        const t = frame / fps;
        setProgress(Math.round((frame / totalFrames) * 100));

        liveCtx.fillStyle = "#000000";
        liveCtx.fillRect(0, 0, outW, outH);

        for (const track of [...tracks].reverse()) {
          if ((track as any).hidden) continue;
          for (const el of track.elements as any[]) {
            const elStart = el.startTime;
            const elEnd = el.startTime + el.duration - el.trimStart - el.trimEnd;
            if (t < elStart || t >= elEnd) continue;
            const localTime = t - elStart + el.trimStart;

            if (el.type === "video") {
              const video = videoElements.get(el.mediaId);
              if (!video) continue;
              if (Math.abs(video.currentTime - localTime) > 0.1) {
                video.currentTime = localTime;
                await new Promise<void>((r) => { video.onseeked = () => r(); setTimeout(r, 100); });
              }
              const { x, y, w, h } = containFit(video.videoWidth, video.videoHeight, outW, outH);
              liveCtx.drawImage(video, x, y, w, h);

            } else if (el.type === "image") {
              const asset = getAsset(el.mediaId);
              if (!asset) continue;
              const img = await loadImage(asset.url);
              const { x, y, w, h } = containFit(img.naturalWidth, img.naturalHeight, outW, outH);
              liveCtx.drawImage(img, x, y, w, h);

            } else if (el.type === "text") {
              liveCtx.save();
              const fontSize = (el.fontSize ?? 48) * (outH / canvasSize.height);
              liveCtx.font = `${el.fontStyle ?? "normal"} ${el.fontWeight ?? "normal"} ${fontSize}px ${el.fontFamily ?? "Inter, sans-serif"}`;
              liveCtx.fillStyle = el.color ?? "#ffffff";
              liveCtx.textAlign = el.textAlign ?? "center";
              liveCtx.textBaseline = "middle";
              const tx = (el.transform?.x ?? 0.5) * outW;
              const ty = (el.transform?.y ?? 0.8) * outH;
              if (el.background?.enabled) {
                const m = liveCtx.measureText(el.content);
                const px = 16, py = 8;
                liveCtx.fillStyle = el.background.color ?? "rgba(0,0,0,0.5)";
                liveCtx.fillRect(tx - m.width / 2 - px, ty - fontSize / 2 - py, m.width + px * 2, fontSize + py * 2);
                liveCtx.fillStyle = el.color ?? "#ffffff";
              }
              liveCtx.fillText(el.content, tx, ty);
              liveCtx.restore();
            }
          }
        }

        // Copy from liveCanvas to offscreen (triggers captureStream)
        await new Promise((r) => setTimeout(r, 1000 / fps));
      }

      await new Promise<void>((r) => { recorder.onstop = () => r(); recorder.stop(); });
      setProgress(100);

      const ext = supportedMime.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunks, { type: supportedMime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeProject.name}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);

      setStatus("done");
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message ?? "Erro desconhecido ao exportar");
      setStatus("error");
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setStatus("idle");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="font-display font-bold text-lg">Exportar vídeo</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} disabled={status === "exporting"}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-5">
          {status === "idle" && (
            <>
              {/* Quality */}
              <div>
                <label className="text-sm font-medium mb-2 block">Qualidade</label>
                <RadioGroup value={quality} onValueChange={(v) => setQuality(v as ExportQuality)} className="grid grid-cols-2 gap-2">
                  {(["360p", "480p", "720p", "1080p"] as ExportQuality[]).map((q) => (
                    <div key={q} className="flex items-center space-x-2">
                      <RadioGroupItem value={q} id={`q-${q}`} />
                      <Label htmlFor={`q-${q}`} className="cursor-pointer">{q}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Format */}
              <div>
                <label className="text-sm font-medium mb-2 block">Formato</label>
                <RadioGroup value={format} onValueChange={(v) => setFormat(v as ExportFormat)} className="flex gap-4">
                  {(["mp4", "webm"] as ExportFormat[]).map((f) => (
                    <div key={f} className="flex items-center space-x-2">
                      <RadioGroupItem value={f} id={`f-${f}`} />
                      <Label htmlFor={`f-${f}`} className="cursor-pointer uppercase">{f}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="text-xs text-muted-foreground bg-muted rounded-lg p-3">
                Saída: {activeProject?.settings.canvasSize.width}×{activeProject?.settings.canvasSize.height} → {QUALITY_HEIGHTS[quality]}p
                {" "}({activeProject?.settings.fps}fps)
              </div>
            </>
          )}

          {status === "exporting" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Renderizando frames...
              </div>
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-center text-muted-foreground">{progress}%</p>
            </div>
          )}

          {status === "done" && (
            <div className="flex flex-col items-center gap-2 py-4">
              <CheckCircle className="h-10 w-10 text-green-500" />
              <p className="font-medium">Exportação concluída!</p>
              <p className="text-xs text-muted-foreground">O arquivo foi baixado automaticamente.</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-2 py-2">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <p className="font-medium text-sm">Erro ao exportar</p>
              <p className="text-xs text-muted-foreground text-center">{errorMsg}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          {status === "exporting" ? (
            <Button variant="outline" onClick={handleCancel}>Cancelar</Button>
          ) : status === "done" ? (
            <Button onClick={onClose}>Fechar</Button>
          ) : status === "error" ? (
            <>
              <Button variant="outline" onClick={() => setStatus("idle")}>Tentar novamente</Button>
              <Button variant="ghost" onClick={onClose}>Fechar</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Cancelar</Button>
              <Button onClick={handleExport} className="gap-2 gradient-viral text-white border-0">
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Helpers
function containFit(srcW: number, srcH: number, dstW: number, dstH: number) {
  if (!srcW || !srcH) return { x: 0, y: 0, w: dstW, h: dstH };
  const scale = Math.min(dstW / srcW, dstH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { x: (dstW - w) / 2, y: (dstH - h) / 2, w, h };
}

const imgCache = new Map<string, HTMLImageElement>();
function loadImage(src: string): Promise<HTMLImageElement> {
  if (imgCache.has(src)) return Promise.resolve(imgCache.get(src)!);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => { imgCache.set(src, img); resolve(img); };
    img.onerror = reject;
    img.src = src;
  });
}
