/**
 * send-subscription-reminder
 *
 * Rodada diariamente (cron). Envia lembretes de renovação para assinantes:
 *   - 7 dias antes do vencimento
 *   - 2 dias antes do vencimento
 *   - No dia do vencimento
 *   - 2 dias após o vencimento (se não renovou)
 *
 * Usa a tabela `subscription_reminders` para garantir que cada lembrete
 * seja enviado apenas uma vez por ciclo de vencimento.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createTransport } from 'npm:nodemailer@6';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const renewUrl = 'https://viralflow-gilt.vercel.app/minha-conta';
const whatsappUrl = 'https://wa.me/5512992275476';

type ReminderType = '7d' | '2d' | '0d' | 'post2d';

const REMINDER_CONFIG: Record<ReminderType, { subject: string; daysText: string; isExpired: boolean }> = {
  '7d':     { subject: 'Sua assinatura ViralFlow PRO vence em 7 dias',          daysText: 'em 7 dias',   isExpired: false },
  '2d':     { subject: 'Sua assinatura ViralFlow PRO vence em 2 dias ⚡',        daysText: 'em 2 dias',   isExpired: false },
  '0d':     { subject: '🔔 Sua assinatura ViralFlow PRO vence hoje!',           daysText: 'hoje',        isExpired: false },
  'post2d': { subject: 'Sua assinatura ViralFlow PRO venceu — renove agora',    daysText: 'há 2 dias',   isExpired: true  },
};

function buildHtml(type: ReminderType): string {
  const cfg = REMINDER_CONFIG[type];

  const headerBg =
    type === 'post2d' ? 'linear-gradient(135deg,#dc2626,#b91c1c)' :
    type === '0d'     ? 'linear-gradient(135deg,#d97706,#b45309)' :
    type === '2d'     ? 'linear-gradient(135deg,#9333ea,#7c3aed)' :
                        'linear-gradient(135deg,#7c3aed,#9333ea)';

  const headingColor =
    type === 'post2d' ? '#ef4444' :
    type === '0d'     ? '#f59e0b' :
                        '#a78bfa';

  const headingText = cfg.isExpired
    ? `Sua assinatura venceu ${cfg.daysText} &#128274;`
    : `Sua assinatura vence ${cfg.daysText}! &#9201;`;

  const bodyText = cfg.isExpired
    ? `Sua assinatura do <strong style="color:#fff;">ViralFlow PRO</strong> venceu ${cfg.daysText}. Renove agora e volte a ter acesso a todas as ferramentas.`
    : `Sua assinatura do <strong style="color:#fff;">ViralFlow PRO</strong> vence ${cfg.daysText}. Renove agora para n&atilde;o perder o acesso!`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#0f0f13;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
    <div style="background:${headerBg};padding:32px;text-align:center;">
      <span style="font-size:36px;display:block;margin-bottom:8px;">&#9889;</span>
      <h1 style="margin:0;color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">ViralFlow</h1>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">Crie conte&uacute;do viral com intelig&ecirc;ncia artificial</p>
    </div>
    <div style="padding:36px 32px;">
      <h2 style="color:${headingColor};font-size:20px;margin:0 0 12px;">${headingText}</h2>
      <p style="color:#a1a1aa;font-size:15px;line-height:1.7;margin:0 0 28px;">${bodyText}</p>
      <div style="text-align:center;margin-bottom:16px;">
        <a href="${renewUrl}"
           style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#9333ea);color:#fff;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:700;font-size:15px;">
          Renovar minha assinatura &rarr;
        </a>
      </div>
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${whatsappUrl}"
           style="display:inline-block;background:#25d366;color:#fff;text-decoration:none;padding:12px 32px;border-radius:12px;font-weight:700;font-size:14px;">
          &#128172; Suporte no WhatsApp
        </a>
      </div>
      <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="color:#a78bfa;font-size:13px;font-weight:700;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.5px;">O que voc&ecirc; ${cfg.isExpired ? 'tinha' : 'tem'} com o PRO</p>
        <ul style="color:#a1a1aa;font-size:13px;line-height:2;margin:0;padding:0 0 0 16px;">
          <li>Planejamento de conte&uacute;do autom&aacute;tico</li>
          <li>Pacote de v&iacute;deos virais</li>
          <li>Material de edi&ccedil;&atilde;o de v&iacute;deo</li>
          <li>Editor de v&iacute;deo</li>
          <li>Corte autom&aacute;tico com IA</li>
          <li>Legendas autom&aacute;ticas com IA</li>
          <li>Comunidade</li>
          <li>Afiliados</li>
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
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const SMTP_PASSWORD        = Deno.env.get('SMTP_PASSWORD')!;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // ── Janelas de tempo (baseadas na meia-noite do dia atual) ────────────────
    const now   = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    /** Meia-noite UTC do dia (today + offsetDays) */
    const dayStart = (offsetDays: number) =>
      new Date(today.getTime() + offsetDays * 86_400_000).toISOString();
    /** Fim do dia UTC (day + offsetDays + 1 dia) */
    const dayEnd = (offsetDays: number) =>
      new Date(today.getTime() + (offsetDays + 1) * 86_400_000).toISOString();

    const windows: { type: ReminderType; start: string; end: string }[] = [
      { type: '7d',     start: dayStart(7),  end: dayEnd(7)  },
      { type: '2d',     start: dayStart(2),  end: dayEnd(2)  },
      { type: '0d',     start: dayStart(0),  end: dayEnd(0)  },
      // post2d: venceu há 1, 2 ou 3 dias (pega qualquer um ainda não notificado)
      { type: 'post2d', start: dayStart(-3), end: dayEnd(-1) },
    ];

    const transporter = createTransport({
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true,
      auth: { user: 'evandro@goupwin.com', pass: SMTP_PASSWORD },
    });

    const results: Record<string, number> = {};
    let totalSent = 0;

    for (const win of windows) {
      // Busca assinantes no intervalo de vencimento
      const { data: profiles, error: profilesErr } = await admin
        .from('profiles')
        .select('user_id, subscription_expires_at, subscription_status')
        .gte('subscription_expires_at', win.start)
        .lt('subscription_expires_at', win.end);

      if (profilesErr) {
        console.error(`[${win.type}] DB error:`, profilesErr.message);
        results[win.type] = 0;
        continue;
      }

      // Para lembretes futuros (7d/2d/0d) só notifica quem está ativo
      const eligible = (profiles ?? []).filter(p =>
        win.type === 'post2d' || p.subscription_status === 'active'
      );

      let sentCount = 0;

      for (const profile of eligible) {
        const expiresAt = profile.subscription_expires_at;

        // Verifica se este lembrete já foi enviado para este ciclo de vencimento
        const { data: existing } = await admin
          .from('subscription_reminders')
          .select('id')
          .eq('user_id', profile.user_id)
          .eq('reminder_type', win.type)
          .eq('expires_at', expiresAt)
          .maybeSingle();

        if (existing) continue;

        // Busca e-mail via Auth REST API
        const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${profile.user_id}`, {
          headers: {
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'apikey': SUPABASE_SERVICE_KEY,
          },
        });
        if (!userRes.ok) continue;

        const authUser = await userRes.json();
        const email: string | undefined = authUser.email;
        if (!email) continue;

        const cfg = REMINDER_CONFIG[win.type];
        const textBody = cfg.isExpired
          ? `Sua assinatura ViralFlow PRO venceu ${cfg.daysText}.\n\nRenove agora e volte a ter acesso a todas as ferramentas.\n\nRenovar assinatura: ${renewUrl}\n\nPrecisa de ajuda? WhatsApp: ${whatsappUrl}\n\n---\nViralFlow · Para cancelar notificações, responda este e-mail.`
          : `Sua assinatura ViralFlow PRO vence ${cfg.daysText}.\n\nRenove agora para não perder o acesso!\n\nRenovar assinatura: ${renewUrl}\n\nPrecisa de ajuda? WhatsApp: ${whatsappUrl}\n\n---\nViralFlow · Para cancelar notificações, responda este e-mail.`;

        try {
          await transporter.sendMail({
            from: '"ViralFlow" <evandro@goupwin.com>',
            replyTo: 'evandro@goupwin.com',
            to: email,
            subject: REMINDER_CONFIG[win.type].subject,
            text: textBody,
            html: buildHtml(win.type),
            headers: {
              'List-Unsubscribe': '<mailto:evandro@goupwin.com?subject=unsubscribe>',
              'X-Entity-Ref-ID': `viralflow-reminder-${win.type}-${profile.user_id}`,
            },
          });

          // Registra envio — UNIQUE impede duplicatas se a função rodar mais de uma vez no dia
          await admin.from('subscription_reminders').insert({
            user_id:       profile.user_id,
            reminder_type: win.type,
            expires_at:    expiresAt,
          });

          sentCount++;
          totalSent++;
          console.log(`[${win.type}] sent → ${email} | expires: ${expiresAt}`);
        } catch (mailErr) {
          console.error(`[${win.type}] mail error → ${email}:`, mailErr);
        }
      }

      results[win.type] = sentCount;
    }

    return new Response(JSON.stringify({ ok: true, sent: totalSent, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('send-subscription-reminder error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
