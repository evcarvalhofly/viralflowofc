import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const driveId = url.searchParams.get("id");

    if (!driveId) {
      return new Response(JSON.stringify({ error: "Missing 'id' param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Google Drive direct download URL (new usercontent endpoint, no redirect needed)
    const driveUrl = `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`;

    const response = await fetch(driveUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; AudioProxy/1.0)",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch from Drive", status: response.status }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const contentType = response.headers.get("content-type") || "audio/wav";
    const contentLength = response.headers.get("content-length");

    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
      "Accept-Ranges": "bytes",
    };

    if (contentLength) {
      responseHeaders["Content-Length"] = contentLength;
    }

    return new Response(response.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
