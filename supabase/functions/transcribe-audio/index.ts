const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    const language = (formData.get('language') as string | null) ?? 'pt';

    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: 'Campo "audio" ausente no form-data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[transcribe-audio] file:', audioFile.name, audioFile.size, 'bytes | lang:', language);

    // Convert audio file to base64 (chunk-based to avoid call stack overflow on large files)
    const audioBytes = await audioFile.arrayBuffer();
    const uint8 = new Uint8Array(audioBytes);
    let binary = '';
    const CHUNK = 8192;
    for (let i = 0; i < uint8.length; i += CHUNK) {
      binary += String.fromCharCode(...uint8.subarray(i, i + CHUNK));
    }
    const base64Audio = btoa(binary);

    const mimeType = audioFile.type || 'audio/wav';

    const langLabel = language === 'pt' ? 'português brasileiro' : language === 'en' ? 'English' : language;

    const prompt = `Transcreva este áudio em ${langLabel}.

Retorne SOMENTE um JSON válido no seguinte formato, sem markdown, sem blocos de código, sem texto adicional:
{
  "text": "transcrição completa aqui",
  "segments": [
    {"start": 0.0, "end": 2.5, "text": "trecho do texto"},
    {"start": 2.5, "end": 5.0, "text": "próximo trecho"}
  ],
  "duration": 30.0
}

Regras importantes:
- Divida o áudio em segmentos de 2-5 segundos cada
- Os timestamps devem ser precisos em segundos com decimais
- O campo "text" deve conter a transcrição completa
- O campo "duration" deve ser a duração total do áudio em segundos
- Não inclua nenhum texto fora do JSON`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Audio,
                  },
                },
                { text: prompt },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[transcribe-audio] Gemini error:', geminiRes.status, errText);

      if (geminiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições Gemini. Tente novamente em instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: `Erro Gemini: ${geminiRes.status} - ${errText.slice(0, 200)}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiRes.json();
    console.log('[transcribe-audio] Gemini raw response received');

    // Extract the text content from Gemini response
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    console.log('[transcribe-audio] Raw text (first 300):', rawText.slice(0, 300));

    if (!rawText) {
      return new Response(
        JSON.stringify({ error: 'Gemini não retornou conteúdo de transcrição.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the JSON returned by Gemini
    let transcription: { text: string; segments: Array<{ start: number; end: number; text: string }>; duration?: number };
    try {
      // Clean up potential markdown code blocks just in case
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      transcription = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error('[transcribe-audio] Failed to parse Gemini JSON:', parseErr, 'raw:', rawText.slice(0, 500));
      // Fallback: return as plain text with estimated timing
      transcription = {
        text: rawText,
        segments: [{ start: 0, end: 60, text: rawText }],
        duration: 60,
      };
    }

    console.log('[transcribe-audio] done. segments:', transcription.segments?.length ?? 0);
    console.log('[transcribe-audio] text (first 200):', String(transcription.text ?? '').slice(0, 200));

    // Return in the same format the client expects (Whisper-compatible)
    return new Response(JSON.stringify(transcription), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[transcribe-audio] unexpected error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
