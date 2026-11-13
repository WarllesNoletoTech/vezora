/** Regras puras do acesso comercial: 3 dias iniciais + extensoes pontuais do admin. */
export const TRIAL_DAYS=3;
export const BILLING_DAYS=30;
export type PeriodData={businessType:string|null;trialStartsAt:Date|null;subscriptionEndsAt:Date|null;trialDays?:number|null;trialExtensionDays?:number|null;suspendedAt?:Date|null};
export function accessPeriod(t:PeriodData, now=new Date()) {
  const extension=Math.max(0,Math.min(365,Number(t.trialExtensionDays??0)));
  // Contas anteriores a v1.0 preservam 3 dias; alteracao global nao retroage.
  const baseDays=Math.max(0,Math.min(90,Number(t.trialDays??TRIAL_DAYS)));
  const trialEndsAt=t.trialStartsAt?new Date(t.trialStartsAt.getTime()+(baseDays+extension)*86400000):null;
  const subscribed=Boolean(t.subscriptionEndsAt && t.subscriptionEndsAt>now);
  const trial=Boolean(trialEndsAt && trialEndsAt>now);
  const status=t.suspendedAt?'SUSPENDED':!t.businessType?'ONBOARDING':subscribed?'ACTIVE':trial?'TRIAL':'EXPIRED';
  return {
    status,
    daysRemaining:status==='ACTIVE'?Math.ceil((t.subscriptionEndsAt!.getTime()-now.getTime())/86400000):status==='TRIAL'?Math.ceil((trialEndsAt!.getTime()-now.getTime())/86400000):0,
    trialEndsAt:trialEndsAt?.toISOString()??null,
    subscriptionEndsAt:t.subscriptionEndsAt?.toISOString()??null
  };
}
