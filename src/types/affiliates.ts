// =============================================
// TIPOS DO SISTEMA DE AFILIADOS - ViralFlow
// =============================================

export type AffiliateStatus = 'active' | 'suspended';
export type ReferralStatus = 'pending' | 'converted' | 'cancelled';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired';
export type CommissionType = 'initial' | 'recurring';
export type CommissionStatus = 'pending' | 'approved' | 'paid' | 'cancelled';
export type LoginAccountStatus = 'available' | 'active' | 'cancelled';
export type PurchaseStatus = 'pending' | 'paid' | 'delivered' | 'cancelled';

/** Registro do afiliado — gerado ao se cadastrar */
export interface Affiliate {
  id: string;
  user_id: string;
  ref_code: string;
  status: AffiliateStatus;
  /** Percentual de comissão (ex: 30.00 = 30%) */
  commission_rate: number;
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

/** Assinatura mensal de um usuário */
export interface Subscription {
  id: string;
  user_id: string;
  affiliate_id: string | null;
  status: SubscriptionStatus;
  plan: string;
  amount: number;
  started_at: string;
  cancelled_at: string | null;
  next_billing_date: string | null;
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
  period_start: string | null;
  period_end: string | null;
  paid_at: string | null;
  created_at: string;
}

/** Solicitação de compra de slots de login para revenda */
export interface AffiliateLoginPurchase {
  id: string;
  affiliate_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
  /** pending = aguardando pagamento | paid = pago | delivered = logins entregues */
  status: PurchaseStatus;
  created_at: string;
}

/** Conta de cliente criada/gerenciada pelo afiliado para revenda */
export interface AffiliateCreatedAccount {
  id: string;
  affiliate_id: string;
  purchase_id: string | null;
  user_id: string | null;
  login_email: string;
  client_name: string | null;
  notes: string | null;
  /** available = aguardando ativação | active = ativo | cancelled = cancelado */
  status: LoginAccountStatus;
  sold_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

/** Click no link de afiliado */
export interface RefClick {
  id: string;
  affiliate_id: string;
  ref_code: string;
  converted: boolean;
  created_at: string;
}

/** Métricas consolidadas do dashboard do afiliado */
export interface AffiliateDashboardStats {
  totalClicks: number;
  totalReferrals: number;
  convertedReferrals: number;
  activeClients: number;
  cancelledClients: number;
  churnRate: number;
  pendingCommissions: number;
  totalEarned: number;
  paidCommissions: number;
  loginsRegistered: number;
  loginsActive: number;
  loginsPending: number;
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
