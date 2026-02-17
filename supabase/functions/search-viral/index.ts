const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function searchFirecrawl(apiKey: string, query: string, limit: number) {
  const response = await fetch('https://api.firecrawl.dev/v1/search', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      limit,
      lang: 'pt-br',
      country: 'BR',
      tbs: 'qdr:m',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('Firecrawl error for query:', query, data);
    return [];
  }
  return data.data || [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { niche, query } = await req.json();

    if (!niche) {
      return new Response(
        JSON.stringify({ success: false, error: 'Niche is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (query) {
      console.log('Custom query search:', query);
      const results = await searchFirecrawl(apiKey, query, 10);
      console.log('Search successful, results:', results.length);
      return new Response(
        JSON.stringify({ success: true, data: results }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Search each platform in parallel for viral content in this niche
    const searches = [
      searchFirecrawl(apiKey, `site:youtube.com ${niche} viral mais vistos Brasil 2025`, 5),
      searchFirecrawl(apiKey, `site:tiktok.com ${niche} viral tendência Brasil 2025`, 5),
      searchFirecrawl(apiKey, `site:instagram.com ${niche} reels viral Brasil 2025`, 5),
    ];

    console.log('Searching viral content for niche:', niche);
    const [ytResults, ttResults, igResults] = await Promise.all(searches);

    const allResults = [...ytResults, ...ttResults, ...igResults];
    console.log('Search successful, results:', allResults.length, `(YT:${ytResults.length} TT:${ttResults.length} IG:${igResults.length})`);

    return new Response(
      JSON.stringify({ success: true, data: allResults }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error searching:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
