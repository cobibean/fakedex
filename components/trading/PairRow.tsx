import { Pair } from '@/lib/types';
import { clsx } from 'clsx';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface PairRowProps {
  pair: Pair;
  currentPrice?: number;
  isSelected?: boolean;
  onClick?: () => void;
}

export function PairRow({ pair, currentPrice, isSelected, onClick }: PairRowProps) {
  // Use current price if available, fall back to pair's current_price, then initial
  const displayPrice = currentPrice || pair.current_price || pair.initial_price;
  
  // Calculate actual % change from initial price
  const changePercent = pair.initial_price > 0 
    ? ((displayPrice - pair.initial_price) / pair.initial_price) * 100 
    : 0;
  
  const isGreen = changePercent >= 0;
  const isFlat = Math.abs(changePercent) < 0.01;

  return (
    <div 
      onClick={onClick}
      className={clsx(
        "p-3 border-b border-gray-800 cursor-pointer hover:bg-gray-900 transition-colors flex items-center justify-between",
        isSelected ? "bg-gray-800/50 border-l-4 border-l-green-500" : "border-l-4 border-l-transparent"
      )}
    >
      <div>
        <div className="font-bold text-sm text-gray-200">${pair.symbol}</div>
        <div className="text-xs text-gray-500 truncate max-w-[120px]">{pair.name}</div>
      </div>
      
      <div className="text-right">
        <div className="font-mono text-sm text-gray-300">${displayPrice.toFixed(5)}</div>
        <div className={clsx(
          "text-xs font-mono flex items-center justify-end gap-1", 
          isFlat ? "text-gray-500" : isGreen ? "text-green-500" : "text-red-500"
        )}>
          {isFlat ? (
            <Minus className="w-3 h-3" />
          ) : isGreen ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )}
          {isGreen && changePercent > 0 ? '+' : ''}{changePercent.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

