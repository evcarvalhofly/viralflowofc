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
    const { messages, user_id, accounts_context } = await req.json();

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

    // Check if user has any incomplete plans
    const { data: existingPlans } = await supabase
      .from('daily_plans')
      .select('id')
      .eq('user_id', user_id);

    if (existingPlans && existingPlans.length > 0) {
      const planIds = existingPlans.map((p: any) => p.id);
      const { data: incompleteItems } = await supabase
        .from('plan_items')
        .select('id')
        .in('plan_id', planIds)
        .eq('completed', false)
        .limit(1);

      if (incompleteItems && incompleteItems.length > 0) {
        return new Response(
          JSON.stringify({ error: 'PLAN_INCOMPLETE', message: 'Conclua o seu planejamento atual para criar outro 📋' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const accountsContext = accounts_context
      ? `\n\nDados das contas do criador:\n${JSON.stringify(accounts_context, null, 2)}`
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
            content: `Você é o ViralFlow AI. Com base na conversa e nos dados das contas conectadas, gere uma LISTA DE CONTEÚDOS VIRAIS prontos para criar.${accountsContext}

IMPORTANTE: NÃO gere tarefas genéricas como "definir tema", "escrever roteiro", "editar vídeo", "criar miniatura", "postar nas redes", "analisar estatísticas". Isso NÃO é um plano de tarefas.

Cada item do plano deve ser UM CONTEÚDO ESPECÍFICO e detalhado pronto para ser criado, adaptado às plataformas e métricas do criador.

Para cada item, preencha OBRIGATORIAMENTE todos os campos:
- title: título viral e chamativo do vídeo/post (ex: "5 erros que todo iniciante comete no treino")
- hook: gancho dos primeiros 3 segundos — o que dizer/mostrar para prender a atenção imediatamente (ex: "Você tá perdendo tempo na academia sem saber disso...")
- visual_guide: orientação visual detalhada — o que gravar, como filmar, ritmo das cenas, transições, música sugerida
- cta: call to action específico no final do vídeo (ex: "Salva esse vídeo pra não esquecer e me segue pra mais dicas assim")
- mental_triggers: lista dos gatilhos mentais usados (ex: "curiosidade, urgência, identificação, polêmica")

Inspire-se nos vídeos mais bem-sucedidos do criador (se disponíveis nos dados) para criar conteúdos no mesmo estilo, mas com temas novos e frescos.

SEMPRE use a ferramenta create_plan para retornar o plano. Gere o número de conteúdos que o usuário pediu.`
          },
          ...messages,
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'create_plan',
              description: 'Create a structured content creation plan with detailed viral content items',
              parameters: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Plan title (e.g. "Plano de Conteúdo Fitness - 5 Vídeos")' },
                  description: { type: 'string', description: 'Brief description of the plan strategy' },
                  items: {
                    type: 'array',
                    description: 'List of viral content pieces to create',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', description: 'Viral and catchy title for the video/post' },
                        hook: { type: 'string', description: 'Exact hook for the first 3 seconds to grab attention immediately' },
                        visual_guide: { type: 'string', description: 'Detailed visual guide: what to film, how to film it, scene rhythm, transitions, suggested music' },
                        cta: { type: 'string', description: 'Specific call to action at the end of the video' },
                        mental_triggers: { type: 'string', description: 'Mental triggers used (e.g. curiosity, urgency, controversy, identification)' },
                      },
                      required: ['title', 'hook', 'visual_guide', 'cta', 'mental_triggers'],
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
      const items = plan.items.map((item: any, i: number) => ({
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
