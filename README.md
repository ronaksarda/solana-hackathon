# Skin in the Game

**Put money on your word.** Stake SOL on a goal. Prove it with a photo. An AI referee decides. Keep your promise and get your SOL back. Break it, and your SOL goes to the friend you named. Every stake and every verdict lives on Solana.

Built for the [MLH Solana Hackathon](https://www.mlh.com/events/solana-hackathon). Tracks: AI, DeFi, Gaming. Demo plan: [docs/demo-script.md](docs/demo-script.md).

## Why

Commitment contracts work: people try harder when losing money is on the line. But existing apps hold your money privately and judge your proof by hand. Skin in the Game makes the stake, the verdict and the payout public on Solana, and an AI referee removes the human bottleneck.

## How it works

1. **Stake.** You sign one transaction in Phantom: a SOL transfer to the escrow wallet plus a Memo instruction holding the goal, deadline and friend's address.
2. **Prove.** Upload a photo. The server reads your stake transaction straight from devnet (the client cannot lie about amount, goal or deadline) and asks Gemini vision whether the photo proves the goal. A rejected photo is not a forfeit; you can retry until the deadline.
3. **Settle.** Pass: escrow refunds you. Deadline missed: anyone can press "Pay the friend" and escrow pays your friend. The payout transaction carries a Memo with the verdict and the referee's reason.
4. **Wall of fame and shame.** Built entirely from the escrow wallet's on-chain history.

### The chain is the database

There is no database. A goal *is* its stake transaction. A verdict *is* its payout transaction. The server rebuilds everything from memos, and it only trusts a settlement memo if the escrow wallet signed it, so nobody can fake an "already settled" record to block a payout.

## Run locally

```bash
npm install
npm run keygen          # creates a devnet escrow key in .env.local and prints its address
```

Add your Gemini key to `.env.local`:

```
GEMINI_API_KEY=your-key
# optional: GEMINI_MODEL=gemini-2.5-flash, SOLANA_RPC=https://api.devnet.solana.com
```

Fund the escrow address with devnet SOL at https://faucet.solana.com (it pays payout fees), then:

```bash
npm run dev             # http://localhost:5173, serves api/*.js too
npm test
```

You need Phantom with some devnet SOL. The app signs in Phantom but sends through a devnet RPC, so Phantom's network setting does not matter.

## Deploy (Vercel)

Import the repo in Vercel (Vite is auto-detected, `api/` becomes serverless functions). Set `GEMINI_API_KEY` and `ESCROW_SECRET_KEY` (copy from `.env.local`) as environment variables.

## Honest limits

- **Escrow is a server-held devnet keypair**, not an on-chain program. You trust the server to pay out. Next step: an Anchor escrow program where the AI verdict is an oracle-signed instruction.
- Two simultaneous settle requests for the same goal could both pay. The on-chain program fixes this too.
- The AI referee can be wrong. It must be at least 70% confident to pass, and it is told to ignore text inside photos.
- The wall reads the newest 200 escrow transactions.

## Stack

Vite, vanilla JS, `@solana/web3.js`, Phantom, System and Memo programs, Gemini vision, Vercel functions.
