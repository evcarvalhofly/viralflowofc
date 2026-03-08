import { useState, useEffect, useRef, useCallback } from "react";
import {
  Film, Music, Sparkles, Layers, Download,
  ExternalLink, Play, Heart, Square, TrendingUp
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ── useFavorites: persists per user in Supabase ── */
function useFavorites() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  // counts[assetId] = total users who favorited it
  const [favCounts, setFavCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // Load user's favorites + global counts
  useEffect(() => {
    if (!user) { setFavorites(new Set()); setLoading(false); return; }

    const load = async () => {
      setLoading(true);
      const [{ data: userFavs }, { data: allFavs }] = await Promise.all([
        supabase.from("favorites").select("asset_id").eq("user_id", user.id),
        supabase.from("favorites").select("asset_id"),
      ]);

      if (userFavs) setFavorites(new Set(userFavs.map((r) => r.asset_id)));

      // Count per asset across all users
      if (allFavs) {
        const counts: Record<string, number> = {};
        allFavs.forEach(({ asset_id }) => {
          counts[asset_id] = (counts[asset_id] || 0) + 1;
        });
        setFavCounts(counts);
      }
      setLoading(false);
    };

    load();
  }, [user]);

  const toggle = useCallback(async (id: string) => {
    if (!user) return;
    const isFav = favorites.has(id);

    // Optimistic update
    setFavorites((prev) => {
      const next = new Set(prev);
      isFav ? next.delete(id) : next.add(id);
      return next;
    });
    setFavCounts((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + (isFav ? -1 : 1)),
    }));

    if (isFav) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("asset_id", id);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, asset_id: id });
    }
  }, [user, favorites]);

  return { favorites, favCounts, toggle, loading };
}

/* ── Types ── */
type Asset = {
  id: string;
  label: string;
  emoji: string;
  category: string;
  driveId: string;
  tags?: string[];
  /** true = vídeo landscape (bg-016+): usa zoom 320% no mobile para preencher o card 9:16 */
  landscape?: boolean;
};

/* ── Tabs ── */
type Tab = {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  comingSoon?: boolean;
};

const tabs: Tab[] = [
  {
    id: "backgrounds",
    label: "Fundos de Vídeo",
    icon: <Film className="h-4 w-4" />,
    description: "Backgrounds prontos para usar em Shorts e Reels",
  },
  {
    id: "overlays-effects",
    label: "Overlays + Efeitos",
    icon: <Sparkles className="h-4 w-4" />,
    description: "Overlays e efeitos visuais para turbinar seus vídeos",
  },
  {
    id: "emojis-animados",
    label: "Emojis Animados",
    icon: <span className="text-sm leading-none">😜</span>,
    description: "Emojis animados para turbinar seus vídeos",
  },
  {
    id: "favorites",
    label: "Favoritos",
    icon: <Heart className="h-4 w-4" />,
    description: "Seus assets favoritos salvos",
  },
  {
    id: "sfx",
    label: "Efeitos Sonoros",
    icon: <Music className="h-4 w-4" />,
    description: "Sons e efeitos para turbinar seus vídeos",
  },
];

/* ── Background assets (reais) ── */
const backgrounds: Asset[] = [
  { id: "bg-001", label: "Background 1",  emoji: "🎬", category: "Background", driveId: "1QUKJ-FwnIqEkcrtYn70KSyavUkk9vj0S", tags: ["background", "fundo"] },
  { id: "bg-002", label: "Background 2",  emoji: "🎬", category: "Background", driveId: "1sBGpx3u1qDOiC793poIG2pQFoPSQmLCO", tags: ["background", "fundo"] },
  { id: "bg-003", label: "Background 3",  emoji: "🎬", category: "Background", driveId: "1RSCLCT_A-EGePaXiR6RQgQk3pXcJQsZ_", tags: ["background", "fundo"] },
  { id: "bg-004", label: "Background 4",  emoji: "🎬", category: "Background", driveId: "1XC2yy1M5ub6QD-Re8woAWD5N-QXw0aVb", tags: ["background", "fundo"] },
  { id: "bg-005", label: "Background 5",  emoji: "🎬", category: "Background", driveId: "1p8_RDu7qVJYjohbHrqIgcBj8GQg-etNc",  tags: ["background", "fundo"] },
  { id: "bg-006", label: "Background 6",  emoji: "🎬", category: "Background", driveId: "1xADo9zzPwyJRvU-Ri_V-rQ2B5CSWa8w6", tags: ["background", "fundo"] },
  { id: "bg-007", label: "Background 7",  emoji: "🎬", category: "Background", driveId: "1mlllHQihDgNVY6b6EC5QNr5zKkZk4hvy", tags: ["background", "fundo"] },
  { id: "bg-008", label: "Background 8",  emoji: "🎬", category: "Background", driveId: "10WsU_N9QX7IEcuNui9qQDQ2vpKyJVJGf", tags: ["background", "fundo"] },
  { id: "bg-009", label: "Background 9",  emoji: "🎬", category: "Background", driveId: "1xSohJo2XXD5OE5VoKZjVy5cL5iFNH8Wq", tags: ["background", "fundo"] },
  { id: "bg-010", label: "Background 10", emoji: "🎬", category: "Background", driveId: "1B9Xxr5yRKYLd6RYHYporMA79M5U6zYEn", tags: ["background", "fundo"] },
  { id: "bg-011", label: "Background 11", emoji: "🎬", category: "Background", driveId: "1gKShVlY-m_MwTnhRB-cVoYZKKqQ_S810", tags: ["background", "fundo"] },
  { id: "bg-012", label: "Background 12", emoji: "🎬", category: "Background", driveId: "1t_hNBTj31lSUe34ZKq90ohtZVkAULer3", tags: ["background", "fundo"] },
  { id: "bg-013", label: "Background 13", emoji: "🎬", category: "Background", driveId: "1aQmZyPUQiu3WYPWXT6JNx43dUtnqLWH4", tags: ["background", "fundo"] },
  { id: "bg-014", label: "Background 14", emoji: "🎬", category: "Background", driveId: "1ITAIddqSHLN7AFNXJxB-FQm5xKw2cYqo", tags: ["background", "fundo"] },
  { id: "bg-015", label: "Background 15", emoji: "🎬", category: "Background", driveId: "1-mJmmNBXYrgzXr57CQb-eBfcrqKggkh9", tags: ["background", "fundo"] },
  { id: "bg-016", label: "Background 16", emoji: "🎬", category: "Background", driveId: "1r49TnyhLhhrowbNL_tvB5NQnLaRn9nQz", tags: ["background", "fundo"], landscape: true },
  { id: "bg-017", label: "Background 17", emoji: "🎬", category: "Background", driveId: "1f7G_cLq665dVfqk-Jph09Ns1Y9Khq3lk", tags: ["background", "fundo"], landscape: true },
  { id: "bg-018", label: "Background 18", emoji: "🎬", category: "Background", driveId: "1k9wDv7gXwqCsWgMsP6PVzFnTa_J8sGl3", tags: ["background", "fundo"], landscape: true },
  { id: "bg-019", label: "Background 19", emoji: "🎬", category: "Background", driveId: "1zvF7oO9XMOnT7-UrrDaQkulCilVGqc4f", tags: ["background", "fundo"], landscape: true },
  { id: "bg-020", label: "Background 20", emoji: "🎬", category: "Background", driveId: "1azhrf044iB9edEC7_YPY8mPN9OJFfV8S", tags: ["background", "fundo"], landscape: true },
  { id: "bg-021", label: "Background 21", emoji: "🎬", category: "Background", driveId: "1wunwtXmAEIvU5tlCtTN8NYN1m1DeDKS8", tags: ["background", "fundo"], landscape: true },
  { id: "bg-022", label: "Background 22", emoji: "🎬", category: "Background", driveId: "1S6j5tJYSSfhw0apwivt85jvx2OLQ1Gsj", tags: ["background", "fundo"], landscape: true },
  { id: "bg-023", label: "Background 23", emoji: "🎬", category: "Background", driveId: "1NfPAZSEfEMxlUZp5QUNUb9z0E-phl4iw", tags: ["background", "fundo"], landscape: true },
  { id: "bg-024", label: "Background 24", emoji: "🎬", category: "Background", driveId: "1Wgf0Tu8sIs6ZyGNYMOB4aSADhLb0Xp0S", tags: ["background", "fundo"], landscape: true },
  { id: "bg-025", label: "Background 25", emoji: "🎬", category: "Background", driveId: "1o0q9f1GhSTYck4yHuJ9ws3Ydy1CixylR", tags: ["background", "fundo"], landscape: true },
  { id: "bg-026", label: "Background 26", emoji: "🎬", category: "Background", driveId: "1SssN19SMnIsLEGQL4XKYhn0Tw0bHX93Y", tags: ["background", "fundo"], landscape: true },
  { id: "bg-027", label: "Background 27", emoji: "🎬", category: "Background", driveId: "1nmlm7GBwgkxa4XdgSZ9AV5GAmgNKREBM", tags: ["background", "fundo"], landscape: true },
  { id: "bg-028", label: "Background 28", emoji: "🎬", category: "Background", driveId: "1V5Ym38Mvt1HhjBP-oL6Z4hTkNMsu7ZEC", tags: ["background", "fundo"], landscape: true },
  { id: "bg-029", label: "Background 29", emoji: "🎬", category: "Background", driveId: "1fnJLxanj6Yvh8XuKBEzbtMLXDScdAK2G", tags: ["background", "fundo"], landscape: true },
  { id: "bg-030", label: "Background 30", emoji: "🎬", category: "Background", driveId: "1RYUblp0sQseEhez9hQpuUgl4fhoSOpFW", tags: ["background", "fundo"], landscape: true },
  { id: "bg-031", label: "Background 31", emoji: "🎬", category: "Background", driveId: "1ZVtSgKnXy14UNqYftxIp8oAoKSquA_eL", tags: ["background", "fundo"], landscape: true },
  { id: "bg-032", label: "Background 32", emoji: "🎬", category: "Background", driveId: "1995scWOtpDIQt2QBQbQM6sb3buIqsL1L", tags: ["background", "fundo"], landscape: true },
  { id: "bg-033", label: "Background 33", emoji: "🎬", category: "Background", driveId: "1guKnLLn0m-mIWs5hzLqbwcsLPZIoDJM3", tags: ["background", "fundo"], landscape: true },
  { id: "bg-034", label: "Background 34", emoji: "🎬", category: "Background", driveId: "1dqQRJo2KibK4lauukala-YL6yzR9TJ6x", tags: ["background", "fundo"], landscape: true },
  { id: "bg-035", label: "Background 35", emoji: "🎬", category: "Background", driveId: "1WyrOA7jeL6TZVbCqGJbYytkg6SK15C3p", tags: ["background", "fundo"], landscape: true },
  { id: "bg-036", label: "Background 36", emoji: "🎬", category: "Background", driveId: "1jH3Iq4r-UcixLlsJie4jxSn0zXrLY1QB", tags: ["background", "fundo"], landscape: true },
  { id: "bg-037", label: "Background 37", emoji: "🎬", category: "Background", driveId: "1Uf1r1sRQMctYH7NcVzJWP7b0Mx0NET5B", tags: ["background", "fundo"], landscape: true },
  // #1MOBILE
  { id: "bg-038", label: "Background 38", emoji: "🎬", category: "Background", driveId: "1SK42ZU7Wl5jMyZYYucO3ZMIOpOolNrid", tags: ["background", "fundo"], landscape: true },
  { id: "bg-039", label: "Background 39", emoji: "🎬", category: "Background", driveId: "1yziN2EprdIGhjh_wO4BgnU5nMGytrAY0", tags: ["background", "fundo"], landscape: true },
  { id: "bg-040", label: "Background 40", emoji: "🎬", category: "Background", driveId: "1NfztKi_OYmlY03ccyQVUQBhnEL4eSKxk", tags: ["background", "fundo"], landscape: true },
  { id: "bg-041", label: "Background 41", emoji: "🎬", category: "Background", driveId: "1lOQfCDBQkTFG5oINUN6Z90hDgtN_ulZL", tags: ["background", "fundo"], landscape: true },
  { id: "bg-042", label: "Background 42", emoji: "🎬", category: "Background", driveId: "1MPXpE0To41UTEU9bCAZ3VLpYmGBWykgS", tags: ["background", "fundo"], landscape: true },
  { id: "bg-043", label: "Background 43", emoji: "🎬", category: "Background", driveId: "1knEqZB1TXPVjewT3LGTVnp1sBfC4MuVF", tags: ["background", "fundo"], landscape: true },
  { id: "bg-044", label: "Background 44", emoji: "🎬", category: "Background", driveId: "1t2nbq7b-Wzwdh0Hn3RzslTrkwcLQQzAq", tags: ["background", "fundo"], landscape: true },
  { id: "bg-045", label: "Background 45", emoji: "🎬", category: "Background", driveId: "1CaVLhKZObublLfaBK6Ia218mCtXa5ZHm", tags: ["background", "fundo"], landscape: true },
  { id: "bg-046", label: "Background 46", emoji: "🎬", category: "Background", driveId: "1RfGYOEktoj6lZnVgzdFMmFHPsGHZ-r8y", tags: ["background", "fundo"], landscape: true },
  { id: "bg-047", label: "Background 47", emoji: "🎬", category: "Background", driveId: "1wu4QtaDY7LP8OGiF3YK3Kr_WQnpMk4LR", tags: ["background", "fundo"], landscape: true },
  { id: "bg-048", label: "Background 48", emoji: "🎬", category: "Background", driveId: "11osau3YYLMubt188yPUKSeghdDdseYS9", tags: ["background", "fundo"], landscape: true },
  { id: "bg-049", label: "Background 49", emoji: "🎬", category: "Background", driveId: "1Y6cv-hnsMnfCYckT0kaYeONYnvmtvCve", tags: ["background", "fundo"], landscape: true },
  { id: "bg-050", label: "Background 50", emoji: "🎬", category: "Background", driveId: "1KZjKYL8qjALN__3OSnKsceuIc2RubUHR", tags: ["background", "fundo"], landscape: true },
  { id: "bg-051", label: "Background 51", emoji: "🎬", category: "Background", driveId: "10NBbm-OHvJgDgIpjpXlBCCNIsd86JaTU", tags: ["background", "fundo"], landscape: true },
  { id: "bg-052", label: "Background 52", emoji: "🎬", category: "Background", driveId: "1P9HKUwtWlsd2jnHNab6NjDfUvLV1R7I3", tags: ["background", "fundo"], landscape: true },
  { id: "bg-053", label: "Background 53", emoji: "🎬", category: "Background", driveId: "1_t3gM1nFVqoKfk9fo0Ea77ALCstU9uYa", tags: ["background", "fundo"], landscape: true },
  { id: "bg-054", label: "Background 54", emoji: "🎬", category: "Background", driveId: "1eAasLEfgkkG15ydTLoXwqg_RU37ydw_F", tags: ["background", "fundo"], landscape: true },
  { id: "bg-055", label: "Background 55", emoji: "🎬", category: "Background", driveId: "1-FQWrqW8gO4yiKbqPqs3Hd6oAP8_rrsl", tags: ["background", "fundo"], landscape: true },
  { id: "bg-056", label: "Background 56", emoji: "🎬", category: "Background", driveId: "1AaV99CmhxiqJo1weUcyLj2PHoFH1DD9g", tags: ["background", "fundo"], landscape: true },
  { id: "bg-057", label: "Background 57", emoji: "🎬", category: "Background", driveId: "1XdZ_KICG6SW3CWjUe1XW2h165U4QfbyH", tags: ["background", "fundo"], landscape: true },
  { id: "bg-058", label: "Background 58", emoji: "🎬", category: "Background", driveId: "1PbHosW3zljZafHjPB0yaqaROskbOXWjK", tags: ["background", "fundo"], landscape: true },
  { id: "bg-059", label: "Background 59", emoji: "🎬", category: "Background", driveId: "1p4910jiX9EcN-pa4mMnAFWHyRG4fUfbG", tags: ["background", "fundo"], landscape: true },
  { id: "bg-060", label: "Background 60", emoji: "🎬", category: "Background", driveId: "17PNEZmccg_Hfp66lrTBWRPBw10vWiukz", tags: ["background", "fundo"], landscape: true },
  { id: "bg-061", label: "Background 61", emoji: "🎬", category: "Background", driveId: "13zyIP9-xPurQDujlJdNqHKqZ7Es4__Gv", tags: ["background", "fundo"], landscape: true },
  { id: "bg-062", label: "Background 62", emoji: "🎬", category: "Background", driveId: "1ikoEwqp2A3k_R49YJWPE5rQBj3D11uw7", tags: ["background", "fundo"], landscape: true },
  { id: "bg-063", label: "Background 63", emoji: "🎬", category: "Background", driveId: "1y9uRboSxEwZ6RScl2eu_sUAqSrQ24Wmf", tags: ["background", "fundo"], landscape: true },
  { id: "bg-064", label: "Background 64", emoji: "🎬", category: "Background", driveId: "1Nys7IBGokrHsuPwhfuZ55Hf3AWpHtFH1", tags: ["background", "fundo"], landscape: true },
  // BACKGROUND HOUSTON
  { id: "bg-065", label: "Background 65", emoji: "🎬", category: "Background", driveId: "1YmdGI84Tqt-FDbPf6hBDPaya6863Om3r", tags: ["background", "fundo"], landscape: true },
  { id: "bg-066", label: "Background 66", emoji: "🎬", category: "Background", driveId: "1Fl2WW1tsFQlGMYHzWXIlLyoDrXc1bj5K", tags: ["background", "fundo"], landscape: true },
  { id: "bg-067", label: "Background 67", emoji: "🎬", category: "Background", driveId: "1mNycOl3lYIVXFrzhb33sYmtD1F3lmz94", tags: ["background", "fundo"], landscape: true },
  { id: "bg-068", label: "Background 68", emoji: "🎬", category: "Background", driveId: "1xZVLgB9s2C_coZfSC5kcrIi8FoXjXTj1", tags: ["background", "fundo"], landscape: true },
  { id: "bg-069", label: "Background 69", emoji: "🎬", category: "Background", driveId: "1zsdFIYa9VzblAb4nygjJCzmf2m8-P1id", tags: ["background", "fundo"], landscape: true },
  { id: "bg-070", label: "Background 70", emoji: "🎬", category: "Background", driveId: "1VDJTA3je0-WO_5Mq7xDaw2y1brpv3XGb", tags: ["background", "fundo"], landscape: true },
  { id: "bg-071", label: "Background 71", emoji: "🎬", category: "Background", driveId: "1uez6OzDQrGLhNE7XmoI3Lhx9mElY-aCm", tags: ["background", "fundo"], landscape: true },
  // BACKGROUND MOV 1
  { id: "bg-072", label: "Background 72", emoji: "🎬", category: "Background", driveId: "1JcDSWwZjUwiOhvDthjJeDlkDBOodHNnP", tags: ["background", "fundo"], landscape: true },
  { id: "bg-073", label: "Background 73", emoji: "🎬", category: "Background", driveId: "1ej1qXsuSinjgUvcK_V2zd4TFGimwCEEv", tags: ["background", "fundo"], landscape: true },
  { id: "bg-074", label: "Background 74", emoji: "🎬", category: "Background", driveId: "14_Vo5bs261ThVadD8GEJTErpMT1dFiPb", tags: ["background", "fundo"], landscape: true },
  { id: "bg-075", label: "Background 75", emoji: "🎬", category: "Background", driveId: "1VQ-pbnP5Tkfl4ThdditVXuKbAlWKYPeU", tags: ["background", "fundo"], landscape: true },
  { id: "bg-076", label: "Background 76", emoji: "🎬", category: "Background", driveId: "1tVqmN16UEMBkqDQSG2GMdS2KEfIs219o", tags: ["background", "fundo"], landscape: true },
  // Grid 01
  { id: "bg-077", label: "Background 77", emoji: "🎬", category: "Background", driveId: "1pykDm0TV-Q8q_6BosI5sMwUcIqipXv1v", tags: ["background", "fundo"], landscape: true },
  { id: "bg-078", label: "Background 78", emoji: "🎬", category: "Background", driveId: "1YXmDlbrgif3YVVYfzCUGEz4UIino666m", tags: ["background", "fundo"], landscape: true },
  { id: "bg-079", label: "Background 79", emoji: "🎬", category: "Background", driveId: "1h9k-DYcoimDZaOIsycdk-VoQ_Z7wHIV7", tags: ["background", "fundo"], landscape: true },
  { id: "bg-080", label: "Background 80", emoji: "🎬", category: "Background", driveId: "19qa_Q6fvhtlDC-bhessOTHAUZrIlhQrv", tags: ["background", "fundo"], landscape: true },
  { id: "bg-081", label: "Background 81", emoji: "🎬", category: "Background", driveId: "1N_Z8zYEclc5jRosnQ2-x6_fgvc9OVJeF", tags: ["background", "fundo"], landscape: true },
  { id: "bg-082", label: "Background 82", emoji: "🎬", category: "Background", driveId: "1lU-frFmRao1V0LD2AeDQYKV6-rpbwsYA", tags: ["background", "fundo"], landscape: true },
  { id: "bg-083", label: "Background 83", emoji: "🎬", category: "Background", driveId: "1Ztc5GkPcMcAOiMVN0_SOmF6EZnrekzNI", tags: ["background", "fundo"], landscape: true },
  // Grid 02
  { id: "bg-084", label: "Background 84", emoji: "🎬", category: "Background", driveId: "1OoCPqXl-F72bwULOauQWy-Hi8x1jWmjc", tags: ["background", "fundo"], landscape: true },
  { id: "bg-085", label: "Background 85", emoji: "🎬", category: "Background", driveId: "19c6lEwFKYjj5e0hE14ZaUOyYAv4Ssis1", tags: ["background", "fundo"], landscape: true },
  { id: "bg-086", label: "Background 86", emoji: "🎬", category: "Background", driveId: "1TyOSJ2hW1lkE6-2ggjTBEOYu7HSEGFIl", tags: ["background", "fundo"], landscape: true },
  { id: "bg-087", label: "Background 87", emoji: "🎬", category: "Background", driveId: "1u79AtkDVrLrarMbIQ4AN84RwH0-l_wW8", tags: ["background", "fundo"], landscape: true },
  { id: "bg-088", label: "Background 88", emoji: "🎬", category: "Background", driveId: "1XT71ogriL6i5BsUaRO3r90A1vHF9OOYO", tags: ["background", "fundo"], landscape: true },
  // Mobile Grid
  { id: "bg-089", label: "Background 89", emoji: "🎬", category: "Background", driveId: "1zcLW4M9zOXDEipslRUJQ7L245_Ds8fYy", tags: ["background", "fundo"], landscape: true },
  { id: "bg-090", label: "Background 90", emoji: "🎬", category: "Background", driveId: "1-Fed4RJZ_svoHvt1_Gp7IdkFeJpl1Fvx", tags: ["background", "fundo"], landscape: true },
  { id: "bg-091", label: "Background 91", emoji: "🎬", category: "Background", driveId: "1zax3jyVxwuhFbEv34cddXusksH7XV8_L", tags: ["background", "fundo"], landscape: true },
  { id: "bg-092", label: "Background 92", emoji: "🎬", category: "Background", driveId: "14G5CN-IKUaB5VXTvTFR7JS3eIcZ1sdxm", tags: ["background", "fundo"], landscape: true },
  { id: "bg-093", label: "Background 93", emoji: "🎬", category: "Background", driveId: "1MOX09iklxRM5apx-a7XzBAL7FgQ8vJY1", tags: ["background", "fundo"], landscape: true },
  { id: "bg-094", label: "Background 94", emoji: "🎬", category: "Background", driveId: "1nWOrMRrEwDJSJuPhYAlk08D6b80t_5s3", tags: ["background", "fundo"], landscape: true },
  { id: "bg-095", label: "Background 95", emoji: "🎬", category: "Background", driveId: "1KzrOez-dtF9LKgiM0irpeCPgcagFeJNq", tags: ["background", "fundo"], landscape: true },
  { id: "bg-096", label: "Background 96", emoji: "🎬", category: "Background", driveId: "1hYjqUPLOgtaEGrCLWYQ1XYer9MeMyGB9", tags: ["background", "fundo"], landscape: true },
  // Mobile Motion
  { id: "bg-097", label: "Background 97", emoji: "🎬", category: "Background", driveId: "1Go67F_tMBUcTeEw3TMlJr5Jhfz5ebIRR", tags: ["background", "fundo"], landscape: true },
  { id: "bg-098", label: "Background 98", emoji: "🎬", category: "Background", driveId: "16ZsKp6fx35dRsLWgK6Xps284k_I_2n2d", tags: ["background", "fundo"], landscape: true },
  { id: "bg-099", label: "Background 99", emoji: "🎬", category: "Background", driveId: "1rPQzv9-nXTS8wTA7A3k2OuF8VrQY_e9n", tags: ["background", "fundo"], landscape: true },
  { id: "bg-100", label: "Background 100", emoji: "🎬", category: "Background", driveId: "1TaajwgmHLXXZwFzAjugZMd6pwVU7V3d1", tags: ["background", "fundo"], landscape: true },
  { id: "bg-101", label: "Background 101", emoji: "🎬", category: "Background", driveId: "1e8MGJgaRXlWH_i8HqYr40mOObK4xNvtV", tags: ["background", "fundo"], landscape: true },
  { id: "bg-102", label: "Background 102", emoji: "🎬", category: "Background", driveId: "1OWA9sjdqSAegWN-fsQuLqQSUiQbzafmS", tags: ["background", "fundo"], landscape: true },
  { id: "bg-103", label: "Background 103", emoji: "🎬", category: "Background", driveId: "1G4Z7QpMyXX6vIh6HI6Rxjzw-0MmBSeix", tags: ["background", "fundo"], landscape: true },
  { id: "bg-104", label: "Background 104", emoji: "🎬", category: "Background", driveId: "1kgNLFJDKoIOqXUoviOurVDA-TwsnLYyh", tags: ["background", "fundo"], landscape: true },
  { id: "bg-105", label: "Background 105", emoji: "🎬", category: "Background", driveId: "1VkUWiHPmgsuw-E8OGIuzIADW4q5hBLej", tags: ["background", "fundo"], landscape: true },
  { id: "bg-106", label: "Background 106", emoji: "🎬", category: "Background", driveId: "1Paxlj42Nu6d1A1HSswC-XOcs58CeubP3", tags: ["background", "fundo"], landscape: true },
  { id: "bg-107", label: "Background 107", emoji: "🎬", category: "Background", driveId: "1aOykWsUgNET4hrjmX-XL9km9SoAJNzgq", tags: ["background", "fundo"], landscape: true },
  { id: "bg-108", label: "Background 108", emoji: "🎬", category: "Background", driveId: "1sEFr2Y5KIa03kGooMdCBcd7JQYoNvptE", tags: ["background", "fundo"], landscape: true },
  { id: "bg-109", label: "Background 109", emoji: "🎬", category: "Background", driveId: "194U69-B-s-NrPbCO4__B5Mbuy3aaM6gG", tags: ["background", "fundo"], landscape: true },
  { id: "bg-110", label: "Background 110", emoji: "🎬", category: "Background", driveId: "1kpEPD-lHaTvYtlNGEulkfFVXJ4U9JCnQ", tags: ["background", "fundo"], landscape: true },
  { id: "bg-111", label: "Background 111", emoji: "🎬", category: "Background", driveId: "1UHxXdvRQPJoxQWEgMNwfwM8IjYUVhEPL", tags: ["background", "fundo"], landscape: true },
  { id: "bg-112", label: "Background 112", emoji: "🎬", category: "Background", driveId: "17lQkJ60ZbaaR3O5Q6bw08h6fRZ_5Z-Y-", tags: ["background", "fundo"], landscape: true },
  { id: "bg-113", label: "Background 113", emoji: "🎬", category: "Background", driveId: "17h_viIdMHOp42lgcHYrApLbrcyziBCIw", tags: ["background", "fundo"], landscape: true },
  { id: "bg-114", label: "Background 114", emoji: "🎬", category: "Background", driveId: "180VDh-Nqa6AfkQoZBk3K4l3cCLYn1Bvb", tags: ["background", "fundo"], landscape: true },
  { id: "bg-115", label: "Background 115", emoji: "🎬", category: "Background", driveId: "1ikspn50XJu3TjQV3AcQl0kewusMFSf8E", tags: ["background", "fundo"], landscape: true },
  { id: "bg-116", label: "Background 116", emoji: "🎬", category: "Background", driveId: "1CiX4qOyUlhaesE8Hf5gDCgXK1Jbxxm_a", tags: ["background", "fundo"], landscape: true },
  { id: "bg-117", label: "Background 117", emoji: "🎬", category: "Background", driveId: "1V9_TBd0qBgQW2BTC5gZ3ynIudfaq1aEd", tags: ["background", "fundo"], landscape: true },
  { id: "bg-118", label: "Background 118", emoji: "🎬", category: "Background", driveId: "12yjeS7sc_5HO3clkrhZGlbFydQi3owk7", tags: ["background", "fundo"], landscape: true },
  { id: "bg-119", label: "Background 119", emoji: "🎬", category: "Background", driveId: "188IHuEvumEKU5XMLX8L3cBLHFVRl8kwN", tags: ["background", "fundo"], landscape: true },
  { id: "bg-120", label: "Background 120", emoji: "🎬", category: "Background", driveId: "1kMVZ0anQr2fV5CPoNODx_YF_LCa9ff4W", tags: ["background", "fundo"], landscape: true },
  { id: "bg-121", label: "Background 121", emoji: "🎬", category: "Background", driveId: "169n2oNshb08OEy9CG3iA-gc41be4TN_w", tags: ["background", "fundo"], landscape: true },
  { id: "bg-122", label: "Background 122", emoji: "🎬", category: "Background", driveId: "1tujbQlGNWH6ZMwz0d96J7Nhg5Y_M0aBQ", tags: ["background", "fundo"], landscape: true },
  { id: "bg-123", label: "Background 123", emoji: "🎬", category: "Background", driveId: "1LDVb0fAy1WG5aUN8yRTzJgaICUDsINbQ", tags: ["background", "fundo"], landscape: true },
  { id: "bg-124", label: "Background 124", emoji: "🎬", category: "Background", driveId: "1CACzTRzG3WDKB8aLZRiCmnDhsYQVOQ-n", tags: ["background", "fundo"], landscape: true },
  { id: "bg-125", label: "Background 125", emoji: "🎬", category: "Background", driveId: "1BgQb93j5E2A4zjAd90EmjnmgFW-_34zr", tags: ["background", "fundo"], landscape: true },
  { id: "bg-126", label: "Background 126", emoji: "🎬", category: "Background", driveId: "1kbg5sq3u3nJCNdOpdpMCGyI0CiHgZXUZ", tags: ["background", "fundo"], landscape: true },
  { id: "bg-127", label: "Background 127", emoji: "🎬", category: "Background", driveId: "1995dj1MYLMsryz8jFfzSjx2JmzgUZnEC", tags: ["background", "fundo"], landscape: true },
  { id: "bg-128", label: "Background 128", emoji: "🎬", category: "Background", driveId: "1NiPdz59HNgufBmWjLcjmk_S2rYaXyVqv", tags: ["background", "fundo"], landscape: true },
  { id: "bg-129", label: "Background 129", emoji: "🎬", category: "Background", driveId: "1mjppSKaM7DCLB7SKrGD4X3hkeJ3p3UFe", tags: ["background", "fundo"], landscape: true },
  { id: "bg-130", label: "Background 130", emoji: "🎬", category: "Background", driveId: "12GmZOgbyaXRr1o4I_IIr9KIE5nZfuKnT", tags: ["background", "fundo"], landscape: true },
  { id: "bg-131", label: "Background 131", emoji: "🎬", category: "Background", driveId: "170w-DLLy142hnk3VYbh9PkyXpYVz3MFu", tags: ["background", "fundo"], landscape: true },
  { id: "bg-132", label: "Background 132", emoji: "🎬", category: "Background", driveId: "1a14RosEfHkDtuTpVdm0fa_0VUaXb0xKT", tags: ["background", "fundo"], landscape: true },
  { id: "bg-133", label: "Background 133", emoji: "🎬", category: "Background", driveId: "1LSWakHGOPkQu-lrqCDqWrFbAXGpL9Kd8", tags: ["background", "fundo"], landscape: true },
  { id: "bg-134", label: "Background 134", emoji: "🎬", category: "Background", driveId: "1M9fUCx_1J_Es07d-nEQlBYjRAUEeruAY", tags: ["background", "fundo"], landscape: true },
  { id: "bg-135", label: "Background 135", emoji: "🎬", category: "Background", driveId: "1N69GCxfzPB4-mItreifSZU-c53p6ya7d", tags: ["background", "fundo"], landscape: true },
  { id: "bg-136", label: "Background 136", emoji: "🎬", category: "Background", driveId: "12Ck73vfUBPOYlCteSkT9PHjLZDBBMlJS", tags: ["background", "fundo"], landscape: true },
  { id: "bg-137", label: "Background 137", emoji: "🎬", category: "Background", driveId: "1JSu73Bq4wozPMArlErm26RpZcTgCBoc-", tags: ["background", "fundo"], landscape: true },
  { id: "bg-138", label: "Background 138", emoji: "🎬", category: "Background", driveId: "1z7X1Uj3kwlLOqe4-xyAByyKZU1asG6SQ", tags: ["background", "fundo"], landscape: true },
  { id: "bg-139", label: "Background 139", emoji: "🎬", category: "Background", driveId: "1XTwohbjjI7Gi17kcnzFXHR3kcnJ6AVz4", tags: ["background", "fundo"], landscape: true },
  { id: "bg-140", label: "Background 140", emoji: "🎬", category: "Background", driveId: "1kkf8yhDbFQyFbPxZswzU15f0P98-N6Jb", tags: ["background", "fundo"], landscape: true },
  { id: "bg-141", label: "Background 141", emoji: "🎬", category: "Background", driveId: "1Z2yU-UWM0ydHfJ6SJMdV2S7QtCXys6k_", tags: ["background", "fundo"], landscape: true },
  { id: "bg-142", label: "Background 142", emoji: "🎬", category: "Background", driveId: "1HXCkQl4LEM4NTNtZlmO3HcLu1qcopN_9", tags: ["background", "fundo"], landscape: true },
  { id: "bg-143", label: "Background 143", emoji: "🎬", category: "Background", driveId: "1O1pp49mE9jFNQx3QwE0_49Sw3b4bpqP-", tags: ["background", "fundo"], landscape: true },
  { id: "bg-144", label: "Background 144", emoji: "🎬", category: "Background", driveId: "1zZjG-QTwgr_Z_z5Zb1-60KCWRF8HpVM5", tags: ["background", "fundo"], landscape: true },
  { id: "bg-145", label: "Background 145", emoji: "🎬", category: "Background", driveId: "16uMVccOu9bV6ehN68Twujqe_JJgnEvho", tags: ["background", "fundo"], landscape: true },
  { id: "bg-146", label: "Background 146", emoji: "🎬", category: "Background", driveId: "14LiuWtd3gpl03EEQDtY96UIdg-ofE84_", tags: ["background", "fundo"], landscape: true },
  { id: "bg-147", label: "Background 147", emoji: "🎬", category: "Background", driveId: "19dEXH2gyHPdSNpRZHyBYqVdVRV_ugdHE", tags: ["background", "fundo"], landscape: true },
  { id: "bg-148", label: "Background 148", emoji: "🎬", category: "Background", driveId: "1ayP9-b6MDmApHuwegSU9p6BD_SVo0vyr", tags: ["background", "fundo"], landscape: true },
  { id: "bg-149", label: "Background 149", emoji: "🎬", category: "Background", driveId: "1s-7TB7yB0siSfuzAU4X-vrzxN7TS-SKa", tags: ["background", "fundo"], landscape: true },
  { id: "bg-150", label: "Background 150", emoji: "🎬", category: "Background", driveId: "1SQDJFjizieqSOWfp-sUY57XEH9FoqVn4", tags: ["background", "fundo"], landscape: true },
  { id: "bg-151", label: "Background 151", emoji: "🎬", category: "Background", driveId: "1UrG2MekzZnFRK3_wQ42yV3GlbZPGlRYh", tags: ["background", "fundo"], landscape: true },
];

/* ── Overlay groups ── */
type OverlayGroup = { id: string; label: string; emoji: string; assets: Asset[] };

/* ── Emojis Animados ── */
const emojiAssets: Asset[] = [
  { id: "ov-emj-001", label: "Emoji Animado 1",  emoji: "😜", category: "Emoji", driveId: "1sq9ZQ72B5rXXSKCcFW5_RwYzB9hIQSwV", tags: ["emoji", "animado"] },
  { id: "ov-emj-002", label: "Emoji Animado 2",  emoji: "😜", category: "Emoji", driveId: "1FPvMRn8Ikq8j7ygArAeGaNASJ7dHpWel", tags: ["emoji", "animado"] },
  { id: "ov-emj-003", label: "Emoji Animado 3",  emoji: "😜", category: "Emoji", driveId: "1AROtxBX7DV09DPITFufTpv9eF2eCzKSX", tags: ["emoji", "animado"] },
  { id: "ov-emj-004", label: "Emoji Animado 4",  emoji: "😜", category: "Emoji", driveId: "1vcCuoq1VFiS8kBE4-IEB9U1EzBPMyh_F", tags: ["emoji", "animado"] },
  { id: "ov-emj-005", label: "Emoji Animado 5",  emoji: "😜", category: "Emoji", driveId: "1xh-fpVsLNgQmEU0V5Ae9mrtDEZmibwJI", tags: ["emoji", "animado"] },
  { id: "ov-emj-006", label: "Emoji Animado 6",  emoji: "😜", category: "Emoji", driveId: "1ck-3qH2ZpUWd9Dd5Dg0E5u8OtACasEb_", tags: ["emoji", "animado"] },
  { id: "ov-emj-007", label: "Emoji Animado 7",  emoji: "😜", category: "Emoji", driveId: "1Aj6EpApLGJ7plgwqnw9sU0nRLfVyWoL3", tags: ["emoji", "animado"] },
  { id: "ov-emj-008", label: "Emoji Animado 8",  emoji: "😜", category: "Emoji", driveId: "1tyOfDAYr7CpJGM709rVOhLvuCwcuDzub", tags: ["emoji", "animado"] },
  { id: "ov-emj-009", label: "Emoji Animado 9",  emoji: "😜", category: "Emoji", driveId: "10ufAfHzRxY2YW4jw5Bc6B1inWiJVQfpx", tags: ["emoji", "animado"] },
  { id: "ov-emj-010", label: "Emoji Animado 10", emoji: "😜", category: "Emoji", driveId: "134I5Ts8T6e4zHXch1B3rlkJbe8t3Vlep", tags: ["emoji", "animado"] },
  { id: "ov-emj-011", label: "Emoji Animado 11", emoji: "😜", category: "Emoji", driveId: "1fExW5bLBXTwa6DcnOD9qK2_kAd2b_zHV", tags: ["emoji", "animado"] },
  { id: "ov-emj-012", label: "Emoji Animado 12", emoji: "😜", category: "Emoji", driveId: "1e6IMqROIW-gSXvMt0SR0QawTxwX7Hn0a", tags: ["emoji", "animado"] },
  { id: "ov-emj-013", label: "Emoji Animado 13", emoji: "😜", category: "Emoji", driveId: "1R7UVimOiQDJhvY_BvqEJ_O10ZQDGQN7v", tags: ["emoji", "animado"] },
  { id: "ov-emj-014", label: "Emoji Animado 14", emoji: "😜", category: "Emoji", driveId: "1ytWZVUCoM7FJ2kg4VoN7h1JnBhPc1Pf4", tags: ["emoji", "animado"] },
  { id: "ov-emj-015", label: "Emoji Animado 15", emoji: "😜", category: "Emoji", driveId: "194V-X895xYwCb_uKNEjL2m3RBLXPufNN", tags: ["emoji", "animado"] },
  { id: "ov-emj-016", label: "Emoji Animado 16", emoji: "😜", category: "Emoji", driveId: "1JJYv56fk4HYiyfsiThI4HeKC6zg8IiUA", tags: ["emoji", "animado"] },
  { id: "ov-emj-017", label: "Emoji Animado 17", emoji: "😜", category: "Emoji", driveId: "1NbYLHkA0zTMnREUkt-MWTvgTLirI9bVy", tags: ["emoji", "animado"] },
  { id: "ov-emj-018", label: "Emoji Animado 18", emoji: "😜", category: "Emoji", driveId: "1i2Vg0wNdLBoTO3LHxFF2D5RLb81GgsRw", tags: ["emoji", "animado"] },
  { id: "ov-emj-019", label: "Emoji Animado 19", emoji: "😜", category: "Emoji", driveId: "1YKfNgM2hoMtFpS76M1CwyjupqlRNK9bX", tags: ["emoji", "animado"] },
  { id: "ov-emj-020", label: "Emoji Animado 20", emoji: "😜", category: "Emoji", driveId: "14XqhobNcFKhpIXbqYzIr8PRa4Tks4l1t", tags: ["emoji", "animado"] },
  { id: "ov-emj-021", label: "Emoji Animado 21", emoji: "😜", category: "Emoji", driveId: "1YavcXYIQ_z7d67CJ5psglZc2JnhoXjLq", tags: ["emoji", "animado"] },
  { id: "ov-emj-022", label: "Emoji Animado 22", emoji: "😜", category: "Emoji", driveId: "1ebbHzW_Q5XjOVXb6NlJH6g-xADWpb6Ca", tags: ["emoji", "animado"] },
  { id: "ov-emj-023", label: "Emoji Animado 23", emoji: "😜", category: "Emoji", driveId: "1Ed2CocFmKDCMLjF-uHJgU0Pp1ruxk42m", tags: ["emoji", "animado"] },
  { id: "ov-emj-024", label: "Emoji Animado 24", emoji: "😜", category: "Emoji", driveId: "132BvE3WprnHDcEN4K47rsOIEES8pmykD", tags: ["emoji", "animado"] },
  { id: "ov-emj-025", label: "Emoji Animado 25", emoji: "😜", category: "Emoji", driveId: "1sU-vdRlODPtSY3BJU6zXuvQYMzgNr0o7", tags: ["emoji", "animado"] },
  { id: "ov-emj-026", label: "Emoji Animado 26", emoji: "😜", category: "Emoji", driveId: "18KRlfDJtyXXFspheR8j8cVRFTwRYjMd8", tags: ["emoji", "animado"] },
  { id: "ov-emj-027", label: "Emoji Animado 27", emoji: "😜", category: "Emoji", driveId: "1D0lZLR7lERHUROTMXHWLKMogwVczWHfw", tags: ["emoji", "animado"] },
  { id: "ov-emj-028", label: "Emoji Animado 28", emoji: "😜", category: "Emoji", driveId: "1jAjQKa0WPvJCWK7_TILjNVfACLDGSK5e", tags: ["emoji", "animado"] },
  { id: "ov-emj-029", label: "Emoji Animado 29", emoji: "😜", category: "Emoji", driveId: "1auJYBi0-2OvlLU0dfvetsC4LC53sgbxD", tags: ["emoji", "animado"] },
  { id: "ov-emj-030", label: "Emoji Animado 30", emoji: "😜", category: "Emoji", driveId: "1Vw-4CHHyUxMCt0hBivQceTOAAbw3T_k-", tags: ["emoji", "animado"] },
  { id: "ov-emj-031", label: "Emoji Animado 31", emoji: "😜", category: "Emoji", driveId: "1MX-ac_GsWij2_ERY4YAqdEyJisuRz8Bi", tags: ["emoji", "animado"] },
  { id: "ov-emj-032", label: "Emoji Animado 32", emoji: "😜", category: "Emoji", driveId: "1it0r-ImmB3Y_FCkZKc82vNJ1bIFczIjl", tags: ["emoji", "animado"] },
  { id: "ov-emj-033", label: "Emoji Animado 33", emoji: "😜", category: "Emoji", driveId: "1PsFMuwFXKnrgK3EqxZfeGe9gYZDbkxlf", tags: ["emoji", "animado"] },
  { id: "ov-emj-034", label: "Emoji Animado 34", emoji: "😜", category: "Emoji", driveId: "1dNgyQW-qUlG2xF06z7XargkW2Cfkz1PH", tags: ["emoji", "animado"] },
  { id: "ov-emj-035", label: "Emoji Animado 35", emoji: "😜", category: "Emoji", driveId: "128GxDSKYUQS1tG8M3lOJk7JrNVptp2Kd", tags: ["emoji", "animado"] },
  { id: "ov-emj-036", label: "Emoji Animado 36", emoji: "😜", category: "Emoji", driveId: "1JDKeGvJs4Wyz8bwe-9Nfo3Y10gZGTD_L", tags: ["emoji", "animado"] },
  { id: "ov-emj-037", label: "Emoji Animado 37", emoji: "😜", category: "Emoji", driveId: "1k4YJpQUYt2x7CPMk7rC0tdtfAKYRgqPP", tags: ["emoji", "animado"] },
  { id: "ov-emj-038", label: "Emoji Animado 38", emoji: "😜", category: "Emoji", driveId: "1r5FQR6FxtxiMjIm9UBQNMnd0_Hqzk1ec", tags: ["emoji", "animado"] },
  { id: "ov-emj-039", label: "Emoji Animado 39", emoji: "😜", category: "Emoji", driveId: "1uxt_5FwzayuST1QYtPbiX_t4XuozxVZ6", tags: ["emoji", "animado"] },
  { id: "ov-emj-040", label: "Emoji Animado 40", emoji: "😜", category: "Emoji", driveId: "1ysWVsSDEDIlCKmTvHTWnx-y9ZJL7CpAo", tags: ["emoji", "animado"] },
  { id: "ov-emj-041", label: "Emoji Animado 41", emoji: "😜", category: "Emoji", driveId: "1e29ZczVnxIW5pjxw6Xkf08v5mhDjuuuh", tags: ["emoji", "animado"] },
  { id: "ov-emj-042", label: "Emoji Animado 42", emoji: "😜", category: "Emoji", driveId: "1aWyq3f42HVvuPKg5HsAh4rzjOyC19Gry", tags: ["emoji", "animado"] },
  { id: "ov-emj-043", label: "Emoji Animado 43", emoji: "😜", category: "Emoji", driveId: "1D2sl-tJtTQEHscTB3FXmpmCVg_dJhU_i", tags: ["emoji", "animado"] },
  { id: "ov-emj-044", label: "Emoji Animado 44", emoji: "😜", category: "Emoji", driveId: "1V3xjhckEJGpZZCQNe79aoLife4e6A_8G", tags: ["emoji", "animado"] },
  { id: "ov-emj-045", label: "Emoji Animado 45", emoji: "😜", category: "Emoji", driveId: "1TWmxwhCKkPjkxCSBQXNUlUfWFhfZNv2O", tags: ["emoji", "animado"] },
  { id: "ov-emj-046", label: "Emoji Animado 46", emoji: "😜", category: "Emoji", driveId: "1af2qebTp54p1RMf2O6RUJekvKWv8ROMe", tags: ["emoji", "animado"] },
  { id: "ov-emj-047", label: "Emoji Animado 47", emoji: "😜", category: "Emoji", driveId: "1BtCiVm96-l9nNld9UBnYjtyfBt9UMGKj", tags: ["emoji", "animado"] },
  { id: "ov-emj-048", label: "Emoji Animado 48", emoji: "😜", category: "Emoji", driveId: "1YGdiu_wzuq0bjIqY_8bLq5jBBX70O5zz", tags: ["emoji", "animado"] },
  { id: "ov-emj-049", label: "Emoji Animado 49", emoji: "😜", category: "Emoji", driveId: "1U9LouwdUS9L0SJ_ZTRqR1eUw7P8GBSmq", tags: ["emoji", "animado"] },
  { id: "ov-emj-050", label: "Emoji Animado 50", emoji: "😜", category: "Emoji", driveId: "1Z5sK81YkbCdWxSgObfvfPk4epzeHxL6v", tags: ["emoji", "animado"] },
];

const overlayGroups: OverlayGroup[] = [
  {
    id: "pacote-1",
    label: "Pacote 1",
    emoji: "🎁",
    assets: [
      { id: "np-001", label: "Novo 1",   emoji: "🎁", category: "Overlay", driveId: "1DMXMHXz7_0r0Y2yyyd3IhVNgHagtddXz", tags: ["overlay"] },
      { id: "np-002", label: "Novo 2",   emoji: "🎁", category: "Overlay", driveId: "1Srm7L-UYqwOFeJRqtKms1D1s5iROpVAG", tags: ["overlay"] },
      { id: "np-003", label: "Novo 3",   emoji: "🎁", category: "Overlay", driveId: "11W5snwiTOReeMDv9RgccsWlNqapKU7qn", tags: ["overlay"] },
      { id: "np-004", label: "Novo 4",   emoji: "🎁", category: "Overlay", driveId: "16WjU3QJuTzFdhPxFHirRNCHhfyhAYwe0", tags: ["overlay"] },
      { id: "np-005", label: "Novo 5",   emoji: "🎁", category: "Overlay", driveId: "1S5nHI9jclvgux90EfHOSLziXwco9VjsZ", tags: ["overlay"] },
      { id: "np-006", label: "Novo 6",   emoji: "🎁", category: "Overlay", driveId: "1KMIpafeWu0NrM91fSMkXpeoza_pSDfOb", tags: ["overlay"] },
      { id: "np-007", label: "Novo 7",   emoji: "🎁", category: "Overlay", driveId: "1rGqpPHzTx_KVWYdjA5fQXwHddcYx3sJK", tags: ["overlay"] },
      { id: "np-008", label: "Novo 8",   emoji: "🎁", category: "Overlay", driveId: "1Z3MQLLRIYldaISIp8bUZzoq4xdNBWdWP", tags: ["overlay"] },
      { id: "np-009", label: "Novo 9",   emoji: "🎁", category: "Overlay", driveId: "1uI78v-v1AB7o4I_YTf-bCNSvqpf4MHRY", tags: ["overlay"] },
      { id: "np-010", label: "Novo 10",  emoji: "🎁", category: "Overlay", driveId: "1TkNT4jvSCnN18uCxGU08IjG1YZBM7fFz", tags: ["overlay"] },
      { id: "np-011", label: "Novo 11",  emoji: "🎁", category: "Overlay", driveId: "1sunpUzYjn2rYwCjwQsiMiRkh2McrniP0", tags: ["overlay"] },
      { id: "np-012", label: "Novo 12",  emoji: "🎁", category: "Overlay", driveId: "11DuaN6HW19TqV2yCUAa0d239y4BKhpSv", tags: ["overlay"] },
      { id: "np-013", label: "Novo 13",  emoji: "🎁", category: "Overlay", driveId: "1ubW6h4cQUgHc0DDRKu6qSQ2AkyirCT4F", tags: ["overlay"] },
      { id: "np-014", label: "Novo 14",  emoji: "🎁", category: "Overlay", driveId: "1bsagIi43S3j_-75BuiTPFiKCue32KPzK", tags: ["overlay"] },
      { id: "np-015", label: "Novo 15",  emoji: "🎁", category: "Overlay", driveId: "1Lozdv0YBmZpt7-Zm3TUeMH5TP_QSclkW", tags: ["overlay"] },
      { id: "np-016", label: "Novo 16",  emoji: "🎁", category: "Overlay", driveId: "1Jozy7uiXTYCDBrLnZBdFG_Zv8dhytuxw", tags: ["overlay"] },
      { id: "np-017", label: "Novo 17",  emoji: "🎁", category: "Overlay", driveId: "1QWkS2LmvMYBFVWI9e7-A1l1rwqrtEk52", tags: ["overlay"] },
      { id: "np-018", label: "Novo 18",  emoji: "🎁", category: "Overlay", driveId: "1q9W0s7DcI07qoh4Rc7ApgQEGhUqD3CWm", tags: ["overlay"] },
      { id: "np-019", label: "Novo 19",  emoji: "🎁", category: "Overlay", driveId: "1igkGKmA01cYE9jNQ1cNPunqAYKpj9ln_", tags: ["overlay"] },
      { id: "np-020", label: "Novo 20",  emoji: "🎁", category: "Overlay", driveId: "1Z_XYe3XcmPOMmcxNL1mDWyc9U_CXJuwc", tags: ["overlay"] },
      { id: "np-021", label: "Novo 21",  emoji: "🎁", category: "Overlay", driveId: "1EgpPAQCrlYeApV28aJwCzAkCAvA9Ucs5", tags: ["overlay"] },
      { id: "np-022", label: "Novo 22",  emoji: "🎁", category: "Overlay", driveId: "1Olm0upz30WOEiA4Fak7dtyhDJRFnitfu", tags: ["overlay"] },
      { id: "np-023", label: "Novo 23",  emoji: "🎁", category: "Overlay", driveId: "1Ar_M-E59rVbgsOrCA6393gPp1aWOiIBI", tags: ["overlay"] },
      { id: "np-024", label: "Novo 24",  emoji: "🎁", category: "Overlay", driveId: "1VFwD2gUHTELTYZNVJfJ7MrgKLrQmE6nf", tags: ["overlay"] },
      { id: "np-025", label: "Novo 25",  emoji: "🎁", category: "Overlay", driveId: "1vXODipyMf9yBn87EpqtyZHLf6F5qR5ya", tags: ["overlay"] },
      { id: "np-026", label: "Novo 26",  emoji: "🎁", category: "Overlay", driveId: "1FbXS0v5xfK2080VEAVr0EmpyeXvq0r36", tags: ["overlay"] },
      { id: "np-027", label: "Novo 27",  emoji: "🎁", category: "Overlay", driveId: "1cob3IoUnlm0fQu30XcdpnJGKPdQ_szOl", tags: ["overlay"] },
      { id: "np-028", label: "Novo 28",  emoji: "🎁", category: "Overlay", driveId: "15ExZvU94kJxzsXdGE4cXrXxjvtQkwrK8", tags: ["overlay"] },
      { id: "np-029", label: "Novo 29",  emoji: "🎁", category: "Overlay", driveId: "1gTOGBojQpEzcpJDcyse484dsnNr4glZE", tags: ["overlay"] },
      { id: "np-030", label: "Novo 30",  emoji: "🎁", category: "Overlay", driveId: "1UhmOIpVjpxTDhciC9AMrHoE9wymIpjRt", tags: ["overlay"] },
      { id: "np-031", label: "Novo 31",  emoji: "🎁", category: "Overlay", driveId: "1Uf-p_tW2XsHsQFWz5c3VauIMNRJ4ys5q", tags: ["overlay"] },
      { id: "np-032", label: "Novo 32",  emoji: "🎁", category: "Overlay", driveId: "1QOAVC1JpdXkMVdAlsaJK4j5eWxNSdOkL", tags: ["overlay"] },
      { id: "np-033", label: "Novo 33",  emoji: "🎁", category: "Overlay", driveId: "1flFX3AOZIUj6b-oPcSyZRPv57TZHx8fw", tags: ["overlay"] },
      { id: "np-034", label: "Novo 34",  emoji: "🎁", category: "Overlay", driveId: "1GUmHRZe4r8S9qyTpu6WhFkVG-cRCmAwv", tags: ["overlay"] },
      { id: "np-035", label: "Novo 35",  emoji: "🎁", category: "Overlay", driveId: "15YRN_5rZm1agnIrhj6ogDSZgyo6P8tDQ", tags: ["overlay"] },
      { id: "np-036", label: "Novo 36",  emoji: "🎁", category: "Overlay", driveId: "1r4DQb8RT_3iPR7fxzNV0jqBlfbHDB5LC", tags: ["overlay"] },
      { id: "np-037", label: "Novo 37",  emoji: "🎁", category: "Overlay", driveId: "1JGIkCytS8GFKiLjL4UDNItXfFFWJQ6l0", tags: ["overlay"] },
      { id: "np-038", label: "Novo 38",  emoji: "🎁", category: "Overlay", driveId: "14snbj0dPs8iFEFZUpQvhw7ngDJJnTBJ4", tags: ["overlay"] },
      { id: "np-039", label: "Novo 39",  emoji: "🎁", category: "Overlay", driveId: "16a_ObI8grqOg15QUQetfe6-3CRvjbqA2", tags: ["overlay"] },
      { id: "np-040", label: "Novo 40",  emoji: "🎁", category: "Overlay", driveId: "1Mo-_dBslENb2fPMCB5znwE_GEESDo-LU", tags: ["overlay"] },
      { id: "np-041", label: "Novo 41",  emoji: "🎁", category: "Overlay", driveId: "1EvgyjQku7BNNrbnpwT9H1BuwZEILbJuh", tags: ["overlay"] },
      { id: "np-042", label: "Novo 42",  emoji: "🎁", category: "Overlay", driveId: "18WuvAHoDloz5kI9UqeKfOUPHWwZUZQeP", tags: ["overlay"] },
      { id: "np-043", label: "Novo 43",  emoji: "🎁", category: "Overlay", driveId: "1qB2P-eyhnf6MG1tMkHz1m7y7AIzIC-Qt", tags: ["overlay"] },
      { id: "np-044", label: "Novo 44",  emoji: "🎁", category: "Overlay", driveId: "1qm83E7WQ0TlKmKgzYlvR8hCyLFROgood", tags: ["overlay"] },
      { id: "np-045", label: "Novo 45",  emoji: "🎁", category: "Overlay", driveId: "1AkO4I9XYRJ-1bpxDpyIvmjd8XhyZv5YS", tags: ["overlay"] },
      { id: "np-046", label: "Novo 46",  emoji: "🎁", category: "Overlay", driveId: "1nxAL5ra6U76YIyTMRUQLsSOZOxmnrw4d", tags: ["overlay"] },
      { id: "np-047", label: "Novo 47",  emoji: "🎁", category: "Overlay", driveId: "1MAnr8hCfpKFVFaXpQWSEagM6HRUxuGF1", tags: ["overlay"] },
      { id: "np-048", label: "Novo 48",  emoji: "🎁", category: "Overlay", driveId: "1D9sRdZAvEFY9mMEU_EgbOWoOzMopNlcV", tags: ["overlay"] },
      { id: "np-049", label: "Novo 49",  emoji: "🎁", category: "Overlay", driveId: "1XEULl0spRm_DK8bR-YSzOI4SPF4GwVDQ", tags: ["overlay"] },
      { id: "np-050", label: "Novo 50",  emoji: "🎁", category: "Overlay", driveId: "10Eevept-TFxCiZcB_-4GouqzI6QfTSgb", tags: ["overlay"] },
      { id: "np-051", label: "Novo 51",  emoji: "🎁", category: "Overlay", driveId: "1OZBp1w-uRUpHP5R8-tJE4zLJc5mWjPqM", tags: ["overlay"] },
      { id: "np-052", label: "Novo 52",  emoji: "🎁", category: "Overlay", driveId: "1n0h-R8iSeQ-vdwgcqj5LrsZlJa1XO5Xa", tags: ["overlay"] },
      { id: "np-053", label: "Novo 53",  emoji: "🎁", category: "Overlay", driveId: "1ddgfPmht0P8cboyNW2ljmjPj3ITsKB4r", tags: ["overlay"] },
      { id: "np-054", label: "Novo 54",  emoji: "🎁", category: "Overlay", driveId: "1tZanJuM0_JJoEKUlh6sg77eCj_sPFRM2", tags: ["overlay"] },
      { id: "np-055", label: "Novo 55",  emoji: "🎁", category: "Overlay", driveId: "1tNJNiJr-0fxXLeHMGvH_nMluxfO4L8By", tags: ["overlay"] },
      { id: "np-056", label: "Novo 56",  emoji: "🎁", category: "Overlay", driveId: "1hffPYkgvGrvReplBtnFzujhNj4nHwCie", tags: ["overlay"] },
      { id: "np-057", label: "Novo 57",  emoji: "🎁", category: "Overlay", driveId: "1JQm1YAHO_7NRsb-8GA7wW5pDW-INgTnU", tags: ["overlay"] },
      { id: "np-058", label: "Novo 58",  emoji: "🎁", category: "Overlay", driveId: "1-Bb88eRF00wpAGvzj7tNmy3J4nxYy4Jz", tags: ["overlay"] },
      { id: "np-059", label: "Novo 59",  emoji: "🎁", category: "Overlay", driveId: "1PbNGxc08kaLpPpoKgqwszdpIH-Y_0O93", tags: ["overlay"] },
      { id: "np-060", label: "Novo 60",  emoji: "🎁", category: "Overlay", driveId: "1CYtJmgNlKTjr8WcN08JjU3YkADmOuP39", tags: ["overlay"] },
      { id: "np-061", label: "Novo 61",  emoji: "🎁", category: "Overlay", driveId: "15-H8I44Er48xrLIcEIHz9zTRyTml1tKP", tags: ["overlay"] },
      { id: "np-062", label: "Novo 62",  emoji: "🎁", category: "Overlay", driveId: "1HmiOtv-QvwTH9OYZ5iBujoE9s_B1Inbn", tags: ["overlay"] },
      { id: "np-063", label: "Novo 63",  emoji: "🎁", category: "Overlay", driveId: "1Qw5cf5_Yr6xftsOpN6S7979kQhNq8XqM", tags: ["overlay"] },
      { id: "np-064", label: "Novo 64",  emoji: "🎁", category: "Overlay", driveId: "1VN7VqJTgXGEE4sXp83z1yw_PuWadoGo3", tags: ["overlay"] },
      { id: "np-065", label: "Novo 65",  emoji: "🎁", category: "Overlay", driveId: "1y15-SN5_pVmf3BxiKHCbclL9z8qtgds0", tags: ["overlay"] },
      { id: "np-066", label: "Novo 66",  emoji: "🎁", category: "Overlay", driveId: "18JKbG7tNswRexJptZS9_Ibhtlrlip21-", tags: ["overlay"] },
      { id: "np-067", label: "Novo 67",  emoji: "🎁", category: "Overlay", driveId: "1KH8Cp42BYXMHadqWoPq8Is_AC5Rw8z7q", tags: ["overlay"] },
      { id: "np-068", label: "Novo 68",  emoji: "🎁", category: "Overlay", driveId: "10mIW2AeKJWkyzhPO2awCAuHrb6OxZ3Gy", tags: ["overlay"] },
      { id: "np-069", label: "Novo 69",  emoji: "🎁", category: "Overlay", driveId: "1YLM4lgiAHp4_qXroJEiZektTKm4qpnVk", tags: ["overlay"] },
      { id: "np-070", label: "Novo 70",  emoji: "🎁", category: "Overlay", driveId: "1-wyE5Lwzx0keT8Emz7Qo0bxFXK45assm", tags: ["overlay"] },
      { id: "np-071", label: "Novo 71",  emoji: "🎁", category: "Overlay", driveId: "1xmUJQw4zeloGQe_C2ybzg8p2aX82nYpL", tags: ["overlay"] },
      { id: "np-072", label: "Novo 72",  emoji: "🎁", category: "Overlay", driveId: "1WJa7E9xyJmGA7ay8_vxsPxCDiDXNVhnd", tags: ["overlay"] },
      { id: "np-073", label: "Novo 73",  emoji: "🎁", category: "Overlay", driveId: "1LRgu_BpbkKS-gEOiz7mnAvmbQotBKbdY", tags: ["overlay"] },
      { id: "np-074", label: "Novo 74",  emoji: "🎁", category: "Overlay", driveId: "1xfA-ivw0idrwksZ6x_mic-jfZVa6O06a", tags: ["overlay"] },
      { id: "np-075", label: "Novo 75",  emoji: "🎁", category: "Overlay", driveId: "1zzzPA18UE03r9D4OkjjWVjzzcdp0pyo4", tags: ["overlay"] },
      { id: "np-076", label: "Novo 76",  emoji: "🎁", category: "Overlay", driveId: "1_tFxuezVEsH87kg1rMnOjaBzbC1F1D4a", tags: ["overlay"] },
      { id: "np-077", label: "Novo 77",  emoji: "🎁", category: "Overlay", driveId: "1EpAN_cyBoX8nFgT3o5o4QsJGrGF5UgN9", tags: ["overlay"] },
      { id: "np-078", label: "Novo 78",  emoji: "🎁", category: "Overlay", driveId: "10WlQ8bP2fOlO66jtB7q9IkQwX47cqzG5", tags: ["overlay"] },
      { id: "np-079", label: "Novo 79",  emoji: "🎁", category: "Overlay", driveId: "1dy3m-6bIx0cqmIc7MfQnZetNDB1hTSbe", tags: ["overlay"] },
      { id: "np-080", label: "Novo 80",  emoji: "🎁", category: "Overlay", driveId: "1gFwQ0yyarpYemtdfCJdeRcPFKMhrJAS-", tags: ["overlay"] },
      { id: "np-081", label: "Novo 81",  emoji: "🎁", category: "Overlay", driveId: "176Nz7xpYw2nnnP4GIAf7BJc-dtUn57hR", tags: ["overlay"] },
      { id: "np-082", label: "Novo 82",  emoji: "🎁", category: "Overlay", driveId: "1vhBzWESnLOMH_rhPuNuuunschOuI2I5U", tags: ["overlay"] },
      { id: "np-083", label: "Novo 83",  emoji: "🎁", category: "Overlay", driveId: "1koE2yWr6cmykm9EkStp7QYqMUAPSv0O0", tags: ["overlay"] },
      { id: "np-084", label: "Novo 84",  emoji: "🎁", category: "Overlay", driveId: "1sf3MZGhcVVpXQQxOjjVQ5nJnfXSYigNB", tags: ["overlay"] },
      { id: "np-085", label: "Novo 85",  emoji: "🎁", category: "Overlay", driveId: "1Po2AlP_9DNmd_nbYZKdIVjhENA8zo9m0", tags: ["overlay"] },
      { id: "np-086", label: "Novo 86",  emoji: "🎁", category: "Overlay", driveId: "1-d-FaUV6oZUrZj6E2ptWwpx2i2Ig8pM-", tags: ["overlay"] },
      { id: "np-087", label: "Novo 87",  emoji: "🎁", category: "Overlay", driveId: "12SIsSA4zxDDHKdtGrYPjN81AWk-exmSI", tags: ["overlay"] },
      { id: "np-088", label: "Novo 88",  emoji: "🎁", category: "Overlay", driveId: "1DCgi9gak0B7gn2KIIH_E-ew5mJKlfSf3", tags: ["overlay"] },
      { id: "np-089", label: "Novo 89",  emoji: "🎁", category: "Overlay", driveId: "1Dbzhs8lsU9tYi6u0bxcxy0yElSWD8N3y", tags: ["overlay"] },
      { id: "np-090", label: "Novo 90",  emoji: "🎁", category: "Overlay", driveId: "1Dh1-KxwGsihtxGlPWGaZVhJBoe8bGmq5", tags: ["overlay"] },
      { id: "np-091", label: "Novo 91",  emoji: "🎁", category: "Overlay", driveId: "1QXN7tNKeBoYG0avM5htU-G3WbIs7nFVt", tags: ["overlay"] },
      { id: "np-092", label: "Novo 92",  emoji: "🎁", category: "Overlay", driveId: "1Sca0nC6qNBkLjvRB2zIjQZkBhNtY-YNv", tags: ["overlay"] },
      { id: "np-093", label: "Novo 93",  emoji: "🎁", category: "Overlay", driveId: "1Yxu1ixhqvUlGzAEtvnajyxt36TlDGpBR", tags: ["overlay"] },
      { id: "np-094", label: "Novo 94",  emoji: "🎁", category: "Overlay", driveId: "1cn-8LZJg95P_4TQ8OZkcEqiQSPST7REa", tags: ["overlay"] },
      { id: "np-095", label: "Novo 95",  emoji: "🎁", category: "Overlay", driveId: "1cx5HxuVXD2gwK6V0i2iol_uMxOBCGrcb", tags: ["overlay"] },
      { id: "np-096", label: "Novo 96",  emoji: "🎁", category: "Overlay", driveId: "1gWICNQuDNnXAShVU6wyD_WQeFiWwJ5fb", tags: ["overlay"] },
      { id: "np-097", label: "Novo 97",  emoji: "🎁", category: "Overlay", driveId: "1kFLISQ3NvHNb0H3CBEKXk7hPqWEXUCpK", tags: ["overlay"] },
      { id: "np-098", label: "Novo 98",  emoji: "🎁", category: "Overlay", driveId: "1-CXVastJYMC7HBNmO__FfEziVgu8e-Fu", tags: ["overlay"] },
      { id: "np-099", label: "Novo 99",  emoji: "🎁", category: "Overlay", driveId: "10iVCAml1OR0SZte22h5FP2UgA89futsl", tags: ["overlay"] },
      { id: "np-100", label: "Novo 100", emoji: "🎁", category: "Overlay", driveId: "10jkWC4Ih0lneFmaGQb1TTbFq2bjs9jmB", tags: ["overlay"] },
    ],
  },
  {
    id: "pacote-2",
    label: "Pacote 2",
    emoji: "🎁",
    assets: [
      { id: "p2-001", label: "P2 1",   emoji: "🎁", category: "Overlay", driveId: "10jkWC4Ih0lneFmaGQb1TTbFq2bjs9jmB", tags: ["overlay"] },
      { id: "p2-002", label: "P2 2",   emoji: "🎁", category: "Overlay", driveId: "1353WVf9c83DVaZWHtPly-UtLc2oLP7C8", tags: ["overlay"] },
      { id: "p2-003", label: "P2 3",   emoji: "🎁", category: "Overlay", driveId: "14W3uuMTuAdARYVZ8-9Et2QVv4455cUXZ", tags: ["overlay"] },
      { id: "p2-004", label: "P2 4",   emoji: "🎁", category: "Overlay", driveId: "1542gDir0-4Z4fIrtrKYiTxiO5wulAmtI", tags: ["overlay"] },
      { id: "p2-005", label: "P2 5",   emoji: "🎁", category: "Overlay", driveId: "18-xd9Oh661zHEeHh0tz4aZ57YoSHjBU7", tags: ["overlay"] },
      { id: "p2-006", label: "P2 6",   emoji: "🎁", category: "Overlay", driveId: "1HFOMgNF-fj7Xqkg98623WccAgSg_J7Jb", tags: ["overlay"] },
      { id: "p2-007", label: "P2 7",   emoji: "🎁", category: "Overlay", driveId: "1NUwQfo8YWr38cJ-ZzCB218AMKpg6c8ot", tags: ["overlay"] },
      { id: "p2-008", label: "P2 8",   emoji: "🎁", category: "Overlay", driveId: "1O8dJF6pohoRUl3rXlD55Dkhf3p2zzC-H", tags: ["overlay"] },
      { id: "p2-009", label: "P2 9",   emoji: "🎁", category: "Overlay", driveId: "1Zet8Elv19lGZWH3BQFvcnxfk1KEYsvhM", tags: ["overlay"] },
      { id: "p2-010", label: "P2 10",  emoji: "🎁", category: "Overlay", driveId: "1a3neDKIqUAZ9XI1awA7--6g_y-qdvENi", tags: ["overlay"] },
      { id: "p2-011", label: "P2 11",  emoji: "🎁", category: "Overlay", driveId: "1aIkL0DsavnJu-ccd83ZHaadJW5MutQSn", tags: ["overlay"] },
      { id: "p2-012", label: "P2 12",  emoji: "🎁", category: "Overlay", driveId: "1bO-XfvfpOHdWi6Em1LjI9KR3SHyEaJBq", tags: ["overlay"] },
      { id: "p2-013", label: "P2 13",  emoji: "🎁", category: "Overlay", driveId: "1dJ-BYgX1cIdAc_-0_y6b8cPlGVAEj4Xy", tags: ["overlay"] },
      { id: "p2-014", label: "P2 14",  emoji: "🎁", category: "Overlay", driveId: "1hbg2MN7hrFOaWOTYvkD1dgoFGBN8lwvK", tags: ["overlay"] },
      { id: "p2-015", label: "P2 15",  emoji: "🎁", category: "Overlay", driveId: "1hl6xdCq57kTRVBqbW1HwHL4tRccfuaG6", tags: ["overlay"] },
      { id: "p2-016", label: "P2 16",  emoji: "🎁", category: "Overlay", driveId: "1q7YHP1u0mmFQDOPqdcZlQfC8LlVrbHqd", tags: ["overlay"] },
      { id: "p2-017", label: "P2 17",  emoji: "🎁", category: "Overlay", driveId: "1rzzxWuLz3Xsm1FUFsrMevxghGHDxUg05", tags: ["overlay"] },
      { id: "p2-018", label: "P2 18",  emoji: "🎁", category: "Overlay", driveId: "1sSJ87gNRNBm3HhROp5rPgjPnBrD0oOGO", tags: ["overlay"] },
      { id: "p2-019", label: "P2 19",  emoji: "🎁", category: "Overlay", driveId: "1sTyvik0LsJRUOLHfiDKatZi3ShQwKyaD", tags: ["overlay"] },
      { id: "p2-020", label: "P2 20",  emoji: "🎁", category: "Overlay", driveId: "1uAt1-Ui6b1OlC3pEm8hVASGnJW5Gx3Ui", tags: ["overlay"] },
      { id: "p2-021", label: "P2 21",  emoji: "🎁", category: "Overlay", driveId: "12odsf-cy1ZN9Il8Ym-9uGak0bYyGCCWD", tags: ["overlay"] },
      { id: "p2-022", label: "P2 22",  emoji: "🎁", category: "Overlay", driveId: "1Apkkxq9ClsEniv0N4qY0_97JYD-U9zy6", tags: ["overlay"] },
      { id: "p2-023", label: "P2 23",  emoji: "🎁", category: "Overlay", driveId: "1Ca_057lsdGye5sy_oQPLNFFhCfRZFRC8", tags: ["overlay"] },
      { id: "p2-024", label: "P2 24",  emoji: "🎁", category: "Overlay", driveId: "1CmLUKYgcPptBkqQ8bWnTge8LTDX6MCrM", tags: ["overlay"] },
      { id: "p2-025", label: "P2 25",  emoji: "🎁", category: "Overlay", driveId: "1EhOypolr_tgFTDM3QqDaIghX3DvrLfi2", tags: ["overlay"] },
      { id: "p2-026", label: "P2 26",  emoji: "🎁", category: "Overlay", driveId: "1K7cOhbZQlvtoDoiqyw7YxXB2zQW6JNSb", tags: ["overlay"] },
      { id: "p2-027", label: "P2 27",  emoji: "🎁", category: "Overlay", driveId: "1KXp0T1kccKK-caTkYR5NrkPV7ddsKw1l", tags: ["overlay"] },
      { id: "p2-028", label: "P2 28",  emoji: "🎁", category: "Overlay", driveId: "1LmkXvSl4bfyS9IRHZYAlaRcX14R8Z5YT", tags: ["overlay"] },
      { id: "p2-029", label: "P2 29",  emoji: "🎁", category: "Overlay", driveId: "1Oq7gSFMkKrKeCA2ZoUYjzIJQSaa0SNj_", tags: ["overlay"] },
      { id: "p2-030", label: "P2 30",  emoji: "🎁", category: "Overlay", driveId: "1RCM000DF6FAMQO94Jt-Zexo2AGaaDtcP", tags: ["overlay"] },
      { id: "p2-031", label: "P2 31",  emoji: "🎁", category: "Overlay", driveId: "1Y3Bri57hyBkBrlmc56urEzpTuIwfjQdD", tags: ["overlay"] },
      { id: "p2-032", label: "P2 32",  emoji: "🎁", category: "Overlay", driveId: "1_e2oP6NWNx5rumI-9laDAH47E-420bfj", tags: ["overlay"] },
      { id: "p2-033", label: "P2 33",  emoji: "🎁", category: "Overlay", driveId: "1l1xLtqDA2oubcuKcWOiooRdNl1J3cZJX", tags: ["overlay"] },
      { id: "p2-034", label: "P2 34",  emoji: "🎁", category: "Overlay", driveId: "1nRB_hgfqUnsnblATK0Dc9hR8BzuWjB0t", tags: ["overlay"] },
      { id: "p2-035", label: "P2 35",  emoji: "🎁", category: "Overlay", driveId: "137d31WN9BRgb1XTlhmkHsjEEYHB3chYn", tags: ["overlay"] },
      { id: "p2-036", label: "P2 36",  emoji: "🎁", category: "Overlay", driveId: "152Tc2MEl4CC2FvnEe7HJFmIVHaTsY8Ax", tags: ["overlay"] },
      { id: "p2-037", label: "P2 37",  emoji: "🎁", category: "Overlay", driveId: "1t9KdX57kQYqQ819PxlpXx_Rypq6iqTfA", tags: ["overlay"] },
      { id: "p2-038", label: "P2 38",  emoji: "🎁", category: "Overlay", driveId: "10c6pyBiy25stNc6z7tpcjCFtUGgDpGuC", tags: ["overlay"] },
      { id: "p2-039", label: "P2 39",  emoji: "🎁", category: "Overlay", driveId: "1MEqvbvkjDgAmRxFVmfQ_WriOZ-F4KUup", tags: ["overlay"] },
      { id: "p2-040", label: "P2 40",  emoji: "🎁", category: "Overlay", driveId: "1dUceoMV9rO1mOSLehXFKeNjmoDhGvxNt", tags: ["overlay"] },
      { id: "p2-041", label: "P2 41",  emoji: "🎁", category: "Overlay", driveId: "1BizXUDjgTmctzhhoivIRuEgKoaHjF07P", tags: ["overlay"] },
      { id: "p2-042", label: "P2 42",  emoji: "🎁", category: "Overlay", driveId: "1zB2xu5KJEps18DHNs8op6408EVulJvmX", tags: ["overlay"] },
      { id: "p2-043", label: "P2 43",  emoji: "🎁", category: "Overlay", driveId: "1SnRMBG9eg6WR0yoHxKY-EEt6k_gVz_AX", tags: ["overlay"] },
      { id: "p2-044", label: "P2 44",  emoji: "🎁", category: "Overlay", driveId: "1ksySD91c9FuDxjSdSFKhEfiTXXjaPQsE", tags: ["overlay"] },
      { id: "p2-045", label: "P2 45",  emoji: "🎁", category: "Overlay", driveId: "1cvZUqlSq4gS86D99qOV0W55SnjnpBCoL", tags: ["overlay"] },
      { id: "p2-046", label: "P2 46",  emoji: "🎁", category: "Overlay", driveId: "1GB-0ePvTiw9aEahrgBv9b80Huja7eGgm", tags: ["overlay"] },
      { id: "p2-047", label: "P2 47",  emoji: "🎁", category: "Overlay", driveId: "1kBSLeVgslbEx9MdEaT1zczofkIduGwc3", tags: ["overlay"] },
      { id: "p2-048", label: "P2 48",  emoji: "🎁", category: "Overlay", driveId: "1P-22WAUvIm47sDW9iuqaveCirf260bix", tags: ["overlay"] },
      { id: "p2-049", label: "P2 49",  emoji: "🎁", category: "Overlay", driveId: "1SueV-fXXKEuO_dhy7oHjAYNVlH0i7NQ6", tags: ["overlay"] },
      { id: "p2-050", label: "P2 50",  emoji: "🎁", category: "Overlay", driveId: "14xh5wXra9w1HSIhRePggviAixdAKmjZo", tags: ["overlay"] },
      { id: "p2-051", label: "P2 51",  emoji: "🎁", category: "Overlay", driveId: "1NOm0fauahg7vkX2DjoQzafMGL10CnUbn", tags: ["overlay"] },
      { id: "p2-052", label: "P2 52",  emoji: "🎁", category: "Overlay", driveId: "1UM4bmPqhXT98wZTee-_pf3qdiabbs9gU", tags: ["overlay"] },
      { id: "p2-053", label: "P2 53",  emoji: "🎁", category: "Overlay", driveId: "1IGjb4mnBjYCF7zlpleJMtKbQUm15GRCM", tags: ["overlay"] },
      { id: "p2-054", label: "P2 54",  emoji: "🎁", category: "Overlay", driveId: "1Txgzc8brlS0Xq18k6GULO4dUP9P4oS-I", tags: ["overlay"] },
      { id: "p2-055", label: "P2 55",  emoji: "🎁", category: "Overlay", driveId: "1C-69H536I8UWO4ouPvbAZXOyIgMyyz-Q", tags: ["overlay"] },
      { id: "p2-056", label: "P2 56",  emoji: "🎁", category: "Overlay", driveId: "1gsUmpWrGh2q2bWWqpXS-igxEGH5KRYF6", tags: ["overlay"] },
      { id: "p2-057", label: "P2 57",  emoji: "🎁", category: "Overlay", driveId: "1TrIZsq1sb8R4ywcrMttMxN0yLjfBgCuz", tags: ["overlay"] },
      { id: "p2-058", label: "P2 58",  emoji: "🎁", category: "Overlay", driveId: "1aNPg_-WaMy0t570ipr1K6qbK_tvYtNoX", tags: ["overlay"] },
      { id: "p2-059", label: "P2 59",  emoji: "🎁", category: "Overlay", driveId: "1a6V5Y4SBzRYcsgjznh4tRE6t1kMNMDlS", tags: ["overlay"] },
      { id: "p2-060", label: "P2 60",  emoji: "🎁", category: "Overlay", driveId: "1nV0pBBhSV033cPIyOhZ0vdiKuBviWLJ3", tags: ["overlay"] },
      { id: "p2-061", label: "P2 61",  emoji: "🎁", category: "Overlay", driveId: "1aej4iczKq5bBEIXnAd65WGMpwQWWbZ5y", tags: ["overlay"] },
      { id: "p2-062", label: "P2 62",  emoji: "🎁", category: "Overlay", driveId: "1x4cWG4zpj1Psqn7XS22AmX1PIMPWTEg9", tags: ["overlay"] },
      { id: "p2-063", label: "P2 63",  emoji: "🎁", category: "Overlay", driveId: "1rMcrDHBZuVEaUWjzcaKFdLIEESz-6cd7", tags: ["overlay"] },
      { id: "p2-064", label: "P2 64",  emoji: "🎁", category: "Overlay", driveId: "1IPiob3LjsUTe6AXpVMXcdG7slF_glSrE", tags: ["overlay"] },
      { id: "p2-065", label: "P2 65",  emoji: "🎁", category: "Overlay", driveId: "17zPgZxfe6fvI9dThukwg0BkW9D9Ay9Ga", tags: ["overlay"] },
      { id: "p2-066", label: "P2 66",  emoji: "🎁", category: "Overlay", driveId: "1NqelmwoynzmqD36bRPDJ7UNK3aHUZEHB", tags: ["overlay"] },
      { id: "p2-067", label: "P2 67",  emoji: "🎁", category: "Overlay", driveId: "189mTg452iCW3XQ_s_n3XVJyqc6zsyLpj", tags: ["overlay"] },
      { id: "p2-068", label: "P2 68",  emoji: "🎁", category: "Overlay", driveId: "1E6LYw0gl09LL502rZ0olbBITmtNGfGkY", tags: ["overlay"] },
      { id: "p2-069", label: "P2 69",  emoji: "🎁", category: "Overlay", driveId: "1OZiez1LKweEF7VIkcb9BXUo1YIYVKUrT", tags: ["overlay"] },
      { id: "p2-070", label: "P2 70",  emoji: "🎁", category: "Overlay", driveId: "1VcLvqn9FpDYv8LwrOV5d_rNMb6pjdYak", tags: ["overlay"] },
      { id: "p2-071", label: "P2 71",  emoji: "🎁", category: "Overlay", driveId: "1Xes4tuX5bEimIwna12JBVW-DiszMduvQ", tags: ["overlay"] },
      { id: "p2-072", label: "P2 72",  emoji: "🎁", category: "Overlay", driveId: "1aoRko1LQ9fcDt0CXBbew-fVZJ0OhNQlx", tags: ["overlay"] },
      { id: "p2-073", label: "P2 73",  emoji: "🎁", category: "Overlay", driveId: "1pJcqAE74GrK027E8LEfFInB2RnUF2mLf", tags: ["overlay"] },
      { id: "p2-074", label: "P2 74",  emoji: "🎁", category: "Overlay", driveId: "1-AQNcido_c3bJc4ptkHVLuc9Nl1SziIA", tags: ["overlay"] },
      { id: "p2-075", label: "P2 75",  emoji: "🎁", category: "Overlay", driveId: "1XGBtYE1Z2DypkLld-b8ok8Pbm5n5MuKW", tags: ["overlay"] },
      { id: "p2-076", label: "P2 76",  emoji: "🎁", category: "Overlay", driveId: "1vPo_qHX0NK2gazbjjAoPlAryXadxoMXL", tags: ["overlay"] },
      { id: "p2-077", label: "P2 77",  emoji: "🎁", category: "Overlay", driveId: "1rlg7HwM55UhVnF5JDW9qinJsjbu2_IDr", tags: ["overlay"] },
      { id: "p2-078", label: "P2 78",  emoji: "🎁", category: "Overlay", driveId: "1FUwdV4efq9CoC2rKSWnBIA2mx1r_Apiq", tags: ["overlay"] },
      { id: "p2-079", label: "P2 79",  emoji: "🎁", category: "Overlay", driveId: "1qzfJcthMW__nY3Khbxo-8uGE9S-gVDma", tags: ["overlay"] },
      { id: "p2-080", label: "P2 80",  emoji: "🎁", category: "Overlay", driveId: "1RBD9-PSDCkwOkNXoZTSE_Dxt95v3HW5u", tags: ["overlay"] },
      { id: "p2-081", label: "P2 81",  emoji: "🎁", category: "Overlay", driveId: "17-gD9R9Yrc94kj7sWf18aztBcoMxJCmy", tags: ["overlay"] },
      { id: "p2-082", label: "P2 82",  emoji: "🎁", category: "Overlay", driveId: "14DG1lZ5RZB1SGgJokWSMRIF-uHkWh7jm", tags: ["overlay"] },
      { id: "p2-083", label: "P2 83",  emoji: "🎁", category: "Overlay", driveId: "1ic89D9-Tr3TS70EbgCcblSt_Z8yAYSXd", tags: ["overlay"] },
      { id: "p2-084", label: "P2 84",  emoji: "🎁", category: "Overlay", driveId: "1AH3FzFwHG2z_ml1xju-D77yFXGPLTmzE", tags: ["overlay"] },
      { id: "p2-085", label: "P2 85",  emoji: "🎁", category: "Overlay", driveId: "1vrvymqzIgdzAU7RSJelJ7C8suu57qSuc", tags: ["overlay"] },
      { id: "p2-086", label: "P2 86",  emoji: "🎁", category: "Overlay", driveId: "17Ue9gKne1RcgxlBgL7f6SjBWIAwdF3z2", tags: ["overlay"] },
      { id: "p2-087", label: "P2 87",  emoji: "🎁", category: "Overlay", driveId: "1-bI_SgFTraiCbfi6nF54wbGsGNF8l4G8", tags: ["overlay"] },
      { id: "p2-088", label: "P2 88",  emoji: "🎁", category: "Overlay", driveId: "1Qlb7FI2FL2rnUdian_UU8PHHbI5xNF9A", tags: ["overlay"] },
      { id: "p2-089", label: "P2 89",  emoji: "🎁", category: "Overlay", driveId: "1EKL024cIWyNux20IXMGjy_-7K2jFsPBs", tags: ["overlay"] },
      { id: "p2-090", label: "P2 90",  emoji: "🎁", category: "Overlay", driveId: "13K05oBIxKOx5Y6tavbq4Sc1oxCZC2IiQ", tags: ["overlay"] },
      { id: "p2-091", label: "P2 91",  emoji: "🎁", category: "Overlay", driveId: "17zajXor4po1521L1W72LtikQTPH-EYFF", tags: ["overlay"] },
      { id: "p2-092", label: "P2 92",  emoji: "🎁", category: "Overlay", driveId: "1tE6SJCmlWX20ewwmRc_6_7oHRoy2B3Od", tags: ["overlay"] },
      { id: "p2-093", label: "P2 93",  emoji: "🎁", category: "Overlay", driveId: "1bV0vYCq3Eo6uHLqkPvyxp4-_7gt3crmw", tags: ["overlay"] },
      { id: "p2-094", label: "P2 94",  emoji: "🎁", category: "Overlay", driveId: "1TOom-rRGcS3adPYXb8-yCTdiqZFRwJiC", tags: ["overlay"] },
      { id: "p2-095", label: "P2 95",  emoji: "🎁", category: "Overlay", driveId: "1r-jEkdkGiuSif-0zKNhAgkBOBhnDJzka", tags: ["overlay"] },
      { id: "p2-096", label: "P2 96",  emoji: "🎁", category: "Overlay", driveId: "10OhwaDVC4yfVTCSHVDywe8lMHI_Xo2tB", tags: ["overlay"] },
      { id: "p2-097", label: "P2 97",  emoji: "🎁", category: "Overlay", driveId: "19XlKIZPHKL2xxczzb6v6YhpOTE76njXn", tags: ["overlay"] },
      { id: "p2-098", label: "P2 98",  emoji: "🎁", category: "Overlay", driveId: "1FuZ7NDkiXYZrfLEl8DxK1DgChVmKgfrC", tags: ["overlay"] },
      { id: "p2-099", label: "P2 99",  emoji: "🎁", category: "Overlay", driveId: "1GumYDa1ev_g2DhDd1JmUNDxM2moKcLKY", tags: ["overlay"] },
      { id: "p2-100", label: "P2 100", emoji: "🎁", category: "Overlay", driveId: "1JBtY4OgHhJij5Svo9P1uUqvZBqfK_2Il", tags: ["overlay"] },
    ],
  },
  {
    id: "pacote-3",
    label: "Pacote 3",
    emoji: "🎁",
    assets: [
      { id: "p3-001", label: "P3 1",   emoji: "🎁", category: "Overlay", driveId: "1MM3hSqqMyUMJS5kCWbWua-dPTroV1Ggp", tags: ["overlay"] },
      { id: "p3-002", label: "P3 2",   emoji: "🎁", category: "Overlay", driveId: "1Z90A1thPzAQDvaVhdRiB42aQfN5t-3Mh", tags: ["overlay"] },
      { id: "p3-003", label: "P3 3",   emoji: "🎁", category: "Overlay", driveId: "1yTw3J-v-MloaqLYl2TOK96t04lGg8ViJ", tags: ["overlay"] },
      { id: "p3-004", label: "P3 4",   emoji: "🎁", category: "Overlay", driveId: "1WTTXZrCeMRgsX8vBwz7jcsk83A547pex", tags: ["overlay"] },
      { id: "p3-005", label: "P3 5",   emoji: "🎁", category: "Overlay", driveId: "1eYts4jOy9NGSYXmRjMh6RCjVOz4D7qKG", tags: ["overlay"] },
      { id: "p3-006", label: "P3 6",   emoji: "🎁", category: "Overlay", driveId: "1JkrH-iUVjJ8RfKgf6plv4d-e1pVthIRf", tags: ["overlay"] },
      { id: "p3-007", label: "P3 7",   emoji: "🎁", category: "Overlay", driveId: "1-fTjrWwh1alQdZPAuF77x1gIoVdNZRPl", tags: ["overlay"] },
      { id: "p3-008", label: "P3 8",   emoji: "🎁", category: "Overlay", driveId: "1pcIRUethF_dFBdnq5T_EDg6wyP0SY_r0", tags: ["overlay"] },
      { id: "p3-009", label: "P3 9",   emoji: "🎁", category: "Overlay", driveId: "1M4-mTNV9IC-R1dL-6DelQzDMTSolV-p4", tags: ["overlay"] },
      { id: "p3-010", label: "P3 10",  emoji: "🎁", category: "Overlay", driveId: "1Ewvel8Wq29uASWyOtNlp3p8Yn5MlP16L", tags: ["overlay"] },
      { id: "p3-011", label: "P3 11",  emoji: "🎁", category: "Overlay", driveId: "1T8HbbhlmQH03sSV_sciGmYfx4RRmzsDy", tags: ["overlay"] },
      { id: "p3-012", label: "P3 12",  emoji: "🎁", category: "Overlay", driveId: "1PrgGfn8G-ynfBCFnKjKyKziO-fhrt-UD", tags: ["overlay"] },
      { id: "p3-013", label: "P3 13",  emoji: "🎁", category: "Overlay", driveId: "1vTt-DKpz7p0T1d5qEHrulivaz31sOema", tags: ["overlay"] },
      { id: "p3-014", label: "P3 14",  emoji: "🎁", category: "Overlay", driveId: "1H4_ZNEr3a3A_DMfiM5InMTKNbDXKxsCy", tags: ["overlay"] },
      { id: "p3-015", label: "P3 15",  emoji: "🎁", category: "Overlay", driveId: "1yO6WeJ_lZs5ISYvxeOYCtocFmHt2ppCa", tags: ["overlay"] },
      { id: "p3-016", label: "P3 16",  emoji: "🎁", category: "Overlay", driveId: "1wJJFsZR0Q_c4SQtfgFWi9q8LdJMsfk4W", tags: ["overlay"] },
      { id: "p3-017", label: "P3 17",  emoji: "🎁", category: "Overlay", driveId: "1WIf4YXn11CfyL_ePPO-rk-0y34bn8Y0_", tags: ["overlay"] },
      { id: "p3-018", label: "P3 18",  emoji: "🎁", category: "Overlay", driveId: "1zhJ4Qtl4jxINpCbz00ijvYxjkPYettxH", tags: ["overlay"] },
      { id: "p3-019", label: "P3 19",  emoji: "🎁", category: "Overlay", driveId: "1iFe0yyr_83KHCeLWXt-cfSzAP6Z6W8JB", tags: ["overlay"] },
      { id: "p3-020", label: "P3 20",  emoji: "🎁", category: "Overlay", driveId: "1BTBlg5JCWigcPrJ89Xcadm3nP2Dl0tLY", tags: ["overlay"] },
      { id: "p3-021", label: "P3 21",  emoji: "🎁", category: "Overlay", driveId: "1yUNwpjBF6KehzCd38wBwKWvzL8k9s_mE", tags: ["overlay"] },
      { id: "p3-022", label: "P3 22",  emoji: "🎁", category: "Overlay", driveId: "1NpVNKarMN-LP-OQ8bv9YG1XCAPLd4IZz", tags: ["overlay"] },
      { id: "p3-023", label: "P3 23",  emoji: "🎁", category: "Overlay", driveId: "1gQeeaqMQFgQf75GgKSYAE5tfCc4UHaPj", tags: ["overlay"] },
      { id: "p3-024", label: "P3 24",  emoji: "🎁", category: "Overlay", driveId: "1AIF4Qyx5LkffctiKC-OE1ZzdndIMEVYU", tags: ["overlay"] },
      { id: "p3-025", label: "P3 25",  emoji: "🎁", category: "Overlay", driveId: "17ZGaIwAC36Sf6w1odlB3ErE-PaJd4W4p", tags: ["overlay"] },
      { id: "p3-026", label: "P3 26",  emoji: "🎁", category: "Overlay", driveId: "1eJkUtFO9SRYFV2nzKMHHPThpqlvQYtZe", tags: ["overlay"] },
      { id: "p3-027", label: "P3 27",  emoji: "🎁", category: "Overlay", driveId: "1RaxhSsGfZQ63WSC9kyOF-jLs9ffqtJC8", tags: ["overlay"] },
      { id: "p3-028", label: "P3 28",  emoji: "🎁", category: "Overlay", driveId: "1Qps-yDl-JDVLSX5Zd805__tEYTduV9lL", tags: ["overlay"] },
      { id: "p3-029", label: "P3 29",  emoji: "🎁", category: "Overlay", driveId: "1qsWAy23G_ShnlM9LlrNe0BlEgwpMvcZR", tags: ["overlay"] },
      { id: "p3-030", label: "P3 30",  emoji: "🎁", category: "Overlay", driveId: "141xdfE1-sObo29xnF1ycgHToMK8SNTLT", tags: ["overlay"] },
      { id: "p3-031", label: "P3 31",  emoji: "🎁", category: "Overlay", driveId: "1v-0efsuKxaOXwIjR4NQYMe9tXrjQ3z65", tags: ["overlay"] },
      { id: "p3-032", label: "P3 32",  emoji: "🎁", category: "Overlay", driveId: "1XHHG8NQIWRbZmMxpVqA7qgp7X8Wjz3bH", tags: ["overlay"] },
      { id: "p3-033", label: "P3 33",  emoji: "🎁", category: "Overlay", driveId: "1-lKDmRe0bUiY_4KeXABcLOpfe2JHB87F", tags: ["overlay"] },
      { id: "p3-034", label: "P3 34",  emoji: "🎁", category: "Overlay", driveId: "1D1cXprmRTTCQQU9n7UBOU0CwO5qZQN3S", tags: ["overlay"] },
      { id: "p3-035", label: "P3 35",  emoji: "🎁", category: "Overlay", driveId: "1E40_OcIy1CA3M524dY5MZzgBV8nXCW2B", tags: ["overlay"] },
      { id: "p3-036", label: "P3 36",  emoji: "🎁", category: "Overlay", driveId: "1G4_qWNLz-0VmgwX0W1fZ6j6hK9vqfAGL", tags: ["overlay"] },
      { id: "p3-037", label: "P3 37",  emoji: "🎁", category: "Overlay", driveId: "1LfrS-nMuHByRtIxmW7zP0Q5bU-8sn8Fs", tags: ["overlay"] },
      { id: "p3-038", label: "P3 38",  emoji: "🎁", category: "Overlay", driveId: "1vvt1vDzNAMNw1hJ3llO0ehIBE6-JKFRX", tags: ["overlay"] },
      { id: "p3-039", label: "P3 39",  emoji: "🎁", category: "Overlay", driveId: "1eqUEOB8U3vt2plnRSwmeN4py4b0zldkQ", tags: ["overlay"] },
      { id: "p3-040", label: "P3 40",  emoji: "🎁", category: "Overlay", driveId: "1qQhWrMTTZmcrlkaceoTzXXKjpi65is3f", tags: ["overlay"] },
      { id: "p3-041", label: "P3 41",  emoji: "🎁", category: "Overlay", driveId: "1BavqC_EG50III6EwjPtjO5VVoAzlHhBU", tags: ["overlay"] },
      { id: "p3-042", label: "P3 42",  emoji: "🎁", category: "Overlay", driveId: "1VQjo8j3DImMwKX5x5MujxzQffRcXaWpU", tags: ["overlay"] },
      { id: "p3-043", label: "P3 43",  emoji: "🎁", category: "Overlay", driveId: "184EsvMh-C8ope5PzYMfam8d8ZSN6OJ9V", tags: ["overlay"] },
      { id: "p3-044", label: "P3 44",  emoji: "🎁", category: "Overlay", driveId: "1upqbl63ErQPomH9KGWiVYWTVN5Gcad90", tags: ["overlay"] },
      { id: "p3-045", label: "P3 45",  emoji: "🎁", category: "Overlay", driveId: "1gJDBy0R4eZ_ZzQXA2_sw9tSIY6O3dK8w", tags: ["overlay"] },
      { id: "p3-046", label: "P3 46",  emoji: "🎁", category: "Overlay", driveId: "1fOPRw5ge42F70joveHhff36Syx8EFEiE", tags: ["overlay"] },
      { id: "p3-047", label: "P3 47",  emoji: "🎁", category: "Overlay", driveId: "1_ZqZ_fZ2GhSTIgsioNN5WpJ6tt8WSKXm", tags: ["overlay"] },
      { id: "p3-048", label: "P3 48",  emoji: "🎁", category: "Overlay", driveId: "1QFMdd5zy8DakEOe1Mlh9oa6WwLQtCohn", tags: ["overlay"] },
      { id: "p3-049", label: "P3 49",  emoji: "🎁", category: "Overlay", driveId: "1T_jQjHzGrQ4ryVZ_op-3R5qbQ_KWG5Mk", tags: ["overlay"] },
      { id: "p3-050", label: "P3 50",  emoji: "🎁", category: "Overlay", driveId: "1umFfeGf_hkECNt-55ZZBIuILM1IUrvnk", tags: ["overlay"] },
      { id: "p3-051", label: "P3 51",  emoji: "🎁", category: "Overlay", driveId: "1o_hYPriODINkeq172u01ODh_AgPiand4", tags: ["overlay"] },
      { id: "p3-052", label: "P3 52",  emoji: "🎁", category: "Overlay", driveId: "129RvOqbmlXN67qnjzMjolX3ubEYxIMFB", tags: ["overlay"] },
      { id: "p3-053", label: "P3 53",  emoji: "🎁", category: "Overlay", driveId: "1Vf1DvDj6wAzkuUd01ydfDHSbuCMxuR_K", tags: ["overlay"] },
      { id: "p3-054", label: "P3 54",  emoji: "🎁", category: "Overlay", driveId: "1cOJ6CY2iWO86aVVv-32QgdABu_gBGFU3", tags: ["overlay"] },
      { id: "p3-055", label: "P3 55",  emoji: "🎁", category: "Overlay", driveId: "1K16ecWTGhpKlkhGyTqIcjlZScQZoSzti", tags: ["overlay"] },
      { id: "p3-056", label: "P3 56",  emoji: "🎁", category: "Overlay", driveId: "1z91lLCF5rT1NakEUcJGWow-NG8QjUs4F", tags: ["overlay"] },
      { id: "p3-057", label: "P3 57",  emoji: "🎁", category: "Overlay", driveId: "1Paa7EmGF9eW3IRHepkHyzcjfyM7wv4YW", tags: ["overlay"] },
      { id: "p3-058", label: "P3 58",  emoji: "🎁", category: "Overlay", driveId: "19DbRXyM7yCvHTTZlTThRWeo4kif-uwHR", tags: ["overlay"] },
      { id: "p3-059", label: "P3 59",  emoji: "🎁", category: "Overlay", driveId: "1u_TyQwzqYSiU4cgrBO8-oHZiWaR9Z7-q", tags: ["overlay"] },
      { id: "p3-060", label: "P3 60",  emoji: "🎁", category: "Overlay", driveId: "137kV0Qf_sMM9YTKKHvLU2UuHFBRVm4Sh", tags: ["overlay"] },
      { id: "p3-061", label: "P3 61",  emoji: "🎁", category: "Overlay", driveId: "1zOcU5DKEis69591kZEBjgY1-6onvspJq", tags: ["overlay"] },
      { id: "p3-062", label: "P3 62",  emoji: "🎁", category: "Overlay", driveId: "1C7b_ALSldp2efPHtuuMvI_G9G8a8T4Ap", tags: ["overlay"] },
      { id: "p3-063", label: "P3 63",  emoji: "🎁", category: "Overlay", driveId: "1eGtK9hTj2ABFNcJJHNuR-1J9oWvxW23d", tags: ["overlay"] },
      { id: "p3-064", label: "P3 64",  emoji: "🎁", category: "Overlay", driveId: "1KdA3D-kg0mDMcm8Nfc2fKAW45vAPIJLi", tags: ["overlay"] },
      { id: "p3-065", label: "P3 65",  emoji: "🎁", category: "Overlay", driveId: "1K2fX-qtRl_RlAl_jxNZHz9NtDsf-x5W-", tags: ["overlay"] },
      { id: "p3-066", label: "P3 66",  emoji: "🎁", category: "Overlay", driveId: "1a962Yt9M8iH8QvnOImwwxsx8p-dQhWMj", tags: ["overlay"] },
      { id: "p3-067", label: "P3 67",  emoji: "🎁", category: "Overlay", driveId: "1Qw0fkDNsrVJGnvXEatFqOsdrodojBFYq", tags: ["overlay"] },
      { id: "p3-068", label: "P3 68",  emoji: "🎁", category: "Overlay", driveId: "1DyspPApRo-4n87PSJ1uXF9BxIfbTv6OE", tags: ["overlay"] },
      { id: "p3-069", label: "P3 69",  emoji: "🎁", category: "Overlay", driveId: "1sGX4GunZDYrsf7n6YeZKmKVq_QpFB_xX", tags: ["overlay"] },
      { id: "p3-070", label: "P3 70",  emoji: "🎁", category: "Overlay", driveId: "1oM4d4fEOECa0TiLUDfHWVi26sP8u58vr", tags: ["overlay"] },
      { id: "p3-071", label: "P3 71",  emoji: "🎁", category: "Overlay", driveId: "1gKSPQu3aktmymlzlqRw8LQrsWvO3cigL", tags: ["overlay"] },
      { id: "p3-072", label: "P3 72",  emoji: "🎁", category: "Overlay", driveId: "1YNMj-CoN1YJ4FYEeni0naqZf8cFCgpal", tags: ["overlay"] },
      { id: "p3-073", label: "P3 73",  emoji: "🎁", category: "Overlay", driveId: "1rVTpFRWHwAo-_mlRoXoSFX1i-7j9GnWm", tags: ["overlay"] },
      { id: "p3-074", label: "P3 74",  emoji: "🎁", category: "Overlay", driveId: "18wGv4K2ycdg0XsCTn5H_ma97oufYYu4v", tags: ["overlay"] },
      { id: "p3-075", label: "P3 75",  emoji: "🎁", category: "Overlay", driveId: "1Z29LAQtCa3NIYyxGiXCX6ojX6zoYouNI", tags: ["overlay"] },
      { id: "p3-076", label: "P3 76",  emoji: "🎁", category: "Overlay", driveId: "1evlkmAWjdXz4pYCy9NPxGALaZVYaPEy-", tags: ["overlay"] },
      { id: "p3-077", label: "P3 77",  emoji: "🎁", category: "Overlay", driveId: "1rtYZAtUoxRoJM9mpK4_JZj3Ol8rk573w", tags: ["overlay"] },
      { id: "p3-078", label: "P3 78",  emoji: "🎁", category: "Overlay", driveId: "1ptNSoJFSBS3kDGslsfMIibQxAG5oHnuy", tags: ["overlay"] },
      { id: "p3-079", label: "P3 79",  emoji: "🎁", category: "Overlay", driveId: "1okithaV68BIUJluqQqTLLI_xzYXiym_m", tags: ["overlay"] },
      { id: "p3-080", label: "P3 80",  emoji: "🎁", category: "Overlay", driveId: "1O6tr2x3k4HcZ7me-3SEHtubWPi3w5zdZ", tags: ["overlay"] },
      { id: "p3-081", label: "P3 81",  emoji: "🎁", category: "Overlay", driveId: "1TWFmuzyBkyjTLSY-tU60vymLwwxaWSZQ", tags: ["overlay"] },
      { id: "p3-082", label: "P3 82",  emoji: "🎁", category: "Overlay", driveId: "17BwZIk-A-FYWOoi1HdOsJtKCBIMKnLlA", tags: ["overlay"] },
      { id: "p3-083", label: "P3 83",  emoji: "🎁", category: "Overlay", driveId: "1eCx6IcK-xDaJJHiPC-5twshNzmkOhoZr", tags: ["overlay"] },
      { id: "p3-084", label: "P3 84",  emoji: "🎁", category: "Overlay", driveId: "1-wAmVkZZSHJcFbEal_IKQNNXmuZ59fPJ", tags: ["overlay"] },
      { id: "p3-085", label: "P3 85",  emoji: "🎁", category: "Overlay", driveId: "1s9fE3aWJTCioAo6adCb801FS8PhFmWw1", tags: ["overlay"] },
      { id: "p3-086", label: "P3 86",  emoji: "🎁", category: "Overlay", driveId: "1A-_2ATWp-I39FbhQR0Pnuyjrbw96IloG", tags: ["overlay"] },
      { id: "p3-087", label: "P3 87",  emoji: "🎁", category: "Overlay", driveId: "1acfefT2d7tgb9Ce92lSaIQn-ptlntCrJ", tags: ["overlay"] },
      { id: "p3-088", label: "P3 88",  emoji: "🎁", category: "Overlay", driveId: "1jauQRKnJA8UU9GQ93X4qLcDcXrhi3oYk", tags: ["overlay"] },
      { id: "p3-089", label: "P3 89",  emoji: "🎁", category: "Overlay", driveId: "1D6wt787oeJoBo9c5Qg0JPm5xpbjGH2w6", tags: ["overlay"] },
      { id: "p3-090", label: "P3 90",  emoji: "🎁", category: "Overlay", driveId: "1dspj_xh361l_xMRJ05nSWftbgm3SFUiH", tags: ["overlay"] },
      { id: "p3-091", label: "P3 91",  emoji: "🎁", category: "Overlay", driveId: "1f5x7atIRe3Is9MIluzntfpnWYgn8IXjN", tags: ["overlay"] },
      { id: "p3-092", label: "P3 92",  emoji: "🎁", category: "Overlay", driveId: "18TmSHgW3NjKJL4xJc9jI36rH33GK7V5q", tags: ["overlay"] },
      { id: "p3-093", label: "P3 93",  emoji: "🎁", category: "Overlay", driveId: "1xOCW_1PFMy-IynxhgOZ0uCXVIIBj0VP4", tags: ["overlay"] },
      { id: "p3-094", label: "P3 94",  emoji: "🎁", category: "Overlay", driveId: "1zD7zsFBMHOBTp20zVadnaP1MKeeOhepV", tags: ["overlay"] },
      { id: "p3-095", label: "P3 95",  emoji: "🎁", category: "Overlay", driveId: "1UFbEVH1c_LztnGIWl7F1wA6ESfQCJPk3", tags: ["overlay"] },
      { id: "p3-096", label: "P3 96",  emoji: "🎁", category: "Overlay", driveId: "1tY8yanYZc54cAyGZlhdxCtep47-l-r1A", tags: ["overlay"] },
      { id: "p3-097", label: "P3 97",  emoji: "🎁", category: "Overlay", driveId: "1g9itKJ0kCmzwmQ3vYDq1jG_QYdVrdUXm", tags: ["overlay"] },
      { id: "p3-098", label: "P3 98",  emoji: "🎁", category: "Overlay", driveId: "1C4bH2YauHzFovK-20TYlp_zEVFfOdP_Y", tags: ["overlay"] },
      { id: "p3-099", label: "P3 99",  emoji: "🎁", category: "Overlay", driveId: "1MRet3emofgAo4Pu35Fp39DXOZrH9aq2C", tags: ["overlay"] },
      { id: "p3-100", label: "P3 100", emoji: "🎁", category: "Overlay", driveId: "13ItLdx-eWcFzGsF6--BzWpcKJa5YghDA", tags: ["overlay"] },
    ],
  },
  {
    id: "pacote-4",
    label: "Pacote 4",
    emoji: "🎁",
    assets: [
      { id: "p4-001", label: "P4 1",   emoji: "🎁", category: "Overlay", driveId: "1HDPI-NAonG5MT1KScJWIAKT5mVY7hOfR", tags: ["overlay"] },
      { id: "p4-002", label: "P4 2",   emoji: "🎁", category: "Overlay", driveId: "1TwtuLaM3acL2zxWzGKkRQ01C7iZ6rklD", tags: ["overlay"] },
      { id: "p4-003", label: "P4 3",   emoji: "🎁", category: "Overlay", driveId: "1sHRkU3htsRZaEm8fmABpHsetzR9sIYQa", tags: ["overlay"] },
      { id: "p4-004", label: "P4 4",   emoji: "🎁", category: "Overlay", driveId: "1q59cwYbn1PF92bmRgripppbzdhFVIwKT", tags: ["overlay"] },
      { id: "p4-005", label: "P4 5",   emoji: "🎁", category: "Overlay", driveId: "1PpvVqY4Jt0xHvL-SdyvzRsPIoE8B_DYh", tags: ["overlay"] },
      { id: "p4-006", label: "P4 6",   emoji: "🎁", category: "Overlay", driveId: "1xVqdrxgm4sv6rpCtodqjOBrKuyBzaE83", tags: ["overlay"] },
      { id: "p4-007", label: "P4 7",   emoji: "🎁", category: "Overlay", driveId: "1OvStAS1WliuGURAjXgeLItiLFW7JO1mn", tags: ["overlay"] },
      { id: "p4-008", label: "P4 8",   emoji: "🎁", category: "Overlay", driveId: "1YZdcvkMcCADMnerXD32zo3kX-C7zOjWl", tags: ["overlay"] },
      { id: "p4-009", label: "P4 9",   emoji: "🎁", category: "Overlay", driveId: "1rq7bUnAc_M5girPKvJpWAFwTUQBxltlP", tags: ["overlay"] },
      { id: "p4-010", label: "P4 10",  emoji: "🎁", category: "Overlay", driveId: "1A5x1881Xrh0loJJmmSFSBVCXTdPsun9u", tags: ["overlay"] },
      { id: "p4-011", label: "P4 11",  emoji: "🎁", category: "Overlay", driveId: "1AmOn0zFWn6R5GQOpSrYhc_njDPdiOeK9", tags: ["overlay"] },
      { id: "p4-012", label: "P4 12",  emoji: "🎁", category: "Overlay", driveId: "15ngdkgak9emAcQA2Si471f8TdGGtpgLj", tags: ["overlay"] },
      { id: "p4-013", label: "P4 13",  emoji: "🎁", category: "Overlay", driveId: "1ygoTYLy1Ycz0F-x24rmEj0yVnvuvNREH", tags: ["overlay"] },
      { id: "p4-014", label: "P4 14",  emoji: "🎁", category: "Overlay", driveId: "1XEz06A9TYf0QFTzCasadjCDJIEni9pjk", tags: ["overlay"] },
      { id: "p4-015", label: "P4 15",  emoji: "🎁", category: "Overlay", driveId: "1h1sqcrs0AJHW0P7LzjpS_Rprl79-9_As", tags: ["overlay"] },
      { id: "p4-016", label: "P4 16",  emoji: "🎁", category: "Overlay", driveId: "1__IZUC0uutblwdgCOGgg1veBOZMEE_eg", tags: ["overlay"] },
      { id: "p4-017", label: "P4 17",  emoji: "🎁", category: "Overlay", driveId: "1emGki_qFX4xVkYHMhDNX9IVm6XeuzWIh", tags: ["overlay"] },
      { id: "p4-018", label: "P4 18",  emoji: "🎁", category: "Overlay", driveId: "1Umq0YNbopRSBkoanypcPQYi694jrmxoK", tags: ["overlay"] },
      { id: "p4-019", label: "P4 19",  emoji: "🎁", category: "Overlay", driveId: "1MDMz3KSFpEEWGrmHoTB3YD3wokycrAY9", tags: ["overlay"] },
      { id: "p4-020", label: "P4 20",  emoji: "🎁", category: "Overlay", driveId: "1Ossig11GT57rUD2i--NRP41PYAzw4_Op", tags: ["overlay"] },
      { id: "p4-021", label: "P4 21",  emoji: "🎁", category: "Overlay", driveId: "1vzzfUY97jXefZT3m82698tG05vRerEBe", tags: ["overlay"] },
      { id: "p4-022", label: "P4 22",  emoji: "🎁", category: "Overlay", driveId: "1R4OhUZjmyZEI_JMjE0vsC0cTi9jyw6T9", tags: ["overlay"] },
      { id: "p4-023", label: "P4 23",  emoji: "🎁", category: "Overlay", driveId: "1Hn3FXQIKsHEivrWTSMwBgSL3WCRVAThy", tags: ["overlay"] },
      { id: "p4-024", label: "P4 24",  emoji: "🎁", category: "Overlay", driveId: "1iHkaC8oDGnRR5zT19sFBfDeLHK4w2Zy6", tags: ["overlay"] },
      { id: "p4-025", label: "P4 25",  emoji: "🎁", category: "Overlay", driveId: "1UDpNB4ZriEUKVNpGIL3_EvR77TjOVcmJ", tags: ["overlay"] },
      { id: "p4-026", label: "P4 26",  emoji: "🎁", category: "Overlay", driveId: "1VVphea79w2z7M5B-0UVUKREKkv83pr_2", tags: ["overlay"] },
      { id: "p4-027", label: "P4 27",  emoji: "🎁", category: "Overlay", driveId: "1RQpIWdAUJknMiA3eMT5dZXe8Zx7xItDe", tags: ["overlay"] },
      { id: "p4-028", label: "P4 28",  emoji: "🎁", category: "Overlay", driveId: "1wXLxa1v66ImKfMOuOitTfujqr2pFQn3m", tags: ["overlay"] },
      { id: "p4-029", label: "P4 29",  emoji: "🎁", category: "Overlay", driveId: "1ZwD98TLlKVTMJclfyVZBuNRJ76txTSJS", tags: ["overlay"] },
      { id: "p4-030", label: "P4 30",  emoji: "🎁", category: "Overlay", driveId: "1kuCE2oDF_aKava9nzx7wxDu1xiykJ7FG", tags: ["overlay"] },
      { id: "p4-031", label: "P4 31",  emoji: "🎁", category: "Overlay", driveId: "1mdd0mVJZEzeXZ92mDv1aJqrKFnSB9yK0", tags: ["overlay"] },
      { id: "p4-032", label: "P4 32",  emoji: "🎁", category: "Overlay", driveId: "1052sSyQmWCbHFFen6YOqwJq4cqYu-f--", tags: ["overlay"] },
      { id: "p4-033", label: "P4 33",  emoji: "🎁", category: "Overlay", driveId: "14-wfIQnV8_4pbfKNLagyExavQq93lqgR", tags: ["overlay"] },
      { id: "p4-034", label: "P4 34",  emoji: "🎁", category: "Overlay", driveId: "1YNCVZk4sCHemLwc7rwOYCM0CHvXs3LAh", tags: ["overlay"] },
      { id: "p4-035", label: "P4 35",  emoji: "🎁", category: "Overlay", driveId: "1wYzFDD3i0Sc40NSWXaU4WqhwL63iYYTp", tags: ["overlay"] },
      { id: "p4-036", label: "P4 36",  emoji: "🎁", category: "Overlay", driveId: "1HQW1-p5L-NNk0pr3xH9rHtoJR_5v7gE4", tags: ["overlay"] },
      { id: "p4-037", label: "P4 37",  emoji: "🎁", category: "Overlay", driveId: "1HZWJJXZ66nojddHw1e-wPbVRlToJBbqO", tags: ["overlay"] },
      { id: "p4-038", label: "P4 38",  emoji: "🎁", category: "Overlay", driveId: "1Pd1w7Tid5w9CzZJDKquNoWwt2MmJ9sNc", tags: ["overlay"] },
      { id: "p4-039", label: "P4 39",  emoji: "🎁", category: "Overlay", driveId: "17EdAblvOfVVkcNdb4PK6h3RFwmlALcJ7", tags: ["overlay"] },
      { id: "p4-040", label: "P4 40",  emoji: "🎁", category: "Overlay", driveId: "1PtYHdna9qol2OkGxTmT0NAXGo960Ls2k", tags: ["overlay"] },
      { id: "p4-041", label: "P4 41",  emoji: "🎁", category: "Overlay", driveId: "1VKxADsZ5SE7y-nwBxJpiDaNV-98m3BCm", tags: ["overlay"] },
      { id: "p4-042", label: "P4 42",  emoji: "🎁", category: "Overlay", driveId: "1XfG89JPyAxyayQZrkWM9To5F74Ypmueq", tags: ["overlay"] },
      { id: "p4-043", label: "P4 43",  emoji: "🎁", category: "Overlay", driveId: "1-HQ_Vj6NMgGBhJpsuKtsKO-btUFr5Vt9", tags: ["overlay"] },
      { id: "p4-044", label: "P4 44",  emoji: "🎁", category: "Overlay", driveId: "1YfSxdUY6F37hTRiRDs8_uWdVNefN9wf8", tags: ["overlay"] },
      { id: "p4-045", label: "P4 45",  emoji: "🎁", category: "Overlay", driveId: "13qKZ0qKWn06FSrrWjRuIuxp2kI6Db8LJ", tags: ["overlay"] },
      { id: "p4-046", label: "P4 46",  emoji: "🎁", category: "Overlay", driveId: "1aQDVmLGEhw3OIT2e0YXWw7QZ0NlwqjCs", tags: ["overlay"] },
      { id: "p4-047", label: "P4 47",  emoji: "🎁", category: "Overlay", driveId: "1I87JPhgT6HE01bsehA7aakXu0Pz9iRto", tags: ["overlay"] },
      { id: "p4-048", label: "P4 48",  emoji: "🎁", category: "Overlay", driveId: "1-Fv3js0mIo_sjoH2I-jI-VC3dhhuWv9-", tags: ["overlay"] },
      { id: "p4-049", label: "P4 49",  emoji: "🎁", category: "Overlay", driveId: "1I0QJ09K7ZFJtdTKVWl6ZeapfxLzK1s3y", tags: ["overlay"] },
      { id: "p4-050", label: "P4 50",  emoji: "🎁", category: "Overlay", driveId: "1pSsMEeWLrGgdwZwYYYiu7EqZ_fHCtuea", tags: ["overlay"] },
      { id: "p4-051", label: "P4 51",  emoji: "🎁", category: "Overlay", driveId: "17i8nvUxYZgJgSxyBQBydVcJMZ8H6_Rqd", tags: ["overlay"] },
      { id: "p4-052", label: "P4 52",  emoji: "🎁", category: "Overlay", driveId: "10xnFYHdv8AVc9-zxtfn0SYTGz0NIkiDN", tags: ["overlay"] },
      { id: "p4-053", label: "P4 53",  emoji: "🎁", category: "Overlay", driveId: "11KO9d2WgIrAn1fZfV4--J6VkRSYpLxS-", tags: ["overlay"] },
      { id: "p4-054", label: "P4 54",  emoji: "🎁", category: "Overlay", driveId: "1mSOaM7M3sOAqOTBfAT0Vk1VRlOEloaER", tags: ["overlay"] },
      { id: "p4-055", label: "P4 55",  emoji: "🎁", category: "Overlay", driveId: "1ALYZZbu79L9Y9mMEe70Jn9QtOdihGREt", tags: ["overlay"] },
      { id: "p4-056", label: "P4 56",  emoji: "🎁", category: "Overlay", driveId: "10o2jyW8m96gu7B20UZHczh3NIpxpz961", tags: ["overlay"] },
      { id: "p4-057", label: "P4 57",  emoji: "🎁", category: "Overlay", driveId: "1_mW0XeczXGSKwddKcAGeWTPD3UC0lJVN", tags: ["overlay"] },
      { id: "p4-058", label: "P4 58",  emoji: "🎁", category: "Overlay", driveId: "1eC4jANPgI0KmIEz1qYgSR3BKS436Jz13", tags: ["overlay"] },
      { id: "p4-059", label: "P4 59",  emoji: "🎁", category: "Overlay", driveId: "1gHMDiAMOi53EHGIUs9wu54syZJqrx0WP", tags: ["overlay"] },
      { id: "p4-060", label: "P4 60",  emoji: "🎁", category: "Overlay", driveId: "1sqaQHhyn_xb71P98R5NQyODs_nm6ZX7r", tags: ["overlay"] },
      { id: "p4-061", label: "P4 61",  emoji: "🎁", category: "Overlay", driveId: "12T9Mt9aLy8iarxj2dsOoUn7jEvjciqxg", tags: ["overlay"] },
      { id: "p4-062", label: "P4 62",  emoji: "🎁", category: "Overlay", driveId: "1bHJY9LzzYXC9dCTXG9HZGAOeA5pwJlp-", tags: ["overlay"] },
      { id: "p4-063", label: "P4 63",  emoji: "🎁", category: "Overlay", driveId: "1gG61YtQ5Ul18ztxqzauoynePvEkhhuu_", tags: ["overlay"] },
      { id: "p4-064", label: "P4 64",  emoji: "🎁", category: "Overlay", driveId: "1RpVGvuHnUSSsZZdBqVIq7tOv3dVyXZ6_", tags: ["overlay"] },
      { id: "p4-065", label: "P4 65",  emoji: "🎁", category: "Overlay", driveId: "1aAhn6ZhfnorDkKj4h0ZCVOYsLeevDjnV", tags: ["overlay"] },
      { id: "p4-066", label: "P4 66",  emoji: "🎁", category: "Overlay", driveId: "1WtLfa_yRxyJBPlArXgeKm7CaERJEeWyS", tags: ["overlay"] },
      { id: "p4-067", label: "P4 67",  emoji: "🎁", category: "Overlay", driveId: "1Ai7GuXZ8EwKTMOVdooD7EALUMEm5_Czb", tags: ["overlay"] },
      { id: "p4-068", label: "P4 68",  emoji: "🎁", category: "Overlay", driveId: "1_W8PaJlGdU9Lt5EPlkSzxgz2mCiawry9", tags: ["overlay"] },
      { id: "p4-069", label: "P4 69",  emoji: "🎁", category: "Overlay", driveId: "1-9KS2OsYANmEHAxGAA2VBUjZgI3EV5Rl", tags: ["overlay"] },
      { id: "p4-070", label: "P4 70",  emoji: "🎁", category: "Overlay", driveId: "1HqocnRwkLv7DJpSKBNfsunuK2ZH5PwY5", tags: ["overlay"] },
      { id: "p4-071", label: "P4 71",  emoji: "🎁", category: "Overlay", driveId: "1vb7a25TPYQaK0w1n1bXEEZgJnRxhRanR", tags: ["overlay"] },
      { id: "p4-072", label: "P4 72",  emoji: "🎁", category: "Overlay", driveId: "1Bb1V75Jj-eYNCF4qwWUDmFqb5I5F3Y39", tags: ["overlay"] },
      { id: "p4-073", label: "P4 73",  emoji: "🎁", category: "Overlay", driveId: "1DKfLe58VbZ9ibwcNOofvE_IIRvhlEeIA", tags: ["overlay"] },
      { id: "p4-074", label: "P4 74",  emoji: "🎁", category: "Overlay", driveId: "1rwpedkrUoujTHNo7qYWlMcpw99rRPpdq", tags: ["overlay"] },
      { id: "p4-075", label: "P4 75",  emoji: "🎁", category: "Overlay", driveId: "1cPIvgHjlFZ27b0oWxxK_AINiu9ELjUZp", tags: ["overlay"] },
      { id: "p4-076", label: "P4 76",  emoji: "🎁", category: "Overlay", driveId: "1iP0PETDndN7qlrWEIKwuhc2bbYtphetG", tags: ["overlay"] },
      { id: "p4-077", label: "P4 77",  emoji: "🎁", category: "Overlay", driveId: "1R39Vu9Ifi4oa0COT-fF-GGyr1rEbpHPy", tags: ["overlay"] },
      { id: "p4-078", label: "P4 78",  emoji: "🎁", category: "Overlay", driveId: "1TpEgeFhOCGotggQhy1STEiZ4A8ctLRHh", tags: ["overlay"] },
      { id: "p4-079", label: "P4 79",  emoji: "🎁", category: "Overlay", driveId: "1Ozwfkx86ehnzuJil5X0JbZ0RTgNRLc4q", tags: ["overlay"] },
      { id: "p4-080", label: "P4 80",  emoji: "🎁", category: "Overlay", driveId: "1rlDL5catRM7bUX6JuUKJcm_v1Ek2pU62", tags: ["overlay"] },
      { id: "p4-081", label: "P4 81",  emoji: "🎁", category: "Overlay", driveId: "1EyqNkFPeZIp_bpziyeOKjIBLN6T7vHyU", tags: ["overlay"] },
      { id: "p4-082", label: "P4 82",  emoji: "🎁", category: "Overlay", driveId: "1vUwbWo4sHwdcuqQpvdYtJGwqrHa3E5bf", tags: ["overlay"] },
      { id: "p4-083", label: "P4 83",  emoji: "🎁", category: "Overlay", driveId: "1TfoA6_6__bsamldkoEjgRzH4lgBmLN90", tags: ["overlay"] },
      { id: "p4-084", label: "P4 84",  emoji: "🎁", category: "Overlay", driveId: "1YKPJGE7jQSeQZGAsaf1Y7kXQlVUbVbjR", tags: ["overlay"] },
      { id: "p4-085", label: "P4 85",  emoji: "🎁", category: "Overlay", driveId: "1gXsbXV5j5FJnnXHDHNdQLajBZCE1UHl5", tags: ["overlay"] },
      { id: "p4-086", label: "P4 86",  emoji: "🎁", category: "Overlay", driveId: "1YjA3g7f1GFmw_p-jRUJ2Q_c2zp5bBra8", tags: ["overlay"] },
      { id: "p4-087", label: "P4 87",  emoji: "🎁", category: "Overlay", driveId: "1hhRsaTpwG-e7S7HF0QkybXF2g7-IhjWj", tags: ["overlay"] },
      { id: "p4-088", label: "P4 88",  emoji: "🎁", category: "Overlay", driveId: "1SKvEUkIrsJQnNlc1LviS4g_eHULUzqzX", tags: ["overlay"] },
      { id: "p4-089", label: "P4 89",  emoji: "🎁", category: "Overlay", driveId: "1XgxtR-NEp8PtjM4jBkVEfrybf4ITNPJc", tags: ["overlay"] },
      { id: "p4-090", label: "P4 90",  emoji: "🎁", category: "Overlay", driveId: "19RbI8VePbSYNgLWn58DmmkdGWmdESiuQ", tags: ["overlay"] },
      { id: "p4-091", label: "P4 91",  emoji: "🎁", category: "Overlay", driveId: "1-Wqg9xo5ey47syuYTv-Qe_xMjou-hvIk", tags: ["overlay"] },
      { id: "p4-092", label: "P4 92",  emoji: "🎁", category: "Overlay", driveId: "10HQKXmly6cUFcKpsY9Vq5hHxMZq2GivY", tags: ["overlay"] },
      { id: "p4-093", label: "P4 93",  emoji: "🎁", category: "Overlay", driveId: "13jguXCYOFmmOqrVybcqtFxvTijUj2HDl", tags: ["overlay"] },
      { id: "p4-094", label: "P4 94",  emoji: "🎁", category: "Overlay", driveId: "15uZqdu3x3klZUHvKLWk0so_ums365uCL", tags: ["overlay"] },
      { id: "p4-095", label: "P4 95",  emoji: "🎁", category: "Overlay", driveId: "179XQ1WNWWyA0EoTVJNVBKZ9iANBKJEaH", tags: ["overlay"] },
      { id: "p4-096", label: "P4 96",  emoji: "🎁", category: "Overlay", driveId: "1GUPs2N2oXXepyJb2B5m2B82SGZfqK_DL", tags: ["overlay"] },
      { id: "p4-097", label: "P4 97",  emoji: "🎁", category: "Overlay", driveId: "1HLB3Y5VCksv3VNFD1AIk_d80dk0HD1oB", tags: ["overlay"] },
      { id: "p4-098", label: "P4 98",  emoji: "🎁", category: "Overlay", driveId: "1HhkPf9hOk3PdIqty4QV8L49AU6B9twkl", tags: ["overlay"] },
      { id: "p4-099", label: "P4 99",  emoji: "🎁", category: "Overlay", driveId: "1KGST86drpWmCA6U8FSVFKDFI81ujMEi2", tags: ["overlay"] },
      { id: "p4-100", label: "P4 100", emoji: "🎁", category: "Overlay", driveId: "1OFe91xTBhPElAWirP6_TmSixeG8JDcqb", tags: ["overlay"] },
    ],
  },
  {
    id: "pacote-5",
    label: "Pacote 5",
    emoji: "🎁",
    assets: [
      { id: "p5-001", label: "P5 1",   emoji: "🎁", category: "Overlay", driveId: "1OqFv7uMQ3o-HUxEuwLmVV7Z6c1a3GxlR", tags: ["overlay"] },
      { id: "p5-002", label: "P5 2",   emoji: "🎁", category: "Overlay", driveId: "1PV7fo-WTaFtHTkKhVI-2JUbQsqVrdwNv", tags: ["overlay"] },
      { id: "p5-003", label: "P5 3",   emoji: "🎁", category: "Overlay", driveId: "1Q8GegLWnFjJdZIM6b1hHtUbmMYsiDgPu", tags: ["overlay"] },
      { id: "p5-004", label: "P5 4",   emoji: "🎁", category: "Overlay", driveId: "1QxJeZWz_U98Ks-dZtfyxQxfq5ehq_kX_", tags: ["overlay"] },
      { id: "p5-005", label: "P5 5",   emoji: "🎁", category: "Overlay", driveId: "1Sa7wdwOnG7WNHMJ6PYLG3Q2CFuLw3lfv", tags: ["overlay"] },
      { id: "p5-006", label: "P5 6",   emoji: "🎁", category: "Overlay", driveId: "1TbcUNfGaihPFqHMbudM64KVYmZbb75Iq", tags: ["overlay"] },
      { id: "p5-007", label: "P5 7",   emoji: "🎁", category: "Overlay", driveId: "1XwxbFtUCvA1VNgB2mJTuRPtFlNw-D7cH", tags: ["overlay"] },
      { id: "p5-008", label: "P5 8",   emoji: "🎁", category: "Overlay", driveId: "1YKoFkdbx-JDu5FSi1Y59wleP_RRYwJYb", tags: ["overlay"] },
      { id: "p5-009", label: "P5 9",   emoji: "🎁", category: "Overlay", driveId: "1ZsH-I88lvhLjrj1jZVvqPFWL9ZfVD7v7", tags: ["overlay"] },
      { id: "p5-010", label: "P5 10",  emoji: "🎁", category: "Overlay", driveId: "1cSlTrBJrcZgKZHROOs0CmB8ubkHIgbJF", tags: ["overlay"] },
      { id: "p5-011", label: "P5 11",  emoji: "🎁", category: "Overlay", driveId: "1moTbahBsSL0UfRva4pTb2lXcHaRdL0BT", tags: ["overlay"] },
      { id: "p5-012", label: "P5 12",  emoji: "🎁", category: "Overlay", driveId: "1q-OzTs-zy_GyKr8o07sm10R-jxkPTPm1", tags: ["overlay"] },
      { id: "p5-013", label: "P5 13",  emoji: "🎁", category: "Overlay", driveId: "1q17OmMp5psVrqD7wjd2gWyHn0SkIW169", tags: ["overlay"] },
      { id: "p5-014", label: "P5 14",  emoji: "🎁", category: "Overlay", driveId: "1rUmUyN5Mnku5GTim75lzNOFBHO_a1GNq", tags: ["overlay"] },
      { id: "p5-015", label: "P5 15",  emoji: "🎁", category: "Overlay", driveId: "1rsdqhOW-uiYzLIlP8-5V4LuunD69ZXpq", tags: ["overlay"] },
      { id: "p5-016", label: "P5 16",  emoji: "🎁", category: "Overlay", driveId: "1si3Kghl8IPpIE15LTRr2HQgL8Vz0SLFN", tags: ["overlay"] },
      { id: "p5-017", label: "P5 17",  emoji: "🎁", category: "Overlay", driveId: "1ttEkO3Ae7pU2P5-Sm1J2P77sU6nlDpYu", tags: ["overlay"] },
      { id: "p5-018", label: "P5 18",  emoji: "🎁", category: "Overlay", driveId: "1uJF2S-XVVrh1KwzcysY7au-otlS3d1E8", tags: ["overlay"] },
      { id: "p5-019", label: "P5 19",  emoji: "🎁", category: "Overlay", driveId: "1zHn-9XaKkB8FQxnIbXOU0a2B5pzc9sH7", tags: ["overlay"] },
      { id: "p5-020", label: "P5 20",  emoji: "🎁", category: "Overlay", driveId: "1zshsxj2w3UjcROvd6uKiXvwaIcpM9M-j", tags: ["overlay"] },
      { id: "p5-021", label: "P5 21",  emoji: "🎁", category: "Overlay", driveId: "1NOlF0uYCijBqUoFY6VC5d9m13AXJ8_qG", tags: ["overlay"] },
      { id: "p5-022", label: "P5 22",  emoji: "🎁", category: "Overlay", driveId: "1gP8gMEEZ5Am8mbLf0rPLmyn4OdFXQnX3", tags: ["overlay"] },
      { id: "p5-023", label: "P5 23",  emoji: "🎁", category: "Overlay", driveId: "1JvGoHErttmKxVLQxtSolIXX8AB9qVolZ", tags: ["overlay"] },
      { id: "p5-024", label: "P5 24",  emoji: "🎁", category: "Overlay", driveId: "1dUpwvMBnJRl4a4mE6af9kqcLJMJD2ygB", tags: ["overlay"] },
      { id: "p5-025", label: "P5 25",  emoji: "🎁", category: "Overlay", driveId: "1zimG57iUnDHOO9MAHxCKpdNoXsZn8GpR", tags: ["overlay"] },
      { id: "p5-026", label: "P5 26",  emoji: "🎁", category: "Overlay", driveId: "1Agy4tnQWQHBiPN7w8sD2ti13o3-pgelF", tags: ["overlay"] },
      { id: "p5-027", label: "P5 27",  emoji: "🎁", category: "Overlay", driveId: "1zqYfZylVs-3Y-jMskSdI_r7vFzj8EaHM", tags: ["overlay"] },
      { id: "p5-028", label: "P5 28",  emoji: "🎁", category: "Overlay", driveId: "1JY9aw9OduZeWcGZrkIbrWtlDCaqMreMp", tags: ["overlay"] },
      { id: "p5-029", label: "P5 29",  emoji: "🎁", category: "Overlay", driveId: "1KQ5z6pp7x-VxdvUvE6A8VsvPUPuXHKSs", tags: ["overlay"] },
      { id: "p5-030", label: "P5 30",  emoji: "🎁", category: "Overlay", driveId: "1ZWC99Nzwk4Ryam0I6_76WvguVT99JUPP", tags: ["overlay"] },
      { id: "p5-031", label: "P5 31",  emoji: "🎁", category: "Overlay", driveId: "15LE7QVtmvYm0UkctsLqSq9pUXaJhdVVm", tags: ["overlay"] },
      { id: "p5-032", label: "P5 32",  emoji: "🎁", category: "Overlay", driveId: "1ndrQoxmxsmqDZJU3M6-vbZMyr-bpYCrg", tags: ["overlay"] },
      { id: "p5-033", label: "P5 33",  emoji: "🎁", category: "Overlay", driveId: "18ZSyAcIcGe-yBqjAC_3b3h-n3w8xwHfq", tags: ["overlay"] },
      { id: "p5-034", label: "P5 34",  emoji: "🎁", category: "Overlay", driveId: "1ZAHLCNoYvOeVVtooC3QxrQoi3zUFBzgd", tags: ["overlay"] },
      { id: "p5-035", label: "P5 35",  emoji: "🎁", category: "Overlay", driveId: "1n3nuNTiAQFO78soEcXxVEoJdGD27mXwW", tags: ["overlay"] },
      { id: "p5-036", label: "P5 36",  emoji: "🎁", category: "Overlay", driveId: "1wkb9gr5MSyR7T3ZsaSVxRxeZT1xyLIa1", tags: ["overlay"] },
      { id: "p5-037", label: "P5 37",  emoji: "🎁", category: "Overlay", driveId: "1xh_6gaOfdhYrfnay36s1zdogf5wypQV4", tags: ["overlay"] },
      { id: "p5-038", label: "P5 38",  emoji: "🎁", category: "Overlay", driveId: "1Kkx7Hk--x0LbOOiE7SRA2BJyaqlrp7qF", tags: ["overlay"] },
      { id: "p5-039", label: "P5 39",  emoji: "🎁", category: "Overlay", driveId: "1nyBd3rXhI7dRYG3Ik1jBswqbgV1x4_Dp", tags: ["overlay"] },
      { id: "p5-040", label: "P5 40",  emoji: "🎁", category: "Overlay", driveId: "1riMZ9ifH5XhICjZgVmA904bhhnCATe5H", tags: ["overlay"] },
      { id: "p5-041", label: "P5 41",  emoji: "🎁", category: "Overlay", driveId: "1Zh0XwXyDM-OJFIEawCvbZUEzIfoL-yxA", tags: ["overlay"] },
      { id: "p5-042", label: "P5 42",  emoji: "🎁", category: "Overlay", driveId: "1GDA_c4wIKVWGECoKw8VrDDW5wM5AsyZ2", tags: ["overlay"] },
      { id: "p5-043", label: "P5 43",  emoji: "🎁", category: "Overlay", driveId: "1fiyXa4VPl6XGt52zrKufoxvl_HYRanL5", tags: ["overlay"] },
      { id: "p5-044", label: "P5 44",  emoji: "🎁", category: "Overlay", driveId: "1iZoTnjWzfWz4QYeHbfwlqMxvwmEdIysU", tags: ["overlay"] },
      { id: "p5-045", label: "P5 45",  emoji: "🎁", category: "Overlay", driveId: "1T4MsKoR7WYKC-CaFEY-478s2VIFgzpd5", tags: ["overlay"] },
      { id: "p5-046", label: "P5 46",  emoji: "🎁", category: "Overlay", driveId: "1F7A2QGmMtHhAM3SqWsJMn_MYG_06DATQ", tags: ["overlay"] },
      { id: "p5-047", label: "P5 47",  emoji: "🎁", category: "Overlay", driveId: "1T4CboYqxxPqmxCB3-9m98TqpIYEHdio2", tags: ["overlay"] },
      { id: "p5-048", label: "P5 48",  emoji: "🎁", category: "Overlay", driveId: "1g9Ca9hCTmym_lg7tVZRxdtI8UhAdLjmB", tags: ["overlay"] },
      { id: "p5-049", label: "P5 49",  emoji: "🎁", category: "Overlay", driveId: "132KdMTzS4zfTum-9zzAV3EgPsZwbm0O3", tags: ["overlay"] },
      { id: "p5-050", label: "P5 50",  emoji: "🎁", category: "Overlay", driveId: "17SGKBWrh0wS7N43oMKURxLmLSNXuWbm4", tags: ["overlay"] },
      { id: "p5-051", label: "P5 51",  emoji: "🎁", category: "Overlay", driveId: "1hrfS78D_zxJQ4r5sQZLsKcmMKy9ivkUs", tags: ["overlay"] },
      { id: "p5-052", label: "P5 52",  emoji: "🎁", category: "Overlay", driveId: "1HaiSamj3MVCC6zLtM-xb_Ee19sBzwEHo", tags: ["overlay"] },
      { id: "p5-053", label: "P5 53",  emoji: "🎁", category: "Overlay", driveId: "1q0zXZEuRojVNucp27XxXQ2cflBHlDTMA", tags: ["overlay"] },
      { id: "p5-054", label: "P5 54",  emoji: "🎁", category: "Overlay", driveId: "1kWWXokiObvzquHoH4sj8IA0nx7Mld_If", tags: ["overlay"] },
      { id: "p5-055", label: "P5 55",  emoji: "🎁", category: "Overlay", driveId: "1dmK_wgB7BsD9vn6XyQWVCjMFv3PuKaWU", tags: ["overlay"] },
      { id: "p5-056", label: "P5 56",  emoji: "🎁", category: "Overlay", driveId: "1Ov5cOaiMWeqpaRUaQ9SkwYAGxI1rkIIi", tags: ["overlay"] },
      { id: "p5-057", label: "P5 57",  emoji: "🎁", category: "Overlay", driveId: "1pTUYTqLm1F2WecynphWUngWR8b_6A8Rv", tags: ["overlay"] },
      { id: "p5-058", label: "P5 58",  emoji: "🎁", category: "Overlay", driveId: "1Uo3JCkMgLVKnO1DvzBwvOmal3bI4iNWD", tags: ["overlay"] },
      { id: "p5-059", label: "P5 59",  emoji: "🎁", category: "Overlay", driveId: "1R2ejq58-Hy8LK2vRN7PGSPs-twutZvP1", tags: ["overlay"] },
      { id: "p5-060", label: "P5 60",  emoji: "🎁", category: "Overlay", driveId: "1CvOQ6KsXLrtHUm0Us0C8ysXaGxriMNqW", tags: ["overlay"] },
      { id: "p5-061", label: "P5 61",  emoji: "🎁", category: "Overlay", driveId: "1lXLHWgPUl1Y9fmflnVY0lcfGZAAYsqfA", tags: ["overlay"] },
      { id: "p5-062", label: "P5 62",  emoji: "🎁", category: "Overlay", driveId: "1kvfybonbUJKiOTT6s5jgL0N9T-OZCmrx", tags: ["overlay"] },
      { id: "p5-063", label: "P5 63",  emoji: "🎁", category: "Overlay", driveId: "1Rq-BtFVKhplpmd3UToKf_Ny-sQ5ml4NO", tags: ["overlay"] },
      { id: "p5-064", label: "P5 64",  emoji: "🎁", category: "Overlay", driveId: "1tDJAZ7MniCwxzYs-G5PaLwgGhNnxaSIk", tags: ["overlay"] },
      { id: "p5-065", label: "P5 65",  emoji: "🎁", category: "Overlay", driveId: "1wLB6dRsfjKomO0fYxEbQpcK3LImctmcn", tags: ["overlay"] },
      { id: "p5-066", label: "P5 66",  emoji: "🎁", category: "Overlay", driveId: "13b8lpRPjq_TNLaoKmEwpZ-1gTElRTA4M", tags: ["overlay"] },
      { id: "p5-067", label: "P5 67",  emoji: "🎁", category: "Overlay", driveId: "1AoqLd_GOHiD80i706Hc7gOQOumjaSUcl", tags: ["overlay"] },
      { id: "p5-068", label: "P5 68",  emoji: "🎁", category: "Overlay", driveId: "1i9UoJi1PY_7meYfrGrAKj9fEmEekGFfZ", tags: ["overlay"] },
      { id: "p5-069", label: "P5 69",  emoji: "🎁", category: "Overlay", driveId: "18qj5cjc-bQvtYgxaM5IaodmcWxzkS8kS", tags: ["overlay"] },
      { id: "p5-070", label: "P5 70",  emoji: "🎁", category: "Overlay", driveId: "1cFWtzGt8UL9AuBuzJTxjHpasbtH4KP0Y", tags: ["overlay"] },
      { id: "p5-071", label: "P5 71",  emoji: "🎁", category: "Overlay", driveId: "1n4xX_wFTC7SkPdIzIZo-Yf6TsuMlagyl", tags: ["overlay"] },
      { id: "p5-072", label: "P5 72",  emoji: "🎁", category: "Overlay", driveId: "1YNYE6i29kM8jce7U6dURLeGcrO7vkrPK", tags: ["overlay"] },
      { id: "p5-073", label: "P5 73",  emoji: "🎁", category: "Overlay", driveId: "1WhwFT4dZ1Q14TYxknUdDqPwXQLzus9KG", tags: ["overlay"] },
      { id: "p5-074", label: "P5 74",  emoji: "🎁", category: "Overlay", driveId: "1No16BLsKWQnl6lINb7EyEZhIU75E7znL", tags: ["overlay"] },
      { id: "p5-075", label: "P5 75",  emoji: "🎁", category: "Overlay", driveId: "1jfv8i_qe1wYsKnm4-1aySLi6JBkWjrTZ", tags: ["overlay"] },
      { id: "p5-076", label: "P5 76",  emoji: "🎁", category: "Overlay", driveId: "1k1twyh7xvQEaAQLx2D8n318uyU2P9oWB", tags: ["overlay"] },
      { id: "p5-077", label: "P5 77",  emoji: "🎁", category: "Overlay", driveId: "1jYkuWbcvxHArsZgjAzTAXPHEFbBGFgur", tags: ["overlay"] },
      { id: "p5-078", label: "P5 78",  emoji: "🎁", category: "Overlay", driveId: "1FOYfgM9lEnty1l42ICS8FDYoJbwm6AVv", tags: ["overlay"] },
      { id: "p5-079", label: "P5 79",  emoji: "🎁", category: "Overlay", driveId: "199HehlbDWT50MgQEA-0P0jrdgONrKu7c", tags: ["overlay"] },
      { id: "p5-080", label: "P5 80",  emoji: "🎁", category: "Overlay", driveId: "1qYxUSp36Az2KoxtPuQEy5VgesdQdOxXD", tags: ["overlay"] },
      { id: "p5-081", label: "P5 81",  emoji: "🎁", category: "Overlay", driveId: "1Y9JvxmeTVoPAomaI1D44zxThdk7wIVIV", tags: ["overlay"] },
      { id: "p5-082", label: "P5 82",  emoji: "🎁", category: "Overlay", driveId: "1eJS5yYypZxdrAdfNsFGmaNIq-_3oLxk4", tags: ["overlay"] },
      { id: "p5-083", label: "P5 83",  emoji: "🎁", category: "Overlay", driveId: "1cYWHJlLPQ163SkIpXCMgZXNG9TFWDRxz", tags: ["overlay"] },
      { id: "p5-084", label: "P5 84",  emoji: "🎁", category: "Overlay", driveId: "1RF2GjS8TlUervzMcMzut9Sn7fKAZyLsX", tags: ["overlay"] },
      { id: "p5-085", label: "P5 85",  emoji: "🎁", category: "Overlay", driveId: "1t7M_Pi3gJzwtIPj0c-LTrOS1pnwVJGLV", tags: ["overlay"] },
      { id: "p5-086", label: "P5 86",  emoji: "🎁", category: "Overlay", driveId: "1vCqEgLt1decReID5f2tGl6Nmcb1rVBp4", tags: ["overlay"] },
      { id: "p5-087", label: "P5 87",  emoji: "🎁", category: "Overlay", driveId: "1jGq5jX0AMCmBkw8lxunih2qiB2V6JT21", tags: ["overlay"] },
      { id: "p5-088", label: "P5 88",  emoji: "🎁", category: "Overlay", driveId: "1XiAVoTE92_Bwo2l2MpSIHugaYWfqDw9s", tags: ["overlay"] },
      { id: "p5-089", label: "P5 89",  emoji: "🎁", category: "Overlay", driveId: "19wUyYPN8mNYqIOVGgJUkKcMTeJKaQ-8K", tags: ["overlay"] },
      { id: "p5-090", label: "P5 90",  emoji: "🎁", category: "Overlay", driveId: "1Z3gP6Mq8lnc4OsLPhovCN8Du1H7u8VCG", tags: ["overlay"] },
      { id: "p5-091", label: "P5 91",  emoji: "🎁", category: "Overlay", driveId: "1UXTb1t-NLQuoHenLS4Yk2uJUzY3D4Mz-", tags: ["overlay"] },
      { id: "p5-092", label: "P5 92",  emoji: "🎁", category: "Overlay", driveId: "1HoDcuRlBsHVp-NhyA8HYtt0h8Vi-ln6r", tags: ["overlay"] },
      { id: "p5-093", label: "P5 93",  emoji: "🎁", category: "Overlay", driveId: "1TPjk3diUWyn-w1b9Y9Cj8kGQOUF34OUJ", tags: ["overlay"] },
      { id: "p5-094", label: "P5 94",  emoji: "🎁", category: "Overlay", driveId: "1RZQ1rUZ0nJEyBxBcK98G0hhvJM1Y_gnD", tags: ["overlay"] },
      { id: "p5-095", label: "P5 95",  emoji: "🎁", category: "Overlay", driveId: "1H_gCnWSeMvGsY_a3dEgsO-8AT4ZHZ3iH", tags: ["overlay"] },
      { id: "p5-096", label: "P5 96",  emoji: "🎁", category: "Overlay", driveId: "1ZLBxqaJpIlU48NY8YDB5DJAn1nEyr_8p", tags: ["overlay"] },
      { id: "p5-097", label: "P5 97",  emoji: "🎁", category: "Overlay", driveId: "10jTt9LoYErdasZhoSnZtg8T1_iJETAoa", tags: ["overlay"] },
      { id: "p5-098", label: "P5 98",  emoji: "🎁", category: "Overlay", driveId: "1uOflB2Pn-zXKEMJ9Ro5yi7-Qi3vT9hQL", tags: ["overlay"] },
      { id: "p5-099", label: "P5 99",  emoji: "🎁", category: "Overlay", driveId: "1VxTs09iSCkmRxCWS2z5xYa2Wwei0xHps", tags: ["overlay"] },
      { id: "p5-100", label: "P5 100", emoji: "🎁", category: "Overlay", driveId: "1UPy8Zw6Gn4VU03B0NNkiOERHLLMMLYwM", tags: ["overlay"] },
    ],
  },
  {
    id: "pacote-6",
    label: "Pacote 6",
    emoji: "🎁",
    assets: [
      { id: "p6-001", label: "P6 1", emoji: "🎁", category: "Overlay", driveId: "1J3VKCLOZVciF-aid1ENaWaZsfSGpcJwo", tags: ["overlay"] },
      { id: "p6-002", label: "P6 2", emoji: "🎁", category: "Overlay", driveId: "1WvP4xiAci06VWICzDavZL7U0PMTjHuLi", tags: ["overlay"] },
      { id: "p6-003", label: "P6 3", emoji: "🎁", category: "Overlay", driveId: "1Z57vh5L2EBzjWWt5x3ZgKqA3Ro9bxkXm", tags: ["overlay"] },
      { id: "p6-004", label: "P6 4", emoji: "🎁", category: "Overlay", driveId: "1dL12ZpYP4n099pibYF0Wcnhsxz_KeFEG", tags: ["overlay"] },
      { id: "p6-005", label: "P6 5", emoji: "🎁", category: "Overlay", driveId: "1p-XwVNxp9UBS0WlTqTzw4J-1beFWJmPM", tags: ["overlay"] },
      { id: "p6-006", label: "P6 6", emoji: "🎁", category: "Overlay", driveId: "1WbrQQP4v1BVYrZuKt_qsQIWC2BuR8pBZ", tags: ["overlay"] },
      { id: "p6-007", label: "P6 7", emoji: "🎁", category: "Overlay", driveId: "1AjdckGYcLyMhVM2mMXe_M9foXHBC3onn", tags: ["overlay"] },
      { id: "p6-008", label: "P6 8", emoji: "🎁", category: "Overlay", driveId: "1Jc8Rk4REdgf9N2yDDj47G3SsTPVpuKsO", tags: ["overlay"] },
      { id: "p6-009", label: "P6 9", emoji: "🎁", category: "Overlay", driveId: "1iQig06dMkOea-xYz1LCIXfdRjZ3z625F", tags: ["overlay"] },
      { id: "p6-010", label: "P6 10", emoji: "🎁", category: "Overlay", driveId: "1ALPWCWLeslyC0qYmk8mugchmmJMUSPU9", tags: ["overlay"] },
      { id: "p6-011", label: "P6 11", emoji: "🎁", category: "Overlay", driveId: "1s84H9uW7Vsw7AwLj8qLekiYy1xvva7_c", tags: ["overlay"] },
      { id: "p6-012", label: "P6 12", emoji: "🎁", category: "Overlay", driveId: "1CrKI-Ioi1LVq_P9lEYN4XK6sU2Wa2Wsk", tags: ["overlay"] },
      { id: "p6-013", label: "P6 13", emoji: "🎁", category: "Overlay", driveId: "11QNIH-h9alNSALUxIP7rkkxduDKTSk6c", tags: ["overlay"] },
      { id: "p6-014", label: "P6 14", emoji: "🎁", category: "Overlay", driveId: "1yahwwzAl_3PP8phco0A39HeCjeYyVoAP", tags: ["overlay"] },
      { id: "p6-015", label: "P6 15", emoji: "🎁", category: "Overlay", driveId: "1k1CULq2u0hWzQzxdectyUTNDvOoq8tZW", tags: ["overlay"] },
      { id: "p6-016", label: "P6 16", emoji: "🎁", category: "Overlay", driveId: "1_x8IWBDAq9fnxpI8wyoEoOuSEeUEhynQ", tags: ["overlay"] },
      { id: "p6-017", label: "P6 17", emoji: "🎁", category: "Overlay", driveId: "10prH3SR7CPBXH_4RO5VBQTuk2OAmr27E", tags: ["overlay"] },
      { id: "p6-018", label: "P6 18", emoji: "🎁", category: "Overlay", driveId: "1SjDbDhr1b3_Nm6fczR1JXAQCHJ6VLsvx", tags: ["overlay"] },
      { id: "p6-019", label: "P6 19", emoji: "🎁", category: "Overlay", driveId: "1pGLpp-MXoQO0XV23R21yr5xquqe9xocN", tags: ["overlay"] },
      { id: "p6-020", label: "P6 20", emoji: "🎁", category: "Overlay", driveId: "18CJkRG2fpu_zvu9M27bn1Ob1uFOJHgxd", tags: ["overlay"] },
      { id: "p6-021", label: "P6 21", emoji: "🎁", category: "Overlay", driveId: "1vGpGrv_4pxypqQfuc-mUVLH65F-u8bfQ", tags: ["overlay"] },
      { id: "p6-022", label: "P6 22", emoji: "🎁", category: "Overlay", driveId: "1EL5cZkMGQJuWCfTmrEhRQUqt-YwAVYMm", tags: ["overlay"] },
      { id: "p6-023", label: "P6 23", emoji: "🎁", category: "Overlay", driveId: "1-kzhko_gCfD104JMUBBbNBHb_w03byCX", tags: ["overlay"] },
      { id: "p6-024", label: "P6 24", emoji: "🎁", category: "Overlay", driveId: "16XSk6N9f2QQJuti2UmK3v-OKe6VkZend", tags: ["overlay"] },
      { id: "p6-025", label: "P6 25", emoji: "🎁", category: "Overlay", driveId: "1CH3NQfoaAK99RZ-VvJkiFLDs9PbJa0ak", tags: ["overlay"] },
      { id: "p6-026", label: "P6 26", emoji: "🎁", category: "Overlay", driveId: "1GnopQxbNwTmkouUdWhKztRlrKxN-mtGW", tags: ["overlay"] },
      { id: "p6-027", label: "P6 27", emoji: "🎁", category: "Overlay", driveId: "1H7ZyaSYapEsgZLExrE_3s-U9AQj7geVj", tags: ["overlay"] },
      { id: "p6-028", label: "P6 28", emoji: "🎁", category: "Overlay", driveId: "1J48OA6cM4K4g8SnaA0LZFD-2pRlzyqaq", tags: ["overlay"] },
      { id: "p6-029", label: "P6 29", emoji: "🎁", category: "Overlay", driveId: "1XF4fNbBgwJuiPUIcLBM2AAzgAPz3Kqnk", tags: ["overlay"] },
      { id: "p6-030", label: "P6 30", emoji: "🎁", category: "Overlay", driveId: "1ZZP9OsY2RZMos7sbzqHS9NL0HfUDXl_c", tags: ["overlay"] },
      { id: "p6-031", label: "P6 31", emoji: "🎁", category: "Overlay", driveId: "1zsh78AnUuYdglUrEX5wkezJITXJjjxYb", tags: ["overlay"] },
      { id: "p6-032", label: "P6 32", emoji: "🎁", category: "Overlay", driveId: "1ztgLHnshvu7QKse8qyw_Z0SrAX9OahLB", tags: ["overlay"] },
      { id: "p6-033", label: "P6 33", emoji: "🎁", category: "Overlay", driveId: "1oZ7EbIjemAYqXyH20C9v084g3kVLfDfW", tags: ["overlay"] },
      { id: "p6-034", label: "P6 34", emoji: "🎁", category: "Overlay", driveId: "1yQnm5KamWulc8L1wMCh-WyN7vdS3Kd8U", tags: ["overlay"] },
      { id: "p6-035", label: "P6 35", emoji: "🎁", category: "Overlay", driveId: "1q-wXFYrL3c3HjiqGTpxMdzCz5N2WP64f", tags: ["overlay"] },
      { id: "p6-036", label: "P6 36", emoji: "🎁", category: "Overlay", driveId: "1MjYincTc0MoRwg0tz9IDNo0i2u7ri3K_", tags: ["overlay"] },
      { id: "p6-037", label: "P6 37", emoji: "🎁", category: "Overlay", driveId: "1D3ZQAoihSBUr959jbnyKOkkX-sHsSe6k", tags: ["overlay"] },
      { id: "p6-038", label: "P6 38", emoji: "🎁", category: "Overlay", driveId: "11qvyIGH39DWUZWiO8aN5IeJFqkU0smfa", tags: ["overlay"] },
      { id: "p6-039", label: "P6 39", emoji: "🎁", category: "Overlay", driveId: "1Mgz5-DavFj4-9b3uOVMft-biouu0SFws", tags: ["overlay"] },
      { id: "p6-040", label: "P6 40", emoji: "🎁", category: "Overlay", driveId: "19qXfjEapBU5GHMELRbrRAyPW3HfO80tz", tags: ["overlay"] },
      { id: "p6-041", label: "P6 41", emoji: "🎁", category: "Overlay", driveId: "1Y1Znl8KYgKJAEZFK9dixDtOIylzIYdAk", tags: ["overlay"] },
      { id: "p6-042", label: "P6 42", emoji: "🎁", category: "Overlay", driveId: "12fnnsXdlYjTpLY0ybzZ_mvAVjP2n6o6X", tags: ["overlay"] },
      { id: "p6-043", label: "P6 43", emoji: "🎁", category: "Overlay", driveId: "109ZsBrnuehCsM5_xtvMYyjfaK4p3ew1F", tags: ["overlay"] },
      { id: "p6-044", label: "P6 44", emoji: "🎁", category: "Overlay", driveId: "1pCscXF-JO4oIoOuzed7-dNlzHW3V0Mj7", tags: ["overlay"] },
      { id: "p6-045", label: "P6 45", emoji: "🎁", category: "Overlay", driveId: "1bNazzz0vB1uIeJ3KbzlKQoUDYqophC2t", tags: ["overlay"] },
      { id: "p6-046", label: "P6 46", emoji: "🎁", category: "Overlay", driveId: "1IujvRe7I-umgiQFTWiablSqJYXTA2uBb", tags: ["overlay"] },
      { id: "p6-047", label: "P6 47", emoji: "🎁", category: "Overlay", driveId: "1voRKeF8bY2kQfVwmLSj8hQh1josldBUY", tags: ["overlay"] },
      { id: "p6-048", label: "P6 48", emoji: "🎁", category: "Overlay", driveId: "1VZptwO3qPefY9MfMJLAgZlV8SsAm9tV2", tags: ["overlay"] },
      { id: "p6-049", label: "P6 49", emoji: "🎁", category: "Overlay", driveId: "1Hyx6e-7onhy1iZXGABC_DuQ8cKdFWvUO", tags: ["overlay"] },
      { id: "p6-050", label: "P6 50", emoji: "🎁", category: "Overlay", driveId: "110cMmenz1O3zxmXMMZZEjcaaTRn1kn0e", tags: ["overlay"] },
      { id: "p6-051", label: "P6 51", emoji: "🎁", category: "Overlay", driveId: "1Jg9NV39Bar8Wv0zAKxAQ58PVTCmrb0EP", tags: ["overlay"] },
      { id: "p6-052", label: "P6 52", emoji: "🎁", category: "Overlay", driveId: "1qWc5f0yJj4WY8wcW4hcvHbWLr_6uc0SX", tags: ["overlay"] },
      { id: "p6-053", label: "P6 53", emoji: "🎁", category: "Overlay", driveId: "1_RYENKVZ9hqG9z9H9Ax4nOy3LSG8xvvB", tags: ["overlay"] },
      { id: "p6-054", label: "P6 54", emoji: "🎁", category: "Overlay", driveId: "1Ui0J8EWVKgnvPyND63ujpAvzw6ASwP9t", tags: ["overlay"] },
      { id: "p6-055", label: "P6 55", emoji: "🎁", category: "Overlay", driveId: "1-sF0g_26v0W6a4NqswPVvKfbjP8E_mJ_", tags: ["overlay"] },
      { id: "p6-056", label: "P6 56", emoji: "🎁", category: "Overlay", driveId: "1qcetCeHK5V4il3iwyNVL1ilEcl6vQP-E", tags: ["overlay"] },
      { id: "p6-057", label: "P6 57", emoji: "🎁", category: "Overlay", driveId: "13ZdIkgc-QRzUbwMObOAIWlR5bzMsY6CY", tags: ["overlay"] },
      { id: "p6-058", label: "P6 58", emoji: "🎁", category: "Overlay", driveId: "110hRaAPjXaShYQD0hj2pVXQE3iwVbrNE", tags: ["overlay"] },
      { id: "p6-059", label: "P6 59", emoji: "🎁", category: "Overlay", driveId: "1ill71ylQEd-jZZ75wKmx_CB9sC_iMnoB", tags: ["overlay"] },
      { id: "p6-060", label: "P6 60", emoji: "🎁", category: "Overlay", driveId: "1v4mm_LTQorhGrcioCA3llox4nZ9-qqbg", tags: ["overlay"] },
      { id: "p6-061", label: "P6 61", emoji: "🎁", category: "Overlay", driveId: "1EkPw_LknAVEh3Ob83JE7tcKF0k_ItZjv", tags: ["overlay"] },
      { id: "p6-062", label: "P6 62", emoji: "🎁", category: "Overlay", driveId: "1iH0YQwA32AwLgQaXHYLkgStdRGmj9gzN", tags: ["overlay"] },
      { id: "p6-063", label: "P6 63", emoji: "🎁", category: "Overlay", driveId: "1D6vektlYr28Jkk-khVTcB1ZY0iUkwsrk", tags: ["overlay"] },
      { id: "p6-064", label: "P6 64", emoji: "🎁", category: "Overlay", driveId: "1YVXaYJBtuc_VgNt5in_4zyijJ9Bi0C5Z", tags: ["overlay"] },
      { id: "p6-065", label: "P6 65", emoji: "🎁", category: "Overlay", driveId: "1NIzpduy6PyNq6kXYEjypOmpmJdL_ZNJl", tags: ["overlay"] },
      { id: "p6-066", label: "P6 66", emoji: "🎁", category: "Overlay", driveId: "1dJhFbFoftRT5XvH20QN4MCRVzx5g5pXu", tags: ["overlay"] },
      { id: "p6-067", label: "P6 67", emoji: "🎁", category: "Overlay", driveId: "1z27BhfOjo558vMkMVnmYIjJb8ZrwRMN3", tags: ["overlay"] },
      { id: "p6-068", label: "P6 68", emoji: "🎁", category: "Overlay", driveId: "1ccCBHGt5ewBQV2b8mFlHalI8vLtP6Ok2", tags: ["overlay"] },
      { id: "p6-069", label: "P6 69", emoji: "🎁", category: "Overlay", driveId: "1BqpjiRGKx8wJdJRMy8a_9NrdwrbgurBD", tags: ["overlay"] },
      { id: "p6-070", label: "P6 70", emoji: "🎁", category: "Overlay", driveId: "13dyDdFqicLDXcsBPVIQy-X4Yi5Yj2aQj", tags: ["overlay"] },
      { id: "p6-071", label: "P6 71", emoji: "🎁", category: "Overlay", driveId: "1RJVvVoTofSvlZUeVcX2WjJEUvhBUms6z", tags: ["overlay"] },
      { id: "p6-072", label: "P6 72", emoji: "🎁", category: "Overlay", driveId: "1nVQnSGJpZ5UBlF2TQXBhgeGUagyR5FzU", tags: ["overlay"] },
      { id: "p6-073", label: "P6 73", emoji: "🎁", category: "Overlay", driveId: "1rKc3YwVt1A1zq35hQ9lCcXSfoFId-PMq", tags: ["overlay"] },
      { id: "p6-074", label: "P6 74", emoji: "🎁", category: "Overlay", driveId: "1VOMF4XoANQ2e4syRgUYG7ttzLvCWv3M1", tags: ["overlay"] },
      { id: "p6-075", label: "P6 75", emoji: "🎁", category: "Overlay", driveId: "1s4xTdA47zE2JFl1otodawBQKPxa1oMnm", tags: ["overlay"] },
      { id: "p6-076", label: "P6 76", emoji: "🎁", category: "Overlay", driveId: "1HgKZPKlZFJkmqqs4GvjFKkLEMbfwTtp2", tags: ["overlay"] },
      { id: "p6-077", label: "P6 77", emoji: "🎁", category: "Overlay", driveId: "1DWSCfiSid3P2TNhFqnqZf1GkiPIT67kN", tags: ["overlay"] },
      { id: "p6-078", label: "P6 78", emoji: "🎁", category: "Overlay", driveId: "1J1MX2CmWq8TuU9s04URTTkih-LQaU8pM", tags: ["overlay"] },
      { id: "p6-079", label: "P6 79", emoji: "🎁", category: "Overlay", driveId: "1RI7A4LFrW5c2rhsZk48F5GZp1X1ZSAeo", tags: ["overlay"] },
      { id: "p6-080", label: "P6 80", emoji: "🎁", category: "Overlay", driveId: "1NubqRERP8hRN6VSarfgAj_ixXcpRYlgp", tags: ["overlay"] },
      { id: "p6-081", label: "P6 81", emoji: "🎁", category: "Overlay", driveId: "1YKtc3XebGKg1WlrJlnNK4oUolp7V4qdC", tags: ["overlay"] },
      { id: "p6-082", label: "P6 82", emoji: "🎁", category: "Overlay", driveId: "11rulEE1NTsUiND0Iqcki9mRoInnXBMQt", tags: ["overlay"] },
      { id: "p6-083", label: "P6 83", emoji: "🎁", category: "Overlay", driveId: "1hh3C6qwYDNlICHIvF42yQz8FVR62aAaz", tags: ["overlay"] },
      { id: "p6-084", label: "P6 84", emoji: "🎁", category: "Overlay", driveId: "1HrMHpmoO0GBCPqTxmjnBlQbQBkBcA6WC", tags: ["overlay"] },
      { id: "p6-085", label: "P6 85", emoji: "🎁", category: "Overlay", driveId: "1y3yTmGJZ0pJ_FEH34puE1tA3rx1zIkhb", tags: ["overlay"] },
      { id: "p6-086", label: "P6 86", emoji: "🎁", category: "Overlay", driveId: "1T3tbb7fui4f1c3ojkcteLsxE9Y5XjxgW", tags: ["overlay"] },
      { id: "p6-087", label: "P6 87", emoji: "🎁", category: "Overlay", driveId: "1ZdaaxYzDfvpmBrE1Hgv1qPNUEnlsnX4k", tags: ["overlay"] },
      { id: "p6-088", label: "P6 88", emoji: "🎁", category: "Overlay", driveId: "1dODMc3wTNQxXthD8tvQqdWvRntN3fa4T", tags: ["overlay"] },
      { id: "p6-089", label: "P6 89", emoji: "🎁", category: "Overlay", driveId: "1einjKpB6aYIO9RAkHC6CcjghEzllG3CN", tags: ["overlay"] },
      { id: "p6-090", label: "P6 90", emoji: "🎁", category: "Overlay", driveId: "1uLHKT9S5emF9DrlWAxktjHpiEK7yeZJ0", tags: ["overlay"] },
      { id: "p6-091", label: "P6 91", emoji: "🎁", category: "Overlay", driveId: "1AcsLVxcgdHRaOUY-vukdVb-HY_8OFOj2", tags: ["overlay"] },
      { id: "p6-092", label: "P6 92", emoji: "🎁", category: "Overlay", driveId: "1R3G--yQoPDeKGEHVqpzP5AdOsnXsrlQn", tags: ["overlay"] },
      { id: "p6-093", label: "P6 93", emoji: "🎁", category: "Overlay", driveId: "1m-chpKNpYu00clailBuOk2KX4AdnmnAo", tags: ["overlay"] },
      { id: "p6-094", label: "P6 94", emoji: "🎁", category: "Overlay", driveId: "1rUe0wyPFZr5kplq8o-EhwYTFHY1tiYIY", tags: ["overlay"] },
      { id: "p6-095", label: "P6 95", emoji: "🎁", category: "Overlay", driveId: "1P8zBwog9fTBtqiSFM2b02MFn_VPUbsdq", tags: ["overlay"] },
      { id: "p6-096", label: "P6 96", emoji: "🎁", category: "Overlay", driveId: "1OztPO7KTHAsp96GupIQtT5iL3kPQbKgV", tags: ["overlay"] },
      { id: "p6-097", label: "P6 97", emoji: "🎁", category: "Overlay", driveId: "1go4sSZsRLF1SkYjTt5ZGwW2Xx2j7LlgB", tags: ["overlay"] },
      { id: "p6-098", label: "P6 98", emoji: "🎁", category: "Overlay", driveId: "1UUi2yCdDMCGCp_edRRr2SasYNfeChZKs", tags: ["overlay"] },
      { id: "p6-099", label: "P6 99", emoji: "🎁", category: "Overlay", driveId: "1tAff83En6zI79_WwHCZ2uhTFpiXmRQYJ", tags: ["overlay"] },
      { id: "p6-100", label: "P6 100", emoji: "🎁", category: "Overlay", driveId: "1Zzhsn92FN4jDmJMiGjtBdL3umHeV6UAa", tags: ["overlay"] },
    ],
  },
  {
    id: "pacote-7",
    label: "Pacote 7",
    emoji: "🎁",
    assets: [
      { id: "p7-001", label: "P7 1", emoji: "🎁", category: "Overlay", driveId: "1Z1pQXiIwvqf-n_pAbxfd0nWR_sKXjBNp", tags: ["overlay"] },
      { id: "p7-002", label: "P7 2", emoji: "🎁", category: "Overlay", driveId: "1vjJnTAtCx-2wEt-B0BKGwh7hYn8FkloT", tags: ["overlay"] },
      { id: "p7-003", label: "P7 3", emoji: "🎁", category: "Overlay", driveId: "1DYLW7yH6K4kUJlmjOQsFtLHqJlbOf2BP", tags: ["overlay"] },
      { id: "p7-004", label: "P7 4", emoji: "🎁", category: "Overlay", driveId: "1PlzsbZGfq7VnkKVm1G2WdBJe-Tw8WvEj", tags: ["overlay"] },
      { id: "p7-005", label: "P7 5", emoji: "🎁", category: "Overlay", driveId: "1e5B66dtrOyTPRrT4pFJn0WFos99003ZS", tags: ["overlay"] },
      { id: "p7-006", label: "P7 6", emoji: "🎁", category: "Overlay", driveId: "1ubBHyKdzm5J4wmV4FHpLtWU5-YYA7nv_", tags: ["overlay"] },
      { id: "p7-007", label: "P7 7", emoji: "🎁", category: "Overlay", driveId: "1uvHfXP123XGt3XYzyp_igklu2SwA-4_c", tags: ["overlay"] },
      { id: "p7-008", label: "P7 8", emoji: "🎁", category: "Overlay", driveId: "16AozmY50x4fLDYZUXa48DiBHGGvYa0mX", tags: ["overlay"] },
      { id: "p7-009", label: "P7 9", emoji: "🎁", category: "Overlay", driveId: "1hds-fNvP-4kyumgyJ7on-U-ZD-ZBKs7B", tags: ["overlay"] },
      { id: "p7-010", label: "P7 10", emoji: "🎁", category: "Overlay", driveId: "18b-h1Bd7zXPsG2uLoOunE25psqTs-57g", tags: ["overlay"] },
      { id: "p7-011", label: "P7 11", emoji: "🎁", category: "Overlay", driveId: "1foL5oK6OpW_lMe4dF64nnWSm4YZK9Wht", tags: ["overlay"] },
      { id: "p7-012", label: "P7 12", emoji: "🎁", category: "Overlay", driveId: "1msac8YsSTMz1k8xnhOiIq2PZmbdXVMC7", tags: ["overlay"] },
      { id: "p7-013", label: "P7 13", emoji: "🎁", category: "Overlay", driveId: "1HLI31BcUK6cC0uY0XeFnGcKe4vNQ_V7f", tags: ["overlay"] },
      { id: "p7-014", label: "P7 14", emoji: "🎁", category: "Overlay", driveId: "12zEKC1bWmcsgW7wi-thE5iKZIBNll2eF", tags: ["overlay"] },
      { id: "p7-015", label: "P7 15", emoji: "🎁", category: "Overlay", driveId: "13meb8W13SvEK-qOIGNyB_XuOVUbQgQcV", tags: ["overlay"] },
      { id: "p7-016", label: "P7 16", emoji: "🎁", category: "Overlay", driveId: "1LtTJ-pvQlReSwhqfgss5yn9X7W1rojCs", tags: ["overlay"] },
      { id: "p7-017", label: "P7 17", emoji: "🎁", category: "Overlay", driveId: "1sOJyXGBoUTnvD-JssXvfG0ZkwKJIxgtd", tags: ["overlay"] },
      { id: "p7-018", label: "P7 18", emoji: "🎁", category: "Overlay", driveId: "1t34TWTFvqfQZ8mcGwB7SmNL1W4jmB-p3", tags: ["overlay"] },
      { id: "p7-019", label: "P7 19", emoji: "🎁", category: "Overlay", driveId: "1OK9S4B434rcZXGj-YLhPGdjaEA0wQi90", tags: ["overlay"] },
      { id: "p7-020", label: "P7 20", emoji: "🎁", category: "Overlay", driveId: "1XEwQstrLyMAeSMIOijGhuE1NySve2E_A", tags: ["overlay"] },
      { id: "p7-021", label: "P7 21", emoji: "🎁", category: "Overlay", driveId: "1fOZ35M3MhPmHwm1bmyiA4o0J4Ol22V-c", tags: ["overlay"] },
      { id: "p7-022", label: "P7 22", emoji: "🎁", category: "Overlay", driveId: "1yUUC0WDt5mX8sQPSlvy-4NAYJCioAKfS", tags: ["overlay"] },
      { id: "p7-023", label: "P7 23", emoji: "🎁", category: "Overlay", driveId: "1nM3YyQ3rVqWwILDFVTEc8lrhqF5Y0xoo", tags: ["overlay"] },
      { id: "p7-024", label: "P7 24", emoji: "🎁", category: "Overlay", driveId: "1nRuml8K4ppy-GGPkb0YYSxUIhv1DwPNT", tags: ["overlay"] },
      { id: "p7-025", label: "P7 25", emoji: "🎁", category: "Overlay", driveId: "1LyjK9o5Zx_-Zuez5za_lRCdGNEBHxCzE", tags: ["overlay"] },
      { id: "p7-026", label: "P7 26", emoji: "🎁", category: "Overlay", driveId: "1XE8zXNNiv1Ae9ig2C_qcBlljdCXrI0zn", tags: ["overlay"] },
      { id: "p7-027", label: "P7 27", emoji: "🎁", category: "Overlay", driveId: "1eCGGUPl8Jy-hd50V1Si4-suGVY_Y-m9d", tags: ["overlay"] },
      { id: "p7-028", label: "P7 28", emoji: "🎁", category: "Overlay", driveId: "1fbzqfMn7rErCUtDUxpAgTfGbiXAUtRdS", tags: ["overlay"] },
      { id: "p7-029", label: "P7 29", emoji: "🎁", category: "Overlay", driveId: "1XB8SWQbob6MZkdkemTnUg5kJbSb5aBZA", tags: ["overlay"] },
      { id: "p7-030", label: "P7 30", emoji: "🎁", category: "Overlay", driveId: "1-suI4sIc13IpYY4Xg9sClKo01wMSWKUd", tags: ["overlay"] },
      { id: "p7-031", label: "P7 31", emoji: "🎁", category: "Overlay", driveId: "1A_aBsoEw99B_ec1tqXPOruU8Bo0tk3mi", tags: ["overlay"] },
      { id: "p7-032", label: "P7 32", emoji: "🎁", category: "Overlay", driveId: "1iwbInTwjTuvuMuNwAhM6ooBu94j212v2", tags: ["overlay"] },
      { id: "p7-033", label: "P7 33", emoji: "🎁", category: "Overlay", driveId: "13x0zMwSteS7pEXm4bGz8Gm9xQnjE5d6k", tags: ["overlay"] },
      { id: "p7-034", label: "P7 34", emoji: "🎁", category: "Overlay", driveId: "19NDCCnrQNTo88WuoguEYg-dS-IOqB2ZJ", tags: ["overlay"] },
      { id: "p7-035", label: "P7 35", emoji: "🎁", category: "Overlay", driveId: "100OTFGCLY0-YPwFR0B1m3uPm6oD5KBkh", tags: ["overlay"] },
      { id: "p7-036", label: "P7 36", emoji: "🎁", category: "Overlay", driveId: "1BPjNPiedRIF0gak9mAPmEv7kvbTfFpha", tags: ["overlay"] },
      { id: "p7-037", label: "P7 37", emoji: "🎁", category: "Overlay", driveId: "1K2vLodgpuZdQ6NE2JptJ2PKAO3saP1pM", tags: ["overlay"] },
      { id: "p7-038", label: "P7 38", emoji: "🎁", category: "Overlay", driveId: "1r7hitegD7VY9kbDQv-NMBFRtRoCCkDR4", tags: ["overlay"] },
      { id: "p7-039", label: "P7 39", emoji: "🎁", category: "Overlay", driveId: "1FlUmmLHDfEcmvjlEW6b0MkmjY-cjewfz", tags: ["overlay"] },
      { id: "p7-040", label: "P7 40", emoji: "🎁", category: "Overlay", driveId: "1A8j1c0YxeINBL2H6lkmIEudKcgvxUg9m", tags: ["overlay"] },
      { id: "p7-041", label: "P7 41", emoji: "🎁", category: "Overlay", driveId: "1NhJiPGU6JI8F7YEoRbz29WoYuXbn70ob", tags: ["overlay"] },
      { id: "p7-042", label: "P7 42", emoji: "🎁", category: "Overlay", driveId: "16UeHcoAptnv1iesjUmH9TBOT6_L94MQ_", tags: ["overlay"] },
      { id: "p7-043", label: "P7 43", emoji: "🎁", category: "Overlay", driveId: "1q3lch6YDtabl-uKo6P0qiE-789U4FdvD", tags: ["overlay"] },
      { id: "p7-044", label: "P7 44", emoji: "🎁", category: "Overlay", driveId: "1_8PqI_mJgHY6CN-9v1z7KbGqDpchV8Y0", tags: ["overlay"] },
      { id: "p7-045", label: "P7 45", emoji: "🎁", category: "Overlay", driveId: "19rWVI6wo4ZNXVW1nR-4gwJOn4rHKVXua", tags: ["overlay"] },
      { id: "p7-046", label: "P7 46", emoji: "🎁", category: "Overlay", driveId: "1nNr5CpIcQFN39FL1Bhktz1-ieBJOyssy", tags: ["overlay"] },
      { id: "p7-047", label: "P7 47", emoji: "🎁", category: "Overlay", driveId: "1vTC2qU7kVcmo6109tcnMfQ3l9ztsF7cH", tags: ["overlay"] },
      { id: "p7-048", label: "P7 48", emoji: "🎁", category: "Overlay", driveId: "1TLBbcB-MG9OI2p0oNnntQdIxGfWHJgSM", tags: ["overlay"] },
      { id: "p7-049", label: "P7 49", emoji: "🎁", category: "Overlay", driveId: "1BIAKuqFaaoEbOdLbVoEIakWnEumPR6UC", tags: ["overlay"] },
      { id: "p7-050", label: "P7 50", emoji: "🎁", category: "Overlay", driveId: "1cExs5GuBvYhc0erex2GhEY8ZecljXkGz", tags: ["overlay"] },
      { id: "p7-051", label: "P7 51", emoji: "🎁", category: "Overlay", driveId: "1KwRMikrNthZjrC3FqVY93fI-B-awzBkh", tags: ["overlay"] },
      { id: "p7-052", label: "P7 52", emoji: "🎁", category: "Overlay", driveId: "1pKzLhc0UT_Q1ealPIMU1OFBmy_09edZE", tags: ["overlay"] },
      { id: "p7-053", label: "P7 53", emoji: "🎁", category: "Overlay", driveId: "1n3R3O8hXKm6Y1lZRCZXuC9NbnpLNVysu", tags: ["overlay"] },
      { id: "p7-054", label: "P7 54", emoji: "🎁", category: "Overlay", driveId: "1vk1VYx04jKk6ZalLdYC5PE6QGkZfS799", tags: ["overlay"] },
      { id: "p7-055", label: "P7 55", emoji: "🎁", category: "Overlay", driveId: "1iRDVVKMc2efFxwqccYBiFqQw8bb0kKx2", tags: ["overlay"] },
      { id: "p7-056", label: "P7 56", emoji: "🎁", category: "Overlay", driveId: "1mJeMw00dc-j1h66qGhSEhy8xJfsg10Pb", tags: ["overlay"] },
      { id: "p7-057", label: "P7 57", emoji: "🎁", category: "Overlay", driveId: "17mRJxev2SPDeM1HtwngOiq-HFmU51p5J", tags: ["overlay"] },
      { id: "p7-058", label: "P7 58", emoji: "🎁", category: "Overlay", driveId: "1vHUlwbxELTC6rwveTeJts8U7k_sMji2S", tags: ["overlay"] },
      { id: "p7-059", label: "P7 59", emoji: "🎁", category: "Overlay", driveId: "1DWG4M8zfUKzz6TuVu5JYhpCCBizi5COR", tags: ["overlay"] },
      { id: "p7-060", label: "P7 60", emoji: "🎁", category: "Overlay", driveId: "1La5BQO1ZkZxEhZvEEZTQpImjW7r6QzfF", tags: ["overlay"] },
      { id: "p7-061", label: "P7 61", emoji: "🎁", category: "Overlay", driveId: "1f75eMHQowIucwUz8gmId28KF0zNy_vwr", tags: ["overlay"] },
      { id: "p7-062", label: "P7 62", emoji: "🎁", category: "Overlay", driveId: "1gm_URSCIj4v2oR7vg0rHY0pKjtyciAcY", tags: ["overlay"] },
      { id: "p7-063", label: "P7 63", emoji: "🎁", category: "Overlay", driveId: "1mGaTI0tAyoIssrgLY6bjENvXk6daHNpq", tags: ["overlay"] },
      { id: "p7-064", label: "P7 64", emoji: "🎁", category: "Overlay", driveId: "1sHM706WML8xEQoClIi6KGO9vsD41Kn5k", tags: ["overlay"] },
      { id: "p7-065", label: "P7 65", emoji: "🎁", category: "Overlay", driveId: "15R2XbSQJKIu2Nm0Uo32eIw41fKB6PVGA", tags: ["overlay"] },
      { id: "p7-066", label: "P7 66", emoji: "🎁", category: "Overlay", driveId: "163-G8rAg4BQKgSXrscELFAVYMSs7AFBf", tags: ["overlay"] },
      { id: "p7-067", label: "P7 67", emoji: "🎁", category: "Overlay", driveId: "1Vp9Wzt8vZa-P3sX7ayJqJE16YNML_Fpz", tags: ["overlay"] },
      { id: "p7-068", label: "P7 68", emoji: "🎁", category: "Overlay", driveId: "1gMUGjxJg9UNWCSfoIMAlxZ3b_x9a4bQh", tags: ["overlay"] },
      { id: "p7-069", label: "P7 69", emoji: "🎁", category: "Overlay", driveId: "1gzxGB0fgFdRwi9rykoMQ1ra_XVAy7UW3", tags: ["overlay"] },
      { id: "p7-070", label: "P7 70", emoji: "🎁", category: "Overlay", driveId: "1oNbYH87WSEvBJZpqLkQcQOGxcMTPweix", tags: ["overlay"] },
      { id: "p7-071", label: "P7 71", emoji: "🎁", category: "Overlay", driveId: "1bwUs9kdHj9bXRd93mfVcEAH1d81fk3Yz", tags: ["overlay"] },
      { id: "p7-072", label: "P7 72", emoji: "🎁", category: "Overlay", driveId: "1feIkPUs86bNBlq-rFEUt_LWgQq-eo1up", tags: ["overlay"] },
      { id: "p7-073", label: "P7 73", emoji: "🎁", category: "Overlay", driveId: "1edJGJKQFg_auroGFrDjLvy_IGYgf1910", tags: ["overlay"] },
      { id: "p7-074", label: "P7 74", emoji: "🎁", category: "Overlay", driveId: "1uqmstBiRZeyTZsfdJHnyO2sKSYfrLnNG", tags: ["overlay"] },
      { id: "p7-075", label: "P7 75", emoji: "🎁", category: "Overlay", driveId: "1d5W-9EwzCO-03474mgMd40ceCCkJoCsE", tags: ["overlay"] },
      { id: "p7-076", label: "P7 76", emoji: "🎁", category: "Overlay", driveId: "13fW3df_e1YynKT3EpykAKKOCor5s6vZB", tags: ["overlay"] },
      { id: "p7-077", label: "P7 77", emoji: "🎁", category: "Overlay", driveId: "1xDLPwy8kTYaJ6nqk-ofxoj7WZnmXofmf", tags: ["overlay"] },
      { id: "p7-078", label: "P7 78", emoji: "🎁", category: "Overlay", driveId: "1gOaheA9XVoCcTP4XQm1Mt10LTayrUpBC", tags: ["overlay"] },
      { id: "p7-079", label: "P7 79", emoji: "🎁", category: "Overlay", driveId: "1a9eZ8-Q_90XyktLnHQV_C5ZuguepkgAv", tags: ["overlay"] },
      { id: "p7-080", label: "P7 80", emoji: "🎁", category: "Overlay", driveId: "1ZXmgO-fPt0vgEFYAnoOaSOkItXLbsW64", tags: ["overlay"] },
      { id: "p7-081", label: "P7 81", emoji: "🎁", category: "Overlay", driveId: "1tQ5t5oAPq4ouWtRARj7BexUN5dfoShpc", tags: ["overlay"] },
      { id: "p7-082", label: "P7 82", emoji: "🎁", category: "Overlay", driveId: "1-tDxP5ftVtXcxPrbD4Qv8BF902RLwmme", tags: ["overlay"] },
      { id: "p7-083", label: "P7 83", emoji: "🎁", category: "Overlay", driveId: "1jWzqKwf0qRntJPnFFUkVM1j4cCTmvTGu", tags: ["overlay"] },
      { id: "p7-084", label: "P7 84", emoji: "🎁", category: "Overlay", driveId: "1Hr4iXNcioiRa33CzrjKoBuL_W4vmCHBr", tags: ["overlay"] },
      { id: "p7-085", label: "P7 85", emoji: "🎁", category: "Overlay", driveId: "1ZQiKNOBrmufYYaeNcNV_4KKs3zuGocT9", tags: ["overlay"] },
      { id: "p7-086", label: "P7 86", emoji: "🎁", category: "Overlay", driveId: "1Rl0NA469TTnheyvNkoKziyV5XjnQr5bt", tags: ["overlay"] },
      { id: "p7-087", label: "P7 87", emoji: "🎁", category: "Overlay", driveId: "1x1p6YUtGrvxUeMw8apXDffYxk0oeLfSF", tags: ["overlay"] },
      { id: "p7-088", label: "P7 88", emoji: "🎁", category: "Overlay", driveId: "1aatY06s3eBjh16ft1Tc0U0sPiW5CJdtN", tags: ["overlay"] },
      { id: "p7-089", label: "P7 89", emoji: "🎁", category: "Overlay", driveId: "1m90dbqO4vIIylmzmfLmadgP0C5rGUDW-", tags: ["overlay"] },
      { id: "p7-090", label: "P7 90", emoji: "🎁", category: "Overlay", driveId: "1MH0m0i1zgcPodSskSYaNuJzRKNR5IhCi", tags: ["overlay"] },
      { id: "p7-091", label: "P7 91", emoji: "🎁", category: "Overlay", driveId: "1aF-kq7Kn0blDdWSDJkaZ9JfDxwPaVP8G", tags: ["overlay"] },
      { id: "p7-092", label: "P7 92", emoji: "🎁", category: "Overlay", driveId: "12JPvXIWW6Kd8Ly3jVQrPNQwmywgOXKFW", tags: ["overlay"] },
      { id: "p7-093", label: "P7 93", emoji: "🎁", category: "Overlay", driveId: "1n6MTdMxAU394v79WTkHqv3ptwV49zqK3", tags: ["overlay"] },
      { id: "p7-094", label: "P7 94", emoji: "🎁", category: "Overlay", driveId: "16lS6NTfonABgkfhpOfBi79z7qO8oNZvS", tags: ["overlay"] },
      { id: "p7-095", label: "P7 95", emoji: "🎁", category: "Overlay", driveId: "1xvtGcm65TLd0wpE0oZ4uuoxYpZ5v3D9C", tags: ["overlay"] },
      { id: "p7-096", label: "P7 96", emoji: "🎁", category: "Overlay", driveId: "1rfByUBfRRW87lSqe3LEGH6dKBFrRQhDm", tags: ["overlay"] },
      { id: "p7-097", label: "P7 97", emoji: "🎁", category: "Overlay", driveId: "11sMaQ14-Cz8J3Yi28Rf5hm8TUxbqPJLN", tags: ["overlay"] },
      { id: "p7-098", label: "P7 98", emoji: "🎁", category: "Overlay", driveId: "1zaIjV6aN7lQp9UpYgCz8XJf3WhotCrPQ", tags: ["overlay"] },
      { id: "p7-099", label: "P7 99", emoji: "🎁", category: "Overlay", driveId: "1CxdP2mRa_54SDiEh-K-uTQlmllhFHv4e", tags: ["overlay"] },
      { id: "p7-100", label: "P7 100", emoji: "🎁", category: "Overlay", driveId: "1UXjmue4Zb4ntI5K3R-dcVAy03XU224Di", tags: ["overlay"] },
      { id: "p7-101", label: "P7 101", emoji: "🎁", category: "Overlay", driveId: "1YOV5nsOkeV2LhOUZNyJhV7iiStCo4n-e", tags: ["overlay"] },
      { id: "p7-102", label: "P7 102", emoji: "🎁", category: "Overlay", driveId: "1s4kQnwQ4XKzxFnca1DvEeBEZyD4AtyFq", tags: ["overlay"] },
      { id: "p7-103", label: "P7 103", emoji: "🎁", category: "Overlay", driveId: "18Yspf1QDPZueHuMGVuk16jEzLPMhSHNa", tags: ["overlay"] },
      { id: "p7-104", label: "P7 104", emoji: "🎁", category: "Overlay", driveId: "1zdpPdou7Jd0fbUHVbcizgyUWO4gDj4BI", tags: ["overlay"] },
      { id: "p7-105", label: "P7 105", emoji: "🎁", category: "Overlay", driveId: "1LBBmfniXrdaDq-j6bWw8hHb4Pu4hTjJI", tags: ["overlay"] },
      { id: "p7-106", label: "P7 106", emoji: "🎁", category: "Overlay", driveId: "1jcxhqrkRfBh97BmCvRwWIsntKERQ9JFW", tags: ["overlay"] },
      { id: "p7-107", label: "P7 107", emoji: "🎁", category: "Overlay", driveId: "1rFjZT9FZFONa5G7PhBTZv_ufnrPmw1e5", tags: ["overlay"] },
      { id: "p7-108", label: "P7 108", emoji: "🎁", category: "Overlay", driveId: "1P3qagz5vf-Bqlcs4eq1z7-SUU9bfP_u0", tags: ["overlay"] },
      { id: "p7-109", label: "P7 109", emoji: "🎁", category: "Overlay", driveId: "1Fg-sDPjIogXNa_hb4NaOPjvor3t9pSiH", tags: ["overlay"] },
      { id: "p7-110", label: "P7 110", emoji: "🎁", category: "Overlay", driveId: "1-W1THSuL6iXTSN2UE4hlKUPS0CXrZ9E9", tags: ["overlay"] },
      { id: "p7-111", label: "P7 111", emoji: "🎁", category: "Overlay", driveId: "1UXI1SfKNYSUnYqUeeb9wDPdbcD7uuKVH", tags: ["overlay"] },
      { id: "p7-112", label: "P7 112", emoji: "🎁", category: "Overlay", driveId: "1a_QY3QxMvjp5UMhA4iSF8FUPXT3D3fqU", tags: ["overlay"] },
      { id: "p7-113", label: "P7 113", emoji: "🎁", category: "Overlay", driveId: "17u5yQzVeyygZ3ETdWqBsly4rJ_pURKSn", tags: ["overlay"] },
      { id: "p7-114", label: "P7 114", emoji: "🎁", category: "Overlay", driveId: "1Cj4JYGjtUs_SdqTj1Mj-ovm8ZCYpEYHO", tags: ["overlay"] },
    ],
  },
  {
    id: "cinema",
    label: "Cinema",
    emoji: "🎥",
    assets: [
      { id: "ov-cin-001", label: "Cinema 1", emoji: "🎥", category: "Overlay", driveId: "1jMFPahIKpZp02B_OVh-zBmlfCdEXyXjz", tags: ["overlay", "cinema"] },
      { id: "ov-cin-002", label: "Cinema 2", emoji: "🎥", category: "Overlay", driveId: "1YmaYn0OovzLjllHwm91_bmfrL3N_-UwH", tags: ["overlay", "cinema"] },
      { id: "ov-cin-003", label: "Cinema 3", emoji: "🎥", category: "Overlay", driveId: "14Y17uYj9QXs8nRsoSXZWy0l8Ig6K0JAj", tags: ["overlay", "cinema"] },
      { id: "ov-cin-004", label: "Cinema 4", emoji: "🎥", category: "Overlay", driveId: "1eKBBA6ngc3ZDN61GN6iWIV7-9CQDlArH", tags: ["overlay", "cinema"] },
      { id: "ov-cin-005", label: "Cinema 5", emoji: "🎥", category: "Overlay", driveId: "1Pg2nwSabu4Iz9E-7Uq_Y_CjIZL02t_vm", tags: ["overlay", "cinema"] },
      { id: "ov-cin-006", label: "Cinema 6", emoji: "🎥", category: "Overlay", driveId: "1bn_2X002cADVHRlBM2JA2iHe398RslIW", tags: ["overlay", "cinema"] },
      { id: "ov-cin-007", label: "Cinema 7", emoji: "🎥", category: "Overlay", driveId: "1M40mannXd4oGK4sRwxMU_QsqV51v2sVU", tags: ["overlay", "cinema"] },
      { id: "ov-cin-008", label: "Cinema 8", emoji: "🎥", category: "Overlay", driveId: "1G4hYm1rL8O5lM9X9f6mH-pG5N8vX6B_z", tags: ["overlay", "cinema"] },
      { id: "ov-cin-009", label: "Cinema 9", emoji: "🎥", category: "Overlay", driveId: "1H7hYm1rL8O5lM9X9f6mH-pG5N8vX6B_z", tags: ["overlay", "cinema"] },
      { id: "ov-cin-010", label: "Cinema 10", emoji: "🎥", category: "Overlay", driveId: "1I7hYm1rL8O5lM9X9f6mH-pG5N8vX6B_z", tags: ["overlay", "cinema"] },
      { id: "ov-cin-011", label: "Cinema 11", emoji: "🎥", category: "Overlay", driveId: "1J7hYm1rL8O5lM9X9f6mH-pG5N8vX6B_z", tags: ["overlay", "cinema"] },
    ],
  },
  {
    id: "overlay-burn",
    label: "Overlay Burn",
    emoji: "🔥",
    assets: [
      { id: "ov-burn-001", label: "Burn 1", emoji: "🔥", category: "Overlay", driveId: "1IBeGJ6mpBmsYVB4PzQl90Un0wsmzS8ef", tags: ["overlay", "burn"] },
      { id: "ov-burn-002", label: "Burn 2", emoji: "🔥", category: "Overlay", driveId: "102HB0MFipeU8beX79_8vTixvdzv3zy7g", tags: ["overlay", "burn"] },
      { id: "ov-burn-003", label: "Burn 3", emoji: "🔥", category: "Overlay", driveId: "1uRDRJzUCCL3zDlgCtYne9Mioc2y7A1La", tags: ["overlay", "burn"] },
      { id: "ov-burn-004", label: "Burn 4", emoji: "🔥", category: "Overlay", driveId: "1JwjHBuZs2oYLftDhJHQZrPOn-HL0Bux-", tags: ["overlay", "burn"] },
      { id: "ov-burn-005", label: "Burn 5", emoji: "🔥", category: "Overlay", driveId: "19lPiOr_9dzhsRe1MlnuRr3iseQiNqb3Y", tags: ["overlay", "burn"] },
      { id: "ov-burn-006", label: "Burn 6", emoji: "🔥", category: "Overlay", driveId: "1-CttusIGBvL77B4116VF7I8Yf6y-IahS", tags: ["overlay", "burn"] },
      { id: "ov-burn-007", label: "Burn 7", emoji: "🔥", category: "Overlay", driveId: "1ZrZsPJRf3_SxU1tP1PgVwn5woKtVxbLb", tags: ["overlay", "burn"] },
      { id: "ov-burn-008", label: "Burn 8", emoji: "🔥", category: "Overlay", driveId: "1-ZrZsPJRf3_SxU1tP1PgVwn5woKtVxbLb", tags: ["overlay", "burn"] },
    ],
  },
  {
    id: "simbolos",
    label: "Símbolos",
    emoji: "🔣",
    assets: [
      { id: "ov-sim-001", label: "Símbolo 1", emoji: "🔣", category: "Overlay", driveId: "1AltEmCNkAXXKTJ6n3HXAtHCiqdSg7-Ze", tags: ["overlay", "simbolos"] },
      { id: "ov-sim-002", label: "Símbolo 2", emoji: "🔣", category: "Overlay", driveId: "1mRlJCk3BIhuXiB9vNSG2o4xvbzwppeHH", tags: ["overlay", "simbolos"] },
      { id: "ov-sim-003", label: "Símbolo 3", emoji: "🔣", category: "Overlay", driveId: "1G0cMYO8gpEK15Ju7vPGnUgvhn6fo0Ja1", tags: ["overlay", "simbolos"] },
      { id: "ov-sim-004", label: "Símbolo 4", emoji: "🔣", category: "Overlay", driveId: "1YrDkQohxfMNQdmDBEb3qHsBqhCJXo9Qo", tags: ["overlay", "simbolos"] },
      { id: "ov-sim-005", label: "Símbolo 5", emoji: "🔣", category: "Overlay", driveId: "1gUE_PhAO_Ydcs6Y_8LT-1jspOkoiigMe", tags: ["overlay", "simbolos"] },
      { id: "ov-sim-006", label: "Símbolo 6", emoji: "🔣", category: "Overlay", driveId: "1l47YRzZZvpef5mkRFMASzYwZwmozmls9", tags: ["overlay", "simbolos"] },
      { id: "ov-sim-007", label: "Símbolo 7", emoji: "🔣", category: "Overlay", driveId: "1FDhHlQxbTGJ3ZmGk8PR97DTenY3n1XcZ", tags: ["overlay", "simbolos"] },
      { id: "ov-sim-008", label: "Símbolo 8", emoji: "🔣", category: "Overlay", driveId: "1HFDhHlQxbTGJ3ZmGk8PR97DTenY3n1XcZ", tags: ["overlay", "simbolos"] },
      { id: "ov-sim-009", label: "Símbolo 9", emoji: "🔣", category: "Overlay", driveId: "1IFDhHlQxbTGJ3ZmGk8PR97DTenY3n1XcZ", tags: ["overlay", "simbolos"] },
    ],
  },
  {
    id: "space-dark",
    label: "Space · Dark · Geometric · Luzes",
    emoji: "🌌",
    assets: [
      { id: "ov-spa-001", label: "Space 1", emoji: "🌌", category: "Overlay", driveId: "1TYgmHvJQOsF0ua9x_nT-6dzEPAh55nR1", tags: ["overlay", "space"] },
      { id: "ov-spa-002", label: "Space 2", emoji: "🌌", category: "Overlay", driveId: "1dCRGf0rEPMTjqISYkeFLptuKwSBhF4Wu", tags: ["overlay", "space"] },
      { id: "ov-spa-003", label: "Space 3", emoji: "🌌", category: "Overlay", driveId: "1YmKs-hr5XvnVel2iZC1MiwWBUihjX7Q8", tags: ["overlay", "space"] },
      { id: "ov-spa-004", label: "Space 4", emoji: "🌌", category: "Overlay", driveId: "1DekNdOWXzlph9IZrG4Y6Z79cYrIvEHQG", tags: ["overlay", "space"] },
      { id: "ov-spa-005", label: "Space 5", emoji: "🌌", category: "Overlay", driveId: "1f812ADT37-1wcN0SVOT4UtuaYpm-IjKD", tags: ["overlay", "space"] },
      { id: "ov-spa-006", label: "Space 6", emoji: "🌌", category: "Overlay", driveId: "1gBIlxaOKmPZgaOOaM1hHgpJYGK7c0Hkr", tags: ["overlay", "space"] },
      { id: "ov-spa-007", label: "Space 7", emoji: "🌌", category: "Overlay", driveId: "1l8wJMhHaCtldjr3dObiisDyJt2RAYt-z", tags: ["overlay", "space"] },
      { id: "ov-spa-008", label: "Space 8", emoji: "🌌", category: "Overlay", driveId: "1m8wJMhHaCtldjr3dObiisDyJt2RAYt-z", tags: ["overlay", "space"] },
      { id: "ov-spa-009", label: "Space 9", emoji: "🌌", category: "Overlay", driveId: "1n8wJMhHaCtldjr3dObiisDyJt2RAYt-z", tags: ["overlay", "space"] },
      { id: "ov-spa-010", label: "Space 10", emoji: "🌌", category: "Overlay", driveId: "1o8wJMhHaCtldjr3dObiisDyJt2RAYt-z", tags: ["overlay", "space"] },
      { id: "ov-spa-011", label: "Space 11", emoji: "🌌", category: "Overlay", driveId: "1p8wJMhHaCtldjr3dObiisDyJt2RAYt-z", tags: ["overlay", "space"] },
      { id: "ov-spa-012", label: "Space 12", emoji: "🌌", category: "Overlay", driveId: "1q8wJMhHaCtldjr3dObiisDyJt2RAYt-z", tags: ["overlay", "space"] },
      { id: "ov-spa-013", label: "Space 13", emoji: "🌌", category: "Overlay", driveId: "1r8wJMhHaCtldjr3dObiisDyJt2RAYt-z", tags: ["overlay", "space"] },
      { id: "ov-spa-014", label: "Space 14", emoji: "🌌", category: "Overlay", driveId: "1s8wJMhHaCtldjr3dObiisDyJt2RAYt-z", tags: ["overlay", "space"] },
      { id: "ov-spa-015", label: "Space 15", emoji: "🌌", category: "Overlay", driveId: "1t8wJMhHaCtldjr3dObiisDyJt2RAYt-z", tags: ["overlay", "space"] },
      { id: "ov-spa-016", label: "Space 16", emoji: "🌌", category: "Overlay", driveId: "1u8wJMhHaCtldjr3dObiisDyJt2RAYt-z", tags: ["overlay", "space"] },
      { id: "ov-spa-017", label: "Space 17", emoji: "🌌", category: "Overlay", driveId: "1v8wJMhHaCtldjr3dObiisDyJt2RAYt-z", tags: ["overlay", "space"] },
      { id: "ov-spa-018", label: "Space 18", emoji: "🌌", category: "Overlay", driveId: "1w8wJMhHaCtldjr3dObiisDyJt2RAYt-z", tags: ["overlay", "space"] },
      { id: "ov-spa-019", label: "Space 19", emoji: "🌌", category: "Overlay", driveId: "1x8wJMhHaCtldjr3dObiisDyJt2RAYt-z", tags: ["overlay", "space"] },
    ],
  },
  {
    id: "mobile",
    label: "#1 Mobile",
    emoji: "📱",
    assets: [
      { id: "ov-mob-001", label: "Mobile 1", emoji: "📱", category: "Overlay", driveId: "1nM3YyQ3rVqWwILDFVTEc8lrhqF5Y0xoo", tags: ["overlay", "mobile"] },
      { id: "ov-mob-002", label: "Mobile 2", emoji: "📱", category: "Overlay", driveId: "1yUUC0WDt5mX8sQPSlvy-4NAYJCioAKfS", tags: ["overlay", "mobile"] },
      { id: "ov-mob-003", label: "Mobile 3", emoji: "📱", category: "Overlay", driveId: "1fOZ35M3MhPmHwm1bmyiA4o0J4Ol22V-c", tags: ["overlay", "mobile"] },
      { id: "ov-mob-004", label: "Mobile 4", emoji: "📱", category: "Overlay", driveId: "1XEwQstrLyMAeSMIOijGhuE1NySve2E_A", tags: ["overlay", "mobile"] },
      { id: "ov-mob-005", label: "Mobile 5", emoji: "📱", category: "Overlay", driveId: "1OK9S4B434rcZXGj-YLhPGdjaEA0wQi90", tags: ["overlay", "mobile"] },
    ],
  },
  {
    id: "diversos",
    label: "Overlay Diversos (Geral)",
    emoji: "✨",
    assets: [
      { id: "ov-div-001", label: "Diversos 1", emoji: "✨", category: "Overlay", driveId: "1t34TWTFvqfQZ8mcGwB7SmNL1W4jmB-p3", tags: ["overlay", "diversos"] },
      { id: "ov-div-002", label: "Diversos 2", emoji: "✨", category: "Overlay", driveId: "1sOJyXGBoUTnvD-JssXvfG0ZkwKJIxgtd", tags: ["overlay", "diversos"] },
      { id: "ov-div-003", label: "Diversos 3", emoji: "✨", category: "Overlay", driveId: "1LtTJ-pvQlReSwhqfgss5yn9X7W1rojCs", tags: ["overlay", "diversos"] },
      { id: "ov-div-004", label: "Diversos 4", emoji: "✨", category: "Overlay", driveId: "13meb8W13SvEK-qOIGNyB_XuOVUbQgQcV", tags: ["overlay", "diversos"] },
      { id: "ov-div-005", label: "Diversos 5", emoji: "✨", category: "Overlay", driveId: "12zEKC1bWmcsgW7wi-thE5iKZIBNll2eF", tags: ["overlay", "diversos"] },
    ],
  },
];

/* ── Effect groups ── */
type EffectGroup = { id: string; label: string; emoji: string; assets: Asset[] };

const effectGroups: EffectGroup[] = [
  {
    id: "efeitos-visuais",
    label: "Efeitos Visuais",
    emoji: "🎆",
    assets: [
      { id: "ef-vis-001", label: "Visual 1", emoji: "🎆", category: "Efeito", driveId: "1dODMc3wTNQxXthD8tvQqdWvRntN3fa4T", tags: ["efeito", "visual"] },
      { id: "ef-vis-002", label: "Visual 2", emoji: "🎆", category: "Efeito", driveId: "1T3tbb7fui4f1c3ojkcteLsxE9Y5XjxgW", tags: ["efeito", "visual"] },
      { id: "ef-vis-003", label: "Visual 3", emoji: "🎆", category: "Efeito", driveId: "1y3yTmGJZ0pJ_FEH34puE1tA3rx1zIkhb", tags: ["efeito", "visual"] },
      { id: "ef-vis-004", label: "Visual 4", emoji: "🎆", category: "Efeito", driveId: "1uLHKT9S5emF9DrlWAxktjHpiEK7yeZJ0", tags: ["efeito", "visual"] },
      { id: "ef-vis-005", label: "Visual 5", emoji: "🎆", category: "Efeito", driveId: "1rUe0wyPFZr5kplq8o-EhwYTFHY1tiYIY", tags: ["efeito", "visual"] },
      { id: "ef-vis-006", label: "Visual 6", emoji: "🎆", category: "Efeito", driveId: "1AcsLVxcgdHRaOUY-vukdVb-HY_8OFOj2", tags: ["efeito", "visual"] },
      { id: "ef-vis-007", label: "Visual 7", emoji: "🎆", category: "Efeito", driveId: "1OztPO7KTHAsp96GupIQtT5iL3kPQbKgV", tags: ["efeito", "visual"] },
      { id: "ef-vis-008", label: "Visual 8", emoji: "🎆", category: "Efeito", driveId: "1einjKpB6aYIO9RAkHC6CcjghEzllG3CN", tags: ["efeito", "visual"] },
    ],
  },
  {
    id: "fogo",
    label: "Fogo",
    emoji: "🔥",
    assets: [
      { id: "ef-fog-001", label: "Fogo 1", emoji: "🔥", category: "Efeito", driveId: "1qQhWrMTTZmcrlkaceoTzXXKjpi65is3f", tags: ["efeito", "fogo"] },
      { id: "ef-fog-002", label: "Fogo 2", emoji: "🔥", category: "Efeito", driveId: "1eqUEOB8U3vt2plnRSwmeN4py4b0zldkQ", tags: ["efeito", "fogo"] },
      { id: "ef-fog-003", label: "Fogo 3", emoji: "🔥", category: "Efeito", driveId: "1vvt1vDzNAMNw1hJ3llO0ehIBE6-JKFRX", tags: ["efeito", "fogo"] },
      { id: "ef-fog-004", label: "Fogo 4", emoji: "🔥", category: "Efeito", driveId: "1BavqC_EG50III6EwjPtjO5VVoAzlHhBU", tags: ["efeito", "fogo"] },
      { id: "ef-fog-005", label: "Fogo 5", emoji: "🔥", category: "Efeito", driveId: "1VQjo8j3DImMwKX5x5MujxzQffRcXaWpU", tags: ["efeito", "fogo"] },
    ],
  },
  {
    id: "glitch",
    label: "Glitch Overlay Transition",
    emoji: "⚡",
    assets: [
      { id: "ef-gli-001", label: "Glitch 1", emoji: "⚡", category: "Efeito", driveId: "1fOPRw5ge42F70joveHhff36Syx8EFEiE", tags: ["efeito", "glitch"] },
      { id: "ef-gli-002", label: "Glitch 2", emoji: "⚡", category: "Efeito", driveId: "184EsvMh-C8ope5PzYMfam8d8ZSN6OJ9V", tags: ["efeito", "glitch"] },
      { id: "ef-gli-003", label: "Glitch 3", emoji: "⚡", category: "Efeito", driveId: "1upqbl63ErQPomH9KGWiVYWTVN5Gcad90", tags: ["efeito", "glitch"] },
    ],
  },
  {
    id: "grunge",
    label: "Grunge",
    emoji: "🎸",
    assets: [
      { id: "ef-gru-001", label: "Grunge 1", emoji: "🎸", category: "Efeito", driveId: "1K16ecWTGhpKlkhGyTqIcjlZScQZoSzti", tags: ["efeito", "grunge"] },
      { id: "ef-gru-002", label: "Grunge 2", emoji: "🎸", category: "Efeito", driveId: "1Paa7EmGF9eW3IRHepkHyzcjfyM7wv4YW", tags: ["efeito", "grunge"] },
      { id: "ef-gru-003", label: "Grunge 3", emoji: "🎸", category: "Efeito", driveId: "1z91lLCF5rT1NakEUcJGWow-NG8QjUs4F", tags: ["efeito", "grunge"] },
      { id: "ef-gru-004", label: "Grunge 4", emoji: "🎸", category: "Efeito", driveId: "1YNMj-CoN1YJ4FYEeni0naqZf8cFCgpal", tags: ["efeito", "grunge"] },
      { id: "ef-gru-005", label: "Grunge 5", emoji: "🎸", category: "Efeito", driveId: "19DbRXyM7yCvHTTZlTThRWeo4kif-uwHR", tags: ["efeito", "grunge"] },
      { id: "ef-gru-006", label: "Grunge 6", emoji: "🎸", category: "Efeito", driveId: "1rVTpFRWHwAo-_mlRoXoSFX1i-7j9GnWm", tags: ["efeito", "grunge"] },
      { id: "ef-gru-007", label: "Grunge 7", emoji: "🎸", category: "Efeito", driveId: "1A-_2ATWp-I39FbhQR0Pnuyjrbw96IloG", tags: ["efeito", "grunge"] },
      { id: "ef-gru-008", label: "Grunge 8", emoji: "🎸", category: "Efeito", driveId: "1zD7zsFBMHOBTp20zVadnaP1MKeeOhepV", tags: ["efeito", "grunge"] },
    ],
  },
  {
    id: "light-leaks",
    label: "Light Leaks",
    emoji: "🌟",
    assets: [
      { id: "ef-ll-001", label: "Light Leak 1", emoji: "🌟", category: "Efeito", driveId: "19rWVI6wo4ZNXVW1nR-4gwJOn4rHKVXua", tags: ["efeito", "light leaks"] },
      { id: "ef-ll-002", label: "Light Leak 2", emoji: "🌟", category: "Efeito", driveId: "1nNr5CpIcQFN39FL1Bhktz1-ieBJOyssy", tags: ["efeito", "light leaks"] },
      { id: "ef-ll-003", label: "Light Leak 3", emoji: "🌟", category: "Efeito", driveId: "1FlUmmLHDfEcmvjlEW6b0MkmjY-cjewfz", tags: ["efeito", "light leaks"] },
      { id: "ef-ll-004", label: "Light Leak 4", emoji: "🌟", category: "Efeito", driveId: "1r7hitegD7VY9kbDQv-NMBFRtRoCCkDR4", tags: ["efeito", "light leaks"] },
      { id: "ef-ll-005", label: "Light Leak 5", emoji: "🌟", category: "Efeito", driveId: "1A8j1c0YxeINBL2H6lkmIEudKcgvxUg9m", tags: ["efeito", "light leaks"] },
      { id: "ef-ll-006", label: "Light Leak 6", emoji: "🌟", category: "Efeito", driveId: "1K2vLodgpuZdQ6NE2JptJ2PKAO3saP1pM", tags: ["efeito", "light leaks"] },
      { id: "ef-ll-007", label: "Light Leak 7", emoji: "🌟", category: "Efeito", driveId: "1BPjNPiedRIF0gak9mAPmEv7kvbTfFpha", tags: ["efeito", "light leaks"] },
    ],
  },
  {
    id: "particulas",
    label: "Partículas",
    emoji: "💫",
    assets: [
      { id: "ef-par-001", label: "Partícula 1", emoji: "💫", category: "Efeito", driveId: "1Zzhsn92FN4jDmJMiGjtBdL3umHeV6UAa", tags: ["efeito", "particulas"] },
      { id: "ef-par-002", label: "Partícula 2", emoji: "💫", category: "Efeito", driveId: "1tAff83En6zI79_WwHCZ2uhTFpiXmRQYJ", tags: ["efeito", "particulas"] },
      { id: "ef-par-003", label: "Partícula 3", emoji: "💫", category: "Efeito", driveId: "1UUi2yCdDMCGCp_edRRr2SasYNfeChZKs", tags: ["efeito", "particulas"] },
      { id: "ef-par-004", label: "Partícula 4", emoji: "💫", category: "Efeito", driveId: "1go4sSZsRLF1SkYjTt5ZGwW2Xx2j7LlgB", tags: ["efeito", "particulas"] },
    ],
  },
  {
    id: "raios",
    label: "Raios",
    emoji: "⚡",
    assets: [
      { id: "ef-rai-001", label: "Raio 1", emoji: "⚡", category: "Efeito", driveId: "1ubBHyKdzm5J4wmV4FHpLtWU5-YYA7nv_", tags: ["efeito", "raios"] },
      { id: "ef-rai-002", label: "Raio 2", emoji: "⚡", category: "Efeito", driveId: "1e5B66dtrOyTPRrT4pFJn0WFos99003ZS", tags: ["efeito", "raios"] },
      { id: "ef-rai-003", label: "Raio 3", emoji: "⚡", category: "Efeito", driveId: "1PlzsbZGfq7VnkKVm1G2WdBJe-Tw8WvEj", tags: ["efeito", "raios"] },
      { id: "ef-rai-004", label: "Raio 4", emoji: "⚡", category: "Efeito", driveId: "1DYLW7yH6K4kUJlmjOQsFtLHqJlbOf2BP", tags: ["efeito", "raios"] },
      { id: "ef-rai-005", label: "Raio 5", emoji: "⚡", category: "Efeito", driveId: "1vjJnTAtCx-2wEt-B0BKGwh7hYn8FkloT", tags: ["efeito", "raios"] },
      { id: "ef-rai-006", label: "Raio 6", emoji: "⚡", category: "Efeito", driveId: "1Z1pQXiIwvqf-n_pAbxfd0nWR_sKXjBNp", tags: ["efeito", "raios"] },
    ],
  },
  {
    id: "smoke",
    label: "Smoke",
    emoji: "💨",
    assets: [
      { id: "ef-smo-001", label: "Smoke 1", emoji: "💨", category: "Efeito", driveId: "1HLI31BcUK6cC0uY0XeFnGcKe4vNQ_V7f", tags: ["efeito", "smoke"] },
      { id: "ef-smo-002", label: "Smoke 2", emoji: "💨", category: "Efeito", driveId: "1msac8YsSTMz1k8xnhOiIq2PZmbdXVMC7", tags: ["efeito", "smoke"] },
      { id: "ef-smo-003", label: "Smoke 3", emoji: "💨", category: "Efeito", driveId: "1foL5oK6OpW_lMe4dF64nnWSm4YZK9Wht", tags: ["efeito", "smoke"] },
      { id: "ef-smo-004", label: "Smoke 4", emoji: "💨", category: "Efeito", driveId: "18b-h1Bd7zXPsG2uLoOunE25psqTs-57g", tags: ["efeito", "smoke"] },
      { id: "ef-smo-005", label: "Smoke 5", emoji: "💨", category: "Efeito", driveId: "1hds-fNvP-4kyumgyJ7on-U-ZD-ZBKs7B", tags: ["efeito", "smoke"] },
      { id: "ef-smo-006", label: "Smoke 6", emoji: "💨", category: "Efeito", driveId: "16AozmY50x4fLDYZUXa48DiBHGGvYa0mX", tags: ["efeito", "smoke"] },
      { id: "ef-smo-007", label: "Smoke 7", emoji: "💨", category: "Efeito", driveId: "1uvHfXP123XGt3XYzyp_igklu2SwA-4_c", tags: ["efeito", "smoke"] },
    ],
  },
  {
    id: "transicoes",
    label: "Transições",
    emoji: "🎞️",
    assets: [
      { id: "ef-tra-001", label: "Transição 1", emoji: "🎞️", category: "Efeito", driveId: "1Vf1DvDj6wAzkuUd01ydfDHSbuCMxuR_K", tags: ["efeito", "transição"] },
      { id: "ef-tra-002", label: "Transição 2", emoji: "🎞️", category: "Efeito", driveId: "1_ZqZ_fZ2GhSTIgsioNN5WpJ6tt8WSKXm", tags: ["efeito", "transição"] },
    ],
  },
  {
    id: "vhs-retro",
    label: "VHS Retro Bundle",
    emoji: "📼",
    assets: [
      { id: "ef-vhs-001", label: "VHS 1", emoji: "📼", category: "Efeito", driveId: "1umFfeGf_hkECNt-55ZZBIuILM1IUrvnk", tags: ["efeito", "vhs", "retro"] },
      { id: "ef-vhs-002", label: "VHS 2", emoji: "📼", category: "Efeito", driveId: "129RvOqbmlXN67qnjzMjolX3ubEYxIMFB", tags: ["efeito", "vhs", "retro"] },
    ],
  },
];

/* ── Thumbnail helper ── */
const thumbUrl = (id: string) =>
  `https://drive.google.com/thumbnail?id=${id}&sz=w640`;

/* ── Unified Video Frame (9:16, crop-center para landscape) ── */
const VideoDriveFrame = ({
  driveId,
  title,
  playing,
  onPlay,
}: {
  driveId: string;
  title: string;
  playing: boolean;
  onPlay: () => void;
}) => {
  const previewUrl = `https://drive.google.com/file/d/${driveId}/preview`;
  const thumbnail  = thumbUrl(driveId);

  return (
    <div
      className="relative w-full overflow-hidden bg-black cursor-pointer group rounded-t-xl"
      style={{ aspectRatio: "9/16" }}
      onClick={(e) => { e.stopPropagation(); if (!playing) onPlay(); }}
    >
      {playing ? (
        <iframe
          src={previewUrl}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-0"
          style={{ width: "190%", height: "100%" }}
          allow="autoplay"
          title={title}
        />
      ) : (
        <>
          <img
            src={thumbnail}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
            <div className="rounded-full bg-background/90 shadow-lg p-3">
              <Play className="text-primary fill-primary h-5 w-5" />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* ── Asset Card ── */
const AssetCard = ({
  asset,
  isFav,
  onToggleFav,
}: {
  asset: Asset;
  isFav: boolean;
  onToggleFav: (id: string) => void;
}) => {
  const [playing, setPlaying] = useState(false);
  const viewUrl     = `https://drive.google.com/file/d/${asset.driveId}/view`;
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${asset.driveId}`;

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden hover:border-primary/50 transition-all duration-200 flex flex-col w-[44vw] sm:w-full shrink-0">
      {/* Video frame with fav button overlay */}
      <div className="relative">
        <VideoDriveFrame
          driveId={asset.driveId}
          title={asset.label}
          playing={playing}
          onPlay={() => setPlaying(true)}
        />
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFav(asset.id); }}
          className="absolute top-2 right-2 z-10 rounded-full bg-background/80 backdrop-blur-sm p-1.5 shadow transition-all hover:scale-110"
          aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
        >
          <Heart
            className={cn("h-3.5 w-3.5 transition-colors", isFav ? "fill-destructive text-destructive" : "text-muted-foreground")}
          />
        </button>
      </div>
      <div className="p-2 sm:p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs font-semibold truncate">{asset.label}</p>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">{asset.category}</Badge>
        </div>
        <div className="flex gap-1.5">
          <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button size="sm" variant="outline" className="gap-1 text-[11px] h-8 px-2 w-full">
              <ExternalLink className="h-3 w-3" />Abrir
            </Button>
          </a>
          <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button size="sm" className="gap-1 text-[11px] h-8 px-2 w-full">
              <Download className="h-3 w-3" />Baixar
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
};

/* ── SFX Assets ── */
type SfxAsset = {
  id: string;
  label: string;
  driveId: string;
};

type SfxGroup = {
  id: string;
  label: string;
  emoji: string;
  assets: SfxAsset[];
};

const sfxGroups: SfxGroup[] = [
  {
    id: "sfx-cinematico",
    label: "Cinemático",
    emoji: "🎬",
    assets: [
      { id: "sfx-001", label: "Cinematic 05",       driveId: "1Avz8n7TXbm8zShrNoYidX9pyAeMYPdpU" },
      { id: "sfx-002", label: "Highlight",           driveId: "1IPBxi5BIHwD7LI4Om6bIItxjLBuxkvgR" },
      { id: "sfx-003", label: "Old Film",            driveId: "1JrIbiUJ2lr0ukgOMnLMnD6wQOLFmNk1p" },
      { id: "sfx-004", label: "Bass Beats",          driveId: "1emyCfgYnTCoEMp9k33ddd8Ssy2DNSVJD" },
      { id: "sfx-005", label: "Slow Motion",         driveId: "12I3rNSLvkBbf99_qwTdK3SFRB7L7bzgZ" },
    ],
  },
  {
    id: "sfx-impacto",
    label: "Impacto",
    emoji: "💥",
    assets: [
      { id: "sfx-010", label: "Hard Hit 1",          driveId: "10O-tznL5BPfswa1uIDelNo3CjlWuH6Gf" },
      { id: "sfx-011", label: "Hard Hit 2",          driveId: "1dqyPDCoP6K1i2LQLFb8p145f0g5pGWWI" },
      { id: "sfx-012", label: "Hard Hit 3",          driveId: "1grw8T99vqntJBZ7_H8phh4xc-bjRP-ww" },
      { id: "sfx-013", label: "Hard Hit 4",          driveId: "1k9OZc5BxvU5dMQiNMfkDFGMNvGgRjSpE" },
      { id: "sfx-014", label: "Hard Hit 5",          driveId: "1fW1C8ILTLyKp6bnaOxq2XMRTF_hhkVJl" },
      { id: "sfx-015", label: "Hard Hit 6",          driveId: "1vraTgOJZ67G__U_e-GqSsSIhC1cetg6z" },
      { id: "sfx-016", label: "Crowd Cheer",         driveId: "1A7BuHIonu13_DmQfX35AJxgMJRt1ROsF" },
      { id: "sfx-017", label: "Boxing Bell",         driveId: "1qBF-OL66nh4ihG78P6iItjVXYmi6hlVr" },
    ],
  },
  {
    id: "sfx-whoosh",
    label: "Whoosh / Swoosh",
    emoji: "💨",
    assets: [
      { id: "sfx-020", label: "Swoosh 02",           driveId: "1KpV7G7sQ8qT3y7cwl9fc7oPph3d_1Qr2" },
      { id: "sfx-020b",label: "Swoosh 03",           driveId: "1C7hw2hh9EYUkf-a95Ks8tvQGPuRT5t8Z" },
      { id: "sfx-020c",label: "Swoosh 04",           driveId: "129GG3nWkVx3hAJjEmb17lkBqn6tWn0AH" },
      { id: "sfx-020d",label: "Swoosh 05",           driveId: "1IFMeV49_9WV4ZNoT0MJfjUtmDg9wkwZq" },
      { id: "sfx-020e",label: "Swoosh 08",           driveId: "11qwgoFb7qhXz5rLK78tl5NX3eKDrWnlN" },
      { id: "sfx-020f",label: "Swoosh 09",           driveId: "1XZCYsBvTRRXj2_AztZTxFuAxSGyryLYH" },
      { id: "sfx-020g",label: "Swoosh 10",           driveId: "1a_rQGGSKUPMST9EO8CymS4kHibGv0Jzc" },
      { id: "sfx-020h",label: "Swoosh 11",           driveId: "1H96gty5NV3X3NNFMBKjgf-fsGtM6F2Hu" },
      { id: "sfx-020i",label: "Swoosh 12",           driveId: "1NSZ9dluVpXOmdRXzouxeWxE_hNmB1Gtv" },
      { id: "sfx-020j",label: "Swoosh 13",           driveId: "1MWYEZ-kzF87gHSPzuRjtBRiFPYwnrHME" },
      { id: "sfx-020k",label: "Swoosh 15",           driveId: "1-b2wYqd-IDN5DSyrnTHW4dBYO4MGPtgc" },
      { id: "sfx-020l",label: "Swoosh 16",           driveId: "1UP1aytwOWJxSIDdtIHVcgY0MgV1dtpr_" },
      { id: "sfx-020m",label: "Swoosh 17",           driveId: "1ZZUrjybPvc7vX0bSo_cOV-n0lyv-37X3" },
      { id: "sfx-020n",label: "Swoosh 18",           driveId: "1DCqJxyndJJZqOUt6C8cyYv3M25wIJPFc" },
      { id: "sfx-020o",label: "Swoosh MP3",          driveId: "1MQIng9ajprl6-FcS96mbTrEMbspfO2ZT" },
      { id: "sfx-020p",label: "Swoosh WAV",          driveId: "1au2erjwHmbG63GOhWajfmg6xS1RrsQqH" },
      { id: "sfx-021", label: "Long Woosh",          driveId: "14iMtfIIOYG27XV1utq7M_OwfL3NLKy-6" },
      { id: "sfx-022", label: "Woosh 1",             driveId: "1ncE4vMvoOk7FhBcDWacRe05aqxs5I688" },
      { id: "sfx-023", label: "Woosh 2",             driveId: "1URdxAhVrXQNJE-4YBzyJp77W288jqqgP" },
      { id: "sfx-024", label: "Whoosh Swoosh 1",     driveId: "1YR5gNgt5GHla2XY6-PrJ74Gz2arf48tL" },
      { id: "sfx-ws2", label: "Whoosh Swoosh 2",     driveId: "1To-My8CBOlNCkVjlWg2IAZKlxNwsDL8B" },
      { id: "sfx-ws3", label: "Whoosh Swoosh 3",     driveId: "1V_U5V9It90sbRZB-RSWfJy0d0LeDDSXD" },
      { id: "sfx-ws4", label: "Whoosh Swoosh 4",     driveId: "1yXPMGdpTmv9HiQ6Sl9Lbl4IRUs33_MrL" },
      { id: "sfx-ws5", label: "Whoosh Swoosh 5",     driveId: "1QnKxJnBl5Z4WFX5xfRQ2fgyQbpxe1cy1" },
      { id: "sfx-ws6", label: "Whoosh Swoosh 6",     driveId: "19_TeYrrmjgYERECIOwcaLzOokWWkjBvk" },
      { id: "sfx-ws7", label: "Whoosh Swoosh 7",     driveId: "1a8bpi4O-9OghrT83mBNMIpqxBEe396AA" },
      { id: "sfx-ws8", label: "Whoosh Swoosh 8",     driveId: "10jQQVOnQO3lJEfqI_NWic3HaVBJU3pkC" },
      { id: "sfx-ws9", label: "Whoosh Swoosh 9",     driveId: "1kD2KYj6gCU0E8B0-ih76HofcIQA1gMRI" },
      { id: "sfx-ws10",label: "Whoosh Swoosh 10",    driveId: "1ZwxWbxzgIn9teHEWkDbj7W5Igi5iHuyn" },
      { id: "sfx-ws11",label: "Whoosh Swoosh 11",    driveId: "1I-R6v1G-HoZSQlI8Bam_UFgmHtQgWed2" },
      { id: "sfx-ws12",label: "Whoosh Swoosh 12",    driveId: "1CPnBpCwn9kTPNXL3wpqg23eqGKn5gvOo" },
      { id: "sfx-ws13",label: "Whoosh Swoosh 13",    driveId: "1bZi71XzcUDIptBdeIeuiE5FBraCuFzzp" },
      { id: "sfx-ws14",label: "Whoosh Swoosh 14",    driveId: "1g_wbazbKEvxnG2cYkCp7rpqU34eax3vJ" },
      { id: "sfx-ws15",label: "Whoosh Swoosh 15",    driveId: "1CJow72skIPSU89SMp2FNZqSW6Im8pjZz" },
      { id: "sfx-ws16",label: "Whoosh Swoosh 16",    driveId: "1NSPl5nVjj5EOL520rCT-PAZFB8VQZjjj" },
      { id: "sfx-ws17",label: "Whoosh Swoosh 17",    driveId: "1S6zreXEWYICg9lDFFTrRflXsrwM3ZXeO" },
      { id: "sfx-ws18",label: "Whoosh Swoosh 18",    driveId: "1pPw6l7rQm0H-ddRHNp-GASRtNHzTOGeH" },
      { id: "sfx-ws19",label: "Whoosh Swoosh 19",    driveId: "1IhSzEXc3OsGdVWtCkv1M2LRMitoQhyp9" },
      { id: "sfx-ws20",label: "Whoosh Swoosh 20",    driveId: "1lUhjmpGnOB7hBcXXHJOn_mP0IgGe-I0f" },
      { id: "sfx-ws21",label: "Whoosh Swoosh 21",    driveId: "1yuiRz0vmgr3KH4QqXl_Jxn_nu-mDoPol" },
      { id: "sfx-ws22",label: "Whoosh Swoosh 22",    driveId: "1LkA1xAK3XYa-AmDpEhOFhf52oaRjjjTi" },
      { id: "sfx-ws23",label: "Whoosh Swoosh 23",    driveId: "1XLKP39eJ0baBPNuuGCb_kBRq9rD9AKKR" },
      { id: "sfx-ws24",label: "Whoosh Swoosh 24",    driveId: "1ZSUPAUsgFfeBGFQfxl7j0KzDpxqcNPWY" },
      { id: "sfx-ws25",label: "Whoosh Swoosh 25",    driveId: "1OYWQEaYErjte6zimmOW0uIum2ldIVhiv" },
      { id: "sfx-ws26",label: "Whoosh Swoosh 26",    driveId: "11ONdyKGTH3MTlRIfTZ87b5iVDPcfr6zf" },
      { id: "sfx-ws27",label: "Whoosh Swoosh 27",    driveId: "1RNOw9UaLKE5JbK-ocebMPjpUKFsmHYVt" },
      { id: "sfx-ws28",label: "Whoosh Swoosh 28",    driveId: "1SgRfesBmjbWGOMRl0xuD-dV9lM3hpi4O" },
      { id: "sfx-ws29",label: "Whoosh Swoosh 29",    driveId: "16ukXJUW-yvPp9LPQiYChoGEt6XuffjXd" },
      { id: "sfx-ws30",label: "Whoosh Swoosh 30",    driveId: "1qbFCZXq_s9MVtqJB4CoDebxu3-9x_xQa" },
      { id: "sfx-wind",label: "Wind Swoosh",         driveId: "1Hg2BeUbDPucmSzIOQF_UsaciAO75j8HA" },
      { id: "sfx-wsp", label: "Whoosh Pop",          driveId: "1QBd5OeiksdS_SIsbnEE1_Q6GiRJqNsxN" },
      { id: "sfx-wsp2",label: "Whoosh Pop 2",        driveId: "1lftBZov5JGaH496Mdl04hV1aMP3X1dvF" },
      { id: "sfx-zm1", label: "Zoom 1",              driveId: "1NLDETX6ZqUpi-A_sBI2jV7oGIrj-DPFi" },
      { id: "sfx-zm2", label: "Zoom 2",              driveId: "1N6s0th78m9Kdotgucnl08Iz0Ypx5pCVh" },
      { id: "sfx-zm3", label: "Zoom 3",              driveId: "1Oiq1ZOdaMMmwaY8LVWnXkeXmpfYTBnMv" },
      { id: "sfx-025", label: "RM Whoosh",           driveId: "1nuyI0mx-r6gKL3oNZu8US5Q0Z6v2VCi8" },
      { id: "sfx-026", label: "UI Long Zoom",        driveId: "1nJ7WUZYJDSWPTNLAHyVhPMOXV2RNJB_J" },
      { id: "sfx-027", label: "Rewind",              driveId: "10DKtRnliayFXFycf9RweTRohrMTpfZU0" },
    ],
  },
  {
    id: "sfx-clicks",
    label: "Clicks & Teclado",
    emoji: "🖱️",
    assets: [
      { id: "sfx-030", label: "Mouse Click 1",       driveId: "1hUVgcgQe1w7Yw3YytFTSWEssearMS9e5" },
      { id: "sfx-031", label: "Mouse Click 2",       driveId: "1L-cyxTSgRq7ndJt8n1wjwySw8-5BsPZs" },
      { id: "sfx-032", label: "Mouse Click 3",       driveId: "1m0wzLGws3Sn0RG-ZHzN2bE_z6iVL4xQA" },
      { id: "sfx-033", label: "Mouse Click HD",      driveId: "1Wvv7IiYd6GlpM9h0NV01UWU-dVcRdxGF" },
      { id: "sfx-034", label: "RM Click 1",          driveId: "1qK-3fLD-dt3ef2dHTaNsIb2ygj7KwBUj" },
      { id: "sfx-035", label: "RM Click 2",          driveId: "1IPkJllxzhZXDhzDBjcfa27mkPNvVPbhS" },
      { id: "sfx-036", label: "RM Click 3",          driveId: "1cBxKC4JIWQLiaZeuinSYRK-1keuGpJFf" },
      { id: "sfx-037", label: "Keyboard",            driveId: "1e4-lS0UJe4WrnZ0MV6FSnPGKL2O_LTGw" },
    ],
  },
  {
    id: "sfx-pop",
    label: "Pop & Ting",
    emoji: "🎵",
    assets: [
      { id: "sfx-040", label: "Pop 1",               driveId: "1Kh6pxIkz2YypS5s_0VjjqPE3FicuTpbU" },
      { id: "sfx-041", label: "Pop 2",               driveId: "1n7o4Np3O0QduoS6hbVnVzU9OOBBi8H3x" },
      { id: "sfx-042", label: "Ting",                driveId: "1JzdPVLQxglQfwPplOMAmQUuyZ1rgsK1q" },
      { id: "sfx-043", label: "Cash Register",       driveId: "1IrVqf4IDQI-jM9VbhSrRzJBi82-D4A_4" },
      { id: "sfx-044", label: "Shutter",             driveId: "1WXEJGg430VUmduNfoXCpzW5P1yeMoURS" },
      { id: "sfx-045", label: "Paper",               driveId: "1IIwhiKRvK8aadvq9wsD3uRCBfboDdJty" },
    ],
  },
  {
    id: "sfx-ambiente",
    label: "Ambiente",
    emoji: "🕰️",
    assets: [
      { id: "sfx-050", label: "Clock Ticking",       driveId: "13_FVuO5Dtuj0sgCWgNVulJigMGbMyssN" },
      { id: "sfx-051", label: "Scary Clock",         driveId: "1v2gunI9SJe_-0s4MjcxD8ZKN19YN_y4X" },
      { id: "sfx-052", label: "Glitch",              driveId: "16Mf_cwbAt2X2Le-ZOxutC3nsYOQGYHyM" },
      { id: "sfx-053", label: "Sound 1",             driveId: "1GZG1RhSpzhQhYeueeJKqm8bNDULK5X0t" },
      { id: "sfx-054", label: "Sound 2",             driveId: "1MGIpfJEfwYl893d2bKAyLq-JkCK4pSn7" },
      { id: "sfx-055", label: "Sound 3",             driveId: "1wOmpMJYPhuSwuKaLeLvLV8o5yET2QNIZ" },
      { id: "sfx-056", label: "Sound 4",             driveId: "1hERuCw-NJEm5GjVTsea2LnzePBVh0GvS" },
      { id: "sfx-057", label: "Sound 5",             driveId: "1SQlLFeWczGA4W5XXNlGM-FXAtZmyV2i5" },
      { id: "sfx-058", label: "Sound 6",             driveId: "1jqpCfbPvo3qsaIS3p6BQDC_1oSN7gpNc" },
      { id: "sfx-059", label: "Sound FX 2",          driveId: "1jkoFGPRmllFdp_FGA7bM_DF28eQgHm2h" },
      { id: "sfx-060", label: "Sound FX 5",          driveId: "1goZppCXGaStGCLplJ7KUzKRTqKrVMUI-" },
      { id: "sfx-061", label: "Sound FX 7",          driveId: "1h0zU_P9Mm1UWRidMFFrIZd9XMa0wOD7N" },
      { id: "sfx-062", label: "Sound FX 8",          driveId: "1SFdqvaWW9iTXmVe-IGiO8ujZcoBaE_0f" },
      { id: "sfx-063", label: "Sound FX 9",          driveId: "1hmVKQlW2vRA-PzQlS-qP4azuGnr2opxs" },
      { id: "sfx-064", label: "Sound FX 10",         driveId: "1cUp6RXyH2gwZXDpQ40GyTiozPGs7ahj5" },
      { id: "sfx-065", label: "Sound FX 11",         driveId: "1WiBMuH9C-tRS92hkop0ni7GiNUjbPPxA" },
      { id: "sfx-066", label: "Sound-1",             driveId: "1xLOveOBTJ-XAt6iL1RY4YC9zjbmTd3WB" },
      { id: "sfx-067", label: "Sound-2",             driveId: "1hVOXuWJAT3Bqb7HgoehkrKA2W1v-tmif" },
      { id: "sfx-068", label: "Sound FX 7b",         driveId: "1CCd--dAIuB7ZkpBz0g0TRQtCC7NkQbDK" },
      { id: "sfx-069", label: "Sound FX 8b",         driveId: "1sSR4ZlAYTnCF5h3CIMg8coTMJFb19Z4x" },
      { id: "sfx-070", label: "Sound FX 9b",         driveId: "1H2qA2c69ysNI1Vz4MbNJXFGIU9ZuslFz" },
      { id: "sfx-071", label: "Sound FX 10b",        driveId: "1XGPeAju-ajCf6jvHRFEmus3eXJC2_hfq" },
      { id: "sfx-072", label: "Sound FX 2b",         driveId: "1EJ6agfO28r_c4JYJkTTL0GdrDzFeD73G" },
      { id: "sfx-073", label: "Sound FX 5b",         driveId: "1CKxCZQLEyz98GHnJ9XkjMXfIB5b6Fl-Q" },
      { id: "sfx-074", label: "Glitch 2",            driveId: "1H4EFCs7jc-E9BcI6st1HCNrYJOLC5M_r" },
    ],
  },
  {
    id: "sfx-metal",
    label: "Metal Slice",
    emoji: "⚔️",
    assets: [
      { id: "sfx-m01", label: "Metal Slice 1",       driveId: "1IWONSsoYUDlTfh8T_EPsSAPRjKiNuAYT" },
      { id: "sfx-m02", label: "Metal Slice 2",       driveId: "12ko2eOZdEGBfUHzTlAgp1xdLJKOCOkEO" },
      { id: "sfx-m03", label: "Metal Slice 3",       driveId: "1isG8senpmTFF6KS9gB4l4Pj6Ha4hrN-5" },
      { id: "sfx-m04", label: "Metal Slice 4",       driveId: "1eM6-a9elW_RDnl0zb7vHB3-0PJfCl9-Z" },
      { id: "sfx-m05", label: "Metal Slice 5",       driveId: "1AdB_04cehc3OZI-UiYRnY7Qne3MKJWLC" },
      { id: "sfx-m06", label: "Metal Slice 6",       driveId: "1WgKvJWdYR7zKnE5v_ViS47y4H1klkhuR" },
      { id: "sfx-m07", label: "Metal Slice 7",       driveId: "1o1vMdCugKzU4mIsoiVmn_bduZ8LyZWO5" },
      { id: "sfx-m08", label: "Metal Slice 8",       driveId: "1CE8To9bkdKwL3nbRHEEQ2z5TjHHLICMK" },
      { id: "sfx-m09", label: "Metal Slice 9",       driveId: "1nBsogpvJE9h123qWpP8GueIwGZZU_2BA" },
      { id: "sfx-m10", label: "Metal Slice 10",      driveId: "1ZxS_xMrh1FyaiJIgOBMLDaLJ8BMUqmUw" },
      { id: "sfx-m11", label: "Metal Slice 11",      driveId: "1H-PWFzQR2Cznd3daggywmnTRKlIJG6wb" },
      { id: "sfx-m12", label: "Metal Slice 12",      driveId: "1g-xi6DNobONOK3JY5s4w0CATBtQYsZO3" },
      { id: "sfx-m13", label: "Metal Slice 13",      driveId: "1ut092Nn4v1RQZb51I_Jg2JikmyLgRFI1" },
      { id: "sfx-m14", label: "Metal Slice 14",      driveId: "1ahul4Cn5pqAMDcn31kkKoNvliSdyoDZE" },
      { id: "sfx-m15", label: "Metal Slice 15",      driveId: "1DJ6vCiD1PJhuSIp39oGmpuPwEYpQmfpZ" },
      { id: "sfx-m16", label: "Metal Slice 16",      driveId: "16RALtI3GRcz7hnaEMX-lSFIndke9QrsW" },
      { id: "sfx-m17", label: "Metal Slice 17",      driveId: "1DpoUwToIKEwuRqB2nq_RotIBy9G1PEpg" },
      { id: "sfx-m18", label: "Metal Slice 18",      driveId: "155GrIMYFo80rhmjXFQKfPI9ixjgTvgZ9" },
      { id: "sfx-m19", label: "Metal Slice 19",      driveId: "1DUwljgOMs4utM0m9-ntJ0qMi8ai8ClBD" },
      { id: "sfx-m20", label: "Metal Slice 20",      driveId: "1ZMRxmUgTVGu1mPS_mLVANrfFVsEhi9mg" },
      { id: "sfx-m21", label: "Metal Slice 21",      driveId: "1a7dKBQqvhMpyTQer4OdeclbuFRuk1Iy7" },
      { id: "sfx-m22", label: "Metal Slice 22",      driveId: "1m9N237WGdHoZyonPZdQVro9mSdtapn38" },
      { id: "sfx-m23", label: "Metal Slice 23",      driveId: "1bbjVRBQYwwljI_lQj1pON_OMLB4dNZrf" },
      { id: "sfx-m24", label: "Metal Slice 24",      driveId: "1CPCDtE3NNGVfWIljt6dY0q-Lv7LoHk-a" },
      { id: "sfx-m25", label: "Metal Slice 25",      driveId: "1Nwqkm1j9RYJkQJhPjDbQh6TFP8e_yEUM" },
      { id: "sfx-m26", label: "Metal Slice 26",      driveId: "1QQFyFU8vwSoY_3i30B7-gB79rDUMehxs" },
      { id: "sfx-m27", label: "Metal Slice 27",      driveId: "1M9ngrYWQLGP47Y8ACAJ8fDP7vGxlCHBR" },
      { id: "sfx-m28", label: "Metal Slice 28",      driveId: "1cePhj0aiKDBkMffm3BfVlzDi_5deblS4" },
      { id: "sfx-m29", label: "Metal Slice 29",      driveId: "1ubnt-VA54evD4JYtjirSNEC_LTYukghV" },
      { id: "sfx-m30", label: "Metal Slice 30",      driveId: "10aPEemzYXxtkh33z-qhaEP3YMeskRNY_" },
      { id: "sfx-m31", label: "Metal Slice 31",      driveId: "10wPmRT5rbIpGIwzyQd_qoBf4-3tPijGs" },
      { id: "sfx-m32", label: "Metal Slice 32",      driveId: "1MQyTSG9l5xsaxvF8MwcOryAoD4R0soGr" },
      { id: "sfx-m33", label: "Metal Slice 33",      driveId: "15bguMBXxYE_48YTgiol1YbdtPvQI7jeh" },
      { id: "sfx-m34", label: "Metal Slice 34",      driveId: "1p0CiTe7NbUNH39vWGs1cx0wZkv5PUxzu" },
      { id: "sfx-m35", label: "Metal Slice 35",      driveId: "1nLmvu7-YgDbsejdEXBPuRpJK0v35odr7" },
      { id: "sfx-m36", label: "Metal Slice 36",      driveId: "14hiiJ_SNZR8kdlCc9_u8_5f5cX07qSwV" },
      { id: "sfx-m37", label: "Metal Slice 37",      driveId: "1ugsgR-B89QUzjii_u82n-ljVxcc5oTnX" },
      { id: "sfx-m38", label: "Metal Slice 38",      driveId: "1nB_sIz8w3sOapapFWU4s3ULV4SLZ_rqQ" },
      { id: "sfx-m39", label: "Metal Slice 39",      driveId: "18JdnHD66bivaiaz6kAUPapmiSnmOsCOp" },
      { id: "sfx-m40", label: "Metal Slice 40",      driveId: "16Bgt95n5DgV5pxbVn9xlyxCIC4HA8xGm" },
      { id: "sfx-m41", label: "Metal Slice 41",      driveId: "1nacaaRkGXnQWiNmI7epqEhLh4fBVPr8r" },
      { id: "sfx-m42", label: "Metal Slice 42",      driveId: "14sKarHVPKlfUWj6-H3bTX2o785R86h1t" },
      { id: "sfx-m43", label: "Metal Slice 43",      driveId: "1Nnjh1jcV4oIemguhUXigaNbYj5JwsDTq" },
      { id: "sfx-m44", label: "Metal Slice 44",      driveId: "1hwnAQDsZUw_ilV3yI0IELUBZIBSorudU" },
      { id: "sfx-m45", label: "Metal Slice 45",      driveId: "1NeimWQh_cQzrtg7wk_6Rl3nV-DvNyt3o" },
      { id: "sfx-m46", label: "Metal Slice 46",      driveId: "1djf5FOeZww2vJE4YJJ4r8KULeS8fs2ql" },
      { id: "sfx-m47", label: "Metal Slice 47",      driveId: "1Tw8XMY56b27U0e2Efpqklye1k9ubrmHV" },
      { id: "sfx-m48", label: "Metal Slice 48",      driveId: "1XFesvrS4H1eeqykhiNfhNhycqcDAtIGS" },
      { id: "sfx-m49", label: "Metal Slice 49",      driveId: "1m3p9W9z2VjrgVMkG6KZ9vn6-nFtW6OsF" },
      { id: "sfx-m50", label: "Metal Slice 50",      driveId: "1GoliK6TgtVgr3TebMQX_Y9ZW4lXD8OXG" },
      { id: "sfx-m51", label: "Metal Slice 51",      driveId: "1Y6ULo9k4ZO5ZQPtgBnHQ5uVbrA7hJ85u" },
      { id: "sfx-m52", label: "Metal Slice 52",      driveId: "1ztRjr4cCFW6v5_AutEtUjyn6P9Cv2WHC" },
      { id: "sfx-m53", label: "Metal Slice 53",      driveId: "1VMisLkkCwOpaca74m2_aNxMoc7sotdLv" },
      { id: "sfx-m54", label: "Metal Slice 54",      driveId: "1yUetev-aokOPbtN-Io7lYqjgrjF0VRsc" },
      { id: "sfx-m55", label: "Metal Slice 55",      driveId: "1dx9UquNGeLz9QmLu3dK8UyNGC3ZWd9WW" },
      { id: "sfx-m56", label: "Metal Slice 56",      driveId: "1A1Rw6qXiV4kim9Gj4Qy14Gryi0FbPhKY" },
      { id: "sfx-m57", label: "Metal Slice 57",      driveId: "1fDriSwoj7l96MhlpOsusCGmD7Eqk4NVE" },
      { id: "sfx-m58", label: "Metal Slice 58",      driveId: "1nPlmY1mGYBnZLVvuQBGHF2Fqc2jL8NlN" },
      { id: "sfx-m59", label: "Metal Slice 59",      driveId: "1SobkaBG-FOUkjUFvhLsjsq9o-VjFdxgo" },
      { id: "sfx-m60", label: "Metal Slice 60",      driveId: "1D-fyDB40l18KrDMMYN_m1Abao_i3kmuw" },
      { id: "sfx-m61", label: "Metal Slice 61",      driveId: "1CG5iOmLPGURywn2727Zzmp5Y3z1F4zOs" },
      { id: "sfx-m62", label: "Metal Slice 62",      driveId: "17mfjEIGdUUEAgv_HpTRrBVJqubMT2fD4" },
    ],
  },
  {
    id: "sfx-funny",
    label: "Funny Effects",
    emoji: "😂",
    assets: [
      { id: "sfx-f01",  label: "Funny Effect 1",     driveId: "1uqrQlPqRmaCoMb4FrRyzQaQJQHmy_sD5" },
      { id: "sfx-f02",  label: "Funny Effect 2",     driveId: "1hP8yv86ENufbzhZDZ3tA11-pQhDtuIaN" },
      { id: "sfx-f03",  label: "Funny Effect 3",     driveId: "1PLBAYNHvG0UehX8Klm2_60c0qsLCcgeR" },
      { id: "sfx-f04",  label: "Funny Effect 4",     driveId: "1tezDQfrVbYlMmEMszBRyvqT8egVEjn30" },
      { id: "sfx-f05",  label: "Funny Effect 5",     driveId: "1EAuvV5e6tjt784KpAKen2Liypz3sY7yn" },
      { id: "sfx-f06",  label: "Funny Effect 6",     driveId: "1O5pFvYjjc6E0WlZmHUQFG9ivx15pif-g" },
      { id: "sfx-f07",  label: "Funny Effect 7",     driveId: "1d9nsNdwonjvI0uoNz1YoAhDYmOUGf96k" },
      { id: "sfx-f08",  label: "Funny Effect 8",     driveId: "1RuNbHafcLuSLqJ8N8HBc698KPVmeAUV_" },
      { id: "sfx-f09",  label: "Funny Effect 9",     driveId: "15tH4InXl8nPkhn5jN6iDreM910k1D8sO" },
      { id: "sfx-f10",  label: "Funny Effect 10",    driveId: "1ODix_nWjP0pgNQo1E4UpdgC3oMfFIyiv" },
      { id: "sfx-f11",  label: "Funny Effect 11",    driveId: "11JGKHzIoSardNHIq_h8Jpm0JE8mPeohq" },
      { id: "sfx-f12",  label: "Funny Effect 12",    driveId: "1vAY_T76RD0riQwA0cMmxdn7SbCIyiMKu" },
      { id: "sfx-f13",  label: "Funny Effect 13",    driveId: "1zla_q5JY_fV4ouvmcJ5F4QEk_91eqjUe" },
      { id: "sfx-f14",  label: "Funny Effect 14",    driveId: "1XSm1z5luP4G86NoF19gtSqKB1aVYCcYv" },
      { id: "sfx-f15",  label: "Funny Effect 15",    driveId: "1pW9AlZpy877vBPtlpR6ID9OBENSrnpcn" },
      { id: "sfx-f16",  label: "Funny Effect 16",    driveId: "1VQY2jCXO2pkxBspSivdJm0-Lc0JYM0ZH" },
      { id: "sfx-f17",  label: "Funny Effect 17",    driveId: "1G95G0c0qBvjhHgZ9lcKYgmZUIOWA4iN_" },
      { id: "sfx-f18",  label: "Funny Effect 18",    driveId: "1PcTniqNE8s0j91sKT6K1FLfCsbtTMyt7" },
      { id: "sfx-f19",  label: "Funny Effect 19",    driveId: "1-Br8JqVmtade5h---kpLlF2ftV6TiJUF" },
      { id: "sfx-f20",  label: "Funny Effect 20",    driveId: "1G_W15zllq7mnaz1uVts_9KbCV2jzwbwm" },
      { id: "sfx-f21",  label: "Funny Effect 21",    driveId: "1TQHxYQpVOnHQe_oMoTOn5C_X0PKccw4f" },
      { id: "sfx-f22",  label: "Funny Effect 22",    driveId: "1QJcQ0qmgrM8-VSOp3CpdRESk_lN9KAQC" },
      { id: "sfx-f23",  label: "Funny Effect 23",    driveId: "1yKUBcda1dh0sEWbprH1FQWiC3KSGw3EI" },
      { id: "sfx-f24",  label: "Funny Sneeze",       driveId: "1OMxHWKDHAk79SWtstHMk6JZxG0SA31MH" },
      { id: "sfx-f25",  label: "Funny Sleeping",     driveId: "1tU-EC_h5TLQDaCowsXjW4vv-chQ1wd5R" },
      { id: "sfx-f26",  label: "Funny Woosh",        driveId: "1RkZiG4brdE_ivNxXooR7luPM-caKlCBB" },
      { id: "sfx-f27",  label: "Funny Laughing 1",   driveId: "1wawSdQYlx9WpuwOkN9_731N3EUw2B0Yu" },
      { id: "sfx-f28",  label: "Funny Laughing 2",   driveId: "1XzY5xOJM0mjEIFRZg6SducBGxqSG94BY" },
      { id: "sfx-f29",  label: "Funny Laughing 3",   driveId: "1nL1YIrWCf460YdP5J2kI3LQL1wyUpqjF" },
    ],
  },
  {
    id: "sfx-whoosh-slowmo",
    label: "Whoosh SlowMo",
    emoji: "🌀",
    assets: [
      { id: "sfx-ws03", label: "SlowMo Whoosh 03",   driveId: "1B4SyCP2KhhVarydpvGWpqziNt3gl8aJS" },
      { id: "sfx-ws04", label: "SlowMo Whoosh 04",   driveId: "1XPXwniehyFsLsCc9DTIjEWyTGKCPOOt5" },
      { id: "sfx-ws05", label: "SlowMo Whoosh 05",   driveId: "1FfwuW8VC8MRgkApyXttORI5_SpoFOWCr" },
      { id: "sfx-ws06", label: "SlowMo Whoosh 06",   driveId: "1sxtvldIajHGJcuVrgGkpk8aGL9ixCt5k" },
      { id: "sfx-lsw",  label: "Low Slow Whoosh",    driveId: "1Z-II3WkvdKuR-fRzADtjeTT8A6lKCMzH" },
      { id: "sfx-lbm",  label: "Low Boom",           driveId: "1U-HuQpCDzgjmNW9SVMHEHJsOp9jCNqyQ" },
    ],
  },
  {
    id: "sfx-cinematico-extra",
    label: "Cinemático Extra",
    emoji: "🎥",
    assets: [
      { id: "sfx-cn01", label: "Cinematic 01",       driveId: "1MSEBSptnxsmKzjRCZmTtPtXwvpJGOySv" },
      { id: "sfx-cn02", label: "Cinematic 02",       driveId: "1ocmW_nS8NiggRCmzZiCTQjcmEENsT1GI" },
      { id: "sfx-cn03", label: "Cinematic 03",       driveId: "1W2hhs7gfzXWPUBpzdiRhl7FeaxOzbevL" },
      { id: "sfx-cn04", label: "Cinematic 04",       driveId: "19lacPwoLCVtJcYDFBDWOFsUhGQs0k1Y7" },
      { id: "sfx-cn05", label: "Cinematic 05",       driveId: "1fNB2I6KDjSX14UFEhq1H1hzJQZwAG6oB" },
      { id: "sfx-cn06", label: "Cinematic 06",       driveId: "1rCQOcYQAVVH_PTqyHt3b1STHo3f_oFuF" },
      { id: "sfx-cn07", label: "Cinematic 07",       driveId: "1ao-OKnMrVBnMbl3mQlTvpd_O-anN1AqS" },
      { id: "sfx-cn08", label: "Cinematic 08",       driveId: "1JDqo_9WcO6vRVPrOZY_pFAmSxOPFx1ut" },
      { id: "sfx-cn09", label: "Cinematic 09",       driveId: "1Hui2rCTxldVkm6mVBdibAXDVj6bpDtrE" },
      { id: "sfx-cn10", label: "Cinematic 10",       driveId: "1q9I0qaq3-Q9OXP1LwMIwR3VKu4U-CVVb" },
      { id: "sfx-cn11", label: "Cinematic 11",       driveId: "1O3oKIHjh-Z0da_Wo9AWDDf8ABzBPuVeL" },
      { id: "sfx-cn12", label: "Cinematic 12",       driveId: "1RkeOb907YPL2nLMmN4kCcklfcSJfJlkd" },
      { id: "sfx-c13",  label: "Cinematic 13",       driveId: "1qPWhUjGBHMmektVzpdC7vF3r0C_DqIkO" },
      { id: "sfx-cn14", label: "Cinematic 14",       driveId: "1fUjXXaiSdPuhKlhbkChxcZ3IV12LQBL7" },
      { id: "sfx-c15",  label: "Cinematic 15",       driveId: "14igWReFHuCTH_8jmFMti_Ga2duuJBiqV" },
      { id: "sfx-c16",  label: "Cinematic 16",       driveId: "1U8lsF-fMiheH2bEoax8scWfAKP89AEcK" },
      { id: "sfx-cn17", label: "Cinematic 17",       driveId: "1x7ptC-3aPpbAbH0jAHsWma-j25Txm-Bs" },
      { id: "sfx-c18",  label: "Cinematic 18",       driveId: "16ygD13s__dKfrGv8LoJgEu69bX1Da36R" },
      { id: "sfx-c19",  label: "Cinematic 19",       driveId: "19tIUgK5FhFseR5sqlhfu2p9uK4OR636v" },
      { id: "sfx-cn20", label: "Cinematic 20",       driveId: "1bznqoKtb0PNYSk19HX8MT2CQrg4zRDqn" },
      { id: "sfx-cn21", label: "Cinematic 21",       driveId: "1TlsgqWPSwspSqOEPCZk7R3rNghu47LB_" },
      { id: "sfx-cn22", label: "Cinematic 22",       driveId: "12jMPGNlRcAs5c9xvRj30h5yylU8USvt1" },
      { id: "sfx-c23",  label: "Cinematic 23",       driveId: "1Lj5G4MFGGTiv88oBWHp4oCW9tXxhvaoLT" },
      { id: "sfx-c24",  label: "Cinematic 24",       driveId: "1jwzhKuiX31J8tg05iwQZiN7bz-p4kOqg" },
      { id: "sfx-c25",  label: "Cinematic 25",       driveId: "1F3-v2xAC_v24wRPr4Xs-XXzdFz8JI9l0" },
      { id: "sfx-c26",  label: "Cinematic 26",       driveId: "10psjIkg0d4f8raNECyhQIeo5i9o9Y-Ta" },
      { id: "sfx-c27",  label: "Cinematic 27",       driveId: "1L143D6b4042w5d_SPsnxE8gT3wp_xO7h" },
      { id: "sfx-c28",  label: "Cinematic 28",       driveId: "1zlmWsY1whyr1Dp38Kqj3Jk4-MCgUxxAd" },
      { id: "sfx-c29",  label: "Cinematic 29",       driveId: "15aQxvP9f5cTZnQvZsojM6jhQ65sVTINb" },
      { id: "sfx-c30",  label: "Cinematic 30",       driveId: "1S6QBb3Rl2XlK0BFOjoIRyPQti0QK9Ats" },
      { id: "sfx-c31",  label: "Cinematic 31",       driveId: "13DAqh0WnbclYlQ-iOTwASFZzicNsPNTN" },
      { id: "sfx-c32",  label: "Cinematic 32",       driveId: "173yKPpW9X68mjxp3hm9UPt3EyA1dUhP0" },
      { id: "sfx-c33",  label: "Cinematic 33",       driveId: "1XX2Nq3nYoPkAMF5OCFw1pgjkKr42tyHw" },
      { id: "sfx-c34",  label: "Cinematic 34",       driveId: "1tIZKbW4Ga0gZYtXt2ohz8lBxoVgS6slN" },
      { id: "sfx-c35",  label: "Cinematic 35",       driveId: "1sHHfc3LXjkX2JMkuM2BNhDOvkQAZJsMQ" },
      { id: "sfx-c36",  label: "Cinematic 36",       driveId: "101uXFsVew56EifcG2q7ZI3aQ1sRvPu-B" },
      { id: "sfx-c06",  label: "Cinematic Rise 06",  driveId: "1zxD9oqjDQssIc5Fm67Y_Z-U8r3LeWRS1" },
      { id: "sfx-c07",  label: "Cinematic Rise 07",  driveId: "1sYJSyP6tNEV3VHTe2GxoF3UI2pRSjJrE" },
      { id: "sfx-c08",  label: "Cinematic Rise 08",  driveId: "1-4uk9jaJC6qXHzMVqZvkts3hF-4H68hB" },
      { id: "sfx-c09",  label: "Cinematic Rise 09",  driveId: "1_ztGcbp6DAvzsSqcS_-TZC2kDRQrgDX3" },
      { id: "sfx-c10",  label: "Cinematic Rise 10",  driveId: "1p-f3mqhS3Nyws5MKEpOvm56pzxytH6aF" },
      { id: "sfx-corp1",label: "Corporate Rise 01",  driveId: "1LZDdTl5xdHJiL4dSJv56vIMpm8TGEAhk" },
      { id: "sfx-corp2",label: "Corporate Rise 02",  driveId: "1V3s6iQBuMBl1wAxP_poXx_aNaY7Bnbkk" },
      { id: "sfx-corp3",label: "Corporate Rise 03",  driveId: "11HJXEmJODPgXWMyes0O4U-yetI_Jwiqd" },
      { id: "sfx-corp4",label: "Corporate Rise 04",  driveId: "1Y4D7czJ9n_BnM0_pWkhhzwQxWSwyiJTV" },
      { id: "sfx-corp5",label: "Corporate Rise 05",  driveId: "1zA0PUsFiPmjZ9NY2zGAW3BPBBGS4G4Fu" },
    ],
  },
  {
    id: "sfx-misc",
    label: "Misc",
    emoji: "🎲",
    assets: [
      { id: "sfx-hit1",  label: "Hit 1",             driveId: "1-F9JWMQx-a60w160TvO7dZ94jxqex5b4" },
      { id: "sfx-fire",  label: "Fire",              driveId: "1m5K7iBUSjZm1IuckAYSSKTuWQiW0LHoC" },
      { id: "sfx-glw",   label: "Glitch Wave",       driveId: "1N0LQJVR-nbnIAerJpm1VqzK1eHAZD5zP" },
      { id: "sfx-comb",  label: "Comb",              driveId: "13imQLAY0DlBfkRVZHSHHHIrlH5a3w7zt" },
      { id: "sfx-entr",  label: "Enter",             driveId: "1r7mphQP-3RrCNZ0zI5IiuJ1smB0Tv6wj" },
      { id: "sfx-kbd2",  label: "Keyboard 2",        driveId: "1uksqiTyVM-kAQHUVBmcMFr35pfOhLJTL" },
      { id: "sfx-clk2",  label: "Click 2",           driveId: "12bx93rzPDQZD1QV1dTl9kaQVFNgZlZND" },
      { id: "sfx-clkw",  label: "Click Wav",         driveId: "1Qh2bMCNpySTIE0HxAA4Oo5ZaDgL6kT6x" },
      { id: "sfx-clkhd", label: "Click HD",          driveId: "18vzByHOAx2pxq-rO9nQvamH7anobjH2C" },
      { id: "sfx-dat1",  label: "Data 01",           driveId: "1zL46kfTev-Zt9FcTdaxQauxk7YQut7y5" },
      { id: "sfx-dat2",  label: "Data 02",           driveId: "1nQoidPv4TEZyl4l8O4-8TKRpIGQoyEL4" },
      { id: "sfx-dat3",  label: "Data 03",           driveId: "1Bkv3AvuM6WaN0UCl7DR0JZrBNKrfSgEy" },
      { id: "sfx-dat4",  label: "Data 04",           driveId: "1jAF13RLkAgO0sROMgILlB4VBN4sVz-Bn" },
      { id: "sfx-dat5",  label: "Data 05",           driveId: "1SY4EZAr1vxUsCpwVqQXwujb_5Pj2VLH7" },
      { id: "sfx-dat6",  label: "Data 06",           driveId: "1WlyfKjdR1oTqLDOS4qnqhaJCA6dXtXAQ" },
      { id: "sfx-dat7",  label: "Data 07",           driveId: "1w5LbSci8stVr8cJKSR5c1F5bLBmjr8AW" },
      { id: "sfx-dat8",  label: "Data 08",           driveId: "1z1T8oPfgut3_mdG2WSNXuODBaI7FqQfw" },
      { id: "sfx-clkfst",label: "Clock Fast",        driveId: "1FqVD1D-_MwRe_pJ5qWP1RBJZcTRyRGz3" },
      { id: "sfx-clktk", label: "Clock Tick HD",     driveId: "1xIXNJBEo9pEJ2JiohDwzoFe2H4pXenZr" },
      { id: "sfx-cntbmb",label: "Countdown Bomb",    driveId: "1QQd50rzEqefNZug2kzMVpnexyfnHfer5" },
      { id: "sfx-cnthgh",label: "Countdown High",    driveId: "1vEys5qW47t1Ak2_9SOiqWMp5HfqL_pd1" },
      { id: "sfx-8bit",  label: "8-Bit Coin",        driveId: "1U_DvanfJhcaPy8KRKMeGTW3Ql7JDM-If" },
      { id: "sfx-cens",  label: "Censura",           driveId: "1Nb_rbDOspfaTRV20Ah_mvV64Uun4ntrF" },
      { id: "sfx-10imp", label: "10 Impacts",        driveId: "1zrdpxVwq8Z-hwLXO3Ns54U1gLRZ77aH_" },
    ],
  },
  {
    id: "sfx-camera",
    label: "Câmera",
    emoji: "📸",
    assets: [
      { id: "sfx-camf",  label: "Camera Flash",      driveId: "1CxJkyGJkaEOz5pxARd5QNXY7BVTlKUpU" },
      { id: "sfx-cams1", label: "Camera Shutter",    driveId: "1yqtVUbY-zd42_r8k2LeNTriivpGuaeja" },
      { id: "sfx-cams2", label: "Camera Shutter 2",  driveId: "1p2cKeOXTcQYUon2Uv5MbRaePrhLevjD_" },
      { id: "sfx-cams3", label: "Shutter Sound",     driveId: "1i6PrnK02ZKjrqgqhHHAjbqXaSUsmsdYB" },
      { id: "sfx-cams4", label: "Camera Shutter 3",  driveId: "1lUIiskMinSTGpcbI3WfVQeJqPTV-iyc7" },
    ],
  },
  {
    id: "sfx-beeps",
    label: "Beeps & Alarmes",
    emoji: "🔔",
    assets: [
      { id: "sfx-beep1", label: "Beep",              driveId: "1HOWwf8l21b9qXOn5w368StLdJeurH-lp" },
      { id: "sfx-beep2", label: "Beep 2",            driveId: "1hvXthPXG866cFSo7T7vd2XJ3tJD7--MJ" },
      { id: "sfx-alrm1", label: "Alarm Sound",       driveId: "1Z7u1qJ27J7h5kXUqeO4-xpQyekgeuWEc" },
      { id: "sfx-alrm2", label: "Alarm Clock Beep",  driveId: "1UBdBvjqFf7b_OAkgMQgFXAizVKjfTI4D" },
      { id: "sfx-bell1", label: "Bells Positive",    driveId: "1T4aDnMiWUkqM7pRNM8P72i5x3aaRC_Qb" },
    ],
  },
  {
    id: "sfx-cartoon",
    label: "Cartoon & Pop",
    emoji: "🎪",
    assets: [
      { id: "sfx-cart1", label: "Cartoon Sound 1",   driveId: "1rIZEPfk-W-Vle8-vh9p4cMGFBJQgt6De" },
      { id: "sfx-cart2", label: "Cartoon Sound 2",   driveId: "1LSX_KrM7LCDPoJvWEotDggZNsVPW12Qx" },
      { id: "sfx-cart3", label: "Cartoon Sound 3",   driveId: "1mNKK9CEz4nT1ZYuedzRybXTFuuHnI3u1" },
      { id: "sfx-cacc",  label: "Cartoon Accent",    driveId: "1FvIghynAa6_UpDr3CIIQ6RmcwRmhQwhn" },
      { id: "sfx-pop1",  label: "Pop Sound 1",       driveId: "1XV5KiLCE9ZTZqjhr0l5iKRDNYxHqkGKq" },
      { id: "sfx-pop3",  label: "Pop Sound 3",       driveId: "1HTQnJF94rO9PXqM-Qoo2FtnLUJ_TZ9Ls" },
      { id: "sfx-pop4",  label: "Pop Sound 4",       driveId: "1xEK4skU1nhSGTx3na2TDfB8M5_H-H-4m" },
      { id: "sfx-prd",   label: "Pop Roll Down",     driveId: "18clF3qvXTIU8jALew0vJPY39_G6AnBkU" },
      { id: "sfx-prl",   label: "Pop Rolling",       driveId: "1lGyPbcg3jHqWL7OZIzKqUzImcxhL4H5P" },
      { id: "sfx-psd",   label: "Pop Slow Down",     driveId: "1wofz9_W8q8S-VMIZy2pXU4ssy1zU68jQ" },
      { id: "sfx-bub",   label: "Bubble Pop Up",     driveId: "1pOBF7Ef-VqMBGmObbWtEA9GqJw7b9KV2" },
      { id: "sfx-bell2", label: "Bell 1",            driveId: "1Sle3dU6nZdnxU6aHSkgwyPZiw4zpprQS" },
      { id: "sfx-bell3", label: "Bells 2",           driveId: "1ZWtneQWJwLzhGL2qqP-oX98K6gTcjs5y" },
      { id: "sfx-deskb", label: "Desk Bell",         driveId: "1ryBHzd7O_cv16QuiUCfta-fF-h3_hc0M" },
      { id: "sfx-chb",   label: "Church Bell",       driveId: "1GJdUtpSEhLu5ZKJgpH_xbTNap8AXlwZ6" },
      { id: "sfx-boom1", label: "Boom 1",            driveId: "1lT55Soej-upYDdc-oNZ9-roPm7LW7-oP" },
      { id: "sfx-emp2",  label: "Impact 2",          driveId: "1M8iO8bXAC7XunmyZOE5JSUcJNW10VFwg" },
      { id: "sfx-duck",  label: "Duck Quack",        driveId: "1fqBrASLecrJSFnixj7F0czYan1HfhIWF" },
      { id: "sfx-dolp",  label: "Dolphin",           driveId: "1rEPPc0fHXZ19NBXsXrEO-9-6gMuvY8lG" },
      { id: "sfx-rdck",  label: "Rubber Duck",       driveId: "1u186Hwd2Up3K94tyfxmMQuycSG6qwRyo" },
    ],
  },
  {
    id: "sfx-whoosh-digital",
    label: "Whoosh Digital & Big",
    emoji: "🔊",
    assets: [
      { id: "sfx-wd01", label: "Whoosh Digital 01",  driveId: "1qkDiPJ8VkFAdPT2viMRSyveubg7CMjP_" },
      { id: "sfx-wd02", label: "Whoosh Digital 02",  driveId: "1gGSSc0-pmRVWoJZINyLCgfhvKD0M7ZSs" },
      { id: "sfx-wd03", label: "Whoosh Digital 03",  driveId: "1NC1A1jkCx-inEGDQ4qL1uRtZWsJBBAC7" },
      { id: "sfx-wd04", label: "Whoosh Digital 04",  driveId: "1r6Ef-thzTxfnF9RjY5R4EzkxxPxo28v9" },
      { id: "sfx-wd05", label: "Whoosh Digital 05",  driveId: "1oZjCTrFN00eIEyGulTyyA-Vdj4D4T0j7" },
      { id: "sfx-wd06", label: "Whoosh Digital 06",  driveId: "19lBDyd3mHxkpPM-ecsguDb9a2JW3Jzty" },
      { id: "sfx-wd07", label: "Whoosh Digital 07",  driveId: "1aYhziMxRxsw1VaJ3nH42XEdd7L_XUDRv" },
      { id: "sfx-wd08", label: "Whoosh Digital 08",  driveId: "1J1VbY1WXd-IsCNIwCys22iB_plp6bSnV" },
      { id: "sfx-wd09", label: "Whoosh Digital 09",  driveId: "12XKOkkfnwwqBG4TwTGd-6aJtY2Pm51Mp" },
      { id: "sfx-wd10", label: "Whoosh Digital 10",  driveId: "1quutgVYcuTv5KsfO0LkYXt8U8di0n9vv" },
      { id: "sfx-wd11", label: "Whoosh Digital 11",  driveId: "1RywaKHd8Qsu3ALkfienCCkkB0dPGqCIi" },
      { id: "sfx-wf01", label: "Whoosh Fast 01",     driveId: "1OnNTrvsI9El7zW6LJaXO4ywpsuLaH3MU" },
      { id: "sfx-wf02", label: "Whoosh Fast 02",     driveId: "1bbcyahFpzf2hawYThIMPYWoHZp-N3riZ" },
      { id: "sfx-wf03", label: "Whoosh Fast 03",     driveId: "1_myos_HiP1xgeC_teZBRrIFtqm9k3O2U" },
      { id: "sfx-wf04", label: "Whoosh Fast 04",     driveId: "1MeV9Hk-yNU33knL5BPEqIMU6Mh9wFD_T" },
      { id: "sfx-wf05", label: "Whoosh Fast 05",     driveId: "1KSVFrYMk8dhinZOBgIMNbcJyz3ZdvyIU" },
      { id: "sfx-wb01", label: "Whoosh Big 01",      driveId: "1g36vGHx0DOiGox6hQ2lbFgCa2GEEUvGT" },
      { id: "sfx-wb02", label: "Whoosh Big 02",      driveId: "1OFO4_27cgHrup4qd4SEVETZQu09RxtMB" },
      { id: "sfx-wb03", label: "Whoosh Big 03",      driveId: "1StHQJIG_h8ZGVtQq75rxqPHL1AAH6OYd" },
      { id: "sfx-wb04", label: "Whoosh Big 04",      driveId: "1EZYc06L8SlaBiehz77cX00mj-VKO2AdY" },
      { id: "sfx-wb05", label: "Whoosh Big 05",      driveId: "1qcDynSppY41TXguQBVJxUvoGmGWZFsX4" },
      { id: "sfx-wb06", label: "Whoosh Big 06",      driveId: "11IEuUnvmDzdhyqU06jVrfd4GnQ0QeqjN" },
      { id: "sfx-wb07", label: "Whoosh Big 07",      driveId: "1N83ZoWkpup8lFxxztO_k_q04qrlEsodQ" },
      { id: "sfx-wfire",label: "Whoosh Fire",        driveId: "1Iir1S9Pr8q1FgjdHDEy0zREn7JoPTm67" },
      { id: "sfx-rake", label: "Rake Swing Whoosh",  driveId: "1hqG98UQ15XhC8a8E1wNvUSUIo_lYeI0Q" },
      { id: "sfx-fwh",  label: "Fast Whoosh",        driveId: "1KIWmkdJhQBLh2tEPuaHu2pqx69E4rXvq" },
      { id: "sfx-sw01", label: "Swoosh 01",          driveId: "1s-9n9kgTtjsEaXK3IQ9xjK6MpgAPp4cz" },
      { id: "sfx-sw04b",label: "Swoosh 04b",         driveId: "1bzTijdPPz53BKsafpoQlMpyjFcCL8mrC" },
      { id: "sfx-sw06", label: "Swoosh 06",          driveId: "1pMm0dEbTNmIsUbG-S7HlrWia_BpERjDr" },
      { id: "sfx-sw07", label: "Swoosh 07",          driveId: "1z8hZ5-P0YF3z0Yzv7ytxLJ_bFxSrUCzD" },
      { id: "sfx-sw14", label: "Swoosh 14",          driveId: "1eKeaSzpEFTXzCFQ4WIT1sOfxjxBxJaV8" },
      { id: "sfx-sw19", label: "Swoosh 19",          driveId: "1d4IJp2I6Yta1aK8TKm9z9ycCOkNw011F" },
      { id: "sfx-sw20", label: "Swoosh 20",          driveId: "1lDHne66uUoM16uOqQWUVdjs-2wdN36Hl" },
    ],
  },
  {
    id: "sfx-short-whoosh",
    label: "Short Whoosh",
    emoji: "💫",
    assets: [
      { id: "sfx-shw01", label: "Short Whoosh 1",    driveId: "1EzkQKk67KzpyTMwlCSeGCTEgFLGdwbdG" },
      { id: "sfx-shw02", label: "Short Whoosh 2",    driveId: "10AtkNkFO98r_DtGubYgHz9PkhiUoaU3A" },
      { id: "sfx-shw03", label: "Short Whoosh 3",    driveId: "143orDbUk_C-O8UVD7N3OeFSRv5K0NT83" },
      { id: "sfx-shw04", label: "Short Whoosh 4",    driveId: "1g82rTPuYi7LHI3ApULdFMIYNxeBmdAmM" },
      { id: "sfx-shw05", label: "Short Whoosh 5",    driveId: "1Sj_-cmkXrmHRszhGHZdd48FZnfz_PaNp" },
      { id: "sfx-shw06", label: "Short Whoosh 6",    driveId: "1yp_tVNQDDND0cwoVjMJqH58R-4nlPkqL" },
      { id: "sfx-shw07", label: "Short Whoosh 7",    driveId: "1NOESTaD8QDb87H3IByS8_5LaOVN74A_l" },
      { id: "sfx-shw08", label: "Short Whoosh 8",    driveId: "1m9D0wKTzTWUTgYZ2gB0y-tHh5URtjmxT" },
      { id: "sfx-shw09", label: "Short Whoosh 9",    driveId: "1w2VLwXOQ0cYe6Kr4-SKobVGT1xT7jvzs" },
      { id: "sfx-shw10", label: "Short Whoosh 10",   driveId: "1RoiY8H4vWbYRpCWRpeTzOkS-Dq0QZf8A" },
      { id: "sfx-shw12", label: "Short Whoosh 12",   driveId: "1PG_yu5Z7CTKcllwAOnprPBBzyqcDso9V" },
      { id: "sfx-shw13", label: "Short Whoosh 13",   driveId: "1PP6AQSXtd0PZhiNrKtLTIIUdeIcXf9g7" },
      { id: "sfx-shw14", label: "Short Whoosh 14",   driveId: "1P71rAvBu6NmGB4OCxQanSpoe45uO6i67" },
      { id: "sfx-shw15", label: "Short Whoosh 15",   driveId: "17oBCfIyaPiv7zzvXkrtOU7Zlh1KKFRab" },
      { id: "sfx-shw16", label: "Short Whoosh 16",   driveId: "1bMuWalnTcqfkXZbjd-sDMaD2zDe5VO40" },
    ],
  },
  {
    id: "sfx-ui",
    label: "UI Sounds",
    emoji: "🖥️",
    assets: [
      { id: "sfx-ui01", label: "UI 01",              driveId: "1rgK4vzg6htr5hXctc2b5lau--3fKl1dH" },
      { id: "sfx-ui02", label: "UI 02",              driveId: "1m60MYAgOhLT0q9k3s1y072xu6HjTtgJA" },
      { id: "sfx-ui03", label: "UI 03",              driveId: "1kWPgqV3MeVAfFq4wfYpi-t13v_PY9ISR" },
      { id: "sfx-ui04", label: "UI 04",              driveId: "1LNMPyAs5udNvUonh92pF8_ytbMHIL_0_" },
      { id: "sfx-ui05", label: "UI 05",              driveId: "1GRvwZHJS110AYatxHNHpFL9iLY2-VqoV" },
      { id: "sfx-ui06", label: "UI 06",              driveId: "1ePI0iaLaSVeySJfYhyaexLDlM9XMg8PT" },
      { id: "sfx-ui07", label: "UI 07",              driveId: "1vSEBCavUWRftxwYHinHvDKbKQmFdxE2w" },
      { id: "sfx-ui08", label: "UI 08",              driveId: "1dwsSn5LhWPwXijqk_I-PKK1BbtIThyZU" },
      { id: "sfx-ui09", label: "UI 09",              driveId: "1ZyWOkpYuKFR4JquecynSC_Y1tDq71xUB" },
      { id: "sfx-ui10", label: "UI 10",              driveId: "15ior7uOtcssMHCR_oa8A2UvhbtdjVN7R" },
    ],
  },
  {
    id: "sfx-whoosh-ashish",
    label: "Whoosh Pack",
    emoji: "🌬️",
    assets: [
      { id: "sfx-aw01", label: "Whoosh 1",           driveId: "1pu_HXtRIaBDJzcKdPWYkY98WHXe4kB31" },
      { id: "sfx-aw02", label: "Whoosh 2",           driveId: "1AigOoHXM3uzkkYszR4N0vb0nwHEcxBlE" },
      { id: "sfx-aw03", label: "Whoosh 3",           driveId: "15DO4jm12J6NnDQ0r2tC2krcTdXUp_NBC" },
      { id: "sfx-aw04", label: "Whoosh 4",           driveId: "1ae0gQu9WX55eCxUGrCHRXqjYTFMU5Q0M" },
      { id: "sfx-aw05", label: "Whoosh 5",           driveId: "1_nG2u_xXrMMLACYwr1F5tfVOo3jy5hw2" },
      { id: "sfx-aw06", label: "Whoosh 6",           driveId: "12pqvxf0JLfshZm0FY8IVh_iRm0YOZt8O" },
      { id: "sfx-aw07", label: "Whoosh 7",           driveId: "1rpcCku0di0bieDxNhGmlUDjAHc1zE_vp" },
      { id: "sfx-asw5", label: "Swoosh 5",           driveId: "1pvHJdZLe3BZfeglYJ5wijmE0mY7RF85t" },
      { id: "sfx-asw6", label: "Swoosh 6",           driveId: "124X5a6Vj6gB_fzGHkx45LidS5_cOlzk2" },
      { id: "sfx-fswf", label: "Flash Swoosh",       driveId: "1I2F5mJUaiWuodNxtsaSSwBU7kq7T81Jw" },
      { id: "sfx-fswa", label: "Fast Swoosh",        driveId: "159d7R9pSZK6qA8renplLmbzNu2ROspMa" },
      { id: "sfx-fwha", label: "Fast Whoosh A",      driveId: "1mr5fe6X8aVJgQuTd8Zk9eHoUXFm6LXci" },
      { id: "sfx-fwhb", label: "Fast Whoosh B",      driveId: "1n73sCjUNImqjIT05SEuKv8UMwkqokI5N" },
      { id: "sfx-airsw",label: "Air Swoosh",         driveId: "1M9GrbuZ-CAdtG3oNKaLIrhGw64BBRqLs" },
      { id: "sfx-airbw",label: "Air Blow",           driveId: "1trLsvz4qxwRFYF77GC8Bm_ZbrDUjE67O" },
      { id: "sfx-dsw",  label: "Deep Swoosh",        driveId: "1UhRrCt0L6yyOn6UB4TeHUI5uz-5SvbX8" },
      { id: "sfx-dwh",  label: "Deep Whoosh",        driveId: "1Bxjpk909btlmUZti2QqrTcg5Vejmjp3C" },
      { id: "sfx-lwh",  label: "Low Whoosh",         driveId: "1EpgsdevWI-GFTteMrTzL1fKr2uCE7JFN" },
      { id: "sfx-lswa", label: "Swoosh Lower",       driveId: "1GA5KnMlbaiCZ1VQYfbgpu22XAvYDF3L-" },
      { id: "sfx-sdwn", label: "Swoosh Down",        driveId: "1oH3BpRvLfmj7-E-XuDWZJT_p9H_rhXc_" },
      { id: "sfx-whip1",label: "Whip",               driveId: "1Yrv31vEn80sdUnQFfKCL2PNF1g4Hr108" },
      { id: "sfx-whip2",label: "Whip 2",             driveId: "1aV8en5l2c6YPdrKCpVjX2PYDhYOHVM51" },
      { id: "sfx-whipl",label: "Whip Low",           driveId: "1jkOGnn0YFE7Y2xFe1nZ1BDZNXUW4jfgj" },
      { id: "sfx-magic",label: "Magic Spell",        driveId: "1ooy7AtKf7JCmK9s6Ag9hVtGjIMgUkh9q" },
      { id: "sfx-slmb", label: "Slow Motion B",      driveId: "1HJd7Yo9WVPXzCUi_f1M_VH4Q90G-Vzsb" },
      { id: "sfx-strng",label: "String Effect",      driveId: "1-Kcs3SzSj8qrGqw1TSw2U7i58Wp7rNRN" },
      { id: "sfx-slrsw",label: "Slow Reverb Swoosh", driveId: "13RjkZcpRNUBrIPhdVZPdMYnPfvUZB5Yg" },
      { id: "sfx-thkwp",label: "Thick Wipe Phazed",  driveId: "14MmDLMsc02AaIUAX7O99JemHwgockMQ1" },
      { id: "sfx-spsw", label: "Speed Swoosh",       driveId: "198Yq1IF482KMGNb4FfiuXmeSSWjIueid" },
      { id: "sfx-swpl", label: "Swoosh Phazed Long", driveId: "1AMHFIu9HVyBPyZhhT5uarJyzvHhDZMCr" },
      { id: "sfx-stsw", label: "Static Swoosh",      driveId: "1LpYQCXM122hFf_TfWcZjYonZMZ3qa-bA" },
      { id: "sfx-swsh5",label: "Swish 5",            driveId: "1OGWbJ7aCAE0FeydypMkZIJjnQwhEnVBq" },
      { id: "sfx-schy", label: "Scary High Zing",    driveId: "1S0DTonrw8uqOt7KP1xqAB28siq_bA0-b" },
      { id: "sfx-spwsh",label: "Space Ship Woosh",   driveId: "1VzAMS7Hpt66HNsGxaKqzewl9QQtSd3Zd" },
      { id: "sfx-spwsh2",label:"Space Woosh",        driveId: "1_t6rf_40dKhNaMH4rrEHblnBUnDM5a9F" },
      { id: "sfx-spfly",label: "Space Ship Fly By",  driveId: "1yyTwyFf7NyTOQpgLt7G9GUHE4ctDKF2T" },
      { id: "sfx-rkt",  label: "Rocket Effect",      driveId: "1KLVaosNKdFbTdDbdNgi10rtnF0R2brr1" },
      { id: "sfx-run",  label: "Run",                driveId: "16FhKSsgLqjIwGFblUqX-rRS_QMGImEPh" },
      { id: "sfx-rvr3", label: "Reverse Riser 03",   driveId: "15zG9EaUFgV4f7lIhaAVSoA7SMf1DTLnm" },
      { id: "sfx-rvr4", label: "Reverse Riser 04",   driveId: "1rRO2m_funV-bCcgZmN9XX-KdbXSAtLrN" },
      { id: "sfx-stflb",label: "Stutter Fly By",     driveId: "1n9d9HrBF2rCTYmBucCm6WyLumdFR27qg" },
      { id: "sfx-stswh",label: "Stutter Swish",      driveId: "1e4XcC1JZcmmlm1LBFqc7xOhMsjR866L-" },
      { id: "sfx-stwsh",label: "Stutter Woosh",      driveId: "1qeIzkaXqRq4JiqgRwaTLTKMe5Gp3W4aV" },
      { id: "sfx-thkw", label: "Thick Wipe",         driveId: "1ocCdGD7cjcGLaWxsFXpmygrvfENbDx9E" },
      { id: "sfx-whmp", label: "Whoosh MP",          driveId: "1cITRjyOo_Gvbo6UYDIZ-QGG1jOYQ69Tn" },
    ],
  },
  {
    id: "sfx-whoosh-pack2",
    label: "Whoosh Pack 2",
    emoji: "🌀",
    assets: [
      { id: "sfx-nws01", label: "Whoosh Swoosh 1b",  driveId: "1290FkM4rl8mpQZkBiwBUaugpz5QXx8Ym" },
      { id: "sfx-nws03", label: "Whoosh Swoosh 3b",  driveId: "1o3U6lyGj3mjuwQsiXO6Jhc8VpNcvnn3L" },
      { id: "sfx-nws07", label: "Whoosh Swoosh 7b",  driveId: "1wGE_HLiyXmWGlgEwJOE0ZqMuqH8swevT" },
      { id: "sfx-nws09", label: "Whoosh Swoosh 9b",  driveId: "1rBQDTPvfwdr8IxHwB8tXaMVdWWUI4FON" },
      { id: "sfx-nws10", label: "Whoosh Swoosh 10b", driveId: "1hg-2u7zH3E4lJXnl7fSc2kT2E91cc--H" },
      { id: "sfx-nws11", label: "Whoosh Swoosh 11b", driveId: "1S3sutwQmZJCwNTy7nWWff3doEQqZ8_kI" },
      { id: "sfx-nws12", label: "Whoosh Swoosh 12b", driveId: "1ibdBn7YbRW_coopzExSSZRs0Cz7WMNNF" },
      { id: "sfx-nws13", label: "Whoosh Swoosh 13b", driveId: "172JoDc3q97-SEEn6t_WXoyOpEqZvLqN1" },
      { id: "sfx-nws14", label: "Whoosh Swoosh 14b", driveId: "1CZt73UKSuZoBoG09DB_DRXJq5ZtrhyzO" },
      { id: "sfx-nws15", label: "Whoosh Swoosh 15b", driveId: "12Z4VVmlAQRMqkAtkLcTFrc84etIC1f8O" },
      { id: "sfx-nws16", label: "Whoosh Swoosh 16b", driveId: "1YEZP1tO37p8O9s412MK7UnAdHI1fNHIZ" },
      { id: "sfx-nws17", label: "Whoosh Swoosh 17b", driveId: "1rYwkE8B-xbb5_S8duFg-_lqmnjxZf5dK" },
      { id: "sfx-nws18", label: "Whoosh Swoosh 18b", driveId: "1FvJh7dNQ-G6_0Sa1ZaEB-g73GoCmMoV9" },
      { id: "sfx-nws19", label: "Whoosh Swoosh 19b", driveId: "1WhoKeW0DfC_Ht_Cp5iSDqaHn7Vn5ByJ4" },
      { id: "sfx-nws20", label: "Whoosh Swoosh 20b", driveId: "1hsWUr1r8PTrU97atMPhf6Y6EOxwMOJ8J" },
      { id: "sfx-nws21", label: "Whoosh Swoosh 21b", driveId: "1Yg4rahI69PgwdUJZLYTHsqm-WuwuB8Mq" },
      { id: "sfx-nws22", label: "Whoosh Swoosh 22b", driveId: "1_zuUbmrDIlvkU6jXiQbePTYiwB1gwvQ2" },
      { id: "sfx-nws23", label: "Whoosh Swoosh 23b", driveId: "1gm-xkhFRGHemYTHQrEMIJmEk-W0-57MS" },
      { id: "sfx-nws24", label: "Whoosh Swoosh 24b", driveId: "1jC7mRyWk3Hfib3LnpSa4tyy6H7Dn-4Wo" },
      { id: "sfx-nws25", label: "Whoosh Swoosh 25b", driveId: "19oBAWEJ-UBzVZlQjFLl8JlEjPo9KE8du" },
      { id: "sfx-nws26", label: "Whoosh Swoosh 26b", driveId: "1sPe3cRtjNVubJ-OjBGHEpV2wloQWpY9c" },
      { id: "sfx-nws27", label: "Whoosh Swoosh 27b", driveId: "1waVJ-QB8lPiOcnNOdszugtGo4cQc00fu" },
      { id: "sfx-nws28", label: "Whoosh Swoosh 28b", driveId: "1fekrg7jES7Tf-2KJx_E6-iTzCTNNRY0p" },
      { id: "sfx-nws29", label: "Whoosh Swoosh 29b", driveId: "1XzNgiOhQvXtL6urXnWflhx5F-qIIYMR3" },
      { id: "sfx-nws30", label: "Whoosh Swoosh 30b", driveId: "1FXPx8vxBImlHva3CUJ4590PEMcN8PS5v" },
    ],
  },
  {
    id: "sfx-natureza",
    label: "Natureza",
    emoji: "⛈️",
    assets: [
      { id: "sfx-rain",  label: "Rain",              driveId: "13xstB5ODesp2vOeQOOsRLTqcVTBwLZp4" },
      { id: "sfx-thnd1", label: "Thunder Lightning", driveId: "1ALXD2DG7CHeHhF8EqyxX3iWGxNE6gqLC" },
      { id: "sfx-thnd2", label: "Thunder 1",         driveId: "1Tp-mzyajaM3_5B7oiYuyI2YtjyrqSx6L" },
      { id: "sfx-storm", label: "Storm",             driveId: "1x5qAtJz-gX5lTe-dL5Kfy1CHGUDcRAqg" },
      { id: "sfx-torn1", label: "Tornado",           driveId: "1Jz5t6iQx5fXk6PLAi_-2V8TOjFSQdIqg" },
      { id: "sfx-torn2", label: "Tornado 2",         driveId: "1Z9DUD-5lYZuWBh_Bebhb57D5YDhl4NvE" },
      { id: "sfx-wind2", label: "Wind",              driveId: "1fgoWZC8Mmagev2RYUVP23mTJB-vSPytg" },
      { id: "sfx-wdrop", label: "Water Drop",        driveId: "1kOFNFDKznAYQeZzsKt_MWgPQ2yYkZ9L2" },
    ],
  },
  {
    id: "sfx-memes",
    label: "Memes & Viral",
    emoji: "😂",
    assets: [
      { id: "sfx-troll", label: "Troll Kids",        driveId: "12bHpWJhezah95unVo7Wrl2xNWuX8TH3o" },
      { id: "sfx-trnsc", label: "Turntable Scratch", driveId: "17Wp_uQMPPTeB4k7yNQlXJ9bOSq2tFaDM" },
      { id: "sfx-mlg1",  label: "Trickshot MLG",     driveId: "185N1pQDx6qxo8izFacgdr9hqKpUxB8Iz" },
      { id: "sfx-wrun",  label: "Why Are You Running",driveId: "1Alq2BEp08_t_qbzI4jCWnmw6PzIRJtaC" },
      { id: "sfx-wah",   label: "Wah Wah Fail",      driveId: "1BXq2L5opOhFZ_nwAT7XsHdyuTHoGxvUS" },
      { id: "sfx-mlg2",  label: "Window Error MLG",  driveId: "1DvrbP4LRYB_pl9niT0aQg6W0BuAbVHFt" },
      { id: "sfx-yolo",  label: "Yolo",              driveId: "1OuMVK9VfHaaOWeerjdtKO2uIucZmEk5g" },
      { id: "sfx-pkm",   label: "Who's That Pokémon",driveId: "1QsnjrVGES52wfWWSTPptpEgzh8JOJ9Hz" },
      { id: "sfx-wweb",  label: "WWE Bell Ring",      driveId: "1TcWX6B-b09sJ1wyahy8R7seXg0LsKaCe" },
      { id: "sfx-wait",  label: "Wait A Minute",     driveId: "1W2BoA_zGio7iKRrb7ZH-jDUdcf8Ig_Yx" },
      { id: "sfx-waka",  label: "Waka Waka Pacman",  driveId: "1k9rikEZ-Zy4deY3GYWtUwBttEHIpLdH-" },
      { id: "sfx-wbzr",  label: "Wrong Buzzer",      driveId: "1lAkyYwKIcYIH7axgUwcjodweLi6qUisl" },
      { id: "sfx-ysfn",  label: "You Say You're Fine",driveId: "1usVgF66dWowIJ-AwdRncVHPTapU-HBFn" },
      { id: "sfx-smf",   label: "Surprise!",         driveId: "1CeD53OFfSFP5onT6wZNPAQYMhcOuf7nA" },
      { id: "sfx-derp",  label: "The Derp Song",     driveId: "1zQBoOd1vJ3Ez4LbLHPHgfIVa6gefI_mr" },
      { id: "sfx-fool",  label: "Fool",              driveId: "1-uNcFi1h7EqlODP0t18caxHCgUdue557" },
      { id: "sfx-rumbl", label: "Let's Get Rumble",  driveId: "11-u2sx2mBWMcFYiFh9olkxDSs9M-QbQG" },
      { id: "sfx-nogod", label: "No God Please No",  driveId: "17jPVeyiCz-KhCmE04nABDDAR0G5zVGez" },
      { id: "sfx-jdi",   label: "Just Do It",        driveId: "19edBuXeysJFmTY6SJun1X7PPfCIEEN_9" },
      { id: "sfx-whell", label: "What The Hell",     driveId: "1zHcZyRiUdBiX8_J_c-7uzZsInqiNmUgV" },
      { id: "sfx-rcld",  label: "ReactionCrowd 1",   driveId: "1hwVaUrj4Z6gZ8jykqK130b6jsj3qMebo" },
      { id: "sfx-rcld2", label: "ReactionCrowd 2",   driveId: "1uS9w0j8qzspW9clFCG-eZhTIm4cLFiOd" },
      { id: "sfx-rchl",  label: "ReactionChildren",  driveId: "19pX6aGdNGiilZYkI6wcQ3dRFkTvj6Fpm" },
      { id: "sfx-kidsw", label: "Kids Cheering",     driveId: "14bhje1UceY3j_9L-gv15d-hFQRQl7q0M" },
    ],
  },
  {
    id: "sfx-misc2",
    label: "Pack Extra",
    emoji: "🎭",
    assets: [
      { id: "sfx-ding",  label: "Ding",              driveId: "1RuZYOo_f-ZMhPb3CmM7xuEKVFsFqHLXD" },
      { id: "sfx-ting2", label: "Ting Sound FX",     driveId: "1UsMSscBf0Jha0MlubePu3mlD576FcfkL" },
      { id: "sfx-ting3", label: "Ting!!! 1",         driveId: "1_x_4N5xokg0DUJU4W21KSvDIFZs2Uax2" },
      { id: "sfx-ting4", label: "Ting!!! 2",         driveId: "1vLnY9FIvfeaT1ZdCit-G-5koaQ6Dv3Cx" },
      { id: "sfx-qwin",  label: "Quick Win",         driveId: "1BqDnt3yiFA_WYLrfp63ImWxosSAxzs5i" },
      { id: "sfx-sfx11b",label: "Sound FX 11b",      driveId: "1gMdElj1kmSmCTlVwotxbMTUVJKZSnf_X" },
      { id: "sfx-10imp2",label: "10 Impacts B",      driveId: "1yoZ5moX3xXVK1vwLbQ-A3cmeNzTzLrU3" },
      { id: "sfx-pnch1", label: "Punch 1",           driveId: "1nbywXFRo7ktytQwaE5qlNR366G_tGDed" },
      { id: "sfx-pnch2", label: "Punch 2",           driveId: "1YE92OgDUQ4k9lZLXv6kxpDD8ueG-hi4b" },
      { id: "sfx-pnch3", label: "Punch",             driveId: "1zbjOGML89R8pDdvCcBJ8BTVZtorFw08P" },
      { id: "sfx-expl",  label: "Explosion",         driveId: "1-4aW0Mr7lnyrCCGFs4Q4F2K5drEEfFYm" },
      { id: "sfx-sadsf", label: "Sad Romance",       driveId: "150c-Zq9dSqh-Ur8vO_L8MVkEjBjt6--r" },
      { id: "sfx-sade",  label: "Sad Effect",        driveId: "1spPgYY2XYy4052W-21dh4INd4u6AQY0Z" },
      { id: "sfx-splat", label: "Splat",             driveId: "15J0vk4GgFYDny-OK9de8hCKWgEJnfYRC" },
      { id: "sfx-susp",  label: "Suspense",          driveId: "1o1dcVwdnYD9Wz9XA8U6tBJVkxEP1pQD2" },
      { id: "sfx-rdck2", label: "Rubber Duck 2",     driveId: "1RnFKy_R5KVm0xJucV2bMaI_bmOvS2KLS" },
      { id: "sfx-tapew", label: "Tape Rewind",       driveId: "1HZM5vHFHmVlit-9zjEmgwTvtJR2umtXN" },
      { id: "sfx-schlb", label: "School Bell",       driveId: "1DXvHjCHyBHnsCa4YnLW4jiyoMtAxGIP1" },
      { id: "sfx-torp",  label: "Torpedo",           driveId: "1v5bMDduFtS94lMdk7BbZGoO6Di71v-sz" },
      { id: "sfx-typw",  label: "Typewriter",        driveId: "1pzrXxv1UVJiJhtdJU1vwgMW2DO0TrS1M" },
      { id: "sfx-bldr",  label: "The Builder",       driveId: "1KrE3XYwGFzx5SlMxK2PA95JuNdMb4dHH" },
      { id: "sfx-stev",  label: "Steve Death",       driveId: "1YRuBmX3BHlW-sQds2ZMyVv2mXE62vMkc" },
      { id: "sfx-hbeat", label: "Heart Beat",        driveId: "1F0bDr9QBlTOpAFrHamuuJ-MzYtqY7jXV" },
      { id: "sfx-horn3", label: "Horn 3",            driveId: "1BrKV0Fe7Eqv6pS4BA2mB5a_-HcF2-LbS" },
      { id: "sfx-jblls", label: "Jingle Bells",      driveId: "1J_DZfwaorFzEFmJgYTTQxkltJGcTZCX0" },
      { id: "sfx-mario", label: "Jump Mario",        driveId: "1ABK-JEJ7ZhLwbmp1sgmFSa6CnnWaHaix" },
      { id: "sfx-mrygo", label: "Merry Go",          driveId: "19yqWc_Ue73dgp-7gRNjV_rLolrKJ3RoI" },
      { id: "sfx-inv",   label: "Investigations",    driveId: "1B8NGVCF-WOQtHY-gwSQ3fi7HNFQ1WQ63" },
    ],
  },
  {
    id: "sfx-dinheiro",
    label: "Dinheiro & Acertos",
    emoji: "💰",
    assets: [
      { id: "sfx-money1",  label: "Money",              driveId: "1f_u2VEbsQuUZeKlpBDXriT3lhXNKLWj8" },
      { id: "sfx-kaching", label: "Cash Register",      driveId: "1ozvVmK9abXcE4sHnOOn89yYcRu-YRjZv" },
    ],
  },
  {
    id: "sfx-animation",
    label: "Animação",
    emoji: "✨",
    assets: [
      { id: "sfx-anim1", label: "Animation 1",          driveId: "1YnYGGbU00VBxGVmOacEqOkmsR9c-5zH7" },
      { id: "sfx-anim2", label: "Animation 2",          driveId: "1yWm-5Xh7cYOlGpaOiu2Pu-S8HURQOaXQ" },
      { id: "sfx-anim3", label: "Animation 3",          driveId: "18qMS4EN46xE_CZsLel9rM6SkgtIegxzP" },
      { id: "sfx-anim4", label: "Animation 4",          driveId: "1DV68C4PBfRNXQte1ljitQMK6NuHAZbLE" },
      { id: "sfx-anim5", label: "Animation 5",          driveId: "1lOtDmBSQ89IB7BDl-zwuMbi1X5xEDiKs" },
    ],
  },
  {
    id: "sfx-papel",
    label: "Papel",
    emoji: "📄",
    assets: [
      { id: "sfx-ptear",   label: "Paper Tear",         driveId: "19MOgTmwTOIM7g7mndRNPEOHEk8Bj1HEF" },
      { id: "sfx-pflip1",  label: "Paper Flip 01",      driveId: "1gjIr-bYMsGKYLnuOSYAPuI-4XULrkPAE" },
      { id: "sfx-pflip2",  label: "Paper Flip 02",      driveId: "1G-TxFRJtR0jPopZEuYRvTNpdBQMuOsSG" },
      { id: "sfx-pcrmp1",  label: "Paper Crumple 01",   driveId: "1KF8xVt7HxnQTTOrcKM7XS_jINBxqt_uH" },
      { id: "sfx-pcrmp2",  label: "Paper Crumple 02",   driveId: "1s4yD06Jdr8C9tpU8e7bi8Gguvar2ZaBz" },
      { id: "sfx-pcrmp3",  label: "Paper Crumple 03",   driveId: "1ux9mPR8JTIzYSj_Q14-nMn1QlDFTKmJ_" },
      { id: "sfx-prip",    label: "Paper Ripping",      driveId: "1rk4FWwvCyW4AdtxpoRm544efkQDKXxO5" },
    ],
  },
  {
    id: "sfx-pop-pack",
    label: "Pop Pack",
    emoji: "🎈",
    assets: [
      { id: "sfx-pop0",   label: "Pop",                 driveId: "1SYRFYqF-uF4UyAwGWB3QlSo0qs19KHRO" },
      { id: "sfx-pop1",   label: "Pop 1",               driveId: "13i7vd82aTyuxAApxozO9A00MXfenfS17" },
      { id: "sfx-pop2",   label: "Pop 2",               driveId: "1PjNVIFyqe6Dyn7LajGxzyH94VD0mlTit" },
      { id: "sfx-pop3",   label: "Pop 3",               driveId: "1Xh0o7Cja6tGi74NFz5maMB07s2LOAQXT" },
      { id: "sfx-pop4",   label: "Pop 4",               driveId: "1XRNbI7zfa1bcxo_wOwpK8mAMvH2guvJ7" },
      { id: "sfx-pop5",   label: "Pop 5",               driveId: "1CEVxBd8-wAcNgiMhsWI7EOmaY5qYR3Mr" },
      { id: "sfx-pop6",   label: "Pop 6",               driveId: "1R3kum5Y9aN2Sy-k5R_GZcZpjghWtYCPx" },
      { id: "sfx-popsfx", label: "Pop SFX",             driveId: "18II2sVAIF7sS7AsW_QR27SDCd35-Neou" },
    ],
  },
  {
    id: "sfx-interface",
    label: "Interface & Notificações",
    emoji: "📲",
    assets: [
      { id: "sfx-mclick",  label: "Mouse Click",        driveId: "11euY6aycR5LfLq4Ho3NjqEd61QzmtJTY" },
      { id: "sfx-screen",  label: "Screenshot",         driveId: "1VF-4NCq0d-21fG2i5D4B7HkCCEXbn7l1" },
      { id: "sfx-shsw",    label: "Short Swoosh",       driveId: "1pXo6KvOmEgLCjdc1mP72q6Lkyb9SmA98" },
      { id: "sfx-notpop",  label: "Notification Pop Up",driveId: "11p-7qye6X2DI0ddDLAV33iLykA8xli13" },
      { id: "sfx-plastic", label: "Plastic Wrapping",   driveId: "11tBPo23dQO1bRCc9e4AvAXSlgd9nIH4w" },
      { id: "sfx-notbell", label: "Notification Bell",  driveId: "14gFRI8TLZjxJTSr7Gb3inEtQsYlda1n4" },
      { id: "sfx-sprpop",  label: "Spring Pop Up",      driveId: "19yc2OdhlaZXgqtFySeJ7QRrCfPdRT58_" },
      { id: "sfx-typing",  label: "Typing",             driveId: "1S5iDDd1raCeQgHcBDnvS1c0jqlJM-BTz" },
      { id: "sfx-txtrd",   label: "Text Readout",       driveId: "1UxN6fIL2fvHAIEg-TWBvzMklWKCeXOI2" },
      { id: "sfx-fsnap",   label: "Finger Snap",        driveId: "1fiWsVv645fAfrd6N6nd17qtqr_qG2Ny2" },
      { id: "sfx-taxi",    label: "Taxi Meter",         driveId: "1ySe8JOmpqopqbTjXYc2l80PuGNzbVAme" },
      { id: "sfx-spin",    label: "Spin",               driveId: "1lHKWs_g6BaQsS1eRGUSuAnZgLfxTtx0x" },
    ],
  },
  {
    id: "sfx-impacto",
    label: "Impacto & Metal",
    emoji: "⚔️",
    assets: [
      { id: "sfx-himp",    label: "Hard Impact",        driveId: "14KM3J2vNfwQeTk677DLB75MJH_pMKMU0" },
      { id: "sfx-mtimp",   label: "Metal Impact",       driveId: "1_w-DlwCHHIg7R_gXHJZc3btqSz-KEV6Z" },
      { id: "sfx-bsimp",   label: "Bass Impact",        driveId: "13YASIWrfSHr9dfsEcAm7TXXy-ckx2TUV" },
      { id: "sfx-mtsw",    label: "Metal Swoosh",       driveId: "1yeeg9qr0bEvWD7Mg9szaetbAlI_ALr4U" },
      { id: "sfx-mtsimp",  label: "Metal Swoosh Impact",driveId: "1l0UJkrbMpqEF_OwiUoziYcarqdvXNPbg" },
      { id: "sfx-spdbr",   label: "Speed Breaker",      driveId: "1QaE5BQW-VW__3Ti07DuU7ub4Tu9pulWz" },
      { id: "sfx-lgsw",    label: "Long Swoosh",        driveId: "1ucMtksmZcMD8nVt3_ZjIeGNLfuLM-rFD" },
      { id: "sfx-swrev",   label: "Swoosh Reverse",     driveId: "17UtkgyiIbTJV-szFe6V2Dkcm69nPsLt2" },
      { id: "sfx-slm1",    label: "Slow Motion 1",      driveId: "19KV0UFAgiluoCxv2rsmPf3_W4k8-pwMu" },
      { id: "sfx-ms50",    label: "Metal Slice 50",     driveId: "1IJU2q2W8_shVgYFSy61Q6avQ9YVaVxQu" },
      { id: "sfx-ms51",    label: "Metal Slice 51",     driveId: "1gfNkMTo3OWhtYIDOW5lXBEIbGBmDpIMs" },
      { id: "sfx-ms52",    label: "Metal Slice 52",     driveId: "1CR50iqFE5SPbzwm5VCfUBrO14DDAJzMg" },
      { id: "sfx-ms53",    label: "Metal Slice 53",     driveId: "196Vtz_kdO5D6Q_2bTYo0ZyJN5BBI0dej" },
      { id: "sfx-ms54",    label: "Metal Slice 54",     driveId: "1r1_dxEE3OZO-N3pBML7qfNe-aLs5wVHB" },
      { id: "sfx-ms55",    label: "Metal Slice 55",     driveId: "1egYr9L1BmjuvZzHNTnuEHAhRaPGOJQkK" },
      { id: "sfx-ms56",    label: "Metal Slice 56",     driveId: "1LZhHItzPaxKTZ58yF8oxplnTURMYZek1" },
      { id: "sfx-ms57",    label: "Metal Slice 57",     driveId: "1h8EijWqlU8pt09SGE2Zsmym3v1GiO9lB" },
      { id: "sfx-ms58",    label: "Metal Slice 58",     driveId: "1XpIQEa5Z5C1356-Nmt75m-fTqNjvTW8k" },
      { id: "sfx-ms59",    label: "Metal Slice 59",     driveId: "1bdr8qq6ZoKGmcQYptuiGe-NKQDr1rdSL" },
      { id: "sfx-ms60",    label: "Metal Slice 60",     driveId: "1scFzSTgl5wTKbpk4lEoNSR0Xvc1Qy_3t" },
      { id: "sfx-ms61",    label: "Metal Slice 61",     driveId: "1xJU5wkJyeLUuq0b_6n6-G_3clTidlcAr" },
      { id: "sfx-ms62",    label: "Metal Slice 62",     driveId: "1JxU1U_GLtwKoIjzaRHLyf1OrEU9Bn-tN" },
      { id: "sfx-ms6",     label: "Metal Slice 6",      driveId: "1w99WHf80wEKlwwz0q52Jh_9yfHb0iPXA" },
      { id: "sfx-ms7",     label: "Metal Slice 7",      driveId: "1QELN6yQfuF-ZKmcQbhw3gxtHjmg7m70Q" },
      { id: "sfx-ms8",     label: "Metal Slice 8",      driveId: "1rhzfQ4yer7wRovXeak4yTbJu7V3WQ-Na" },
      { id: "sfx-ms9",     label: "Metal Slice 9",      driveId: "1qAxoHPvg_fpCdGV7qDEW6brIQowTLL8P" },
      { id: "sfx-ms38",    label: "Metal Slice 38",     driveId: "18do1SCc2evAVn203u0N9hPosHN9Cldq9" },
      { id: "sfx-ms39",    label: "Metal Slice 39",     driveId: "18qj1eSMkyd8jMMMkzB9OAGs4WdyaOkv9" },
      { id: "sfx-ms40",    label: "Metal Slice 40",     driveId: "111uD0C6tw6W0csRU8lJb124DYtkx-oh0" },
      { id: "sfx-ms44",    label: "Metal Slice 44",     driveId: "1EtQsq1M66NHf2Al7Ad5sKSPvMqQ97z7g" },
      { id: "sfx-ms46",    label: "Metal Slice 46",     driveId: "1EsvRd2H2X05lZLXwNs5K7m7ZbD4_eFEJ" },
    ],
  },
  {
    id: "sfx-whoosh-pack3",
    label: "Whoosh Pack 3",
    emoji: "💨",
    assets: [
      { id: "sfx-ws3a01",  label: "WS Ashish 1",        driveId: "12_Sx3B7UocY5UWmXsYKNvUAKtcSWi1cH" },
      { id: "sfx-ws3a02",  label: "WS Ashish 2",        driveId: "18D2AYzCkVQgkyjnc7RgaTzD4EKJ_IDzF" },
      { id: "sfx-ws3a03",  label: "WS Ashish 3",        driveId: "1gkSAsUxIici3EtseYVddH80GfOKPDDLi" },
      { id: "sfx-ws3a04",  label: "WS Ashish 4",        driveId: "1ARzvV75uGObSOS-fbqLOjtD0oj798719" },
      { id: "sfx-ws3a05",  label: "WS Ashish 5",        driveId: "18UvMWqx-d_sIb6L50A-mpUs3L9VQrbg4" },
      { id: "sfx-ws3a06",  label: "WS Ashish 6",        driveId: "1IpVsJj9fPiFCiUgrKQ9cBlLqdh6icUpQ" },
      { id: "sfx-ws3a07",  label: "WS Ashish 7",        driveId: "1L2QFMItwmZo29yvj507tQwmWI0hy2Kt3" },
      { id: "sfx-ws3a08",  label: "WS Ashish 8",        driveId: "1WAuk9goZXxrLhhDxR7QCwIByrFH_-lto" },
      { id: "sfx-ws3a09",  label: "WS Ashish 9",        driveId: "1dyyy4MPtJEjQ6UaitEVSwa7rv5zJjVIb" },
      { id: "sfx-ws3a10",  label: "WS Ashish 10",       driveId: "1_VEMsgK7k4pX5ouy-bERp8DKRmksAoyc" },
      { id: "sfx-ws3a11",  label: "WS Ashish 11",       driveId: "1ZptEsgKbvUpmfawvC--HQbXT8ip_Adwn" },
      { id: "sfx-ws3a12",  label: "WS Ashish 12",       driveId: "1SGa65GixVaL0LGqvA4mL_6vJNufk_DaY" },
      { id: "sfx-ws3a13",  label: "WS Ashish 13",       driveId: "1jYepPSycfq100bIT_zi1R24fvUA-qjuz" },
      { id: "sfx-ws3a14",  label: "WS Ashish 14",       driveId: "1lBt8i9oxS0ztNrlyZ8yz3gH-ZMbYcqkJ" },
      { id: "sfx-ws3a15",  label: "WS Ashish 15",       driveId: "1RYJiTDfz8oIkhAxIDGdDeR_CcWNRgKvd" },
      { id: "sfx-ws3a16",  label: "WS Ashish 16",       driveId: "1D7MSligsdBGYggB-aOhGEE4lUNeYx4Rd" },
      { id: "sfx-ws3a17",  label: "WS Ashish 17",       driveId: "1E4uIIawUHRo5xmVt29ZU0zuqVRmniNem" },
      { id: "sfx-ws3a18",  label: "WS Ashish 18",       driveId: "1n7QKzop_OZmqpBhPAgAaFl2uefDLusYz" },
      { id: "sfx-ws3a19",  label: "WS Ashish 19",       driveId: "18f1qxFoTJj6hsvReavfZtvFPnKzjGW_m" },
      { id: "sfx-ws3a20",  label: "WS Ashish 20",       driveId: "1quNCtJgr1q6lcZo8Xw3fWxx9Q3Z5EYZJ" },
      { id: "sfx-ws3a21",  label: "WS Ashish 21",       driveId: "1X0rPwB-0_M10icWF89fPijMMP98oxJO1" },
      { id: "sfx-ws3a22",  label: "WS Ashish 22",       driveId: "122duaJ9T5Vk-Q10VwxAGL57PSEfPgG3Z" },
      { id: "sfx-ws3a23",  label: "WS Ashish 23",       driveId: "1iOVSzni09iJ6UEyGPGJfC-9LcOtLVNjS" },
      { id: "sfx-ws3a24",  label: "WS Ashish 24",       driveId: "1AnaPUQRnXWpQeeu67MFIwGuSTxDb429Y" },
      { id: "sfx-ws3a25",  label: "WS Ashish 25",       driveId: "1IXL1IgyexS1PvOacUTr_mG1LKGWjoOIJ" },
      { id: "sfx-ws3a26",  label: "WS Ashish 26",       driveId: "18eT1fuVz-KBUHEt5WV7s_WxtDy_cR_Bu" },
      { id: "sfx-ws3a27",  label: "WS Ashish 27",       driveId: "1bu0Dtj4MZBz0bT2tJi2xoCSlsFVObadw" },
      { id: "sfx-ws3a28",  label: "WS Ashish 28",       driveId: "11jStPPGAG0YnLDGNhWMSQebPeXrJPfNt" },
      { id: "sfx-ws3a29",  label: "WS Ashish 29",       driveId: "1bzDQVpHxbhSEYrEfpeaGOKFpyZjvMuJR" },
      { id: "sfx-ws3a30",  label: "WS Ashish 30",       driveId: "14Jk4kPYHTYSwD4NLYApIKyWykd9e5Vi7" },
    ],
  },
  {
    id: "sfx-misc3",
    label: "Misc Pack 3",
    emoji: "🎲",
    assets: [
      { id: "sfx-misc1a",  label: "Miscellaneous 1",    driveId: "15vuyyBBt8HNDfofzHC2Xv0pUoz9F78vN" },
      { id: "sfx-misc2a",  label: "Miscellaneous 2",    driveId: "16dNmlY026Sh77LqsXy6p0BitfMSboqb2" },
      { id: "sfx-misc3a",  label: "Miscellaneous 3",    driveId: "1YdgD9XeXlXTFKzZuMw1t6ayhM7OE3Qwd" },
      { id: "sfx-misc4a",  label: "Miscellaneous 4",    driveId: "1JsPo4lFkWAF-n_5-TEgFD00Yp1Hwbv_W" },
      { id: "sfx-misc5a",  label: "Miscellaneous 5",    driveId: "1_DMU6m9Tvmh1OEApf_N3SIXTgwD5U8wQ" },
    ],
  },
  {
    id: "sfx-pack4",
    label: "Pack Viral",
    emoji: "🔥",
    assets: [
      { id: "sfx-goldws",   label: "Golden Swoosh",          driveId: "1NphlAIKda_6tvf_jybrEmb8u-9aNhY9g" },
      { id: "sfx-illum",    label: "Illuminati",             driveId: "1OQDObFVfLL0KxkP7KlqRtHZAofUKJ-YE" },
      { id: "sfx-plane",    label: "Plane Effect",           driveId: "1OqkeLpSuj1nsXbU1G7ARi2E4dMSN2iTj" },
      { id: "sfx-prank",    label: "It's Just a Prank",      driveId: "1Ovm1jyXhYuT6ZaodBxysE4dQL9YxN0Ze" },
      { id: "sfx-ooohhh",   label: "Ooohhh!!!",              driveId: "1QwIcpziPLsTjeFtZB2tpJquJNJ-2XNaz" },
      { id: "sfx-milk",     label: "He Needs Some Milk",     driveId: "1ZRnYCjuSce3LBujQYlywRNXzL33wjEtN" },
      { id: "sfx-glass",    label: "Glass Breaking",         driveId: "1ZZuX2mUBSZXpD9fe-BbdDZiqE1DTQIAw" },
      { id: "sfx-hfsw",     label: "High Fast Swoosh",       driveId: "1aGxZQfc9O5KZ0hCdRpQ1dk8Y7tmt9mOd" },
      { id: "sfx-mue4",     label: "Most Used FX 4",         driveId: "1bU1wQ4uB7P02X2QFJMYd3vfbM4jZ5xt-" },
      { id: "sfx-hallel",   label: "Hallelujah",             driveId: "1byYmkaoTEFynNmjg1zSv0V4FSPVsU9RG" },
      { id: "sfx-filtsw",   label: "Filter Sweep",           driveId: "1cxe5GIGqhPa_mFO5fJqv55DIX3iydlAX" },
      { id: "sfx-flashbk",  label: "Flashback",              driveId: "1e1Z_3rczN95qMRJtSr-cjkHdPDboY-aO" },
      { id: "sfx-flufdck",  label: "Fluffing a Duck",        driveId: "1ewsF3u8hEJRi79hB7ZqWGm_mBbvd4Pai" },
      { id: "sfx-manscr",   label: "Man Screaming",          driveId: "1fpZtGLXu4ZEIRuskGMvKsPnekDqn_DU-" },
      { id: "sfx-msclk2",   label: "Mouse Click 2",          driveId: "1gMSsdJvazi0q2rjCw8VJuq2tlrU65f8p" },
      { id: "sfx-iridoc",   label: "Iridocyclitis",          driveId: "1giRrx5LV1r62zS6qTRAxyKjooHleZEi2" },
      { id: "sfx-gafsw",    label: "Gas Fire Swoosh",        driveId: "1gpqh7JtUgadnNPPp0ZiK1uPSfowug_1e" },
      { id: "sfx-horn2",    label: "Horn 2",                 driveId: "1h4oPwUV5pxZIi9FekBpdtgO7zN-5hxGR" },
      { id: "sfx-mue2",     label: "Most Used FX 2",         driveId: "1h8KIulVN60IjXzmWsdUNPOlD5CH5WNq2" },
      { id: "sfx-mue3",     label: "Most Used FX 3",         driveId: "1hGT4UwKU-EvNGfX_O4a7YSc1bcFcb2KU" },
      { id: "sfx-horn1",    label: "Horn 1",                 driveId: "1mCjuAQSSm-Br3BZsMl4aTK6f9_Fv_iNV" },
      { id: "sfx-lowfly",   label: "Low Fly",                driveId: "1nmfgsMU51GQ3Xeo_eTBhfCOnk45J9878" },
      { id: "sfx-latd",     label: "Look At This Dude",      driveId: "1q6DyIR7IzkjVQrF44SaNE7QOavxwlX0B" },
      { id: "sfx-mue1",     label: "Most Used FX 1",         driveId: "1qj-IRvKBgRXXUb8JTFJ0ejqH9ud7Kd2O" },
      { id: "sfx-pansusp",  label: "Panic Suspense",         driveId: "1rpKELy8ZoutJfYnNYQC5wImCAPhNVBNT" },
      { id: "sfx-dundun",   label: "Dun Dun Dun",            driveId: "1ui1aEK0VJIVwjjoCKn8wN2fcdo56ipo2" },
      { id: "sfx-ohhello",  label: "Oh Hello There",         driveId: "1vrVQ3JpMchc9HLAcnIs2QwkzLqEhR73I" },
      { id: "sfx-mkyspin",  label: "Monkey Spinning",        driveId: "1xop2CA4kmieLTDAN_GDE3WS3hfSaF0lw" },
      { id: "sfx-ctnrun",   label: "Cartoon Running",        driveId: "169PP_Qx__FOBUYo1quA90mA2pa8zfxYY" },
      { id: "sfx-drbell",   label: "Door Bell",              driveId: "1Ax4SBgw8eGGS2L6lwM4uZFfqmAFzYqd3" },
      { id: "sfx-drop1",    label: "Drop 1",                 driveId: "1E59rmaCO5qwQcyhPw0yk4gdwlc7HD45J" },
      { id: "sfx-deepbdm",  label: "Deep Cinematic Bass",    driveId: "1bX2nAfB7ghwP3J8Q-EKVBfAfFWcqBsGX" },
      { id: "sfx-denied",   label: "Denied",                 driveId: "1iHKHAJiH4GKs_nEwP-G0rk8GDLQA3id_" },
      { id: "sfx-camshp",   label: "Camera Shutter",         driveId: "14QmD6YQT29--3cu4738MXMPeTzGDT4ew" },
      { id: "sfx-botcork",  label: "Bottle Cork",            driveId: "17_W2wc1NA8SRM7YTpslttqtXyx1b8oMP" },
      { id: "sfx-clap",     label: "Clapping",               driveId: "18RkTLUielpkVkuQuc7uv3rlkgkGvhe2H" },
      { id: "sfx-byehat",   label: "Bye Have a Great Time",  driveId: "1E8yJFn-twjXseSx9c2llMy6WXqYtlbgF" },
      { id: "sfx-ding3",    label: "Ding 3",                 driveId: "1F0T2pwPNVWFnpwKSCzlGcn6yy7MV_LC5" },
      { id: "sfx-drkck",    label: "Door Knocking",          driveId: "1KNwxrcUF9XeTiyMJu1uYolC97RZKtvUD" },
      { id: "sfx-carhrn",   label: "Car Horn",               driveId: "1MpQojkJPHUKbalxug6cwgzT3psK17onx" },
      { id: "sfx-crying",   label: "Crying Effect",          driveId: "1NYj-vhkqOpiJflZ7ATw5Y53FGUUD1mFy" },
      { id: "sfx-cellph",   label: "Cell Phone Ringing",     driveId: "1PMxpWb6Sb9iZPnnpvzGW-e-V_-ahnw3N" },
      { id: "sfx-clock",    label: "Clock Ticking",          driveId: "1PcVps7Y2blhfWbZLxrV5NIadDh1nYpLw" },
      { id: "sfx-chdcrd",   label: "Children Crowd",         driveId: "1Phc6TUOGgWQG29GH_zGSpOXPpxVi90NT" },
      { id: "sfx-daamn",    label: "Daaamn!",                driveId: "1Px0CMja1R-e3rSy01kdqKNgW0iypKH0w" },
      { id: "sfx-correct",  label: "Correct Answer",         driveId: "1SJM6O42SPgPXu7UjVpI1nvFmL_qPnum7" },
      { id: "sfx-dipchip",  label: "Dip Dip Potato Chip",    driveId: "1SYTPKzsjYJHls0YwioICDgQk03NHZCQR" },
      { id: "sfx-derp2",    label: "DERP",                   driveId: "1TzrMg9rbfGzwygjxJiudNACc-BUUHgwz" },
      { id: "sfx-ctnacc",   label: "Cartoon Accent",         driveId: "1VWdb3GzVVJ1j9knh4xeNmVEdBzK6W3-h" },
      { id: "sfx-drmrl",    label: "Drumroll",               driveId: "1_A8Pf1OeTS5e-kY3iJPya38jVEOKpf0H" },
      { id: "sfx-brody",    label: "BrodyQuest",             driveId: "1ahLVsEZSpG93a8TaKEbNgOo-miCti7jK" },
      { id: "sfx-ballb",    label: "Ball Bouncing",          driveId: "1asbrDInMdQGNW921vQw5ds6Kj0-RI4Nr" },
      { id: "sfx-bassbst",  label: "Bass Boosted",           driveId: "1diZR7_mtKfJmeYflvFe2m6r-uVUT27Eo" },
      { id: "sfx-clap2",    label: "Clapping Effect",        driveId: "1qwGnjncFZTYv8xKMlI4BB3U9oipegZ88" },
      { id: "sfx-boo",      label: "Booing Crowd",           driveId: "1smgCAapJhZ2iAAgSiDaZ272ooMGynfiH" },
      { id: "sfx-cinwh",    label: "Cinematic Whoosh",       driveId: "1szl73AcA3OBECHBHIWiibZLlw0tpwfoh" },
      { id: "sfx-badumts",  label: "Ba Dum Tsss",            driveId: "1t9KPFr1uH9wUD7LqUP6eArTdAY_I7Vdk" },
      { id: "sfx-drop2",    label: "Drop 2",                 driveId: "1uECi8hkK1TGQGGMAY0L9c-cdFAudzDcK" },
      { id: "sfx-aww",      label: "Aww",                    driveId: "14xwwcZ5AIEEOq8-Nw2xjXaHYfgJi3OJY" },
      { id: "sfx-aye",      label: "AYE Sound FX",           driveId: "19AUdcbKSEZ9NsZ45yLHG82Vs7KIvFVAE" },
      { id: "sfx-animewow", label: "Anime WOW",              driveId: "1FXPA8hGGbnGPEy7mamkWjzCDY75bJef_" },
      { id: "sfx-alrmclk",  label: "Alarm Clock",            driveId: "1PN5rCIhe8OnubjD4_NcYPF59uTc1eEG0" },
      { id: "sfx-kidslgh",  label: "Kids Laughing",          driveId: "1eJBAir9SweMFKoULWDD4BFO5dRL-YURz" },
      { id: "sfx-cricket",  label: "Awkward Cricket",        driveId: "1l682v6-d6yr_ry77bO-eZUcF49ImMV51" },
      { id: "sfx-8bithappy",label: "8-Bit Happy Nation",     driveId: "1zBpnOmgPWonsZkredoFYChSPGqqOc8Zg" },
      { id: "sfx-money2",   label: "Money 2",                driveId: "1TCOiCAUCnBE0gP21N8mGN_vE7y2r8CAi" },
      { id: "sfx-money3",   label: "Money 3",                driveId: "1HcAOHGbYm-XOORhkgjHqt0NaB67dn86T" },
    ],
  },
  {
    id: "sfx-suspense",
    label: "Suspense & Drama",
    emoji: "😱",
    assets: [
      { id: "sfx-fail1",    label: "Fail 1",                 driveId: "11CuIMCQvEGGT3J1jFjEY880Wqe8TYcXH" },
      { id: "sfx-fail2",    label: "Fail 2",                 driveId: "1NJ6ZxdMC2xFXwOmsry4sRNkwB0bw1qbZ" },
      { id: "sfx-falling",  label: "Falling",                driveId: "12zCBDrs2F36yw9XvH9lfiTlFIB7698qy" },
      { id: "sfx-lsusp1",   label: "Long Suspense 1",        driveId: "18KN78IOSateEB3I4r33wHLh06kkgpCz2" },
      { id: "sfx-lsusp2",   label: "Long Suspense 2",        driveId: "1t_F0fhBrs8IBjaoRU2NG26e6NDTGN7bN" },
      { id: "sfx-lsusp3",   label: "Long Suspense 3",        driveId: "1lbPKRJsvw8QQk4HsnvgG5PFYy77q9i49" },
      { id: "sfx-lsusp4",   label: "Long Suspense 4",        driveId: "1GGpw_reYr-S6lrUuVHh5LQ5HSz9tFUWQ" },
      { id: "sfx-susp1a",   label: "Suspense 1",             driveId: "1WfDAEKxJlUA0UWtZ5TgOo40439WvKifj" },
      { id: "sfx-susp2a",   label: "Suspense 2",             driveId: "1RyeGvFmNg4LkAtIA_Aqxin0ebxMSqtRW" },
      { id: "sfx-susp3a",   label: "Suspense 3",             driveId: "1HwIRCSDKLWiGCc99X9GBuRNFuXgHnknk" },
      { id: "sfx-dundun2",  label: "Dun Dun Dun 2",          driveId: "1JokSyKTTsbTTIsTLk4iFUwcWdfzF-OEf" },
      { id: "sfx-glsbrk2",  label: "Glass Breaking 2",       driveId: "1dRRHCCVYWZZcPeHrSF-oQmpRLA-DOPuk" },
      { id: "sfx-slap",     label: "Slap",                   driveId: "1ZWnHzFZ-i-tbfB5pN8rU3KHQ6975oMyo" },
      { id: "sfx-fart1",    label: "Fart 1",                 driveId: "1aaRfFfPBZT0T3_-K9bU3sLCfWwWfGi8B" },
      { id: "sfx-fart2",    label: "Fart 2",                 driveId: "1AkhtIhhJ4qNL36k3q2qSHrUs7Dp6PtYw" },
      { id: "sfx-splat2",   label: "Splat 2",                driveId: "1vNDC3OEQM5_JjEbzrF9aUhGS_5Ev8L1X" },
      { id: "sfx-wranswra", label: "Wrong Answer",           driveId: "1xctFF_dxEqYuezhE3Z3E1ylMydIg4OyM" },
      { id: "sfx-censor2",  label: "Censor",                 driveId: "1L0l4Kx3K3-A9Fdnx3nOdOsLNRVLBXmrd" },
      { id: "sfx-drmrla",   label: "Drum Roll 2",            driveId: "1LsxihIjuQQhmiN-q7mWBvOVeJzIEMfUe" },
      { id: "sfx-kidscheer2",label: "Kids Cheering 2",       driveId: "1K9BU3QsbmYlOjDGCxVWWxP3qc-vpIYvy" },
      { id: "sfx-crdboo2",  label: "Crowd Booing 2",         driveId: "1uUu5O4o44cXykzeMPwT_OwGiLO_cphme" },
      { id: "sfx-takphoto", label: "Taking Photos",          driveId: "1f5rXUBLp-EgCmo0erGOI1dPIk00Yeiez" },
      { id: "sfx-yeet",     label: "Yeet",                   driveId: "1Zub8Q8_NdvIdF4QQUQXW8ylubUJ8zs5U" },
    ],
  },
  {
    id: "sfx-vento-riser",
    label: "Vento & Risers",
    emoji: "🌬️",
    assets: [
      { id: "sfx-wind1sfx", label: "Wind 1",                 driveId: "1jDMV-3V2BExMeISlcq3S-VYJi-X_6CSM" },
      { id: "sfx-wind2sfx", label: "Wind 2",                 driveId: "1QqnOQJHbVPS2Q44rXvlBwZOc9AmWF06z" },
      { id: "sfx-riser1",   label: "Riser 1",                driveId: "1ZyabZRRrNW0rLPbAesPs1MLh6LiBiYVs" },
      { id: "sfx-riser2",   label: "Riser 2",                driveId: "1r_Yn0z9gGfg_VL0vtiDNq1Jceleo3wPM" },
      { id: "sfx-riser3",   label: "Riser 3",                driveId: "1eX1k2kUEEGlSmzn3dVDRYgcbvg6t6Owm" },
    ],
  },
  {
    id: "sfx-liquido",
    label: "Líquido",
    emoji: "💧",
    assets: [
      { id: "sfx-liq1",     label: "Liquid 1",               driveId: "1FNsvQr0b4N4L32IXixc9FuWVJGiyE5cA" },
      { id: "sfx-liq2",     label: "Liquid 2",               driveId: "1LQwNOt2ImzF4DYR3betNU9iS-F_2a1c8" },
      { id: "sfx-liq3",     label: "Liquid 3",               driveId: "1Jth184L9GroTN6NABXnQY9CkwWBGknmd" },
      { id: "sfx-liq4",     label: "Liquid 4",               driveId: "1_RXdZpCLaw1IZnnK3gbbVgM1YdrQ5IIe" },
      { id: "sfx-liq5",     label: "Liquid 5",               driveId: "1SCMSx5h-X3k-c1DMhF-67ttsMxZep3YW" },
    ],
  },
  {
    id: "sfx-metal-slice2",
    label: "Metal Slice Pack 2",
    emoji: "🗡️",
    assets: [
      { id: "sfx-ms1",   label: "Metal Slice 1",   driveId: "1pFT99HALZROItoM9ZWvpkjib55XXCaZB" },
      { id: "sfx-ms2",   label: "Metal Slice 2",   driveId: "1M1RHXLAbHryKXtBPrVIbVKvMIPSZ1EFk" },
      { id: "sfx-ms3",   label: "Metal Slice 3",   driveId: "1yRNV1nGvr4IZjKJh07o7oQ_neslmaT7D" },
      { id: "sfx-ms4",   label: "Metal Slice 4",   driveId: "1r4j1BwUzW1zPXdddIHAQ8q5Mtog0YWTY" },
      { id: "sfx-ms5",   label: "Metal Slice 5",   driveId: "1GdfAsB9MrK4LJqMevTIED0WyXU_I_mFQ" },
      { id: "sfx-ms10",  label: "Metal Slice 10",  driveId: "1HfKH1e6CGNCH7sbhHz84HGEAqQO3nCrM" },
      { id: "sfx-ms11",  label: "Metal Slice 11",  driveId: "1gLQphU9-rou_74010T9pRwpk4UnUpjj2" },
      { id: "sfx-ms12",  label: "Metal Slice 12",  driveId: "1CmR6i2lJPLADo5LKZCI9Gjid8hdRSLfs" },
      { id: "sfx-ms13",  label: "Metal Slice 13",  driveId: "1AxEH-gGKBcZGEPZBIvz1kCaMn8Ca1Itj" },
      { id: "sfx-ms14",  label: "Metal Slice 14",  driveId: "13SCDy5cVHqJVLCFBVcjYJYkGAcLO667g" },
      { id: "sfx-ms15",  label: "Metal Slice 15",  driveId: "1lvOZQjeVBVKiMC_T70WJ-aRghwwyLDEL" },
      { id: "sfx-ms16",  label: "Metal Slice 16",  driveId: "12b8Gs2vsfI3wPKLyHrAmaNvM8-1Jp7Ou" },
      { id: "sfx-ms17",  label: "Metal Slice 17",  driveId: "1B2viDtiFnle3JNl0qM0UK3J2pRtcVtf2" },
      { id: "sfx-ms18",  label: "Metal Slice 18",  driveId: "1KOnXKjCSCYnsj1DC-lx2pstDX3BYu845" },
      { id: "sfx-ms19",  label: "Metal Slice 19",  driveId: "11ZoJJ9Ts5nmv4cQHRxs16OfUYau6s7cd" },
      { id: "sfx-ms20",  label: "Metal Slice 20",  driveId: "1WsnCvi5w4SyRG4A8EzRZcVLfnREqxeXf" },
      { id: "sfx-ms21",  label: "Metal Slice 21",  driveId: "1McxCiWN7198rgW7PihKyK_kW0aZCee1s" },
      { id: "sfx-ms22",  label: "Metal Slice 22",  driveId: "1G1MSMtpuehPW--RNvx-hyT4vdQUWL9um" },
      { id: "sfx-ms23",  label: "Metal Slice 23",  driveId: "1u8QaqJsrpzk-Lxx_d_XNzYfFwmfFbwZD" },
      { id: "sfx-ms24",  label: "Metal Slice 24",  driveId: "1aSK-JXck0OOjhaH4rjiZWKz9NVKW24R0" },
      { id: "sfx-ms25",  label: "Metal Slice 25",  driveId: "1p_9S_9jN8HY8EHmJ3hLda2kqQtTsnXJo" },
      { id: "sfx-ms26",  label: "Metal Slice 26",  driveId: "1yszYatgMZH4cZViit_fmQNk6-5OHIF2d" },
      { id: "sfx-ms27",  label: "Metal Slice 27",  driveId: "1-NZMFmQRLld1Lt0X0gHONMJretwiVCIo" },
      { id: "sfx-ms28",  label: "Metal Slice 28",  driveId: "1tq5lsihrshCrfKAuSPz9txYH8QfqkA2H" },
      { id: "sfx-ms29",  label: "Metal Slice 29",  driveId: "1_8T7_SiLtDFnLNoWtYfEq6NXAI0-KSmp" },
      { id: "sfx-ms30",  label: "Metal Slice 30",  driveId: "1fjfSugGhgxAxt1lFAJql0osL237FQcAy" },
      { id: "sfx-ms31",  label: "Metal Slice 31",  driveId: "1482C6UFZFuhIFjrf326MQedawPP32_AD" },
      { id: "sfx-ms32",  label: "Metal Slice 32",  driveId: "1fIko9qkLI0NMEaPXqGmTvwjkYXLyGWki" },
      { id: "sfx-ms33",  label: "Metal Slice 33",  driveId: "1sb8_M9UpHycTPNICcWmpTv_a6yjwaw0_" },
      { id: "sfx-ms34",  label: "Metal Slice 34",  driveId: "1kEI_atqWQsOl4_FVmwNRIoJwLmTfiDvX" },
      { id: "sfx-ms35",  label: "Metal Slice 35",  driveId: "1Q79krnqFPEb97v6RAw2HZn4A6uDPmqvi" },
      { id: "sfx-ms36",  label: "Metal Slice 36",  driveId: "1mDq6RTjFZ_V7_hqZJ9C6vk_MpYfS2B8s" },
      { id: "sfx-ms37",  label: "Metal Slice 37",  driveId: "1g1xRSDX-zJsU4eQv7Pd8uEOgDQV76nLC" },
      { id: "sfx-ms41",  label: "Metal Slice 41",  driveId: "1znkrF5F6HMoSU9t2-y6y950jYRC9ollQ" },
      { id: "sfx-ms42",  label: "Metal Slice 42",  driveId: "1RsTwIz2nkfnZVNxHd7MpFveDxVEhMxs9" },
      { id: "sfx-ms43",  label: "Metal Slice 43",  driveId: "1mlz78WR7O47ZJlYgbQ306-_hw2RtqhiA" },
      { id: "sfx-ms45",  label: "Metal Slice 45",  driveId: "1JygC4jxLtIL47epKYlQ4F4Yo4Q4Tb5-5" },
      { id: "sfx-ms47",  label: "Metal Slice 47",  driveId: "1TfC-XLG0-26qB4v9kdfWqRMSZYzgtXQO" },
      { id: "sfx-ms48",  label: "Metal Slice 48",  driveId: "1vklduZ2gN4Q5GYnUavMJnh-SZkMztp2Z" },
      { id: "sfx-ms49",  label: "Metal Slice 49",  driveId: "1P_cXCX0IrF5VG4BZgiByOv4b0TNB-c7_" },
    ],
  },
  {
    id: "sfx-fight-pack",
    label: "Fight Pack Whoosh",
    emoji: "🥊",
    assets: [
      { id: "sfx-fp-sm03", label: "SlowMo 03",  driveId: "10QYPe8h8ozvA80TWyTVzhnpcLlUJxw4E" },
      { id: "sfx-fp-sm04", label: "SlowMo 04",  driveId: "102sd1oLMucBBD2bhccJmPlAZ1uJtoXsR" },
      { id: "sfx-fp-sm05", label: "SlowMo 05",  driveId: "1tY3sUiAA7Q5aheadsx1ZfhWc54-ybnst" },
      { id: "sfx-fp-sm06", label: "SlowMo 06",  driveId: "1Pb7j4lQsFjO7I_x1FaMOxCQT1W1y9OPq" },
    ],
  },
  {
    id: "sfx-glitch",
    label: "Glitch Pack",
    emoji: "⚡",
    assets: [
      { id: "sfx-gl01a",  label: "Glitch 01a",  driveId: "1upeNTNFHLuvXFRkYS46AELeqd9-4O--4" },
      { id: "sfx-gl02a",  label: "Glitch 02a",  driveId: "1GRuGKtXCQwfr56kS8KMQFJhOSVK6vwVN" },
      { id: "sfx-gl03a",  label: "Glitch 03a",  driveId: "1KvGaLlLsCRDq8NLQ-YDi1MdWl5YHo_yx" },
      { id: "sfx-gl04a",  label: "Glitch 04a",  driveId: "1O7ytnOYEajs-wKKFAk80dmACWQpiCaRE" },
      { id: "sfx-gl05a",  label: "Glitch 05a",  driveId: "1jesghyvS7CyiWS1vXjEqOuDF0LlUbYYu" },
      { id: "sfx-gl06a",  label: "Glitch 06a",  driveId: "1aTP6VcWqtjRSZ2yFArTyL9gXMjPAV839" },
      { id: "sfx-gl07a",  label: "Glitch 07a",  driveId: "1211LLG1uY4TdD726ienVD2R7cFNCc_8C" },
      { id: "sfx-gl08a",  label: "Glitch 08a",  driveId: "1-7QmZ4BzOaU_RP5JGiL1JcCE2JnYZkPB" },
      { id: "sfx-gl09a",  label: "Glitch 09a",  driveId: "1wvh-RIKaYBucTjB-AmkzTyslRUWumDEt" },
      { id: "sfx-gl10a",  label: "Glitch 10a",  driveId: "1I7FIHnjGScyWWBttngPIH26chP61Sn9Q" },
      { id: "sfx-gl01b",  label: "Glitch 01b",  driveId: "10wgOHJmAmU8QpEZJ4DS4WMf6ip2bECRe" },
      { id: "sfx-gl02b",  label: "Glitch 02b",  driveId: "1isRv6BtKU9O1yMMBE1H-TPkMxgxLdlbG" },
      { id: "sfx-gl03b",  label: "Glitch 03b",  driveId: "1mfKTibiGMSg8iSHL6S9-smiIImO6tDYt" },
      { id: "sfx-gl04b",  label: "Glitch 04b",  driveId: "1T0P-Iqkhc0oDk8JA6sboaIx5_BfsLQNu" },
      { id: "sfx-gl05b",  label: "Glitch 05b",  driveId: "1-5K-cCm_OO6w8t_tOQNc_DLSdq_l6Qi8" },
      { id: "sfx-gl06b",  label: "Glitch 06b",  driveId: "1kHdIHTLuqTu5JDLfO3m_wEao0sCgQykU" },
      { id: "sfx-gl07b",  label: "Glitch 07b",  driveId: "1XF6J4_IeWftM90klXzLiDFi4Ugac2OXE" },
      { id: "sfx-glmp1",  label: "Glitch mp3 1",driveId: "1JfyozyymzkQlxtwWaLDnrsoTOJKhm8Mb" },
      { id: "sfx-glmp2",  label: "Glitch mp3 2",driveId: "1UYsmKJcjDOHZWb9wHoByO0D9CN9K3x9w" },
      { id: "sfx-glmp3",  label: "Glitch mp3 3",driveId: "1JnrcNKRriJiuY47rFB9o0f0Eg52nQsqL" },
      { id: "sfx-gl2w",   label: "Glitch 2w",   driveId: "1Emq3IJHXOm3OJHJvNltFuE7JXqgIQPoe" },
      { id: "sfx-gl4w",   label: "Glitch 4w",   driveId: "1gGFPOP-rSBcj2vlMemeWIT-b40zdlnvS" },
      { id: "sfx-gl5w",   label: "Glitch 5w",   driveId: "1BF0uLOl_-dZs09FUzuNW3N28o7x1l02C" },
      { id: "sfx-gl6w",   label: "Glitch 6w",   driveId: "1nWjsHptOW5VZFICbIyLoyX22klCwxS9f" },
      { id: "sfx-gl7w",   label: "Glitch 7w",   driveId: "1AC7zZ6nEmoUgKb1du7gTy6CoRNUqkcGw" },
      { id: "sfx-gl8w",   label: "Glitch 8w",   driveId: "1GnHDNQVZ_VNehhW0jEhPWvfk5-T7b06H" },
      { id: "sfx-gl9w",   label: "Glitch 9w",   driveId: "19Bu0W8V6qvAUf3h5J7QrI7DsdzfazBQg" },
      { id: "sfx-gl16w",  label: "Glitch 16w",  driveId: "13sxh5VnDwd9pzeWRYbnKMSErkNXe7rR1" },
      { id: "sfx-gl17w",  label: "Glitch 17w",  driveId: "1HDS1WiJIszetF20-MC3qDq4grkEuJ9_H" },
      { id: "sfx-gl19w",  label: "Glitch 19w",  driveId: "1M3t5LwGMPclkpXRTrzkWVuybCCgWPJ7k" },
      { id: "sfx-gl26w",  label: "Glitch 26w",  driveId: "1MlTaNSBdOgePQe33xWCEkG2QYp3_Jfnh" },
      { id: "sfx-gl27w",  label: "Glitch 27w",  driveId: "1HnFz8kSq1XS5ysSXLQcUT1n0UXhgBM5U" },
      { id: "sfx-gl28w",  label: "Glitch 28w",  driveId: "1BXcKgU2v2Eo540Y8M_QDx-5hZkFErmDW" },
      { id: "sfx-gl30w",  label: "Glitch 30w",  driveId: "1JzNTL6rKgPRmBbhWqeKzG7Aq01rS3j6R" },
      { id: "sfx-gl31w",  label: "Glitch 31w",  driveId: "1n76SRRWQ67poG2Ufd8POhQ2aEqLkVC6R" },
      { id: "sfx-gl32w",  label: "Glitch 32w",  driveId: "1oU3_srcbszk5sUGyYEDd1qBdUbYo0_4L" },
      { id: "sfx-gl33w",  label: "Glitch 33w",  driveId: "1okRMX2Bdlf7_SdvVUmhwGP5bxwBjye5v" },
      { id: "sfx-gl34w",  label: "Glitch 34w",  driveId: "1SM-4eVLI9-vQyyDCp907JStVV5XbyObM" },
      { id: "sfx-gl35w",  label: "Glitch 35w",  driveId: "1zaHPk02rDWHV2z4Ttj07zG785Ke0BBNS" },
      { id: "sfx-gl36w",  label: "Glitch 36w",  driveId: "1nFi4xVVe8TTJMKsGpvleJmwWDQUUyIn4" },
      { id: "sfx-gl37w",  label: "Glitch 37w",  driveId: "1qcAbtObNghAaIxT5dI11tG6ti4pzOnMs" },
      { id: "sfx-gl38w",  label: "Glitch 38w",  driveId: "1QcGEpudRodtQD7LuM4kXsnZbDqL9uPmv" },
      { id: "sfx-gl39w",  label: "Glitch 39w",  driveId: "1XMpsgmkImPvpHPif-bRBtUTWTL8ny9qz" },
      { id: "sfx-gl40w",  label: "Glitch 40w",  driveId: "1pdye8oSzPj3EFHk4g9damM6dJPk74XDz" },
      { id: "sfx-gl41w",  label: "Glitch 41w",  driveId: "167GBYNeHbnLljXp5MIj_lLumyExNjAek" },
      { id: "sfx-gl42w",  label: "Glitch 42w",  driveId: "1IQ2c7PzmsOSDcwffIEcsisvmWrNT7UiN" },
      { id: "sfx-gl43w",  label: "Glitch 43w",  driveId: "12Pkc2Aau3kVA5iUOVcZafcObkQo0D1QQ" },
      { id: "sfx-gl44w",  label: "Glitch 44w",  driveId: "1eCred2lFcihAbzDKHVqFkSGGTjUFoI74" },
      { id: "sfx-gl45w",  label: "Glitch 45w",  driveId: "11Z3-VGr7mMRV3pVDk00gi3iSPYGujEYI" },
      { id: "sfx-gl46w",  label: "Glitch 46w",  driveId: "1CAgxPQvn0LiOK-sfQBAFmELMMIWFaRoj" },
      { id: "sfx-gl47w",  label: "Glitch 47w",  driveId: "1QnGclS50r-rHobQSfdR4hK4WpI4RcIQK" },
      { id: "sfx-gl48w",  label: "Glitch 48w",  driveId: "1zAOhWG4Z11OMWbvbf8hZ40ZTyvCF5nTt" },
      { id: "sfx-gl49w",  label: "Glitch 49w",  driveId: "1c8mUHcwoxtDJOj8tLQM8Qw7nDxl6LdlE" },
      { id: "sfx-gl50w",  label: "Glitch 50w",  driveId: "1dggfLy-ZvfYBa-6EWzgq-UFllRdENxlx" },
      { id: "sfx-gl51w",  label: "Glitch 51w",  driveId: "1cx2thea8ClcqGb58IJCjesZk-Rqo7L9G" },
      { id: "sfx-gl52w",  label: "Glitch 52w",  driveId: "19LAFC17-sSQMcSkpdDSyiXB3m89pwBO1" },
      { id: "sfx-gl1wv",  label: "Glitch 1",    driveId: "1x5W9RmV6cR_ojnF0j2ejn5RgjmxoUESp" },
      { id: "sfx-gl3wv",  label: "Glitch 3",    driveId: "1_04UfOaoxIstXX_5Qy15NxkCXIx90pKV" },
      { id: "sfx-gl10wv", label: "Glitch 10",   driveId: "1_miFi3fxNwEjpTPx3wrLYsT47x_5yy7o" },
      { id: "sfx-gl11wv", label: "Glitch 11",   driveId: "1d9o2MSY8OMon9-iM7w3ZyxauUqwI0AKN" },
      { id: "sfx-gl12wv", label: "Glitch 12",   driveId: "1uX4of6WJ8ldvxYi9oBkUuF6cAGJplRn_" },
      { id: "sfx-gl13wv", label: "Glitch 13",   driveId: "1QvW8VHuqwBB-rhQvgMSM68eCyk57MZcY" },
      { id: "sfx-gl14wv", label: "Glitch 14",   driveId: "1ZgeZVVhd48KcKX4sHpZp7OMFhFDJO3c0" },
      { id: "sfx-gl15wv", label: "Glitch 15",   driveId: "1hbnik11L1SdVcG6ec8txm--3NZID7gKI" },
      { id: "sfx-gl18wv", label: "Glitch 18",   driveId: "1RwSd34n7XlSkBIG-7VyuTSbWMoQgTxXB" },
      { id: "sfx-gl20wv", label: "Glitch 20",   driveId: "1ZZvE5-9R6sq5vWl9027qlmBJrK7c0NUi" },
      { id: "sfx-gl21wv", label: "Glitch 21",   driveId: "1NeWpxG26ywiGWD50jpaH8U2pVQh8sFJX" },
      { id: "sfx-gl22wv", label: "Glitch 22",   driveId: "1Spa8eHX7R2Wwotx7MY-11DASxNRQd09x" },
      { id: "sfx-gl23wv", label: "Glitch 23",   driveId: "1P1l1npnkrt-YCEEZ_klMlL47wUybc68D" },
      { id: "sfx-gl24wv", label: "Glitch 24",   driveId: "1gDE0VzBF52sRbiK7-pBsmNteGreiKdlv" },
      { id: "sfx-gl25wv", label: "Glitch 25",   driveId: "1n75asjeUpuJefg2B-Gh4Njw3yzYxMIS2" },
      { id: "sfx-gl29wv", label: "Glitch 29",   driveId: "1vF4W8X1Lw_-BfwV3f5P4pUDQ2zVy_uq7" },
      { id: "sfx-glwav",  label: "Glitch wav",  driveId: "1Fy3cTduu_75pt_-_fJq3ecJImU37WFMr" },
    ],
  },
  {
    id: "sfx-fire",
    label: "Fogo & Explosões",
    emoji: "🔥",
    assets: [
      { id: "sfx-fire1",   label: "Fire 1",       driveId: "13JhoIy_mqSCjKIL9oBAiGlgP12L7MpxX" },
      { id: "sfx-fire2",   label: "Fire 2",       driveId: "1qSBL9cAFPw4rGnyayXlUjgzs5ZaG8-HH" },
      { id: "sfx-fire3",   label: "Fire 3",       driveId: "1agQOu14tqOBRx-2nyAN2N_nh6MeNA0Ay" },
      { id: "sfx-fire4",   label: "Fire 4",       driveId: "1NYg8QMYG0xFdwldlrTgVMyUn1CC_oBGk" },
      { id: "sfx-fire5",   label: "Fire 5",       driveId: "1-0vP8wYRHBgkmWHDY3TZnkwx7Q8MFFTq" },
      { id: "sfx-firemp",  label: "FIRE",         driveId: "1W6UmSh6Cpzdd01uv3oFkh7JsSR0ObFPq" },
      { id: "sfx-exp01",   label: "Explosão 01",  driveId: "13W2xtsARG5IBtTLfq-RffbJyAEva0e1q" },
      { id: "sfx-exp02",   label: "Explosão 02",  driveId: "1g3ef-sTBHR0jsLlqHCPn_b3xJAfUztvn" },
      { id: "sfx-exp03",   label: "Explosão 03",  driveId: "14A8GiPX7c_0l56Lhnc7LJt7cs9nf3Pi4" },
      { id: "sfx-exp04",   label: "Explosão 04",  driveId: "17ngphJOZCb6XDcaFsn49JAaRoqImP3MJ" },
      { id: "sfx-exp05",   label: "Explosão 05",  driveId: "1kiAEdT4OaAoyyzs0NEyY-BzaUUfgIdaD" },
      { id: "sfx-exp06",   label: "Explosão 06",  driveId: "1ZFqs5qbKqppw6CncXsHc00fHGoJeZfcN" },
      { id: "sfx-exp07",   label: "Explosão 07",  driveId: "1JNshLd6DI-jenws1MzLLO3MeJjsy6aW2" },
      { id: "sfx-exp08",   label: "Explosão 08",  driveId: "1xxlMp6H8Skh_rRp7VT044zXUHFyCLVXZ" },
      { id: "sfx-exp09",   label: "Explosão 09",  driveId: "1pHBbtN-HutTHBtY4n4Tb3tbx_JVa8nOr" },
      { id: "sfx-exp10",   label: "Explosão 10",  driveId: "1AVS80wWQO5HTqtK6j3MzYoWt3PIkEvYu" },
      { id: "sfx-exp11",   label: "Explosão 11",  driveId: "1R8fyiR4AcnVJ4yqkPA0mVuzvqsBJ-jhO" },
      { id: "sfx-exp12",   label: "Explosão 12",  driveId: "1RA7huToe5Pt7oSE9JYaVFyxfSerl7AWG" },
      { id: "sfx-exp13",   label: "Explosão 13",  driveId: "14x4lECEbgGaClWHOTeun9PtRHCrnPDlk" },
      { id: "sfx-exp14",   label: "Explosão 14",  driveId: "1VCzDBfe5M0FtmFpFrm9gQHMLcZW03_-1" },
      { id: "sfx-exp15",   label: "Explosão 15",  driveId: "1hHohdP3lmK6i2drYs-CjhH1mFdAl1a0X" },
      { id: "sfx-lowboom", label: "Low Boom",     driveId: "1XFjYxXLOhbLkX1p7ZLJSVPeCP7jz9RZq" },
    ],
  },
  {
    id: "sfx-electric",
    label: "Elétrico",
    emoji: "⚡",
    assets: [
      { id: "sfx-elec1",  label: "Electric 1",  driveId: "1RuzRn7Dy9z_ssCzOL_7EDVDmtITODYtZ" },
      { id: "sfx-elec2",  label: "Electric 2",  driveId: "1i-hJ6c5yGu2OcqLVdcMHD4gizUjpVDTZ" },
      { id: "sfx-elec3",  label: "Electric 3",  driveId: "1EsE1v6QI84Y1j7A4pgAwq8tGwGEi7vt2" },
      { id: "sfx-elec4",  label: "Electric 4",  driveId: "1gxIHpTgSVagvZfCN3-lYBl8DNswKCr9E" },
      { id: "sfx-elec5",  label: "Electric 5",  driveId: "1UqSAO9Xgqm7OJgYLiY7FjknfTiQzYwLr" },
    ],
  },
  {
    id: "sfx-horror",
    label: "Horror & Suspense",
    emoji: "👻",
    assets: [
      { id: "sfx-suspei",  label: "Suspense Impact", driveId: "152Pqv3vVp3Id0gW2tXndsNr69wK64PlS" },
      { id: "sfx-crickets",label: "Grilos",          driveId: "16dF9YBKIxFdEzBNb-2rF8jVrYT28ZRdV" },
      { id: "sfx-evillgh", label: "Evil Laugh",      driveId: "1PA8wrq5DGY18UEeDfSlcST3yiCsF2keq" },
      { id: "sfx-ghost",   label: "Ghost Scream",    driveId: "1PCzX0FtnCECPDauU1iXVIUJzzkIyQfFf" },
      { id: "sfx-rustle",  label: "Rustle",          driveId: "1SwNoDp85QiFaGuzoB0LSwMjNJipdB56e" },
      { id: "sfx-heartbt", label: "Heartbeat",       driveId: "1W28CMRQ9df-m0KuecJsk8PLp5pxsyqIG" },
      { id: "sfx-slowhbt", label: "Slow Heartbeat",  driveId: "1fk5bIlH_b8pXrCdhlI9pExplEoo0ILdd" },
      { id: "sfx-crow",    label: "Corvo",           driveId: "1qNRpI23-BilpcJvP9EIwe9qivJr27oSU" },
      { id: "sfx-snd1",    label: "Sound 1",         driveId: "1PWDALGaVk_m5onSqeuHRe4sjvpAywlmw" },
      { id: "sfx-snd2",    label: "Sound 2",         driveId: "1BbeDwlLA3zPT_5r1VXHXqUn6OZPFZQvV" },
    ],
  },
  {
    id: "sfx-funny",
    label: "Engraçados",
    emoji: "😂",
    assets: [
      { id: "sfx-fun1",    label: "Funny 1",          driveId: "1mwIQxgFvztekGGzkveQLNn09BeAKQe0N" },
      { id: "sfx-fun2",    label: "Funny 2",          driveId: "1CEC17FRSwl4Se0WOe1yX_zu1DSXd0m41" },
      { id: "sfx-fun3",    label: "Funny 3",          driveId: "1QhaFy3RwuGSZrPvrAu93YiJOvE3wjhHX" },
      { id: "sfx-fun4",    label: "Funny 4",          driveId: "1wJSbiGzguPvYUy2ZxN-JFdg4p8pQMUIs" },
      { id: "sfx-fun5",    label: "Funny 5",          driveId: "1R0Nvh1X1nk7CWtW2LFO02Ybkj6qamc-r" },
      { id: "sfx-fun6",    label: "Funny 6",          driveId: "1bpbElaXCa6XPdLmV-XWzGyBAAmMm_oTa" },
      { id: "sfx-fun7",    label: "Funny 7",          driveId: "14wFcEeZIq_iMggMhivoF4MojYccVbVeh" },
      { id: "sfx-fun8",    label: "Funny 8",          driveId: "1FLrUY2HbEXdtrOuHFSbBQMJqJ8VatxuA" },
      { id: "sfx-fun9",    label: "Funny 9",          driveId: "1_j4kirb5J4EcbsxHTi1MfrdhstO1MXjk" },
      { id: "sfx-fun10",   label: "Funny 10",         driveId: "1IhXFJ_JSAUCfM1mowwWFrOHmu8L46KnD" },
      { id: "sfx-fun11",   label: "Funny 11",         driveId: "1bqn8sIuc3QHZQrTBExxGcbsu_w4CHUk7" },
      { id: "sfx-fun12",   label: "Funny 12",         driveId: "1ZgOV65M4KByInSxbe7-UcAUGsqAmLd_V" },
      { id: "sfx-fun13",   label: "Funny 13",         driveId: "1PLdxgeLx-cv7TFy_6RzrcfZim8LVP1df" },
      { id: "sfx-fun14",   label: "Funny 14",         driveId: "1tPoZMoQ-YJvU20Xd6sOoiweek-gdqlMa" },
      { id: "sfx-fun15",   label: "Funny 15",         driveId: "16D0LCDAeFuWVFKqEidGNn_mF1krYl202" },
      { id: "sfx-fun16",   label: "Funny 16",         driveId: "1z9v7kwZj56mXkkh_32TxPAaaIwF9lhfz" },
      { id: "sfx-fun17",   label: "Funny 17",         driveId: "1c1E1SMTuTFmKORGEEMdbxIi8UcASzYJ8" },
      { id: "sfx-fun18",   label: "Funny 18",         driveId: "14S0Epw4g_GNijzj48iWfemQozJXI83LJ" },
      { id: "sfx-fun19",   label: "Funny 19",         driveId: "15S_uCietNB-s38n_92d0fAKf20XCZRf1" },
      { id: "sfx-fun20",   label: "Funny 20",         driveId: "1KQJoxbRb12oPCq8hDMXA3Nd30CY2fQoX" },
      { id: "sfx-fun21",   label: "Funny 21",         driveId: "1j3vHw-8hKqJ4o2OvPmRaHq4LrHjsh-ZH" },
      { id: "sfx-fun22",   label: "Funny 22",         driveId: "1mfPy5lGn83_igPZ7d9abeerJnP7PbwbS" },
      { id: "sfx-fun23",   label: "Funny 23",         driveId: "1fGZO4Hf2HuWmtvJApb8NL2mixZ9-TYu2" },
      { id: "sfx-flgh1",   label: "Funny Laugh 1",    driveId: "1M-bgCGmfALspv7rEaA3ISC-q9KOYyiyb" },
      { id: "sfx-flgh2",   label: "Funny Laugh 2",    driveId: "1R_-RqvVxMDv8JY0ChKdTuCzH4qphl9Sf" },
      { id: "sfx-flgh3",   label: "Funny Laugh 3",    driveId: "1Hyfv9ZpZlep_u6gHcW_im0nAKTkxSz6n" },
      { id: "sfx-fsnz",    label: "Funny Sneeze",     driveId: "1e29r4vPwOpTsG17Om2-b3ioETkjBKH1i" },
      { id: "sfx-fslp",    label: "Funny Sleeping",   driveId: "1j0KE6-XhzX5-GwRn1g5qLbbKzWjjOVwk" },
      { id: "sfx-fwoosh",  label: "Funny Woosh",      driveId: "14Th-2Xxv_4-Sj_l1EtEQhlB-19L-SfN-" },
      { id: "sfx-cens",    label: "Censura",          driveId: "1l2gg7DdHL6OiToLPr43kPY0QfHbK-9uL" },
    ],
  },
  {
    id: "sfx-ui",
    label: "UI & Câmera",
    emoji: "📸",
    assets: [
      { id: "sfx-shutter",  label: "Shutter",        driveId: "1y1Stbro3CoK8KfvIhkRWcgJg4ywWd5mm" },
      { id: "sfx-ting",     label: "Ting",           driveId: "1yGthpg_9T7irsymO8iyXgQUozGGd7qi-" },
      { id: "sfx-camflash", label: "Camera Flash",   driveId: "1-s30GrhXqONaLYytZwfKqUFecYK9wNHg" },
      { id: "sfx-paper",    label: "Paper",          driveId: "18fhYzkCqxbha-PVU5mQxKRvYS0OzFq4H" },
      { id: "sfx-rewind",   label: "Rewind",         driveId: "19E4giA-YZoi8v6Eq-27ifNMNdhrUZ1YJ" },
      { id: "sfx-comb",     label: "Comb",           driveId: "1Outv5PZzYRbfLmaRMfW6TZpj9k721T1R" },
      { id: "sfx-enter",    label: "Enter",          driveId: "1qtNdOdujr9-9jYgmiu1L5d0qS_rub4GF" },
      { id: "sfx-kbd",      label: "Keyboard",       driveId: "1uFWPYDcqhMnMPMZYNfgPiq1VQnqvrRzw" },
      { id: "sfx-rmwh",     label: "RM Whoosh",      driveId: "10dvOevZ2Q5TOv3ZfDXV1X7TZmTNbfkRV" },
      { id: "sfx-rmclk1",   label: "RM Click 1",     driveId: "1JMHrYHAsZMXFt9dmGflsSurwmWdFtP-A" },
      { id: "sfx-rmclk2",   label: "RM Click 2",     driveId: "1KZBHXD6_9wTfvFxL7oeTpa_JGKaVvIV_" },
      { id: "sfx-rmclk3",   label: "RM Click 3",     driveId: "12Ar7yX-_lHKxnO4W4NSIZ9THB58rBmLv" },
      { id: "sfx-woosh1",   label: "Woosh 1",        driveId: "1DaCEhFAES9EJ1OdXf1gMUTmhx9XZkwh4" },
      { id: "sfx-woosh2",   label: "Woosh 2",        driveId: "1DOo4ldJHAHv-tYR_M_Uln-TAdFrBnxo9" },
      { id: "sfx-uilzoom",  label: "UI Long Zoom",   driveId: "1N0ga13qPLiVFy_diPLFSdtIsNHUPkDru" },
      { id: "sfx-lowslwh",  label: "Low Slow Whoosh",   driveId: "1hJe2qRqOw7muMfwB9eCOu3mGbS6TIDSH" },
      { id: "sfx-camfl2",   label: "Camera com Flash",  driveId: "1FJs416T6KWo0Fs3UbD3oqJtPN4UuS2TA" },
      { id: "sfx-camshot",  label: "Camera Shot",       driveId: "1EAFm8Gxi-seA93lJiKcUxjRohUSZ1cPq" },
      { id: "sfx-takephx",  label: "Taking Photos",     driveId: "1qu84BrEUV479Un-pfCvi17jDJ6h_Layp" },
      { id: "sfx-mclk2",    label: "Mouse Click 2",     driveId: "164lR0PwCgcDHZADIHOb8tNVNKCRgn3tW" },
      { id: "sfx-mclkHD",   label: "Mouse Click HD",    driveId: "1FdNNtPg7Q8wB_Xf4cWy55fUFql2HKyzH" },
      { id: "sfx-clkHD",    label: "Click HD",          driveId: "1DnHVx3E2CE38CHtEoPwH3JYNzqV4ubbr" },
      { id: "sfx-clkwav",   label: "Click wav",         driveId: "1bfXyK3GYIoGTxRMjmnZ-uTy5IsW20KqY" },
      { id: "sfx-clkwav2",  label: "Click 2 wav",       driveId: "1fSEaCNNQWMf2kT0WnLHd8Y5Z1qB_wAUc" },
      { id: "sfx-mclksnd",  label: "Mouse Click SFX",   driveId: "1ty63sqnYpTWsJNpCDTbrd9CSYPHSQP5Y" },
      { id: "sfx-camsh2",   label: "Camera Shutter 2",  driveId: "170ySzytzTFgeB6ShR5fk8_JPIJtoOdBQ" },
      { id: "sfx-camshSFX", label: "Camera Shutter SFX",driveId: "1QETUKybwSDI-bTKw6f1X5_B7MHeKIDW7" },
      { id: "sfx-camshwav", label: "Camera Shutter wav",driveId: "1_Xr4cginAdayHfRn8czOTXESgWn8dyLY" },
      { id: "sfx-camshwav2",label: "Camera Shutter wav2",driveId: "1ZOQMVL0Kdvny5aFgxajCribF0VD5o27V" },
      { id: "sfx-mclkc",    label: "Mouse Click",       driveId: "1C4XLcmxi1HMlZgTQr868ciF2bbmoHLl1" },
      { id: "sfx-kbd2",     label: "Keyboard Writing",  driveId: "1ITO8v45670UHA44y3z-Ummh4sh4pdIJ4" },
      { id: "sfx-snd1x",    label: "Sound 1",           driveId: "16VVYcCXoHDGeOQ2fblwO6PVqEmoFDmiQ" },
      { id: "sfx-snd2x",    label: "Sound 2",           driveId: "16svfb7fWzXs5vLBGWek6dcUaCDjthqwD" },
      { id: "sfx-snd3x",    label: "Sound 3",           driveId: "1obCyjaQ6N1pSwbAR9-XeZYmLSY3hTjkh" },
      { id: "sfx-snd4x",    label: "Sound 4",           driveId: "1tHnJBDDpaU-tmEDHqaAYZFUq9cXELPrt" },
      { id: "sfx-snd5x",    label: "Sound 5",           driveId: "1CTYKEYvrXVoai3xmMfLYTKeLMBcD-SXX" },
      { id: "sfx-snd6x",    label: "Sound 6",           driveId: "1cEgGu64t6Nay3Boiu5FRwNoPWCpbRhWq" },
      { id: "sfx-snd1mp",   label: "Sound-1 mp3",       driveId: "1HubrDYNJdPzl0knHXg1KVkimy-k4Vzv4" },
      { id: "sfx-snd2mp",   label: "Sound-2 mp3",       driveId: "1KWKgYa8M8zNanuP7zzKARCCuTZRm38Nd" },
      { id: "sfx-8bitcoin", label: "8-Bit Coin",        driveId: "1Ts0gs2r0M7qmHxTP3WUI1PUauyAYjhE2" },
    ],
  },
  {
    id: "sfx-animals",
    label: "Animais & Reações",
    emoji: "🦅",
    assets: [
      { id: "sfx-eagle",   label: "Eagle",        driveId: "1nUOVrddR_mim88zP64iKvskQfeHibwFL" },
      { id: "sfx-quack",   label: "Quack",        driveId: "1urpDpYhCSOY6kk5tbioDDU_NqzIVZQBK" },
      { id: "sfx-shocked", label: "Shocked",      driveId: "1rqgSWdL1O5U0_V3hFUewtIcQP1YNNJGA" },
      { id: "sfx-hit1",    label: "Hit 1",        driveId: "1z1SGXLWBfYZk8nxqxasyT8fOxeNOEFUc" },
    ],
  },
  {
    id: "sfx-cinematic",
    label: "Cinemático",
    emoji: "🎬",
    assets: [
      { id: "sfx-cin01",    label: "Cinematic 01",          driveId: "1cYyH3bscTHrSclP9a7enXJAjqLKMxVRn" },
      { id: "sfx-cin02",    label: "Cinematic 02",          driveId: "12JIa9vyI7JXplKhQmnqVg0RN11r7oGs2" },
      { id: "sfx-cin03",    label: "Cinematic 03",          driveId: "1099LChhTmrH0u7h5MAkw3E4fE6qEybxQ" },
      { id: "sfx-cin04",    label: "Cinematic 04",          driveId: "14dxc1oSHFKxEfRanuejFgVMOt-2PoLSk" },
      { id: "sfx-cin05",    label: "Cinematic 05",          driveId: "1Avz8n7TXbm8zShrNoYidX9pyAeMYPdpU" },
      { id: "sfx-cin06",    label: "Cinematic 06",          driveId: "1EY67X1N0TU234RXsOtTPUjqfmrettYb3" },
      { id: "sfx-cin07",    label: "Cinematic 07",          driveId: "1sLldrEXcX_2_P1ut-2g5fyJ9tYwxBzAx" },
      { id: "sfx-cin08",    label: "Cinematic 08",          driveId: "17u5MO_RjOQJdvH96j7GbAvabd_JYmGdd" },
      { id: "sfx-cin09",    label: "Cinematic 09",          driveId: "12hs9xOttPOEe27qzGfZIOEPa3KzK_vr8" },
      { id: "sfx-cin10",    label: "Cinematic 10",          driveId: "1p_NGT6jeABQOUs2dVeQOzHGhG_BQykQJ" },
      { id: "sfx-cin11",    label: "Cinematic 11",          driveId: "1yRV8P9crR0JtdeYqRlc1Xx_vcJuGM8aV" },
      { id: "sfx-cin12",    label: "Cinematic 12",          driveId: "1JCEEPfTtBJCdzygxwfb2Z9pgKZjtUXU6" },
      { id: "sfx-cin13",    label: "Cinematic 13",          driveId: "17B6RLjKhmIwsn3xQI8YShxBfs9BE6Cv3" },
      { id: "sfx-cin14",    label: "Cinematic 14",          driveId: "1Ez10Q9hxCEpDuPv2g-_shTZzwz-NodY1" },
      { id: "sfx-cin15",    label: "Cinematic 15",          driveId: "1FQeh_KNT7aNG4UEVaCFF-nVjwM6Ky2a5" },
      { id: "sfx-cin16",    label: "Cinematic 16",          driveId: "1DF_lBeeNnbcfFU2TMw6XmgI-mrWZfcxC" },
      { id: "sfx-cin17",    label: "Cinematic 17",          driveId: "11e4BVKjREWf0L79fdb3bkR2xzW4BB-B7" },
      { id: "sfx-cin18",    label: "Cinematic 18",          driveId: "1-yuPsfHdCtzefVty3lPP7CpWTovFOUku" },
      { id: "sfx-cin19",    label: "Cinematic 19",          driveId: "1fQ2XLO4iLz2jMSZAnyt9ZBrcNl4TpFgE" },
      { id: "sfx-cin20",    label: "Cinematic 20",          driveId: "1Od2tSSOKpF-MJdvhU1otDLEqKNiVys2s" },
      { id: "sfx-cin21",    label: "Cinematic 21",          driveId: "1C6zvBYPffYh9vGJvEDD167LbzCOignp8" },
      { id: "sfx-cin22",    label: "Cinematic 22",          driveId: "1I1xD8NuahCI1JTmR1sD0AkK8v1k0KcFa" },
      { id: "sfx-cin23",    label: "Cinematic 23",          driveId: "1zf7r2CCy3yMgEWc6L1_D9UTlYyAxDMo4" },
      { id: "sfx-cin24",    label: "Cinematic 24",          driveId: "1qvnYBXki74t5dPTd1CiIG-TK9ObbwbuF" },
      { id: "sfx-cin25",    label: "Cinematic 25",          driveId: "1vclGa_K_S49REwWWFg4NB72HS35g0yuyq" },
      { id: "sfx-cin26",    label: "Cinematic 26",          driveId: "12bgG7d2iTTU1buLN4ipJ5LiEnr2Q9Ojx" },
      { id: "sfx-cin27",    label: "Cinematic 27",          driveId: "1KxmtHEdOQDeoi5tgNtJtk0eiWWH1NDzb" },
      { id: "sfx-cin28",    label: "Cinematic 28",          driveId: "1-8DXPMMxzmFqOe9EAHTv6hV4EwyAHhmv" },
      { id: "sfx-cin29",    label: "Cinematic 29",          driveId: "1zPYQDU3XnXLEKKiixkoyJct-_ThqLq6T" },
      { id: "sfx-cin30",    label: "Cinematic 30",          driveId: "1ce3AxtmAdoi7gvpdqMe5o3I-SPyM00jT" },
      { id: "sfx-cin31",    label: "Cinematic 31",          driveId: "1nA5CXMfSafVqi9pVHbsv0nz9qf9H3w-F" },
      { id: "sfx-cin32",    label: "Cinematic 32",          driveId: "1bMi_T5wB-72TbP0r6NsFiytlGVUW00-j" },
      { id: "sfx-cin33",    label: "Cinematic 33",          driveId: "1SAs4AVjyR26h8RkpG0_hUeRrhDnpGzeW" },
      { id: "sfx-cin34",    label: "Cinematic 34",          driveId: "1UrbFoWqu5hOY8MawxyK168v4sT0UJKYN" },
      { id: "sfx-cin35",    label: "Cinematic 35",          driveId: "1tZyh9ng7kNuzwxyIyaWoU-Cwvkb96ykY" },
      { id: "sfx-cin36",    label: "Cinematic 36",          driveId: "1oBbyfXnDD79l5YvSqcBX8nL0h7H4bH8W" },
      { id: "sfx-cinrh06",  label: "Rise & Hit 06",        driveId: "1x4OuDZPmt88HRI05RAG7wyV0FX2EIQXZ" },
      { id: "sfx-cinrh07",  label: "Rise & Hit 07",        driveId: "1esNP7FC3ZN4ZRPPeNEyy1ZBOg_coMt1M" },
      { id: "sfx-cinrh08",  label: "Rise & Hit 08",        driveId: "1yPf36PlDXxIAOhoYutqClknzpSRQ8Sai" },
      { id: "sfx-cinrh09",  label: "Rise & Hit 09",        driveId: "1rB6RaLrI5zz6_kqNClU3J6ssSE3-imov" },
      { id: "sfx-cinrh10",  label: "Rise & Hit 10",        driveId: "1QpLpvgn1te8_iQRKv9ZTmXGRDCXTCTTS" },
      { id: "sfx-cinboom1", label: "Cinematic Boom",       driveId: "1PwgTkHP5IVgX3KqR1RpGc5-7QrU3j26O" },
      { id: "sfx-cinboom2", label: "Cinematic Boom 2",     driveId: "13t5VQpKu1L5mLC1lLuvN_-wVY88nugzh" },
      { id: "sfx-cinwh1",   label: "Cinematic Whoosh",     driveId: "1nWnuF8vNddJIWolIALUQGfNefqBXTF8H" },
      { id: "sfx-cinwh2",   label: "Cinematic Whooshs",    driveId: "1RlIv6Dcq5SszIUE2KjEg8ublYGD_tga7" },
      { id: "sfx-toprsr",   label: "Top Riser",            driveId: "1J9PawgKGWX6sd0F2pqrIny9QBygMcYAs" },
      { id: "sfx-buildup",  label: "Build Up",             driveId: "1iL1SLVHRtVw98aAdp9JfkVILlyM5diH8" },
      { id: "sfx-riselit",  label: "Rise Light",           driveId: "1dL6_bDaz39x0A3E6xbOAp1aLQGQzkxkT" },
      { id: "sfx-glsfx1",   label: "Glitch SFX 1",        driveId: "173hc70iR02tM755Qe1yXXHM0lRleheSJ" },
      { id: "sfx-glsfx2",   label: "Glitch SFX 2",        driveId: "1fBqPshAYR6Uo51PWUOoKLB4awVYNuBSh" },
      { id: "sfx-corpRH01", label: "Corporate Rise 01",    driveId: "1qXDfN-QSUPytCBdQXDwr4x69hczoCLDX" },
      { id: "sfx-corpRH02", label: "Corporate Rise 02",    driveId: "1uEY0If_lKaHvYAKUNP9NsH2do7PiOR0r" },
      { id: "sfx-corpRH03", label: "Corporate Rise 03",    driveId: "1grZNWTNxlwYMxaokeUCU7h_rPDYK-jlW" },
      { id: "sfx-corpRH04", label: "Corporate Rise 04",    driveId: "1gX7G7SGBICQNFz0_X3U3f0ckmmyo-LTD" },
      { id: "sfx-corpRH05", label: "Corporate Rise 05",    driveId: "1BD9a3l0RuGf6ksa6NnTwTGW2LbdR4bay" },
    ],
  },
  {
    id: "sfx-data",
    label: "Data & Tech",
    emoji: "💾",
    assets: [
      { id: "sfx-data01", label: "Data 01", driveId: "1Y6TXbUznyksu507oQvXqTcAtYIeeJIIj" },
      { id: "sfx-data02", label: "Data 02", driveId: "1c3MNeCvvq_w3Eq9RqaehzySFGiE1XzoL" },
      { id: "sfx-data03", label: "Data 03", driveId: "1v2GBxBFWSxnUXxoGd8UkzC7PEr1gswEe" },
      { id: "sfx-data04", label: "Data 04", driveId: "1jU5bNFLUQNfYs3vDRQy7epWi7Ep5aWQI" },
      { id: "sfx-data05", label: "Data 05", driveId: "1bh9Ei_ipfQPu2GTXsP3m6BOgLEf3ie0s" },
      { id: "sfx-data06", label: "Data 06", driveId: "1-n8ZgReiP0PNeQPn8cOhO-s9QvTHHBQF" },
      { id: "sfx-data07", label: "Data 07", driveId: "1UX-fr82aZpROEpqnuDkpLNbrNToFEbgx" },
      { id: "sfx-data08", label: "Data 08", driveId: "1B8c5K5q1-eUbp4_MNf_awSlnmYFO-G0q" },
    ],
  },
  {
    id: "sfx-clock",
    label: "Relógio & Alarme",
    emoji: "⏰",
    assets: [
      { id: "sfx-scaryck",  label: "Scary Clock",        driveId: "11g-XYBq-t-nCd0fb7N1jq89blCTAzTAG" },
      { id: "sfx-bellpos",  label: "Bells Positive",     driveId: "150Mfv0TWqroVohui1uEkyBa_z1j0J9jG" },
      { id: "sfx-clkmp3",   label: "Clock Ticking",      driveId: "18HwijOwsGixkFvnvxwOsiixSno0JzUtL" },
      { id: "sfx-clkfast",  label: "Clock Fast",         driveId: "1F1mr4UgdIB8vod1e-PG7r3IrMsSEc2QA" },
      { id: "sfx-wrestbel", label: "Wrestling Bell",     driveId: "1Lx4IeOsL7lmEXrH7S-B0mmpywMsxxrWy" },
      { id: "sfx-cntdbomb", label: "Countdown Bomb",     driveId: "1Zb2c-dcrHxY1vj01iMlyss8VJy1GXEQB" },
      { id: "sfx-cntdhigh", label: "Countdown High",     driveId: "1hVUxFIsbkUPeMoMR9MVVVMswL_MHXqhW" },
      { id: "sfx-almclk",   label: "Alarm Clock Beep",   driveId: "1mrdJNsPux2aly8qN_SVnYZ-Nd1vz_WY9" },
      { id: "sfx-almsnd",   label: "Alarm Sound",        driveId: "1sYOOX4V_M5QBeBma4tD_DV7ZaOdNTCZy" },
      { id: "sfx-beepwav",  label: "Beep wav",           driveId: "1ycFMVQT9HaStJhGLO20rUlzASeQgX2s0" },
      { id: "sfx-beepwav2", label: "Beep 2 wav",         driveId: "1g4Y6iaGH7sufjp0zLf46oAHdK9BbQQZf" },
    ],
  },
];

/* ── Sound Card ── */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const SoundCard = ({
  asset,
  isFav,
  onToggleFav,
  favCount = 0,
  showCount = false,
}: {
  asset: SfxAsset;
  isFav: boolean;
  onToggleFav: (id: string) => void;
  favCount?: number;
  showCount?: boolean;
}) => {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0); // 0–100
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const proxyUrl = `${SUPABASE_URL}/functions/v1/proxy-audio?id=${asset.driveId}`;
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${asset.driveId}`;

  const togglePlay = async () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setPlaying(false);
      setProgress(0);
    } else {
      setLoading(true);
      try {
        await audioRef.current.play();
        setPlaying(true);
      } catch (err) {
        console.error("Audio play error:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (el && el.duration) {
      setProgress((el.currentTime / el.duration) * 100);
    }
  };

  const handleEnded = () => {
    setPlaying(false);
    setProgress(0);
  };

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  return (
    <div className="rounded-xl border border-border/60 bg-card hover:border-primary/50 transition-all duration-200 flex flex-col items-center gap-3 p-4 w-[44vw] sm:w-40 md:w-44 shrink-0 relative">
      {/* Audio element via proxy */}
      <audio
        ref={audioRef}
        src={proxyUrl}
        preload="none"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onCanPlay={() => setLoading(false)}
      />

      {/* Fav button */}
      <button
        onClick={() => onToggleFav(asset.id)}
        className="absolute top-2 right-2 z-10 rounded-full bg-background/80 backdrop-blur-sm p-1.5 shadow transition-all hover:scale-110"
        aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      >
        <Heart className={cn("h-3.5 w-3.5 transition-colors", isFav ? "fill-destructive text-destructive" : "text-muted-foreground")} />
      </button>

      {/* Play button + progress bar */}
      <div className="flex flex-col items-center gap-1.5 w-full">
        <button
          onClick={togglePlay}
          disabled={loading}
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center shadow-md transition-all duration-200",
            loading && "opacity-70 cursor-wait",
            playing
              ? "bg-destructive text-destructive-foreground scale-95"
              : "bg-primary text-primary-foreground hover:scale-110"
          )}
          aria-label={playing ? "Parar" : loading ? "Carregando..." : "Reproduzir"}
        >
          {loading ? (
            <span className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : playing ? (
            <Square className="h-5 w-5 fill-current" />
          ) : (
            <Play className="h-5 w-5 fill-current" />
          )}
        </button>

        {/* Progress bar — sempre visível, cresce quando tocando */}
        <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-200",
              playing ? "bg-primary" : "bg-muted-foreground/30"
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Label */}
      <p className="text-xs font-semibold text-center leading-tight line-clamp-2">{asset.label}</p>

      {/* Badge */}
      <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">SFX</Badge>

      {/* Download */}
      <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="w-full">
        <Button size="sm" variant="outline" className="gap-1 text-[11px] h-8 px-2 w-full">
          <Download className="h-3 w-3" />Baixar
        </Button>
      </a>
    </div>
  );
};

/* ── Coming Soon panel ── */
const ComingSoon = ({ tab }: { tab: Tab }) => (
  <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
    <div className="text-5xl">
      {tab.id === "sfx" ? "🎧" : tab.id === "vfx" ? "✨" : "🎬"}
    </div>
    <h3 className="text-lg font-bold">Em breve</h3>
    <p className="text-sm text-muted-foreground max-w-xs">{tab.description} estará disponível em breve.</p>
    <Badge variant="secondary" className="text-xs">Próxima atualização</Badge>
  </div>
);

/* ── Asset Grid ── */
const AssetGrid = ({
  assets, emptyMsg, favorites, onToggleFav, favCounts = {}, showCounts = false,
}: {
  assets: Asset[]; emptyMsg: string; favorites: Set<string>; onToggleFav: (id: string) => void;
  favCounts?: Record<string, number>; showCounts?: boolean;
}) => (
  assets.length > 0 ? (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-3 px-3 scrollbar-none sm:hidden">
        {assets.map((asset) => (
          <div key={asset.id} className="shrink-0 flex items-start pt-1">
            <AssetCard asset={asset} isFav={favorites.has(asset.id)} onToggleFav={onToggleFav} favCount={favCounts[asset.id] || 0} showCount={showCounts} />
          </div>
        ))}
      </div>
      <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pt-1">
        {assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} isFav={favorites.has(asset.id)} onToggleFav={onToggleFav} favCount={favCounts[asset.id] || 0} showCount={showCounts} />
        ))}
      </div>
    </>
  ) : (
    <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">{emptyMsg}</div>
  )
);

/* ── Grouped Carousel Section ── */
const GroupCarousel = ({
  group, favorites, onToggleFav,
}: {
  group: OverlayGroup | EffectGroup; favorites: Set<string>; onToggleFav: (id: string) => void;
}) => (
  <div className="mb-6">
    <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
      <span>{group.emoji}</span>
      <span>{group.label}</span>
      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-1">{group.assets.length}</Badge>
    </h2>
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-3 px-3 md:-mx-6 md:px-6 scrollbar-none">
      {group.assets.map((asset) => (
        <div key={asset.id} className="shrink-0 w-[44vw] sm:w-40 md:w-44">
          <AssetCard asset={asset} isFav={favorites.has(asset.id)} onToggleFav={onToggleFav} />
        </div>
      ))}
    </div>
  </div>
);

/* ── Sort filter button ── */
const MostFavoritedToggle = ({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) => (
  <button
    onClick={onToggle}
    className={cn(
      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all shrink-0",
      active
        ? "bg-destructive text-destructive-foreground border-destructive"
        : "bg-card text-muted-foreground border-border/60 hover:border-destructive/40 hover:text-foreground"
    )}
  >
    <TrendingUp className="h-3.5 w-3.5" />
    Mais Favoritados
  </button>
);

/* ── Main page ── */
const Assets = () => {
  const [activeTab, setActiveTab] = useState("backgrounds");
  const [sortByPopular, setSortByPopular] = useState(false);
  const { favorites, favCounts, toggle: toggleFav, loading: favsLoading } = useFavorites();

  const currentTab = tabs.find((t) => t.id === activeTab)!;

  const allGroups = [...overlayGroups, ...effectGroups];
  const allAssets = [...backgrounds, ...emojiAssets, ...overlayGroups.flatMap((g) => g.assets), ...effectGroups.flatMap((g) => g.assets)];
  const favoriteAssets = allAssets.filter((a) => favorites.has(a.id));

  // Sort helper: sort by favCounts descending when filter is active
  const sortAssets = <T extends { id: string }>(assets: T[]): T[] => {
    if (!sortByPopular) return assets;
    return [...assets].sort((a, b) => (favCounts[b.id] || 0) - (favCounts[a.id] || 0));
  };

  const sortedBackgrounds = sortAssets(backgrounds);
  const sortedEmojis = sortAssets(emojiAssets);

  const mobileLabel: Record<string, string> = {
    backgrounds: "Fundos",
    "overlays-effects": "Overlays",
    "emojis-animados": "Emojis",
    favorites: "Favs",
    sfx: "Sons",
  };

  // Tabs that show the "Mais Favoritados" filter
  const showSortFilter = ["backgrounds", "overlays-effects", "emojis-animados", "sfx"].includes(activeTab);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Fixed top section */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2 md:px-6 md:pt-6 max-w-6xl mx-auto w-full space-y-3">

        {/* Header */}
        <div>
          <h1 className="text-xl md:text-3xl font-bold font-display flex items-center gap-2">
            <Layers className="h-6 w-6 md:h-7 md:w-7 text-primary" />
            Área de Edição 🎬
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Assets prontos para turbinar seus vídeos — fundos, overlays, efeitos e muito mais.
          </p>
        </div>

        {/* Tip notice */}
        <p className="text-xs text-muted-foreground bg-muted/40 border border-border/50 rounded-lg px-3 py-2">
          💡 Para visualizar melhor o arquivo clique em <span className="font-semibold text-foreground">"Abrir"</span>
        </p>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 md:mx-0 md:px-0 scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all border shrink-0",
                activeTab === tab.id
                  ? tab.id === "favorites"
                    ? "bg-destructive text-destructive-foreground border-destructive"
                    : "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground",
                tab.comingSoon && activeTab !== tab.id && "opacity-60"
              )}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{mobileLabel[tab.id] ?? tab.label}</span>
              {tab.id === "favorites" && favorites.size > 0 && activeTab !== "favorites" && (
                <span className="bg-destructive text-destructive-foreground text-[9px] rounded-full px-1.5 py-0 min-w-4 text-center leading-4 font-bold">
                  {favorites.size}
                </span>
              )}
              {tab.comingSoon && (
                <span className="hidden sm:inline text-[9px] bg-muted rounded px-1 py-0.5 uppercase tracking-wide">
                  Em breve
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sort filter row */}
        {showSortFilter && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Filtrar:</span>
            <MostFavoritedToggle active={sortByPopular} onToggle={() => setSortByPopular((v) => !v)} />
          </div>
        )}
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto w-full px-3 md:px-6 pb-6">
          {currentTab.comingSoon ? (
            <ComingSoon tab={currentTab} />
          ) : activeTab === "backgrounds" ? (
            <AssetGrid
              assets={sortedBackgrounds}
              favorites={favorites}
              onToggleFav={toggleFav}
              emptyMsg="Nenhum fundo disponível"
              favCounts={favCounts}
              showCounts={sortByPopular}
            />
          ) : activeTab === "overlays-effects" ? (
            allGroups.map((g) => (
              <GroupCarousel
                key={g.id}
                group={g}
                favorites={favorites}
                onToggleFav={toggleFav}
                favCounts={favCounts}
                sortByPopular={sortByPopular}
                showCounts={sortByPopular}
              />
            ))
          ) : activeTab === "emojis-animados" ? (
            <AssetGrid
              assets={sortedEmojis}
              favorites={favorites}
              onToggleFav={toggleFav}
              emptyMsg="Nenhum emoji disponível"
              favCounts={favCounts}
              showCounts={sortByPopular}
            />
          ) : activeTab === "favorites" ? (
            favsLoading ? (
              <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
                <span className="animate-pulse">Carregando favoritos...</span>
              </div>
            ) : favoriteAssets.length > 0 ? (
              <AssetGrid
                assets={favoriteAssets}
                favorites={favorites}
                onToggleFav={toggleFav}
                emptyMsg=""
                favCounts={favCounts}
                showCounts={false}
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <Heart className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nenhum favorito ainda.</p>
                <p className="text-xs text-muted-foreground/60">Toque no ❤️ em qualquer asset para salvar aqui.</p>
              </div>
            )
          ) : activeTab === "sfx" ? (
            <div className="space-y-6">
              {sfxGroups.map((group) => {
                const sortedAssets = sortByPopular
                  ? [...group.assets].sort((a, b) => (favCounts[b.id] || 0) - (favCounts[a.id] || 0))
                  : group.assets;
                return (
                  <div key={group.id}>
                    <h2 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <span>{group.emoji}</span>
                      <span>{group.label}</span>
                      <span className="text-[10px] bg-secondary text-secondary-foreground rounded px-1.5 py-0 h-4 inline-flex items-center ml-1">{group.assets.length}</span>
                    </h2>
                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-3 px-3 md:-mx-6 md:px-6 scrollbar-none">
                      {sortedAssets.map((asset) => (
                        <div key={asset.id} className="shrink-0">
                          <SoundCard
                            asset={asset}
                            isFav={favorites.has(asset.id)}
                            onToggleFav={toggleFav}
                            favCount={favCounts[asset.id] || 0}
                            showCount={sortByPopular}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Assets;
