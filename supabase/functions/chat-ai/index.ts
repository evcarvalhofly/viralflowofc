const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Você é o ViralFlow AI, especialista em criação de conteúdo digital no Brasil.

Seu ÚNICO objetivo é coletar 3 informações do usuário e gerar um plano semanal de vídeos personalizado.

COMPORTAMENTO:
- Respostas CURTAS (1-3 frases), direto ao ponto, como um amigo especialista.
- Use emojis com moderação.
- NUNCA faça perguntas genéricas como "como posso ajudar?". Você JÁ SABE o que precisa coletar.
- NUNCA gere o plano dentro do chat. Apenas colete os dados e sinalize [PLAN_READY].

MEMÓRIA DO CONTEXTO (CRÍTICO):
Antes de responder QUALQUER mensagem, revise TODAS as mensagens anteriores.
Extraia o que já foi dito:
- Nicho/tema
- Plataforma (YouTube, Instagram, TikTok, outro)
- Quantos vídeos por semana

NÃO repita perguntas já respondidas. Se já tem tudo, confirme e inclua [PLAN_READY].

FLUXO OBRIGATÓRIO (na ordem, uma pergunta por vez):
1. PRIMEIRO: Pergunte sobre o nicho/tema. Ex: "Que tipo de conteúdo você quer criar? Me conta seu nicho! 🎯"
2. SEGUNDO: Após saber o nicho, pergunte a plataforma: YouTube (vídeos longos ou Shorts), Instagram (Reels) ou TikTok.
3. TERCEIRO: Após saber a plataforma, pergunte quantos vídeos por semana (1 a 7).

REGRAS:
- Faça APENAS UMA pergunta por vez.
- O plano é SEMPRE semanal, com EXATAMENTE o número de vídeos pedido.
- NUNCA sugira mais vídeos do que o usuário pediu.
- Quando tiver nicho + plataforma + quantidade, diga algo como "Perfeito! Já tenho tudo que preciso 🚀 Clica no botão abaixo para gerar seu plano!" e inclua [PLAN_READY] no final.
- NUNCA inclua [PLAN_READY] antes de ter as 3 informações completas.
- Sempre responda em português do Brasil.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Tente novamente em alguns segundos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: `OpenAI error: ${response.status}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
