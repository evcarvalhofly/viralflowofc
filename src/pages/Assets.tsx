import { useState } from "react";
import {
  Film, Music, Sparkles, Layers, Download,
  ExternalLink, Search, Play
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
    id: "overlays",
    label: "Overlays",
    icon: <Layers className="h-4 w-4" />,
    description: "Overlays para sobrepor nos seus vídeos",
  },
  {
    id: "effects",
    label: "Efeitos",
    icon: <Sparkles className="h-4 w-4" />,
    description: "Efeitos visuais para turbinar seus vídeos",
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
const AssetCard = ({ asset }: { asset: Asset }) => {
  const [playing, setPlaying] = useState(false);

  const viewUrl     = `https://drive.google.com/file/d/${asset.driveId}/view`;
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${asset.driveId}`;

  const Actions = ({ compact }: { compact?: boolean }) => (
    <div className={cn("flex gap-1.5", compact ? "" : "flex-col")}>
      <a href={viewUrl} target="_blank" rel="noopener noreferrer" className={compact ? "" : "w-full"}>
        <Button size="sm" variant="outline" className={cn("gap-1 text-[11px] h-8 px-2", compact ? "" : "w-full")}>
          <ExternalLink className="h-3 w-3" />Abrir
        </Button>
      </a>
      <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className={compact ? "" : "w-full"}>
        <Button size="sm" className={cn("gap-1 text-[11px] h-8 px-2", compact ? "" : "w-full")}>
          <Download className="h-3 w-3" />Baixar
        </Button>
      </a>
    </div>
  );

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden hover:border-primary/50 transition-all duration-200 flex flex-col w-[44vw] sm:w-full shrink-0">
      <VideoDriveFrame
        driveId={asset.driveId}
        title={asset.label}
        playing={playing}
        onPlay={() => setPlaying(true)}
      />
      <div className="p-2 sm:p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-1">
          <p className="text-xs font-semibold truncate">{asset.label}</p>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">{asset.category}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Actions />
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

/* ── Main page ── */
const Assets = () => {
  const [activeTab, setActiveTab] = useState("backgrounds");
  const [search, setSearch] = useState("");

  const filtered = backgrounds.filter((b) => {
    const q = search.toLowerCase();
    return (
      !q ||
      b.label.toLowerCase().includes(q) ||
      b.category.toLowerCase().includes(q) ||
      (b.tags || []).some((t) => t.includes(q))
    );
  });

  const currentTab = tabs.find((t) => t.id === activeTab)!;

  return (
    /* Outer: full height, NO scroll */
    <div className="flex flex-col h-full overflow-hidden">
      {/* Fixed top section — header + tabs + search */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2 md:px-6 md:pt-6 max-w-6xl mx-auto w-full space-y-3">

        {/* Header */}
        <div>
          <h1 className="text-xl md:text-3xl font-bold font-display flex items-center gap-2">
            <Layers className="h-6 w-6 md:h-7 md:w-7 text-primary" />
            Área de Edição 🎬
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Assets prontos para turbinar seus vídeos — fundos, sons, efeitos e muito mais.
          </p>
        </div>

        {/* Tabs — horizontal scroll */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 md:mx-0 md:px-0 scrollbar-none">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all border shrink-0",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border/60 hover:border-primary/40 hover:text-foreground",
                tab.comingSoon && activeTab !== tab.id && "opacity-60"
              )}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">
                {tab.id === "backgrounds" ? "Fundos" :
                 tab.id === "sfx" ? "Sons" :
                 tab.id === "vfx" ? "Visuais" : "Transições"}
              </span>
              {tab.comingSoon && (
                <span className="hidden sm:inline text-[9px] bg-muted rounded px-1 py-0.5 uppercase tracking-wide">
                  Em breve
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search (only backgrounds tab) */}
        {!currentTab.comingSoon && activeTab === "backgrounds" && (
          <div className="space-y-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar fundos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {filtered.length} fundo{filtered.length !== 1 ? "s" : ""} disponíve{filtered.length !== 1 ? "is" : "l"}
            </p>
          </div>
        )}
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-6xl mx-auto w-full px-3 md:px-6 pb-6">
          {currentTab.comingSoon ? (
            <ComingSoon tab={currentTab} />
          ) : activeTab === "backgrounds" ? (
            <>
              {filtered.length > 0 ? (
                <>
                  {/* Mobile: horizontal carousel */}
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-3 px-3 scrollbar-none sm:hidden">
                    {filtered.map((asset) => (
                      <div key={asset.id} className="shrink-0 flex items-start pt-1">
                        <AssetCard asset={asset} />
                      </div>
                    ))}
                  </div>
                  {/* Desktop: 9:16 grid */}
                  <div className="hidden sm:grid sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 pt-1">
                    {filtered.map((asset) => (
                      <AssetCard key={asset.id} asset={asset} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
                  Nenhum fundo encontrado para "{search}"
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Assets;
