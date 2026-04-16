import { useState, useEffect, useMemo } from 'react';
import { X, Captions, Loader2, AlertCircle, CheckCircle2, Video, Music, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSubtitleGeneration, SubtitleSegment, SubtitleStyle } from '@/viralcut/hooks/useSubtitleGeneration';
import type { Track, TrackItem, MediaFile } from '@/viralcut/types';

/** Resultado de transcrição por arquivo de mídia */
export interface TranscriptionResult {
  segments: SubtitleSegment[];
  mediaId: string;
  isWordLevel: boolean;
}

interface SubtitleModalProps {
  tracks: Track[];
  media: MediaFile[];
  userId: string;
  onGenerate: (
    transcriptions: TranscriptionResult[],
    sourceTrackIds: string[],
    style: SubtitleStyle,
    maxWords: number,
  ) => void;
  onClose: () => void;
}

/** Trilha com áudio disponível para legendas */
interface AudioSource {
  trackId: string;
  label: string;
  type: 'video' | 'audio';
  items: TrackItem[];
  /** Arquivos de mídia únicos referenciados pelos items */
  mediaFiles: Array<{ mediaId: string; file: MediaFile }>;
  /** Duração total na timeline (soma de todos os clips) */
  totalDuration: number;
}

const STYLE_OPTIONS: { id: SubtitleStyle; label: string; preview: React.CSSProperties }[] = [
  { id: 'classic',   label: 'Clássico',    preview: { color: '#ffffff', background: 'rgba(0,0,0,0.75)',     fontFamily: 'Inter, sans-serif' } },
  { id: 'minimal',   label: 'Minimal',     preview: { color: '#ffffff', background: '#111',               fontFamily: 'Inter, sans-serif', textShadow: '0 0 6px #000, 1px 1px 3px #000' } },
  { id: 'viral',     label: 'Viral',       preview: { color: '#facc15', background: 'rgba(0,0,0,0.82)',     fontFamily: 'Inter, sans-serif' } },
  { id: 'bold',      label: 'Bold',        preview: { color: '#ffffff', background: '#222',               fontFamily: '"Anton", Impact, sans-serif', textShadow: '1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000' } },
  { id: 'neon',      label: 'Neon',        preview: { color: '#00f5ff', background: '#111',               fontFamily: 'Inter, sans-serif', textShadow: '0 0 8px #00f5ff, 0 0 14px #00f5ff' } },
  { id: 'cinema',    label: 'Cinema',      preview: { color: '#ffffff', background: 'rgba(0,0,0,0.75)',   fontFamily: 'Georgia, serif' } },
  { id: 'karaoke',   label: 'Karaoke',     preview: { color: '#ffffff', background: 'rgba(234,179,8,0.9)', fontFamily: '"Bebas Neue", sans-serif' } },
  { id: 'fire',      label: 'Fire',        preview: { color: '#ffffff', background: 'rgba(220,38,38,0.88)', fontFamily: '"Oswald", sans-serif' } },
  { id: 'american',  label: 'American',    preview: { color: '#ffffff', background: '#222',               fontFamily: '"Anton", Impact, sans-serif', textShadow: '1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000', letterSpacing: '1px' } },
  { id: 'outline',   label: 'Outline',     preview: { color: '#ffffff', background: '#222',               fontFamily: '"Montserrat", sans-serif', textShadow: '1px 1px 0 #000,-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000' } },
  { id: 'highlight', label: 'Highlight',   preview: { color: '#000000', background: '#FFE500',              fontFamily: 'Inter, sans-serif', fontWeight: 'bold' } },
  { id: 'elegant',   label: 'Elegante',    preview: { color: '#f5f0e8', background: '#1a1218',             fontFamily: '"Playfair Display", Georgia, serif', textShadow: '1px 1px 4px rgba(0,0,0,0.8)' } },
  { id: 'sport',     label: 'Sport',       preview: { color: '#ffffff', background: 'rgba(255,107,0,0.9)', fontFamily: '"Oswald", sans-serif', letterSpacing: '1px' } },
  { id: 'pop',       label: 'Pop',         preview: { color: '#ffffff', background: 'rgba(220,0,120,0.9)', fontFamily: '"Bangers", cursive', letterSpacing: '2px' } },
  { id: 'cream',     label: 'Cream',       preview: { color: '#1a1a1a', background: 'rgba(255,248,220,0.95)', fontFamily: '"Montserrat", sans-serif', fontWeight: 'bold' } },
  { id: 'horror',    label: 'Horror',      preview: { color: '#cc0000', background: 'rgba(0,0,0,0.88)',    fontFamily: '"Oswald", sans-serif', textShadow: '0 0 8px #cc0000' } },
];

