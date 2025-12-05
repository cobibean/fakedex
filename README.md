### built by @cobi_bean
# FakeDEX – Powered by FAKEUSD

**Backed by nothing, trusted by everyone.**

FakeDEX is a meme-native DEX playground that lets users swap theatrical joke tokens against FAKEUSD while competing for achievements, XP, and leaderboard clout. The experience layers a living dashboard, detailed pair terminal, and personalized profile against a realtime Supabase backend plus on-chain faucets for testing.

## Architecture at a Glance

- **Next.js 16 (App Router)** hosts the UI, resizable dashboards, pair terminals, and profile pages served from `app/`. Components such as `PairList`, `Chart`, `OrderFeed`, `TradePanel`, and `VicPanel` hook into shared data via custom hooks.
- **Supabase Postgres + Realtime** powers the `pairs`, `candles`, `trades`, `user_balances`, and social tables. Edge functions (`supabase/functions/aggregate-candles`) plus pg_cron keep long-term candle history tidy.
- **Chaos Engine** (`lib/chaosEngine.ts`, `hooks/useChaosEngine.ts`) simulates candles, bot trades, XP, and achievements when real data is unavailable.
- **Smart contracts** (tFAKEUSD + FakeDexEscrow) on Sepolia mint FAKEUSD tokens, funnel faucet claims/deposits into a trading escrow, and rely on a backend withdrawal signer.
- **Backend API** (`app/api/withdraw/sign/route.ts`) validates Supabase balances/withdrawal limits, signs withdrawals with a secure backend key, and feeds the escrow contract.

## Features

- Global dashboard with resizable pair list, lush chart, positions feed, XP, chaos meter, and notification toast system.

- Dedicated terminal per symbol that exposes deep diagnostics, liquidity depth, and trading controls.

- Profile pages featuring statistics, positions, trade history, achievements, and a comment wall.

- Real-time Supabase syncing + bot-generated activity that keeps the world feeling alive even when testnet liquidity is thin.

- Hardhat + Thirdweb tooling for mintable fake USD and a backend escrow guarded by owner-only rate limits/signatures.

## Getting Started

### Prerequisites

- **Node.js 20+** and `npm`.
- **Supabase project** with Postgres DB, Realtime enabled, Edge functions, and at least one service role key.
- **Thirdweb account** for `NEXT_PUBLIC_THIRDWEB_CLIENT_ID`.
- **Hardhat & ethers** for compiling/deploying `contracts/`.
- **Sepolia wallet** for funding deployments and testing signatures.

### Environment Variables

Create a `.env.local` file with the values below (replace placeholders with your actual secrets):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL of your Supabase project. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key for client queries. |
| `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` | Thirdweb client ID used by hooks. |
| `NEXT_PUBLIC_TFAKEUSD_ADDRESS` | Deployed tFAKEUSD contract address. |
| `NEXT_PUBLIC_ESCROW_ADDRESS` | Deployed FakeDexEscrow address. |
| `BACKEND_SIGNER_PRIVATE_KEY` | Private key used by `app/api/withdraw/sign` to authorize withdrawals. Keep it offline. |
| `BACKEND_SIGNER_ADDRESS` | Optional override when deploying the escrow contract; defaults to the deployer. |
| `SUPABASE_SERVICE_KEY` | Needed for Edge function cron/webhooks (do not expose in frontend). |

### Install & Run

```bash
npm install
npm run dev
```

Run `npm run lint` before landing changes, and `npm run build` to verify production readiness.

## Supabase Backend Setup

1. Run `supabase/schema.sql` in Supabase SQL Editor to create `users`, `pairs`, `candles`, `trades`, `achievements`, and supporting tables.
2. Deploy `supabase/functions/aggregate-candles/index.ts` via Supabase CLI (`supabase functions deploy aggregate-candles`) or the dashboard. This function aggregates 1-second candles into 1m–1d buckets for long-term charts.
3. After deploying the function, run `supabase/cron_setup.sql` (or follow `supabase/DEPLOYMENT_GUIDE.md`) to schedule pg_cron jobs that call the aggregator every minute.
4. Keep `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_KEY` updated when configuring cron jobs or backend scripts.

