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

-- Candle history for persistent charts (all users see same chart)
create table public.candles (
  id uuid primary key default gen_random_uuid(),
  symbol text not null references public.pairs(symbol) on delete cascade,
  time integer not null, -- Unix timestamp (seconds)
  open numeric(38, 18) not null,
  high numeric(38, 18) not null,
  low numeric(38, 18) not null,
  close numeric(38, 18) not null,
  volume numeric(38, 18) not null,
  unique (symbol, time)
);

-- Index for efficient candle queries
create index idx_candles_symbol_time on public.candles (symbol, time desc);

-- Add current_price column to pairs for live price tracking
alter table public.pairs add column if not exists current_price numeric(38, 18);

-- SEED DATA: Pairs
insert into public.pairs (symbol, name, description, initial_price) values
('SHIT', 'Sovereign Hedge Inflation Token', 'The gold standard of nothing.', 1.0),
('HODL', 'Hold On for Dear Life', 'Only goes up if you look away.', 420.69),
('DEGEN', 'Degen Coin', 'High volatility, high stress.', 0.0000001),
('RUG', 'Rug Pull Protocol', 'It works until it doesn''t.', 100.0),
('COPE', 'Cope Inu', 'For when you missed the pump.', 13.37),
('WAGMI', 'We Are All Gonna Make It', 'Optimism in token form.', 777.0)
on conflict (symbol) do nothing;

-- SEED DATA: Achievements
insert into public.achievements (code, name, description, nsfw_flag) values
('DIAMOND_HANDS', 'Diamond Hands', 'Hold a losing position through a -69% drawdown.', false),
('PAPER_HANDS', 'Paper Hands', 'Close a winning trade for <1% profit.', false),
('SIZE_MATTERS', 'Size Matters', 'Open your first 10x leveraged trade.', true),
('PREMATURE_EXIT', 'Premature Exit', 'Close a trade within 10 seconds of opening it.', true),
('RUG_SURVIVOR', 'Rug Survivor', 'Trade a pair during a chaos spike > 90.', false),
('BAGHOLDER_DELUXE', 'Bagholder Deluxe', 'Hold the same red position for 7 consecutive days.', false),
('COPE_MAXXED', 'Cope Maxxed', 'Log in 7 days in a row without a single green day.', false),
('ONLY_CHARTS', 'Only Charts', 'Spend >60 minutes total staring at charts.', false),
('DEGEN_OF_THE_DAY', 'Degen of the Day', 'Highest volume traded in the last 24h.', false)
on conflict (code) do nothing;

