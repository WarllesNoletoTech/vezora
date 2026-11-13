/** Regras puras de acesso; não fazem queries no banco ou chamadas financeiras. */
export const TRIAL_DAYS=3;
export const BILLING_DAYS=30;
export type PeriodData={businessType:string|null;trialStartsAt:Date|null;subscriptionEndsAt:Date|null};
export function accessPeriod(t:PeriodData, now=new Date()) {
  const trialEndsAt=t.trialStartsAt?new Date(t.trialStartsAt.getTime()+TRIAL_DAYS*86400000):null;
  const subscribed=Boolean(t.subscriptionEndsAt && t.subscriptionEndsAt>now);
  const trial=Boolean(trialEndsAt && trialEndsAt>now);
  const status=!t.businessType?'ONBOARDING':subscribed?'ACTIVE':trial?'TRIAL':'EXPIRED';
  return {
    status,
    daysRemaining:subscribed?Math.ceil((t.subscriptionEndsAt!.getTime()-now.getTime())/86400000):trial?Math.ceil((trialEndsAt!.getTime()-now.getTime())/86400000):0,
    trialEndsAt:trialEndsAt?.toISOString()??null,
    subscriptionEndsAt:t.subscriptionEndsAt?.toISOString()??null
  };
}
