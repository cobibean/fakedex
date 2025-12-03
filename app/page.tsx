'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
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
  const { pairs, loading: pairsLoading } = usePairs();
  const { profile } = useXP();
  const [activeSymbol, setActiveSymbol] = useState<string>();

  useEffect(() => {
    if (!activeSymbol && pairs.length > 0) {
      const id = setTimeout(() => setActiveSymbol(pairs[0].symbol), 0);
      return () => clearTimeout(id);
    }
  }, [pairs, activeSymbol]);

  const currentPair = useMemo(
    () => pairs.find((pair) => pair.symbol === activeSymbol),
    [pairs, activeSymbol]
  );

  const { candles, currentPrice, chaosLevel, isOverride } = useChaosEngine({
    symbol: activeSymbol || pairs[0]?.symbol || 'SHIT',
    initialPrice: currentPair?.initial_price || 1,
    intervalMs: 1200,
  });

  useBotTrades(pairs, true);

  if (pairsLoading && !pairs.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-green-500 animate-spin" />
        <p className="text-sm text-gray-500 font-mono">Loading degen markets…</p>
      </div>
    );
  }

  if (!activeSymbol) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 font-mono">
        Unable to load markets. Check Supabase or fallback data.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-80px)]">
      <div className="hidden lg:block lg:col-span-2 glass-panel rounded-xl border border-gray-800 overflow-hidden">
        <PairList pairs={pairs} selectedSymbol={activeSymbol} onSelectPair={setActiveSymbol} />
      </div>

      <div className="lg:col-span-7 flex flex-col gap-6 h-full overflow-hidden">
        <div className="flex-2 glass-panel rounded-xl p-4 border border-gray-800 flex flex-col min-h-0">
          <div className="flex justify-between items-center mb-2 px-2">
            <h2 className="text-lg font-bold text-gray-200 flex items-center gap-2">
              {activeSymbol} <span className="text-gray-500 text-sm">/ FAKEUSD</span>
            </h2>
            <div className="flex items-center gap-3">
              <div className="font-mono text-xl text-green-400">${currentPrice.toFixed(4)}</div>
              <Link
                href={`/pair/${activeSymbol}`}
                className="text-xs font-mono uppercase tracking-wide border border-gray-700 px-3 py-1 rounded-full text-gray-400 hover:text-white hover:border-green-500 transition-colors"
              >
                Open Terminal
              </Link>
            </div>
          </div>
          <div className="flex-1 w-full relative">
            <div className="absolute inset-0">
              {candles.length > 0 ? (
                <Chart data={candles} />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  Loading chart data...
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 glass-panel rounded-xl p-4 border border-gray-800 min-h-0">
          <OrderFeed activeSymbol={activeSymbol} />
        </div>
      </div>

      <div className="lg:col-span-3 flex flex-col gap-6 h-full overflow-y-auto scrollbar-hide">
        <FaucetPanel />
        <TradePanel symbol={activeSymbol} currentPrice={currentPrice} />

        <div className="glass-panel rounded-xl p-4 border border-gray-800">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-gray-400">Chaos Level</h3>
            {isOverride && (
              <span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded border border-orange-500/50 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> OVERRIDE
              </span>
            )}
          </div>
          <div className="text-4xl font-mono font-bold text-purple-500">{chaosLevel}%</div>
          <div className="h-1 w-full bg-gray-800 mt-2 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 transition-all duration-500" style={{ width: `${chaosLevel}%` }} />
          </div>
          <p className="text-xs text-gray-600 mt-2 italic">
            {chaosLevel < 20
              ? 'Market is strangely calm...'
              : chaosLevel < 50
              ? 'Volatility is heating up.'
              : chaosLevel < 80
              ? 'Absolute degen hours.'
              : 'VIC SAYS: RUN FOR YOUR LIFE.'}
          </p>
        </div>

        <XpBar profile={profile} />
      </div>
    </div>
  );
}
