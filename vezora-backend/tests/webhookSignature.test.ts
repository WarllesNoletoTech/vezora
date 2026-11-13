import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyMercadoPagoSignature } from '../src/webhookSignature';

const secret = 'segredo-de-teste-vezora';
const dataId = '124567899';
const requestId = 'request-abc';
const now = Date.UTC(2026, 10, 12, 20, 0, 0);
function signature(ts: string) {
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  return `ts=${ts},v1=${crypto.createHmac('sha256', secret).update(manifest).digest('hex')}`;
}
test('aceita assinaturas válidas com segundos', () => {
  assert.equal(verifyMercadoPagoSignature(signature(String(now / 1000)), requestId, dataId, secret, now), true);
});
test('aceita assinaturas válidas com milissegundos', () => {
  assert.equal(verifyMercadoPagoSignature(signature(String(now)), requestId, dataId, secret, now), true);
});
test('rejeita adulteração, segredo incorreto e notificações antigas', () => {
  const valid = signature(String(now));
  assert.equal(verifyMercadoPagoSignature(valid, requestId, '42', secret, now), false);
  assert.equal(verifyMercadoPagoSignature(valid, requestId, dataId, 'segredo-invalido', now), false);
  assert.equal(verifyMercadoPagoSignature(valid, requestId, dataId, secret, now + 601000), false);
});
