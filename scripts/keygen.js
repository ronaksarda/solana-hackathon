// Creates a devnet escrow keypair and appends it to .env.local (gitignored).
import { Keypair } from '@solana/web3.js';
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

if (existsSync('.env.local') && readFileSync('.env.local', 'utf8').includes('ESCROW_SECRET_KEY')) {
  console.log('ESCROW_SECRET_KEY already in .env.local, not overwriting.');
  process.exit(0);
}
const kp = Keypair.generate();
appendFileSync('.env.local', `ESCROW_SECRET_KEY=${JSON.stringify(Array.from(kp.secretKey))}\n`);
console.log('Escrow address (fund it at https://faucet.solana.com, devnet):', kp.publicKey.toBase58());
