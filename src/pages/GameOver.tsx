import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap, ExternalLink, Loader2, Eye, ThumbsUp,
  MessageCircle, Clock, Calendar, Brain, Map,
  Anchor, Flame, BarChart2, HelpCircle, Copy,
  FileText, Play, AlertCircle, CheckCircle2,
  ChevronRight, Sparkles,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────
interface VideoInfo {
  id: string; title: string; channel: string; thumbnail: string;
  views: string; likes: string; comments: string; publishedAt: string;
  duration: string; url: string;
}
interface MapItem { inicio: string; fim: string; nome: string; descricao: string; }
interface StructureItem { numero: number; nome: string; explicacao: string; }
interface PsychoItem { gatilho: string; explicacao: string; }
interface ScriptItem { cena: number; nome: string; texto: string; }
interface Analysis {
  resumo: string;
  mapa_viralizacao: MapItem[];
  gancho: { tipo: string; descricao: string };
  psicologia: PsychoItem[];
  estrutura: StructureItem[];
  por_que_viralizou: string;
  como_copiar: { recriar_formato: string; adaptar_nicho: string; conteudo_venda: string; conteudo_educacional: string; };
  roteiro: ScriptItem[];
}

// ─── Section Wrapper ──────────────────────────────────────────
const Section = ({
  icon, title, badge, color = "primary", children
}: {
  icon: React.ReactNode; title: string; badge?: string;
  color?: string; children: React.ReactNode;
}) => (
  <Card className="overflow-hidden border-border/50">
    <div className={`h-1 bg-gradient-to-r ${
      color === "primary" ? "from-primary to-primary/50" :
      color === "pink"    ? "from-pink-500 to-pink-400/50" :
      color === "purple"  ? "from-purple-500 to-purple-400/50" :
      color === "amber"   ? "from-amber-500 to-amber-400/50" :
      color === "green"   ? "from-green-500 to-green-400/50" :
      color === "blue"    ? "from-blue-500 to-blue-400/50" :
      color === "red"     ? "from-red-500 to-red-400/50" :
      color === "teal"    ? "from-teal-500 to-teal-400/50" :
      color === "orange"  ? "from-orange-500 to-orange-400/50" :
      "from-primary to-primary/50"
    }`} />
    <CardContent className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <h2 className="font-bold font-display text-base">{title}</h2>
        {badge && <Badge variant="secondary" className="text-xs ml-auto">{badge}</Badge>}
      </div>
      {children}
    </CardContent>
  </Card>
);

// ─── Skeleton Loader ──────────────────────────────────────────
const AnalysisSkeleton = () => (
  <div className="space-y-4">
    {Array.from({ length: 5 }).map((_, i) => (
      <Card key={i} className="overflow-hidden">
        <div className="h-1 bg-muted animate-pulse" />
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </CardContent>
      </Card>
    ))}
  </div>
);

