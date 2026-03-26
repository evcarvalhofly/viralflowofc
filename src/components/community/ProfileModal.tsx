import React, { useState, useEffect } from 'react';
import { X, UserPlus, ExternalLink, Flag, Users, Check, Clock, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import DirectChatWindow from './DirectChatWindow';

interface Profile {
  id: string;
  user_id: string;
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
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [friendCount, setFriendCount] = useState(0);
  const [isReporting, setIsReporting] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    loadFriendshipData();
  }, [profile.id, currentUserId]);

  const loadFriendshipData = async () => {
    const { count } = await supabase
      .from('friendships')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'accepted')
      .or(`user_id.eq.${profile.user_id},friend_id.eq.${profile.user_id}`);

    setFriendCount(count || 0);

    if (!currentUserId || currentUserId === profile.user_id) {
      setFriendshipStatus('none');
      return;
    }

    const { data } = await supabase
      .from('friendships')
      .select('*')
      .or(`and(user_id.eq.${currentUserId},friend_id.eq.${profile.user_id}),and(user_id.eq.${profile.user_id},friend_id.eq.${currentUserId})`)
      .maybeSingle();

    if (!data) {
      setFriendshipStatus('none');
      setFriendshipId(null);
    } else if (data.status === 'accepted') {
      setFriendshipStatus('friends');
      setFriendshipId(data.id);
    } else if (data.status === 'pending') {
      setFriendshipId(data.id);
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
      .insert({ user_id: currentUserId, friend_id: profile.user_id, status: 'pending' });

    if (error) {
      toast.error('Erro ao enviar pedido de amizade');
      setFriendshipStatus('none');
    } else {
      toast.success('Pedido enviado! ⏳');
      setFriendshipStatus('pending_sent');
    }
  };

  const handleCancelFriend = async () => {
    if (!friendshipId) return;
    setFriendshipStatus('loading');
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId);

    if (error) {
      toast.error('Erro ao remover amizade');
    } else {
      toast.success('Amizade removida');
      setFriendshipStatus('none');
      setFriendshipId(null);
    }
  };

  const handleReport = () => {
    if (!currentUserId) return;
    setReportReason('');
    setShowReportDialog(true);
  };

  const submitReport = async () => {
    if (reportReason.trim().length < 150) return;
    setIsReporting(true);
    const { error } = await supabase
      .from('reports')
      .insert({ reporter_id: currentUserId, reported_id: profile.user_id, reason: reportReason.trim() });
    setIsReporting(false);
    if (error) {
      if (error.code === '23505') toast.error('Você já denunciou este usuário!');
      else toast.error('Erro ao enviar denúncia');
    } else {
      toast.success('Denúncia enviada e registrada!');
      setShowReportDialog(false);
    }
  };

  return (
    <>
    {showChat && (
      <DirectChatWindow
        peerId={profile.user_id}
        peerName={profile.display_name || profile.nome || 'Usuário'}
        peerAvatar={profile.avatar_url || profile.foto_url}
        onClose={() => setShowChat(false)}
      />
    )}

    {/* Dialog de denúncia */}
    {showReportDialog && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm pointer-events-auto" onClick={() => setShowReportDialog(false)}>
        <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-1">
            <Flag className="w-4 h-4 text-red-500" />
            <h3 className="font-semibold text-foreground">Denunciar usuário</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Explique detalhadamente o motivo da denúncia. <span className="text-foreground font-medium">Mínimo 150 caracteres.</span>
          </p>
          <textarea
            className="w-full bg-muted border border-border rounded-xl p-3 text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-red-500/50 placeholder:text-muted-foreground"
            rows={5}
            placeholder="Descreva o ocorrido com detalhes suficientes para que os administradores possam analisar o caso..."
            value={reportReason}
            onChange={e => setReportReason(e.target.value)}
            maxLength={1000}
          />
          <div className="flex justify-between items-center mt-1 mb-4">
            <span className={`text-xs font-medium ${reportReason.trim().length < 150 ? 'text-red-400' : 'text-green-400'}`}>
              {reportReason.trim().length}/150 caracteres mínimos
            </span>
            <span className="text-xs text-muted-foreground">{reportReason.length}/1000</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowReportDialog(false)}
              className="flex-1 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={submitReport}
              disabled={isReporting || reportReason.trim().length < 150}
              className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {isReporting ? 'Enviando...' : 'Enviar denúncia'}
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm shadow-2xl pointer-events-auto" onClick={onClose}>
      <div 
        className="bg-card border border-border p-6 rounded-2xl w-full max-w-sm flex flex-col items-center animate-in zoom-in-95 duration-200 shadow-2xl relative"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>

        {/* Avatar Ring */}
        <div className="mt-2 p-[2px] rounded-full bg-gradient-to-r from-primary to-foreground/20 mb-4 shadow-xl">
          <div className="w-20 h-20 rounded-full bg-card flex items-center justify-center overflow-hidden border-2 border-card">
            {(profile.avatar_url || profile.foto_url) ? (
               <img src={profile.avatar_url || profile.foto_url} alt="Profile" className="w-full h-full object-cover" />
            ) : (
               <div className="text-3xl font-bold bg-muted w-full h-full flex items-center justify-center text-muted-foreground">
                 {(profile.display_name || profile.nome || '?')[0]?.toUpperCase()}
               </div>
            )}
          </div>
        </div>

        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          {profile.display_name || profile.nome || "Membro"}
          {currentUserId && currentUserId !== profile.user_id && (
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
          <p className="text-xs text-primary font-semibold bg-primary/10 px-2 py-0.5 rounded-full">
            Nível {profile.nivel || 1}
          </p>
          <div className="text-xs text-muted-foreground flex items-center gap-1 font-medium bg-muted/50 py-0.5 px-2 rounded-full border border-border">
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
                <span key={i} className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-medium border border-primary/20">
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
            <ul className="text-xs text-foreground/80 space-y-1.5 text-center">
              {servicos.map((serv: string, i: number) => (
                <li key={i} className="bg-muted/50 rounded-md py-1 px-2 border border-border">{serv}</li>
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
        {currentUserId !== profile.user_id && (
          <div className="flex w-full gap-2 mt-auto">
            {friendshipStatus === 'none' && (
              <button onClick={handleAddFriend} className="flex-1 justify-center flex items-center gap-1.5 px-3 py-2.5 rounded-xl gradient-viral text-white text-sm font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity">
                <UserPlus className="w-4 h-4" /> Adicionar Amigo
              </button>
            )}

            {friendshipStatus === 'pending_sent' && (
              <button onClick={handleCancelFriend} className="flex-1 justify-center flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-muted text-muted-foreground text-sm font-bold hover:bg-destructive/10 hover:text-destructive transition-colors">
                <Clock className="w-4 h-4" /> Solicitado — Cancelar
              </button>
            )}

            {friendshipStatus === 'pending_received' && (
              <button disabled className="flex-1 justify-center flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-muted/50 text-muted-foreground text-sm font-bold cursor-not-allowed">
                <Clock className="w-4 h-4" /> Aceite no Sino 🔔
              </button>
            )}

            {friendshipStatus === 'friends' && (
              <>
                <button
                  onClick={() => setShowChat(true)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary/10 text-primary border border-primary/30 text-sm font-bold hover:bg-primary/20 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" /> Mensagem
                </button>
                <button onClick={handleCancelFriend} className="flex-1 justify-center flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-green-500/20 text-green-500 border border-green-500/30 text-sm font-bold hover:bg-destructive/20 hover:text-destructive hover:border-destructive/30 transition-colors">
                  <Check className="w-4 h-4" /> Amigos — Remover
                </button>
              </>
            )}
            
            {friendshipStatus === 'loading' && (
              <button disabled className="flex-1 justify-center flex items-center px-3 py-2.5 rounded-xl bg-muted text-muted-foreground text-sm font-bold animate-pulse">
                ...
              </button>
            )}
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default ProfileModal;
