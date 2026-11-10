import test from 'node:test';
import assert from 'node:assert/strict';
import { canSell, stockAfter } from '../stockPolicy.js';

test('kebijakan ketat: tidak boleh melebihi stok, stok 0 tidak boleh dijual', () => {
  assert.equal(canSell({ stock: 5, wanted: 5, allowNegative: false }), true);
  assert.equal(canSell({ stock: 5, wanted: 6, allowNegative: false }), false);
  assert.equal(canSell({ stock: 0, wanted: 1, allowNegative: false }), false);
  assert.equal(canSell({ stock: -2, wanted: 1 }), false);
});
test('izinkan stok minus: selalu boleh, hanya bila true persis', () => {
  assert.equal(canSell({ stock: 0, wanted: 3, allowNegative: true }), true);
  assert.equal(canSell({ stock: 0, wanted: 3, allowNegative: 'true' }), false);
});
test('stockAfter dapat negatif', () => { assert.equal(stockAfter(2, 5), -3); });
