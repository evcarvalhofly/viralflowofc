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
    if (!session) {
      window.location.href = '/auth';
      return;
    }

    // Usa fetch direto para evitar problemas com o cliente Supabase
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
    const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

    let data: { url?: string; error?: string } | null = null;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      data = await res.json();
      console.log('Checkout response:', data);
    } catch (fetchErr) {
      console.error('Checkout fetch error:', fetchErr);
      toast.error('Erro ao iniciar pagamento', { description: 'Falha de rede. Tente novamente.' });
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
