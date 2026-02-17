import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { searchViralContent, streamAnalyzeTrends } from "@/lib/api/viral";
import { extractThumbnail, getPlatform } from "@/lib/utils/thumbnail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp, Search, ExternalLink, Loader2,
  Play, Sparkles, Video, RefreshCw, Plus, X, User,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Niche = { id: string; name: string; slug: string; icon: string | null };
type SearchResult = { url: string; title: string; description: string; markdown?: string; metadata?: any };
type FollowedChannel = { id: string; channel_name: string; platform: string };

const platformColors: Record<string, string> = {
  YouTube: "bg-red-500/10 text-red-500 border-red-500/20",
  TikTok: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  Instagram: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  "X/Twitter": "bg-sky-500/10 text-sky-500 border-sky-500/20",
  Facebook: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  Kwai: "bg-orange-500/10 text-orange-500 border-orange-500/20",
};

const PLATFORMS = ["YouTube", "TikTok", "Instagram", "X/Twitter", "Facebook", "Kwai"];

/* ── Result Card ── */
const ResultCard = ({ result }: { result: SearchResult }) => {
  const thumbnail = extractThumbnail(result.url, result.markdown);
  const platform = getPlatform(result.url);
  const colorClass = platformColors[platform] || "bg-muted text-muted-foreground";

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow group">
      <a href={result.url} target="_blank" rel="noopener noreferrer" className="block relative">
        <div className="aspect-video bg-muted relative overflow-hidden">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={result.title || "Thumbnail"}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              onError={(e) => { e.currentTarget.style.display = "none"; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
              <Play className="h-10 w-10 text-primary/50" />
            </div>
          )}
          <div className="absolute top-2 left-2">
            <Badge variant="outline" className={`text-xs ${colorClass} backdrop-blur-sm`}>
              {platform}
            </Badge>
          </div>
        </div>
      </a>
      <CardContent className="p-4 space-y-2">
        <a href={result.url} target="_blank" rel="noopener noreferrer" className="group/link">
          <h3 className="font-semibold text-sm line-clamp-2 group-hover/link:text-primary transition-colors flex items-start gap-1">
            {result.title || "Sem título"}
            <ExternalLink className="h-3 w-3 shrink-0 mt-0.5 opacity-0 group-hover/link:opacity-100 transition-opacity" />
          </h3>
        </a>
        <p className="text-xs text-muted-foreground line-clamp-3">{result.description}</p>
      </CardContent>
    </Card>
  );
};

/* ── AI Analysis Panel ── */
const AnalysisPanel = ({ text, loading }: { text: string; loading: boolean }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [text]);

  if (!text && !loading) return null;

  return (
    <Card className="border-primary/20 bg-card">
      <CardContent className="p-5">
        <h2 className="text-lg font-bold font-display flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" />
          Análise da IA — Como Remodelar
        </h2>
        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed">
          {text || (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Analisando tendências…
            </span>
          )}
          <div ref={endRef} />
        </div>
      </CardContent>
    </Card>
  );
};