const LANGUAGES = [
  { code: 'pt', label: 'Português (BR)' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
];

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function SubtitleModal({ tracks, media, userId, onGenerate, onClose }: SubtitleModalProps) {
  const { generating, statusLabel, generate, getMonthlyUsed, MONTHLY_LIMIT_SECONDS } = useSubtitleGeneration();
  const [style, setStyle] = useState<SubtitleStyle>('classic');
  const [language, setLanguage] = useState('pt');
  const [maxWords, setMaxWords] = useState(3);
  const [error, setError] = useState('');
  const [monthlyUsed, setMonthlyUsed] = useState(0);
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressLabel, setProgressLabel] = useState('');

  // Montar lista de trilhas que contêm áudio (vídeo ou áudio)
  const audioSources = useMemo(() => {
    const sources: AudioSource[] = [];
    let videoIdx = 0;
    let audioIdx = 0;
    for (const track of tracks) {
      if (track.muted || track.items.length === 0) continue;
      if (track.type !== 'video' && track.type !== 'audio') continue;

      // Coletar todos os items e seus arquivos de mídia únicos
      const seenMediaIds = new Set<string>();
      const mediaFiles: Array<{ mediaId: string; file: MediaFile }> = [];

      for (const item of track.items) {
        if (!item.mediaId || seenMediaIds.has(item.mediaId)) continue;
        const mf = media.find((m) => m.id === item.mediaId);
        if (!mf) continue;
        seenMediaIds.add(item.mediaId);
        mediaFiles.push({ mediaId: item.mediaId, file: mf });
      }

      if (mediaFiles.length === 0) continue;

      // Duração total na timeline
      const totalDuration = track.items.reduce((sum, it) => sum + (it.endTime - it.startTime), 0);
      if (totalDuration <= 0) continue;

      let label: string;
      if (track.type === 'video') {
        videoIdx++;
        label = videoIdx === 1 ? 'Vídeo principal' : `Vídeo camada ${videoIdx}`;
      } else {
        audioIdx++;
        if (track.items.length === 1) {
          const name = mediaFiles[0].file.name.replace(/\.[^.]+$/, '');
          label = name.startsWith('narração') ? 'Narração' : name || `Áudio ${audioIdx}`;
        } else {
          label = `Áudio (${track.items.length} clips)`;
        }
      }

      sources.push({ trackId: track.id, label, type: track.type, items: track.items, mediaFiles, totalDuration });
    }
    return sources;
  }, [tracks, media]);

  // Auto-selecionar primeira trilha
  useEffect(() => {
    if (audioSources.length > 0 && selectedTrackIds.size === 0) {
      setSelectedTrackIds(new Set([audioSources[0].trackId]));
    }
  }, [audioSources]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTrack = (trackId: string) => {
    setSelectedTrackIds((prev) => {
      const next = new Set(prev);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  };

  // Duração total das faixas selecionadas
  const totalDuration = audioSources
    .filter((s) => selectedTrackIds.has(s.trackId))
    .reduce((sum, s) => sum + s.totalDuration, 0);

  // Contagem total de clips selecionados
  const totalClips = audioSources
    .filter((s) => selectedTrackIds.has(s.trackId))
    .reduce((sum, s) => sum + s.items.length, 0);

  const remainingSec = MONTHLY_LIMIT_SECONDS - monthlyUsed;
  const remainingMin = Math.floor(remainingSec / 60);
  const usedMin = Math.floor(monthlyUsed / 60);
  const limitMin = MONTHLY_LIMIT_SECONDS / 60;
  const usagePercent = Math.min(100, (monthlyUsed / MONTHLY_LIMIT_SECONDS) * 100);

  useEffect(() => {
    if (userId) getMonthlyUsed(userId).then(setMonthlyUsed);
  }, [userId, getMonthlyUsed]);

  const handleGenerate = async () => {
    if (selectedTrackIds.size === 0) return;
    setError('');
    setIsProcessing(true);

    try {
      // Coletar todos os arquivos de mídia únicos das faixas selecionadas
      const selectedSources = audioSources.filter((s) => selectedTrackIds.has(s.trackId));
      const uniqueMedia = new Map<string, MediaFile>();
      for (const src of selectedSources) {
        for (const { mediaId, file } of src.mediaFiles) {
          if (!uniqueMedia.has(mediaId)) uniqueMedia.set(mediaId, file);
        }
      }

      const mediaEntries = Array.from(uniqueMedia.entries());
      const allTranscriptions: TranscriptionResult[] = [];

      for (let i = 0; i < mediaEntries.length; i++) {
        const [mediaId, mf] = mediaEntries[i];
        if (mediaEntries.length > 1) {
          setProgressLabel(`Transcrevendo ${i + 1}/${mediaEntries.length}...`);
        }

        const result = await generate({
          videoFile: mf.file,
          clipDurationSec: mf.duration,
          language,
          userId,
        });

        if (result.error) {
          setError(result.error);
          return;
        }

        allTranscriptions.push({ segments: result.segments, mediaId, isWordLevel: result.isWordLevel });
      }

      onGenerate(allTranscriptions, Array.from(selectedTrackIds), style, maxWords);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Erro desconhecido');
    } finally {
      setIsProcessing(false);
      setProgressLabel('');
    }
  };

  const isWorking = isProcessing || generating;
  const canGenerate = selectedTrackIds.size > 0 && !isWorking && totalDuration > 0 && totalDuration <= remainingSec;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm pointer-events-auto" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Captions className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">Legendas Automáticas</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Fonte de áudio */}
          {audioSources.length === 0 ? (
            <div className="bg-muted rounded-xl p-3">
              <p className="text-xs text-muted-foreground">
                Nenhum vídeo ou narração na timeline. Importe um vídeo ou grave uma narração primeiro.
              </p>
            </div>
          ) : audioSources.length === 1 ? (
            /* Só uma trilha — mostrar info sem seletor */
            <div className="bg-muted rounded-xl p-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                  {audioSources[0].type === 'video' ? (
                    <Video className="w-3 h-3 text-muted-foreground shrink-0" />
                  ) : (
                    <Music className="w-3 h-3 text-muted-foreground shrink-0" />
                  )}
                  <span className="text-muted-foreground truncate">{audioSources[0].label}</span>
                  {audioSources[0].items.length > 1 && (
                    <span className="text-muted-foreground/60 shrink-0">
                      ({audioSources[0].items.length} clips)
                    </span>
                  )}
                </div>
                <span className="text-foreground font-medium ml-2 shrink-0">
                  {fmtDuration(audioSources[0].totalDuration)} min
                </span>
              </div>
            </div>
          ) : (
            /* Múltiplas trilhas — seletor com checkboxes */
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                Fontes de áudio ({selectedTrackIds.size} selecionada{selectedTrackIds.size !== 1 ? 's' : ''})
              </label>
              <div className="space-y-1.5">
                {audioSources.map((src) => {
                  const isChecked = selectedTrackIds.has(src.trackId);
                  return (
                    <button
                      key={src.trackId}
                      onClick={() => toggleTrack(src.trackId)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs transition-all ${
                        isChecked
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-muted text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      {src.type === 'video' ? (
                        <Video className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <Music className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <div className="flex-1 text-left truncate">
                        <span className="truncate">{src.label}</span>
                        {src.items.length > 1 && (
                          <span className="text-muted-foreground/60 ml-1">({src.items.length} clips)</span>
                        )}
                      </div>
                      <span className="shrink-0 font-medium">{fmtDuration(src.totalDuration)}</span>
                    </button>
                  );
                })}
              </div>
              {selectedTrackIds.size > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Total: {fmtDuration(totalDuration)} min · {totalClips} clip{totalClips !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {/* Uso mensal */}
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Uso mensal</span>
              <span className={remainingMin < 10 ? 'text-orange-400' : 'text-foreground'}>
                {usedMin}/{limitMin} min usados
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${usagePercent}%`,
                  background: usagePercent > 80 ? '#f97316' : 'hsl(var(--primary))',
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{remainingMin} minutos restantes este mês</p>
          </div>

          {/* Idioma */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Idioma do áudio</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>

          {/* Palavras por legenda */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Palavras por legenda</label>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setMaxWords(n)}
                  className={`py-2 rounded-xl border text-xs font-medium transition-all ${
                    maxWords === n
                      ? 'border-primary bg-primary/10 text-foreground'
                      : 'border-border bg-muted text-muted-foreground hover:border-primary/50'
                  }`}
                >
                  {n} {n === 1 ? 'palavra' : 'palavras'}
                </button>
              ))}
            </div>
          </div>

          {/* Estilo */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">Estilo da legenda</label>
            <div className="grid grid-cols-2 gap-2">
              {STYLE_OPTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyle(s.id)}
                  className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all ${
                    style === s.id ? 'border-primary bg-primary/10' : 'border-border bg-muted hover:border-primary/50'
                  }`}
                >
                  <div
                    className="w-full h-8 rounded-lg flex items-center justify-center"
                    style={{ background: (s.preview.background as string) || '#111' }}
                  >
                    <span
                      className="text-xs font-bold px-1.5"
                      style={{ ...s.preview, background: undefined, fontSize: '12px' }}
                    >
                      Exemplo
                    </span>
                  </div>
                  <span className={`text-xs font-medium ${style === s.id ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {s.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* Status de geração */}
          {isWorking && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{progressLabel || statusLabel || 'Processando...'}</span>
            </div>
          )}

          {/* Aviso de duração excede limite */}
          {totalDuration > 0 && totalDuration > remainingSec && (
            <div className="flex items-start gap-2 bg-orange-500/10 border border-orange-500/30 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
              <p className="text-xs text-orange-400">
                A duração total ({Math.ceil(totalDuration / 60)} min) excede seu limite restante ({remainingMin} min).
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3 flex gap-2 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <Button onClick={handleGenerate} disabled={!canGenerate} className="flex-1 gap-1.5 gradient-viral text-white border-0 h-10">
            {isWorking ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Gerando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" /> Gerar Legendas
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
