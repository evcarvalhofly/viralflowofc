import { createTransport } from "npm:nodemailer@6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { email, is_guest } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'email required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const smtpPassword = Deno.env.get('SMTP_PASSWORD');
    if (!smtpPassword) {
      console.error('SMTP_PASSWORD not set');
      return new Response(JSON.stringify({ error: 'SMTP not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transporter = createTransport({
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
      auth: {
        user: 'evandro@goupwin.com',
        pass: smtpPassword,
      },
    });

    const parabensUrl = is_guest
      ? `https://viralflow-gilt.vercel.app/parabens?email=${encodeURIComponent(email)}`
      : 'https://viralflow-gilt.vercel.app';

    const subject = is_guest
      ? 'Pagamento confirmado &mdash; crie sua conta ViralFlow PRO'
      : 'Assinatura ViralFlow PRO ativada!';

    const headline = is_guest
      ? 'Pagamento confirmado! &#127881;'
      : 'Assinatura ativada! &#127881;';

    const headlineColor = is_guest ? '#a78bfa' : '#34d399';

    const body = is_guest
      ? 'Obrigado pela sua compra! Clique no bot&atilde;o abaixo para criar sua conta e come&ccedil;ar a usar o ViralFlow PRO agora mesmo.'
      : 'Obrigado pela renova&ccedil;&atilde;o! Seu plano PRO est&aacute; ativo por mais 30 dias. Continue criando conte&uacute;do viral.';

    const btnLabel = is_guest ? 'Criar minha conta &rarr;' : 'Acessar ViralFlow &rarr;';

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
      <h2 style="color:${headlineColor};font-size:22px;margin:0 0 12px;">${headline}</h2>
      <p style="color:#a1a1aa;font-size:15px;line-height:1.7;margin:0 0 28px;">${body}</p>
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${parabensUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#9333ea);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:700;font-size:15px;">
          ${btnLabel}
        </a>
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

    await transporter.sendMail({
      from: '"ViralFlow" <evandro@goupwin.com>',
      to: email,
      subject,
      html,
    });

    console.log('Welcome email sent to:', email, '| is_guest:', is_guest);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('send-welcome-email error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
