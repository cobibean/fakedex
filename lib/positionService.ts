import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

export interface Position {
  id: string;
  user_id: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  leverage: number;
  entry_price: number;
  liquidation_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  status: 'open' | 'closed' | 'liquidated';
  exit_price: number | null;
  realized_pnl: number | null;
  created_at: string;
  closed_at: string | null;
}

export interface OpenPositionParams {
  userId: string;
  symbol: string;
  side: 'long' | 'short';
  size: number;
  leverage: number;
  entryPrice: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface ClosePositionParams {
  positionId: string;
  exitPrice: number;
}

/**
 * Calculate liquidation price based on position parameters
 * For longs: liq_price = entry_price * (1 - 1/leverage + maintenance_margin)
 * For shorts: liq_price = entry_price * (1 + 1/leverage - maintenance_margin)
 * Using 1% maintenance margin for simplicity
 */
export function calculateLiquidationPrice(
  entryPrice: number,
  leverage: number,
  side: 'long' | 'short'
): number {
  const maintenanceMargin = 0.01; // 1% maintenance margin
  
  if (side === 'long') {
    // Long position liquidates when price drops
    return entryPrice * (1 - (1 / leverage) + maintenanceMargin);
  } else {
    // Short position liquidates when price rises
    return entryPrice * (1 + (1 / leverage) - maintenanceMargin);
  }
}

/**
 * Calculate unrealized PnL for a position
 */
export function calculateUnrealizedPnL(
  position: Position,
  currentPrice: number
): number {
  const priceDiff = currentPrice - position.entry_price;
  const direction = position.side === 'long' ? 1 : -1;
  
  // PnL = (price_diff / entry_price) * size * leverage * direction
  const pnlPercent = (priceDiff / position.entry_price) * direction;
  return pnlPercent * position.size * position.leverage;
}

/**
 * Calculate PnL percentage
 */
export function calculatePnLPercent(
  position: Position,
  currentPrice: number
): number {
  const priceDiff = currentPrice - position.entry_price;
  const direction = position.side === 'long' ? 1 : -1;
  return (priceDiff / position.entry_price) * 100 * direction * position.leverage;
}

/**
 * Check if a position should be liquidated
 */
export function shouldLiquidate(
  position: Position,
  currentPrice: number
): boolean {
  if (position.side === 'long') {
    return currentPrice <= position.liquidation_price;
  } else {
    return currentPrice >= position.liquidation_price;
  }
}

/**
 * Check if stop loss should trigger
 */
export function shouldTriggerStopLoss(
  position: Position,
  currentPrice: number
): boolean {
  if (!position.stop_loss) return false;
  
  if (position.side === 'long') {
    return currentPrice <= position.stop_loss;
  } else {
    return currentPrice >= position.stop_loss;
  }
}

/**
 * Check if take profit should trigger
 */
export function shouldTriggerTakeProfit(
  position: Position,
  currentPrice: number
): boolean {
  if (!position.take_profit) return false;
  
  if (position.side === 'long') {
    return currentPrice >= position.take_profit;
  } else {
    return currentPrice <= position.take_profit;
  }
}

/**
 * Open a new position
 */
export async function openPosition(params: OpenPositionParams): Promise<{ success: boolean; position?: Position; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  const liquidationPrice = calculateLiquidationPrice(
    params.entryPrice,
    params.leverage,
    params.side
  );

  const { data, error } = await supabase
    .from('positions')
    .insert({
      user_id: params.userId,
      symbol: params.symbol,
      side: params.side,
      size: params.size,
      leverage: params.leverage,
      entry_price: params.entryPrice,
      liquidation_price: liquidationPrice,
      stop_loss: params.stopLoss || null,
      take_profit: params.takeProfit || null,
      status: 'open',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to open position:', error);
    return { success: false, error: error.message };
  }

  // Also record in trades table for history
  await supabase.from('trades').insert({
    user_id: params.userId,
    symbol: params.symbol,
    side: params.side === 'long' ? 'buy' : 'sell',
    size_fakeusd: params.size,
    price: params.entryPrice,
    leverage: params.leverage,
    is_bot: false,
  });

  return { success: true, position: data as Position };
}

/**
 * Close a position manually
 */
export async function closePosition(params: ClosePositionParams): Promise<{ success: boolean; position?: Position; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  // Fetch the position first
  const { data: position, error: fetchError } = await supabase
    .from('positions')
    .select('*')
    .eq('id', params.positionId)
    .single();

  if (fetchError || !position) {
    return { success: false, error: 'Position not found' };
  }

  if (position.status !== 'open') {
    return { success: false, error: 'Position is already closed' };
  }

  // Calculate realized PnL
  const realizedPnL = calculateUnrealizedPnL(position as Position, params.exitPrice);

  // Update the position
  const { data, error } = await supabase
    .from('positions')
    .update({
      status: 'closed',
      exit_price: params.exitPrice,
      realized_pnl: realizedPnL,
      closed_at: new Date().toISOString(),
    })
    .eq('id', params.positionId)
    .select()
    .single();

  if (error) {
    console.error('Failed to close position:', error);
    return { success: false, error: error.message };
  }

  // Record closing trade
  await supabase.from('trades').insert({
    user_id: position.user_id,
    symbol: position.symbol,
    side: position.side === 'long' ? 'sell' : 'buy', // Opposite side to close
    size_fakeusd: position.size,
    price: params.exitPrice,
    leverage: position.leverage,
    is_bot: false,
  });

  return { success: true, position: data as Position };
}

/**
 * Liquidate a position
 */
export async function liquidatePosition(positionId: string, liquidationPrice: number): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  // Fetch the position
  const { data: position, error: fetchError } = await supabase
    .from('positions')
    .select('*')
    .eq('id', positionId)
    .single();

  if (fetchError || !position) {
    return { success: false, error: 'Position not found' };
  }

  // Calculate loss (should be close to -100% of margin)
  const realizedPnL = -position.size; // Full loss of margin

  // Update the position
  const { error } = await supabase
    .from('positions')
    .update({
      status: 'liquidated',
      exit_price: liquidationPrice,
      realized_pnl: realizedPnL,
      closed_at: new Date().toISOString(),
    })
    .eq('id', positionId);

  if (error) {
    console.error('Failed to liquidate position:', error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get all open positions for a user
 */
export async function getUserOpenPositions(userId: string): Promise<Position[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch positions:', error);
    return [];
  }

  return data as Position[];
}

/**
 * Get all positions for a user (including closed)
 */
export async function getUserAllPositions(userId: string): Promise<Position[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch positions:', error);
    return [];
  }

  return data as Position[];
}

/**
 * Check and liquidate positions that should be liquidated
 */
export async function checkAndLiquidatePositions(
  symbol: string,
  currentPrice: number
): Promise<string[]> {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }

  // Fetch all open positions for this symbol
  const { data: positions, error } = await supabase
    .from('positions')
    .select('*')
    .eq('symbol', symbol)
    .eq('status', 'open');

  if (error || !positions) {
    return [];
  }

  const liquidatedIds: string[] = [];

  for (const position of positions) {
    if (shouldLiquidate(position as Position, currentPrice)) {
      const result = await liquidatePosition(position.id, currentPrice);
      if (result.success) {
        liquidatedIds.push(position.id);
      }
    }
  }

  return liquidatedIds;
}

