import { useState, useEffect } from "react";
import { X, Bell, UserPlus, Check, Trash2, AlertTriangle, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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

interface ReportRow {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  created_at: string;
}

interface NotificationsPanelProps {
  onClose: () => void;
  onUpdateCount: () => void;
}

export const NotificationsPanel = ({ onClose, onUpdateCount }: NotificationsPanelProps) => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<FriendshipRequest[]>([]);
  const [frozenAlerts, setFrozenAlerts] = useState<{id:string, name:string, reports:number}[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.email === "evcarvalhodev@gmail.com" || user?.email === "evcarvalhodev"; // Ajuste conforme seu email admin exato

  const loadNotifications = async () => {
    if (!user) return;
    setLoading(true);

    // 1. Carregar pedidos de amizade pendentes (onde sou o friend_id)
    const { data: reqData, error: reqErr } = await supabase
      .from('friendships')
      .select('id, user_id, created_at, profiles!friendships_user_id_fkey(display_name, avatar_url, nivel)')
      .eq('friend_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!reqErr && reqData) {
      // O Supabase retorna um array se for one-to-many, mas aqui é one-to-one implicitamente pelo join.
      // Vamos normalizar caso venha como array.
      const formatted = reqData.map((r: any) => ({
        ...r,
        profiles: Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      }));
      setRequests(formatted as FriendshipRequest[]);
    }

    // 2. Se for ADMIN, buscar alertas de contas recém-congeladas
    if (isAdmin) {
      const { data: frozenData } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .eq('is_frozen', true);

      if (frozenData && frozenData.length > 0) {
        // Quantas denúncias cada um tem?
        const alerts = await Promise.all(frozenData.map(async (frozen) => {
          const { count } = await supabase
            .from('reports')
            .select('*', { count: 'exact', head: true })
            .eq('reported_id', frozen.user_id);
          
          return {
            id: frozen.user_id,
            name: frozen.display_name || 'Usuário',
            reports: count || 0
          };
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
    const { error } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao aceitar pedido');
    } else {
      toast.success('Amizade aceita! 🎉');
      setRequests(r => r.filter(req => req.id !== id));
      onUpdateCount();
    }
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase
      .from('friendships')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao recusar pedido');
    } else {
      setRequests(r => r.filter(req => req.id !== id));
      onUpdateCount();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full sm:w-[420px] h-[85vh] sm:h-full bg-background border-l border-border shadow-2xl flex flex-col rounded-t-3xl sm:rounded-none">
        {/* Header */}
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
          ) : requests.length === 0 && frozenAlerts.length === 0 ? (
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
                    <ShieldAlert className="w-3.5 h-3.5 text-destructive" />
                    Alertas do Sistema (Admin)
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
                            O usuário <span className="font-semibold">{alert.name}</span> atingiu {alert.reports} denúncias e foi bloqueado automaticamente.
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* === FRIEND REQUESTS === */}
              {requests.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">
                    Pedidos de Amizade
                  </h3>
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
                          <button 
                            onClick={() => handleAccept(req.id)}
                            className="p-2 rounded-full bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white transition-colors"
                            title="Aceitar"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleReject(req.id)}
                            className="p-2 rounded-full bg-muted/50 text-muted-foreground hover:bg-destructive hover:text-white transition-colors"
                            title="Recusar"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </div>
    </div>
  );
};
