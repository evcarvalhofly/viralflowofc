import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = 'vf_sid';
const ADMIN_EMAIL = 'evcarvalhodev@gmail.com';
const POLL_INTERVAL_MS = 10_000; // verifica a cada 10 segundos

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAdmin = (email?: string) => email === ADMIN_EMAIL;

  // ── Força sign-out (sessão foi tomada por outro dispositivo) ─────────
  const forceSignOut = async () => {
    localStorage.removeItem(SESSION_KEY);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
    await supabase.auth.signOut();
  };

  // ── Verifica no banco se o current_session_id mudou (polling) ───────
  const checkSessionInDB = async (userId: string) => {
    const localSid = localStorage.getItem(SESSION_KEY);
    if (!localSid) return; // sem SID local, nada a comparar

    const { data } = await supabase
      .from('profiles')
      .select('current_session_id')
      .eq('user_id', userId)
      .single();

    if (data?.current_session_id && data.current_session_id !== localSid) {
      console.warn('[SessionGuard] Sessão diferente detectada via polling. Deslogando...');
      forceSignOut();
    }
  };

  // ── Inicia o guard: Realtime + Polling ──────────────────────────────
  const startGuard = (userId: string) => {
    // 1) Realtime: detecção instantânea
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
    }

    const channel = supabase
      .channel(`session_guard:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newSid = (payload.new as { current_session_id?: string }).current_session_id;
          const localSid = localStorage.getItem(SESSION_KEY);
          if (localSid && newSid && newSid !== localSid) {
            console.warn('[SessionGuard] Sessão diferente detectada via Realtime. Deslogando...');
            forceSignOut();
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    // 2) Polling: fallback caso WebSocket falhe
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => checkSessionInDB(userId), POLL_INTERVAL_MS);

    return () => {
      supabase.removeChannel(channel);
      realtimeChannelRef.current = null;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  };

  // ── Registra a sessão no banco (claim ownership) ────────────────────
  const claimSession = async (userId: string) => {
    const sid = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, sid);

    const { error } = await supabase
      .from('profiles')
      .update({ current_session_id: sid })
      .eq('user_id', userId);

    if (error) {
      console.error('[SessionGuard] Erro ao gravar current_session_id:', error.message);
    }

    return sid;
  };

  useEffect(() => {
    let stopGuard: (() => void) | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setLoading(false);

        if (event === 'SIGNED_IN' && session) {
          // Admin pode acessar de múltiplos dispositivos
          if (isAdmin(session.user.email ?? undefined)) return;

          // Novo login: claim ownership e iniciar guard
          claimSession(session.user.id).then(() => {
            if (stopGuard) stopGuard();
            stopGuard = startGuard(session.user.id);
          });
        }

        if (event === 'SIGNED_OUT') {
          localStorage.removeItem(SESSION_KEY);
          if (stopGuard) { stopGuard(); stopGuard = null; }
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setLoading(false);

      if (!session) return;

      // Admin pula o guard
      if (isAdmin(session.user.email ?? undefined)) return;

      const existingSid = localStorage.getItem(SESSION_KEY);

      if (!existingSid) {
        // Primeira carga: herda SID do banco ou claim
        const { data } = await supabase
          .from('profiles')
          .select('current_session_id')
          .eq('user_id', session.user.id)
          .single();

        if (data?.current_session_id) {
          localStorage.setItem(SESSION_KEY, data.current_session_id);
        } else {
          await claimSession(session.user.id);
        }
      }

      // Sempre inicia o guard (Realtime + Polling)
      if (!stopGuard) {
        stopGuard = startGuard(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (stopGuard) stopGuard();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
