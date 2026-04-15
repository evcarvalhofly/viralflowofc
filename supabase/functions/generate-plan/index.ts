const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Rule: max 10 plan generations per month ──
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count: monthlyCount, error: countError } = await supabase
      .from('daily_plans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user_id)
      .gte('created_at', monthStart);

    if (countError) {
      console.error('Monthly count error:', countError);
    }

    const MONTHLY_LIMIT = 10;
    if ((monthlyCount ?? 0) >= MONTHLY_LIMIT) {
      return new Response(
        JSON.stringify({
          error: 'monthly_limit_reached',
          message: `Você atingiu o limite de ${MONTHLY_LIMIT} planejamentos este mês. O limite renova no dia 1º do próximo mês. 🗓️`,
          used: monthlyCount,
          limit: MONTHLY_LIMIT,
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Fetch all previous video titles to avoid repetition ──
    const { data: previousItems } = await supabase
      .from('plan_items')
      .select('title')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(200);

    const previousTitles = previousItems?.map((i: { title: string }) => i.title) ?? [];

    const avoidRepetitionInstruction = previousTitles.length > 0
      ? `\n\nIMPORTANTE - NUNCA repita ideias já geradas anteriormente. Estes títulos JÁ FORAM usados e NÃO podem ser reutilizados nem adaptados:\n${previousTitles.map((t: string) => `- ${t}`).join('\n')}\n\nGere ideias completamente novas e diferentes das acima.`
      : '';

    // Call OpenAI with tool calling to extract structured plan
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Você é o ViralFlow AI, especialista em criar vídeos virais no Brasil. Com base na conversa, gere um PLANO SEMANAL de vídeos altamente detalhados e prontos para gravar.

REGRA NÚMERO 1: O plano é SEMANAL. Gere EXATAMENTE o número de vídeos que o usuário pediu por semana. Nem mais, nem menos.

PROIBIDO gerar tarefas genéricas como: "definir tema", "escrever roteiro", "editar vídeo", "criar miniatura", "postar nas redes", "analisar estatísticas". Isso NÃO é um plano de vídeos.

CADA item do plano deve ser UM VÍDEO ESPECÍFICO e completo, seguindo este padrão EXATO (com os emojis e tópicos listados):

1. TÍTULO: 📌 Título — Um título viral e chamativo para o vídeo/post.
2. DESCRIÇÃO: Deve conter os seguintes 4 tópicos exatamente com estes emojis e nomes:
   🎬 Gancho inicial — O que dizer/mostrar nos primeiros 3 segundos para prender a atenção.
   🎥 Orientação visual — O que mostrar no vídeo: cenas, cortes, ritmo, música.
   📣 CTA (Call to Action) — A ação que o espectador deve tomar.
   🧠 Gatilhos mentais — Técnicas psicológicas usadas no conteúdo (Curiosidade, Urgência, Medo, Identificação, Polêmica, etc).

EXEMPLO DE DESCRIÇÃO BEM FEITA:
"🎬 Gancho inicial: 'A número 3 quase me matou...'
🎥 Orientação visual: Mostrar cada manobra com cortes rápidos e música épica.
📣 CTA: 'Salva pra não esquecer e comenta a sua favorita!'
🧠 Gatilhos mentais: Curiosidade, Medo, Identificação"

${avoidRepetitionInstruction}

TAMBÉM extraia do contexto:
- O nicho/tema principal do criador
- A plataforma escolhida (YouTube, Instagram, TikTok, etc.)

SEMPRE use a ferramenta create_plan para retornar o plano. NUNCA retorne texto puro.`
          },
          ...messages,
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'create_plan',
              description: 'Create a structured weekly content plan with video ideas',
              parameters: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Plan title (e.g. "Semana de Conteúdo - Fitness")' },
                  description: { type: 'string', description: 'Brief description of the weekly plan' },
                  niche: { type: 'string', description: 'The creator niche/theme extracted from the conversation' },
                  platform: { type: 'string', description: 'The chosen platform (YouTube, Instagram, TikTok, etc.)' },
                   items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', description: '📌 Título — Um título viral e chamativo para o vídeo/post.' },
                        description: { type: 'string', description: 'Descrição do vídeo contendo os quatro tópicos obrigatórios: 🎬 Gancho inicial, 🎥 Orientação visual, 📣 CTA (Call to Action) e 🧠 Gatilhos mentais.' },
                      },
                      required: ['title', 'description'],
                      additionalProperties: false,
                    },
                  },
                },
                required: ['title', 'items'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'create_plan' } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `OpenAI error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.function.name !== 'create_plan') {
      return new Response(
        JSON.stringify({ error: 'AI did not generate a plan' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const plan = JSON.parse(toolCall.function.arguments);
    const today = new Date().toISOString().split('T')[0];

    // ── Save / update user AI memory (niche + platform) ──
    if (plan.niche || plan.platform) {
      const { error: memError } = await supabase
        .from('user_ai_memory')
        .upsert(
          {
            user_id,
            ...(plan.niche ? { niche: plan.niche } : {}),
            ...(plan.platform ? { platform: plan.platform } : {}),
          },
          { onConflict: 'user_id' }
        );
      if (memError) console.error('Memory upsert error:', memError);
    }

    // Insert the plan
    const { data: planData, error: planError } = await supabase
      .from('daily_plans')
      .insert({
        user_id,
        plan_date: today,
        title: plan.title,
        description: plan.description || null,
      })
      .select()
      .single();

    if (planError) {
      console.error('Plan insert error:', planError);
      return new Response(
        JSON.stringify({ error: 'Failed to save plan' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert checklist items
    if (plan.items?.length > 0) {
      const items = plan.items.map((item: { title: string; description?: string }, i: number) => ({
        plan_id: planData.id,
        user_id,
        title: item.title,
        description: item.description || null,
        sort_order: i,
      }));

      const { error: itemsError } = await supabase.from('plan_items').insert(items);
      if (itemsError) console.error('Items insert error:', itemsError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        plan: {
          id: planData.id,
          title: plan.title,
          items_count: plan.items?.length || 0,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Generate plan error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
