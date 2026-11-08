// Devnet smoke test of the broken-promise path, no Phantom needed. Needs `npm run dev` running and a funded escrow.
// Usage: node --env-file=.env.local scripts/e2e.js
import {
  Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction,
  clusterApiUrl, sendAndConfirmTransaction,
} from '@solana/web3.js';
import assert from 'node:assert/strict';

const BASE = process.env.BASE_URL || 'http://localhost:5173';
const c = new Connection(clusterApiUrl('devnet'), 'confirmed');
const escrow = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.ESCROW_SECRET_KEY)));
const staker = Keypair.generate();
const friend = Keypair.generate();
const post = (body) => fetch(`${BASE}/api/judge`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

// Escrow seeds the test staker (devnet faucet is closed to scripts).
await sendAndConfirmTransaction(c, new Transaction().add(
  SystemProgram.transfer({ fromPubkey: escrow.publicKey, toPubkey: staker.publicKey, lamports: 0.01 * LAMPORTS_PER_SOL }),
), [escrow]);

const lamports = 0.005 * LAMPORTS_PER_SOL;
const memo = JSON.stringify({ g: 'e2e: deadline already passed', d: Math.floor(Date.now() / 1000) - 1, b: friend.publicKey.toBase58(), a: lamports });
const stakeSig = await sendAndConfirmTransaction(c, new Transaction().add(
  SystemProgram.transfer({ fromPubkey: staker.publicKey, toPubkey: escrow.publicKey, lamports }),
  new TransactionInstruction({ programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'), keys: [{ pubkey: staker.publicKey, isSigner: true, isWritable: false }], data: Buffer.from(memo) }),
), [staker]);
console.log('stake', stakeSig);

const first = await post({ sig: stakeSig });
console.log('settle', first);
assert.equal(first.verdict, 'broken');
assert.equal(await c.getBalance(friend.publicKey), lamports, 'friend got the stake');

const second = await post({ sig: stakeSig });
assert.equal(second.payout, first.payout, 'second call must not pay again');
assert.equal(await c.getBalance(friend.publicKey), lamports);

const wall = await fetch(`${BASE}/api/wall`).then((r) => r.json());
assert.equal(wall.items.find((i) => i.sig === stakeSig)?.result?.verdict, 'broken');
console.log('E2E OK: stake read from chain, friend paid once, wall shows verdict');
