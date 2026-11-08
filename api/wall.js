import { buildWall } from '../lib/core.js';
import { conn, escrowKeypair, send, trustedHistory } from '../lib/chain.js';

// GET: escrow address + every goal and verdict, read straight from escrow's on-chain history.
export default async function handler(req, res) {
  try {
    const escrow = escrowKeypair().publicKey.toBase58();
    const c = conn();
    const [history, balance] = await Promise.all([trustedHistory(c, escrow, 200), c.getBalance(escrowKeypair().publicKey)]);
    send(res, 200, { escrow, balance, items: buildWall(history) });
  } catch (e) {
    send(res, 500, { error: e.message });
  }
}
