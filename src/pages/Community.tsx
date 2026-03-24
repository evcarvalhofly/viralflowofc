import { useState, useEffect, useCallback } from 'react';
import CommunityMap from '@/components/community/CommunityMap';
import EditProfileModal from '@/components/community/EditProfileModal';
import { ShoppingPanel } from '@/components/community/ShoppingPanel';
import { supabase } from '@/integrations/supabase/client';
import { Settings, Bell } from 'lucide-react';
import { NotificationsPanel } from '@/components/community/NotificationsPanel';

const Community = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showShopping, setShowShopping] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);

  const loadProfiles = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*');
    if (!error && data) {
      const validProfiles = data.filter((p: any) => p.pos_x !== null && p.pos_y !== null);
      setProfiles(validProfiles);
    }
  }, []);

  const loadNotificationCount = useCallback(async (userId: string, email?: string) => {
    const db = supabase as any;

    // Pedidos de amizade pendentes (sou o destinatário)
    const { count: pendingCount } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('friend_id', userId)
      .eq('status', 'pending');

    // Amizades aceitas que ainda não vi (sou o remetente)
    const { count: acceptedCount } = await db
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'accepted')
      .eq('sender_notified', false);

    // Mensagens não lidas
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        loadNotificationCount(user.id, user.email);
      }
    });
    
    loadProfiles();

    const channel = supabase
      .channel('community_updates')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'profiles' }, 
        () => loadProfiles()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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

      <div className="flex-1 relative overflow-hidden">
        <CommunityMap
          profiles={profiles}
          currentUserId={currentUserId}
          onShoppingClick={() => setShowShopping(true)}
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
    </div>
  );
};

export default Community;