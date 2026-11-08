// Records the demo video against the local dev server with real devnet transactions.
// A throwaway test wallet stands in for Phantom (browser extensions cannot be automated); the caption says so.
// Usage: npm run dev, then: node --env-file=.env.local scripts/record-demo.mjs <fake-proof.jpg>
import { chromium } from 'playwright';
import {
  Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, TransactionInstruction,
  clusterApiUrl, sendAndConfirmTransaction,
} from '@solana/web3.js';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const BASE = 'http://localhost:5173';
const FAKE_PROOF = process.argv[2]; // a photo that does not prove the goal
const REAL_PROOF = 'demo/proof.png'; // captured during the recording
const CHROME = process.env.CHROME_PATH; // optional: use an already installed Chromium
const c = new Connection(clusterApiUrl('devnet'), 'confirmed');
const escrow = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.ESCROW_SECRET_KEY)));
const wallet = Keypair.generate();
const friend = Keypair.generate();

await sendAndConfirmTransaction(c, new Transaction().add(
  SystemProgram.transfer({ fromPubkey: escrow.publicKey, toPubkey: wallet.publicKey, lamports: 0.3 * LAMPORTS_PER_SOL }),
), [escrow]);

// Pre-stake the goal that will expire on camera about 50s into the recording.
const late = 0.05 * LAMPORTS_PER_SOL;
const lateDeadline = Math.floor(Date.now() / 1000) + 50;
const lateMemo = JSON.stringify({ g: 'do 20 push-ups before the demo ends', d: lateDeadline, b: friend.publicKey.toBase58(), a: late });
const lateSig = await sendAndConfirmTransaction(c, new Transaction().add(
  SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: escrow.publicKey, lamports: late }),
  new TransactionInstruction({ programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'), keys: [{ pubkey: wallet.publicKey, isSigner: true, isWritable: false }], data: Buffer.from(lateMemo) }),
), [wallet]);

mkdirSync('demo/raw', { recursive: true });
const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: 'demo/raw', size: { width: 1280, height: 720 } } });
await ctx.exposeFunction('__sign', (b64) => {
  const tx = Transaction.from(Buffer.from(b64, 'base64'));
  tx.partialSign(wallet);
  return tx.serialize().toString('base64');
});
await ctx.addInitScript(({ addr, mine }) => {
  try { localStorage.setItem('myStakes', JSON.stringify(mine)); } catch {}
  window.phantom = { solana: {
    isPhantom: true,
    async connect() {
      const w = await import('/node_modules/.vite/deps/@solana_web3__js.js');
      return { publicKey: new w.PublicKey(addr) };
    },
    async signTransaction(tx) {
      const raw = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
      const signed = await window.__sign(btoa(String.fromCharCode(...raw)));
      const bytes = Uint8Array.from(atob(signed), (ch) => ch.charCodeAt(0));
      return { serialize: () => bytes };
    },
  } };
}, { addr: wallet.publicKey.toBase58(), mine: [lateSig] });

const page = await ctx.newPage();
const wait = (s) => page.waitForTimeout(s * 1000);
const caption = (text) => page.evaluate((t) => {
  let el = document.getElementById('__cap');
  if (!el) {
    el = Object.assign(document.createElement('div'), { id: '__cap' });
    el.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);width:max-content;max-width:1080px;z-index:99999;background:rgba(11,11,12,.92);color:#f2f0e9;border:2px solid #c6ff3d;padding:14px 22px;font:600 22px/1.35 "JetBrains Mono",monospace;text-align:center';
    document.body.appendChild(el);
  }
  el.textContent = t;
}, text);
const card = (title, sub) => page.setContent(`<body style="margin:0;height:100vh;display:flex;flex-direction:column;justify-content:center;padding:0 96px;background:#0b0b0c;color:#f2f0e9;font-family:'Archivo Black',Arial,sans-serif">
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<p style="font:700 22px 'JetBrains Mono',monospace;color:#c6ff3d;letter-spacing:3px;text-transform:uppercase">MLH Solana Hackathon</p>
<h1 style="font-size:96px;line-height:.95;margin:16px 0 28px;letter-spacing:-3px">${title}</h1>
<p style="font:400 28px/1.5 'JetBrains Mono',monospace;color:#bdbbb4;max-width:1000px">${sub}</p></body>`, { waitUntil: 'networkidle' });
const scrollTo = (sel) => page.locator(sel).first().scrollIntoViewIfNeeded();
const waitToast = async (re, s = 90) => {
  await page.waitForFunction((r) => new RegExp(r, 'i').test(document.querySelector('#toast')?.innerText || ''), re.source, { timeout: s * 1000 });
  console.log('toast:', await page.locator('#toast').innerText());
};

// 0:00 Title: name the hackathon first, as MLH requires.
await card('Skin in the Game', 'Hi! This is our demo for the MLH Solana Hackathon.<br>Stake SOL on a goal. Prove it with a photo. An AI referee decides.');
await wait(6);

