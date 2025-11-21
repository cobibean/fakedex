'use client';

import { Pair } from '@/lib/types';
import { PairRow } from './PairRow';

interface PairListProps {
  pairs: Pair[];
  selectedSymbol?: string;
  onSelectPair: (symbol: string) => void;
}

export function PairList({ pairs, selectedSymbol, onSelectPair }: PairListProps) {
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

