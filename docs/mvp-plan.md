# Skin in the Game — MVP Plan

**Pitch:** Put money on your goals. Stake SOL on a promise ("gym 4x this week"). Prove it with a photo. AI judges the proof. Keep your word, get your SOL back. Break it, your SOL goes to the friend you named.

**Why:** Commitment contracts work (loss aversion), but existing apps hold your money and judge you by hand. Here the stake, the verdict and the payout are all public on Solana, and an AI judge removes the human bottleneck.

**Tracks:** AI (Gemini vision judges proof), DeFi (escrow + stake + payout), Gaming (streaks, public wall of shame/fame), Top 3 Overall.

## Flow

1. Connect Phantom (devnet).
2. Create goal: text, deadline, stake amount, beneficiary wallet.
3. Stake: Phantom signs one tx = `SystemProgram.transfer` to escrow wallet + Memo `{"g":goal,"d":deadline,"b":beneficiary}`.
4. Prove: upload photo. `/api/judge` sends goal text + photo to Gemini vision; returns `{pass, reason, confidence}`.
5. Settle (server, escrow key): pass = refund to staker; fail or past deadline = pay beneficiary. Settlement tx carries Memo `{"stake":<stake sig>,"verdict":...,"reason":...}`.
6. Wall: list of goals and verdicts read from escrow wallet history, with explorer links.

## Design choice: chain is the database

No DB. A goal is its stake transaction. The server reads the stake tx from devnet to get amount, staker, goal, deadline and beneficiary, so the client cannot lie about them. Before settling, the server scans escrow history for a settlement memo with the same stake sig to block double payouts.

## Stack

- Vite + vanilla JS, `@solana/web3.js`, Phantom via `window.phantom.solana`.
- Vercel functions: `api/judge.js` (verify stake tx, Gemini vision, settle).
- Env: `GEMINI_API_KEY`, `ESCROW_SECRET_KEY` (devnet only).

## Shortcut (disclosed)

Escrow is a server-held devnet keypair, not an on-chain program (no Rust toolchain, 8 hours). Upgrade path: Anchor escrow program with an oracle-signed verdict.

## Skipped

Real escrow program, mainnet, accounts/login, cron for automatic deadline payouts (settle on next visit instead), multiple proofs per goal.

## Stages (one commit each)

1. Scaffold Vite app + Vercel function stub
2. Phantom connect + stake tx with Memo
3. `api/judge`: verify stake tx on-chain + Gemini vision verdict
4. Settlement payout + double-settle guard (+ small test)
5. Wall of fame/shame + UI polish
6. Deploy to Vercel, README, demo-video script
