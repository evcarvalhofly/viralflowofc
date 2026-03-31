import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type SubscriptionStatus = 'free' | 'active' | 'canceled' | null;

export function useSubscription() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setStatus(null); setLoading(false); return; }

    setLoading(true);
    let ignore = false;

    const fetch = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('subscription_status')
        .eq('user_id', user.id)
        .single();
      if (!ignore) {
        setStatus((data?.subscription_status as SubscriptionStatus) ?? 'free');
        setLoading(false);
      }
    };

    fetch();

    // Realtime: atualiza imediatamente após webhook confirmar pagamento
    const channel = supabase
      .channel('subscription-status')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const s = payload.new?.subscription_status as SubscriptionStatus;
        if (s) setStatus(s);
      })
      .subscribe();

    return () => { ignore = true; supabase.removeChannel(channel); };
  }, [user]);

  const isPro = status === 'active' || user?.email === 'evcarvalhodev@gmail.com';

  const startCheckout = async (guestEmail?: string) => {
    const { data: { session } } = await supabase.auth.getSession();

    const isGuest = !session;
    const refCode = isGuest ? (localStorage.getItem('vf_ref') ?? null) : null;

    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { ref_code: refCode, email: isGuest ? (guestEmail ?? null) : null },
    });

    if (error) {
      console.error('Checkout error:', error);
      const errName = (error as { name?: string }).name ?? 'Error';
      const errMsg  = (error as { message?: string }).message ?? String(error);
      toast.error('Erro ao iniciar pagamento', { description: `[${errName}] ${errMsg}` });
      return;
    }

    if (data?.error) {
      console.error('Checkout MP error:', data.error);
      toast.error('Erro ao iniciar pagamento', { description: String(data.error) });
      return;
    }

    if (!data?.url) {
      console.error('Checkout: no URL returned', data);
      toast.error('Erro ao iniciar pagamento', { description: JSON.stringify(data) });
      return;
    }

    window.location.href = data.url;
  };

  return { status, isPro, loading, startCheckout };
}
