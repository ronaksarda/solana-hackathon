import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWall, isEscrowSigned, memoJson, readStake } from './core.js';

const ESCROW = 'Esc111';
const stakeTx = (dest = ESCROW, memo = '{"g":"run 5k","d":1700000000,"b":"Friend1","a":5}') => ({
  meta: { err: null },
  transaction: {
    message: {
      accountKeys: [{ pubkey: 'Staker1' }],
      instructions: [
        { program: 'system', parsed: { type: 'transfer', info: { source: 'Staker1', destination: dest, lamports: 5 } } },
        { program: 'spl-memo', parsed: memo },
      ],
    },
  },
});

test('memoJson strips RPC length prefix and rejects junk', () => {
  assert.deepEqual(memoJson('[12] {"s":"x"}'), { s: 'x' });
  assert.equal(memoJson('[3] hey'), null);
  assert.equal(memoJson(null), null);
});

test('readStake returns facts from chain', () => {
  assert.deepEqual(readStake(stakeTx(), ESCROW), {
    staker: 'Staker1', lamports: 5, goal: 'run 5k', deadline: 1700000000, beneficiary: 'Friend1',
  });
});

test('readStake rejects transfer to wrong address and missing memo fields', () => {
  assert.throws(() => readStake(stakeTx('Other'), ESCROW), /No transfer to escrow/);
  assert.throws(() => readStake(stakeTx(ESCROW, '{"g":"x"}'), ESCROW), /memo missing/);
  assert.throws(() => readStake(null, ESCROW), /not found/);
});

test('isEscrowSigned only trusts txs escrow paid for', () => {
  const tx = (payer) => ({ meta: { err: null }, transaction: { message: { accountKeys: [{ pubkey: payer }] } } });
  assert.equal(isEscrowSigned(tx(ESCROW), ESCROW), true);
  assert.equal(isEscrowSigned(tx('Attacker'), ESCROW), false);
  assert.equal(isEscrowSigned(null, ESCROW), false);
});

test('buildWall joins stakes with verdicts', () => {
  const wall = buildWall([
    { signature: 'pay1', memo: '[40] {"s":"stake1","v":"kept","r":"nice"}' },
    { signature: 'stake2', memo: '[30] {"g":"read","d":2,"b":"F","a":7}' },
    { signature: 'stake1', memo: '[30] {"g":"run","d":1,"b":"F","a":5}' },
    { signature: 'noise', memo: null },
  ]);
  assert.equal(wall.length, 2);
  assert.equal(wall[1].result.verdict, 'kept');
  assert.equal(wall[0].result, null);
});
