import { useState, useEffect, useCallback } from 'react';
import CommunityMap from '@/components/community/CommunityMap';
import EditProfileModal from '@/components/community/EditProfileModal';
import { supabase } from '@/integrations/supabase/client';
import { Settings } from 'lucide-react';

const Community = () => {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [showEditProfile, setShowEditProfile] = useState(false);

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
    
    loadProfiles();

    // Inscreve-se para atualizações no banco (novos usuários chegando)
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
        <div className="flex items-center gap-4 text-sm text-primary">
          <span className="hidden sm:inline">{profiles.length} Habitantes</span>
          <button 
            onClick={() => setShowEditProfile(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span className="font-medium">Editar Meu Prédio</span>
          </button>
        </div>
      </header>

      <div className="flex-1 relative overflow-hidden">
        <CommunityMap profiles={profiles} />
      </div>

      {showEditProfile && (
        <EditProfileModal 
          onClose={() => setShowEditProfile(false)} 
          onSaved={() => { setShowEditProfile(false); loadProfiles(); }}
        />
      )}
    </div>
  );
};

export default Community;