/* ── Main Page ── */
const GameOver = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [userNiches, setUserNiches] = useState<Niche[]>([]);
  const [selectedNiche, setSelectedNiche] = useState<Niche | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  // AI analysis
  const [analysisText, setAnalysisText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  // Followed channels
  const [channels, setChannels] = useState<FollowedChannel[]>([]);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelPlatform, setNewChannelPlatform] = useState("YouTube");
  const [addingChannel, setAddingChannel] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [nichesRes, channelsRes] = await Promise.all([
        supabase
          .from("user_niches")
          .select("niche_id, niches(id, name, slug, icon)")
          .order("created_at"),
        supabase
          .from("followed_channels")
          .select("id, channel_name, platform")
          .order("created_at"),
      ]);

      if (nichesRes.data) {
        const niches = nichesRes.data.map((un: any) => un.niches).filter(Boolean) as Niche[];
        setUserNiches(niches);
        if (niches.length > 0) setSelectedNiche(niches[0]);
      }
      if (channelsRes.data) {
        setChannels(channelsRes.data);
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  const addChannel = async () => {
    if (!user || !newChannelName.trim()) return;
    setAddingChannel(true);
    const { data, error } = await supabase
      .from("followed_channels")
      .insert({ user_id: user.id, channel_name: newChannelName.trim(), platform: newChannelPlatform })
      .select("id, channel_name, platform")
      .single();

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else if (data) {
      setChannels((prev) => [...prev, data]);
      setNewChannelName("");
      toast({ title: "Canal adicionado!" });
    }
    setAddingChannel(false);
  };

  const removeChannel = async (id: string) => {
    await supabase.from("followed_channels").delete().eq("id", id);
    setChannels((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSearch = useCallback(async () => {
    if (!selectedNiche) return;
    setSearching(true);
    setSearchResults([]);
    setAnalysisText("");
    setAnalyzing(false);

    try {
      const results = await searchViralContent(selectedNiche.name);
      setSearchResults(results);
    } catch (error: any) {
      toast({ title: "Erro na busca", description: error.message, variant: "destructive" });
    } finally {
      setSearching(false);
    }
  }, [selectedNiche, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen overflow-y-auto">
      <div className="p-4 md:p-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold font-display flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-primary" />
            GameOver 🔥
          </h1>
          <p className="text-sm text-muted-foreground">
            Descubra tendências virais reais e receba ideias de como remodelar para o seu perfil.
          </p>
        </div>

        {/* Seus Nichos & Canais */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Nichos selecionados */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="text-sm font-bold font-display flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Seus Nichos
              </h2>
              {userNiches.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum nicho selecionado. Vá ao Dashboard para escolher.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {userNiches.map((niche) => (
                    <Badge
                      key={niche.id}
                      variant={selectedNiche?.id === niche.id ? "default" : "outline"}
                      className={`cursor-pointer transition-all ${
                        selectedNiche?.id === niche.id ? "gradient-viral text-primary-foreground" : "hover:bg-accent"
                      }`}
                      onClick={() => {
                        setSelectedNiche(niche);
                        setSearchResults([]);
                        setAnalysisText("");
                      }}
                    >
                      {niche.icon} {niche.name}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Canais seguidos */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <h2 className="text-sm font-bold font-display flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Canais que você segue
              </h2>

              {/* Lista de canais */}
              {channels.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {channels.map((ch) => (
                    <Badge key={ch.id} variant="secondary" className="gap-1 pr-1">
                      <span className="text-xs opacity-60">{ch.platform}</span>
                      <span className="font-medium">{ch.channel_name}</span>
                      <button
                        onClick={() => removeChannel(ch.id)}
                        className="ml-1 p-0.5 rounded-full hover:bg-destructive/20 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}

              {/* Adicionar canal */}
              <div className="flex gap-2 items-center">
                <Select value={newChannelPlatform} onValueChange={setNewChannelPlatform}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder="Nome do canal..."
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  className="h-8 text-sm flex-1"
                  onKeyDown={(e) => e.key === "Enter" && addChannel()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addChannel}
                  disabled={!newChannelName.trim() || addingChannel}
                  className="h-8"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {userNiches.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-muted-foreground">Você ainda não selecionou nenhum nicho.</p>
            <Button variant="outline">Escolher nichos</Button>
          </div>
        ) : (
          <>
            {/* Search button */}
            <Button
              onClick={handleSearch}
              disabled={searching || analyzing}
              className="gradient-viral"
              size="lg"
            >
              {searching ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Buscando tendências…</>
              ) : analyzing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />IA analisando…</>
              ) : searchResults.length > 0 ? (
                <><RefreshCw className="h-4 w-4 mr-2" />Buscar novamente</>
              ) : (
                <><Search className="h-4 w-4 mr-2" />Buscar viral de {selectedNiche?.name}</>
              )}
            </Button>

            {/* AI Analysis - temporarily disabled */}
            {/* <AnalysisPanel text={analysisText} loading={analyzing} /> */}

            {/* Search Results Grid */}
            {searchResults.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-bold font-display flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary" />
                  Conteúdos Encontrados ({searchResults.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {searchResults.map((result, i) => (
                    <ResultCard key={i} result={result} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!searching && !analyzing && searchResults.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Clique em buscar para descobrir o que está viralizando!</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default GameOver;
