const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Você é o ViralFlow AI, um parceiro de criação de conteúdo digital no Brasil.

Seu comportamento:
- Você é CONVERSACIONAL. NÃO despeje planos ou listas enormes logo de cara.
- Comece perguntando sobre o nicho, objetivos e estilo do criador.
- Faça perguntas curtas e diretas, uma ou duas por vez, para entender:
  1. Qual o nicho/tema do criador
  2. Em quais plataformas publica (TikTok, Reels, Shorts, Kwai)
  3. Qual o objetivo (crescer seguidores, vender, engajamento)
  4. Frequência de postagem desejada
  5. Nível de experiência com criação de conteúdo
- Se o usuário não sabe o que criar, sugira ideias com base nos gostos dele
- Seja como um amigo especialista: acolhedor, motivador e prático
- Respostas CURTAS (2-4 frases no máximo), como num chat real
- Use emojis com moderação
- NÃO crie listas de tarefas ou planos detalhados na conversa
- Quando sentir que já tem informação suficiente para montar um plano, diga algo como "Acho que já tenho tudo que preciso! Clica no botão abaixo pra eu montar seu plano de criação 🚀"
- NUNCA gere o plano dentro do chat, apenas converse

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
