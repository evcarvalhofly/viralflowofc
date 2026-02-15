import { supabase } from "@/integrations/supabase/client";

const FUNCTIONS_URL = `https://dzgotqyikomtapcgdgff.supabase.co/functions/v1`;

type SearchResult = {
  url: string;
  title: string;
  description: string;
  markdown?: string;
  metadata?: any;
};

export async function searchViralContent(niche: string): Promise<SearchResult[]> {
  const { data, error } = await supabase.functions.invoke("search-viral", {
    body: { niche },
  });

  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || "Erro na busca");
  return data.data || [];
}

export async function streamAnalyzeTrends({
  niche,
  searchResults,
  onDelta,
  onDone,
}: {
  niche: string;
  searchResults: SearchResult[];
  onDelta: (text: string) => void;
  onDone: () => void;
}) {
  const resp = await fetch(`${FUNCTIONS_URL}/analyze-trends`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6Z290cXlpa29tdGFwY2dkZ2ZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExNzUxNDMsImV4cCI6MjA4Njc1MTE0M30.cTBDE0bCC6j4j2Pw0QRac220oqgQkAcYbMaJ3zyrmbY`,
    },
    body: JSON.stringify({ niche, searchResults }),
  });

  if (!resp.ok || !resp.body) {
    const errorData = await resp.json().catch(() => ({}));
    throw new Error(errorData.error || `Erro ${resp.status}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let textBuffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    textBuffer += decoder.decode(value, { stream: true });

    let newlineIndex: number;
    while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
      let line = textBuffer.slice(0, newlineIndex);
      textBuffer = textBuffer.slice(newlineIndex + 1);

      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") {
        streamDone = true;
        break;
      }

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        textBuffer = line + "\n" + textBuffer;
        break;
      }
    }
  }

  // Final flush
  if (textBuffer.trim()) {
    for (let raw of textBuffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {}
    }
  }

  onDone();
}
