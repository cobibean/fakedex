# FakeDEX Implementation Plan (V1)

## Executive Summary
FakeDEX is a satirical, high-fidelity simulation of a decentralized exchange where users trade meme tokens against "FAKEUSD". While the underlying financial engine is a "chaos simulation" rather than real on-chain liquidity, the user experience mimics a top-tier professional DEX. The app features a "Chaos Engine" that drives price action, a gamified XP/Achievement system, and a "Vic the Llama" mascot. The goal is to build a "degen-themed" playground that feels expensive and responsive, leveraging Next.js for the frontend, Supabase for persistence/state, and thirdweb for Web3 interfaces.

---

## Phase 1: Foundation, Data Layer & Shell
**Goal:** Initialize the project, establishing the "pro-DEX" visual shell, authentication model, and the data persistence layer. By the end of this phase, the app will look like a DEX, include Vic the Llama's presence, and have a ready-to-use backend.

### Technical Tasks
1.  **Initialize Project:**
    *   Setup Next.js 14+ (App Router) with TypeScript.
    *   Install core dependencies: `tailwindcss`, `clsx`, `tailwind-merge`, `lucide-react` (icons), `framer-motion` (animations), `@thirdweb-dev/react` (or v5 `thirdweb` if preferred, adhering to v4 hooks where applicable), `ethers`.
    *   Initialize `supabase` client.
2.  **Folder Structure:**
    *   Create the exact directory structure outlined in the requirements (`app/`, `components/`, `hooks/`, `lib/`, `supabase/`, `styles/`).
3.  **Database Setup:**
    *   Create `supabase/schema.sql` with the provided SQL schema (see Appendix A).
    *   Execute schema in Supabase to create `users`, `user_balances`, `pairs`, `trades`, `achievements`, `user_achievements`, `settings` tables.
    *   **Seed Data:** Insert initial meme tickers (`$SHIT`, `$HODL`, `$DEGEN`, `$RUG`, `$COPE`, `$WAGMI`) into `pairs` and initial achievements (`PREMATURE_EXIT`, `SIZE_MATTERS`, `DIAMOND_HANDS`, etc.) into `achievements` matching the PRD lore.
    *   **Action:** Configure `lib/supabaseClient.ts`.
4.  **Auth & Identity Model:**
    *   **Decision:** Use **Wallet Address** as the primary User ID.
    *   When a user connects via thirdweb, check `users` table for their address. If missing, create a new row.
    *   If not connected, they view the site in "Guest Mode" (read-only or local simulation).
5.  **Layout Implementation:**
    *   Implement `app/layout.tsx` with a global dark-mode "degen" theme.
    *   Build `components/layout/Shell.tsx`, `Header.tsx` (with "Connect Wallet"), and `Sidebar.tsx`.
    *   **Vic Integration:** Add a static "Vic the Llama" avatar to the Header or a "Vic Says" tip box in the sidebar to ensure he is present from V1.

### UI/UX Deliverables
*   **App Shell:** A responsive, persistent layout with a sidebar for navigation and a header for user status.
*   **Vic's Presence:** Vic appears in the UI (e.g., a small avatar or tip box).
*   **Theme:** Global CSS variables set up for the FakeDEX color palette.
*   **Landing:** `app/page.tsx` renders the basic grid layout (Sidebar, Chart Area, Trade Panel placeholders).

### Interaction Deliverables
*   Navigation between the main dashboard route `/` and a placeholder `/profile` route.
*   **Connect Wallet:** Clicking the button triggers the thirdweb modal; upon connection, the user is authenticated in Supabase (visible in local storage/console).

### Review Checkpoint
*   Open the app at `localhost:3000`.
*   Connect a wallet (or use a test one) and verify a user row appears in Supabase `users` keyed to that address.
*   Verify Vic is visible on the screen.
*   Check Supabase dashboard to confirm seeded `pairs` and `achievements` exist.

---

## Phase 2: The Chaos Engine, Faucet & Market Data
**Goal:** Bring the DEX to life with simulated market data and allow users to claim their initial FAKEUSD.

