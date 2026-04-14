import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = 'vf_sid';

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

  const forceSignOut = async () => {
    localStorage.removeItem(SESSION_KEY);
    await supabase.auth.signOut();
  };

  const startRealtimeGuard = (userId: string) => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
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
            forceSignOut();
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      realtimeChannelRef.current = null;
    };
  };

  useEffect(() => {
    let stopRealtime: (() => void) | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setLoading(false);

        if (event === 'SIGNED_IN' && session) {
          const sid = crypto.randomUUID();
          localStorage.setItem(SESSION_KEY, sid);
          supabase.from('profiles')
            .update({ current_session_id: sid })
            .eq('user_id', session.user.id)
            .then(() => {});
          if (stopRealtime) stopRealtime();
          stopRealtime = startRealtimeGuard(session.user.id);
        }

        if (event === 'SIGNED_OUT') {
          localStorage.removeItem(SESSION_KEY);
          if (stopRealtime) { stopRealtime(); stopRealtime = null; }
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) {
        const existingSid = localStorage.getItem(SESSION_KEY);
        if (!existingSid) {
          // New tab or first load: inherit session from DB so realtime works correctly
          const { data } = await supabase
            .from('profiles')
            .select('current_session_id')
            .eq('user_id', session.user.id)
            .single();
          if (data?.current_session_id) {
            localStorage.setItem(SESSION_KEY, data.current_session_id);
          } else {
            // Legacy: no session tracked yet — claim ownership
            const sid = crypto.randomUUID();
            localStorage.setItem(SESSION_KEY, sid);
            supabase.from('profiles')
              .update({ current_session_id: sid })
              .eq('user_id', session.user.id)
              .then(() => {});
          }
        }
        if (!stopRealtime) {
          stopRealtime = startRealtimeGuard(session.user.id);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      if (stopRealtime) stopRealtime();
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
