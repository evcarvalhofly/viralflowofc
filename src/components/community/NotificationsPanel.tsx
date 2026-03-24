import { useState, useEffect } from "react";
import { X, Bell, Check, AlertTriangle, ShieldAlert, MessageCircle, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import DirectChatWindow from "./DirectChatWindow";

interface FriendshipRequest {
  id: string;
  user_id: string;
  created_at: string;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
    nivel: number | null;
  };
}

interface AcceptedFriendship {
  id: string;
  friend_id: string;
  created_at: string;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface UnreadConversation {
  sender_id: string;
  count: number;
  last_message: string;
  profiles: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface NotificationsPanelProps {
  onClose: () => void;
  onUpdateCount: () => void;
}

export const NotificationsPanel = ({ onClose, onUpdateCount }: NotificationsPanelProps) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FriendshipRequest[]>([]);
  const [acceptedFriends, setAcceptedFriends] = useState<AcceptedFriendship[]>([]);
  const [unreadConvos, setUnreadConvos] = useState<UnreadConversation[]>([]);
  const [frozenAlerts, setFrozenAlerts] = useState<{id:string, name:string, reports:number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [chatPeer, setChatPeer] = useState<{id:string, name:string, avatar:string|null} | null>(null);

  const isAdmin = user?.email === "evcarvalhodev@gmail.com";

  const loadNotifications = async () => {
    if (!user) return;
    setLoading(true);
    const db = supabase as any;

    // 1. Pedidos de amizade pendentes (sou o destinatário)
    const { data: reqData } = await supabase
      .from('friendships')
      .select('id, user_id, created_at')
      .eq('friend_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (reqData && reqData.length > 0) {
      const senderIds = reqData.map((r: any) => r.user_id);
      const { data: profilesData } = await db.from('profiles').select('user_id, display_name, avatar_url, nivel').in('user_id', senderIds);
      const profileMap: Record<string, any> = {};
      if (profilesData) profilesData.forEach((p: any) => { profileMap[p.user_id] = p; });
      setRequests(reqData.map((r: any) => ({
        ...r,
        profiles: profileMap[r.user_id] ?? { display_name: 'Usuário', avatar_url: null, nivel: 1 }
      })));
    } else {
      setRequests([]);
    }

    // 2. Amizades aceitas que eu ainda não vi (sou o remetente)
    const { data: acceptedData } = await supabase
      .from('friendships')
      .select('id, friend_id, created_at')
      .eq('user_id', user.id)
      .eq('status', 'accepted')
      .eq('sender_notified', false)
      .order('created_at', { ascending: false });

    if (acceptedData && acceptedData.length > 0) {
      const friendIds = acceptedData.map((r: any) => r.friend_id);
      const { data: profilesData } = await db.from('profiles').select('user_id, display_name, avatar_url').in('user_id', friendIds);
      const profileMap: Record<string, any> = {};
      if (profilesData) profilesData.forEach((p: any) => { profileMap[p.user_id] = p; });
      setAcceptedFriends(acceptedData.map((r: any) => ({
        ...r,
        profiles: profileMap[r.friend_id] ?? { display_name: 'Usuário', avatar_url: null }
      })));
    } else {
      setAcceptedFriends([]);
    }

    // 3. Mensagens não lidas agrupadas por remetente
    const { data: unreadData } = await db
      .from('direct_messages')
      .select('sender_id, content, created_at')
      .eq('receiver_id', user.id)
      .is('read_at', null)
      .order('created_at', { ascending: false });

    if (unreadData && unreadData.length > 0) {
      // Group by sender_id
      const grouped: Record<string, { count: number; last_message: string }> = {};
      unreadData.forEach((m: any) => {
        if (!grouped[m.sender_id]) grouped[m.sender_id] = { count: 0, last_message: m.content };
        grouped[m.sender_id].count++;
      });
      const senderIds = Object.keys(grouped);
      const { data: profilesData } = await db.from('profiles').select('user_id, display_name, avatar_url').in('user_id', senderIds);
      const profileMap: Record<string, any> = {};
      if (profilesData) profilesData.forEach((p: any) => { profileMap[p.user_id] = p; });
      setUnreadConvos(senderIds.map(sid => ({
        sender_id: sid,
        count: grouped[sid].count,
        last_message: grouped[sid].last_message,
        profiles: profileMap[sid] ?? { display_name: 'Usuário', avatar_url: null }
      })));
    } else {
      setUnreadConvos([]);
    }

    // 4. Admin: contas congeladas
    if (isAdmin) {
      const { data: frozenData } = await supabase.from('profiles').select('user_id, display_name').eq('is_frozen', true);
      if (frozenData && frozenData.length > 0) {
        const alerts = await Promise.all(frozenData.map(async (frozen) => {
          const { count } = await supabase.from('reports').select('*', { count: 'exact', head: true }).eq('reported_id', frozen.user_id);
          return { id: frozen.user_id, name: frozen.display_name || 'Usuário', reports: count || 0 };
        }));
        setFrozenAlerts(alerts);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    loadNotifications();
  }, [user]);

  const handleAccept = async (id: string) => {
    const { error } = await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id);
    if (error) {
      toast.error('Erro ao aceitar pedido');
    } else {
      toast.success('Amizade aceita! 🎉');
      setRequests(r => r.filter(req => req.id !== id));
      onUpdateCount();
    }
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase.from('friendships').delete().eq('id', id);
    if (error) {
      toast.error('Erro ao recusar pedido');
    } else {
      setRequests(r => r.filter(req => req.id !== id));
      onUpdateCount();
    }
  };

  const handleDismissAccepted = async (id: string) => {
    await supabase.from('friendships').update({ sender_notified: true }).eq('id', id);
    setAcceptedFriends(prev => prev.filter(f => f.id !== id));
    onUpdateCount();
  };

  const handleOpenChat = (convo: UnreadConversation) => {
    setChatPeer({ id: convo.sender_id, name: convo.profiles.display_name ?? 'Usuário', avatar: convo.profiles.avatar_url });
    // Mark as read optimistically
    setUnreadConvos(prev => prev.filter(c => c.sender_id !== convo.sender_id));
    onUpdateCount();
  };

  const hasAny = requests.length > 0 || acceptedFriends.length > 0 || unreadConvos.length > 0 || frozenAlerts.length > 0;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:w-[420px] h-[85vh] sm:h-full bg-background border-l border-border shadow-2xl flex flex-col rounded-t-3xl sm:rounded-none">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔔</span>
            <h2 className="font-bold text-base">Notificações</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card animate-pulse">
                  <div className="w-12 h-12 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="h-3 bg-muted rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : !hasAny ? (
            <div className="flex flex-col items-center justify-center py-16 text-center h-full">
              <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma notificação nova no momento.</p>
            </div>
          ) : (
            <div className="space-y-6">

              {/* === ADMIN ALERTS === */}
              {isAdmin && frozenAlerts.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-destructive" /> Alertas do Sistema (Admin)
                  </h3>
                  <div className="space-y-2">
                    {frozenAlerts.map(alert => (
                      <div key={alert.id} className="flex items-start gap-3 p-3 rounded-xl border border-destructive/30 bg-destructive/10">
                        <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-5 h-5 text-destructive" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-destructive">Conta Congelada</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <span className="font-semibold">{alert.name}</span> atingiu {alert.reports} denúncias e foi bloqueado automaticamente.
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* === PEDIDOS DE AMIZADE === */}
              {requests.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Pedidos de Amizade</h3>
                  <div className="space-y-2">
                    {requests.map((req) => (
                      <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                        <div className="w-12 h-12 rounded-full bg-muted overflow-hidden shrink-0">
                          {req.profiles?.avatar_url ? (
                            <img src={req.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold">
                              {(req.profiles?.display_name ?? "?")[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{req.profiles?.display_name ?? "Usuário"}</p>
                          <p className="text-xs text-muted-foreground">Quer ser seu vizinho(a)!</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => handleAccept(req.id)} className="p-2 rounded-full bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-colors" title="Aceitar">
                            <Check className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleReject(req.id)} className="p-2 rounded-full bg-muted/50 text-muted-foreground hover:bg-destructive hover:text-white transition-colors" title="Recusar">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* === AMIZADES ACEITAS === */}
              {acceptedFriends.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Amizades Aceitas</h3>
                  <div className="space-y-2">
                    {acceptedFriends.map((f) => (
                      <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl border border-green-500/20 bg-green-500/5">
                        <div className="w-10 h-10 rounded-full bg-muted overflow-hidden shrink-0">
                          {f.profiles?.avatar_url ? (
                            <img src={f.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-green-500/10 text-green-500 font-bold text-sm">
                              {(f.profiles?.display_name ?? "?")[0].toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{f.profiles?.display_name ?? "Usuário"}</p>
                          <p className="text-xs text-green-500 flex items-center gap-1"><UserCheck className="w-3 h-3" /> Aceitou sua solicitação!</p>
                        </div>
                        <button onClick={() => handleDismissAccepted(f.id)} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground" title="Dispensar">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* === MENSAGENS NÃO LIDAS === */}
              {unreadConvos.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Mensagens Não Lidas</h3>
                  <div className="space-y-2">
                    {unreadConvos.map((convo) => (
                      <button
                        key={convo.sender_id}
                        onClick={() => handleOpenChat(convo)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
                      >
                        <div className="w-10 h-10 rounded-full bg-muted overflow-hidden shrink-0 relative">
                          {convo.profiles?.avatar_url ? (
                            <img src={convo.profiles.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-sm">
                              {(convo.profiles?.display_name ?? "?")[0].toUpperCase()}
                            </div>
                          )}
                          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                            {convo.count > 9 ? '9+' : convo.count}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{convo.profiles?.display_name ?? "Usuário"}</p>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <MessageCircle className="w-3 h-3 text-primary shrink-0" /> {convo.last_message}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
    {chatPeer && (
      <DirectChatWindow
        peerId={chatPeer.id}
        peerName={chatPeer.name}
        peerAvatar={chatPeer.avatar}
        onClose={() => setChatPeer(null)}
      />
    )}
    </>
  );
};
