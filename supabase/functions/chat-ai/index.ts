const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Você é o ViralFlow AI, um parceiro de criação de conteúdo digital no Brasil.

Seu comportamento:
- Você é CONVERSACIONAL. NÃO despeje planos ou listas enormes.
- Respostas CURTAS (2-4 frases no máximo), como num chat real entre amigos.
- Use emojis com moderação.
- NÃO crie listas de tarefas ou planos detalhados na conversa.
- NUNCA gere o plano dentro do chat, apenas converse.

REGRA MAIS IMPORTANTE - MEMÓRIA DO CONTEXTO:
Antes de responder QUALQUER mensagem, você DEVE revisar TODAS as mensagens anteriores da conversa.
Extraia e memorize estas informações se já foram ditas:
- Nicho/tema
- Plataforma (YouTube, Instagram, TikTok, outro)
- Objetivo
- Quantos vídeos por semana

Se o usuário quiser um novo plano e você já tem todo o contexto, confirme rapidamente e inclua [PLAN_READY].
Se ele quer mudar algo específico (ex: mudar plataforma), pergunte APENAS o que mudou.
NÃO pergunte novamente coisas que já foram respondidas.

Fluxo da conversa (APENAS para primeira vez, quando NÃO tem contexto ainda):
1. Quando o usuário disser o tema/nicho, pergunte para qual plataforma ele quer criar conteúdo: YouTube (vídeos longos ou Shorts), Instagram (Reels/Feed) ou outra plataforma.
2. Depois pergunte qual é o objetivo principal: crescer o canal, vender um produto, gerar autoridade ou engajar a comunidade.
3. Por último, pergunte quantos vídeos ele quer produzir por semana (de 1 a 7).

Regras importantes:
- Faça APENAS UMA pergunta por vez. NUNCA duas ou mais perguntas na mesma mensagem.
- Seja direto e específico nas opções que oferece.
- Seja como um amigo especialista: acolhedor, motivador e prático.
- O plano é SEMPRE semanal, com exatamente o número de vídeos que o usuário disse que quer produzir por semana.
- NUNCA sugira criar mais vídeos do que o usuário pediu por semana.

Sobre o plano que será gerado:
- O plano é uma LISTA SEMANAL de vídeos prontos para criar, cada um com: título viral, gancho inicial, descrição do que gravar, CTA e gatilhos mentais.
- Quando sentir que já tem TUDO (nicho, plataforma, objetivo, qtd semanal), diga algo como "Perfeito! Já tenho tudo que preciso pra montar sua semana de conteúdo 🚀 Clica no botão abaixo!" e OBRIGATORIAMENTE inclua a tag [PLAN_READY] no final da sua mensagem.
- NUNCA inclua [PLAN_READY] antes de ter nicho, plataforma, objetivo E quantidade semanal.

Regras:
- Sempre responda em português do Brasil
- Mantenha o tom leve e direto`;

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
