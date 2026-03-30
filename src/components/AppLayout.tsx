import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Zap, MessageSquare, ClipboardList, TrendingUp,
  FolderOpen, Users, LogOut, Menu, Trophy, Sun, Moon, Film, Home, Scissors, Bell, Handshake
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "next-themes";

type NavItem = {
  label: string;
  icon: React.ReactNode;
  path: string;
  disabled?: boolean;
};

const navItems: NavItem[] = [
  { label: "Início", icon: <Home className="h-5 w-5" />, path: "/" },
  { label: "IA", icon: <MessageSquare className="h-5 w-5" />, path: "/chat" },
  { label: "Planejamento", icon: <ClipboardList className="h-5 w-5" />, path: "/planning" },
  { label: "GameOver", icon: <TrendingUp className="h-5 w-5" />, path: "/gameover" },
  { label: "Vídeos Virais", icon: <Film className="h-5 w-5" />, path: "/viral-videos" },
  { label: "Edição", icon: <FolderOpen className="h-5 w-5" />, path: "/assets" },
  { label: "ViralCut", icon: <Scissors className="h-5 w-5" />, path: "/viralcut" },
  { label: "Comunidade", icon: <Users className="h-5 w-5" />, path: "/community" },
  { label: "Avisos", icon: <Bell className="h-5 w-5" />, path: "/avisos" },
  { label: "Afiliados", icon: <Handshake className="h-5 w-5" />, path: "/affiliates" },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [score, setScore] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.display_name) setDisplayName(data.display_name);

      const { data: scoreData } = await supabase
        .from("user_scores")
        .select("total_score, streak_days")
        .eq("user_id", user.id)
        .maybeSingle();
      if (scoreData) setScore(scoreData.total_score);
    };
    fetchProfile();
  }, [user]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar - always dark background for contrast */}
      <aside className={`
        fixed md:sticky top-0 left-0 z-50 h-[100dvh] w-64
        bg-[hsl(220,25%,10%)] text-[hsl(220,14%,92%)]
        border-r border-[hsl(220,20%,18%)] flex flex-col
        transition-transform duration-200
        ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-2 p-5 border-b border-[hsl(220,20%,18%)]">
          <Zap className="h-6 w-6 text-[hsl(262,83%,58%)]" />
          <span className="text-xl font-bold font-display text-gradient-viral">ViralFlow</span>
        </div>

        {/* User */}
        <div className="px-4 py-3 border-b border-[hsl(220,20%,18%)]">
          <p className="text-sm font-medium truncate text-white">{displayName || user?.email}</p>
          <div className="flex items-center gap-1 text-xs text-[hsl(220,14%,70%)] mt-1">
            <Trophy className="h-3 w-3" />
            <span>{score} pontos</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  if (!item.disabled) {
                    navigate(item.path);
                    setMobileOpen(false);
                  }
                }}
                disabled={item.disabled}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                  ${isActive
                    ? "bg-[hsl(262,83%,58%)] text-white"
                    : "text-[hsl(220,14%,80%)] hover:bg-[hsl(220,20%,16%)] hover:text-white"
                  }
                  ${item.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                `}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.disabled && (
                  <span className="ml-auto text-[10px] uppercase tracking-wider text-[hsl(220,14%,55%)]">Em breve</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 border-t border-[hsl(220,20%,18%)] space-y-1">
          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[hsl(220,14%,70%)] hover:bg-[hsl(220,20%,16%)] hover:text-white transition-colors"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            <span>{theme === "dark" ? "Modo claro" : "Modo escuro"}</span>
          </button>

          {/* Logout */}
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[hsl(220,14%,70%)] hover:bg-[hsl(220,20%,16%)] hover:text-white transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col h-[100dvh] overflow-hidden">
        {/* Mobile header - sticky so it always stays at top */}
        <header className="md:hidden sticky top-0 flex items-center justify-between h-14 px-4 border-b border-border bg-card/80 backdrop-blur-sm shrink-0 z-30">
          <button onClick={() => setMobileOpen(true)}>
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-bold font-display text-gradient-viral">ViralFlow</span>
          </div>
          <div className="w-6" />
        </header>

        <main className="flex-1 min-h-0 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
