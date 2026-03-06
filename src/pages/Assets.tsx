import { useState } from "react";
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
  { id: "bg-016", label: "Background 16", emoji: "🎬", category: "Background", driveId: "1r49TnyhLhhrowbNL_tvB5NQnLaRn9nQz", tags: ["background", "fundo"] },
  { id: "bg-017", label: "Background 17", emoji: "🎬", category: "Background", driveId: "1f7G_cLq665dVfqk-Jph09Ns1Y9Khq3lk", tags: ["background", "fundo"] },
  { id: "bg-018", label: "Background 18", emoji: "🎬", category: "Background", driveId: "1k9wDv7gXwqCsWgMsP6PVzFnTa_J8sGl3", tags: ["background", "fundo"] },
  { id: "bg-019", label: "Background 19", emoji: "🎬", category: "Background", driveId: "1zvF7oO9XMOnT7-UrrDaQkulCilVGqc4f", tags: ["background", "fundo"] },
  { id: "bg-020", label: "Background 20", emoji: "🎬", category: "Background", driveId: "1azhrf044iB9edEC7_YPY8mPN9OJFfV8S", tags: ["background", "fundo"] },
  { id: "bg-021", label: "Background 21", emoji: "🎬", category: "Background", driveId: "1wunwtXmAEIvU5tlCtTN8NYN1m1DeDKS8", tags: ["background", "fundo"] },
  { id: "bg-022", label: "Background 22", emoji: "🎬", category: "Background", driveId: "1S6j5tJYSSfhw0apwivt85jvx2OLQ1Gsj", tags: ["background", "fundo"] },
  { id: "bg-023", label: "Background 23", emoji: "🎬", category: "Background", driveId: "1NfPAZSEfEMxlUZp5QUNUb9z0E-phl4iw", tags: ["background", "fundo"] },
  { id: "bg-024", label: "Background 24", emoji: "🎬", category: "Background", driveId: "1Wgf0Tu8sIs6ZyGNYMOB4aSADhLb0Xp0S", tags: ["background", "fundo"] },
  { id: "bg-025", label: "Background 25", emoji: "🎬", category: "Background", driveId: "1o0q9f1GhSTYck4yHuJ9ws3Ydy1CixylR", tags: ["background", "fundo"] },
  { id: "bg-026", label: "Background 26", emoji: "🎬", category: "Background", driveId: "1SssN19SMnIsLEGQL4XKYhn0Tw0bHX93Y", tags: ["background", "fundo"] },
  { id: "bg-027", label: "Background 27", emoji: "🎬", category: "Background", driveId: "1nmlm7GBwgkxa4XdgSZ9AV5GAmgNKREBM", tags: ["background", "fundo"] },
  { id: "bg-028", label: "Background 28", emoji: "🎬", category: "Background", driveId: "1V5Ym38Mvt1HhjBP-oL6Z4hTkNMsu7ZEC", tags: ["background", "fundo"] },
  { id: "bg-029", label: "Background 29", emoji: "🎬", category: "Background", driveId: "1fnJLxanj6Yvh8XuKBEzbtMLXDScdAK2G", tags: ["background", "fundo"] },
  { id: "bg-030", label: "Background 30", emoji: "🎬", category: "Background", driveId: "1RYUblp0sQseEhez9hQpuUgl4fhoSOpFW", tags: ["background", "fundo"] },
  { id: "bg-031", label: "Background 31", emoji: "🎬", category: "Background", driveId: "1ZVtSgKnXy14UNqYftxIp8oAoKSquA_eL", tags: ["background", "fundo"] },
  { id: "bg-032", label: "Background 32", emoji: "🎬", category: "Background", driveId: "1995scWOtpDIQt2QBQbQM6sb3buIqsL1L", tags: ["background", "fundo"] },
  { id: "bg-033", label: "Background 33", emoji: "🎬", category: "Background", driveId: "1guKnLLn0m-mIWs5hzLqbwcsLPZIoDJM3", tags: ["background", "fundo"] },
  { id: "bg-034", label: "Background 34", emoji: "🎬", category: "Background", driveId: "1dqQRJo2KibK4lauukala-YL6yzR9TJ6x", tags: ["background", "fundo"] },
  { id: "bg-035", label: "Background 35", emoji: "🎬", category: "Background", driveId: "1WyrOA7jeL6TZVbCqGJbYytkg6SK15C3p", tags: ["background", "fundo"] },
  { id: "bg-036", label: "Background 36", emoji: "🎬", category: "Background", driveId: "1jH3Iq4r-UcixLlsJie4jxSn0zXrLY1QB", tags: ["background", "fundo"] },
  { id: "bg-037", label: "Background 37", emoji: "🎬", category: "Background", driveId: "1Uf1r1sRQMctYH7NcVzJWP7b0Mx0NET5B", tags: ["background", "fundo"] },
];

