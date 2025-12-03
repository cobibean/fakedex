'use client';

import { TrendingUp, TrendingDown, Zap, Target, Skull, Clock, DollarSign, BarChart3 } from 'lucide-react';
import { UserStats } from '@/lib/statsService';

interface ProfileStatsProps {
  stats: UserStats;
}

export function ProfileStats({ stats }: ProfileStatsProps) {
  const isWinning = stats.winRate >= 50;
  const isProfitable = stats.totalRealizedPnL >= 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Total Volume */}
      <div className="glass-panel rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <DollarSign className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider">Volume</span>
        </div>
        <div className="text-xl font-mono font-bold text-green-400">
          ${stats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
      </div>

      {/* Total Trades */}
      <div className="glass-panel rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <BarChart3 className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider">Positions</span>
        </div>
        <div className="text-xl font-mono font-bold text-blue-400">
          {stats.totalTrades}
        </div>
        {stats.openPositionsCount > 0 && (
          <div className="text-xs text-gray-500 mt-1">
            {stats.openPositionsCount} open
          </div>
        )}
      </div>

      {/* Win Rate */}
      <div className="glass-panel rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <Target className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider">Win Rate</span>
        </div>
        <div className={`text-xl font-mono font-bold ${isWinning ? 'text-green-400' : 'text-red-400'}`}>
          {stats.winRate.toFixed(1)}%
        </div>
        <div className="text-xs text-gray-500 mt-1">
          {stats.winCount}W / {stats.lossCount}L
        </div>
      </div>

      {/* Avg Leverage */}
      <div className="glass-panel rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <Zap className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider">Avg Leverage</span>
        </div>
        <div className={`text-xl font-mono font-bold ${stats.avgLeverage >= 20 ? 'text-orange-400' : 'text-purple-400'}`}>
          {stats.avgLeverage.toFixed(1)}x
        </div>
      </div>

      {/* Total PnL */}
      <div className="glass-panel rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          {isProfitable ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span className="text-xs uppercase tracking-wider">Total PnL</span>
        </div>
        <div className={`text-xl font-mono font-bold ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
          {isProfitable ? '+' : ''}{stats.totalRealizedPnL.toFixed(2)}
        </div>
      </div>

      {/* Biggest Win */}
      <div className="glass-panel rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <TrendingUp className="w-4 h-4 text-green-500" />
          <span className="text-xs uppercase tracking-wider">Best Trade</span>
        </div>
        <div className="text-xl font-mono font-bold text-green-400">
          {stats.biggestWin > 0 ? `+$${stats.biggestWin.toFixed(2)}` : '—'}
        </div>
      </div>

      {/* Biggest Loss */}
      <div className="glass-panel rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <TrendingDown className="w-4 h-4 text-red-500" />
          <span className="text-xs uppercase tracking-wider">Worst Trade</span>
        </div>
        <div className="text-xl font-mono font-bold text-red-400">
          {stats.biggestLoss > 0 ? `-$${stats.biggestLoss.toFixed(2)}` : '—'}
        </div>
      </div>

      {/* Liquidations */}
      <div className="glass-panel rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <Skull className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider">Liquidations</span>
        </div>
        <div className={`text-xl font-mono font-bold ${stats.liquidationCount > 0 ? 'text-red-400' : 'text-gray-400'}`}>
          {stats.liquidationCount}
        </div>
      </div>

      {/* Trading Days */}
      <div className="glass-panel rounded-xl p-4 border border-gray-800 md:col-span-2">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <Clock className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider">Active Days</span>
        </div>
        <div className="text-xl font-mono font-bold text-cyan-400">
          {stats.tradingDays}
        </div>
      </div>
    </div>
  );
}
