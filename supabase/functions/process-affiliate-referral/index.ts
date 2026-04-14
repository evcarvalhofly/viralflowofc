/**
 * process-affiliate-referral
 *
 * Called right after a user registers.
 * - Creates the referral record for the affiliate who referred them
 * - If the user already has an active subscription (paid as guest before registering),
 *   immediately marks the referral as 'converted' and creates the commission
 * - Otherwise creates it as 'pending' (normal flow — commission processed later by mp-webhook)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { user_id, ref_code } = await req.json();

    if (!user_id || !ref_code) {
      return new Response(JSON.stringify({ error: 'user_id and ref_code are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const code = String(ref_code).toUpperCase();

    // 1. Find affiliate by ref_code
    const { data: affiliate } = await admin
      .from('affiliates')
      .select('id, commission_rate')
      .eq('ref_code', code)
      .eq('status', 'active')
      .maybeSingle();

    if (!affiliate) {
      console.log('No active affiliate found for ref_code:', code);
      return new Response(JSON.stringify({ ok: true, skipped: 'no_affiliate' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Avoid duplicate referrals
    const { data: existing } = await admin
      .from('referrals')
      .select('id, status')
      .eq('referred_user_id', user_id)
      .maybeSingle();

    if (existing) {
      console.log('Referral already exists for user:', user_id, '| status:', existing.status);
      return new Response(JSON.stringify({ ok: true, skipped: 'already_exists' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Check if user already has an active subscription (paid as guest before registering)
    const { data: profile } = await admin
      .from('profiles')
      .select('subscription_status, stripe_subscription_id')
      .eq('user_id', user_id)
      .maybeSingle();

    const alreadyActive = profile?.subscription_status === 'active';

    const now = new Date().toISOString();

    // 4. Create referral
    const { data: referral, error: refError } = await admin
      .from('referrals')
      .insert({
        affiliate_id:       affiliate.id,
        referred_user_id:   user_id,
        ref_code:           code,
        status:             alreadyActive ? 'converted' : 'pending',
        converted_at:       alreadyActive ? now : null,
      })
      .select('id')
      .single();

    if (refError || !referral) {
      console.error('Error creating referral:', refError);
      return new Response(JSON.stringify({ error: 'Failed to create referral' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Referral created | user:', user_id, '| affiliate:', affiliate.id, '| status:', alreadyActive ? 'converted' : 'pending');

    // 5. If already active: create commission immediately
    // Note: subscription_id is omitted (null) because MercadoPago payment IDs are not UUIDs
    if (alreadyActive) {
      const PRICE          = 47.90;
      const commAmount     = parseFloat(((affiliate.commission_rate / 100) * PRICE).toFixed(2));
      const availableAfter = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await admin.from('commissions').insert({
        affiliate_id:    affiliate.id,
        referral_id:     referral.id,
        type:            'initial',
        amount:          commAmount,
        status:          'pending',
        available_after: availableAfter,
        level:           1,
        period_start:    now,
      });

      console.log('Commission created immediately | affiliate:', affiliate.id, '| amount:', commAmount);
    }

    // 6. Mark click as converted
    await admin
      .from('ref_clicks')
      .update({ converted: true })
      .eq('affiliate_id', affiliate.id)
      .eq('ref_code', code)
      .eq('converted', false);

    return new Response(
      JSON.stringify({ ok: true, converted: alreadyActive }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('process-affiliate-referral error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
