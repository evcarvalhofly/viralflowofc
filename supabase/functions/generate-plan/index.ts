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

    // ── Rule: only 1 active plan at a time ──
    // Check if there are any incomplete items in existing plans
    const { data: incompletePlans, error: checkError } = await supabase
      .from('plan_items')
      .select('id, plan_id')
      .eq('user_id', user_id)
      .eq('completed', false)
      .limit(1);

    if (checkError) {
      console.error('Check active plan error:', checkError);
    }

    if (incompletePlans && incompletePlans.length > 0) {
      return new Response(
        JSON.stringify({
          error: 'active_plan_exists',
          message: 'Você ainda tem um plano em andamento! Conclua todos os itens do checklist antes de criar um novo planejamento. 💪',
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Fetch all previous video titles to avoid repetition ──
    const { data: previousItems } = await supabase
      .from('plan_items')
      .select('title')
      .eq('user_id', user_id)
      .order('created_at', { ascending: false })
      .limit(100);

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
            content: `Você é o ViralFlow AI. Com base na conversa, gere um PLANO SEMANAL de vídeos virais prontos para criar.

IMPORTANTE: O plano é SEMANAL. Gere exatamente o número de vídeos que o usuário disse que quer produzir por semana. NÃO gere mais nem menos.

NÃO gere tarefas genéricas como "definir tema", "escrever roteiro", "editar vídeo", "criar miniatura", "postar nas redes", "analisar estatísticas". Isso NÃO é um plano de vídeos.

Cada item do plano deve ser UM VÍDEO ESPECÍFICO pronto para ser criado, no formato:
- Título: um título viral e chamativo para o vídeo
- Descrição: descreva exatamente o que gravar, incluindo: gancho inicial (primeiros 3 segundos), o que mostrar no vídeo, CTA (call to action), e gatilhos mentais a usar (curiosidade, urgência, polêmica, identificação, etc.)

Exemplo BOM: "🔥 5 manobras que todo motociclista deveria saber | Gancho: 'A número 3 quase me matou...' | Mostrar cada manobra com cortes rápidos e música épica | CTA: 'Salva pra não esquecer' | Gatilhos: curiosidade, medo"

Exemplo RUIM: "Definir temas" ou "Escrever roteiro" ou "Editar vídeo"${avoidRepetitionInstruction}

SEMPRE use a ferramenta create_plan para retornar o plano.`
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
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', description: 'Video title (viral and engaging)' },
                        description: { type: 'string', description: 'Full video description: hook, visual guide, CTA, mental triggers' },
                      },
                      required: ['title'],
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
