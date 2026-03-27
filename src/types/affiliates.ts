// =============================================
// TIPOS DO SISTEMA DE AFILIADOS v2 - ViralFlow
// =============================================

export type AffiliateStatus = 'active' | 'suspended';
export type ReferralStatus = 'pending' | 'converted' | 'cancelled';
export type CommissionType = 'initial' | 'recurring';
/** pending = em carência (7 dias) | available = liberado p/ saque | paid = sacado | cancelled = reembolso */
export type CommissionStatus = 'pending' | 'available' | 'approved' | 'paid' | 'cancelled';
export type WithdrawalRequestStatus = 'pending' | 'paid' | 'rejected';

/** Registro do afiliado */
export interface Affiliate {
  id: string;
  user_id: string;
  ref_code: string;
  status: AffiliateStatus;
  /** Percentual de comissão (ex: 30.00 = 30%) */
  commission_rate: number;
  /** Afiliado que indicou este afiliado (MLM nível 2) */
  referred_by_affiliate_id: string | null;
  email: string | null;
  whatsapp: string | null;
  created_at: string;
}

/** Um usuário indicado pelo afiliado */
export interface Referral {
  id: string;
  affiliate_id: string;
  referred_user_id: string | null;
  ref_code: string;
  status: ReferralStatus;
  converted_at: string | null;
  created_at: string;
  // join manual via profiles
  profile?: {
    display_name: string | null;
    avatar_url: string | null;
  };
}

/** Registro individual de comissão (1 por ciclo de cobrança) */
export interface Commission {
  id: string;
  affiliate_id: string;
  subscription_id: string | null;
  referral_id: string | null;
  /** initial = primeira venda | recurring = renovação mensal */
  type: CommissionType;
  amount: number;
  status: CommissionStatus;
  /** Data a partir da qual a comissão fica disponível para saque (carência 7 dias) */
  available_after: string | null;
  /** 1 = indicação direta | 2 = sub-afiliado (MLM) */
  level: number;
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  created_at: string;
}

/** Solicitação de saque do afiliado */
export interface WithdrawalRequest {
  id: string;
  affiliate_id: string;
  amount: number;
  status: WithdrawalRequestStatus;
  pix_key: string;
  notes: string | null;
  admin_notes: string | null;
  requested_at: string;
  processed_at: string | null;
}

/** Métricas consolidadas do dashboard do afiliado */
export interface AffiliateDashboardStats {
  totalClicks: number;
  totalReferrals: number;
  convertedReferrals: number;
  activeClients: number;
  cancelledClients: number;
  churnRate: number;
  /** Comissões em carência (ainda não liberadas para saque) */
  pendingBalance: number;
  /** Comissões liberadas e prontas para sacar */
  availableBalance: number;
  /** Comissões já sacadas */
  paidBalance: number;
  /** Total histórico gerado (todas as comissões) */
  totalEarned: number;
}

/** Entrada do ranking de afiliados */
export interface AffiliateRankingEntry {
  affiliate_id: string;
  ref_code: string;
  display_name: string | null;
  avatar_url: string | null;
  active_clients: number;
  total_earned: number;
  position: number;
}