// App intro
await page.goto(BASE);
await page.waitForSelector('.goal', { timeout: 60_000 });
await caption('Put money on your word. Keep your promise: SOL back. Break it: your friend gets paid.');
await wait(5);

// Connect + stake
await caption('Connect a wallet. (For this recording a devnet test wallet signs in place of the Phantom popup.)');
await page.click('#connect');
await wait(3);
await scrollTo('#goal-form');
await caption('Make a promise. Start vague…');
await page.locator('input[name=goal]').pressSequentially('make my first promise on Skin in the Game', { delay: 30 });
await page.click('#sharpen');
await caption('AI coach (Gemini) rewrites it into a goal a photo can prove, and says what the proof must show.');
await waitToast(/AI coach|Coach error/);
await wait(5);
await caption('Stake, deadline, and the friend who gets paid if you fail.');
await page.fill('input[name=amount]', '0.1');
await page.selectOption('select[name=minutes]', '60');
await page.locator('input[name=beneficiary]').pressSequentially(friend.publicKey.toBase58(), { delay: 8 });
await wait(1);
await page.click('#stake');
await caption('One transaction: SOL goes to escrow, and a Memo writes the goal and proof rule on Solana.');
await waitToast(/Staked|failed/);
await wait(3);
await scrollTo('#wall');
await page.locator('.goal.live .code').first().scrollIntoViewIfNeeded();
await caption('Anti-cheat: a challenge code derived from the stake signature. The photo must show it, so no stock or reused photos.');
await wait(6);

// Fake proof
await caption('Now prove it. First, a fake proof: a stock wallpaper.');
await wait(2);
await page.locator('input[type=file]').first().setInputFiles(FAKE_PROOF);
await waitToast(/Rejected|kept|error/);
await caption('Rejected, with a reason. A miss is not a forfeit: retry until the deadline.');
await wait(6);

// Real proof: a screenshot of the published promise with its challenge code, taken live.
await caption('Now real proof: a screenshot of my published promise, challenge code included.');
await page.locator('.goal.live').first().scrollIntoViewIfNeeded();
await page.evaluate(() => { document.getElementById('__cap').style.visibility = 'hidden'; document.getElementById('toast').style.visibility = 'hidden'; });
await page.screenshot({ path: REAL_PROOF });
await page.evaluate(() => { document.getElementById('__cap').style.visibility = ''; document.getElementById('toast').style.visibility = ''; });
await wait(2);
for (let i = 0; i < 3; i++) {
  await page.locator('input[type=file]').first().setInputFiles(REAL_PROOF);
  await waitToast(/kept|Rejected|error/);
  if (/kept/i.test(await page.locator('#toast').innerText())) break;
  await caption('Referee busy (Gemini overloaded). Retrying the same proof…');
}
await caption('Promise kept. Escrow refunds the stake; the verdict is written on-chain in the payout Memo.');
await wait(7);

// Broken promise (wall auto-refreshes every 30s; reload if the deadline has not shown yet)
const lateCard = '.goal.expired:has-text("push-ups before the demo ends")';
const left = lateDeadline - Date.now() / 1000;
if (left > 0) {
  await caption('Meanwhile, another promise is running out of time…');
  await wait(left + 1);
}
// Public devnet RPC sometimes rate-limits the wall load; retry a few times.
for (let i = 0; ; i++) {
  await page.reload();
  try {
    await page.waitForSelector(`${lateCard} button[data-settle]`, { timeout: 10_000 });
    break;
  } catch (e) {
    console.log('wall retry', i, (await page.locator('#wall').innerText()).slice(0, 120));
    if (i === 4) throw e;
  }
}
await page.locator(lateCard).first().scrollIntoViewIfNeeded();
await caption('This promise was "do 20 push-ups before the demo ends". Time is up.');
await wait(4);
await page.locator(`${lateCard} button[data-settle]`).first().click();
await waitToast(/broken|error/);
await caption('Promise broken: escrow pays the friend. Anyone can trigger it; nobody can fake it.');
await wait(6);
const payout = await page.locator('#toast a').last().getAttribute('href');

// Wall + explorer
await page.evaluate(() => window.scrollTo(0, 0));
await caption('The wall of fame & shame is rebuilt from escrow history. No database: the chain is the database.');
await wait(6);
await page.goto(payout);
await caption('Every verdict is a real devnet transaction anyone can audit on Solana Explorer.');
await wait(9);

// End card
await card('Put money on your word.', 'Solana devnet · web3.js · Memo program · Gemini vision referee<br>github.com/ronaksarda/solana-hackathon');
await wait(6);

const video = page.video();
await ctx.close();
await browser.close();
const raw = await video.path();
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', 'demo/skin-in-the-game-demo.mp4']);
console.log('Wrote demo/skin-in-the-game-demo.mp4 from', raw, '| friend:', friend.publicKey.toBase58());
