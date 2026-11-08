import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWall, challengeCode, decide, isEscrowSigned, memoJson, readStake } from './core.js';

test('challengeCode is stable, 5 chars, no lookalike characters', () => {
  const sig = '5VERv8NMvzbJMEkV8xnrLkEaWRtSz9CosKDYjCJjBRnbJLgp8uirBgmQpjKhoR4tjF3ZpRzrFmBV6UjKdiSZkQUW';
  assert.equal(challengeCode(sig), challengeCode(sig));
  assert.match(challengeCode(sig), /^[ACEFHJKLMNPRTUVWXY2346789]{5}$/);
  assert.notEqual(challengeCode(sig), challengeCode('X' + sig.slice(1)));
});

test('decide pays the right wallet', () => {
  const stake = { staker: 'Me', beneficiary: 'Friend', deadline: 100 };
  assert.deepEqual(decide(stake, 50, { pass: true }), { to: 'Me', v: 'kept' });
  assert.equal(decide(stake, 50, { pass: false }), null);
  assert.deepEqual(decide(stake, 101, { pass: true }), { to: 'Friend', v: 'broken' });
});

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
    staker: 'Staker1', lamports: 5, goal: 'run 5k', proof: '', deadline: 1700000000, beneficiary: 'Friend1',
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
