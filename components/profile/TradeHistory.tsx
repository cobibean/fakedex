'use client';

import { Trade } from '@/lib/types';
import { TrendingUp, TrendingDown, Flame, Skull, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from '@/lib/utils';

interface TradeHistoryProps {
  trades: Trade[];
  showUser?: boolean;
}

// Fun reactions based on trade characteristics
function getTradeReaction(trade: Trade): { icon: React.ReactNode; label: string; color: string } | null {
  if (trade.leverage >= 50) {
    return { icon: <Skull className="w-3 h-3" />, label: 'DEGEN MODE', color: 'text-red-500' };
  }
  if (trade.leverage >= 20) {
    return { icon: <Flame className="w-3 h-3" />, label: 'HIGH RISK', color: 'text-orange-500' };
  }
  if (trade.size_fakeusd >= 10000) {
    return { icon: <Sparkles className="w-3 h-3" />, label: 'WHALE ALERT', color: 'text-cyan-400' };
  }
  return null;
}

export function TradeHistory({ trades, showUser = false }: TradeHistoryProps) {
  if (trades.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <div className="text-4xl mb-2">📉</div>
        <p className="font-mono">No trades yet. Time to degen.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {trades.map((trade) => {
        const reaction = getTradeReaction(trade);
        const isBuy = trade.side === 'buy';
        
        return (
          <div
            key={trade.id}
            className="group glass-panel rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition-all hover:bg-gray-900/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                {/* Direction indicator */}
                <div className={`p-2 rounded-lg ${isBuy ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                  {isBuy ? (
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  ) : (
                    <TrendingDown className="w-5 h-5 text-red-500" />
                  )}
                </div>
                
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                      {isBuy ? 'LONG' : 'SHORT'}
                    </span>
                    <span className="font-mono text-white">{trade.symbol}</span>
                    {trade.leverage > 1 && (
                      <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-mono">
                        {trade.leverage}x
                      </span>
                    )}
                    {reaction && (
                      <span className={`text-xs flex items-center gap-1 ${reaction.color}`}>
                        {reaction.icon}
                        <span className="hidden sm:inline">{reaction.label}</span>
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-500 font-mono">
                    @ ${trade.price.toFixed(4)}
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="font-mono text-lg text-white">
                  ${trade.size_fakeusd.toLocaleString()}
                </div>
                <div className="text-xs text-gray-600">
                  {formatDistanceToNow(trade.created_at)}
                </div>
              </div>
            </div>
            
            {/* Simulated PnL - just for fun since it's fake */}
            <div className="mt-3 pt-3 border-t border-gray-800/50 flex items-center justify-between text-sm">
              <span className="text-gray-500">Simulated PnL</span>
              <span className={`font-mono ${Math.random() > 0.6 ? 'text-green-400' : 'text-red-400'}`}>
                {Math.random() > 0.6 ? '+' : '-'}${(Math.random() * trade.size_fakeusd * 0.3).toFixed(2)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

