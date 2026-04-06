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

    const now = new Date();
    const today = `${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()}`;
    const prompt = `Você é um Deus da viralização nas redes sociais (TikTok, Reels, Shorts) atuando no Brasil.\nData atual: ${today}. Use o ano correto ao mencionar datas em títulos e descrições.\n\nBaseado na seguinte descrição ou narração de um vídeo:\n"""\n${text}\n"""\n\nGere 3 textos criativos, curtos e projetados especificamente para EXPLODIR de acessos, curtidas, comentários e compartilhamentos.\nO formato de saída DEVE SER estritamente um JSON com a seguinte estrutura, sem markdown extra:\n\n{\n  "titulo": "string — Título viral extravagante e chamativo, com emojis.",\n  "descricao": "string — Descrição curta e engajadora para impulsionar o algoritmo, com hashtags táticas.",\n  "copy": "string — Copy/legenda direta focada 100% em induzir comentários/compartilhamentos, com uma CTA irresistível no final."\n}`;

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
