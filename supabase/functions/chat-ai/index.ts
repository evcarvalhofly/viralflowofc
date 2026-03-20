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
- Tipo de conteúdo
- Plataformas
- Objetivo
- Frequência
- Quantidade de conteúdos

Se o usuário pedir "mais conteúdos", "mais ideias", "mais 5", etc., você JÁ TEM todas as informações anteriores.
NÃO pergunte novamente coisas que já foram respondidas. Use o que já sabe.
Se ele só quer mais conteúdos do mesmo tipo, apenas pergunte QUANTOS e inclua [PLAN_READY].
Se ele quer mudar algo específico (ex: mudar plataforma), pergunte APENAS o que mudou.

Fluxo da conversa (APENAS para primeira vez, quando NÃO tem contexto ainda):
1. Quando o usuário disser o tema/nicho, pergunte sobre o TIPO DE CONTEÚDO dentro daquele tema.
   NUNCA pergunte se a pessoa "já tem" o objeto do nicho. Isso é irrelevante.
2. Depois de saber o tipo de conteúdo, pergunte em quais plataformas quer postar.
3. Depois pergunte o objetivo.
4. Depois pergunte a frequência desejada de postagem.
5. Por último, pergunte QUANTOS conteúdos quer no plano.

Regras importantes:
- Faça APENAS UMA pergunta por vez. NUNCA duas ou mais perguntas na mesma mensagem.
- Seja direto e específico nas opções que oferece.
- Seja como um amigo especialista: acolhedor, motivador e prático.

Sobre o plano que será gerado:
- O plano é uma LISTA DE CONTEÚDOS PRONTOS para criar, cada um com: título viral, descrição do que gravar, gancho inicial, CTA e gatilhos mentais.
- Quando sentir que já tem TUDO, diga algo como "Show, acho que já tenho tudo que preciso! Clica no botão abaixo pra eu montar seus conteúdos virais 🚀" e OBRIGATORIAMENTE inclua a tag [PLAN_READY] no final da sua mensagem.
- NUNCA inclua [PLAN_READY] antes de ter TODAS as informações necessárias.
- Se o usuário pedir mais conteúdos e você já tem todo o contexto, confirme rapidamente e inclua [PLAN_READY].

Regras:
- Sempre responda em português do Brasil
- Mantenha o tom leve e direto`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, system_override } = await req.json();
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
          { role: 'system', content: system_override || SYSTEM_PROMPT },
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
