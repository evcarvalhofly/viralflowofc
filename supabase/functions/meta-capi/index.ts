/**
 * Meta Conversions API (CAPI) — server-side event tracking.
 * Deduplica com o pixel do browser via event_id.
 * Não requer autenticação (chamado de páginas públicas de venda).
 */

const PIXEL_ID = '1568008798663852';
const ACCESS_TOKEN = Deno.env.get('META_CAPI_TOKEN') ?? '';
const API_VERSION = 'v21.0';
const ENDPOINT = `https://graph.facebook.com/${API_VERSION}/${PIXEL_ID}/events`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** SHA-256 hash for user data normalization (Meta requires hashed PII) */
async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
}

interface EventPayload {
  event_name: string;       // PageView, ViewContent, InitiateCheckout, AddPaymentInfo, Purchase
  event_id: string;         // UUID para deduplicação com pixel browser
  event_source_url: string; // URL da página
  user_email?: string;      // Email do comprador (será hasheado)
  user_ip?: string;         // Preenchido pelo server se não enviado
  user_agent?: string;      // Preenchido pelo server se não enviado
  fbc?: string;             // Facebook Click ID (cookie _fbc)
  fbp?: string;             // Facebook Browser ID (cookie _fbp)
  custom_data?: {
    value?: number;
    currency?: string;
    content_name?: string;
    content_category?: string;
    content_type?: string;
    payment_method?: string;
    num_items?: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!ACCESS_TOKEN) {
    return new Response(
      JSON.stringify({ error: 'META_CAPI_TOKEN not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  try {
    const payload: EventPayload = await req.json();

    // Dados do usuário (hashed conforme Meta exige)
    const userData: Record<string, any> = {};

    if (payload.user_email) {
      userData.em = [await sha256(payload.user_email)];
    }

    // IP e User-Agent do request (server-side = mais confiável)
    const clientIp = payload.user_ip
      || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('cf-connecting-ip')
      || '';
    const clientUa = payload.user_agent || req.headers.get('user-agent') || '';

    if (clientIp) userData.client_ip_address = clientIp;
    if (clientUa) userData.client_user_agent = clientUa;

    // Facebook click/browser IDs para matching
    if (payload.fbc) userData.fbc = payload.fbc;
    if (payload.fbp) userData.fbp = payload.fbp;

    // Montar evento no formato da API
    const event: Record<string, any> = {
      event_name: payload.event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id: payload.event_id,
      event_source_url: payload.event_source_url,
      action_source: 'website',
      user_data: userData,
    };

    if (payload.custom_data) {
      event.custom_data = {
        ...payload.custom_data,
        currency: payload.custom_data.currency ?? 'BRL',
      };
    }

    // Enviar para Meta Conversions API
    const response = await fetch(`${ENDPOINT}?access_token=${ACCESS_TOKEN}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event] }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Meta CAPI error:', JSON.stringify(result));
      return new Response(
        JSON.stringify({ error: 'Meta API error', details: result }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, events_received: result.events_received }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (err) {
    console.error('meta-capi error:', err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
