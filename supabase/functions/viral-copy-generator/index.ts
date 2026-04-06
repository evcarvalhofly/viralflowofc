const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { text } = await req.json();

    if (!text || text.trim().length === 0) {
      throw new Error("O texto descritivo do vídeo não foi fornecido.");
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada.");

    const year = new Date().getFullYear();
    const prompt = `Você é um estrategista de conteúdo viral especializado em TikTok, Instagram Reels e YouTube Shorts no Brasil. Ano atual: ${year}.

A partir da descrição do vídeo abaixo, gere copy viral de alto impacto aplicando as melhores práticas de viralização:

DESCRIÇÃO DO VÍDEO:
"""
${text}
"""

METODOLOGIA QUE VOCÊ DEVE APLICAR:
1. HOOK (primeiros 1-2 segundos): Use uma das fórmulas comprovadas:
   - Curiosidade: "Você não vai acreditar no que aconteceu quando..."
   - Contrário: "Todo mundo erra nisso, mas poucos admitem..."
   - Promessa de valor: "Depois disso, você nunca mais vai..."
   - Choque/surpresa: fato inesperado ou virada que prende atenção

2. CONTEÚDO: Adapte o tema central do vídeo para criar conexão emocional (humor, identificação, aprendizado, polêmica saudável)

3. CTA IRRESISTÍVEL: Induza comentários ("Comente se você já passou por isso"), compartilhamentos ("Manda pra quem precisa ver") ou salvamentos ("Salva pra usar depois")

4. HASHTAGS: Mix estratégico — 1-2 hashtags de nicho específico + 1-2 hashtags amplas de tendência

Gere o JSON abaixo. Use o ano ${year} se mencionar datas. Responda APENAS com o JSON, sem markdown:

{
  "hook": "string — Frase de abertura explosiva para os primeiros segundos do vídeo (máx 15 palavras)",
  "titulo": "string — Título/legenda principal viral com emojis estratégicos (máx 100 caracteres)",
  "descricao": "string — Descrição completa otimizada para algoritmo com hashtags táticas (2-4 linhas)",
  "copy": "string — Copy alternativa mais curta e direta com CTA forte no final"
}`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 1000,
        temperature: 0.8,
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      throw new Error(`OpenAI error: ${aiRes.status} — ${err}`);
    }

    const aiData = await aiRes.json();
    let result;
    try {
      result = JSON.parse(aiData.choices[0].message.content);
    } catch (e) {
      throw new Error(`Erro ao gerar JSON com a OpenAI: ${aiData.choices[0].message.content}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: result
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("viral-copy-generator error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
