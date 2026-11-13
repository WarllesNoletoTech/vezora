import { db } from './db';
import { decrypt, encrypt } from './crypto';
import { env } from './env';
import { verifyMercadoPagoSignature } from './webhookSignature';

export function mpReady() { return Boolean(env.MP_CLIENT_ID && env.MP_CLIENT_SECRET && env.MP_REDIRECT_URI && env.MP_WEBHOOK_SECRET && env.API_PUBLIC_URL); }
async function mpRequest<T>(path: string, method: string, token: string | null, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error(`Mercado Pago retornou erro HTTP ${res.status}`);
  return await res.json() as T;
}
type TokenResult = { access_token: string; refresh_token: string; user_id: number; expires_in: number };
export async function exchangeCode(code: string, verifier: string) {
  return mpRequest<TokenResult>('/oauth/token', 'POST', null, {
    client_id: env.MP_CLIENT_ID, client_secret: env.MP_CLIENT_SECRET,
    grant_type: 'authorization_code', code, redirect_uri: env.MP_REDIRECT_URI,
    code_verifier: verifier
  });
}
export async function sellerToken(tenantId: string) {
  const account = await db.paymentAccount.findUnique({where:{tenantId}});
  if (!account) throw new Error('Mercado Pago não conectado');
  if (account.expiresAt.getTime() > Date.now() + 5 * 60_000) return decrypt(account.encryptedToken);
  const refreshed = await mpRequest<TokenResult>('/oauth/token', 'POST', null, {
    grant_type: 'refresh_token', client_id: env.MP_CLIENT_ID,
    client_secret: env.MP_CLIENT_SECRET, refresh_token: decrypt(account.encryptedRefresh)
  });
  await db.paymentAccount.update({where:{tenantId}, data:{
    encryptedToken: encrypt(refreshed.access_token),
    encryptedRefresh: encrypt(refreshed.refresh_token),
    expiresAt: new Date(Date.now() + refreshed.expires_in * 1000)
  }});
  return refreshed.access_token;
}
export async function createPreference(tenantId: string, payload: unknown) {
  const token = await sellerToken(tenantId);
  return mpRequest<{id: string; init_point: string; sandbox_init_point?: string}>('/checkout/preferences', 'POST', token, payload);
}
export async function getPayment(tenantId: string, paymentId: string) {
  const token = await sellerToken(tenantId);
  return mpRequest<{id: number; status: string; external_reference: string; transaction_amount: number; collector_id: number; currency_id?: string | null; date_approved?: string | null}>(`/v1/payments/${paymentId}`, 'GET', token);
}
export function validMpWebhook(xSignature: string, requestId: string, dataId: string) {
  return verifyMercadoPagoSignature(xSignature, requestId, dataId, env.MP_WEBHOOK_SECRET);
}

// Consulta de recuperação por referência externa (não cria nem altera cobranças).
export async function searchPaymentsForBooking(tenantId: string, bookingId: string) {
  const token=await sellerToken(tenantId);
  const query=new URLSearchParams({external_reference:bookingId,sort:'date_created',criteria:'desc',limit:'20'});
  const data=await mpRequest<{results: Array<{id:number;status:string;external_reference:string}>}>(`/v1/payments/search?${query}`, 'GET', token);
  return Array.isArray(data.results)?data.results:[];
}
