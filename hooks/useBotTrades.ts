import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Pair } from '@/lib/types';

export function useBotTrades(pairs: Pair[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled || pairs.length === 0) return;

    const interval = setInterval(async () => {
      // 1. Pick a random pair
      const pair = pairs[Math.floor(Math.random() * pairs.length)];
      
      // 2. Determine buy/sell (50/50ish)
      const side = Math.random() > 0.5 ? 'buy' : 'sell';
      
      // 3. Determine size (random logarithmic distribution for realism)
      const size = Math.floor(Math.exp(Math.random() * 8)); // 1 to ~3000
      
      // 4. Determine price (drift slightly from initial or last known)
      // In a real scenario, this would read the chaos engine price, but for bot noise we can approximate
      // based on initial price + random noise.
      const price = pair.initial_price * (1 + (Math.random() - 0.5) * 0.1);

      // 5. Insert Trade
      await supabase.from('trades').insert({
        symbol: pair.symbol,
        side,
        size_fakeusd: size,
        price,
        leverage: Math.floor(Math.random() * 10) + 1,
        is_bot: true,
      });

    }, 5000); // Bot trades every 5 seconds

    return () => clearInterval(interval);
  }, [pairs, enabled]);
}

