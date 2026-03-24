import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;

function urlBase64ToUint8Array(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

/** Salva a subscription de push no Supabase para envios server-side futuros */
async function savePushSubscription(userId: string, sub: PushSubscription) {
  const db = supabase as any;
  const subJson = sub.toJSON();
  await db.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      subscription: subJson,
    },
    { onConflict: 'user_id,endpoint' }
  );
}

export type NotifPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotifPermission>('unsupported');

  useEffect(() => {
    if (!('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as NotifPermission);
  }, []);

  /** Solicita permissão e registra push subscription. Deve ser chamado via clique do usuário. */
  const requestPermission = async (): Promise<NotifPermission> => {
    if (!('Notification' in window)) return 'unsupported';

    const result = await Notification.requestPermission();
    setPermission(result as NotifPermission);

    if (result === 'granted' && user && VAPID_PUBLIC_KEY && 'serviceWorker' in navigator && 'PushManager' in window) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        const sub = existing ?? await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
        await savePushSubscription(user.id, sub);
      } catch {
        // push subscription failed — background notifications still work
      }
    }

    return result as NotifPermission;
  };

  /** Re-registra subscription se permissão já foi concedida (ex: ao reabrir o app) */
  useEffect(() => {
    if (permission !== 'granted' || !user || !VAPID_PUBLIC_KEY) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    navigator.serviceWorker.ready.then(async (reg) => {
      try {
        const existing = await reg.pushManager.getSubscription();
        if (existing) await savePushSubscription(user.id, existing);
      } catch {
        // ignore
      }
    });
  }, [permission, user?.id]);

  return { permission, requestPermission };
};
