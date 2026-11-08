import { Buffer } from 'buffer';
import {
  Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction, clusterApiUrl,
} from '@solana/web3.js';

globalThis.Buffer ??= Buffer;
const conn = new Connection(clusterApiUrl('devnet'), 'confirmed');
const MEMO = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const sol = (l) => +(l / LAMPORTS_PER_SOL).toFixed(4);
const txLink = (sig, text) => `<a href="https://explorer.solana.com/tx/${esc(sig)}?cluster=devnet" target="_blank" rel="noopener">${text}</a>`;
const mine = () => { try { return JSON.parse(localStorage.getItem('myStakes') || '[]'); } catch { return []; } };
const remember = (sig) => { try { localStorage.setItem('myStakes', JSON.stringify([...mine(), sig])); } catch {} };

let wallet = null;
let escrow = null;

function toast(html, kind = '') {
  const t = $('#toast');
  t.className = kind;
  t.innerHTML = html;
}

async function api(path, body) {
  const r = await fetch(`/api/${path}`, body ? {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  } : undefined);
  const j = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
  return j;
}

$('#connect').onclick = async () => {
  const p = window.phantom?.solana;
  if (!p?.isPhantom) return window.open('https://phantom.app', '_blank', 'noopener');
  wallet = (await p.connect()).publicKey;
  const a = wallet.toBase58();
  $('#connect').textContent = `${a.slice(0, 4)}…${a.slice(-4)}`;
  $('#stake').disabled = false;
  $('#stake').textContent = 'Stake it';
};

$('#goal-form').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  let beneficiary;
  try { beneficiary = new PublicKey(f.get('beneficiary').trim()); } catch { return toast('Friend wallet address is not valid.', 'bad'); }
  if (beneficiary.equals(wallet)) return toast('Your friend cannot be you. Nice try.', 'bad');
  const lamports = Math.round(Number(f.get('amount')) * LAMPORTS_PER_SOL);
  const deadline = Math.floor(Date.now() / 1000) + Number(f.get('minutes')) * 60;
  const memo = JSON.stringify({ g: f.get('goal').trim(), d: deadline, b: beneficiary.toBase58(), a: lamports });

  try {
    $('#stake').disabled = true;
    toast('Approve the stake in Phantom…');
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: wallet, toPubkey: new PublicKey(escrow), lamports }),
      new TransactionInstruction({ programId: MEMO, keys: [{ pubkey: wallet, isSigner: true, isWritable: false }], data: Buffer.from(memo) }),
    );
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
    tx.feePayer = wallet;
    tx.recentBlockhash = blockhash;
    // Sign in Phantom but send through our devnet RPC, so Phantom's network setting does not matter.
    const signed = await window.phantom.solana.signTransaction(tx);
    const sig = await conn.sendRawTransaction(signed.serialize());
    toast('Locking your SOL on-chain…');
    await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
    remember(sig);
    e.target.reset();
    toast(`Staked. Your promise is on-chain: ${txLink(sig, 'view tx')}. Now go do it.`, 'good');
    await loadWall();
  } catch (err) {
    toast(`Stake failed: ${esc(err.message)}`, 'bad');
  } finally {
    $('#stake').disabled = false;
  }
};

async function toJpeg(file) {
  const img = await createImageBitmap(file);
  const s = Math.min(1, 1024 / Math.max(img.width, img.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * s), height: Math.round(img.height * s) });
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}

async function settle(sig, file) {
  try {
    toast(file ? 'The AI referee is looking at your photo…' : 'Settling on-chain…');
    const r = await api('judge', file ? { sig, image: await toJpeg(file), mime: 'image/jpeg' } : { sig });
    if (!r.settled) {
      toast(`Rejected (${Math.round(r.confidence * 100)}% sure): “${esc(r.reason)}” Try a better photo before the deadline.`, 'bad');
    } else if (r.verdict === 'kept') {
      toast(`Promise kept. “${esc(r.reason)}” SOL refunded: ${txLink(r.payout, 'payout tx')}`, 'good');
    } else {
      toast(`Promise broken. “${esc(r.reason)}” Your friend got paid: ${txLink(r.payout, 'payout tx')}`, 'bad');
    }
    await loadWall();
  } catch (err) {
    toast(`Referee error: ${esc(err.message)}`, 'bad');
  }
}

function card(it, now) {
  const expired = now > it.deadline;
  const status = it.result ? it.result.verdict : expired ? 'expired' : 'live';
  const left = it.deadline - now;
  const when = left > 86400 ? `${Math.ceil(left / 86400)}d left` : left > 3600 ? `${Math.ceil(left / 3600)}h left` : `${Math.max(0, Math.ceil(left / 60))}m left`;
  const label = { kept: 'KEPT', broken: 'BROKEN', expired: 'TIME UP', live: when }[status];
  const isMine = mine().includes(it.sig);
  let action = '';
  if (status === 'live' && isMine) {
    action = `<label class="btn small">Prove it 📸<input type="file" accept="image/*" capture="environment" data-sig="${esc(it.sig)}" hidden></label>`;
  } else if (status === 'expired') {
    action = `<button class="btn small ghost" data-settle="${esc(it.sig)}">Pay the friend</button>`;
  }
  return `<article class="goal ${status}">
    <div class="tag">${label}</div>
    <h3>“${esc(it.goal)}”</h3>
    <div class="meta">${sol(it.lamports)} SOL on the line · ${txLink(it.sig, 'stake')}${it.result ? ` · ${txLink(it.result.sig, 'verdict')}` : ''}</div>
    ${it.result?.reason ? `<p class="reason">Referee: “${esc(it.result.reason)}”</p>` : ''}
    ${action}
  </article>`;
}

async function loadWall() {
  try {
    const data = await api('wall');
    escrow = data.escrow;
    $('#escrow').textContent = `${escrow.slice(0, 6)}…`;
    $('#escrow').href = `https://explorer.solana.com/address/${escrow}?cluster=devnet`;
    const now = Date.now() / 1000;
    const items = data.items;
    const done = items.filter((i) => i.result);
    const kept = done.filter((i) => i.result.verdict === 'kept').length;
    const toFriends = done.filter((i) => i.result.verdict === 'broken').reduce((a, i) => a + i.lamports, 0);
    $('#stats').innerHTML = `
      <div><b>${items.length}</b>promises</div>
      <div><b>${sol(items.reduce((a, i) => a + i.lamports, 0))}</b>SOL staked</div>
      <div><b>${done.length ? Math.round((100 * kept) / done.length) : 0}%</b>kept</div>
      <div><b>${sol(toFriends)}</b>SOL to friends</div>`;
    $('#wall').innerHTML = items.length ? items.map((i) => card(i, now)).join('') : '<p class="note">No promises yet. Be the first.</p>';
  } catch (err) {
    $('#wall').innerHTML = `<p class="note">Could not load wall: ${esc(err.message)}. Retrying…</p>`;
    setTimeout(loadWall, 10_000); // public devnet RPC rate-limits bursts

  }
}

// While the photo picker/camera is open, auto-refresh would replace the input and drop the photo.
let picking = false;
$('#wall').addEventListener('change', (e) => {
  picking = false;
  const sig = e.target.dataset?.sig;
  if (sig && e.target.files[0]) settle(sig, e.target.files[0]);
});
$('#wall').addEventListener('click', (e) => {
  if (e.target.closest('label')) picking = true;
  const sig = e.target.dataset?.settle;
  if (sig) settle(sig, null);
});
window.addEventListener('focus', () => setTimeout(() => { picking = false; }, 2000));

loadWall();
setInterval(() => { if (!picking) loadWall(); }, 30_000);
