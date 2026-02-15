const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { niche, searchResults } = await req.json();

    if (!niche) {
      return new Response(
        JSON.stringify({ success: false, error: 'Niche is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'LOVABLE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const summaries = (searchResults || [])
      .slice(0, 8)
      .map((r: any, i: number) => `${i + 1}. ${r.title || 'Sem título'}: ${r.description || ''}\nURL: ${r.url || ''}`)
      .join('\n\n');

    const systemPrompt = `Você é um especialista em criação de conteúdo viral para redes sociais (TikTok, YouTube Shorts, Instagram Reels, Facebook).
Seu objetivo é analisar tendências atuais e sugerir ideias de conteúdo viral para criadores.
Sempre responda em português brasileiro.
Seja direto, criativo e prático.`;

    const userPrompt = `Analise essas tendências virais do nicho "${niche}" e me dê:

1. **RESUMO DAS TENDÊNCIAS** — O que está bombando agora nesse nicho (3-5 tendências)
2. **5 IDEIAS DE CONTEÚDO VIRAL** — Cada uma com:
   - Título chamativo
   - Formato (TikTok/Reels/Shorts)
   - Gancho dos primeiros 3 segundos
   - Estrutura do vídeo
   - Dica de retenção
3. **HASHTAGS RECOMENDADAS** — 10 hashtags relevantes

Tendências encontradas:
${summaries || 'Nenhuma tendência específica encontrada. Gere ideias baseadas no conhecimento geral do nicho.'}`;

    console.log('Analyzing trends for niche:', niche);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      return new Response(
        JSON.stringify({ error: 'Erro na análise de tendências' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (e) {
    console.error('analyze-trends error:', e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
