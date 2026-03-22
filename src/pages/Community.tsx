import { useState, useEffect, useCallback } from 'react';
import CommunityMap from '@/components/community/CommunityMap';
import EditProfileModal from '@/components/community/EditProfileModal';
import { ShoppingPanel } from '@/components/community/ShoppingPanel';
import { supabase } from '@/integrations/supabase/client';
import { Settings, ShoppingBag } from 'lucide-react';

const Community = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showShopping, setShowShopping] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*');
    if (!error && data) {
      const validProfiles = data.filter((p: any) => p.pos_x !== null && p.pos_y !== null);
      setProfiles(validProfiles);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
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
            Navegue pela cidade, encontre criadores e faça conexões reais.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-primary">
          <span className="hidden sm:inline text-muted-foreground">{profiles.length} Habitantes</span>
          <button 
            onClick={() => setShowShopping(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg text-primary transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="font-medium">Shopping</span>
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
        <CommunityMap profiles={profiles} currentUserId={currentUserId} />
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
    </div>
  );
};

export default Community;