// ─── Main Component ───────────────────────────────────────────
const GameOver = () => {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [video, setVideo] = useState<VideoInfo | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [hasTranscript, setHasTranscript] = useState(false);
  const [activeVersion, setActiveVersion] = useState<string | null>(null);
  const [versionText, setVersionText] = useState("");
  const [loadingVersion, setLoadingVersion] = useState(false);

  const handleAnalyze = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setVideo(null);
    setAnalysis(null);
    setActiveVersion(null);
    setVersionText("");

    try {
      const { data, error } = await supabase.functions.invoke("analyze-viral-video", {
        body: { videoUrl: url.trim() },
      });
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || "Erro ao analisar vídeo.");
      setVideo(data.video);
      setAnalysis(data.analysis);
      setHasTranscript(data.hasTranscript);
    } catch (err: any) {
      toast({ title: "Erro ao analisar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVersionButton = async (type: string) => {
    if (!analysis || !video) return;
    setActiveVersion(type);
    setVersionText("");
    setLoadingVersion(true);

    const labels: Record<string, string> = {
      tiktok: "TikTok (15-30s, legendas chamativas, corte rápido)",
      reels: "Instagram Reels (15-30s, estética visual forte)",
      vendas: "Conteúdo de Vendas (CTA direto, benefícios claros)",
      storytelling: "Storytelling (narrativa pessoal, emoção, jornada)",
      outro_nicho: "Adaptação para outro nicho completamente diferente",
    };

    try {
      const { data, error } = await supabase.functions.invoke("analyze-viral-video", {
        body: {
          videoUrl: video.url,
          generateVersion: true,
          versionType: labels[type],
          videoTitle: video.title,
          resumo: analysis.resumo,
          gancho: `${analysis.gancho.tipo} — ${analysis.gancho.descricao}`,
          porQueViralizou: analysis.por_que_viralizou,
        },
      });
      if (error) throw new Error(error.message);
      if (!data.success) throw new Error(data.error || "Erro ao gerar versão.");
      setVersionText(data.versionText || "");
    } catch (err: any) {
      toast({ title: "Erro ao gerar versão", description: err.message, variant: "destructive" });
    } finally {
      setLoadingVersion(false);
    }
  };

  const mapColors = ["bg-red-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500", "bg-green-500", "bg-teal-500", "bg-blue-500"];

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen overflow-y-auto">
      <div className="p-4 md:p-6 max-w-4xl mx-auto w-full space-y-6 pb-10">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold font-display flex items-center gap-2">
            <Zap className="h-7 w-7 text-primary" />
            GameOver 🔥
          </h1>
          <p className="text-sm text-muted-foreground">
            Cole o link de um vídeo viral e descubra exatamente por que ele viralizou — engenharia reversa completa.
          </p>
        </div>

        {/* Input */}
        <Card className="border-primary/30">
          <CardContent className="p-5 space-y-3">
            <label className="text-sm font-medium">Cole o link do vídeo do YouTube</label>
            <div className="flex gap-2">
              <Input
                placeholder="https://youtube.com/shorts/... ou https://youtu.be/..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleAnalyze()}
                className="flex-1"
                disabled={loading}
              />
              <Button
                onClick={handleAnalyze}
                disabled={loading || !url.trim()}
                className="gradient-viral shrink-0"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />Analisando…</>
                ) : (
                  <><Zap className="h-4 w-4" />Analisar</>
                )}
              </Button>
            </div>
            {loading && (
              <p className="text-xs text-muted-foreground animate-pulse">
                Buscando dados do vídeo e gerando análise viral completa…
              </p>
            )}
          </CardContent>
        </Card>

        {/* Loading skeleton */}
        {loading && <AnalysisSkeleton />}

        {/* Results */}
        {video && analysis && (
          <div className="space-y-4">

            {/* Transcript notice */}
            {!hasTranscript && (
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                Transcrição não disponível para este vídeo — análise baseada em título e descrição.
              </div>
            )}
            {hasTranscript && (
              <div className="flex items-center gap-2 text-xs text-green-600 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                Transcrição extraída com sucesso — análise baseada no conteúdo completo do vídeo.
              </div>
            )}

            {/* SEÇÃO 1 — Dados do vídeo */}
            <Section icon={<Play className="h-5 w-5" />} title="Dados do Vídeo" color="primary">
              <div className="flex gap-4">
                <a href={video.url} target="_blank" rel="noopener noreferrer" className="shrink-0 group">
                  <div className="relative w-36 aspect-video rounded-lg overflow-hidden bg-muted">
                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                      <ExternalLink className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </a>
                <div className="flex-1 space-y-2 min-w-0">
                  <a href={video.url} target="_blank" rel="noopener noreferrer">
                    <h3 className="font-semibold text-sm line-clamp-2 hover:text-primary transition-colors">{video.title}</h3>
                  </a>
                  <p className="text-xs text-muted-foreground">{video.channel}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground"><Eye className="h-3 w-3" />{video.views}</span>
                    <span className="flex items-center gap-1 text-muted-foreground"><ThumbsUp className="h-3 w-3" />{video.likes}</span>
                    <span className="flex items-center gap-1 text-muted-foreground"><MessageCircle className="h-3 w-3" />{video.comments}</span>
                    <span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" />{video.duration}</span>
                    <span className="flex items-center gap-1 text-muted-foreground"><Calendar className="h-3 w-3" />{video.publishedAt}</span>
                  </div>
                </div>
              </div>
            </Section>

            {/* SEÇÃO 2 — Resumo */}
            <Section icon={<FileText className="h-5 w-5" />} title="Resumo do Vídeo" color="blue">
              <p className="text-sm leading-relaxed">{analysis.resumo}</p>
            </Section>

            {/* SEÇÃO 3 — Mapa de Viralização */}
            <Section icon={<Map className="h-5 w-5" />} title="Mapa de Viralização" badge={`${analysis.mapa_viralizacao.length} partes`} color="pink">
              {/* Timeline visual */}
              <div className="flex rounded-full overflow-hidden h-3 mb-4">
                {analysis.mapa_viralizacao.map((item, i) => (
                  <div
                    key={i}
                    className={`${mapColors[i % mapColors.length]} flex-1 first:rounded-l-full last:rounded-r-full`}
                    title={item.nome}
                  />
                ))}
              </div>
              <div className="space-y-2">
                {analysis.mapa_viralizacao.map((item, i) => (
                  <div key={i} className="flex gap-3 text-sm">
                    <div className="flex items-start gap-2 shrink-0">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${mapColors[i % mapColors.length]}`} />
                      <span className="text-xs text-muted-foreground w-16 shrink-0">{item.inicio}–{item.fim}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-xs">{item.nome}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.descricao}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* SEÇÃO 4 — Gancho */}
            <Section icon={<Anchor className="h-5 w-5" />} title="Gancho Usado" color="amber">
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-sm px-3">
                {analysis.gancho.tipo}
              </Badge>
              <p className="text-sm leading-relaxed">{analysis.gancho.descricao}</p>
            </Section>

            {/* SEÇÃO 5 — Psicologia */}
            <Section icon={<Brain className="h-5 w-5" />} title="Psicologia do Vídeo" color="purple">
              <div className="space-y-3">
                {analysis.psicologia.map((item, i) => (
                  <div key={i} className="flex gap-3">
                    <Badge variant="outline" className="shrink-0 h-fit text-xs">{item.gatilho}</Badge>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.explicacao}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* SEÇÃO 6 — Estrutura */}
            <Section icon={<BarChart2 className="h-5 w-5" />} title="Estrutura do Conteúdo" color="teal">
              <div className="space-y-2">
                {analysis.estrutura.map((item) => (
                  <div key={item.numero} className="flex gap-3 text-sm">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                      {item.numero}
                    </div>
                    <div>
                      <span className="font-semibold text-xs">{item.nome}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.explicacao}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* SEÇÃO 7 — Por que viralizou */}
            <Section icon={<Flame className="h-5 w-5" />} title="Por Que Esse Vídeo Viralizou" color="red">
              <p className="text-sm leading-relaxed">{analysis.por_que_viralizou}</p>
            </Section>

            {/* SEÇÃO 8 — Como Copiar */}
            <Section icon={<Copy className="h-5 w-5" />} title="Como Copiar Essa Ideia" color="green">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { label: "Recriar o formato", text: analysis.como_copiar.recriar_formato, color: "text-green-600" },
                  { label: "Adaptar para outro nicho", text: analysis.como_copiar.adaptar_nicho, color: "text-blue-600" },
                  { label: "Conteúdo de venda", text: analysis.como_copiar.conteudo_venda, color: "text-amber-600" },
                  { label: "Conteúdo educacional", text: analysis.como_copiar.conteudo_educacional, color: "text-purple-600" },
                ].map((item) => (
                  <div key={item.label} className="bg-muted/40 rounded-lg p-3 space-y-1">
                    <span className={`text-xs font-semibold ${item.color}`}>{item.label}</span>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </Section>

            {/* SEÇÃO 9 — Roteiro Inspirado */}
            <Section icon={<Sparkles className="h-5 w-5" />} title="Roteiro Inspirado" color="orange">
              <div className="space-y-2">
                {analysis.roteiro.map((item) => (
                  <div key={item.cena} className="flex gap-3 bg-muted/30 rounded-lg p-3">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-orange-500/10 text-orange-600 text-xs font-bold shrink-0">
                      {item.cena}
                    </div>
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <ChevronRight className="h-3 w-3 text-orange-500" />
                        <span className="text-xs font-semibold text-orange-600">{item.nome}</span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.texto}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            {/* SEÇÃO 10 — Botões de Ação */}
            <Card className="border-border/50">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  <h2 className="font-bold font-display text-base">Criar Versão Para…</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: "tiktok", label: "TikTok", icon: "🎵" },
                    { key: "reels", label: "Reels", icon: "📱" },
                    { key: "vendas", label: "Vendas", icon: "💰" },
                    { key: "storytelling", label: "Storytelling", icon: "📖" },
                    { key: "outro_nicho", label: "Outro Nicho", icon: "🎯" },
                  ].map(({ key, label, icon }) => (
                    <Button
                      key={key}
                      variant={activeVersion === key ? "default" : "outline"}
                      size="sm"
                      className={activeVersion === key ? "gradient-viral" : ""}
                      onClick={() => handleVersionButton(key)}
                      disabled={loadingVersion}
                    >
                      {icon} {label}
                    </Button>
                  ))}
                </div>

                {(loadingVersion || versionText) && (
                  <div className="bg-muted/40 rounded-lg p-4">
                    {loadingVersion ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Gerando versão adaptada…
                      </div>
                    ) : (
                      <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
                        {versionText}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
        )}

        {/* Empty state */}
        {!loading && !video && (
          <div className="text-center py-16 space-y-3 text-muted-foreground">
            <Zap className="h-14 w-14 mx-auto opacity-20" />
            <p className="text-sm">Cole o link de um vídeo viral para descobrir o segredo da viralização</p>
            <p className="text-xs opacity-60">Suporte para YouTube Shorts e vídeos regulares</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GameOver;
