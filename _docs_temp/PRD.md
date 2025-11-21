# FakeDEX – Powered by FAKEUSD  
_Backed by nothing, trusted by everyone._

## 1. Overview

FakeDEX is a one-page, meme-native DEX simulation where users trade ridiculous meme pairs against **FAKEUSD**, a satirical “stablecoin” that parodies the modern US dollar (unbacked, overprinted, and somehow still trusted).  

The app *feels* like a real DEX (real routing, charts, pairs, accounts, XP, achievements), but all markets are synthetic and controlled by our “chaos engine” + trading bots.

### High-Level Goals

- One-page dApp with:
  - Global trading view
  - Meme pair list
  - XP + achievements
- Route `/pair/[symbol]` for a **full-screen terminal-style view** of a specific pair.
- Realistic-feeling swap UX built on **thirdweb contract interfaces + hooks** (initially stubbed so wiring real contracts later is mostly mechanical).
- Simple **Supabase** backend so “fake accounts” + XP/achievements persist from day one.
- Global “chaos level” for price action with **optional per-pair overrides**.

---

## 2. Lore / Theme

- **FAKEUSD**: Born after the dollar abandoned the gold standard and entered its final form: _pure narrative_.  
- **Vic the Llama**: Exiled economist and meme theorist, now acting as FakeDEX’s degenerate central banker and casino boss.
- Motto: **“Backed by nothing, trusted by everyone.”**

Tone: crypto degen, self-aware, internet-poisoned, slightly NSFW but still playable in public.

---

## 3. Tech Stack

### Frontend

- React / Next.js (preferred) + TypeScript
- Styling: Tailwind or similar utility framework
- thirdweb SDK for web3 integration:
  - Use **contract interfaces + hooks** from:
    - `thirdweb-dev/js`
    - `thirdweb-dev/contracts`
  - For v1, on-chain calls can be **stubbed** / mocked; the API surface should match what we’d use for real swaps later.

### Backend

