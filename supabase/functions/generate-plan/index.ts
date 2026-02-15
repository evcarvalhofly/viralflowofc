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
            content: `Você é o ViralFlow AI. Com base na conversa, extraia um plano de criação de conteúdo estruturado.
Crie um plano com título descritivo e itens de checklist específicos e acionáveis.
Cada item deve ser uma tarefa clara que o criador pode executar (ex: "Gravar vídeo de 60s sobre X", "Editar com transição Y", "Postar às 19h no TikTok").
SEMPRE use a ferramenta create_plan para retornar o plano.`
          },
          ...messages,
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'create_plan',
              description: 'Create a structured content creation plan with checklist items',
              parameters: {
                type: 'object',
                properties: {
                  title: { type: 'string', description: 'Plan title (e.g. "Plano de Conteúdo Fitness - Dia 1")' },
                  description: { type: 'string', description: 'Brief description of the plan' },
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string', description: 'Checklist item title' },
                        description: { type: 'string', description: 'Optional details' },
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
