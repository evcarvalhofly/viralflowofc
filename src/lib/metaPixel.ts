/**
 * Meta Pixel (browser) + Conversions API (server-side).
 * Deduplicação automática via event_id compartilhado.
 * NÃO deve ser carregado globalmente — apenas páginas de venda.
 */

import { supabase } from '@/integrations/supabase/client';

const PIXEL_ID = '2263810711027429';

let initialized = false;

/* ─── Helpers ──────────────────────────────────────────────── */

function generateEventId(): string {
  return crypto.randomUUID();
}

/** Lê cookie _fbc ou _fbp para matching do Meta */
function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match?.[2];
}

/** Envia evento para a Edge Function meta-capi (fire-and-forget) */
function sendServerEvent(
  eventName: string,
  eventId: string,
  customData?: Record<string, any>,
  userEmail?: string,
) {
  supabase.functions.invoke('meta-capi', {
    body: {
      event_name: eventName,
      event_id: eventId,
      event_source_url: window.location.href,
      user_email: userEmail,
      user_agent: navigator.userAgent,
      fbc: getCookie('_fbc'),
      fbp: getCookie('_fbp'),
      custom_data: customData,
    },
  }).catch(() => {});
}

/* ─── Pixel Init ───────────────────────────────────────────── */

export function initPixel() {
  if (initialized) return;
  if (typeof window === 'undefined') return;

  if ((window as any).fbq) {
    initialized = true;
    return;
  }

  const f = window as any;
  const n = (f.fbq = function (...args: any[]) {
    n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
  });
  if (!f._fbq) f._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  const noscript = document.createElement('noscript');
  const img = document.createElement('img');
  img.height = 1;
  img.width = 1;
  img.style.display = 'none';
  img.src = `https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`;
  noscript.appendChild(img);
  document.body.appendChild(noscript);

  f.fbq('init', PIXEL_ID);
  initialized = true;
}

/* ─── Event Trackers (browser + server) ────────────────────── */

export function trackPageView() {
  initPixel();
  const eid = generateEventId();
  (window as any).fbq?.('track', 'PageView', {}, { eventID: eid });
  sendServerEvent('PageView', eid);
}

export function trackViewContent(params?: {
  content_name?: string;
  content_category?: string;
  value?: number;
  currency?: string;
}) {
  initPixel();
  const eid = generateEventId();
  const data = {
    content_name: params?.content_name ?? 'ViralFlow PRO',
    content_category: params?.content_category ?? 'subscription',
    value: params?.value,
    currency: params?.currency ?? 'BRL',
  };
  (window as any).fbq?.('track', 'ViewContent', data, { eventID: eid });
  sendServerEvent('ViewContent', eid, data);
}

export function trackInitiateCheckout(params: {
  value: number;
  plan: 'monthly' | 'annual';
}) {
  initPixel();
  const eid = generateEventId();
  const data = {
    value: params.value,
    currency: 'BRL',
    content_name: `ViralFlow PRO ${params.plan}`,
    content_category: 'subscription',
    num_items: 1,
  };
  (window as any).fbq?.('track', 'InitiateCheckout', data, { eventID: eid });
  sendServerEvent('InitiateCheckout', eid, data);
}

export function trackAddPaymentInfo(params: {
  value: number;
  paymentMethod: 'pix' | 'card';
  email?: string;
}) {
  initPixel();
  const eid = generateEventId();
  const data = {
    value: params.value,
    currency: 'BRL',
    content_category: 'subscription',
    payment_method: params.paymentMethod,
  };
  (window as any).fbq?.('track', 'AddPaymentInfo', data, { eventID: eid });
  sendServerEvent('AddPaymentInfo', eid, data, params.email);
}

export function trackPurchase(params: {
  value: number;
  plan: 'monthly' | 'annual';
  paymentMethod?: 'pix' | 'card';
  email?: string;
}) {
  initPixel();
  const eid = generateEventId();
  const data = {
    value: params.value,
    currency: 'BRL',
    content_name: `ViralFlow PRO ${params.plan}`,
    content_type: 'product',
    content_category: 'subscription',
    num_items: 1,
  };
  (window as any).fbq?.('track', 'Purchase', data, { eventID: eid });
  sendServerEvent('Purchase', eid, data, params.email);
}
