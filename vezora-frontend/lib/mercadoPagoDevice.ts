/**
 * A captura do Device ID é best-effort: um bloqueador de script ou conexão lenta
 * nunca impede o pagamento Pix. O valor bruto não é persistido nem exposto na UI.
 */
type MPDeviceWindow = Window & { MP_DEVICE_SESSION_ID?: unknown };
export function readMercadoPagoDeviceId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const value = (window as MPDeviceWindow).MP_DEVICE_SESSION_ID;
  return typeof value === 'string' && value.length >= 8 && value.length <= 2048 && /^[\x21-\x7E]+$/.test(value)
    ? value
    : undefined;
}
export function waitForMercadoPagoDeviceId(timeoutMs = 2500): Promise<string | undefined> {
  const value = readMercadoPagoDeviceId();
  if (value || typeof window === 'undefined') return Promise.resolve(value);
  return new Promise(resolve => {
    const started = Date.now();
    const interval = window.setInterval(() => {
      const current = readMercadoPagoDeviceId();
      if (current || Date.now() - started >= timeoutMs) {
        window.clearInterval(interval);
        resolve(current);
      }
    }, 100);
  });
}
