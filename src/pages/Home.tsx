import { useNavigate } from "react-router-dom";
import { MessageSquare, ClipboardList, TrendingUp, Film, FolderOpen, Users, Zap, Scissors, Store } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const modules = [
  {
    label: "IA",
    description: "Converse com a IA para criar conteúdo viral",
    icon: MessageSquare,
    path: "/chat",
    gradient: "from-[hsl(262,83%,58%)] to-[hsl(280,70%,45%)]",
    glow: "hsl(262,83%,58%)",
    emoji: "🤖",
    available: true,
  },
  {
    label: "Planejamento",
    description: "Organize sua agenda de conteúdo",
    icon: ClipboardList,
    path: "/planning",
    gradient: "from-[hsl(210,80%,50%)] to-[hsl(230,70%,40%)]",
    glow: "hsl(210,80%,50%)",
    emoji: "📋",
    available: true,
  },
  {
    label: "GameOver",
    description: "Acompanhe sua pontuação e conquistas",
    icon: TrendingUp,
    path: "/gameover",
    gradient: "from-[hsl(330,81%,60%)] to-[hsl(350,70%,45%)]",
    glow: "hsl(330,81%,60%)",
    emoji: "🏆",
    available: true,
  },
  {
    label: "Vídeos Virais",
    description: "Descubra os vídeos em alta agora",
    icon: Film,
    path: "/viral-videos",
    gradient: "from-[hsl(25,90%,55%)] to-[hsl(10,80%,45%)]",
    glow: "hsl(25,90%,55%)",
    emoji: "🎬",
    available: true,
  },
  {
    label: "Edição",
    description: "Acesse seus assets e recursos criativos",
    icon: FolderOpen,
    path: "/assets",
    gradient: "from-[hsl(160,70%,40%)] to-[hsl(180,60%,30%)]",
    glow: "hsl(160,70%,40%)",
    emoji: "✂️",
    available: true,
  },
  {
    label: "ViralCut",
    description: "Editor de vídeo rápido para criadores",
    icon: Scissors,
    path: "/viralcut",
    gradient: "from-[hsl(340,80%,55%)] to-[hsl(15,80%,45%)]",
    glow: "hsl(340,80%,55%)",
    emoji: "🎞️",
    available: true,
  },
  {
    label: "Comunidade",
    description: "Conecte-se com outros criadores",
    icon: Users,
    path: "/community",
    gradient: "from-[hsl(220,20%,35%)] to-[hsl(220,20%,25%)]",
    glow: "hsl(220,20%,35%)",
    emoji: "👥",
    available: false,
  },
];

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.display_name) setDisplayName(data.display_name);
    };
    fetchProfile();
  }, [user]);

  const firstName = displayName
    ? displayName.split(" ")[0]
    : user?.email?.split("@")[0] ?? "";

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 py-8 md:py-12">
        {/* Header */}
        <div className="mb-8 md:mb-10">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">ViralFlow</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold font-display">
            Olá, <span className="text-gradient-viral">{firstName}</span> 👋
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            O que vamos criar hoje?
          </p>
        </div>

        {/* Grid de módulos */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <button
                key={mod.path}
                onClick={() => mod.available && navigate(mod.path)}
                disabled={!mod.available}
                className={cn(
                  "group relative flex flex-col items-start justify-between",
                  "rounded-2xl p-5 md:p-6 text-left",
                  "border border-border bg-card",
                  "transition-all duration-300",
                  mod.available
                    ? "hover:scale-[1.03] hover:shadow-xl cursor-pointer"
                    : "opacity-50 cursor-not-allowed"
                )}
                style={
                  mod.available
                    ? ({ "--glow": mod.glow } as React.CSSProperties)
                    : undefined
                }
              >
                {/* Gradient overlay on hover */}
                {mod.available && (
                  <div
                    className={cn(
                      "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-300 bg-gradient-to-br",
                      mod.gradient
                    )}
                  />
                )}

                {/* Em breve badge */}
                {!mod.available && (
                  <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wider font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                    Em breve
                  </span>
                )}

                {/* Icon */}
                <div
                  className={cn(
                    "mb-4 flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-xl bg-gradient-to-br text-white text-xl md:text-2xl transition-transform duration-300 group-hover:scale-110",
                    mod.gradient
                  )}
                >
                  {mod.emoji}
                </div>

                {/* Text */}
                <div>
                  <h2 className="text-base md:text-lg font-bold font-display text-card-foreground group-hover:text-primary transition-colors">
                    {mod.label}
                  </h2>
                  <p className="text-xs md:text-sm text-muted-foreground mt-0.5 leading-snug">
                    {mod.description}
                  </p>
                </div>

                {/* Arrow on hover */}
                {mod.available && (
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-1 group-hover:translate-x-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Home;
