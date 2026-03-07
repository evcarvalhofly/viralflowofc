import { useState, useEffect } from "react";
import {
  Film, Music, Sparkles, Layers, Download,
  ExternalLink, Play, Heart
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FAVORITES_KEY = "viralflow_asset_favorites";

function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      return new Set(stored ? JSON.parse(stored) : []);
    } catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
  }, [favorites]);

  const toggle = (id: string) =>
    setFavorites((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return { favorites, toggle };
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
    comingSoon: true,
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
  assets, emptyMsg, favorites, onToggleFav,
}: {
  assets: Asset[]; emptyMsg: string; favorites: Set<string>; onToggleFav: (id: string) => void;
}) => (
  assets.length > 0 ? (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-3 px-3 scrollbar-none sm:hidden">
        {assets.map((asset) => (
          <div key={asset.id} className="shrink-0 flex items-start pt-1">
            <AssetCard asset={asset} isFav={favorites.has(asset.id)} onToggleFav={onToggleFav} />
          </div>
        ))}
      </div>
      <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pt-1">
        {assets.map((asset) => (
          <AssetCard key={asset.id} asset={asset} isFav={favorites.has(asset.id)} onToggleFav={onToggleFav} />
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

/* ── Main page ── */
const Assets = () => {
  const [activeTab, setActiveTab] = useState("backgrounds");
  const { favorites, toggle: toggleFav } = useFavorites();

  const currentTab = tabs.find((t) => t.id === activeTab)!;

  const allGroups = [...overlayGroups, ...effectGroups];
  const allAssets = [...backgrounds, ...emojiAssets, ...overlayGroups.flatMap((g) => g.assets), ...effectGroups.flatMap((g) => g.assets)];
  const favoriteAssets = allAssets.filter((a) => favorites.has(a.id));

  const mobileLabel: Record<string, string> = {
    backgrounds: "Fundos",
    "overlays-effects": "Overlays",
    "emojis-animados": "Emojis",
    favorites: "Favs",
    sfx: "Sons",
  };

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
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto w-full px-3 md:px-6 pb-6">
          {currentTab.comingSoon ? (
            <ComingSoon tab={currentTab} />
          ) : activeTab === "backgrounds" ? (
            <AssetGrid
              assets={backgrounds}
              favorites={favorites}
              onToggleFav={toggleFav}
              emptyMsg="Nenhum fundo disponível"
            />
          ) : activeTab === "overlays-effects" ? (
            allGroups.map((g) => <GroupCarousel key={g.id} group={g} favorites={favorites} onToggleFav={toggleFav} />)
          ) : activeTab === "emojis-animados" ? (
            <AssetGrid
              assets={emojiAssets}
              favorites={favorites}
              onToggleFav={toggleFav}
              emptyMsg="Nenhum emoji disponível"
            />
          ) : activeTab === "favorites" ? (
            favoriteAssets.length > 0 ? (
              <AssetGrid
                assets={favoriteAssets}
                favorites={favorites}
                onToggleFav={toggleFav}
                emptyMsg=""
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
                <Heart className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nenhum favorito ainda.</p>
                <p className="text-xs text-muted-foreground/60">Toque no ❤️ em qualquer asset para salvar aqui.</p>
              </div>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Assets;
