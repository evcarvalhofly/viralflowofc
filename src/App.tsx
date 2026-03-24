import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Chat from "./pages/Chat";
import Planning from "./pages/Planning";
import GameOver from "./pages/GameOver";
import ViralVideos from "./pages/ViralVideos";
import Assets from "./pages/Assets";
import ViralCut from "./pages/ViralCut";
import Community from "./pages/Community";
import Avisos from "./pages/Avisos";
import Affiliates from "./pages/Affiliates";
import AppLayout from "./components/AppLayout";
import NotFound from "./pages/NotFound";
import { NotificationPermissionModal } from "./components/NotificationPermissionModal";
import { PWAInstallPrompt } from "./components/PWAInstallPrompt";
import { useBackgroundNotifications } from "./hooks/useBackgroundNotifications";
import { useAffiliateTracking } from "./hooks/useAffiliateTracking";

const queryClient = new QueryClient();

/** Carrega hooks globais e UI de notificação/PWA — só para usuários autenticados */
const AppShell = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [showNotifModal, setShowNotifModal] = useState(false);

  // Escuta eventos Supabase e mostra notificações em background
  useBackgroundNotifications();

  // Rastreia cliques em links de afiliado (?ref=CODIGO na URL)
  useAffiliateTracking();

  // Mostra modal de permissão de notificações quando usuário logado e permissão não concedida
  useEffect(() => {
    if (!user) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') {
      // Pequeno delay para não aparecer imediatamente ao abrir o app
      const t = setTimeout(() => setShowNotifModal(true), 2000);
      return () => clearTimeout(t);
    }
  }, [user?.id]);

  return (
    <>
      {children}
      {showNotifModal && (
        <NotificationPermissionModal onClose={() => setShowNotifModal(false)} />
      )}
      <PWAInstallPrompt />
    </>
  );
};

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-2xl">⚡</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppShell>
              <Routes>
                <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                <Route path="/planning" element={<ProtectedRoute><Planning /></ProtectedRoute>} />
                <Route path="/gameover" element={<ProtectedRoute><GameOver /></ProtectedRoute>} />
                <Route path="/viral-videos" element={<ProtectedRoute><ViralVideos /></ProtectedRoute>} />
                <Route path="/assets" element={<ProtectedRoute><Assets /></ProtectedRoute>} />
                <Route path="/viralcut" element={<ProtectedRoute><ViralCut /></ProtectedRoute>} />
                <Route path="/community" element={<ProtectedRoute><Community /></ProtectedRoute>} />
                <Route path="/avisos" element={<ProtectedRoute><Avisos /></ProtectedRoute>} />
                <Route path="/affiliates" element={<ProtectedRoute><Affiliates /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </AppShell>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
