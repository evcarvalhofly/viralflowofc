import { useState, useEffect, useRef, useCallback } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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
import { useSaleNotifications } from "./hooks/useSaleNotifications";
import { usePushSubscription } from "./hooks/usePushSubscription";
import { useAffiliateTracking } from "./hooks/useAffiliateTracking";
import { useCheckoutReturn } from "./hooks/useCheckoutReturn";
import { useSubscription } from "./hooks/useSubscription";
import PlanoPro from "./pages/PlanoPro";
import Convite from "./pages/Convite";
import MinhaConta from "./pages/MinhaConta";
import Parabens from "./pages/Parabens";
import ResetPassword from "./pages/ResetPassword";
import { SubscriptionExpiredWall } from "./components/SubscriptionExpiredWall";
import PainelGeralAdm from "./pages/PainelGeralAdm";
import { CheckoutModal } from "./components/CheckoutModal";

const queryClient = new QueryClient();

/** Carrega hooks globais e UI de notificação/PWA — só para usuários autenticados */
const AppShell = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(
    () => localStorage.getItem('vf_checkout_open') === '1',
  );
  const [checkoutPlan, setCheckoutPlan] = useState<'monthly' | 'annual'>(
    () => (localStorage.getItem('vf_checkout_plan') as 'monthly' | 'annual') || 'annual',
  );
  const successRedirectRef = useRef('/');

  const BLOCKED_PATHS = ['/planopro', '/convite', '/parabens', '/reset-password'];

  // Escuta eventos Supabase e mostra notificações em background
  useBackgroundNotifications();

  // Notificações de venda com som (afiliados + admin)
  useSaleNotifications();

  // Inscrição para Web Push (notificações mesmo com app fechado)
  usePushSubscription();

  // Rastreia cliques em links de afiliado (?ref=CODIGO na URL)
  useAffiliateTracking();

  // Trata retorno do Checkout (?checkout=success/cancel)
  useCheckoutReturn();

  // Abre checkout de qualquer página via CustomEvent
  useEffect(() => {
    const handler = (e: Event) => {
      const { plan = 'annual', successRedirect = '/' } = (e as CustomEvent).detail ?? {};
      localStorage.setItem('vf_checkout_open', '1');
      localStorage.setItem('vf_checkout_plan', plan);
      successRedirectRef.current = successRedirect;
      setCheckoutPlan(plan);
      setCheckoutOpen(true);
    };
    window.addEventListener('open-checkout', handler);
    return () => window.removeEventListener('open-checkout', handler);
  }, []);

  const closeCheckout = useCallback(() => {
    localStorage.removeItem('vf_checkout_open');
    localStorage.removeItem('vf_checkout_plan');
    setCheckoutOpen(false);
  }, []);

  const handleCheckoutSuccess = useCallback(() => {
    localStorage.removeItem('vf_checkout_open');
    localStorage.removeItem('vf_checkout_plan');
    setCheckoutOpen(false);
    window.location.href = successRedirectRef.current;
  }, []);

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
      {showNotifModal && !BLOCKED_PATHS.includes(pathname) && (
        <NotificationPermissionModal onClose={() => setShowNotifModal(false)} />
      )}
      {!BLOCKED_PATHS.includes(pathname) && <PWAInstallPrompt />}
      {checkoutOpen && (
        <CheckoutModal
          onClose={closeCheckout}
          onSuccess={handleCheckoutSuccess}
          initialPlan={checkoutPlan}
        />
      )}
    </>
  );
};

/** Exige autenticação + assinatura PRO ativa. Redireciona para /planopro se nunca assinou. */
const ProRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const { isPro, isExpired, loading: subLoading, status } = useSubscription();

  // status===null com user presente = fetch de subscription ainda não completou (race condition entre auth e subscription)
  if (authLoading || subLoading || (!!user && status === null)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-primary text-2xl">⚡</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  // Assinatura vencida: mantém no app com parede de renovação (não redireciona)
  if (isExpired) return <AppLayout><SubscriptionExpiredWall /></AppLayout>;
  // Nunca assinou: redireciona para página de plano
  if (!isPro) return <Navigate to="/planopro" replace />;
  return <AppLayout>{children}</AppLayout>;
};

const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
};

/** Exige apenas autenticação (sem verificar PRO). Usado para páginas como Minha Conta. */
const AccountRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="animate-pulse text-primary text-2xl">⚡</div>
    </div>
  );
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
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
                {/* Público */}
                <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
                <Route path="/parabens" element={<Parabens />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/convite" element={<Convite />} />
                <Route path="/planopro" element={<PlanoPro />} />

                {/* Conta (só auth, sem PRO obrigatório) */}
                <Route path="/minha-conta" element={<AccountRoute><MinhaConta /></AccountRoute>} />

                {/* Requer PRO */}
                <Route path="/" element={<ProRoute><Home /></ProRoute>} />
                <Route path="/chat" element={<ProRoute><Chat /></ProRoute>} />
                <Route path="/planning" element={<ProRoute><Planning /></ProRoute>} />
                <Route path="/gameover" element={<ProRoute><GameOver /></ProRoute>} />
                <Route path="/viral-videos" element={<ProRoute><ViralVideos /></ProRoute>} />
                <Route path="/assets" element={<ProRoute><Assets /></ProRoute>} />
                <Route path="/viralcut" element={<ProRoute><ViralCut /></ProRoute>} />
                <Route path="/community" element={<ProRoute><Community /></ProRoute>} />
                <Route path="/avisos" element={<ProRoute><Avisos /></ProRoute>} />
                <Route path="/affiliates" element={<ProRoute><Affiliates /></ProRoute>} />
                {/* Painel ADM (sem AppLayout, acesso direto) */}
                <Route path="/painelgeraladm" element={<PainelGeralAdm />} />
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