/* ── Asset Card ── */
/* Thumbnail URL do Google Drive — imagem estática, carrega instantâneo */
const thumbUrl = (id: string) =>
  `https://drive.google.com/thumbnail?id=${id}&sz=w640`;

const AssetCard = ({ asset }: { asset: Asset }) => {
  const [playing, setPlaying] = useState(false);

  const previewUrl  = `https://drive.google.com/file/d/${asset.driveId}/preview`;
  const viewUrl     = `https://drive.google.com/file/d/${asset.driveId}/view`;
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${asset.driveId}`;
  const thumbnail   = thumbUrl(asset.driveId);

  /* ── Preview area reutilizável ── */
  const PreviewMobile = () => (
    <div
      className="relative w-full overflow-hidden bg-muted cursor-pointer group"
      style={{ aspectRatio: "9/16" }}
      onClick={() => !playing && setPlaying(true)}
    >
      {playing ? (
        <iframe
          src={previewUrl}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ width: "130%", height: "125%" }}
          allow="autoplay"
          title={asset.label}
        />
      ) : (
        <>
          <img
            src={thumbnail}
            alt={asset.label}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <div className="rounded-full bg-background/90 p-3 shadow-lg">
              <Play className="h-5 w-5 text-primary fill-primary" />
            </div>
          </div>
        </>
      )}
    </div>
  );

  const PreviewDesktop = () => (
    <div
      className="relative w-full overflow-hidden bg-muted cursor-pointer group"
      style={{ aspectRatio: "16/9" }}
      onClick={() => !playing && setPlaying(true)}
    >
      {playing ? (
        <iframe
          src={previewUrl}
          className="w-full h-full"
          allow="autoplay"
          title={asset.label}
        />
      ) : (
        <>
          <img
            src={thumbnail}
            alt={asset.label}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <div className="rounded-full bg-background/90 p-4 shadow-lg">
              <Play className="h-6 w-6 text-primary fill-primary" />
            </div>
          </div>
        </>
      )}
    </div>
  );

  const Actions = ({ compact }: { compact?: boolean }) => (
    <div className={cn("flex gap-1.5", compact ? "" : "flex-col")}>
      <a href={viewUrl} target="_blank" rel="noopener noreferrer" className={compact ? "" : "w-full"}>
        <Button size="sm" variant="outline" className={cn("gap-1 text-[11px] h-8 px-2", compact ? "" : "w-full")}>
          <ExternalLink className="h-3 w-3" />Abrir
        </Button>
      </a>
      <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className={compact ? "" : "w-full"}>
        <Button size="sm" className={cn("gap-1 text-[11px] h-8 px-2", compact ? "" : "w-full")}>
          <Download className="h-3 w-3" />Baixar
        </Button>
      </a>
    </div>
  );

  return (
    <>
      {/* ── Mobile card (9:16) ── */}
      <div className="sm:hidden rounded-xl border border-border/60 bg-card overflow-hidden hover:border-primary/50 transition-all duration-200 flex flex-col w-[62vw] shrink-0">
        <PreviewMobile />
        <div className="p-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-1">
            <p className="text-xs font-semibold truncate">{asset.label}</p>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">{asset.category}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Actions />
          </div>
        </div>
      </div>

      {/* ── Desktop card (16:9) ── */}
      <div className="hidden sm:block rounded-xl border border-border/60 bg-card overflow-hidden hover:border-primary/50 transition-all duration-200">
        <PreviewDesktop />
        <div className="p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-semibold truncate">{asset.label}</p>
            <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">{asset.category}</Badge>
          </div>
          <Actions compact />
        </div>
      </div>
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
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto w-full px-3 md:px-6 pb-6">
          {currentTab.comingSoon ? (
            <ComingSoon tab={currentTab} />
          ) : activeTab === "backgrounds" ? (
            <>
              {filtered.length > 0 ? (
                <>
                  {/* Mobile: horizontal carousel */}
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-3 px-3 snap-x snap-mandatory scrollbar-none sm:hidden">
                    {filtered.map((asset) => (
                      <div key={asset.id} className="snap-start shrink-0 flex items-start pt-1">
                        <AssetCard asset={asset} />
                      </div>
                    ))}
                  </div>
                  {/* Desktop: scrollable grid */}
                  <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
                    {filtered.map((asset) => (
                      <AssetCard key={asset.id} asset={asset} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
                  Nenhum fundo encontrado para "{search}"
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Assets;
