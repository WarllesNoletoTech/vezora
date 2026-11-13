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
