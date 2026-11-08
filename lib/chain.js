import { Connection, Keypair, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { isEscrowSigned, memoJson } from './core.js';

export const conn = () => new Connection(process.env.SOLANA_RPC || clusterApiUrl('devnet'), 'confirmed');

export function escrowKeypair() {
  if (!process.env.ESCROW_SECRET_KEY) throw new Error('ESCROW_SECRET_KEY not set (run npm run keygen)');
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.ESCROW_SECRET_KEY)));
}

// Escrow history with untrusted settlement memos removed (anyone can send a memo to escrow).
// shortcut: reads the newest `limit` txs only, upgrade to paginated history or an indexer past ~1000 goals.
export async function trustedHistory(c, escrow, limit) {
  const infos = await c.getSignaturesForAddress(new PublicKey(escrow), { limit });
  const cands = infos.filter((s) => memoJson(s.memo)?.s);
  if (!cands.length) return infos;
  const txs = await c.getParsedTransactions(cands.map((s) => s.signature), { maxSupportedTransactionVersion: 0 });
  const fake = new Set(cands.filter((_, i) => !isEscrowSigned(txs[i], escrow)).map((s) => s.signature));
  return infos.filter((s) => !fake.has(s.signature));
}

export const send = (res, code, body) => {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
};
