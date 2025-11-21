'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { TradePanel } from '@/components/trading/TradePanel';
import { PairList } from '@/components/trading/PairList';
import { Chart } from '@/components/trading/Chart';
import { OrderFeed } from '@/components/trading/OrderFeed';
import { FaucetPanel } from '@/components/dashboard/FaucetPanel';
import { XpBar } from '@/components/xp/XpBar';
import { usePairs } from '@/hooks/usePairs';
import { useChaosEngine } from '@/hooks/useChaosEngine';
import { useBotTrades } from '@/hooks/useBotTrades';
import { useXP } from '@/hooks/useXP';

export default function Home() {
  // 1. Fetch pairs data
  const { pairs, loading: pairsLoading } = usePairs();
  const [activeSymbol, setActiveSymbol] = useState<string | undefined>(undefined);

  // Select first pair by default
  useEffect(() => {
    if (pairs.length > 0 && !activeSymbol) {
      setActiveSymbol(pairs[0].symbol);
    }
  }, [pairs, activeSymbol]);

  // 2. Chaos engine for the active pair
  const currentPair = pairs.find(p => p.symbol === activeSymbol);
  const { candles, currentPrice, chaosLevel, isOverride } = useChaosEngine({
    symbol: activeSymbol || 'SHIT',
    initialPrice: currentPair?.initial_price || 1,
    intervalMs: 1000
  });

  // 3. Activate Bots (global, random pairs)
  useBotTrades(pairs, true);

  // 4. User Profile
  const { profile } = useXP();

  if (pairsLoading) {
    // ... (loading state remains same)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-80px)]">
      
      {/* LEFT: Pair List */}
      <div className="hidden lg:block lg:col-span-2 glass-panel rounded-xl border border-gray-800 overflow-hidden">
        <PairList 
          pairs={pairs} 
          selectedSymbol={activeSymbol} 
          onSelectPair={setActiveSymbol} 
        />
      </div>

      {/* CENTER: Chart & Order Feed */}
      <div className="lg:col-span-7 flex flex-col gap-6 h-full overflow-hidden">
         <div className="flex-[2] glass-panel rounded-xl p-4 border border-gray-800 flex flex-col min-h-0">
           <div className="flex justify-between items-center mb-2 px-2">
             <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
               {activeSymbol} <span className="text-gray-500 text-sm">/ FAKEUSD</span>
             </h2>
             <div className="font-mono text-xl text-green-400">
               ${currentPrice.toFixed(4)}
             </div>
           </div>
           <div className="flex-1 w-full relative">
              <div className="absolute inset-0">
                <Chart data={candles} />
              </div>
           </div>
        </div>
        
        <div className="flex-1 glass-panel rounded-xl p-4 border border-gray-800 min-h-0">
           <OrderFeed activeSymbol={activeSymbol} />
        </div>
      </div>

      {/* RIGHT: Panels */}
      <div className="lg:col-span-3 flex flex-col gap-6 h-full overflow-y-auto scrollbar-hide">
         
         {/* Faucet */}
         <FaucetPanel />

         {/* Trade Panel */}
         <TradePanel 
            symbol={activeSymbol || 'SHIT'} 
            currentPrice={currentPrice} 
         />
         
         {/* Chaos Indicator */}
         <div className="glass-panel rounded-xl p-4 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-gray-400">Chaos Level</h3>
                {isOverride && (
                    <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded border border-orange-500/50 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> OVERRIDE
                    </span>
                )}
            </div>
            <div className="text-4xl font-mono font-bold text-purple-500">
                {chaosLevel}%
            </div>
            <div className="h-1 w-full bg-gray-800 mt-2 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-purple-500 transition-all duration-500" 
                    style={{ width: `${chaosLevel}%` }}
                ></div>
            </div>
            <p className="text-xs text-gray-600 mt-2 italic">
                {chaosLevel < 20 ? "Market is strangely calm..." : 
                 chaosLevel < 50 ? "Volatility is heating up." :
                 chaosLevel < 80 ? "Absolute degen hours." :
                 "VIC SAYS: RUN FOR YOUR LIFE."}
            </p>
         </div>

         {/* XP Bar */}
         <div className="opacity-90">
             <XpBar profile={profile} />
         </div>

      </div>
    </div>
  );
}
