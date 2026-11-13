import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SCHEDULE, depositCents, localSlot, slotsForDay } from '../src/core';

test('sinal percentual, fixo e limite', () => {
  assert.equal(depositCents(12000, 'PERCENT', 30), 3600);
  assert.equal(depositCents(12000, 'FIXED', 4000), 4000);
  assert.equal(depositCents(12000, 'FIXED', 13000), 12000);
  assert.equal(depositCents(12000, 'NONE', 50), 0);
});
test('bloqueia horários que coincidem com reserva existente', () => {
  const date = '2090-11-13';
  const b = {startAt: localSlot(date,'10:00','America/Sao_Paulo'),endAt:localSlot(date,'12:00','America/Sao_Paulo')};
  const slots = slotsForDay({date, timezone:'America/Sao_Paulo',durationMin:60,schedule:DEFAULT_SCHEDULE,booked:[b]});
  assert.ok(slots.includes('09:00'));
  assert.ok(!slots.includes('09:30'));
  assert.ok(!slots.includes('10:00'));
  assert.ok(slots.includes('12:00'));
});
test('não gera slots fora do funcionamento e aceita dia fechado', () => {
  assert.deepEqual(slotsForDay({date:'2090-11-12',timezone:'America/Sao_Paulo',durationMin:60,schedule:DEFAULT_SCHEDULE,booked:[]}), []);
  assert.deepEqual(slotsForDay({date:'2090-11-12',timezone:'America/Sao_Paulo',durationMin:60,schedule:{},booked:[]}),[]);
});
