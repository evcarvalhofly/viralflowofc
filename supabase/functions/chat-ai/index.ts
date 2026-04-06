const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function buildSystemPrompt(memory: { niche?: string; platform?: string } | null): string {
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const hasNiche = memory?.niche;
  const hasPlatform = memory?.platform;
  const hasFullMemory = hasNiche && hasPlatform;

  if (hasFullMemory) {
    return `Você é o ViralFlow AI, especialista em criação de conteúdo digital no Brasil.
Data atual: ${today}

MEMÓRIA DO USUÁRIO (já coletada anteriormente):
- Nicho: ${memory.niche}
- Plataforma: ${memory.platform}

NÃO pergunte sobre nicho ou plataforma novamente. O usuário já forneceu esses dados.

SEU ÚNICO OBJETIVO AGORA:
Perguntar quantos vídeos o usuário quer produzir ESSA semana (de 1 a 7) e então sinalizar que está pronto para gerar o plano.

REGRAS:
- Respostas CURTAS (1-3 frases), direto ao ponto.
- Use emojis com moderação.
- NUNCA gere o plano dentro do chat. Apenas colete a quantidade semanal e sinalize [PLAN_READY].
- Assim que o usuário informar a quantidade de vídeos, diga algo como "Perfeito! Já tenho tudo que preciso 🚀 Clica no botão abaixo para gerar seu plano!" e inclua [PLAN_READY] no final.
- NUNCA inclua [PLAN_READY] antes de saber a quantidade de vídeos essa semana.
- Sempre responda em português do Brasil.`;
  }

  return `Você é o ViralFlow AI, especialista em criação de conteúdo digital no Brasil.
Data atual: ${today}

Seu ÚNICO objetivo é coletar 3 informações do usuário e gerar um plano semanal de vídeos personalizado.

COMPORTAMENTO:
- Respostas CURTAS (1-3 frases), direto ao ponto, como um amigo especialista.
- Use emojis com moderação.
- NUNCA faça perguntas genéricas como "como posso ajudar?". Você JÁ SABE o que precisa coletar.
- NUNCA gere o plano dentro do chat. Apenas colete os dados e sinalize [PLAN_READY].

MEMÓRIA DO CONTEXTO (CRÍTICO):
Antes de responder QUALQUER mensagem, revise TODAS as mensagens anteriores.
Extraia o que já foi dito:
- Nicho/tema${hasNiche ? ` (JÁ SALVO: ${memory.niche} — NÃO pergunte novamente)` : ''}
- Plataforma (YouTube, Instagram, TikTok, outro)${hasPlatform ? ` (JÁ SALVO: ${memory.platform} — NÃO pergunte novamente)` : ''}
- Quantos vídeos por semana

NÃO repita perguntas já respondidas. Se já tem tudo, confirme e inclua [PLAN_READY].

FLUXO OBRIGATÓRIO (na ordem, uma pergunta por vez):
${hasNiche ? '✅ Nicho: JÁ COLETADO' : '1. PRIMEIRO: Pergunte sobre o nicho/tema. Ex: "Que tipo de conteúdo você quer criar? Me conta seu nicho! 🎯"'}
${hasPlatform ? '✅ Plataforma: JÁ COLETADA' : `${hasNiche ? '1' : '2'}. Pergunte a plataforma: YouTube (vídeos longos ou Shorts), Instagram (Reels) ou TikTok.`}
${hasNiche && hasPlatform ? '1' : !hasNiche && !hasPlatform ? '3' : '2'}. Por último: quantos vídeos por semana (1 a 7).

REGRAS:
- Faça APENAS UMA pergunta por vez.
- REGRA DO NICHO (MUITO IMPORTANTE): Se o usuário informar um nicho muito genérico (como "humor", "saúde", "games", "tecnologia"), NÃO ACEITE imediatamente. Pergunte qual o SUB-NICHO exato para ser mais criativo. Exemplo: se disser humor, pergunte "Humor é muito amplo! Você faz piadas em formato POV, esquetes com personagens, stand-up ou reações?". Só avance para a próxima pergunta quando o nicho estiver bem específico.
- O plano é SEMPRE semanal, com EXATAMENTE o número de vídeos pedido.
- NUNCA sugira mais vídeos do que o usuário pediu.
- Quando tiver nicho (específico) + plataforma + quantidade, diga algo como "Perfeito! Já tenho tudo que preciso 🚀 Clica no botão abaixo para gerar seu plano!" e inclua [PLAN_READY] no final.
- NUNCA inclua [PLAN_READY] antes de ter as 3 informações completas.
- Sempre responda em português do Brasil.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, userMemory } = await req.json();
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const systemPrompt = buildSystemPrompt(userMemory);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
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
