import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchYouTubeData(videoId: string, apiKey: string) {
  const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics,contentDetails&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
  const data = await res.json();
  if (!data.items || data.items.length === 0) throw new Error("Vídeo não encontrado ou privado.");
  return data.items[0];
}

async function fetchTranscript(videoId: string): Promise<string> {
  // Try Portuguese first, then English, then auto-generated
  const langs = ["pt", "pt-BR", "en", "en-US"];
  
  for (const lang of langs) {
    try {
      const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${lang}&fmt=json3`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; bot)" },
      });
      if (res.ok) {
        const text = await res.text();
        if (text && text.length > 50) {
          const data = JSON.parse(text);
          if (data.events && data.events.length > 0) {
            const transcript = data.events
              .filter((e: any) => e.segs)
              .map((e: any) => ({
                time: Math.floor((e.tStartMs || 0) / 1000),
                text: e.segs.map((s: any) => s.utf8).join("").trim(),
              }))
              .filter((e: any) => e.text)
              .map((e: any) => `[${e.time}s] ${e.text}`)
              .join("\n");
            if (transcript.length > 100) return transcript;
          }
        }
      }
    } catch (_) { /* continue */ }
  }

  // Fallback: try fetching list of available captions
  try {
    const listUrl = `https://www.youtube.com/api/timedtext?v=${videoId}&type=list`;
    const listRes = await fetch(listUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; bot)" },
    });
    if (listRes.ok) {
      const listText = await listRes.text();
      const langMatch = listText.match(/lang_code="([^"]+)"/);
      if (langMatch) {
        const url = `https://www.youtube.com/api/timedtext?v=${videoId}&lang=${langMatch[1]}&fmt=json3`;
        const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
        if (res.ok) {
          const text = await res.text();
          const data = JSON.parse(text);
          if (data.events) {
            return data.events
              .filter((e: any) => e.segs)
              .map((e: any) => `[${Math.floor((e.tStartMs || 0) / 1000)}s] ${e.segs.map((s: any) => s.utf8).join("")}`)
              .join("\n");
          }
        }
      }
    }
  } catch (_) { /* ignore */ }

  return "";
}

function parseDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "0:00";
  const h = parseInt(match[1] || "0");
  const m = parseInt(match[2] || "0");
  const s = parseInt(match[3] || "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatNumber(n: string): string {
  const num = parseInt(n || "0");
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString("pt-BR");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { videoUrl, generateVersion, versionType, videoTitle, resumo, gancho, porQueViralizou } = body;

    // ── Generate version mode ──────────────────────────────
    if (generateVersion) {
      const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
      if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada.");

      const prompt = `Você é expert em criação de conteúdo viral para redes sociais brasileiras.

Com base neste vídeo viral do YouTube:
- Título: ${videoTitle}
- Resumo: ${resumo}
- Gancho original: ${gancho}
- Por que viralizou: ${porQueViralizou}

Crie uma versão adaptada para: ${versionType}

Forneça:
1. GANCHO adaptado (primeiros 3 segundos)
2. ROTEIRO completo cena por cena
3. DICAS específicas para este formato

Seja criativo, prático e específico. Máximo 400 palavras. Responda em português do Brasil.`;

      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 800,
          temperature: 0.8,
        }),
      });

      if (!aiRes.ok) throw new Error(`OpenAI error: ${aiRes.status}`);
      const aiData = await aiRes.json();
      return new Response(
        JSON.stringify({ success: true, versionText: aiData.choices[0].message.content }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!videoUrl) throw new Error("URL do vídeo é obrigatória.");

    const YOUTUBE_API_KEY = Deno.env.get("YOUTUBE_API_KEY");
    if (!YOUTUBE_API_KEY) throw new Error("YOUTUBE_API_KEY não configurada.");

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada.");

    const videoId = extractYouTubeId(videoUrl);
    if (!videoId) throw new Error("Link do YouTube inválido. Use formatos: youtube.com/watch?v=..., youtu.be/..., youtube.com/shorts/...");

    // Fetch in parallel
    const [ytData, transcript] = await Promise.all([
      fetchYouTubeData(videoId, YOUTUBE_API_KEY),
      fetchTranscript(videoId),
    ]);

    const snippet = ytData.snippet;
    const stats = ytData.statistics;
    const details = ytData.contentDetails;

    const videoInfo = {
      id: videoId,
      title: snippet.title,
      channel: snippet.channelTitle,
      description: snippet.description?.slice(0, 500) || "",
      thumbnail:
        snippet.thumbnails?.maxres?.url ||
        snippet.thumbnails?.high?.url ||
        snippet.thumbnails?.medium?.url ||
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      views: formatNumber(stats.viewCount),
      likes: formatNumber(stats.likeCount || "0"),
      comments: formatNumber(stats.commentCount || "0"),
      publishedAt: new Date(snippet.publishedAt).toLocaleDateString("pt-BR"),
      duration: parseDuration(details.duration),
      url: videoUrl,
    };

    const hasTranscript = transcript.length > 100;
    const analysisContext = hasTranscript
      ? `TRANSCRIÇÃO COM TIMESTAMPS:\n${transcript}`
      : `SEM TRANSCRIÇÃO DISPONÍVEL. Use o título, descrição e contexto para análise.\nTítulo: ${snippet.title}\nDescrição: ${snippet.description?.slice(0, 800) || ""}`;

    const prompt = `Você é um especialista em viralização de vídeos no YouTube Shorts e redes sociais.

DADOS DO VÍDEO:
- Título: ${snippet.title}
- Canal: ${snippet.channelTitle}
- Visualizações: ${videoInfo.views}
- Likes: ${videoInfo.likes}
- Comentários: ${videoInfo.comments}
- Duração: ${videoInfo.duration}
- Publicado em: ${videoInfo.publishedAt}

${analysisContext}

Faça uma análise COMPLETA de engenharia reversa da viralização. Responda em JSON com EXATAMENTE esta estrutura:

{
  "resumo": "string — resumo claro de 2-3 frases do conteúdo do vídeo",
  
  "mapa_viralizacao": [
    {
      "inicio": "0s",
      "fim": "3s",
      "nome": "GANCHO",
      "descricao": "string — o que acontece nesta parte e por que funciona"
    }
  ],
  
  "gancho": {
    "tipo": "string — tipo de gancho (ex: Curiosidade, Promessa, Choque, Pergunta, etc.)",
    "descricao": "string — explicação de como o gancho funciona neste vídeo e por que prende atenção"
  },
  
  "psicologia": [
    {
      "gatilho": "string — nome do gatilho (ex: Curiosidade, Surpresa, Prova visual, etc.)",
      "explicacao": "string — como este gatilho aparece no vídeo e contribui para retenção"
    }
  ],
  
  "estrutura": [
    {
      "numero": 1,
      "nome": "string — nome da parte (ex: Gancho)",
      "explicacao": "string — o que acontece nesta parte estrutural"
    }
  ],
  
  "por_que_viralizou": "string — análise completa em 3-5 frases dos fatores que contribuíram para a viralização",
  
  "como_copiar": {
    "recriar_formato": "string — como recriar este formato exato",
    "adaptar_nicho": "string — como adaptar para outro nicho diferente",
    "conteudo_venda": "string — como transformar em conteúdo de venda",
    "conteudo_educacional": "string — como transformar em conteúdo educacional"
  },
  
  "roteiro": [
    {
      "cena": 1,
      "nome": "string — nome da cena (ex: Gancho)",
      "texto": "string — texto/roteiro sugerido para esta cena"
    }
  ]
}

Seja específico e prático. Analise com base nos dados reais do vídeo.`;

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
        max_tokens: 3000,
        temperature: 0.7,
      }),
    });

    if (!aiRes.ok) {
      const err = await aiRes.text();
      throw new Error(`OpenAI error: ${aiRes.status} — ${err}`);
    }

    const aiData = await aiRes.json();
    const analysis = JSON.parse(aiData.choices[0].message.content);

    return new Response(
      JSON.stringify({
        success: true,
        video: videoInfo,
        analysis,
        hasTranscript,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("analyze-viral-video error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
