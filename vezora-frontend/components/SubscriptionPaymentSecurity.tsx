'use client';
import Script from 'next/script';

// Public Key SOMENTE da aplicação Vezora Assinaturas. Nunca adicionar Access Token no frontend.
const publicKey = process.env.NEXT_PUBLIC_VEZORA_MP_PUBLIC_KEY?.trim() || '';
const securityAttributes = {view: 'checkout'} as const;

type MercadoPagoWindow = Window & {
  MercadoPago?: new (key: string, options?: {locale?: string}) => unknown;
};

export default function SubscriptionPaymentSecurity() {
  return <>
    {/* Gerador oficial do MP_DEVICE_SESSION_ID usado na cobrança Pix pela API /v1/payments. */}
    <Script id="vezora-billing-device-security" src="https://www.mercadopago.com/v2/security.js" strategy="afterInteractive" {...securityAttributes}/>
    {/* O SDK V2 pode ser inicializado com Public Key da aplicação de mensalidades.
        O cartão recorrente permanece no checkout hospedado do Mercado Pago. */}
    {publicKey && <Script id="vezora-billing-sdk-v2" src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" onReady={() => {
      const MercadoPago = (window as MercadoPagoWindow).MercadoPago;
      if (typeof MercadoPago !== 'function') return;
      try { new MercadoPago(publicKey, {locale:'pt-BR'}); }
      catch { /* O checkout hospedado e o Pix não dependem do SDK local. */ }
    }}/>} 
  </>;
}
