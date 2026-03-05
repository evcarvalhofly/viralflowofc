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
  { id: "cortes-youtube", label: "Cortes (YouTube)", emoji: "✂️", color: "bg-red-500/10 text-red-500 border-red-500/20", videos: [] },
  { id: "animes", label: "Animes", emoji: "⛩️", color: "bg-purple-500/10 text-purple-500 border-purple-500/20", videos: [] },
  { id: "desenhos", label: "Desenhos", emoji: "🎨", color: "bg-pink-500/10 text-pink-500 border-pink-500/20", videos: [] },
  { id: "cortes-arma-pesada", label: "Cortes Arma Pesada", emoji: "🔫", color: "bg-gray-500/10 text-gray-400 border-gray-500/20", videos: [] },
  { id: "master-chef", label: "Master Chef", emoji: "👨‍🍳", color: "bg-orange-500/10 text-orange-500 border-orange-500/20", videos: [] },
  { id: "consertos", label: "Consertos e Manutenção", emoji: "🔧", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", videos: [] },
  { id: "cortes-guerra", label: "Cortes Guerra e Tática", emoji: "🪖", color: "bg-green-800/10 text-green-600 border-green-800/20", videos: [] },
  { id: "asmr", label: "ASMR", emoji: "🎧", color: "bg-violet-500/10 text-violet-400 border-violet-500/20", videos: [] },
  { id: "ladrao", label: "Ladrão (Se deu mal)", emoji: "🚔", color: "bg-red-800/10 text-red-400 border-red-800/20", videos: [] },
  { id: "cortes-filme-serie", label: "Cortes Filme e Série", emoji: "🎬", color: "bg-blue-500/10 text-blue-500 border-blue-500/20", videos: [] },
  { id: "espinhas", label: "Espinhas", emoji: "😬", color: "bg-yellow-800/10 text-yellow-600 border-yellow-800/20", videos: [] },
  { id: "failed", label: "Failed (Erros Engraçados)", emoji: "😂", color: "bg-amber-500/10 text-amber-500 border-amber-500/20", videos: [] },
  { id: "limpeza", label: "Limpeza", emoji: "🧹", color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20", videos: [] },
  { id: "ia", label: "IA (Criado com IA)", emoji: "🤖", color: "bg-blue-600/10 text-blue-400 border-blue-600/20", videos: [] },
  { id: "insetos", label: "Insetos", emoji: "🐛", color: "bg-lime-500/10 text-lime-500 border-lime-500/20", videos: [] },
  { id: "casas-luxo", label: "Casas de Luxo", emoji: "🏰", color: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20", videos: [] },
  { id: "old-money", label: "Old Money", emoji: "💎", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", videos: [] },
  { id: "saude", label: "Saúde", emoji: "❤️‍🩹", color: "bg-rose-500/10 text-rose-500 border-rose-500/20", videos: [] },
  { id: "cortes-desenhos", label: "Cortes de Desenhos", emoji: "🖼️", color: "bg-pink-600/10 text-pink-400 border-pink-600/20", videos: [] },
  { id: "cortes-talk-show", label: "Cortes Talk Show / Entrevistas", emoji: "🎙️", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", videos: [] },
  { id: "family-guy", label: "Cortes de Family Guy", emoji: "🐶", color: "bg-yellow-600/10 text-yellow-500 border-yellow-600/20", videos: [] },
  { id: "rick-morty", label: "Cortes de Rick and Morty", emoji: "🛸", color: "bg-green-500/10 text-green-400 border-green-500/20", videos: [] },
  { id: "lifestyle", label: "Lifestyle", emoji: "✨", color: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20", videos: [] },
  { id: "gringos", label: "Gringos", emoji: "🌎", color: "bg-blue-400/10 text-blue-400 border-blue-400/20", videos: [] },
  { id: "aviacao", label: "Aviação", emoji: "✈️", color: "bg-sky-500/10 text-sky-500 border-sky-500/20", videos: [] },
  { id: "motivacional", label: "Motivacional", emoji: "🔥", color: "bg-orange-600/10 text-orange-400 border-orange-600/20", videos: [] },
  { id: "futebol", label: "Futebol", emoji: "⚽", color: "bg-green-600/10 text-green-500 border-green-600/20", videos: [] },
  { id: "pablo-marcal", label: "Pablo Marçal", emoji: "🎤", color: "bg-purple-600/10 text-purple-400 border-purple-600/20", videos: [] },
  { id: "ruyter", label: "Ruyter", emoji: "🎯", color: "bg-red-600/10 text-red-400 border-red-600/20", videos: [] },
  { id: "satisfatorios", label: "Satisfatórios", emoji: "😌", color: "bg-teal-500/10 text-teal-400 border-teal-500/20", videos: [] },
  { id: "memes", label: "Memes", emoji: "💀", color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20", videos: [] },
  { id: "comedia", label: "Comédia", emoji: "🤣", color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20", videos: [] },
  { id: "achadinhos", label: "Achadinhos (Produtos / Shopee)", emoji: "🛍️", color: "bg-orange-400/10 text-orange-400 border-orange-400/20", videos: [] },
  { id: "academia-fitness", label: "Academia / Fitness", emoji: "💪", color: "bg-green-500/10 text-green-500 border-green-500/20", videos: [] },
  { id: "animais-selvagens", label: "Animais Selvagens", emoji: "🦁", color: "bg-amber-600/10 text-amber-500 border-amber-600/20", videos: [] },
  { id: "travel-vibes", label: "Travel Vibes (Viagens)", emoji: "🌴", color: "bg-cyan-600/10 text-cyan-400 border-cyan-600/20", videos: [] },
  { id: "parkour", label: "Parkour", emoji: "🏃", color: "bg-slate-500/10 text-slate-400 border-slate-500/20", videos: [] },
  { id: "religioso", label: "Religioso", emoji: "🙏", color: "bg-blue-300/10 text-blue-300 border-blue-300/20", videos: [] },
  { id: "diy", label: "Faça Você Mesmo (DIY)", emoji: "🔨", color: "bg-brown-500/10 text-amber-700 border-amber-700/20", videos: [] },
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
