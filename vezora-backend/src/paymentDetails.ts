/** Apenas transformações locais. Nunca confiar em dados do browser para aprovar pagamentos. */
export function splitPayerName(input: string): {firstName:string; lastName?:string} {
  const cleaned = input.trim().replace(/\s+/g, ' ').slice(0, 120);
  const [firstName, ...lastName] = cleaned.split(' ');
  return {firstName: firstName || 'Cliente', ...(lastName.length ? {lastName:lastName.join(' ')} : {})};
}
/**
 * MP_DEVICE_SESSION_ID é um token opaco gerado pelo script oficial, não necessariamente um UUID.
 * Seu formato pode conter caracteres base64 (como +/=) e ter mais de 200 caracteres.
 * Nunca aceitar quebras de linha, controles ou strings gigantes em cabeçalhos HTTP.
 * Se indisponível, o Device ID permanece opcional (Pix não é bloqueado).
 */
export function validDeviceId(value:unknown): value is string {
  return typeof value==='string' && value.length>=8 && value.length<=2048 && /^[\x21-\x7E]+$/.test(value);
}
export type MarketplacePaymentProof={
  status:string; collector_id:number|string; external_reference:string;
  transaction_amount:number; currency_id?:string|null; date_approved?:string|null;
};
export function paymentMatchesBooking(
  payment:MarketplacePaymentProof, expected:{sellerUserId:string;bookingId:string;depositCents:number}
):{valid:boolean;reason:string} {
  if(String(payment.collector_id)!==expected.sellerUserId) return {valid:false,reason:'collector_mismatch'};
  if(payment.external_reference!==expected.bookingId) return {valid:false,reason:'reference_mismatch'};
  if(payment.currency_id && payment.currency_id!=='BRL') return {valid:false,reason:'currency_mismatch'};
  if(!Number.isFinite(payment.transaction_amount)||Math.abs(Math.round(payment.transaction_amount*100)-expected.depositCents)>0) return {valid:false,reason:'amount_mismatch'};
  return {valid:true,reason:'ok'};
}
