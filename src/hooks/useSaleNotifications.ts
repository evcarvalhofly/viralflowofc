import { useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/** Som de dinheiro / caixa registradora via Web Audio API */
function playMoneySound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    const coin = (freq: number, start: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + 0.12);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + 0.14);
    };

    // Sequência de moedas subindo
    coin(1200, 0.0);
    coin(1500, 0.07);
    coin(1800, 0.14);
    coin(2200, 0.21);
    coin(2600, 0.28);

    // "Ding" final mais alto
    const ding = ctx.createOscillator();
    const dingGain = ctx.createGain();
    ding.connect(dingGain);
    dingGain.connect(ctx.destination);
    ding.type = 'sine';
    ding.frequency.value = 3200;
    dingGain.gain.setValueAtTime(0.25, ctx.currentTime + 0.35);
    dingGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    ding.start(ctx.currentTime + 0.35);
    ding.stop(ctx.currentTime + 0.85);
  } catch {
    // AudioContext não disponível
  }
}

export const useSaleNotifications = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const channel = (supabase as any)
      .channel(`sale_notifications_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sale_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const n = payload.new;
          const amount: number = n.amount;
          const netAmount: number = n.net_amount;
          const plan: string = n.plan === 'annual' ? 'Anual' : 'Mensal';
          const isAffiliate: boolean = n.is_affiliate_sale;
          const affiliateName: string | null = n.affiliate_name;

          playMoneySound();

          const isAdmin = user.email === 'evcarvalhodev@gmail.com';

          if (isAdmin) {
            // Admin vê valor bruto, líquido e se veio de afiliado
            if (isAffiliate) {
              toast.success(
                `💰 Nova venda! R$${amount.toFixed(2).replace('.', ',')} → líquido R$${netAmount.toFixed(2).replace('.', ',')}`,
                {
                  description: `Plano ${plan} · Via afiliado: ${affiliateName ?? 'desconhecido'}`,
                  duration: 8000,
                }
              );
            } else {
              toast.success(
                `💰 Nova venda! R$${amount.toFixed(2).replace('.', ',')}`,
                {
                  description: `Plano ${plan} · Venda direta`,
                  duration: 8000,
                }
              );
            }
          } else {
            // Afiliado vê só a comissão dele
            toast.success(
              `💰 Nova venda! +R$${netAmount.toFixed(2).replace('.', ',')}`,
              {
                description: `Plano ${plan} · Comissão creditada`,
                duration: 8000,
              }
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
};
