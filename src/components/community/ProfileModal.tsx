import React, { useState, useEffect } from 'react';
import { X, UserPlus, MessageCircle, ExternalLink, Flag, Users, Check, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Profile {
  id: string;
  display_name?: string;
  nome?: string;
  avatar_url?: string;
  foto_url?: string;
  bio: string;
  habilidades: any;
  servicos: any;
  link1: string;
  link2: string;
  nivel: number;
}

interface ProfileModalProps {
  profile: Profile;
  currentUserId: string | null;
  onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ profile, currentUserId, onClose }) => {
  const habilidades = Array.isArray(profile.habilidades) ? profile.habilidades : [];
  const servicos = Array.isArray(profile.servicos) ? profile.servicos : [];

  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'friends' | 'loading'>('loading');
  const [friendCount, setFriendCount] = useState(0);
  const [isReporting, setIsReporting] = useState(false);

  useEffect(() => {
    loadFriendshipData();
  }, [profile.id, currentUserId]);

  const loadFriendshipData = async () => {
    const { count } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`);
    
    setFriendCount(count || 0);

    if (!currentUserId || currentUserId === profile.id) {
      setFriendshipStatus('none');
      return;
    }

    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(user_id.eq.${currentUserId},friend_id.eq.${profile.id}),and(user_id.eq.${profile.id},friend_id.eq.${currentUserId})`)
      .maybeSingle();

    if (!data) {
      setFriendshipStatus('none');
    } else if (data.status === 'accepted') {
      setFriendshipStatus('friends');
    } else if (data.status === 'pending') {
      if (data.user_id === currentUserId) setFriendshipStatus('pending_sent');
      else setFriendshipStatus('pending_received');
    }
  };

  const handleAddFriend = async () => {
    if (!currentUserId) {
      toast.error('Você precisa estar logado!');
      return;
    }
    
    setFriendshipStatus('loading');
    const { error } = await supabase
      .from('friendships')
      .insert({ user_id: currentUserId, friend_id: profile.id, status: 'pending' });

    if (error) {
      toast.error('Erro ao enviar pedido de amizade');
      setFriendshipStatus('none');
    } else {
      toast.success('Pedido enviado! ⏳');
      setFriendshipStatus('pending_sent');
    }
  };

  const handleReport = async () => {
    if (!currentUserId) return;
    if (confirm('Tem certeza que deseja denunciar este usuário? Administradores irão analisar o caso.')) {
      setIsReporting(true);
      const { error } = await supabase
        .from('reports')
        .insert({ reporter_id: currentUserId, reported_id: profile.id, reason: 'Denúncia pela comunidade' });
      
      setIsReporting(false);
      if (error) {
        if (error.code === '23505') toast.error('Você já denunciou este usuário!');
        else toast.error('Erro ao enviar denúncia');
      } else {
        toast.success('Denúncia enviada e registrada!');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm shadow-2xl pointer-events-auto" onClick={onClose}>
      <div 
        className="bg-[#111113] border border-white/10 p-6 rounded-2xl w-full max-w-sm flex flex-col items-center animate-in zoom-in-95 duration-200 shadow-2xl relative"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 bg-white/5 rounded-full text-muted-foreground hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>

        {/* Avatar Ring */}
        <div className="mt-2 p-[2px] rounded-full bg-gradient-to-r from-[hsl(262,83%,58%)] to-[hsl(220,14%,92%)] mb-4 shadow-xl">
          <div className="w-20 h-20 rounded-full bg-[#111113] flex items-center justify-center overflow-hidden border-2 border-[#111113]">
            {(profile.avatar_url || profile.foto_url) ? (
               <img src={profile.avatar_url || profile.foto_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
               <div className="text-3xl font-bold bg-muted w-full h-full flex items-center justify-center text-muted-foreground">
                 {(profile.display_name || profile.nome || '?')[0]?.toUpperCase()}
               </div>
            )}
          </div>
        </div>

        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          {profile.display_name || profile.nome || "Membro"}
          {currentUserId && currentUserId !== profile.id && (
            <button 
              onClick={handleReport} 
              disabled={isReporting}
              className="p-1 rounded bg-destructive/10 text-destructive hover:bg-destructive hover:text-white transition-colors"
              title="Denunciar"
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          )}
        </h2>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-xs text-[hsl(262,83%,58%)] font-semibold bg-[hsl(262,83%,58%)]/10 px-2 py-0.5 rounded-full">
            Nível {profile.nivel || 1}
          </p>
          <div className="text-xs text-muted-foreground flex items-center gap-1 font-medium bg-white/5 py-0.5 px-2 rounded-full border border-white/5">
            <Users className="w-3 h-3" />
            {friendCount} {friendCount === 1 ? 'amigo' : 'amigos'}
          </div>
        </div>

        {profile.bio && (
          <p className="text-sm text-center text-muted-foreground mb-5 px-2 line-clamp-3">"{profile.bio}"</p>
        )}

        {/* Habilidades */}
        {habilidades.length > 0 && (
          <div className="w-full mb-4">
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 text-center font-bold">Habilidades & Foco</h3>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {habilidades.map((hab: string, i: number) => (
                <span key={i} className="px-2 py-0.5 rounded-md bg-[hsl(262,83%,58%)]/10 text-[hsl(262,83%,58%)] text-[10px] font-medium border border-[hsl(262,83%,58%)]/20">
                  {hab}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Servicos */}
        {servicos.length > 0 && (
          <div className="w-full mb-5">
            <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 text-center font-bold">Oferece Serviços</h3>
            <ul className="text-xs text-white/80 space-y-1.5 text-center">
              {servicos.map((serv: string, i: number) => (
                <li key={i} className="bg-white/5 rounded-md py-1 px-2 border border-white/10">{serv}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Links */}
        {(profile.link1 || profile.link2) && (
          <div className="flex gap-4 w-full mb-6 justify-center">
            {profile.link1 && (
              <a href={profile.link1} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors bg-blue-400/10 px-3 py-1.5 rounded-lg">
                <ExternalLink className="w-3 h-3" /> Portfólio
              </a>
            )}
            {profile.link2 && (
              <a href={profile.link2} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[11px] font-semibold text-pink-400 hover:text-pink-300 transition-colors bg-pink-400/10 px-3 py-1.5 rounded-lg">
                <ExternalLink className="w-3 h-3" /> Instagram
              </a>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {currentUserId !== profile.id && (
          <div className="flex w-full gap-2 mt-auto">
            <button className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition-colors">
              <MessageCircle className="w-4 h-4" /> Mensagem
            </button>

            {friendshipStatus === 'none' && (
              <button onClick={handleAddFriend} className="flex-1 justify-center flex items-center gap-1.5 px-3 py-2.5 rounded-xl gradient-viral text-white text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity">
                <UserPlus className="w-4 h-4" /> Adicionar
              </button>
            )}

            {friendshipStatus === 'pending_sent' && (
              <button disabled className="flex-1 justify-center flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/10 text-white/50 text-sm font-bold cursor-not-allowed">
                <Clock className="w-4 h-4" /> Solicitado
              </button>
            )}

            {friendshipStatus === 'pending_received' && (
              <button disabled className="flex-1 justify-center flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/10 text-white/50 text-sm font-bold cursor-not-allowed">
                <Clock className="w-4 h-4" /> Pendente no Sino
              </button>
            )}

            {friendshipStatus === 'friends' && (
              <button disabled className="flex-1 justify-center flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-green-500/20 text-green-500 border border-green-500/30 text-sm font-bold cursor-default">
                <Check className="w-4 h-4" /> Amigos
              </button>
            )}
            
            {friendshipStatus === 'loading' && (
              <button disabled className="flex-1 justify-center flex items-center px-3 py-2.5 rounded-xl bg-white/5 text-white/30 text-sm font-bold animate-pulse">
                ...
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileModal;
