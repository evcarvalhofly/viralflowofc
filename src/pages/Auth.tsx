import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { attributeReferral } from "@/hooks/useAffiliateTracking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Zap, CheckCircle2 } from "lucide-react";

const fromCheckout = new URLSearchParams(window.location.search).get('checkout') === 'success';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(!fromCheckout); // se veio do checkout → mostra cadastro
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;

        if (signUpData.user?.id) {
          // Verifica se há checkout pendente (fluxo guest: pagou antes de criar conta)
          const { data: checkoutResult } = await (supabase as any).rpc('activate_pending_checkout', {
            p_user_id:    signUpData.user.id,
            p_user_email: email,
          });

          // Atribui afiliado SEMPRE (independente de ter pago antes ou não).
          // A edge function detecta se já tem assinatura ativa e converte o referral imediatamente.
          await attributeReferral(signUpData.user.id);

          if (checkoutResult?.activated) {
            toast({
              title: "Assinatura ativada!",
              description: "Seu plano PRO está ativo. Bem-vindo ao ViralFlow!",
            });
          } else {
            toast({
              title: "Conta criada!",
              description: "Verifique seu email para confirmar o cadastro.",
            });
          }
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2">
            <Zap className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold font-display text-gradient-viral">ViralFlow</h1>
          </div>
          <p className="text-muted-foreground">
            Crie conteúdo viral com inteligência artificial
          </p>
        </div>

        {fromCheckout && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-400">Pagamento confirmado!</p>
              <p className="text-xs text-muted-foreground">Crie sua conta abaixo para acessar o ViralFlow PRO.</p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="font-display">{isLogin ? "Entrar" : "Criar conta"}</CardTitle>
            <CardDescription>
              {isLogin
                ? "Faça login para acessar sua conta"
                : "Preencha os dados para começar"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="displayName">Nome</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Seu nome"
                    required={!isLogin}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full gradient-viral" disabled={loading}>
                {loading ? "Carregando..." : isLogin ? "Entrar" : "Criar conta"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline"
              >
                {isLogin ? "Não tem conta? Criar agora" : "Já tem conta? Fazer login"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
