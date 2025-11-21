import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { Trade } from '@/lib/types';
import { DEFAULT_TRADES } from '@/lib/mockData';

export function OrderFeed({ activeSymbol }: { activeSymbol?: string }) {
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    const fetchInitial = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setTrades(
          activeSymbol
            ? DEFAULT_TRADES.filter((trade) => trade.symbol === activeSymbol)
            : DEFAULT_TRADES
        );
        return;
      }

      let query = supabase
        .from('trades')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (activeSymbol) {
        query = query.eq('symbol', activeSymbol);
      }

      const { data } = await query;
      if (data) setTrades(data);
    };

    fetchInitial();

    if (!isSupabaseConfigured || !supabase) return;

    const subscription = supabase
      .channel('public:trades')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trades' }, (payload) => {
        const newTrade = payload.new as Trade;
        if (!activeSymbol || newTrade.symbol === activeSymbol) {
          setTrades((prev) => [newTrade, ...prev].slice(0, 20));
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [activeSymbol]);

  return (
    <div className="h-full overflow-hidden flex flex-col">
       <h3 className="text-sm font-mono text-gray-500 mb-2 border-b border-gray-800 pb-1 uppercase flex justify-between">
          <span>Order Feed</span>
          <span className="text-[10px] text-gray-600 self-center">REALTIME</span>
       </h3>
       <div className="space-y-1 overflow-y-auto scrollbar-thin flex-1 pr-2">
          {trades.map((trade) => (
            <div key={trade.id} className="flex justify-between text-xs font-mono animate-in slide-in-from-right duration-300">
               <div className="flex gap-2">
                 <span className={trade.side === 'buy' ? 'text-green-500' : 'text-red-500'}>
                    {trade.side.toUpperCase()}
                 </span>
                 <span className="text-gray-400 font-bold">${trade.symbol}</span>
               </div>
               <div className="flex gap-3 text-gray-500">
                 <span>${Number(trade.price).toFixed(4)}</span>
                 <span className="w-16 text-right text-gray-600">{Number(trade.size_fakeusd).toLocaleString()}</span>
               </div>
            </div>
          ))}
          {trades.length === 0 && (
             <div className="text-center text-xs text-gray-700 italic mt-4">No recent trades</div>
          )}
       </div>
    </div>
  );
}

