import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { attributeReferral } from "@/hooks/useAffiliateTracking";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Zap, CheckCircle2, Loader2, MessageCircle, Eye, EyeOff
} from "lucide-react";

const WA_NUMBER = "5512992275476";

const Parabens = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const emailParam = params.get("email") ?? "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState(emailParam);
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  // Se já está logado, redireciona para home
  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast({ title: "Informe seu nome", variant: "destructive" }); return; }
    if (!email || !email.includes("@")) { toast({ title: "E-mail inválido", variant: "destructive" }); return; }
    if (password.length < 6) { toast({ title: "Senha muito curta", description: "Mínimo 6 caracteres", variant: "destructive" }); return; }

    setLoading(true);
    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;

      if (signUpData.user?.id) {
        await (supabase as any).rpc("activate_pending_checkout", {
          p_user_id: signUpData.user.id,
          p_user_email: email,
        });
        await attributeReferral(signUpData.user.id);
        sessionStorage.removeItem("vf_pix_data");
      }

      toast({
        title: "Conta criada!",
        description: "Bem-vindo ao ViralFlow PRO 🎉",
      });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center p-4">

      {/* Logo */}
      <div className="flex items-center gap-2 mb-8">
        <Zap className="h-8 w-8 text-[hsl(262,83%,58%)]" />
        <span className="text-3xl font-bold font-display text-gradient-viral">ViralFlow</span>
      </div>

      {/* Status banner */}
      <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 mb-6 w-full max-w-md">
        <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-emerald-400">Pagamento confirmado!</p>
          <p className="text-xs text-muted-foreground">Crie sua conta abaixo para acessar o ViralFlow PRO.</p>
        </div>
      </div>

      {/* Signup form */}
      <div className="w-full max-w-md bg-[#13131a] border border-white/10 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white mb-1">Criar conta</h2>
        <p className="text-sm text-muted-foreground mb-5">Preencha os dados para começar</p>

        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white">Nome</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Seu nome"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-muted-foreground text-sm focus:outline-none focus:border-violet-500/60 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white">
              Email <span className="text-violet-400 text-xs">(mesmo usado no pagamento)</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-muted-foreground text-sm focus:outline-none focus:border-violet-500/60 transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-white">Senha</label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 pr-10 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-muted-foreground text-sm focus:outline-none focus:border-violet-500/60 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-pink-500 text-white font-bold text-sm disabled:opacity-60 hover:from-violet-500 hover:to-pink-400 transition-all active:scale-95"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Criando conta..." : "Criar conta"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Já tem conta?{" "}
          <button
            onClick={() => navigate("/auth")}
            className="text-violet-400 hover:text-violet-300 transition-colors"
          >
            Fazer login
          </button>
        </p>
      </div>

      {/* WhatsApp support */}
      <a
        href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent("Olá! Preciso de suporte com o ViralFlow.")}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 mt-5 px-5 py-2.5 rounded-full bg-[#25D366]/10 border border-[#25D366]/30 text-[#25D366] text-sm font-medium hover:bg-[#25D366]/20 transition-colors"
      >
        <MessageCircle className="h-4 w-4" />
        Suporte via WhatsApp
      </a>
    </div>
  );
};

export default Parabens;
