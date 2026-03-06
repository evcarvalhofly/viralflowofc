import { AlertTriangle, Sparkles, Film, FolderOpen, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/* ── ID da pasta raiz no Google Drive ── */
const DRIVE_ROOT_FOLDER_ID = "15jgrlRxxHg2pEMA3DVDlmvqyBdPZfGmR";
const DRIVE_ROOT_URL = `https://drive.google.com/drive/folders/${DRIVE_ROOT_FOLDER_ID}`;

/* ── Categorias ── */
type VideoCategory = {
  id: string;
  label: string;
  emoji: string;
  color: string;
  driveId?: string;
};

const categories: VideoCategory[] = [
  { id: "cortes-youtube",     label: "Cortes (YouTube)",                emoji: "✂️",  color: "bg-red-500/10 text-red-500 border-red-500/20",             driveId: "1z8a_WKgtnEUzMRx-u0xghakxLPVOqYND" },
  { id: "animes",             label: "Animes",                          emoji: "⛩️",  color: "bg-purple-500/10 text-purple-500 border-purple-500/20",    driveId: "1bRAsl_es5KgcQWxxKGqPf8tBusaqHVRs" },
  { id: "desenhos",           label: "Desenhos",                        emoji: "🎨",  color: "bg-pink-500/10 text-pink-500 border-pink-500/20",          driveId: "1htzobkRkUbr0-jd9Np95FtO8kO-SrUDm" },
  { id: "cortes-arma-pesada", label: "Ação Policial",                   emoji: "🔫",  color: "bg-gray-500/10 text-gray-400 border-gray-500/20",          driveId: "1lG0FrZoYfTCXTIyb-nQ6KBUhzXGHElVh" },
  { id: "master-chef",        label: "Master Chef",                     emoji: "👨‍🍳",  color: "bg-orange-500/10 text-orange-500 border-orange-500/20",    driveId: "1Rg78f4lGB1T6-y27A5aXfWYfUKxebx4-" },
  { id: "consertos",          label: "Consertos e Marcenaria",          emoji: "🔧",  color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",    driveId: "11bbQ6te8hcGnlvjzafLVpNUv2PmdvtLJ" },
  { id: "cortes-guerra",      label: "Operação Fronteira",              emoji: "⚔️",  color: "bg-green-800/10 text-green-600 border-green-800/20",       driveId: "1Kbl0iW86J3iFZUI_ONX6rL8dYml4KCnB" },
  { id: "asmr",               label: "ASMR",                            emoji: "🎧",  color: "bg-violet-500/10 text-violet-400 border-violet-500/20",    driveId: "14-TnFOShvnJrRrp5K_5YSfvHgRduEwe9" },
  { id: "ladrao",             label: "Ladrão (Se deu mal)",             emoji: "🚔",  color: "bg-red-800/10 text-red-400 border-red-800/20",             driveId: "1fCGlNqimDsEl9RrkyjGn95gHyss8xXkY" },
  { id: "cortes-filme-serie", label: "Filmes e Séries",                 emoji: "🎬",  color: "bg-blue-500/10 text-blue-500 border-blue-500/20",          driveId: "1BlfLs0zwTPUZnmNbvARdBycLcO0VP0sW" },
  { id: "espinhas",           label: "Espinhas",                        emoji: "😬",  color: "bg-yellow-800/10 text-yellow-600 border-yellow-800/20",    driveId: "1gn9i2cYvjppsauka3N0RrCYoP2yW65XG" },
  { id: "failed",             label: "Failed (Erros Engraçados)",       emoji: "😂",  color: "bg-amber-500/10 text-amber-500 border-amber-500/20",       driveId: "1ta9rHRokydK0fdXeS8TLLYsPYIWMNBV3" },
  { id: "limpeza",            label: "Limpeza e Organização",           emoji: "🧹",  color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",          driveId: "1722L4Pvopfn4GW1SFGIr7XCPvBq3KW0h" },
  { id: "ia",                 label: "Gerados por IA",                  emoji: "🤖",  color: "bg-blue-600/10 text-blue-400 border-blue-600/20",          driveId: "1dWBhH6UC9Yp4iDc3SyqnIiwVBMx-TfKz" },
  { id: "religioso",          label: "Religioso",                       emoji: "🙏",  color: "bg-blue-300/10 text-blue-300 border-blue-300/20",          driveId: "1crUprpnlH0EwAk2_RyJfiaW0WAlzQDLA" },
  { id: "casas-luxo",         label: "Casas de Luxo",                   emoji: "🏰",  color: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",    driveId: "1pyIifyCVGQXSV-ODWBIAiKH3BjFjllZi" },
  { id: "old-money",          label: "Old Money",                       emoji: "💎",  color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", driveId: "1hGqLhd5rY-m-o9JaPXJxYLB9Hbd84sL5" },
  { id: "saude",              label: "Saúde",                           emoji: "❤️‍🩹",  color: "bg-rose-500/10 text-rose-500 border-rose-500/20",          driveId: "1yuu6c0slVzQMJBpYQI5EQf6fgcQwm6QP" },
  { id: "simpsons",           label: "Os Simpsons",                     emoji: "🟡",  color: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",    driveId: "1DPP9AnZ_WTOdU1zUkxRfQkGYAgzupNCQ" },
  { id: "todo-mundo-odeia",   label: "Todo Mundo Odeia o Chris",        emoji: "😤",  color: "bg-orange-700/10 text-orange-400 border-orange-700/20",    driveId: "1Nlru-RK4TMQfmcDao00eBzkDoRO71gCG" },
  { id: "family-guy",         label: "Cortes de Family Guy",            emoji: "🐶",  color: "bg-yellow-600/10 text-yellow-500 border-yellow-600/20",    driveId: "1hYbnt-hzytQ1urL_l0raYsmdmV7g40lY" },
  { id: "rick-morty",         label: "Cortes de Rick and Morty",        emoji: "🛸",  color: "bg-green-500/10 text-green-400 border-green-500/20",       driveId: "1RgzyUybJ_N3kitIHfMERL-UAhpP8yYo6" },
  { id: "lifestyle",          label: "Lifestyle",                       emoji: "✨",  color: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20", driveId: "1NX5J_h7MWAw-lHZ5HiuMW9f2aF3Xt2sQ" },
  { id: "gringos",            label: "Gringos e Outros",                emoji: "🌎",  color: "bg-blue-400/10 text-blue-400 border-blue-400/20",          driveId: "1BuG0wOIHtVenG6qQdVumdnfoi4c6lgtt" },
  { id: "aviacao",            label: "Aviação",                         emoji: "✈️",  color: "bg-sky-500/10 text-sky-500 border-sky-500/20",             driveId: "1hrxz5ETfbeFHxvPdHxApGSVmzIFLoeGA" },
  { id: "motivacional",       label: "Motivacional",                    emoji: "🔥",  color: "bg-orange-600/10 text-orange-400 border-orange-600/20",    driveId: "1uHXnYww4L61kNIoBG1kAZ_loG8qKitVh" },
  { id: "futebol",            label: "Futebol",                         emoji: "⚽",  color: "bg-green-600/10 text-green-500 border-green-600/20",       driveId: "10xZBfTg1S7i1u5XV8C7C-Fikb_OhGPVW" },
  { id: "pablo-marcal",       label: "Pablo Marçal",                    emoji: "🎤",  color: "bg-purple-600/10 text-purple-400 border-purple-600/20",    driveId: "1UECJb91lpcPCeTVzOsEX66-IdAuhVA4q" },
  { id: "ruyter",             label: "Ruyter",                          emoji: "🎯",  color: "bg-red-600/10 text-red-400 border-red-600/20",             driveId: "1XMF10YhY3q9M5oZZ7oqZRwdtxjDUnACJ" },
  { id: "satisfatorios",      label: "Satisfatórios",                   emoji: "😌",  color: "bg-teal-500/10 text-teal-400 border-teal-500/20",          driveId: "1zJ7pFRfEjgDkrCaYYob4Iei-IUk8hPGh" },
  { id: "memes",              label: "Memes + Efeitos Sonoros",         emoji: "💀",  color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",          driveId: "1aMOmKbcT5idYIPSCVAcI24CN4smCqg8z" },
  { id: "comedia",            label: "Comédia",                         emoji: "🤣",  color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",    driveId: "130L26WqR9YZNkUHcCIBD3SWQDQfuXBCg" },
  { id: "achadinhos",         label: "Achadinhos Shopee",               emoji: "🛍️",  color: "bg-orange-400/10 text-orange-400 border-orange-400/20",    driveId: "1O_kAIY_eoLSDnY-PEBQdhTVmtZ95yfrB" },
  { id: "academia-fitness",   label: "Academia Feminina",               emoji: "💪",  color: "bg-green-500/10 text-green-500 border-green-500/20",       driveId: "1DXTjGbCarkdy10ohcpixprqOEheEdSW_" },
  { id: "animais-selvagens",  label: "Animais Selvagens",               emoji: "🦁",  color: "bg-amber-600/10 text-amber-500 border-amber-600/20",       driveId: "1SuQQNRI9Jl_AwwKTrJ5u5yj-UiBJ55Uj" },
  { id: "travel-vibes",       label: "Travel Vibes (Viagens)",          emoji: "🌴",  color: "bg-cyan-600/10 text-cyan-400 border-cyan-600/20",          driveId: "1CxZffqipfm2NsHW-Twz1G9n6B_VOQaTy" },
  { id: "parkour",            label: "Parkour",                         emoji: "🏃",  color: "bg-slate-500/10 text-slate-400 border-slate-500/20",       driveId: "1rxdd34VbdpPIgJOHotagFZ1NVo1gBdSJ" },
  { id: "insetos",            label: "Insetos",                         emoji: "🐛",  color: "bg-lime-500/10 text-lime-500 border-lime-500/20",          driveId: "1hhqT9lzrI464-hljPO0XrWrTUyZxUyIA" },
  { id: "diy",                label: "Faça Você Mesmo (DIY)",           emoji: "🔨",  color: "bg-amber-700/10 text-amber-700 border-amber-700/20",       driveId: "1bjP1RwlBMuf2OB-oaGNDq2xGLOZA2dz0" },
];

/* ── Aviso de uso ── */
const UsageWarning = () => (
  <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 flex gap-4 items-start">
    <AlertTriangle className="h-6 w-6 text-yellow-500 shrink-0 mt-0.5" />
    <div className="space-y-1.5">
      <p className="text-sm font-bold text-yellow-500">⚠️ Importante — Leia antes de usar</p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Os vídeos disponibilizados aqui são de uso exclusivo para{" "}
        <strong className="text-foreground">remodelação criativa</strong>.{" "}
        <strong className="text-foreground">NÃO copie e cole o conteúdo diretamente</strong> em suas redes sociais.
        Faça uma versão própria: mude o contexto, adicione sua voz, estilo e edição pessoal.
        Plagiar conteúdo pode resultar em remoção de vídeos, penalizações de conta e problemas de direitos autorais.
        <br />
        <span className="text-yellow-500 font-medium">Use para se inspirar e criar — não para copiar.</span>
      </p>
    </div>
  </div>
);

/* ── Card de categoria ── */
const CategoryCard = ({ cat }: { cat: VideoCategory }) => {
  const folderUrl = cat.driveId
    ? `https://drive.google.com/drive/folders/${cat.driveId}`
    : null;

  return (
    <Card className="border-border/60 overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <span className="text-xl">{cat.emoji}</span>
          <span className="font-semibold text-sm">{cat.label}</span>
          <Badge variant="outline" className={`text-xs ${cat.color}`}>
            {cat.driveId ? "Disponível" : "Em breve"}
          </Badge>
        </div>

        {folderUrl ? (
          <a href={folderUrl} target="_blank" rel="noopener noreferrer">
            <Button size="sm" variant="outline" className="gap-2 text-xs">
              <FolderOpen className="h-3.5 w-3.5" />
              Ver vídeos
            </Button>
          </a>
        ) : (
          <Button size="sm" variant="outline" className="gap-2 text-xs" disabled>
            <FolderOpen className="h-3.5 w-3.5" />
            Em breve
          </Button>
        )}
      </div>
    </Card>
  );
};

/* ── Página principal ── */
const ViralVideos = () => {
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen overflow-y-auto">
      <div className="p-4 md:p-6 max-w-5xl mx-auto w-full space-y-6">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold font-display flex items-center gap-2">
            <Film className="h-7 w-7 text-primary" />
            Vídeos Virais Prontos 🎬
          </h1>
          <p className="text-sm text-muted-foreground">
            Baixe, remodelar e poste — engaje mais e monetize com conteúdo viral.
          </p>
        </div>

        {/* Aviso */}
        <UsageWarning />

        {/* Como usar */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5 space-y-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Como usar para monetizar
            </h2>
            <ol className="space-y-1.5 text-sm text-muted-foreground list-decimal list-inside">
              <li><strong className="text-foreground">Escolha</strong> a categoria do seu nicho e clique em "Ver vídeos".</li>
              <li><strong className="text-foreground">Baixe</strong> o vídeo direto pelo Google Drive.</li>
              <li><strong className="text-foreground">Remodelar</strong> — edite, adicione sua voz, legendas e identidade visual.</li>
              <li><strong className="text-foreground">Poste</strong> nas suas redes com descrição própria e hashtags relevantes.</li>
            </ol>
          </CardContent>
        </Card>

        {/* Botão acesso geral */}
        <div className="flex justify-end">
          <a href={DRIVE_ROOT_URL} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-2 text-xs">
              <ExternalLink className="h-3.5 w-3.5" />
              Ver todas as pastas no Drive
            </Button>
          </a>
        </div>

        {/* Categorias */}
        <div className="space-y-3">
          {categories.map((cat) => (
            <CategoryCard key={cat.id} cat={cat} />
          ))}
        </div>

      </div>
    </div>
  );
};

export default ViralVideos;
