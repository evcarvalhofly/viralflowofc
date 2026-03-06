import { useState } from "react";
import {
  Film, Music, Sparkles, Layers, Play, Download,
  Pause, ExternalLink, Search
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
  driveId: string;
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

/* ── Background assets (reais) ── */
const backgrounds: Asset[] = [
  {
    id: "bg-001",
    label: "Background 1",
    emoji: "🎬",
    category: "Background",
    driveId: "1QUKJ-FwnIqEkcrtYn70KSyavUkk9vj0S",
    tags: ["background", "fundo"],
  },
  {
    id: "bg-002",
    label: "Background 2",
    emoji: "🎬",
    category: "Background",
    driveId: "1sBGpx3u1qDOiC793poIG2pQFoPSQmLCO",
    tags: ["background", "fundo"],
  },
];

/* ── Asset Card ── */
const AssetCard = ({ asset }: { asset: Asset }) => {
  const [playing, setPlaying] = useState(false);

  const previewUrl = `https://drive.google.com/file/d/${asset.driveId}/preview`;
  const viewUrl    = `https://drive.google.com/file/d/${asset.driveId}/view`;
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${asset.driveId}`;

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden hover:border-primary/50 transition-all duration-200 flex flex-col w-[70vw] sm:w-auto shrink-0 sm:shrink">
      {/* Preview area — portrait 9:16 */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "9/16" }}>
        {playing ? (
          <>
            {/* Oversized iframe centered to crop edges and center the video */}
            <iframe
              src={previewUrl}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ width: "180%", height: "180%" }}
              allow="autoplay"
              title={asset.label}
            />
            <button
              onClick={() => setPlaying(false)}
              className="absolute top-2 right-2 z-10 bg-black/60 hover:bg-black/80 rounded-full p-1.5 text-white transition-colors"
            >
              <Pause className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-muted/20">
            <span className="text-4xl">{asset.emoji}</span>
            <p className="text-xs text-muted-foreground font-medium px-2 text-center">{asset.label}</p>
            <button
              onClick={() => setPlaying(true)}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-4 py-2 text-xs font-semibold transition-colors shadow-md"
            >
              <Play className="h-3 w-3 fill-primary-foreground" />
              Preview
            </button>
          </div>
        )}
      </div>

      {/* Info + actions */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs font-semibold truncate">{asset.label}</p>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">{asset.category}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <a href={viewUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="w-full gap-1 text-[11px] h-8 px-2">
              <ExternalLink className="h-3 w-3" />
              Abrir
            </Button>
          </a>
          <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="w-full gap-1 text-[11px] h-8 px-2">
              <Download className="h-3 w-3" />
              Baixar
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
};

/* ── Coming Soon panel ── */
const ComingSoon = ({ tab }: { tab: Tab }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
    <div className="text-5xl">
      {tab.id === "sfx" ? "🎧" : tab.id === "vfx" ? "✨" : "🎬"}
    </div>
    <h3 className="text-lg font-bold">Em breve</h3>
    <p className="text-sm text-muted-foreground max-w-xs">{tab.description} estará disponível em breve.</p>
    <Badge variant="secondary" className="text-xs">Próxima atualização</Badge>
  </div>
);

/* ── Main page ── */
const Assets = () => {
  const [activeTab, setActiveTab] = useState("backgrounds");
  const [search, setSearch] = useState("");

  const filtered = backgrounds.filter((b) => {
    const q = search.toLowerCase();
    return (
      !q ||
      b.label.toLowerCase().includes(q) ||
      b.category.toLowerCase().includes(q) ||
      (b.tags || []).some((t) => t.includes(q))
    );
  });

  const currentTab = tabs.find((t) => t.id === activeTab)!;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen overflow-y-auto">
      <div className="p-3 md:p-6 max-w-6xl mx-auto w-full space-y-4">

        {/* Header */}
        <div>
          <h1 className="text-xl md:text-3xl font-bold font-display flex items-center gap-2">
            <Layers className="h-6 w-6 md:h-7 md:w-7 text-primary" />
            Área de Edição 🎬
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Assets prontos para turbinar seus vídeos — fundos, sons, efeitos e muito mais.
          </p>
        </div>

        {/* Tabs — horizontal scroll on mobile */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 md:mx-0 md:px-0 scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all border shrink-0",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground",
                tab.comingSoon && activeTab !== tab.id && "opacity-60"
              )}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">
                {tab.id === "backgrounds" ? "Fundos" :
                 tab.id === "sfx" ? "Sons" :
                 tab.id === "vfx" ? "Visuais" : "Transições"}
              </span>
              {tab.comingSoon && (
                <span className="hidden sm:inline text-[9px] bg-muted rounded px-1 py-0.5 uppercase tracking-wide">
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
          <div className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar fundos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Count */}
            <p className="text-xs text-muted-foreground">
              {filtered.length} fundo{filtered.length !== 1 ? "s" : ""} disponíve{filtered.length !== 1 ? "is" : "l"}
            </p>

            {/* Horizontal carousel on mobile, grid on desktop */}
            {filtered.length > 0 ? (
              <>
                {/* Mobile: horizontal scroll */}
                <div className="flex gap-3 overflow-x-auto pb-3 -mx-3 px-3 snap-x snap-mandatory scrollbar-none sm:hidden">
                  {filtered.map((asset) => (
                    <div key={asset.id} className="snap-start">
                      <AssetCard asset={asset} />
                    </div>
                  ))}
                </div>
                {/* Desktop: grid */}
                <div className="hidden sm:grid sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                  {filtered.map((asset) => (
                    <AssetCard key={asset.id} asset={asset} />
                  ))}
                </div>
              </>
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
