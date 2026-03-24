/**
 * AffiliateLinkPanel
 *
 * Exibe o link exclusivo do afiliado com opções de:
 * - Copiar link
 * - Compartilhar via navigator.share (mobile)
 * - Visualizar métricas de cliques
 * - Instruções de uso
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Copy, Check, Share2, Link2, Info, MousePointerClick,
  ExternalLink, TrendingUp,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Affiliate, AffiliateDashboardStats } from '@/types/affiliates';

interface Props {
  affiliate: Affiliate;
  stats: AffiliateDashboardStats | null;
}

const AffiliateLinkPanel = ({ affiliate, stats }: Props) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const affiliateUrl = `${window.location.origin}/?ref=${affiliate.ref_code}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(affiliateUrl);
    setCopied(true);
    toast({ title: 'Link copiado!', description: affiliateUrl });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: 'ViralFlow',
        text: 'Use meu link para acessar o ViralFlow com desconto!',
        url: affiliateUrl,
      });
    } else {
      handleCopy();
    }
  };

  const conversionRate =
    stats && stats.totalClicks > 0
      ? ((stats.convertedReferrals / stats.totalClicks) * 100).toFixed(1)
      : '0.0';

  return (
    <div className="space-y-4">
      {/* Link principal */}
      <Card className="bg-gradient-to-br from-purple-900/20 to-indigo-900/10 border border-purple-500/30">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4 text-purple-400" />
            Seu link exclusivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Código de referência */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">Código:</span>
            <Badge
              variant="outline"
              className="font-mono text-base font-bold border-purple-400/50 text-purple-300 px-3 py-1"
            >
              {affiliate.ref_code}
            </Badge>
          </div>

          {/* URL completa */}
          <div className="flex gap-2">
            <Input
              value={affiliateUrl}
              readOnly
              className="font-mono text-xs bg-background/50 border-border/50"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopy}
              className={`flex-shrink-0 transition-colors ${
                copied ? 'border-green-500 text-green-400' : ''
              }`}
              title="Copiar link"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleShare}
              className="flex-shrink-0"
              title="Compartilhar"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Métricas rápidas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card/50 rounded-lg p-3 text-center">
              <MousePointerClick className="h-4 w-4 mx-auto text-cyan-400 mb-1" />
              <p className="text-lg font-bold">{stats?.totalClicks ?? 0}</p>
              <p className="text-[11px] text-muted-foreground">Cliques</p>
            </div>
            <div className="bg-card/50 rounded-lg p-3 text-center">
              <TrendingUp className="h-4 w-4 mx-auto text-purple-400 mb-1" />
              <p className="text-lg font-bold">{stats?.convertedReferrals ?? 0}</p>
              <p className="text-[11px] text-muted-foreground">Conversões</p>
            </div>
            <div className="bg-card/50 rounded-lg p-3 text-center">
              <ExternalLink className="h-4 w-4 mx-auto text-emerald-400 mb-1" />
              <p className="text-lg font-bold">{conversionRate}%</p>
              <p className="text-[11px] text-muted-foreground">Taxa conv.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Como funciona */}
      <Card className="bg-card/50 border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Info className="h-4 w-4 text-blue-400" />
            Como o rastreamento funciona
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-muted-foreground">
            {[
              {
                step: '1',
                text: 'O cliente acessa o ViralFlow pelo seu link (ex: viralflow.app/?ref=' + affiliate.ref_code + ')',
              },
              {
                step: '2',
                text: 'O código de referência é salvo no navegador (localStorage + banco de dados)',
              },
              {
                step: '3',
                text: 'Quando o cliente se cadastra, o vínculo com você é registrado permanentemente — não pode ser perdido',
              },
              {
                step: '4',
                text: 'A cada mensalidade paga pelo cliente, você recebe ' + affiliate.commission_rate + '% de comissão automaticamente',
              },
            ].map((item) => (
              <li key={item.step} className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 text-xs flex items-center justify-center font-bold">
                  {item.step}
                </span>
                <span>{item.text}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      {/* Dicas de divulgação */}
      <Card className="bg-card/50 border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Dicas para divulgar</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
            <li>Use o link na bio do Instagram e TikTok</li>
            <li>Crie um Story com depoimento + o link</li>
            <li>Adicione em grupos de criadores de conteúdo</li>
            <li>Envie em conversas diretas para criadores que você conhece</li>
            <li>Mencione em vídeos sobre produção de conteúdo</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default AffiliateLinkPanel;
