import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { Position } from './positionService';

export interface UserStats {
  totalTrades: number;
  totalVolume: number;
  winRate: number;
  avgLeverage: number;
  biggestWin: number;
  biggestLoss: number;
  totalRealizedPnL: number;
  winCount: number;
  lossCount: number;
  liquidationCount: number;
  openPositionsCount: number;
  totalUnrealizedPnL: number;
  tradingDays: number;
}

export const DEFAULT_STATS: UserStats = {
  totalTrades: 0,
  totalVolume: 0,
  winRate: 0,
  avgLeverage: 1,
  biggestWin: 0,
  biggestLoss: 0,
  totalRealizedPnL: 0,
  winCount: 0,
  lossCount: 0,
  liquidationCount: 0,
  openPositionsCount: 0,
  totalUnrealizedPnL: 0,
  tradingDays: 0,
};

/**
 * Calculate comprehensive stats for a user based on their positions
 */
export async function calculateUserStats(userId: string): Promise<UserStats> {
  if (!isSupabaseConfigured || !supabase) {
    return DEFAULT_STATS;
  }

  try {
    // Fetch all positions for the user
    const { data: positions, error } = await supabase
      .from('positions')
      .select('*')
      .eq('user_id', userId);

    if (error || !positions) {
      console.error('Failed to fetch positions for stats:', error);
      return DEFAULT_STATS;
    }

    // Separate open and closed positions
    const openPositions = positions.filter(p => p.status === 'open');
    const closedPositions = positions.filter(p => p.status === 'closed' || p.status === 'liquidated');
    const liquidatedPositions = positions.filter(p => p.status === 'liquidated');

    // Calculate wins and losses
    const wins = closedPositions.filter(p => Number(p.realized_pnl) > 0);
    const losses = closedPositions.filter(p => Number(p.realized_pnl) <= 0);

    // Calculate total volume (sum of all position sizes * leverage)
    const totalVolume = positions.reduce((sum, p) => sum + Number(p.size) * p.leverage, 0);

    // Calculate average leverage
    const avgLeverage = positions.length > 0
      ? positions.reduce((sum, p) => sum + p.leverage, 0) / positions.length
      : 1;

    // Calculate realized PnL
    const totalRealizedPnL = closedPositions.reduce((sum, p) => sum + Number(p.realized_pnl || 0), 0);

    // Find biggest win and loss
    const biggestWin = wins.length > 0
      ? Math.max(...wins.map(p => Number(p.realized_pnl)))
      : 0;
    const biggestLoss = losses.length > 0
      ? Math.min(...losses.map(p => Number(p.realized_pnl)))
      : 0;

    // Calculate win rate
    const winRate = closedPositions.length > 0
      ? (wins.length / closedPositions.length) * 100
      : 0;

    // Calculate trading days (unique days with positions opened)
    const tradingDays = new Set(
      positions.map(p => new Date(p.created_at).toDateString())
    ).size;

    // For unrealized PnL, we need current prices
    // This is a simplified version - the hook will calculate this with live prices
    const totalUnrealizedPnL = 0; // Will be calculated in the hook with live prices

    return {
      totalTrades: positions.length,
      totalVolume,
      winRate,
      avgLeverage,
      biggestWin,
      biggestLoss: Math.abs(biggestLoss),
      totalRealizedPnL,
      winCount: wins.length,
      lossCount: losses.length,
      liquidationCount: liquidatedPositions.length,
      openPositionsCount: openPositions.length,
      totalUnrealizedPnL,
      tradingDays,
    };
  } catch (error) {
    console.error('Error calculating user stats:', error);
    return DEFAULT_STATS;
  }
}

/**
 * Get position history for a user (closed positions)
 */
export async function getPositionHistory(userId: string, limit: number = 50): Promise<Position[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['closed', 'liquidated'])
    .order('closed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to fetch position history:', error);
    return [];
  }

  return data as Position[];
}

/**
 * Get leaderboard data
 */
export async function getLeaderboard(limit: number = 10): Promise<{
  byPnL: { userId: string; username: string; pnl: number }[];
  byVolume: { userId: string; username: string; volume: number }[];
  byWinRate: { userId: string; username: string; winRate: number; trades: number }[];
}> {
  if (!isSupabaseConfigured || !supabase) {
    return { byPnL: [], byVolume: [], byWinRate: [] };
  }

  try {
    // Get all closed positions grouped by user
    const { data: positions } = await supabase
      .from('positions')
      .select(`
        user_id,
        size,
        leverage,
        realized_pnl,
        status,
        users!inner(username)
      `)
      .in('status', ['closed', 'liquidated']);

    if (!positions) return { byPnL: [], byVolume: [], byWinRate: [] };

    // Group by user
    const userStats = new Map<string, {
      userId: string;
      username: string;
      totalPnL: number;
      totalVolume: number;
      wins: number;
      total: number;
    }>();

    positions.forEach((p: { user_id: string; size: string; leverage: number; realized_pnl: string | null; status: string; users: { username: string } }) => {
      const existing = userStats.get(p.user_id) || {
        userId: p.user_id,
        username: p.users?.username || 'Anonymous',
        totalPnL: 0,
        totalVolume: 0,
        wins: 0,
        total: 0,
      };

      existing.totalPnL += Number(p.realized_pnl || 0);
      existing.totalVolume += Number(p.size) * p.leverage;
      existing.total += 1;
      if (Number(p.realized_pnl || 0) > 0) existing.wins += 1;

      userStats.set(p.user_id, existing);
    });

    const users = Array.from(userStats.values());

    return {
      byPnL: users
        .sort((a, b) => b.totalPnL - a.totalPnL)
        .slice(0, limit)
        .map(u => ({ userId: u.userId, username: u.username, pnl: u.totalPnL })),
      byVolume: users
        .sort((a, b) => b.totalVolume - a.totalVolume)
        .slice(0, limit)
        .map(u => ({ userId: u.userId, username: u.username, volume: u.totalVolume })),
      byWinRate: users
        .filter(u => u.total >= 5) // Minimum 5 trades for win rate ranking
        .sort((a, b) => (b.wins / b.total) - (a.wins / a.total))
        .slice(0, limit)
        .map(u => ({ 
          userId: u.userId, 
          username: u.username, 
          winRate: (u.wins / u.total) * 100,
          trades: u.total
        })),
    };
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return { byPnL: [], byVolume: [], byWinRate: [] };
  }
}

