import { useState, useRef } from "react";
import {
  Film, Music, Sparkles, Layers, Play, Download,
  Pause, FolderOpen, Search, ChevronRight
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/* ── Types ── */
type Asset = {
  id: string;
  label: string;
  emoji: string;
  category: string;
  driveId?: string;
  previewUrl?: string; // direct video URL for preview (optional)
  tags?: string[];
};

/* ── Tabs ── */
type Tab = {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  comingSoon?: boolean;
};

const tabs: Tab[] = [
  {
    id: "backgrounds",
    label: "Fundos de Vídeo",
    icon: <Film className="h-4 w-4" />,
    description: "Backgrounds prontos para usar em Shorts e Reels",
  },
  {
    id: "sfx",
    label: "Efeitos Sonoros",
    icon: <Music className="h-4 w-4" />,
    description: "Sons e efeitos para turbinar seus vídeos",
    comingSoon: true,
  },
  {
    id: "vfx",
    label: "Efeitos Visuais",
    icon: <Sparkles className="h-4 w-4" />,
    description: "Overlays, partículas e efeitos visuais",
    comingSoon: true,
  },
  {
    id: "transitions",
    label: "Transições",
    icon: <Layers className="h-4 w-4" />,
    description: "Transições suaves e dinâmicas entre cenas",
    comingSoon: true,
  },
];

/* ── Background categories ── */
const backgrounds: Asset[] = [
  { id: "minecraft", label: "Minecraft Parkour",    emoji: "⛏️", category: "Games",     driveId: "1A2b3C4d5E6f7G8h", tags: ["games", "parkour", "minecraft"] },
  { id: "subway",    label: "Subway Surfers",       emoji: "🏃", category: "Games",     driveId: "1B2c3D4e5F6g7H8i", tags: ["games", "corrida"] },
  { id: "satisfying",label: "Satisfatório",         emoji: "😌", category: "Satisfatório", driveId: "1C2d3E4f5G6h7I8j", tags: ["satisfatorio", "asmr"] },
  { id: "cooking",   label: "Cozinha Relaxante",    emoji: "🍳", category: "Cozinha",   driveId: "1D2e3F4g5H6i7J8k", tags: ["culinaria", "relaxante"] },
  { id: "rain",      label: "Chuva Ambiente",       emoji: "🌧️", category: "Natureza",  driveId: "1E2f3G4h5I6j7K8l", tags: ["chuva", "natureza"] },
  { id: "ocean",     label: "Oceano e Ondas",       emoji: "🌊", category: "Natureza",  driveId: "1F2g3H4i5J6k7L8m", tags: ["ocean", "natureza", "relaxante"] },
  { id: "city",      label: "Cidade Noturna",       emoji: "🌃", category: "Urbano",    driveId: "1G2h3I4j5K6l7M8n", tags: ["cidade", "urbano", "noite"] },
  { id: "fireplace", label: "Lareira",              emoji: "🔥", category: "Ambiente",  driveId: "1H2i3J4k5L6m7N8o", tags: ["lareira", "aconchegante"] },
  { id: "space",     label: "Espaço Sideral",       emoji: "🚀", category: "Sci-Fi",    driveId: "1I2j3K4l5M6n7O8p", tags: ["espaco", "sci-fi"] },
  { id: "gradient1", label: "Gradiente Roxo",       emoji: "💜", category: "Abstract",  driveId: "1J2k3L4m5N6o7P8q", tags: ["gradiente", "abstrato", "roxo"] },
  { id: "gradient2", label: "Gradiente Azul",       emoji: "💙", category: "Abstract",  driveId: "1K2l3M4n5O6p7Q8r", tags: ["gradiente", "abstrato", "azul"] },
  { id: "lofi",      label: "Lo-Fi Anime",          emoji: "🎵", category: "Anime",     driveId: "1L2m3N4o5P6q7R8s", tags: ["lofi", "anime", "relaxante"] },
  { id: "street",    label: "Rua Japão",            emoji: "🏯", category: "Urbano",    driveId: "1M2n3O4p5Q6r7S8t", tags: ["japao", "rua", "urbano"] },
  { id: "forest",    label: "Floresta Verde",       emoji: "🌿", category: "Natureza",  driveId: "1N2o3P4q5R6s7T8u", tags: ["floresta", "natureza"] },
  { id: "smoke",     label: "Fumaça Colorida",      emoji: "🌈", category: "Abstract",  driveId: "1O2p3Q4r5S6t7U8v", tags: ["fumaca", "colorido", "abstrato"] },
  { id: "beach",     label: "Praia ao Pôr do Sol",  emoji: "🏖️", category: "Natureza",  driveId: "1P2q3R4s5T6u7V8w", tags: ["praia", "por-do-sol", "natureza"] },
];

/* ── Unique categories ── */
const allCategories = ["Todos", ...Array.from(new Set(backgrounds.map((b) => b.category)))];

/* ── Asset Card ── */
const AssetCard = ({ asset }: { asset: Asset }) => {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const drivePreviewUrl = asset.driveId
    ? `https://drive.google.com/file/d/${asset.driveId}/preview`
    : null;
  const driveDownloadUrl = asset.driveId
    ? `https://drive.google.com/uc?export=download&id=${asset.driveId}`
    : null;
  const driveFolderUrl = asset.driveId
    ? `https://drive.google.com/file/d/${asset.driveId}/view`
    : null;

  const handlePlay = () => {
    setPlaying(true);
  };

  const handleStop = () => {
    setPlaying(false);
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden group hover:border-primary/40 transition-all duration-200">
      {/* Preview area */}
      <div className="relative aspect-[9/16] bg-muted/30 overflow-hidden">
        {playing && drivePreviewUrl ? (
          <>
            <iframe
              src={drivePreviewUrl}
              className="w-full h-full"
              allow="autoplay"
              title={asset.label}
            />
            <button
              onClick={handleStop}
              className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5 text-white hover:bg-black/80 transition-colors z-10"
            >
              <Pause className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <span className="text-4xl">{asset.emoji}</span>
            <p className="text-xs text-muted-foreground text-center px-2">{asset.label}</p>
            {drivePreviewUrl && (
              <button
                onClick={handlePlay}
                className="flex items-center gap-1.5 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
              >
                <Play className="h-3 w-3 fill-primary" />
                Preview
              </button>
            )}
          </div>
        )}
      </div>

      {/* Info + actions */}
      <div className="p-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold leading-tight">{asset.label}</p>
            <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0 h-4">
              {asset.category}
            </Badge>
          </div>
        </div>

        <div className="flex gap-2">
          {driveFolderUrl && (
            <a href={driveFolderUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs h-8">
                <FolderOpen className="h-3 w-3" />
                Abrir
              </Button>
            </a>
          )}
          {driveDownloadUrl && (
            <a href={driveDownloadUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button size="sm" className="w-full gap-1.5 text-xs h-8">
                <Download className="h-3 w-3" />
                Baixar
              </Button>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Coming Soon panel ── */
const ComingSoon = ({ tab }: { tab: Tab }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
    <div className="text-5xl">{tab.id === "sfx" ? "🎧" : tab.id === "vfx" ? "✨" : "🎬"}</div>
    <h3 className="text-lg font-bold">Em breve</h3>
    <p className="text-sm text-muted-foreground max-w-xs">{tab.description} estará disponível em breve.</p>
    <Badge variant="secondary" className="text-xs">Próxima atualização</Badge>
  </div>
);

/* ── Main page ── */
const Assets = () => {
  const [activeTab, setActiveTab] = useState("backgrounds");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");

  const filtered = backgrounds.filter((b) => {
    const matchCat = activeCategory === "Todos" || b.category === activeCategory;
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      b.label.toLowerCase().includes(q) ||
      b.category.toLowerCase().includes(q) ||
      (b.tags || []).some((t) => t.includes(q));
    return matchCat && matchSearch;
  });

  const currentTab = tabs.find((t) => t.id === activeTab)!;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen overflow-y-auto">
      <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-5">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold font-display flex items-center gap-2">
            <Layers className="h-7 w-7 text-primary" />
            Área de Edição 🎬
          </h1>
          <p className="text-sm text-muted-foreground">
            Assets prontos para turbinar seus vídeos — fundos, sons, efeitos e muito mais.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground",
                tab.comingSoon && activeTab !== tab.id && "opacity-60"
              )}
            >
              {tab.icon}
              {tab.label}
              {tab.comingSoon && (
                <span className="text-[9px] bg-muted rounded px-1 py-0.5 uppercase tracking-wide">
                  Em breve
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        {currentTab.comingSoon ? (
          <ComingSoon tab={currentTab} />
        ) : activeTab === "backgrounds" ? (
          <div className="space-y-4">

            {/* Search + category filter */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar fundos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all",
                      activeCategory === cat
                        ? "bg-primary/20 text-primary border-primary/40"
                        : "bg-card text-muted-foreground border-border/60 hover:border-primary/30"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Count */}
            <p className="text-xs text-muted-foreground">
              {filtered.length} fundo{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
            </p>

            {/* Grid */}
            {filtered.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {filtered.map((asset) => (
                  <AssetCard key={asset.id} asset={asset} />
                ))}
              </div>
            ) : (
              <div className="text-center py-16 text-muted-foreground text-sm">
                Nenhum fundo encontrado para "{search}"
              </div>
            )}
          </div>
        ) : null}

      </div>
    </div>
  );
};

export default Assets;
