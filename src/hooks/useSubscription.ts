import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type SubscriptionStatus = 'free' | 'active' | 'canceled' | null;

export function useSubscription() {
  const { user } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setStatus(null); setLoading(false); return; }

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

  const isPro = status === 'active';

  const startCheckout = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data, error } = await supabase.functions.invoke('create-checkout', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: {
        success_url: `${window.location.origin}/?checkout=success`,
        cancel_url:  `${window.location.origin}/?checkout=cancel`,
      },
    });

    if (error || !data?.url) {
      console.error('Checkout error:', error ?? data);
      return;
    }

    window.location.href = data.url;
  };

  return { status, isPro, loading, startCheckout };
}
