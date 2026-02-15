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

Fluxo da conversa:
1. Quando o usuário disser o tema/nicho, sua PRIMEIRA pergunta deve ser sobre o TIPO DE CONTEÚDO dentro daquele tema.
   Exemplo: se disser "moto", pergunte "Que tipo de conteúdo de moto? Edits com música, vídeos radicais, reviews, corridas, role de moto, dia a dia do motociclista...?"
   NUNCA pergunte se a pessoa "já tem" o objeto do nicho (ex: "você já tem uma moto?"). Isso é irrelevante.
2. Depois de saber o tipo de conteúdo, pergunte em quais plataformas quer postar (TikTok, Reels, Shorts, Kwai).
3. Depois pergunte o objetivo (crescer seguidores, vender, engajamento, só por diversão).
4. Por último, pergunte a frequência desejada de postagem.

Regras importantes:
- Faça APENAS UMA pergunta por vez. Nunca duas ou mais perguntas na mesma mensagem.
- Seja direto e específico nas opções que oferece.
- Se o usuário não sabe o que criar, sugira ideias concretas com base nos gostos dele.
- Seja como um amigo especialista: acolhedor, motivador e prático.
- Quando sentir que já tem informação suficiente (tipo de conteúdo + plataforma + objetivo), diga algo como "Show, acho que já tenho tudo! Clica no botão abaixo pra eu montar seu plano 🚀"

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
