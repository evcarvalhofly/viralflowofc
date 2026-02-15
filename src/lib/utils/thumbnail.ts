/**
 * Extract thumbnail URL from a video/social media URL or markdown content.
 */
export function extractThumbnail(url: string, markdown?: string): string | null {
  try {
    const u = new URL(url);

    // YouTube
    if (u.hostname.includes("youtube.com") || u.hostname.includes("youtu.be")) {
      let videoId: string | null = null;
      if (u.hostname.includes("youtu.be")) {
        videoId = u.pathname.slice(1);
      } else {
        videoId = u.searchParams.get("v");
        if (!videoId) {
          const shorts = u.pathname.match(/\/shorts\/([^/?]+)/);
          if (shorts) videoId = shorts[1];
        }
      }
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    }

    // TikTok - no reliable thumbnail without API, try markdown
    // Instagram - no reliable thumbnail without API, try markdown

    // Try to extract image from markdown content
    if (markdown) {
      const imgMatch = markdown.match(/!\[.*?\]\((https?:\/\/[^\s)]+\.(jpg|jpeg|png|webp|gif)[^\s)]*)\)/i);
      if (imgMatch) return imgMatch[1];

      // Also try raw image URLs in markdown
      const rawImgMatch = markdown.match(/(https?:\/\/[^\s"'<>]+\.(jpg|jpeg|png|webp|gif)(\?[^\s"'<>]*)?)/i);
      if (rawImgMatch) return rawImgMatch[1];

      // Try og:image patterns sometimes present in markdown
      const ogMatch = markdown.match(/og:image[^"]*"(https?:\/\/[^"]+)"/i);
      if (ogMatch) return ogMatch[1];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Get the platform name from a URL.
 */
export function getPlatform(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    if (hostname.includes("youtube") || hostname.includes("youtu.be")) return "YouTube";
    if (hostname.includes("tiktok")) return "TikTok";
    if (hostname.includes("instagram")) return "Instagram";
    if (hostname.includes("twitter") || hostname.includes("x.com")) return "X/Twitter";
    if (hostname.includes("facebook") || hostname.includes("fb.")) return "Facebook";
    if (hostname.includes("kwai")) return "Kwai";
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "Web";
  }
}

/**
 * Generate simple content suggestions based on search results (no AI needed).
 */
export function generateContentSuggestions(
  niche: string,
  results: { title: string; description: string }[]
): string[] {
  const suggestions: string[] = [];
  const titles = results.map((r) => r.title).filter(Boolean);

  if (titles.length === 0) return [];

  suggestions.push(
    `📱 Reaja aos vídeos mais populares de "${niche}" e dê sua opinião — vídeos de reação têm alto engajamento.`
  );
  suggestions.push(
    `🎯 Faça um "Top 5" dos conteúdos mais virais de "${niche}" desta semana — listas sempre performam bem.`
  );
  suggestions.push(
    `🔥 Crie um vídeo "O que ninguém te conta sobre ${niche}" — ganchos de curiosidade retêm a audiência.`
  );
  suggestions.push(
    `💡 Transforme uma notícia trending em um Shorts/Reels de 30 segundos com legenda chamativa.`
  );
  suggestions.push(
    `🎬 Faça um "antes e depois" ou "expectativa vs realidade" sobre ${niche} — formato viral comprovado.`
  );

  return suggestions;
}
