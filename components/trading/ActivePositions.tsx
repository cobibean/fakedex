'use client';

import { useState } from 'react';
import { usePositions, PositionWithPnL } from '@/hooks/usePositions';
import { 
  TrendingUp, 
  TrendingDown, 
  X, 
  AlertTriangle, 
  Loader2,
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
  Skull
} from 'lucide-react';
import { formatDistanceToNow } from '@/lib/utils';

interface ActivePositionsProps {
  onPositionClosed?: () => void;
  inline?: boolean; // Compact mode for embedding in other panels
}

function PositionRow({ 
  position, 
  onClose,
  isClosing 
}: { 
  position: PositionWithPnL; 
  onClose: (id: string, price: number) => void;
  isClosing: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = position.side === 'long';
  const isProfitable = position.unrealizedPnL >= 0;

  return (
    <div className={`border rounded-lg overflow-hidden transition-all ${
      position.isLiquidatable 
        ? 'border-red-500 bg-red-500/10 animate-pulse' 
        : 'border-gray-800 bg-gray-900/50'
    }`}>
      {/* Main Row */}
      <div 
        className="p-3 cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          {/* Left: Symbol & Direction */}
          <div className="flex items-center gap-3">
            <div className={`p-1.5 rounded ${isLong ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
              {isLong ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">{position.symbol}</span>
                <span className={`text-xs font-mono ${isLong ? 'text-green-400' : 'text-red-400'}`}>
                  {isLong ? 'LONG' : 'SHORT'}
                </span>
                <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded font-mono">
                  {position.leverage}x
                </span>
              </div>
              <div className="text-xs text-gray-500 font-mono">
                Size: ${position.size_fakeusd.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Right: PnL & Actions */}
          <div className="flex items-center gap-4">
            {/* Unrealized PnL */}
            <div className="text-right">
              <div className={`font-mono font-bold ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                {isProfitable ? '+' : ''}{position.unrealizedPnL.toFixed(2)}
              </div>
              <div className={`text-xs font-mono ${isProfitable ? 'text-green-500/70' : 'text-red-500/70'}`}>
                {isProfitable ? '+' : ''}{position.pnlPercent.toFixed(2)}%
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(position.id, position.currentPrice);
              }}
              disabled={isClosing}
              className="p-2 bg-gray-800 hover:bg-red-600 rounded-lg transition-colors group disabled:opacity-50"
            >
              {isClosing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4 text-gray-400 group-hover:text-white" />
              )}
            </button>

            {/* Expand Toggle */}
            <div className="text-gray-500">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </div>

        {/* Liquidation Warning */}
        {position.isLiquidatable && (
          <div className="mt-2 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-2 py-1 rounded">
            <Skull className="w-3 h-3" />
            <span>LIQUIDATION IMMINENT</span>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-gray-800 space-y-2">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-gray-500">Entry Price</span>
              <div className="font-mono text-white">${position.entry_price.toFixed(5)}</div>
            </div>
            <div>
              <span className="text-gray-500">Current Price</span>
              <div className="font-mono text-white">${position.currentPrice.toFixed(5)}</div>
            </div>
            <div>
              <span className="text-gray-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-orange-400" /> Liq. Price
              </span>
              <div className="font-mono text-orange-400">${position.liquidation_price.toFixed(5)}</div>
            </div>
            <div>
              <span className="text-gray-500">Opened</span>
              <div className="font-mono text-gray-400">{formatDistanceToNow(position.created_at)}</div>
            </div>
            {position.stop_loss && (
              <div>
                <span className="text-gray-500 flex items-center gap-1">
                  <Target className="w-3 h-3 text-red-400" /> Stop Loss
                </span>
                <div className="font-mono text-red-400">${position.stop_loss.toFixed(5)}</div>
              </div>
            )}
            {position.take_profit && (
              <div>
                <span className="text-gray-500 flex items-center gap-1">
                  <Target className="w-3 h-3 text-green-400" /> Take Profit
                </span>
                <div className="font-mono text-green-400">${position.take_profit.toFixed(5)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function ActivePositions({ onPositionClosed, inline = false }: ActivePositionsProps) {
  const { positions, loading, totalUnrealizedPnL, closePosition } = usePositions();
  const [closingId, setClosingId] = useState<string | null>(null);

  const handleClose = async (positionId: string, exitPrice: number) => {
    setClosingId(positionId);
    const result = await closePosition(positionId, exitPrice);
    setClosingId(null);
    
    if (result.success) {
      onPositionClosed?.();
    } else {
      alert(result.error || 'Failed to close position');
    }
  };

  // Inline mode - compact, no wrapper
  if (inline) {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 text-purple-500 animate-spin" />
        </div>
      );
    }

    if (positions.length === 0) {
      return (
        <div className="flex items-center justify-center py-4 text-gray-500 text-sm">
          <span className="mr-2">📊</span> No open positions
        </div>
      );
    }

    return (
      <div className="space-y-1.5 overflow-y-auto h-full">
        {positions.map((position) => (
          <InlinePositionRow
            key={position.id}
            position={position}
            onClose={handleClose}
            isClosing={closingId === position.id}
          />
        ))}
      </div>
    );
  }

  // Full mode - with header and wrapper
  if (loading) {
    return (
      <div className="glass-panel rounded-xl p-4 border border-gray-800">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
        </div>
      </div>
    );
  }

  const isProfitable = totalUnrealizedPnL >= 0;

  return (
    <div className="glass-panel rounded-xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          <h3 className="font-bold text-white">Active Positions</h3>
          {positions.length > 0 && (
            <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
              {positions.length}
            </span>
          )}
        </div>
        
        {positions.length > 0 && (
          <div className="text-right">
            <div className="text-xs text-gray-500">Total PnL</div>
            <div className={`font-mono font-bold ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
              {isProfitable ? '+' : ''}${totalUnrealizedPnL.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Positions List */}
      <div className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
        {positions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-3xl mb-2">📊</div>
            <p className="font-mono text-sm">No open positions</p>
            <p className="text-xs text-gray-600 mt-1">Open a trade to see it here</p>
          </div>
        ) : (
          positions.map((position) => (
            <PositionRow
              key={position.id}
              position={position}
              onClose={handleClose}
              isClosing={closingId === position.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

// Compact inline position row for the bottom panel
function InlinePositionRow({ 
  position, 
  onClose,
  isClosing 
}: { 
  position: PositionWithPnL; 
  onClose: (id: string, price: number) => void;
  isClosing: boolean;
}) {
  const isLong = position.side === 'long';
  const isProfitable = position.unrealizedPnL >= 0;

  return (
    <div className={`flex items-center justify-between px-2 py-1.5 rounded text-xs ${
      position.isLiquidatable 
        ? 'bg-red-500/20 border border-red-500/50' 
        : 'bg-gray-800/50 hover:bg-gray-800'
    }`}>
      {/* Left: Symbol & Direction */}
      <div className="flex items-center gap-2">
        {isLong ? (
          <TrendingUp className="w-3 h-3 text-green-500" />
        ) : (
          <TrendingDown className="w-3 h-3 text-red-500" />
        )}
        <span className="font-bold text-white">{position.symbol}</span>
        <span className={`font-mono text-[10px] ${isLong ? 'text-green-400' : 'text-red-400'}`}>
          {isLong ? 'L' : 'S'}
        </span>
        <span className="text-[10px] text-purple-400 font-mono">{position.leverage}x</span>
      </div>

      {/* Center: Size */}
      <div className="text-gray-400 font-mono">
        ${position.size_fakeusd.toLocaleString()}
      </div>

      {/* Right: PnL & Close */}
      <div className="flex items-center gap-3">
        <div className={`font-mono font-bold ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
          {isProfitable ? '+' : ''}{position.unrealizedPnL.toFixed(2)}
          <span className="text-[10px] ml-1 opacity-70">
            ({isProfitable ? '+' : ''}{position.pnlPercent.toFixed(1)}%)
          </span>
        </div>
        <button
          onClick={() => onClose(position.id, position.currentPrice)}
          disabled={isClosing}
          className="p-1 hover:bg-red-600 rounded transition-colors disabled:opacity-50"
        >
          {isClosing ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <X className="w-3 h-3 text-gray-400 hover:text-white" />
          )}
        </button>
      </div>
    </div>
  );
}