- **Supabase** from day one:
  - Persist fake accounts, XP, achievements, per-pair chaos overrides, and session data.
  - Use `.env` for:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY` (secret, server-side only).

### Data / Simulation

- **Chaos Engine**:
  - Global chaos level (0–100) controls volatility + “wonkiness”.
  - Optional per-pair `chaos_override`; if `null`, default to global.
  - Randomized but **up-only-biased** drift over time.
  - Bots simulate trades to drive candles, volume, and order history.

---

## 4. Routes / Views

### `/` – Main One-Page FakeDEX

Primary layout:

- **Left / Sidebar: Meme Pair List**
  - Scrollable list of all listed meme pairs (name, ticker, 24h % change, fake volume).
  - Clicking a pair updates the main chart + trading widget.
- **Center: Chart + Order Flow**
  - Candlestick chart (synthetic data from chaos engine).
  - Order feed / “tape” of recent fake trades (bot + user).
- **Right: Quick Trade Panel**
  - Swap widget: FAKEUSD ↔ Meme token
  - Leverage selector (e.g. 1x / 3x / 5x / 10x).
  - Trade preview with PnL impact, liquid-ish price, etc.

Secondary panels on the same page (accordion / tabs):

- **XP & Achievements**
  - Shows level, current XP progress bar, recent achievements.
- **Account Summary**
  - Fake balance of FAKEUSD + meme tokens.
  - Position summary (open “positions” derived from swaps).
- **Global Chaos / Market Mood**
  - Display current global chaos level.
  - Short description from Vic (“Market is absolutely cooked.”).

### `/pair/[symbol]` – Terminal View

More immersive, full-screen trading terminal for a specific pair.

- Big chart, depth-ish visualization, expanded fake order history.
- Advanced controls:
  - Full leverage slider
  - Limit / market style toggles (still all simulated).
  - Per-pair chaos level display (show override vs global).
- Extra flavor:
  - Vic the Llama commentary panel (contextual messages based on volatility, user results, etc).

### `/profile/[username]` (optional v1, but design for it)

- Shows:
  - User handle / avatar
  - XP, level, badges
  - Lifetime PnL (fake), biggest win, biggest rug
  - Achievement grid

---

## 5. Supabase Data Model (v1)

Tables (initial draft):

- `users`
  - `id` (uuid, PK)
  - `username` (text, unique)
  - `created_at` (timestamp)
  - `xp` (integer, default 0)
  - `level` (integer, default 1)
  - `avatar` (text, optional)
  - `last_login_at` (timestamp)

- `user_balances`
  - `id` (uuid, PK)
  - `user_id` (uuid, FK → users.id)
  - `symbol` (text) – token ticker (e.g. `SHIT`, `HODL`)
  - `amount` (numeric)

- `trades`
  - `id` (uuid, PK)
  - `user_id` (uuid, FK)
  - `symbol` (text)
  - `side` (enum: `buy` / `sell`)
  - `size_fakeusd` (numeric)
  - `price` (numeric)
  - `leverage` (int)
  - `created_at` (timestamp)

- `achievements`
  - `id` (uuid, PK)
  - `code` (text, unique)
  - `name` (text)
  - `description` (text)
  - `nsfw_flag` (boolean, default false)

- `user_achievements`
  - `id` (uuid, PK)
  - `user_id` (uuid, FK)
  - `achievement_id` (uuid, FK)
  - `earned_at` (timestamp)

- `pairs`
  - `symbol` (text, PK) – e.g. `SHIT`
  - `name` (text)
  - `description` (text)
  - `chaos_override` (int, nullable) – 0–100; if null, use global.
  - `initial_price` (numeric)

- `settings`
  - `key` (text, PK)
  - `value` (jsonb)
  - Example: `{ key: "global_chaos_level", value: { level: 60 } }`

---

## 6. Chaos Engine & Price Simulation

- Global `chaos_level`:
  - Controls:
    - Candle wick length
    - Intra-candle noise
    - Frequency of random “spikes”
  - Higher chaos = more volatility, more absurd wicks, but same long-term up-bias.

- Per-Pair Override:
  - If `pairs.chaos_override` is set, use that instead of global.
  - Otherwise, pair inherits global chaos level.

- Bot Behavior:
  - Background bots generate:
    - Random trades with realistic-ish sizes
    - Bursts of activity based on chaos level
  - Bots can be tuned per pair later.

Implementation detail for phase 1:  
- Simulated price series can be generated on the fly in the client or via a simple server endpoint.
- Data should be structured like standard OHLCV for chart libraries.

---

## 7. XP & Achievements

### XP System

- Actions that grant XP:
  - First trade
  - Daily login
  - Number of trades per day
  - Size of leveraged trades
  - Surviving high chaos periods (e.g. trading while chaos > 80)

- Leveling curve:
  - Simple exponential or linear for v1 (e.g. `100 XP * level`).

### Achievement Concepts (Crypto-bro Native, some low-key NSFW)

Examples (codes + triggers, can be extended):

- `DIAMOND_HANDS`
  - **Name:** Diamond Hands  
  - **Trigger:** Hold a losing position through a -69% drawdown.

- `PAPER_HANDS`
  - **Name:** Paper Hands  
  - **Trigger:** Close a winning trade for <1% profit.

- `SIZE_MATTERS`
  - **Name:** Size Matters  
  - **Trigger:** Open your first 10x leveraged trade.

- `PREMATURE_EXIT`
  - **Name:** Premature Exit  
  - **Trigger:** Close a trade within 10 seconds of opening it.

- `RUG_SURVIVOR`
  - **Name:** Rug Survivor  
  - **Trigger:** Trade a pair during a chaos spike > 90.

- `BAGHOLDER_DELUXE`
  - **Name:** Bagholder Deluxe  
  - **Trigger:** Hold the same red position for 7 consecutive days.

- `COPE_MAXXED`
  - **Name:** Cope Maxxed  
  - **Trigger:** Log in 7 days in a row without a single green day.

- `ONLY_CHARTS`
  - **Name:** Only Charts  
  - **Trigger:** Spend >60 minutes total staring at charts (page focused).

- `DEGEN_OF_THE_DAY`
  - **Name:** Degen of the Day  
  - **Trigger:** Highest volume traded in the last 24h.

NSFW-ish ones should stay tongue-in-cheek, text-only, no explicit imagery.

---

## 8. Initial Ridiculous Tickers

Starting roster (all paired vs FAKEUSD):

- **$SHIT** – “Sovereign Hedge Inflation Token”
- **$HODL** – Token that only goes up if you don’t sell (narratively).
- **$DEGEN** – Volume magnet, used for the wildest chaos level.
- **$RUG** – Spikes insanely, then “almost” rugs but recovers.
- **$COPE** – Bleeds slowly, great for bagholder achievements.
- **$WAGMI** – Up-only bias cranked even more.
- **$REKT** – Flash crashes and bounces.
- **$MOON** – Long, slow grind with occasional massive green candles.
- **$FOMO** – Pumps right after a user closes their position.
- **$BROKE** – Cheap, million-unit bags, perfect for “I’m early” cope.

These can all live in the `pairs` table as seeded data.

---

## 9. Thirdweb Repos (for DeepWiki MCP)

These are the main thirdweb repos the agent can search via DeepWiki during planning & debugging:

- `thirdweb-dev / contracts` – Collection of smart contracts deployable via thirdweb.
- `thirdweb-dev / js` – Web3 SDKs for browser, Node, and mobile apps.
- `thirdweb-example / account-abstraction`
- `thirdweb-dev / seaport-eip1271`
- `thirdweb-dev / examples`
- `thirdweb-dev / engine`
- `thirdweb-example / marketplace-v3`
- `thirdweb-dev / engine-core`
- `thirdweb-example / token-clicker`
- `thirdweb-dev / x402.chat`

Initial implementation should:

- Define **contract interfaces** and **thirdweb hooks** (e.g., `useFakeDexRouter`, `usePairData`, `useFakeUsdBalance`) with correct method signatures.
- For now, back them with mock/simulated data so swapping feels real, and later we just swap in real contract addresses + RPC calls.

---

## 10. Non-Goals (v1)

- No real token swaps or custody of user funds.
- No real leverage / liquidation logic beyond simulated numbers.
- No actual on-chain deployment required for first iteration (can be added later using the same contract interfaces).

