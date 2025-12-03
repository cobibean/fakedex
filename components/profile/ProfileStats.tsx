'use client';

import { TrendingUp, TrendingDown, Zap, Target, Flame, Clock, DollarSign, BarChart3 } from 'lucide-react';

interface ProfileStatsProps {
  stats: {
    totalTrades: number;
    totalVolume: number;
    winRate: number;
    avgLeverage: number;
    biggestWin: number;
    biggestLoss: number;
    streak: number;
    tradingDays: number;
  };
}

// Generate mock stats for demo
export function generateMockStats(tradeCount: number, volume: number): ProfileStatsProps['stats'] {
  return {
    totalTrades: tradeCount,
    totalVolume: volume,
    winRate: Math.floor(30 + Math.random() * 40), // 30-70%
    avgLeverage: Math.floor(5 + Math.random() * 15), // 5-20x
    biggestWin: Math.floor(volume * 0.1 + Math.random() * volume * 0.3),
    biggestLoss: Math.floor(volume * 0.05 + Math.random() * volume * 0.2),
    streak: Math.floor(Math.random() * 8) - 3, // -3 to 5
    tradingDays: Math.floor(1 + Math.random() * 30),
  };
}

export function ProfileStats({ stats }: ProfileStatsProps) {
  const isWinning = stats.winRate >= 50;
  const isOnStreak = stats.streak > 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Total Volume */}
      <div className="glass-panel rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <DollarSign className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider">Volume</span>
        </div>
        <div className="text-xl font-mono font-bold text-green-400">
          ${stats.totalVolume.toLocaleString()}
        </div>
      </div>

      {/* Total Trades */}
      <div className="glass-panel rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <BarChart3 className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider">Trades</span>
        </div>
        <div className="text-xl font-mono font-bold text-blue-400">
          {stats.totalTrades}
        </div>
      </div>

      {/* Win Rate */}
      <div className="glass-panel rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <Target className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider">Win Rate</span>
        </div>
        <div className={`text-xl font-mono font-bold ${isWinning ? 'text-green-400' : 'text-red-400'}`}>
          {stats.winRate}%
        </div>
      </div>

      {/* Avg Leverage */}
      <div className="glass-panel rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <Zap className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider">Avg Leverage</span>
        </div>
        <div className={`text-xl font-mono font-bold ${stats.avgLeverage >= 20 ? 'text-orange-400' : 'text-purple-400'}`}>
          {stats.avgLeverage}x
        </div>
      </div>

      {/* Biggest Win */}
      <div className="glass-panel rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <TrendingUp className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider">Best Trade</span>
        </div>
        <div className="text-xl font-mono font-bold text-green-400">
          +${stats.biggestWin.toLocaleString()}
        </div>
      </div>

      {/* Biggest Loss */}
      <div className="glass-panel rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <TrendingDown className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider">Worst Trade</span>
        </div>
        <div className="text-xl font-mono font-bold text-red-400">
          -${stats.biggestLoss.toLocaleString()}
        </div>
      </div>

      {/* Current Streak */}
      <div className="glass-panel rounded-xl p-4 border border-gray-800">
        <div className="flex items-center gap-2 text-gray-500 mb-1">
          <Flame className="w-4 h-4" />
          <span className="text-xs uppercase tracking-wider">Streak</span>
        </div>
        <div className={`text-xl font-mono font-bold flex items-center gap-1 ${isOnStreak ? 'text-orange-400' : 'text-gray-400'}`}>
          {isOnStreak ? `🔥 ${stats.streak}W` : stats.streak === 0 ? '—' : `${Math.abs(stats.streak)}L`}
        </div>
      </div>

      {/* Trading Days */}
      <div className="glass-panel rounded-xl p-4 border border-gray-800">
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
