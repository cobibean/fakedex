'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Info } from 'lucide-react';
import { usePairs } from '@/hooks/usePairs';
import { useChaosEngine } from '@/hooks/useChaosEngine';
import { useBotTrades } from '@/hooks/useBotTrades';
import { usePositions } from '@/hooks/usePositions';
import { Chart } from '@/components/trading/Chart';
import { OrderFeed } from '@/components/trading/OrderFeed';
import { TradePanel } from '@/components/trading/TradePanel';
import { VicPanel } from '@/components/trading/VicPanel';
import { DepthPanel } from '@/components/trading/DepthPanel';

export default function PairTerminalPage() {
  const params = useParams<{ symbol: string }>();
  const routeSymbol = Array.isArray(params?.symbol) ? params.symbol[0] : params?.symbol;
  const requestedSymbol = routeSymbol?.toUpperCase();

  const { pairs } = usePairs();
  const pair = useMemo(() => {
    if (!pairs.length) return undefined;
    return pairs.find((p) => p.symbol === requestedSymbol) ?? pairs[0];
  }, [pairs, requestedSymbol]);

  const symbol = pair?.symbol ?? 'SHIT';
  const initialPrice = pair?.initial_price ?? 1;

  const { candles, currentPrice, chaosLevel, isOverride } = useChaosEngine({
    symbol,
    initialPrice,
    intervalMs: 900,
  });

  const { positions } = usePositions();
  useBotTrades(pairs, true);

  if (!pair) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-4">
        <p className="font-mono text-sm">Loading terminal...</p>
        <Link className="text-xs text-green-400 underline" href="/">
          Back to global view
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3 text-gray-400 text-xs uppercase font-mono">
            <Link href="/" className="text-green-400 flex items-center gap-1 hover:text-green-300 transition-colors">
              <ArrowLeft className="w-3 h-3" /> Global Deck
            </Link>
            <span className="w-1 h-1 rounded-full bg-gray-600" />
            <span>Terminal Mode</span>
          </div>
          <h1 className="text-3xl font-bold text-white mt-2">{pair.name} <span className="text-gray-500 text-2xl">/{' '}FAKEUSD</span></h1>
          <p className="text-sm text-gray-500 mt-1 max-w-xl">{pair.description ?? 'Degenerate markets demand narrative. Vic supplies it.'}</p>
        </div>
        <div className="text-right font-mono">
          <div className="text-xs text-gray-500 uppercase">Spot-ish Price</div>
          <div className="text-3xl text-green-400 font-bold">${currentPrice.toFixed(5)}</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <motion.div
          className="glass-panel rounded-2xl border border-gray-800 p-4 lg:col-span-8 flex flex-col gap-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="h-[420px] relative">
            <Chart 
              data={candles}
              positions={positions.map(p => ({
                id: p.id,
                symbol: p.symbol,
                side: p.side,
                entry_price: p.entry_price,
                liquidation_price: p.liquidation_price,
                size_fakeusd: p.size_fakeusd,
                leverage: p.leverage,
                unrealizedPnL: p.unrealizedPnL,
                pnlPercent: p.pnlPercent,
              }))}
              currentPrice={currentPrice}
              symbol={symbol}
            />
          </div>
        </motion.div>

        <div className="lg:col-span-4 space-y-6">
          <VicPanel chaosLevel={chaosLevel} symbol={symbol} isOverride={isOverride} price={currentPrice} />
          <DepthPanel symbol={symbol} price={currentPrice} />
          <div className="glass-panel rounded-xl border border-gray-800 p-4 space-y-3 text-sm text-gray-400">
            <div className="flex items-center gap-2 text-white">
              <Info className="w-4 h-4 text-green-400" />
              Pair Diagnostics
            </div>
            <div className="flex flex-wrap gap-3 text-xs font-mono uppercase tracking-wide">
              <span>Chaos Source: {isOverride ? 'Pair Override' : 'Global'}</span>
              <span>Initial Price: ${initialPrice.toFixed(5)}</span>
              <span>Symbol: ${symbol}</span>
            </div>
            <p className="leading-relaxed">
              {isOverride
                ? 'Vic manually cranked this pair because the bots were falling asleep. Expect theatrical wicks.'
                : 'Following the global chaos mood. Keep an eye on Vic for sudden interventions.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <motion.div
          className="glass-panel rounded-2xl border border-gray-800 p-4 lg:col-span-8 min-h-[320px]"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between border-b border-gray-900 pb-2 mb-4 text-xs uppercase text-gray-500 font-mono">
            <span>Recent Prints</span>
            <span>Realtime</span>
          </div>
          <OrderFeed activeSymbol={symbol} />
        </motion.div>

        <motion.div
          className="glass-panel rounded-2xl border border-gray-800 p-4 lg:col-span-4"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <TradePanel symbol={symbol} currentPrice={currentPrice} />
        </motion.div>
      </div>
    </div>
  );
}


