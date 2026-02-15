import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { searchViralContent } from "@/lib/api/viral";
import { extractThumbnail, getPlatform, generateContentSuggestions } from "@/lib/utils/thumbnail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Zap, LogOut, StickyNote, MessageSquare, ClipboardList,
  TrendingUp, Search, ExternalLink, Loader2, ArrowLeft,
  Play, Lightbulb, Video,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type Niche = { id: string; name: string; slug: string; icon: string | null };
type SearchResult = { url: string; title: string; description: string; markdown?: string; metadata?: any };

const platformColors: Record<string, string> = {
  YouTube: "bg-red-500/10 text-red-500 border-red-500/20",
  TikTok: "bg-pink-500/10 text-pink-500 border-pink-500/20",
  Instagram: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  "X/Twitter": "bg-sky-500/10 text-sky-500 border-sky-500/20",
  Facebook: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  Kwai: "bg-orange-500/10 text-orange-500 border-orange-500/20",
};

const Trends = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [userNiches, setUserNiches] = useState<Niche[]>([]);
  const [selectedNiche, setSelectedNiche] = useState<Niche | null>(null);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNiches = async () => {
      const { data } = await supabase
        .from("user_niches")
        .select("niche_id, niches(id, name, slug, icon)")
        .order("created_at");

      if (data) {
        const niches = data
          .map((un: any) => un.niches)
          .filter(Boolean) as Niche[];
        setUserNiches(niches);
        if (niches.length > 0) setSelectedNiche(niches[0]);
      }
      setLoading(false);
    };
    fetchNiches();
  }, []);

  const handleSearch = useCallback(async () => {
    if (!selectedNiche) return;
    setSearching(true);
    setSearchResults([]);
    setSuggestions([]);

    try {
      const results = await searchViralContent(selectedNiche.name);
      setSearchResults(results);
      setSuggestions(generateContentSuggestions(selectedNiche.name, results));
    } catch (error: any) {
      toast({
        title: "Erro na busca",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSearching(false);
    }
  }, [selectedNiche, toast]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold font-display text-gradient-viral">ViralFlow</span>
          </div>
          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
              <TrendingUp className="h-4 w-4 mr-1" />
              Nichos
            </Button>
            <Button variant="ghost" size="sm" disabled>
              <MessageSquare className="h-4 w-4 mr-1" />
              Chat IA
            </Button>
            <Button variant="ghost" size="sm" disabled>
              <ClipboardList className="h-4 w-4 mr-1" />
              Planos
            </Button>
            <Button variant="ghost" size="sm" disabled>
              <StickyNote className="h-4 w-4 mr-1" />
              Notas
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-1" />
              Sair
            </Button>
          </nav>
        </div>
      </header>

      <main className="container px-4 py-8 max-w-6xl">
        {userNiches.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            <p className="text-muted-foreground text-lg">Você ainda não selecionou nenhum nicho.</p>
            <Button onClick={() => navigate("/dashboard")} className="gradient-viral">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Escolher nichos
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2 mb-6">
              <h1 className="text-3xl font-bold font-display flex items-center gap-2">
                <TrendingUp className="h-8 w-8 text-primary" />
                Tendências Virais 🇧🇷
              </h1>
              <p className="text-muted-foreground">
                Descubra o que está bombando no Brasil e receba sugestões de conteúdo.
              </p>
            </div>

            {/* Niche tabs */}
            <div className="flex gap-2 flex-wrap mb-6">
              {userNiches.map((niche) => (
                <Button
                  key={niche.id}
                  variant={selectedNiche?.id === niche.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedNiche(niche);
                    setSearchResults([]);
                    setSuggestions([]);
                  }}
                  className={selectedNiche?.id === niche.id ? "gradient-viral" : ""}
                >
                  {niche.icon} {niche.name}
                </Button>
              ))}
            </div>

            {/* Search button */}
            <Button
              onClick={handleSearch}
              disabled={searching}
              className="gradient-viral mb-8"
              size="lg"
            >
              {searching ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Buscando no Brasil...</>
              ) : (
                <><Search className="h-4 w-4 mr-2" />Buscar viral de {selectedNiche?.name}</>
              )}
            </Button>

            {/* Content Suggestions */}
            {suggestions.length > 0 && (
              <div className="mb-8 space-y-3">
                <h2 className="text-xl font-bold font-display flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-yellow-500" />
                  Sugestões de Conteúdo
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {suggestions.map((suggestion, i) => (
                    <Card key={i} className="border-primary/10 bg-primary/5">
                      <CardContent className="p-4">
                        <p className="text-sm leading-relaxed">{suggestion}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold font-display flex items-center gap-2">
                  <Video className="h-5 w-5 text-primary" />
                  Conteúdos Encontrados ({searchResults.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {searchResults.map((result, i) => {
                    const thumbnail = extractThumbnail(result.url, result.markdown);
                    const platform = getPlatform(result.url);
                    const colorClass = platformColors[platform] || "bg-muted text-muted-foreground";

                    return (
                      <Card key={i} className="overflow-hidden hover:shadow-lg transition-shadow group">
                        {/* Thumbnail / Cover */}
                        <a
                          href={result.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block relative"
                        >
                          <div className="aspect-video bg-muted relative overflow-hidden">
                            {thumbnail ? (
                              <img
                                src={thumbnail}
                                alt={result.title || "Thumbnail"}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
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
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group/link"
                          >
                            <h3 className="font-semibold text-sm line-clamp-2 group-hover/link:text-primary transition-colors flex items-start gap-1">
                              {result.title || "Sem título"}
                              <ExternalLink className="h-3 w-3 shrink-0 mt-0.5 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                            </h3>
                          </a>
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {result.description}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state after search */}
            {!searching && searchResults.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Clique em buscar para descobrir o que está viralizando no Brasil!</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Trends;
