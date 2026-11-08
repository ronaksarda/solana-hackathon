# SignSafe — MVP Plan

**Pitch:** Know what you sign. SignSafe explains any Solana transaction in plain English and flags wallet drainers before you approve it in Phantom.

**Why:** Wallet drainers trick users into "blind signing" — the wallet popup shows bytes, not intent. SignSafe puts a readable, risk-rated explanation in front of the user.

**Tracks:** AI (Gemini explains + parses intent), DeFi (safe transfers, token approvals), Top 3 Overall.

## Features (MVP only)

1. **Explain** — paste a transaction signature (devnet or mainnet) or a base64 unsigned transaction. App decodes the instructions with `@solana/web3.js`.
2. **Rule flags** (deterministic, no AI): SPL `Approve` to unknown delegate, `SetAuthority`, `CloseAccount`, transfer of most of the balance, unknown program IDs. Gives a green / yellow / red score.
3. **AI summary** — decoded instructions + flags go to Gemini; it returns a plain-English explanation.
4. **Intent to transaction** — user types "send 0.1 SOL to <address>". Gemini returns JSON; app builds a devnet `SystemProgram.transfer`, runs it through Explain, then Phantom signs. Shows explorer link.
5. **Demo drainer** — one button builds a malicious-looking sample transaction so judges see a red flag live.

## Stack

- Vite + vanilla JS, `@solana/web3.js`, `@solana/spl-token`.
- Phantom through `window.phantom.solana` (no wallet-adapter).
- One Vercel serverless function `api/explain.js` calls Gemini; key stays server-side in `GEMINI_API_KEY`.
- Devnet for all signing.

## Skipped

Custom on-chain program, browser extension, multi-wallet support, accounts/login, history.

## Stages (one commit each)

1. Scaffold Vite app + Vercel function stub
2. Transaction decoder + rule flags (+ small test)
3. Gemini explain route
4. Intent to transaction + Phantom sign
5. Demo drainer + UI polish
6. Deploy to Vercel, README, demo-video script
