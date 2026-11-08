# MLH Solana Hackathon — Research

Source: https://www.mlh.com/events/solana-hackathon (fetched 2026-11-08) and its Top 3 Overall challenge page.

## Key facts

- Format: online ("Digital", "Everywhere, Worldwide").
- Dates: Fri Nov 6, 12:00 PM EST – Sun Nov 8, 1:00 PM EST.
- **Deadline: Nov 8, 1:00 PM EST = 11:30 PM IST.** At research time (2:32 PM IST) about 9 hours remained.
- Submissions shown: 79.
- Submit at https://www.mlh.com/events/solana-hackathon/submissions/new
- "One submission can enter every category it qualifies for." — so one project should target several tracks.

## Prizes (all "Event prize", no sponsors listed)

| Category | Prize | Criteria (verbatim) |
|---|---|---|
| Top 3 Overall | $1,000 microgrant per team (3 teams) | "strongest teams to continue building" |
| AI Track | $100 gift card per member | "Best use of AI in a project" |
| DeFi Track | $100 gift card per member | "Best DeFi related project" |
| Gaming Track | $100 gift card per member | "Best gaming related project" |
| Best Beginner Hack | $100 gift card per member | "Best project created by Hackathon Beginners" |

## Not published

No judging rubric, team-size rule, new-code rule, demo-video rule, or devnet/mainnet requirement on the page. The submission form may require more (it is login-gated, not read).

## Local toolchain

Node v24, git, gh present. **No Solana CLI, no Anchor.** Installing Rust + Anchor on Windows eats hours, so the MVP should be client-side (`@solana/web3.js` + Phantom on devnet) with no custom on-chain program.

## Strategy

- Stack AI + DeFi (+ Beginner if eligible) in one project; Top 3 is the real prize.
- Use existing programs (System, SPL Token, Memo) instead of writing Rust.
- A live, clickable demo and short video beat feature count.
