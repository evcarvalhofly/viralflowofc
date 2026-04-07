import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildPushPayload, type PushSubscription, type PushMessage, type VapidKeys } from 'npm:@block65/webcrypto-web-push@1.0.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: corsHeaders });

  try {
    const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY          = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const VAPID_PUBLIC_KEY     = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const VAPID_PRIVATE_KEY    = Deno.env.get('VAPID_PRIVATE_KEY')!;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { title, body, url } = await req.json();

    if (!title || !body) {
      return new Response(JSON.stringify({ error: 'missing title or body' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Busca todas as push_subscriptions com chaves válidas
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, subscription');

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const vapid: VapidKeys = {
      subject: 'mailto:evcarvalhodev@gmail.com',
      publicKey: VAPID_PUBLIC_KEY,
      privateKey: VAPID_PRIVATE_KEY,
    };

    const pushData = JSON.stringify({
      title,
      body,
      url: url || '/avisos',
      notificationType: 'aviso',
    });
    const message: PushMessage = { data: pushData, options: { ttl: 86400 } };

    let sent = 0;
    const stale: string[] = [];

    await Promise.all(
      subs.map(async (sub) => {
        const p256dh = sub.p256dh ?? sub.subscription?.keys?.p256dh;
        const auth   = sub.auth   ?? sub.subscription?.keys?.auth;
        if (!p256dh || !auth) return;

        try {
          const subscription: PushSubscription = {
            endpoint: sub.endpoint,
            expirationTime: null,
            keys: { p256dh, auth },
          };
          const payload = await buildPushPayload(message, subscription, vapid);
          const response = await fetch(sub.endpoint, payload);
          await response.text();

          if (response.ok || response.status === 201) {
            sent++;
          } else if (response.status === 404 || response.status === 410) {
            stale.push(sub.endpoint);
          }
        } catch (err) {
          console.warn('notify-users-aviso | push error:', String(err));
        }
      }),
    );

    if (stale.length > 0) {
      await admin.from('push_subscriptions').delete().in('endpoint', stale);
    }

    console.log('notify-users-aviso | sent:', sent, '| stale removed:', stale.length);
    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('notify-users-aviso error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
