'use client';

import { Pair } from '@/lib/types';
import { PairRow } from './PairRow';
import { useAllPrices } from '@/hooks/useChaosEngine';

interface PairListProps {
  pairs: Pair[];
  selectedSymbol?: string;
  onSelectPair: (symbol: string) => void;
  // Direct price from chart for the active symbol (bypasses realtime issues)
  activePairPrice?: number;
}

export function PairList({ pairs, selectedSymbol, onSelectPair, activePairPrice }: PairListProps) {
  const { prices } = useAllPrices();

  // Merge direct price with realtime prices - direct price takes priority for selected pair
  const getPrice = (symbol: string): number | undefined => {
    // For the selected pair, prefer the direct price from the chart
    if (symbol === selectedSymbol && activePairPrice && activePairPrice > 0) {
      return activePairPrice;
    }
    // Otherwise use realtime price
    return prices[symbol];
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-800 bg-black/20 backdrop-blur">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Markets</h3>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {pairs.map((pair) => (
          <PairRow 
            key={pair.symbol} 
            pair={pair}
            currentPrice={getPrice(pair.symbol)}
            isSelected={pair.symbol === selectedSymbol}
            onClick={() => onSelectPair(pair.symbol)}
          />
        ))}
        {pairs.length === 0 && (
           <div className="p-4 text-xs text-gray-600 text-center italic">
              Loading degen pairs...
           </div>
        )}
      </div>
    </div>
  );
}

