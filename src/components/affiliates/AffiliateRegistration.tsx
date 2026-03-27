/**
 * AffiliateRegistration
 *
 * Exibido quando o usuário AINDA NÃO é afiliado.
 * Apresenta os benefícios do programa e o botão de adesão imediata.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Link2, TrendingUp, Users, RefreshCcw, ShieldCheck, Zap, DollarSign
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  onRegister: (whatsapp: string, pixKey: string) => Promise<{ error?: string }>;
  registering: boolean;
}

const benefits = [
  {
    icon: <DollarSign className="h-5 w-5 text-emerald-400" />,
    title: '50% de comissão',
    desc: 'Ganhe 50% de cada mensalidade dos seus indicados, direto na sua conta',
  },
  {
    icon: <RefreshCcw className="h-5 w-5 text-blue-400" />,
    title: 'Recorrência automática',
    desc: 'Comissão renovada todo mês enquanto o cliente estiver ativo',
  },
  {
    icon: <Users className="h-5 w-5 text-purple-400" />,
    title: 'Rede de sub-afiliados',
    desc: 'Indique outros afiliados e ganhe % sobre as comissões deles também',
  },
  {
    icon: <TrendingUp className="h-5 w-5 text-orange-400" />,
    title: 'Dashboard completo',
    desc: 'Acompanhe cliques, conversões, saldo disponível e histórico em tempo real',
  },
  {
    icon: <Link2 className="h-5 w-5 text-cyan-400" />,
    title: 'Link exclusivo',
    desc: 'URL rastreada com atribuição permanente de cada indicado',
  },
  {
    icon: <ShieldCheck className="h-5 w-5 text-green-400" />,
    title: 'Saque via PIX',
    desc: 'Solicite seu saldo disponível a qualquer momento diretamente pelo painel',
  },
];

const AffiliateRegistration = ({ onRegister, registering }: Props) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [whatsapp, setWhatsapp] = useState('');
  const [pixKey, setPixKey] = useState('');

  const handleRegister = async () => {
    if (!whatsapp.trim()) {
      toast({ title: 'Informe seu WhatsApp', variant: 'destructive' });
      return;
    }
    if (!pixKey.trim()) {
      toast({ title: 'Informe sua chave PIX', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const result = await onRegister(whatsapp, pixKey);
    setLoading(false);

    if (result.error) {
      toast({
        title: 'Erro ao se cadastrar',
        description: result.error,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Bem-vindo ao programa!',
        description: 'Seu link de afiliado já está pronto. Comece a divulgar!',
      });
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3">
        <Badge
          variant="outline"
          className="border-purple-500/40 text-purple-400 bg-purple-500/10 px-4 py-1"
        >
          Programa de Afiliados
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight">
          Ganhe dinheiro indicando o{' '}
          <span className="text-gradient-viral">ViralFlow</span>
        </h1>
        <p className="text-muted-foreground text-base max-w-xl mx-auto">
          Indique criadores de conteúdo e receba{' '}
          <strong className="text-white">50% de comissão</strong> em cada mensalidade
          paga — automaticamente, todo mês, enquanto o cliente estiver ativo.
        </p>
      </div>

      {/* Benefícios */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {benefits.map((b) => (
          <Card
            key={b.title}
            className="bg-card/50 border border-border/60 hover:border-purple-500/30 transition-colors"
          >
            <CardContent className="flex items-start gap-3 p-4">
              <div className="mt-0.5 flex-shrink-0">{b.icon}</div>
              <div>
                <p className="font-semibold text-sm">{b.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{b.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* CTA */}
      <Card className="bg-gradient-to-br from-purple-900/30 to-indigo-900/20 border border-purple-500/30">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-yellow-400" />
            Cadastro imediato — sem aprovação manual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Seu link de afiliado é gerado instantaneamente</li>
            <li>Sem burocracia, sem espera</li>
            <li>Comece a divulgar agora mesmo</li>
          </ul>

          <div className="space-y-1.5">
            <Label htmlFor="whatsapp" className="text-sm">WhatsApp (com DDD)</Label>
            <Input
              id="whatsapp"
              placeholder="(11) 99999-9999"
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pixKey" className="text-sm">Chave PIX para receber comissões</Label>
            <Input
              id="pixKey"
              placeholder="CPF, e-mail, telefone ou chave aleatória"
              value={pixKey}
              onChange={e => setPixKey(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Usada para transferir suas comissões via PIX
            </p>
          </div>

          <Button
            onClick={handleRegister}
            disabled={loading || registering}
            size="lg"
            className="w-full bg-[hsl(262,83%,58%)] hover:bg-[hsl(262,83%,50%)] text-white font-semibold"
          >
            {loading || registering ? (
              <span className="animate-pulse">Cadastrando...</span>
            ) : (
              <>
                <Zap className="mr-2 h-5 w-5" />
                Cadastrar como afiliado
              </>
            )}
          </Button>
          <p className="text-[11px] text-center text-muted-foreground">
            Ao se cadastrar você concorda com os termos do programa de afiliados.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AffiliateRegistration;
