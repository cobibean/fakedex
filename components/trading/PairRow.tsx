import { Pair } from '@/lib/types';
import { clsx } from 'clsx';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface PairRowProps {
  pair: Pair;
  isSelected?: boolean;
  onClick?: () => void;
}

function getPseudoRandomForSymbol(symbol: string) {
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = (hash << 5) - hash + symbol.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function PairRow({ pair, isSelected, onClick }: PairRowProps) {
  const hash = getPseudoRandomForSymbol(pair.symbol);
  const isGreen = hash % 2 === 0;
  const change = ((hash % 2000) / 100).toFixed(2);

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
        <div className="font-mono text-sm text-gray-300">${pair.initial_price.toLocaleString()}</div>
        <div className={clsx("text-xs font-mono flex items-center justify-end gap-1", isGreen ? "text-green-500" : "text-red-500")}>
           {isGreen ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
           {change}%
        </div>
      </div>
    </div>
  );
}

