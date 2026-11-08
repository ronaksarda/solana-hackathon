// Pure helpers: the chain is the database, so these read goals and verdicts out of memos.
export const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

// RPC returns memos as "[len] text". Returns the parsed JSON object, or null.
export function memoJson(memo) {
  if (typeof memo !== 'string') return null;
  try {
    const o = JSON.parse(memo.replace(/^\[\d+\]\s*/, ''));
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
}

// Reads stake facts from a jsonParsed transaction. Throws unless it is a real stake to escrow.
export function readStake(tx, escrow) {
  if (!tx || tx.meta?.err) throw new Error('Stake transaction not found or failed');
  const ixs = tx.transaction.message.instructions;
  const transfer = ixs.find(
    (i) => i.program === 'system' && i.parsed?.type === 'transfer' && i.parsed.info.destination === escrow,
  );
  if (!transfer) throw new Error('No transfer to escrow in this transaction');
  const memoIx = ixs.find((i) => i.program === 'spl-memo');
  const m = memoJson(typeof memoIx?.parsed === 'string' ? memoIx.parsed : null);
  if (!m?.g || !m?.d || !m?.b) throw new Error('Stake memo missing goal, deadline or friend');
  return {
    staker: transfer.parsed.info.source,
    lamports: transfer.parsed.info.lamports,
    goal: String(m.g),
    deadline: Number(m.d),
    beneficiary: String(m.b),
  };
}

// A settlement only counts if escrow paid the fee (signed it). Blocks fake "already settled" memos.
export function isEscrowSigned(tx, escrow) {
  const payer = tx?.transaction.message.accountKeys[0];
  return !!tx && !tx.meta?.err && (payer?.pubkey ?? payer)?.toString() === escrow;
}

// Joins stake memos with trusted settlement memos into wall rows, newest first.
export function buildWall(sigInfos) {
  const results = new Map();
  for (const s of sigInfos) {
    const m = memoJson(s.memo);
    if (m?.s && !s.err) results.set(m.s, { verdict: m.v, reason: m.r, sig: s.signature });
  }
  return sigInfos.flatMap((s) => {
    const m = memoJson(s.memo);
    if (!m?.g || s.err) return [];
    return [{
      sig: s.signature,
      goal: String(m.g),
      deadline: Number(m.d),
      lamports: Number(m.a) || 0,
      time: s.blockTime,
      result: results.get(s.signature) ?? null,
    }];
  });
}
