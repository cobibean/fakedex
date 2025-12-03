export interface User {
  id: string;
  username: string | null;
  wallet_address: string;
  xp: number;
  level: number;
  avatar: string | null;
  created_at: string;
  last_faucet_claim_at: string | null;
  last_login_at?: string | null;
}

export interface Pair {
  symbol: string;
  name: string;
  description: string | null;
  chaos_override: number | null;
  initial_price: number;
  current_price: number | null;  // Live price updated by chaos engine
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

export interface Achievement {
  id: string;
  code: string;
  name: string;
  description: string;
  nsfw_flag: boolean;
  earned_at?: string;
}

export interface Comment {
  id: string;
  user_id: string;
  profile_id: string;
  content: string;
  created_at: string;
  user?: {
    username: string | null;
    wallet_address: string;
    level: number;
  };
}

export interface TradeWithUser extends Trade {
  users?: {
    username: string | null;
    wallet_address: string;
  };
}

