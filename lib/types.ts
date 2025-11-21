export interface User {
  id: string;
  username: string | null;
  wallet_address: string;
  xp: number;
  level: number;
  avatar: string | null;
  created_at: string;
  last_faucet_claim_at: string | null;
}

export interface Pair {
  symbol: string;
  name: string;
  description: string | null;
  chaos_override: number | null;
  initial_price: number;
}

export interface Trade {
  id: string;
  user_id: string | null;
  is_bot: boolean;
  symbol: string;
  side: 'buy' | 'sell';
  size_fakeusd: number;
  price: number;
  leverage: number;
  created_at: string;
}

