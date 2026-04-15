// ============================================================
// VoiceRecorder – Gravar narração sincronizada com a timeline
// ============================================================
import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Square, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface VoiceRecorderProps {
  currentTime: number;
  onSetPlaying: (playing: boolean) => void;
  onClose: () => void;
  onAddRecording: (file: File, startTime: number, duration: number) => void;
}

type RecordState = 'idle' | 'recording' | 'done';

function getBestMimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
}

function getExtension(mimeType: string): string {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4')) return 'm4a';
  return 'webm';
}

function fmtTime(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const d = Math.floor((secs % 1) * 10);
  return `${m}:${String(s).padStart(2, '0')}.${d}`;
}

export function VoiceRecorder({ currentTime, onSetPlaying, onClose, onAddRecording }: VoiceRecorderProps) {
  const [recState, setRecState] = useState<RecordState>('idle');
  const [elapsed, setElapsed]   = useState(0);
  const [error, setError]       = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [recFile, setRecFile]   = useState<File | null>(null);
  const [recDuration, setRecDuration] = useState(0);

  const recorderRef   = useRef<MediaRecorder | null>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const chunksRef     = useRef<BlobPart[]>([]);
  const startTimeRef  = useRef(0);   // timeline position when recording started
  const wallStartRef  = useRef(0);   // Date.now() when recording started
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewUrlRef = useRef<string | null>(null); // mirrors previewUrl for cleanup

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      stopStream();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, [stopTimer, stopStream]);

  const handleRecord = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getBestMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      recorder.onstop = () => {
        const duration = (Date.now() - wallStartRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        const ext  = getExtension(mimeType);
        const file = new File([blob], `narração-${Date.now()}.${ext}`, { type: mimeType || 'audio/webm' });
        const url  = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setRecFile(file);
        setRecDuration(duration);
        setPreviewUrl(url);
        setRecState('done');
        stopStream();
      };

      startTimeRef.current = currentTime;
      wallStartRef.current = Date.now();

      recorder.start(100);
      setRecState('recording');
      onSetPlaying(true);

      timerRef.current = setInterval(() => {
        setElapsed((Date.now() - wallStartRef.current) / 1000);
      }, 100);
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Permissão de microfone negada. Verifique as configurações do navegador.'
        : (err?.message ?? 'Não foi possível acessar o microfone');
      setError(msg);
      stopStream();
    }
  }, [currentTime, onSetPlaying, stopStream]);

  const handleStop = useCallback(() => {
    stopTimer();
    onSetPlaying(false);
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, [stopTimer, onSetPlaying]);

  const handleDiscard = useCallback(() => {
    if (previewUrlRef.current) { URL.revokeObjectURL(previewUrlRef.current); previewUrlRef.current = null; }
    setPreviewUrl(null);
    setRecFile(null);
    setRecDuration(0);
    setElapsed(0);
    setRecState('idle');
  }, []);

  const handleConfirm = useCallback(() => {
    if (!recFile) return;
    onAddRecording(recFile, startTimeRef.current, recDuration);
    // don't revoke — parent now owns the file
    previewUrlRef.current = null;
    onClose();
  }, [recFile, recDuration, onAddRecording, onClose]);

  return (
    <div className="flex flex-col h-full bg-card/30 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
        <Mic className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">Gravar Narração</span>
        <button className="ml-auto text-muted-foreground hover:text-foreground text-xs" onClick={onClose}>✕</button>
      </div>

      <div className="p-3 space-y-3">
        {/* ── IDLE ── */}
        {recState === 'idle' && (
          <>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Posicione o playhead onde deseja iniciar. O vídeo será reproduzido automaticamente durante a gravação.
            </p>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive flex items-start gap-1.5">
                <MicOff className="h-3 w-3 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex flex-col items-center gap-3 py-6">
              <button
                onClick={handleRecord}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-red-500/30"
              >
                <Mic className="h-6 w-6 text-white" />
              </button>
              <span className="text-[11px] text-muted-foreground">Pressione para gravar</span>
            </div>
          </>
        )}

        {/* ── RECORDING ── */}
        {recState === 'recording' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="relative flex items-center justify-center">
              <div className="absolute w-20 h-20 rounded-full bg-red-500/20 animate-ping" />
              <button
                onClick={handleStop}
                className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-400 active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-red-500/40 z-10"
              >
                <Square className="h-5 w-5 text-white fill-white" />
              </button>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm font-semibold text-foreground font-mono tabular-nums">
                  {fmtTime(elapsed)}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">Gravando… pressione para parar</span>
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {recState === 'done' && recFile && (
          <>
            <div className="rounded-lg bg-muted/50 border border-border px-3 py-2 text-center">
              <p className="text-xs font-semibold text-foreground">Gravação concluída</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{fmtTime(recDuration)}</p>
            </div>

            {previewUrl && (
              <div className="rounded-lg bg-muted/30 border border-border px-2 py-2">
                <p className="text-[10px] text-muted-foreground mb-1.5 px-1">Ouça antes de confirmar</p>
                <audio controls src={previewUrl} className="w-full" style={{ height: 36 }} />
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={handleDiscard} className="flex-1 gap-1.5">
                <Trash2 className="h-3 w-3" />
                Descartar
              </Button>
              <Button size="sm" onClick={handleConfirm} className="flex-1 gap-1.5 gradient-viral text-white border-0">
                <Check className="h-3 w-3" />
                Usar
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
