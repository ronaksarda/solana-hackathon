import { Connection, Keypair, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { isEscrowSigned, memoJson } from './core.js';

export const conn = () => new Connection(process.env.SOLANA_RPC || clusterApiUrl('devnet'), 'confirmed');

export function escrowKeypair() {
  if (!process.env.ESCROW_SECRET_KEY) throw new Error('ESCROW_SECRET_KEY not set (run npm run keygen)');
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.ESCROW_SECRET_KEY)));
}

// Escrow history with untrusted settlement memos removed (anyone can send a memo to escrow).
// shortcut: reads the newest `limit` txs only, upgrade to paginated history or an indexer past ~1000 goals.
// Who signed a finalized tx never changes, so each settlement is fetched once per server instance.
const signedByEscrow = new Map();

export async function trustedHistory(c, escrow, limit) {
  const infos = await c.getSignaturesForAddress(new PublicKey(escrow), { limit });
  const unknown = infos.filter((s) => memoJson(s.memo)?.s && !signedByEscrow.has(s.signature));
  // One at a time: public devnet RPC answers a batch of these with 429.
  for (const s of unknown) {
    const tx = await c.getParsedTransaction(s.signature, { maxSupportedTransactionVersion: 0 });
    if (tx) signedByEscrow.set(s.signature, isEscrowSigned(tx, escrow));
  }
  return infos.filter((s) => !memoJson(s.memo)?.s || signedByEscrow.get(s.signature) === true);
}

export const send = (res, code, body) => {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
};
