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
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY não configurada nos secrets da Edge Function.' }),
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

    // Repassa o arquivo para o OpenAI Whisper
    const openaiForm = new FormData();
    openaiForm.append('file', audioFile, audioFile.name || 'audio.wav');
    openaiForm.append('model', 'whisper-1');
    openaiForm.append('language', language);
    openaiForm.append('response_format', 'verbose_json');
    openaiForm.append('timestamp_granularities[]', 'word');
    openaiForm.append('timestamp_granularities[]', 'segment');

    const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: openaiForm,
    });

    const data = await whisperRes.json();

    if (!whisperRes.ok) {
      const errMsg = data?.error?.message ?? `Erro OpenAI HTTP ${whisperRes.status}`;
      console.error('[transcribe-audio] Whisper error:', whisperRes.status, errMsg);
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: whisperRes.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[transcribe-audio] done. segments:', data.segments?.length ?? 0);

    return new Response(JSON.stringify(data), {
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
