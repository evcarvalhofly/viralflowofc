import { useState, useEffect, useCallback, useMemo } from 'react';
import CommunityMap from '@/components/community/CommunityMap';
import EditProfileModal from '@/components/community/EditProfileModal';
import { ShoppingPanel } from '@/components/community/ShoppingPanel';
import { LevelUpModal } from '@/components/community/LevelUpModal';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Bell } from 'lucide-react';
import { NotificationsPanel } from '@/components/community/NotificationsPanel';
import { useLevelProgression, LevelUpEvent } from '@/hooks/useLevelProgression';
import { LevelProgressBar } from '@/components/community/LevelProgressBar';

// Users are considered online if last_seen_at is within this many milliseconds.
// 120s gives enough headroom for browser background-tab timer throttling (~60s effective interval).
const ONLINE_THRESHOLD_MS = 120_000; // 2 minutes

const Community = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showShopping, setShowShopping] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [levelUpEvent, setLevelUpEvent] = useState<LevelUpEvent | null>(null);
  // Tick every 30s so the online-status derived from last_seen_at stays current
  const [tick, setTick] = useState(0);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .not('subscription_expires_at', 'is', null);
    if (!error && data) {
      const validProfiles = data.filter((p: any) => p.pos_x !== null && p.pos_y !== null);
      setProfiles(validProfiles);
    }
  }, []);

  const loadNotificationCount = useCallback(async (userId: string, email?: string) => {
    const db = supabase as any;

    const { count: pendingCount } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('friend_id', userId)
      .eq('status', 'pending');

    const { count: acceptedCount } = await db
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'accepted')
      .eq('sender_notified', false);

    const { count: unreadCount } = await db
      .from('direct_messages')
      .select('*', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .is('read_at', null);

    let total = (pendingCount || 0) + (acceptedCount || 0) + (unreadCount || 0);

    const isAdmin = email === "evcarvalhodev@gmail.com";
    if (isAdmin) {
      const { count: frozenCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_frozen', true);
      total += (frozenCount || 0);
    }

    setNotificationCount(total);
  }, []);

  // Load profiles + subscribe to DB changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setCurrentUserId(session.user.id);
        setAccessToken(session.access_token);
        loadNotificationCount(session.user.id, session.user.email);
      }
    });

    // Keep accessToken fresh when Supabase auto-refreshes it (~every 1h)
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.access_token) setAccessToken(session.access_token);
      }
    );

    loadProfiles();

    const channel = supabase
      .channel('community_updates')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => loadProfiles()
      )
      .subscribe();

    // Fallback poll: ensures count stays accurate even if a realtime event is missed
    const poll = setInterval(loadProfiles, 10_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      authSub.unsubscribe();
    };
  }, []);

  // Heartbeat presence: update last_seen_at every 30s while on this page.
  useEffect(() => {
    if (!currentUserId || !accessToken) return;

    const updatePresence = () =>
      (supabase as any)
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('user_id', currentUserId);

    // Await initial heartbeat before loading profiles so own status appears instantly
    updatePresence().then(() => loadProfiles());

    const heartbeat = setInterval(updatePresence, 30_000);
    // Tick every 5s so local re-evaluation of online status is near-instant
    const ticker = setInterval(() => setTick(t => t + 1), 5_000);

    // When tab comes back into focus after being backgrounded, immediately refresh.
    // This counters browser timer throttling which can delay 30s intervals to 60s+.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        updatePresence();
        loadProfiles();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(heartbeat);
      clearInterval(ticker);
      document.removeEventListener('visibilitychange', onVisible);
      // keepalive: true guarantees this request completes even during page navigation
      fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?user_id=eq.${currentUserId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ last_seen_at: null }),
          keepalive: true,
        }
      );
    };
  }, [currentUserId, accessToken]);

  // Derive online status from last_seen_at column
  const profilesWithPresence = useMemo(() => {
    const now = Date.now();
    return profiles.map(p => ({
      ...p,
      is_online: p.last_seen_at
        ? now - new Date(p.last_seen_at).getTime() < ONLINE_THRESHOLD_MS
        : false,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles, tick]);

  const onlineCount = useMemo(
    () => profilesWithPresence.filter(p => p.is_online).length,
    [profilesWithPresence]
  );

  // Derive current user's level from loaded profiles
  const currentUserLevel = useMemo(() => {
    if (!currentUserId) return null;
    const me = profiles.find((p: any) => p.user_id === currentUserId);
    return me ? (me.nivel ?? 1) : null;
  }, [profiles, currentUserId]);

  useLevelProgression({
    currentUserId,
    currentUserLevel,
    onLevelUp: (event) => setLevelUpEvent(event),
    onRefresh: loadProfiles,
  });

  return (
    <div className="flex flex-col h-full bg-[#0a0a0c]">
      <header className="p-4 border-b border-white/5 flex items-center justify-between shrink-0 z-10 bg-background/80 backdrop-blur-md">
        <div>
          <h1 className="text-xl font-bold text-white">Comunidade ViralFlow</h1>
          <p className="text-xs text-muted-foreground">
            Navegue pela cidade — clique no Shopping do Editor para comprar e vender.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-primary">
          <span className="hidden sm:inline text-muted-foreground mr-2">{profiles.length} Habitantes</span>
          <button
            onClick={() => setShowNotifications(true)}
            className="relative p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white transition-colors"
          >
            <Bell className="w-5 h-5" />
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white shadow">
                {notificationCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setShowEditProfile(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="font-medium hidden sm:inline">Editar Prédio</span>
          </button>
        </div>
      </header>

      <LevelProgressBar currentUserId={currentUserId} currentLevel={currentUserLevel} />

      <div
        className="flex-1 relative overflow-hidden"
        style={(showShopping || showEditProfile || showNotifications) ? { display: 'none' } : undefined}
      >
        <CommunityMap
          profiles={profilesWithPresence}
          currentUserId={currentUserId}
          onShoppingClick={() => setShowShopping(true)}
          presenceCount={onlineCount}
        />
      </div>

      {showEditProfile && (
        <EditProfileModal
          onClose={() => setShowEditProfile(false)}
          onSaved={() => { setShowEditProfile(false); loadProfiles(); }}
        />
      )}

      {showShopping && (
        <ShoppingPanel onClose={() => setShowShopping(false)} />
      )}

      {showNotifications && (
        <NotificationsPanel
          onClose={() => setShowNotifications(false)}
          onUpdateCount={() => {
            supabase.auth.getUser().then(({ data: { user } }) => {
              if (user) loadNotificationCount(user.id, user.email);
            });
          }}
        />
      )}

      {levelUpEvent && (
        <LevelUpModal
          event={levelUpEvent}
          onClose={() => setLevelUpEvent(null)}
        />
      )}
    </div>
  );
};

export default Community;