## Smart Contracts & On-Chain Flow

- `contracts/tFAKEUSD.sol`: Mintable ERC-20 with 24-hour cooldown for public minters and unlimited minting for whitelisted addresses.
  - Deploy with `npx hardhat run scripts/deploy.ts --network sepolia`. Use `INITIAL_WHITELIST_ADDRESSES` to seed extra privileged minters.
- `contracts/FakeDexEscrow.sol`: Escrow mints faucet claims, accepts deposits, and processes withdrawals when a backend signer approves amount/nonce/chainid.
  - Deploy via `npx hardhat run scripts/deployEscrow.ts --network sepolia`. Provide `NEXT_PUBLIC_TFAKEUSD_ADDRESS` and optional `BACKEND_SIGNER_ADDRESS`.
  - The script logs `NEXT_PUBLIC_ESCROW_ADDRESS` and notes whether whitelisting succeeded; if it fails, call `tFAKEUSD.setWhitelist` manually with the escrow address.
- `lib/contracts.ts` centralizes the Sepolia chain ID, contract addresses, and minimal ABIs used by hooks.
- Ensure `BACKEND_SIGNER_PRIVATE_KEY` only lives on the server (or in a secure secret manager). `app/api/withdraw/sign` rejects malformed signatures, enforces user balance lookups in Supabase, and writes full-chain data back to the response.

## Frontend Experience

- `app/page.tsx`: Global dashboard pulling from `hooks/usePairs`, `usePositions`, `useXP`, `useBotTrades`, and `useChaosEngine`.
- `app/pair/[symbol]/page.tsx`: Terminal view with `VicPanel`, `DepthPanel`, `OrderFeed`, and reuse of the Chart/TradePanel stack.
- `app/profile/[username]/page.tsx`: Profile header, stats, achievements, trades, and comments tied to Supabase `users`, `user_achievements`, and `positions` tables.
- Reusable UI lives inside `components/` (`trading`, `dashboard`, `profile`, `xp`) while hooks (`usePairs`, `usePositions`, `useXP`, `useChaosEngine`) encapsulate data fetching and realtime behavior.
- `lib/mockData.ts` or the chaos engine ensures the UI stays alive even when Supabase is partially configured.

## Testing & Tooling

- `npm run lint` (powered by ESLint + Next default rules).
- `npx hardhat test` (if you add Solidity tests).
- `npx hardhat coverage` / `npx hardhat gas-report` can be configured later (not wired yet).
- Use `npx hardhat run scripts/deploy.ts` / `scripts/deployEscrow.ts` for repeatable deployments.

## Security Notes

- **Backend signer secrecy**: Never commit `BACKEND_SIGNER_PRIVATE_KEY` or service keys. Rotate them if you suspect leakage.
- **Supabase service role key**: Only use server-side (cron, Edge functions). Keep it out of browser bundles.
- **Limits**: `FakeDexEscrow` defaults to zero withdrawal limits (i.e., unlimited) but exposes `setWithdrawalLimits`/`setFaucetSettings` for tightening. Use those before opening the backend to the public.
- **Observation**: All minted payouts come from `FakeDexEscrow`. Make sure the escrow address stays whitelisted in `tFAKEUSD`.

## Contributing

1. Fork the repo, create a topic branch, and keep commits focused.
2. Update the README/docs when adding features, config, or architecture changes.
3. Run `npm run lint` and any Hardhat commands relevant to your change.
4. Open a PR describing the change, testing performed, and any manual rollout steps.
5. Tag maintainers for reviews. Be explicit about Supabase migrations, contract deployments, and secret management.

## References

- Architecture notes: `plan.md`, `prd.md`
- Supabase deployment: `supabase/DEPLOYMENT_GUIDE.md`, `supabase/schema.sql`, `supabase/cron_setup.sql`
- Contracts & deployment scripts: `contracts/`, `scripts/`
- Backend APIs: `app/api/withdraw/sign/route.ts`
