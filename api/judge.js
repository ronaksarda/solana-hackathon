import { PublicKey, SystemProgram, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import { MEMO_PROGRAM, memoJson, readStake } from '../lib/core.js';
import { conn, escrowKeypair, send, trustedHistory } from '../lib/chain.js';
import { judgeProof } from '../lib/gemini.js';

// POST { sig, image?, mime? }: verifies the stake on-chain, judges the photo, pays out once.
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const { sig, image, mime } = req.body || {};
    if (typeof sig !== 'string' || !/^[1-9A-HJ-NP-Za-km-z]{64,90}$/.test(sig)) {
      return send(res, 400, { error: 'Bad stake signature' });
    }
    const c = conn();
    const kp = escrowKeypair();
    const escrow = kp.publicKey.toBase58();

    // Facts come from the chain, never from the client.
    const stake = readStake(await c.getParsedTransaction(sig, { maxSupportedTransactionVersion: 0 }), escrow);

    const prior = (await trustedHistory(c, escrow, 1000)).find((s) => memoJson(s.memo)?.s === sig);
    if (prior) {
      const m = memoJson(prior.memo);
      return send(res, 200, { settled: true, verdict: m.v, reason: m.r, payout: prior.signature });
    }

    let verdict;
    if (Date.now() / 1000 > stake.deadline) {
      verdict = { pass: false, confidence: 1, reason: 'Deadline passed. Promise broken.' };
    } else {
      if (typeof image !== 'string' || image.length > 4_000_000) {
        return send(res, 400, { error: 'Photo required (max 3 MB)' });
      }
      if (!/^image\/(jpeg|png|webp)$/.test(mime)) return send(res, 400, { error: 'JPEG, PNG or WebP only' });
      verdict = await judgeProof(stake.goal, image, mime);
      // A failed photo is not a forfeit: retry allowed until the deadline.
      if (!verdict.pass) return send(res, 200, { settled: false, ...verdict });
    }

    // shortcut: two parallel requests could both pay before either lands; upgrade to an on-chain escrow program.
    const memo = JSON.stringify({ s: sig, v: verdict.pass ? 'kept' : 'broken', r: verdict.reason });
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: kp.publicKey,
        toPubkey: new PublicKey(verdict.pass ? stake.staker : stake.beneficiary),
        lamports: stake.lamports,
      }),
      new TransactionInstruction({ programId: new PublicKey(MEMO_PROGRAM), keys: [], data: Buffer.from(memo) }),
    );
    const payout = await sendAndConfirmTransaction(c, tx, [kp]);
    send(res, 200, { settled: true, verdict: verdict.pass ? 'kept' : 'broken', ...verdict, payout });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}