### Technical Tasks
1.  **Chaos Engine Core (Price Series):**
    *   Implement `lib/chaosEngine.ts` to generate realistic-looking OHLCV candle data.
    *   **Override Logic:** Ensure the engine checks `pairs.chaos_override` first; if null, fall back to `settings.global_chaos_level`.
    *   Implement `hooks/useChaosEngine.ts` to stream/interval-fetch price updates for the active pair.
2.  **Bot Trade Simulation (Independent):**
    *   Create a background effect or "Bot Worker" that periodically generates fake trades (independent of the price series candles) and inserts them into the `trades` table.
    *   These trades should feed into the Order Feed to make the market look active even when the user is idle.
3.  **Faucet Module:**
    *   Implement `components/dashboard/FaucetPanel.tsx`.
    *   Add backend logic (Supabase RPC or simple API handler) to check `last_faucet_claim_at` (add this column to `users` if not in schema, or use a separate table).
    *   Logic: Claim 1000 FAKEUSD once per 24h. If "out" (not really possible), mint more.
4.  **Visualization:**
    *   Implement `components/trading/PairList.tsx` to display tickers.
    *   Implement `components/trading/Chart.tsx` (using `lightweight-charts`).
    *   Implement `components/trading/OrderFeed.tsx` to subscribe to `trades` (showing both Bot and User trades).

### UI/UX Deliverables
*   **Faucet Panel:** A prominent UI element on the dashboard to "Claim Daily FAKEUSD".
*   **Live Chart:** The main chart displays candles updating in real-time based on the Chaos Engine.
*   **Active Order Tape:** The Order Feed updates with "Bot" trades automatically.
*   **Chaos Indicator:** Visual element showing "Global Chaos" level (and "Pair Override" if applicable).

### Interaction Deliverables
*   Click **"Claim FAKEUSD"** -> Toast "Received 1000 FAKEUSD" -> Balance updates.
*   Watch the chart and tape move without user intervention.

### Review Checkpoint
*   Verify you can claim FAKEUSD only once.
*   Verify bot trades are appearing in the feed automatically.
*   Check that different pairs show different price actions if overrides are set in Supabase.

---

## Phase 3: The Trading Interface (Hooks & Execution)
**Goal:** Enable the user to "trade" using thirdweb hooks (stubbed). This phase completes the "One-Page dApp" layout functionality.

### Technical Tasks
1.  **Contract Hooks (Stubbed):**
    *   Create `hooks/useFakeDexContracts.ts`.
    *   **Verification Note:** When implementing, cross-check API/hook names against **thirdweb documentation via DeepWiki** to ensure the mocked interface matches the real v4/v5 SDK surface.
    *   Implement:
        *   `useFakeUsdContract`
        *   `useFakeDexRouterContract`
        *   `useFakeDexSwapPreview`
        *   `useFakeDexSwap`
2.  **Trade UI:**
    *   Build `components/trading/TradePanel.tsx` with:
        *   Amount Input, Leverage Slider (1x-100x), Long/Short Buttons.
        *   Real-time "Preview" block.
3.  **Execution Logic:**
    *   Wire `useFakeDexSwap` to:
        1.  Insert record into `trades`.
        2.  Update `user_balances` (atomic db transaction or optimistic update).
        3.  Trigger success toast.
4.  **Dashboard Completeness:**
    *   Assemble the **full dashboard**: Sidebar (Pairs), Center (Chart + Order Feed), Right (Trade Panel + Faucet + Chaos + XP + Achievements Teaser).

### UI/UX Deliverables
*   **Functional Trade Widget:** Users can input amounts and execute trades.
*   **Complete Dashboard:** The screen matches the PRD's "Main One-Page FakeDEX" description.
*   **Feedback:** Transaction toasts (Pending -> Success).

### Interaction Deliverables
*   Enter "100 FAKEUSD" -> Click Swap -> See trade in Order Feed.
*   See local balance decrease and "Token" balance increase.

### Review Checkpoint
*   Execute a trade and verify the `trades` table row.
*   Verify the dashboard feels "complete" with all panels present and responsive.

---

## Phase 4: Gamification (XP, Profile & Achievements)
**Goal:** Add the "sticky" layer. Users level up and unlock achievements.

### Technical Tasks
1.  **User Context:**
    *   Implement `hooks/useXP.ts` to fetch Level/XP.
