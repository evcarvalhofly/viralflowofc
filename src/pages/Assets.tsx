import { useState, useRef, useEffect } from "react";
import {
  Film, Music, Sparkles, Layers, Download,
  ExternalLink, Search, Play
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
  { id: "bg-001", label: "Background 1",  emoji: "🎬", category: "Background", driveId: "1QUKJ-FwnIqEkcrtYn70KSyavUkk9vj0S", tags: ["background", "fundo"] },
  { id: "bg-002", label: "Background 2",  emoji: "🎬", category: "Background", driveId: "1sBGpx3u1qDOiC793poIG2pQFoPSQmLCO", tags: ["background", "fundo"] },
  { id: "bg-003", label: "Background 3",  emoji: "🎬", category: "Background", driveId: "1RSCLCT_A-EGePaXiR6RQgQk3pXcJQsZ_", tags: ["background", "fundo"] },
  { id: "bg-004", label: "Background 4",  emoji: "🎬", category: "Background", driveId: "1XC2yy1M5ub6QD-Re8woAWD5N-QXw0aVb", tags: ["background", "fundo"] },
  { id: "bg-005", label: "Background 5",  emoji: "🎬", category: "Background", driveId: "1p8_RDu7qVJYjohbHrqIgcBj8GQg-etNc",  tags: ["background", "fundo"] },
  { id: "bg-006", label: "Background 6",  emoji: "🎬", category: "Background", driveId: "1xADo9zzPwyJRvU-Ri_V-rQ2B5CSWa8w6", tags: ["background", "fundo"] },
  { id: "bg-007", label: "Background 7",  emoji: "🎬", category: "Background", driveId: "1mlllHQihDgNVY6b6EC5QNr5zKkZk4hvy", tags: ["background", "fundo"] },
  { id: "bg-008", label: "Background 8",  emoji: "🎬", category: "Background", driveId: "10WsU_N9QX7IEcuNui9qQDQ2vpKyJVJGf", tags: ["background", "fundo"] },
  { id: "bg-009", label: "Background 9",  emoji: "🎬", category: "Background", driveId: "1xSohJo2XXD5OE5VoKZjVy5cL5iFNH8Wq", tags: ["background", "fundo"] },
  { id: "bg-010", label: "Background 10", emoji: "🎬", category: "Background", driveId: "1B9Xxr5yRKYLd6RYHYporMA79M5U6zYEn", tags: ["background", "fundo"] },
  { id: "bg-011", label: "Background 11", emoji: "🎬", category: "Background", driveId: "1gKShVlY-m_MwTnhRB-cVoYZKKqQ_S810", tags: ["background", "fundo"] },
  { id: "bg-012", label: "Background 12", emoji: "🎬", category: "Background", driveId: "1t_hNBTj31lSUe34ZKq90ohtZVkAULer3", tags: ["background", "fundo"] },
  { id: "bg-013", label: "Background 13", emoji: "🎬", category: "Background", driveId: "1aQmZyPUQiu3WYPWXT6JNx43dUtnqLWH4", tags: ["background", "fundo"] },
  { id: "bg-014", label: "Background 14", emoji: "🎬", category: "Background", driveId: "1ITAIddqSHLN7AFNXJxB-FQm5xKw2cYqo", tags: ["background", "fundo"] },
  { id: "bg-015", label: "Background 15", emoji: "🎬", category: "Background", driveId: "1-mJmmNBXYrgzXr57CQb-eBfcrqKggkh9", tags: ["background", "fundo"] },
];

/* ── Asset Card ── */
const AssetCard = ({ asset }: { asset: Asset }) => {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const previewUrl  = `https://drive.google.com/file/d/${asset.driveId}/preview`;
  const viewUrl     = `https://drive.google.com/file/d/${asset.driveId}/view`;
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${asset.driveId}`;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { rootMargin: "100px", threshold: 0.1 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  /* ── Mobile card (9:16 portrait) ── */
  const mobileCard = (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden hover:border-primary/50 transition-all duration-200 flex flex-col w-[62vw] shrink-0">
      <div ref={containerRef} className="relative w-full overflow-hidden bg-muted" style={{ aspectRatio: "9/16" }}>
        {!loaded && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted">
            <div className="rounded-full bg-background/80 p-3 shadow">
              <Play className="h-5 w-5 text-primary fill-primary" />
            </div>
            <p className="text-[10px] text-muted-foreground">{asset.label}</p>
          </div>
        )}
        {inView && (
          <iframe
            src={previewUrl}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ width: "130%", height: "125%", opacity: loaded ? 1 : 0, transition: "opacity 0.3s" }}
            allow="autoplay"
            title={asset.label}
            onLoad={() => setLoaded(true)}
          />
        )}
      </div>
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs font-semibold truncate">{asset.label}</p>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">{asset.category}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <a href={viewUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="w-full gap-1 text-[11px] h-8 px-2">
              <ExternalLink className="h-3 w-3" />Abrir
            </Button>
          </a>
          <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="w-full gap-1 text-[11px] h-8 px-2">
              <Download className="h-3 w-3" />Baixar
            </Button>
          </a>
        </div>
      </div>
    </div>
  );

  /* ── Desktop card — iframe em tamanho natural, sem corte ── */
  const desktopCard = (
    <div ref={containerRef} className="rounded-xl border border-border/60 bg-card overflow-hidden hover:border-primary/50 transition-all duration-200 flex flex-col">
      {/* Placeholder */}
      {!loaded && (
        <div className="flex flex-col items-center justify-center gap-2 bg-muted" style={{ aspectRatio: "16/9" }}>
          <div className="rounded-full bg-background/80 p-3 shadow">
            <Play className="h-6 w-6 text-primary fill-primary" />
          </div>
          <p className="text-[11px] text-muted-foreground">{asset.label}</p>
        </div>
      )}
      {/* Iframe full — tamanho original sem crop */}
      {inView && (
        <iframe
          src={previewUrl}
          className="w-full"
          style={{ aspectRatio: "16/9", display: loaded ? "block" : "none" }}
          allow="autoplay"
          title={asset.label}
          onLoad={() => setLoaded(true)}
        />
      )}
      {/* Info + actions */}
      <div className="p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-semibold truncate">{asset.label}</p>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">{asset.category}</Badge>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <a href={viewUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="gap-1 text-[11px] h-8 px-3">
              <ExternalLink className="h-3 w-3" />Abrir
            </Button>
          </a>
          <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="gap-1 text-[11px] h-8 px-3">
              <Download className="h-3 w-3" />Baixar
            </Button>
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="sm:hidden">{mobileCard}</div>
      <div className="hidden sm:block">{desktopCard}</div>
    </>
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
                {/* Desktop: vertical scrollable grid — 2 colunas com preview 16:9 */}
                <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto h-full pb-4">
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
