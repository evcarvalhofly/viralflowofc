import { useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { usePushNotifications, type NotifPermission } from '@/hooks/usePushNotifications';

interface Props {
  onClose: () => void;
}

export const NotificationPermissionModal = ({ onClose }: Props) => {
  const { permission, requestPermission } = usePushNotifications();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NotifPermission | null>(null);

  const handleEnable = async () => {
    setLoading(true);
    const r = await requestPermission();
    setResult(r);
    setLoading(false);
    if (r === 'granted') {
      setTimeout(onClose, 1200);
    }
  };

  const isDenied = permission === 'denied';

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-6 animate-in slide-in-from-bottom-4 duration-300">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-muted text-muted-foreground"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            {result === 'granted' ? (
              <Bell className="w-8 h-8 text-green-400" />
            ) : isDenied ? (
              <BellOff className="w-8 h-8 text-muted-foreground" />
            ) : (
              <Bell className="w-8 h-8 text-primary" />
            )}
          </div>
        </div>

        {result === 'granted' ? (
          <>
            <h2 className="text-center text-lg font-bold text-white mb-1">Notificações ativadas!</h2>
            <p className="text-center text-sm text-muted-foreground">
              Você receberá alertas de mensagens, amizades e avisos.
            </p>
          </>
        ) : isDenied ? (
          <>
            <h2 className="text-center text-lg font-bold text-white mb-2">Notificações bloqueadas</h2>
            <p className="text-center text-sm text-muted-foreground mb-4">
              Você bloqueou as notificações. Para ativar, abra as configurações do navegador e permita notificações para este site.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-muted text-sm font-semibold text-foreground hover:bg-muted/80 transition-colors"
            >
              Entendido
            </button>
          </>
        ) : (
          <>
            <h2 className="text-center text-lg font-bold text-white mb-2">Ativar notificações</h2>
            <p className="text-center text-sm text-muted-foreground mb-5">
              Receba alertas de novas mensagens, pedidos de amizade e avisos da comunidade — mesmo com o app em segundo plano.
            </p>

            <div className="space-y-2">
              <button
                onClick={handleEnable}
                disabled={loading}
                className="w-full py-3 rounded-xl gradient-viral text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {loading ? 'Aguardando...' : '🔔 Ativar notificações'}
              </button>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-transparent text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Agora não
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
