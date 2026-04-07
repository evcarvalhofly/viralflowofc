import { useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/** Envia uma notificação via Service Worker quando a aba está em fundo */
async function showBgNotification(title: string, body: string, url: string, tag: string) {
  if (Notification.permission !== 'granted') return;
  if (document.visibilityState !== 'hidden') return; // só quando aba está oculta

  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg.active) {
      reg.active.postMessage({ type: 'SHOW_NOTIFICATION', title, body, url, tag });
    }
  } catch {
    // silently fail
  }
}

/** Escuta eventos do Supabase Realtime e mostra notificações em background */
export const useBackgroundNotifications = () => {
  const { user } = useAuth();

  // Listener para push de aviso recebido pelo Service Worker
  useEffect(() => {
    if (!user || !('serviceWorker' in navigator)) return;

    const handleSwMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'PUSH_AVISO') return;
      const d = event.data.data ?? {};
      toast.info(d.title ?? '📢 Novo aviso', {
        description: d.body ?? '',
        duration: 8000,
      });
    };

    navigator.serviceWorker.addEventListener('message', handleSwMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
  }, [user?.id]);

  useEffect(() => {
    if (!user || !('serviceWorker' in navigator)) return;

    // ── Novas mensagens diretas ─────────────────────────────────────
    const msgChannel = (supabase as any)
      .channel('bg_direct_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', payload.new.sender_id)
            .maybeSingle();

          const name = (profile as any)?.display_name ?? 'Alguém';
          const preview = (payload.new.content as string)?.slice(0, 80) ?? '';

          showBgNotification(
            `💬 Nova mensagem de ${name}`,
            preview,
            '/community',
            `msg_${payload.new.sender_id}`
          );
        }
      )
      .subscribe();

    // ── Novos pedidos de amizade ────────────────────────────────────
    const friendChannel = (supabase as any)
      .channel('bg_friendships')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'friendships',
          filter: `friend_id=eq.${user.id}`,
        },
        async (payload: any) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('user_id', payload.new.user_id)
            .maybeSingle();

          const name = (profile as any)?.display_name ?? 'Alguém';

          showBgNotification(
            '👤 Solicitação de amizade',
            `${name} quer ser seu amigo na comunidade!`,
            '/community',
            `friend_${payload.new.id}`
          );
        }
      )
      .subscribe();

    // ── Novos avisos (todos os usuários) ───────────────────────────
    const avisosChannel = (supabase as any)
      .channel('bg_avisos')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'avisos' },
        (payload: any) => {
          const preview = (payload.new.content as string)?.slice(0, 100) ?? 'Novo aviso publicado';
          showBgNotification(
            '📢 Novo aviso da ViralFlow',
            preview,
            '/avisos',
            `aviso_${payload.new.id}`
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(friendChannel);
      supabase.removeChannel(avisosChannel);
    };
  }, [user?.id]);
};
