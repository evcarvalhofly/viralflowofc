import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createTransport } from 'npm:nodemailer@6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SMTP_PASSWORD        = Deno.env.get('SMTP_PASSWORD')!;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Busca sessões PIX não pagas, criadas há mais de 10 minutos, sem lembrete enviado ainda
    const { data: sessions, error } = await admin
      .from('checkout_sessions')
      .select('id, payer_email, created_at')
      .eq('status', 'created')
      .is('reminder_sent_at', null)
      .not('payer_email', 'is', null)
      .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString());

    if (error) {
      console.error('DB query error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!sessions || sessions.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transporter = createTransport({
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
      auth: { user: 'evandro@goupwin.com', pass: SMTP_PASSWORD },
    });

    const salesUrl = 'https://viralflow-gilt.vercel.app/planopro';

    let sent = 0;

    for (const session of sessions) {
      if (!session.payer_email) continue;

      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#0f0f13;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#7c3aed,#9333ea);padding:32px;text-align:center;">
      <span style="font-size:36px;display:block;margin-bottom:8px;">&#9889;</span>
      <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">ViralFlow</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Crie conte&uacute;do viral com intelig&ecirc;ncia artificial</p>
    </div>
    <!-- Body -->
    <div style="padding:36px 32px;">
      <h2 style="color:#f59e0b;font-size:20px;margin:0 0 12px;">Voc&ecirc; deixou algo para tr&aacute;s... &#128064;</h2>
      <p style="color:#a1a1aa;font-size:15px;line-height:1.7;margin:0 0 16px;">
        Vimos que voc&ecirc; gerou um PIX para assinar o <strong style="color:#fff;">ViralFlow PRO</strong>, mas o pagamento ainda n&atilde;o foi confirmado.
      </p>
      <p style="color:#a1a1aa;font-size:15px;line-height:1.7;margin:0 0 28px;">
        Se tiver alguma d&uacute;vida ou precisar de ajuda, &eacute; s&oacute; responder este e-mail. Caso queira finalizar agora, clique no bot&atilde;o abaixo:
      </p>
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${salesUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#9333ea);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:700;font-size:15px;">
          Finalizar minha compra &rarr;
        </a>
      </div>
      <!-- Benefícios rápidos -->
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="color:#a78bfa;font-size:13px;font-weight:700;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.5px;">O que voc&ecirc; vai ter com o PRO</p>
        <ul style="color:#a1a1aa;font-size:13px;line-height:2;margin:0;padding:0 0 0 16px;">
          <li>Roteiros virais gerados por IA</li>
          <li>Planejamento de conte&uacute;do autom&aacute;tico</li>
          <li>An&aacute;lise de tend&ecirc;ncias em tempo real</li>
          <li>Cortes virais e legendas autom&aacute;ticas</li>
          <li>Acesso &agrave; comunidade exclusiva</li>
        </ul>
      </div>
      <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:20px;">
        <p style="color:#52525b;font-size:12px;text-align:center;margin:0;">
          ViralFlow &middot; Pagamento 100% seguro &middot; Processado pelo MercadoPago
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;

      try {
        await transporter.sendMail({
          from: '"ViralFlow" <evandro@goupwin.com>',
          to: session.payer_email,
          subject: 'Voc\u00ea esqueceu de finalizar sua compra \u2014 ViralFlow PRO',
          html,
        });

        // Marca como enviado para não reenviar
        await admin
          .from('checkout_sessions')
          .update({ reminder_sent_at: new Date().toISOString() })
          .eq('id', session.id);

        sent++;
        console.log('PIX reminder sent to:', session.payer_email, '| session:', session.id);
      } catch (mailErr) {
        console.error('Failed to send reminder to:', session.payer_email, mailErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('send-pix-reminder error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
