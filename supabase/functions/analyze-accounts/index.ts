const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { accounts } = await req.json();
    // accounts: Array<{ platform: 'YouTube' | 'TikTok' | 'Instagram', handle: string }>

    const YOUTUBE_API_KEY = Deno.env.get('YOUTUBE_API_KEY');
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountSummaries: any[] = [];

    for (const account of accounts) {
      if (account.platform === 'YouTube' && YOUTUBE_API_KEY && account.handle) {
        try {
          // Search for channel by handle/name
          const searchResp = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(account.handle)}&maxResults=1&key=${YOUTUBE_API_KEY}`
          );
          const searchData = await searchResp.json();
          const channelId = searchData.items?.[0]?.id?.channelId;

          if (channelId) {
            const statsResp = await fetch(
              `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${YOUTUBE_API_KEY}`
            );
            const statsData = await statsResp.json();
            const ch = statsData.items?.[0];

            if (ch) {
              // Get recent videos
              const videosResp = await fetch(
                `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&type=video&order=viewCount&maxResults=5&key=${YOUTUBE_API_KEY}`
              );
              const videosData = await videosResp.json();
              const topVideoIds = videosData.items?.map((v: any) => v.id.videoId).join(',');

              let topVideos: any[] = [];
              if (topVideoIds) {
                const videoStatsResp = await fetch(
                  `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${topVideoIds}&key=${YOUTUBE_API_KEY}`
                );
                const videoStatsData = await videoStatsResp.json();
                topVideos = (videoStatsData.items || []).map((v: any) => ({
                  title: v.snippet.title,
                  views: parseInt(v.statistics.viewCount || '0'),
                  likes: parseInt(v.statistics.likeCount || '0'),
                  comments: parseInt(v.statistics.commentCount || '0'),
                }));
              }

              accountSummaries.push({
                platform: 'YouTube',
                handle: account.handle,
                channelName: ch.snippet.title,
                subscribers: parseInt(ch.statistics.subscriberCount || '0'),
                totalViews: parseInt(ch.statistics.viewCount || '0'),
                videoCount: parseInt(ch.statistics.videoCount || '0'),
                description: ch.snippet.description?.slice(0, 200),
                topVideos,
              });
            }
          } else {
            accountSummaries.push({
              platform: 'YouTube',
              handle: account.handle,
              error: 'Canal não encontrado',
            });
          }
        } catch (e) {
          console.error('YouTube fetch error:', e);
          accountSummaries.push({ platform: 'YouTube', handle: account.handle, error: 'Erro ao buscar dados' });
        }
      } else {
        // For TikTok and Instagram, we don't have API access
        // Store the handle for AI context
        accountSummaries.push({
          platform: account.platform,
          handle: account.handle,
          note: 'Dados de métricas não disponíveis via API, mas handle registrado para contexto.',
        });
      }
    }

    // Use OpenAI to create a summary of the accounts
    const prompt = `Você recebeu dados das contas de redes sociais de um criador de conteúdo. Faça um resumo CURTO (3-4 frases) sobre o perfil do criador com base nesses dados:

${JSON.stringify(accountSummaries, null, 2)}

Mencione: plataformas conectadas, tamanho do canal (se disponível), nicho aparente, e o que parece estar funcionando melhor. Seja direto e motivador. Responda em português do Brasil.`;

    const aiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
      }),
    });

    const aiData = await aiResp.json();
    const summary = aiData.choices?.[0]?.message?.content || 'Contas conectadas com sucesso!';

    return new Response(
      JSON.stringify({ success: true, accounts: accountSummaries, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Analyze accounts error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