2.  **Profile Page:**
    *   Implement `app/profile/[username]/page.tsx`.
    *   Build `components/xp/AchievementsGrid.tsx` showing seeded achievements (e.g., `DIAMOND_HANDS` badge).
3.  **Achievement Logic:**
    *   Implement trigger checks (e.g., after a trade or on page load):
        *   `PAPER_HANDS`: Closed profitable trade < 1% gain?
        *   `SIZE_MATTERS`: Leverage > 10x?
    *   Award XP and insert into `user_achievements`.
4.  **Notifications:**
    *   "Achievement Unlocked" overlay with Vic commentary.

### UI/UX Deliverables
*   **XP Bar:** Visible on dashboard.
*   **Profile View:** Shows stats and badges.

### Interaction Deliverables
*   Visit `/profile/me`.
*   Perform a specific action (e.g., 10x leverage) to unlock a badge and see the popup.

### Review Checkpoint
*   Confirm `user_achievements` table populates.
*   Verify XP progress bar updates.

---

## Phase 5: Polish, Terminal View & Vic's Wisdom
**Goal:** Finalize V1 with the "Terminal" view and high-end polish.

### Technical Tasks
1.  **Terminal Route:**
    *   Implement `app/pair/[symbol]/page.tsx`.
    *   **Chaos Display:** Explicitly show "Chaos Level: X (Global)" or "Chaos Level: Y (Override active!)".
2.  **Vic Integration:**
    *   Expand `ChaosIndicator` with dynamic "Vic Says" commentary based on market moves.
3.  **Refinement:**
    *   Framer Motion transitions, glassmorphism, mobile responsiveness.

### UI/UX Deliverables
*   **Terminal Mode:** Full-screen trading view.
*   **Visual Polish:** Professional DeFi aesthetic.

### Interaction Deliverables
*   Navigate to `/pair/SHIT`.
*   Observe Vic's commentary changing with chaos levels.

### Review Checkpoint
*   Compare against "top-tier DeFi" standard.
*   Verify Chaos Override display in Terminal view.

---

## Tech Stack & Timeline Notes

*   **Folder Structure:** Created in **Phase 1**.
*   **Supabase Schema:** Applied in **Phase 1**.
*   **Auth (Wallet):** Implemented in **Phase 1**.
*   **Seed Data:** Inserted in **Phase 1**.
*   **Chaos/Bots:** Implemented in **Phase 2**.
*   **Faucet:** Implemented in **Phase 2**.
*   **Thirdweb Hooks:** Created in **Phase 3** (verified via DeepWiki).
*   **Route Availability:**
    *   `/` (Main): Phase 1 (Skeleton) -> Phase 3 (Complete).
    *   `/profile/[username]`: Phase 4.
    *   `/pair/[symbol]`: Phase 5.

## Appendix A: Supabase Schema (V1)

```sql
-- Enable UUID generation
create extension if not exists "pgcrypto";

create table public.users (
  id uuid primary key default gen_random_uuid(),
  username text unique, -- Can be derived from wallet address or set by user
  wallet_address text unique, -- Primary identity key for V1
  created_at timestamptz not null default now(),
  xp integer not null default 0,
  level integer not null default 1,
  avatar text,
  last_login_at timestamptz,
  last_faucet_claim_at timestamptz -- Added for Faucet Logic
);

create table public.user_balances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  symbol text not null,
  amount numeric(38, 18) not null default 0,
  unique (user_id, symbol)
);

create table public.pairs (
  symbol text primary key,
  name text not null,
  description text,
  chaos_override integer,
  initial_price numeric(38, 18) not null
);

create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null, -- Null for bot trades
  is_bot boolean default false, -- Explicitly mark bot trades
  symbol text not null references public.pairs(symbol),
  side text not null check (side in ('buy','sell')),
  size_fakeusd numeric(38, 18) not null,
  price numeric(38, 18) not null,
  leverage integer not null default 1,
  created_at timestamptz not null default now()
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text not null,
  nsfw_flag boolean not null default false
);

create table public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  achievement_id uuid not null references public.achievements(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (user_id, achievement_id)
);

create table public.settings (
  key text primary key,
  value jsonb not null
);
```
