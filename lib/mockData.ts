import { Pair, Achievement, User, Trade } from '@/lib/types';

export const DEFAULT_PAIRS: Pair[] = [
  { symbol: 'SHIT', name: 'Sovereign Hedge Inflation Token', description: 'The gold standard of nothing.', chaos_override: 65, initial_price: 1 },
  { symbol: 'HODL', name: 'Hold On for Dear Life', description: 'Only goes up if you look away.', chaos_override: 40, initial_price: 420.69 },
  { symbol: 'DEGEN', name: 'Degen Coin', description: 'High volatility, high stress.', chaos_override: 85, initial_price: 0.0000001 },
  { symbol: 'RUG', name: 'Rug Pull Protocol', description: 'It works until it doesn’t.', chaos_override: 95, initial_price: 100 },
  { symbol: 'COPE', name: 'Cope Inu', description: 'For when you missed the pump.', chaos_override: 30, initial_price: 13.37 },
  { symbol: 'WAGMI', name: 'We Are All Gonna Make It', description: 'Optimism in token form.', chaos_override: 55, initial_price: 777 },
];

export const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  { id: 'mock-1', code: 'DIAMOND_HANDS', name: 'Diamond Hands', description: 'Hold a losing position through a -69% drawdown.', nsfw_flag: false },
  { id: 'mock-2', code: 'PAPER_HANDS', name: 'Paper Hands', description: 'Close a winning trade for <1% profit.', nsfw_flag: false },
  { id: 'mock-3', code: 'SIZE_MATTERS', name: 'Size Matters', description: 'Open your first 10x leveraged trade.', nsfw_flag: true },
  { id: 'mock-4', code: 'PREMATURE_EXIT', name: 'Premature Exit', description: 'Close a trade within 10 seconds of opening it.', nsfw_flag: true },
  { id: 'mock-5', code: 'RUG_SURVIVOR', name: 'Rug Survivor', description: 'Trade a pair during a chaos spike > 90.', nsfw_flag: false },
];

export const DEFAULT_TRADES: Trade[] = [
  {
    id: 'mock-trade-1',
    user_id: 'mock-user',
    is_bot: true,
    symbol: 'SHIT',
    side: 'buy',
    size_fakeusd: 4200,
    price: 1.2,
    leverage: 5,
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-trade-2',
    user_id: 'mock-user',
    is_bot: true,
    symbol: 'DEGEN',
    side: 'sell',
    size_fakeusd: 1337,
    price: 0.0000002,
    leverage: 20,
    created_at: new Date().toISOString(),
  },
];

export const DEFAULT_PROFILE: User = {
  id: 'mock-user',
  username: 'Guest Degenn',
  wallet_address: '0x0000000000000000000000000000000000000000',
  created_at: new Date().toISOString(),
  xp: 0,
  level: 1,
  avatar: null,
  last_login_at: null,
  last_faucet_claim_at: null,
};

