import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Check, Zap, LogOut, StickyNote, MessageSquare, ClipboardList } from "lucide-react";

type Niche = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
};

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [niches, setNiches] = useState<Niche[]>([]);
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [userNicheIds, setUserNicheIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [nichesRes, userNichesRes] = await Promise.all([
        supabase.from("niches").select("*").order("name"),
        supabase.from("user_niches").select("niche_id"),
      ]);

      if (nichesRes.data) setNiches(nichesRes.data);
      if (userNichesRes.data) {
        const ids = userNichesRes.data.map((un) => un.niche_id);
        setSelectedNiches(ids);
        setUserNicheIds(ids);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  const toggleNiche = (nicheId: string) => {
    setSelectedNiches((prev) =>
      prev.includes(nicheId)
        ? prev.filter((id) => id !== nicheId)
        : [...prev, nicheId]
    );
  };

  const saveNiches = async () => {
    if (!user) return;
    setSaving(true);

    // Remove deselected
    const toRemove = userNicheIds.filter((id) => !selectedNiches.includes(id));
    const toAdd = selectedNiches.filter((id) => !userNicheIds.includes(id));

    if (toRemove.length > 0) {
      await supabase
        .from("user_niches")
        .delete()
        .in("niche_id", toRemove)
        .eq("user_id", user.id);
    }

    if (toAdd.length > 0) {
      await supabase
        .from("user_niches")
        .insert(toAdd.map((niche_id) => ({ user_id: user.id, niche_id })));
    }

    setUserNicheIds(selectedNiches);
    setSaving(false);
    toast({ title: "Nichos atualizados!", description: "Seus nichos foram salvos com sucesso." });
  };

  const hasChanges = JSON.stringify([...selectedNiches].sort()) !== JSON.stringify([...userNicheIds].sort());

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse-glow">
          <Zap className="h-12 w-12 text-primary" />
        </div>
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

      {/* Main */}
      <main className="container px-4 py-10 max-w-4xl">
        <div className="space-y-2 mb-8">
          <h1 className="text-3xl font-bold font-display">Escolha seus nichos</h1>
          <p className="text-muted-foreground">
            Selecione as áreas de conteúdo que você quer acompanhar. A IA vai buscar tendências virais para cada uma.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {niches.map((niche) => {
            const isSelected = selectedNiches.includes(niche.id);
            return (
              <Card
                key={niche.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                  isSelected
                    ? "ring-2 ring-primary bg-primary/5"
                    : "hover:border-primary/30"
                }`}
                onClick={() => toggleNiche(niche.id)}
              >
                <CardContent className="p-4 flex flex-col items-center text-center gap-2 relative">
                  {isSelected && (
                    <div className="absolute top-2 right-2 h-5 w-5 rounded-full gradient-viral flex items-center justify-center">
                      <Check className="h-3 w-3 text-primary-foreground" />
                    </div>
                  )}
                  <span className="text-2xl">{niche.icon}</span>
                  <span className="font-medium text-sm font-display">{niche.name}</span>
                  {niche.description && (
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {niche.description}
                    </span>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {hasChanges && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <Button
              onClick={saveNiches}
              disabled={saving}
              className="gradient-viral shadow-lg px-8 h-12 text-base font-display"
            >
              {saving ? "Salvando..." : `Salvar ${selectedNiches.length} nicho(s)`}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
