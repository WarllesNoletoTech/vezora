import test from 'node:test';
import assert from 'node:assert/strict';
import {paymentMatchesBooking, splitPayerName, validDeviceId} from '../src/paymentDetails';
const expected={sellerUserId:'55667788',bookingId:'uuid-reserva-123',depositCents:2000};
const valid={status:'approved',collector_id:55667788,external_reference:'uuid-reserva-123',transaction_amount:20,currency_id:'BRL'};
test('vincula somente pagamento com recebedor, referência, moeda e valor corretos',()=>{
  assert.deepEqual(paymentMatchesBooking(valid,expected),{valid:true,reason:'ok'});
  assert.equal(paymentMatchesBooking({...valid,collector_id:3},expected).reason,'collector_mismatch');
  assert.equal(paymentMatchesBooking({...valid,external_reference:'outro'},expected).reason,'reference_mismatch');
  assert.equal(paymentMatchesBooking({...valid,currency_id:'USD'},expected).reason,'currency_mismatch');
  assert.equal(paymentMatchesBooking({...valid,transaction_amount:20.01},expected).reason,'amount_mismatch');
  assert.equal(paymentMatchesBooking({...valid,transaction_amount:NaN},expected).valid,false);
});
test('nome de comprador e device id opcionais são tratados com limites',()=>{
  assert.deepEqual(splitPayerName('  Maria   Aparecida Noleto  '),{firstName:'Maria',lastName:'Aparecida Noleto'});
  assert.deepEqual(splitPayerName('João'),{firstName:'João'});
  assert.equal(validDeviceId('abc-1234-xyz'),true);
  assert.equal(validDeviceId(''),false);
  assert.equal(validDeviceId('token com espaços'),false);
  assert.equal(validDeviceId('base64+/='),true);
  assert.equal(validDeviceId('sessao'+'.'.repeat(350)),true);
  assert.equal(validDeviceId('a'.repeat(2048)),true);
  assert.equal(validDeviceId('a'.repeat(2049)),false);
  assert.equal(validDeviceId('abc-1234\r\nX-admin: injected'),false);
  assert.equal(validDeviceId('abc-1234\n'),false);
  assert.equal(validDeviceId(null),false);
});
