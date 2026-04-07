import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildPushPayload, type PushSubscription, type PushMessage, type VapidKeys } from 'npm:@block65/webcrypto-web-push@1.0.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const VAPID_PUBLIC_KEY     = Deno.env.get('VAPID_PUBLIC_KEY')!;
    const VAPID_PRIVATE_KEY    = Deno.env.get('VAPID_PRIVATE_KEY')!;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { user_id, title, body, url } = await req.json();
    if (!user_id) return new Response('missing user_id', { status: 400, headers: corsHeaders });

    const { data: subs, error: subsError } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth, subscription')
      .eq('user_id', user_id);

    if (subsError) console.warn('push_subscriptions fetch error:', subsError);
    if (!subs || subs.length === 0) {
      console.log('send-web-push | no subscriptions for user:', user_id);
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const vapid: VapidKeys = {
      subject: 'mailto:evcarvalhodev@gmail.com',
      publicKey: VAPID_PUBLIC_KEY,
      privateKey: VAPID_PRIVATE_KEY,
    };

    const pushData = JSON.stringify({ title, body, url: url || '/' });
    const message: PushMessage = { data: pushData, options: { ttl: 86400 } };

    let sent = 0;
    const stale: string[] = [];
    const errors: string[] = [];

    await Promise.all(
      subs.map(async (sub) => {
        const p256dh = sub.p256dh ?? sub.subscription?.keys?.p256dh;
        const auth   = sub.auth   ?? sub.subscription?.keys?.auth;
        if (!p256dh || !auth) {
          console.warn('send-web-push | skipping sub without keys:', sub.id);
          return;
        }
        try {
          const subscription: PushSubscription = {
            endpoint: sub.endpoint,
            expirationTime: null,
            keys: { p256dh, auth },
          };
          const payload = await buildPushPayload(message, subscription, vapid);
          const response = await fetch(sub.endpoint, payload);
          const responseText = await response.text();

          if (response.ok || response.status === 201) {
            sent++;
            console.log('send-web-push | sent OK to:', sub.endpoint.slice(0, 60));
          } else {
            errors.push(`${response.status}: ${responseText.slice(0, 100)}`);
            console.warn('send-web-push | push failed:', response.status, responseText.slice(0, 100));
            if (response.status === 404 || response.status === 410) {
              stale.push(sub.endpoint);
            }
          }
        } catch (err: any) {
          console.warn('send-web-push | exception:', sub.endpoint.slice(0, 60), String(err));
          errors.push(String(err));
        }
      }),
    );

    if (stale.length > 0) {
      await admin.from('push_subscriptions').delete().in('endpoint', stale);
      console.log('send-web-push | removed stale:', stale.length);
    }

    console.log('send-web-push | user:', user_id, '| sent:', sent, '| errors:', errors.length);
    return new Response(JSON.stringify({ sent, errors: errors.length > 0 ? errors : undefined }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('send-web-push error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
