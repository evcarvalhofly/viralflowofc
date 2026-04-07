import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push';

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

    webpush.setVapidDetails(
      'mailto:evcarvalhodev@gmail.com',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
    );

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { user_id, title, body } = await req.json();
    if (!user_id) return new Response('missing user_id', { status: 400, headers: corsHeaders });

    const { data: subs, error: subsError } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, subscription')
      .eq('user_id', user_id);

    if (subsError) console.warn('push_subscriptions fetch error:', subsError);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const payload = JSON.stringify({ title, body });
    let sent = 0;
    const stale: string[] = [];

    await Promise.all(
      subs.map(async (sub) => {
        // Support both schema formats: separate columns OR nested subscription JSON
        const p256dh = sub.p256dh ?? sub.subscription?.keys?.p256dh;
        const auth   = sub.auth   ?? sub.subscription?.keys?.auth;
        if (!p256dh || !auth) return;
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh, auth } },
            payload,
          );
          sent++;
        } catch (err: any) {
          // 404/410 = subscription expired, remove it
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            stale.push(sub.endpoint);
          }
          console.warn('push failed for endpoint:', sub.endpoint, err?.statusCode);
        }
      }),
    );

    if (stale.length > 0) {
      await admin.from('push_subscriptions').delete().in('endpoint', stale);
    }

    console.log('send-web-push | user:', user_id, '| sent:', sent, '| stale removed:', stale.length);
    return new Response(JSON.stringify({ sent }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('send-web-push error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
