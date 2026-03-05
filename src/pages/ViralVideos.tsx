import { Download, Play, AlertTriangle, Sparkles, Film, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/* ── Tipos ── */
type VideoCategory = {
  id: string;
  label: string;
  emoji: string;
  color: string;
  videos: VideoItem[];
};

type VideoItem = {
  id: string;
  title: string;
  platform: string;
  url: string;
  thumbnail?: string;
};

/* ── Dados (placeholder - o usuário vai enviar capas e links) ── */
const categories: VideoCategory[] = [
  {
    id: "fitness",
    label: "Fitness & Saúde",
    emoji: "💪",
    color: "bg-green-500/10 text-green-500 border-green-500/20",
    videos: [],
  },
  {
    id: "humor",
    label: "Humor & Entretenimento",
    emoji: "😂",
    color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    videos: [],
  },
  {
    id: "finance",
    label: "Finanças & Negócios",
    emoji: "💰",
    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
    videos: [],
  },
  {
    id: "fashion",
    label: "Moda & Estilo",
    emoji: "👗",
    color: "bg-pink-500/10 text-pink-500 border-pink-500/20",
    videos: [],
  },
  {
    id: "food",
    label: "Gastronomia & Receitas",
    emoji: "🍕",
    color: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    videos: [],
  },
  {
    id: "tech",
    label: "Tecnologia & IA",
    emoji: "🤖",
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
    videos: [],
  },
];

/* ── Card de vídeo ── */
const VideoCard = ({ video }: { video: VideoItem }) => (
  <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-border/60">
    <div className="aspect-video bg-muted relative overflow-hidden">
      {video.thumbnail ? (
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
          <Play className="h-10 w-10 text-primary/40" />
        </div>
      )}
      <Badge
        variant="outline"
        className="absolute top-2 left-2 text-xs backdrop-blur-sm bg-black/40 border-white/20 text-white"
      >
        {video.platform}
      </Badge>
    </div>
    <CardContent className="p-4 space-y-3">
      <p className="text-sm font-semibold line-clamp-2">{video.title}</p>
      <a href={video.url} target="_blank" rel="noopener noreferrer">
        <Button size="sm" className="w-full gradient-viral gap-2">
          <Download className="h-4 w-4" />
          Baixar & Remodelar
        </Button>
      </a>
    </CardContent>
  </Card>
);

/* ── Aviso de uso ── */
const UsageWarning = () => (
  <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 flex gap-4 items-start">
    <AlertTriangle className="h-6 w-6 text-yellow-500 shrink-0 mt-0.5" />
    <div className="space-y-1.5">
      <p className="text-sm font-bold text-yellow-500">⚠️ Importante — Leia antes de usar</p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Os vídeos disponibilizados aqui são de uso exclusivo para <strong className="text-foreground">remodelação criativa</strong>.
        <strong className="text-foreground"> NÃO copie e cole o conteúdo diretamente</strong> em suas redes sociais.
        Faça uma versão própria: mude o contexto, adicione sua voz, estilo e edição pessoal.
        Plagiar conteúdo pode resultar em remoção de vídeos, penalizações de conta e problemas de direitos autorais.
        <br />
        <span className="text-yellow-500 font-medium">Use para se inspirar e criar — não para copiar.</span>
      </p>
    </div>
  </div>
);

/* ── Placeholder de categoria vazia ── */
const EmptyCategoryPlaceholder = () => (
  <div className="col-span-full flex flex-col items-center justify-center py-10 text-center space-y-2">
    <RefreshCw className="h-8 w-8 text-muted-foreground/30" />
    <p className="text-sm text-muted-foreground">Vídeos desta categoria em breve!</p>
  </div>
);

/* ── Página principal ── */
const ViralVideos = () => {
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen overflow-y-auto">
      <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-8">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold font-display flex items-center gap-2">
            <Film className="h-7 w-7 text-primary" />
            Vídeos Virais Prontos 🎬
          </h1>
          <p className="text-sm text-muted-foreground">
            Vídeos virais prontos para você baixar, remodelar e postar — engaje mais e monetize.
          </p>
        </div>

        {/* Aviso de uso */}
        <UsageWarning />

        {/* Como usar */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Como usar para monetizar
            </h2>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li><strong className="text-foreground">Baixe</strong> o vídeo da categoria do seu nicho.</li>
              <li><strong className="text-foreground">Remodelar</strong> — edite, adicione sua voz, legendas, contexto e identidade visual.</li>
              <li><strong className="text-foreground">Poste</strong> nas suas redes com uma descrição própria e hashtags relevantes.</li>
              <li><strong className="text-foreground">Monitore</strong> o engajamento e repita o processo com os que performam melhor.</li>
            </ol>
          </CardContent>
        </Card>

        {/* Categorias de vídeos */}
        {categories.map((cat) => (
          <section key={cat.id} className="space-y-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold font-display">{cat.emoji} {cat.label}</h2>
              <Badge variant="outline" className={`text-xs ${cat.color}`}>
                {cat.videos.length} vídeo{cat.videos.length !== 1 ? "s" : ""}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cat.videos.length > 0
                ? cat.videos.map((v) => <VideoCard key={v.id} video={v} />)
                : <EmptyCategoryPlaceholder />
              }
            </div>
          </section>
        ))}

      </div>
    </div>
  );
};

export default ViralVideos;
