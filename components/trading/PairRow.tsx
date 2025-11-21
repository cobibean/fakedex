import { Pair } from '@/lib/types';
import { clsx } from 'clsx';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface PairRowProps {
  pair: Pair;
  isSelected?: boolean;
  onClick?: () => void;
}

export function PairRow({ pair, isSelected, onClick }: PairRowProps) {
  // Mock change for now - in real app we'd diff against 24h ago from DB
  const isGreen = Math.random() > 0.5; 
  const change = (Math.random() * 20).toFixed(2);

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

