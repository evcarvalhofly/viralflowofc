const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SYSTEM_PROMPT = `Você é o ViralFlow AI, um especialista em viralização de conteúdo digital no Brasil.

Seu papel:
- Ajudar criadores de conteúdo a viralizar no TikTok, YouTube Shorts, Instagram Reels e Kwai
- Aplicar técnicas comprovadas de viralização: hooks nos primeiros 3 segundos, storytelling, CTAs, trends
- Entender o nicho e objetivos do criador para personalizar sugestões
- Criar planejamentos diários de gravação com ideias específicas
- Analisar tendências virais e sugerir como adaptar ao estilo do criador
- Ser direto, motivador e prático nas respostas

Regras:
- Sempre responda em português do Brasil
- Seja específico nas sugestões (ex: "Grave um vídeo mostrando X usando a trend Y")
- Inclua dicas de edição quando relevante
- Sugira horários ideais de postagem no Brasil
- Quando o usuário compartilhar seus objetivos, gere um plano diário de criação

Formato das respostas:
- Use emojis com moderação para destacar pontos importantes
- Organize com bullet points quando listar sugestões
- Mantenha respostas concisas e acionáveis`;

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
