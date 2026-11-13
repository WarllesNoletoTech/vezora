import crypto from 'node:crypto';

/**
 * Valida a assinatura Mercado Pago (HMAC-SHA256) com comparação em tempo constante.
 * Webhooks MP podem informar `ts` como Unix timestamp em segundos OU milissegundos.
 * O manifesto HMAC preserva o valor original de `ts`, sem conversão.
 */
export function verifyMercadoPagoSignature(
  xSignature: string,
  requestId: string,
  dataId: string,
  secret: string,
  nowMs: number = Date.now()
): boolean {
  if (!secret || !xSignature || !requestId || !dataId) return false;
  const parts: Record<string, string> = {};
  for (const entry of xSignature.split(',')) {
    const index = entry.indexOf('=');
    if (index <= 0) continue;
    parts[entry.slice(0, index).trim()] = entry.slice(index + 1).trim();
  }
  if (!/^\d{10,13}$/.test(parts.ts || '') || !/^[a-f\d]{64}$/i.test(parts.v1 || '')) return false;
  const timestamp = Number(parts.ts);
  const seconds = timestamp >= 1_000_000_000_000 ? timestamp / 1000 : timestamp;
  if (!Number.isFinite(seconds) || Math.abs(nowMs / 1000 - seconds) > 600) return false;
  const message = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${parts.ts};`;
  const expected = crypto.createHmac('sha256', secret).update(message).digest();
  const received = Buffer.from(parts.v1, 'hex');
  return received.length === expected.length && crypto.timingSafeEqual(received, expected);
}
