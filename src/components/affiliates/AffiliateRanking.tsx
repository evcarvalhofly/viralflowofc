/**
 * AffiliateRanking
 *
 * Leaderboard dos top afiliados.
 * Dados via função SQL `get_affiliate_ranking()` (SECURITY DEFINER).
 */

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Medal, Crown, RefreshCcw } from 'lucide-react';
import { useAffiliateRanking } from '@/hooks/useAffiliateRanking';
import type { Affiliate } from '@/types/affiliates';

interface Props {
  currentAffiliate: Affiliate | null;
}

const positionIcons: Record<number, React.ReactNode> = {
  1: <Crown className="h-4 w-4 text-yellow-400" />,
  2: <Medal className="h-4 w-4 text-slate-300" />,
  3: <Medal className="h-4 w-4 text-amber-600" />,
};

const positionColors: Record<number, string> = {
  1: 'border-yellow-400/40 bg-yellow-400/5',
  2: 'border-slate-400/30 bg-slate-400/5',
  3: 'border-amber-600/30 bg-amber-600/5',
};

const fmt = (val: number) =>
  `R$ ${Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const AffiliateRanking = ({ currentAffiliate }: Props) => {
  const { ranking, loading, error, refetch } = useAffiliateRanking();

  const myPosition = currentAffiliate
    ? ranking.findIndex(r => r.affiliate_id === currentAffiliate.id) + 1
    : 0;

  return (
    <div className="space-y-4">
      {/* Minha posição */}
      {myPosition > 0 && (
        <Card className="bg-gradient-to-r from-purple-900/30 to-indigo-900/20 border border-purple-500/30">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <Trophy className="h-5 w-5 text-purple-400" />
              <div>
                <p className="font-semibold text-sm">Sua posição no ranking</p>
                <p className="text-xs text-muted-foreground">
                  Código: {currentAffiliate?.ref_code}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black text-purple-300">#{myPosition}</p>
              <p className="text-xs text-muted-foreground">de {ranking.length}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de ranking */}
      <Card className="bg-card/50 border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4 text-yellow-400" />
              Top Afiliados
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={refetch}
              title="Atualizar"
            >
              <RefreshCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pb-4">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))
          ) : error ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              <p>Erro ao carregar ranking.</p>
              <Button variant="ghost" size="sm" onClick={refetch} className="mt-2">
                Tentar novamente
              </Button>
            </div>
          ) : ranking.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              <Trophy className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Nenhum afiliado ainda. Seja o primeiro!</p>
            </div>
          ) : (
            ranking.map((entry, idx) => {
              const pos = idx + 1;
              const isMe = currentAffiliate?.id === entry.affiliate_id;
              return (
                <div
                  key={entry.affiliate_id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    isMe
                      ? 'border-purple-500/50 bg-purple-500/10'
                      : positionColors[pos] ?? 'border-border/40 bg-card/30 hover:bg-card/50'
                  }`}
                >
                  {/* Posição */}
                  <div className="w-8 flex-shrink-0 flex items-center justify-center">
                    {positionIcons[pos] ?? (
                      <span className="text-sm font-bold text-muted-foreground">
                        #{pos}
                      </span>
                    )}
                  </div>

                  {/* Avatar */}
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={entry.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs">
                      {(entry.display_name ?? entry.ref_code).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Nome e código */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">
                        {entry.display_name ?? entry.ref_code}
                      </p>
                      {isMe && (
                        <Badge
                          variant="outline"
                          className="text-[9px] border-purple-400/50 text-purple-300 h-4 px-1.5"
                        >
                          você
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{entry.ref_code}</p>
                  </div>

                  {/* Métricas */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-emerald-400">
                      {fmt(entry.total_earned)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {entry.active_clients} cliente{entry.active_clients !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AffiliateRanking;
