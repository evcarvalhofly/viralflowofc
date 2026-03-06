import { useState } from "react";
import {
  Film, Music, Sparkles, Layers, Download,
  ExternalLink, Search
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
  const previewUrl  = `https://drive.google.com/file/d/${asset.driveId}/preview`;
  const viewUrl     = `https://drive.google.com/file/d/${asset.driveId}/view`;
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${asset.driveId}`;

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden hover:border-primary/50 transition-all duration-200 flex flex-col w-[52vw] sm:w-auto shrink-0 sm:shrink">
      {/* Preview area — portrait 9:16, iframe always loaded */}
      <div className="relative w-full overflow-hidden" style={{ aspectRatio: "9/16" }}>
        {/* Iframe maior para cortar bordas pretas do player do Drive em todos os lados */}
        <iframe
          src={previewUrl}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: "130%", height: "125%" }}
          allow="autoplay"
          title={asset.label}
        />
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
    /* Outer: full height, NO scroll */
    <div className="flex flex-col h-full overflow-hidden">
      {/* Fixed top section — header + tabs + search */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2 md:px-6 md:pt-6 max-w-6xl mx-auto w-full space-y-3">

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

        {/* Tabs — horizontal scroll */}
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

        {/* Search (only backgrounds tab) */}
        {!currentTab.comingSoon && activeTab === "backgrounds" && (
          <div className="space-y-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar fundos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {filtered.length} fundo{filtered.length !== 1 ? "s" : ""} disponíve{filtered.length !== 1 ? "is" : "l"}
            </p>
          </div>
        )}
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 max-w-6xl mx-auto w-full px-3 md:px-6 pb-3 md:pb-6">
        {currentTab.comingSoon ? (
          <ComingSoon tab={currentTab} />
        ) : activeTab === "backgrounds" ? (
          <>
            {filtered.length > 0 ? (
              <>
                {/* Mobile: horizontal carousel — ONLY this scrolls */}
                <div className="flex gap-3 overflow-x-auto h-full pb-2 -mx-3 px-3 snap-x snap-mandatory scrollbar-none sm:hidden">
                  {filtered.map((asset) => (
                    <div key={asset.id} className="snap-start h-full flex items-start pt-1">
                      <AssetCard asset={asset} />
                    </div>
                  ))}
                </div>
                {/* Desktop: vertical scrollable grid */}
                <div className="hidden sm:grid sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 overflow-y-auto h-full pb-2">
                  {filtered.map((asset) => (
                    <AssetCard key={asset.id} asset={asset} />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Nenhum fundo encontrado para "{search}"
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default Assets;
