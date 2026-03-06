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
  { id: "cortes-youtube",     label: "Cortes (YouTube)",                emoji: "✂️",  color: "bg-red-500/10 text-red-500 border-red-500/20",       driveId: "1z8a_WKgtnEUzMRx-u0xghakxLPVOqYND" },
  { id: "animes",             label: "Animes",                          emoji: "⛩️",  color: "bg-purple-500/10 text-purple-500 border-purple-500/20",      driveId: "1bRAsl_es5KgcQWxxKGqPf8tBusaqHVRs" },
  { id: "desenhos",           label: "Desenhos",                        emoji: "🎨",  color: "bg-pink-500/10 text-pink-500 border-pink-500/20",              driveId: "1htzobkRkUbr0-jd9Np95FtO8kO-SrUDm" },
  { id: "cortes-arma-pesada", label: "Ação Policial",                   emoji: "🔫",  color: "bg-gray-500/10 text-gray-400 border-gray-500/20",              driveId: "1lG0FrZoYfTCXTIyb-nQ6KBUhzXGHElVh" },
  { id: "master-chef",        label: "Master Chef",                     emoji: "👨‍🍳",  color: "bg-orange-500/10 text-orange-500 border-orange-500/20",        driveId: "1Rg78f4lGB1T6-y27A5aXfWYfUKxebx4-" },
  { id: "consertos",          label: "Consertos e Marcenaria",          emoji: "🔧",  color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",        driveId: "11bbQ6te8hcGnlvjzafLVpNUv2PmdvtLJ" },
  { id: "cortes-guerra",      label: "Operação Fronteira",              emoji: "🪖",  color: "bg-green-800/10 text-green-600 border-green-800/20",           driveId: "1Kbl0iW86J3iFZUI_ONX6rL8dYml4KCnB" },
  { id: "asmr",               label: "ASMR",                            emoji: "🎧",  color: "bg-violet-500/10 text-violet-400 border-violet-500/20",        driveId: "14-TnFOShvnJrRrp5K_5YSfvHgRduEwe9" },
  { id: "ladrao",             label: "Ladrão (Se deu mal)",             emoji: "🚔",  color: "bg-red-800/10 text-red-400 border-red-800/20",                 driveId: "1fCGlNqimDsEl9RrkyjGn95gHyss8xXkY" },
  { id: "cortes-filme-serie", label: "Filmes e Séries",                 emoji: "🎬",  color: "bg-blue-500/10 text-blue-500 border-blue-500/20",              driveId: "1BlfLs0zwTPUZnmNbvARdBycLcO0VP0sW" },
  { id: "espinhas",           label: "Espinhas",                        emoji: "😬",  color: "bg-yellow-800/10 text-yellow-600 border-yellow-800/20",        driveId: "1gn9i2cYvjppsauka3N0RrCYoP2yW65XG" },
  { id: "failed",             label: "Failed (Erros Engraçados)",       emoji: "😂",  color: "bg-amber-500/10 text-amber-500 border-amber-500/20",           driveId: "1ta9rHRokydK0fdXeS8TLLYsPYIWMNBV3" },
  { id: "limpeza",            label: "Limpeza e Organização",           emoji: "🧹",  color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",              driveId: "1722L4Pvopfn4GW1SFGIr7XCPvBq3KW0h" },
  { id: "ia",                 label: "Gerados por IA",                  emoji: "🤖",  color: "bg-blue-600/10 text-blue-400 border-blue-600/20",              driveId: "1dWBhH6UC9Yp4iDc3SyqnIiwVBMx-TfKz" },
  { id: "insetos",            label: "Insetos",                         emoji: "🐛",  color: "bg-lime-500/10 text-lime-500 border-lime-500/20",              driveId: "1hhqT9lzrI464-hljPO0XrWrTUyZxUyIA" },
  { id: "casas-luxo",         label: "Casas de Luxo",                   emoji: "🏰",  color: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20" },
  { id: "old-money",          label: "Old Money",                       emoji: "💎",  color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  { id: "saude",              label: "Saúde",                           emoji: "❤️‍🩹",  color: "bg-rose-500/10 text-rose-500 border-rose-500/20" },
  { id: "cortes-desenhos",    label: "Cortes de Desenhos",              emoji: "🖼️",  color: "bg-pink-600/10 text-pink-400 border-pink-600/20" },
  { id: "cortes-talk-show",   label: "Cortes Talk Show / Entrevistas",  emoji: "🎙️",  color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" },
  { id: "family-guy",         label: "Cortes de Family Guy",            emoji: "🐶",  color: "bg-yellow-600/10 text-yellow-500 border-yellow-600/20" },
  { id: "rick-morty",         label: "Cortes de Rick and Morty",        emoji: "🛸",  color: "bg-green-500/10 text-green-400 border-green-500/20" },
  { id: "lifestyle",          label: "Lifestyle",                       emoji: "✨",  color: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20" },
  { id: "gringos",            label: "Gringos",                         emoji: "🌎",  color: "bg-blue-400/10 text-blue-400 border-blue-400/20" },
  { id: "aviacao",            label: "Aviação",                         emoji: "✈️",  color: "bg-sky-500/10 text-sky-500 border-sky-500/20" },
  { id: "motivacional",       label: "Motivacional",                    emoji: "🔥",  color: "bg-orange-600/10 text-orange-400 border-orange-600/20" },
  { id: "futebol",            label: "Futebol",                         emoji: "⚽",  color: "bg-green-600/10 text-green-500 border-green-600/20" },
  { id: "pablo-marcal",       label: "Pablo Marçal",                    emoji: "🎤",  color: "bg-purple-600/10 text-purple-400 border-purple-600/20" },
  { id: "ruyter",             label: "Ruyter",                          emoji: "🎯",  color: "bg-red-600/10 text-red-400 border-red-600/20" },
  { id: "satisfatorios",      label: "Satisfatórios",                   emoji: "😌",  color: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
  { id: "memes",              label: "Memes",                           emoji: "💀",  color: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20" },
  { id: "comedia",            label: "Comédia",                         emoji: "🤣",  color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" },
  { id: "achadinhos",         label: "Achadinhos (Produtos / Shopee)",  emoji: "🛍️",  color: "bg-orange-400/10 text-orange-400 border-orange-400/20" },
  { id: "academia-fitness",   label: "Academia / Fitness",              emoji: "💪",  color: "bg-green-500/10 text-green-500 border-green-500/20" },
  { id: "animais-selvagens",  label: "Animais Selvagens",               emoji: "🦁",  color: "bg-amber-600/10 text-amber-500 border-amber-600/20" },
  { id: "travel-vibes",       label: "Travel Vibes (Viagens)",          emoji: "🌴",  color: "bg-cyan-600/10 text-cyan-400 border-cyan-600/20" },
  { id: "parkour",            label: "Parkour",                         emoji: "🏃",  color: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  { id: "religioso",          label: "Religioso",                       emoji: "🙏",  color: "bg-blue-300/10 text-blue-300 border-blue-300/20" },
  { id: "diy",                label: "Faça Você Mesmo (DIY)",           emoji: "🔨",  color: "bg-amber-700/10 text-amber-700 border-amber-700/20" },
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
