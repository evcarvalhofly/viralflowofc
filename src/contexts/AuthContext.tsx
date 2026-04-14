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
  const sessionCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkSession = async (userId: string) => {
    const localSid = localStorage.getItem(SESSION_KEY);
    if (!localSid) return;
    const { data } = await supabase
      .from('profiles')
      .select('current_session_id')
      .eq('user_id', userId)
      .single();
    if (data && data.current_session_id && data.current_session_id !== localSid) {
      localStorage.removeItem(SESSION_KEY);
      await supabase.auth.signOut();
    }
  };

  const startSessionGuard = (userId: string) => {
    if (sessionCheckRef.current) clearInterval(sessionCheckRef.current);
    sessionCheckRef.current = setInterval(() => checkSession(userId), 5 * 60 * 1000);

    const onVisibilityChange = () => {
      if (!document.hidden) checkSession(userId);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (sessionCheckRef.current) clearInterval(sessionCheckRef.current);
    };
  };

  useEffect(() => {
    let stopGuard: (() => void) | null = null;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setLoading(false);

        if (event === 'SIGNED_IN' && session) {
          const existingSid = localStorage.getItem(SESSION_KEY);
          if (!existingSid) {
            // Fresh login only — token refreshes also fire SIGNED_IN but must not overwrite the session ID
            const sid = crypto.randomUUID();
            localStorage.setItem(SESSION_KEY, sid);
            supabase.from('profiles')
              .update({ current_session_id: sid })
              .eq('user_id', session.user.id)
              .then(() => {});
          }
          if (stopGuard) stopGuard();
          stopGuard = startSessionGuard(session.user.id);
        }

        if (event === 'SIGNED_OUT') {
          localStorage.removeItem(SESSION_KEY);
          if (stopGuard) { stopGuard(); stopGuard = null; }
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) {
        stopGuard = startSessionGuard(session.user.id);
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
