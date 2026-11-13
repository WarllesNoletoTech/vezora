import test from 'node:test';
import assert from 'node:assert/strict';
import { accessPeriod } from '../src/trial';

const now=new Date('2026-11-12T12:00:00.000Z');
test('conta sem tipo de negócio exige atualização',()=>{
  assert.equal(accessPeriod({businessType:null,trialStartsAt:null,subscriptionEndsAt:null},now).status,'ONBOARDING');
});
test('trial dura 72 horas após cadastro ou atualização antiga',()=>{
  assert.equal(accessPeriod({businessType:'BARBEARIA',trialStartsAt:now,subscriptionEndsAt:null},now).daysRemaining,3);
  assert.equal(accessPeriod({businessType:'BARBEARIA',trialStartsAt:new Date(now.getTime()-3*86400000),subscriptionEndsAt:null},now).status,'EXPIRED');
});
test('assinatura ativa libera acesso após vencimento do trial',()=>{
  const t={businessType:'NAIL_DESIGNER',trialStartsAt:new Date(now.getTime()-5*86400000),subscriptionEndsAt:new Date(now.getTime()+30*86400000)};
  assert.equal(accessPeriod(t,now).status,'ACTIVE');
});

test('administrador pode estender teste sem alterar os tres dias originais',()=>{
  const t={businessType:'BARBEARIA',trialStartsAt:new Date(now.getTime()-4*86400000),subscriptionEndsAt:null,trialExtensionDays:2};
  assert.equal(accessPeriod(t,now).status,'TRIAL');
  assert.equal(accessPeriod(t,new Date(now.getTime()+86400000)).status,'EXPIRED');
});
test('suspensao administrativa bloqueia inclusive uma assinatura paga',()=>{
  const t={businessType:'ESTETICA',trialStartsAt:now,subscriptionEndsAt:new Date(now.getTime()+20*86400000),suspendedAt:now};
  assert.equal(accessPeriod(t,now).status,'SUSPENDED');
  assert.equal(accessPeriod({...t,suspendedAt:null},now).status,'ACTIVE');
});
test('o vencimento pago tem prioridade sobre o periodo de teste',()=>{
  const t={businessType:'LASH_DESIGNER',trialStartsAt:now,subscriptionEndsAt:new Date(now.getTime()+10*86400000)};
  assert.equal(accessPeriod(t,now).status,'ACTIVE');
});

test('configuracao de teste com 7 dias aplica aos novos cadastros',()=>{
 assert.equal(accessPeriod({businessType:'BARBEARIA',trialStartsAt:now,trialDays:7,subscriptionEndsAt:null},new Date(now.getTime()+6*86400000)).status,'TRIAL');
 assert.equal(accessPeriod({businessType:'BARBEARIA',trialStartsAt:now,trialDays:7,subscriptionEndsAt:null},new Date(now.getTime()+7*86400000)).status,'EXPIRED');
});
test('teste zero dias exige assinatura imediatamente',()=>{
 assert.equal(accessPeriod({businessType:'BARBEARIA',trialStartsAt:now,trialDays:0,subscriptionEndsAt:null},now).status,'EXPIRED');
});
