'use client';

import { useMemo } from 'react';
import { hashString, pseudoRandomFromHash } from '@/lib/utils';

interface DepthPanelProps {
  symbol: string;
  price: number;
}

interface DepthRow {
  price: number;
  size: number;
}

function buildDepth(symbol: string, price: number, type: 'bid' | 'ask'): DepthRow[] {
  const baseHash = hashString(`${symbol}-${type}`);
  return Array.from({ length: 6 }).map((_, index) => {
    const noise = pseudoRandomFromHash(baseHash + index * 17, 0.1, 1.5);
    const size = Math.round(pseudoRandomFromHash(baseHash + index * 23, 1_000, 50_000));
    const offset = index * 0.003 * (type === 'bid' ? -1 : 1);
    const newPrice = Math.max(price + price * offset + noise * 0.001, 0.0000001);
    return { price: newPrice, size };
  });
}

export function DepthPanel({ symbol, price }: DepthPanelProps) {
  const bids = useMemo(() => buildDepth(symbol, price || 1, 'bid'), [symbol, price]);
  const asks = useMemo(() => buildDepth(symbol, price || 1, 'ask'), [symbol, price]);

  return (
    <div className="glass-panel rounded-xl border border-gray-800 overflow-hidden">
      <div className="grid grid-cols-2 text-[10px] uppercase tracking-wide text-gray-500 border-b border-gray-800">
        <div className="px-3 py-2">Bids</div>
        <div className="px-3 py-2 text-right">Asks</div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-gray-900">
        <div className="p-3 space-y-1">
          {bids.map((row, idx) => (
            <div key={`bid-${idx}`} className="flex justify-between text-xs font-mono">
              <span className="text-green-400">${row.price.toFixed(4)}</span>
              <span className="text-gray-400">{row.size.toLocaleString()} FAKEUSD</span>
            </div>
          ))}
        </div>
        <div className="p-3 space-y-1 bg-black/20">
          {asks.map((row, idx) => (
            <div key={`ask-${idx}`} className="flex justify-between text-xs font-mono">
              <span className="text-gray-400">{row.size.toLocaleString()} FAKEUSD</span>
              <span className="text-red-400">${row.price.toFixed(4)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


