import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

export interface Position {
  id: string;
  user_id: string;
  symbol: string;
  side: 'long' | 'short';
  size_fakeusd: number;
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
 * 
 * MORE GENEROUS than real exchanges to make the game more fun!
 * 
 * Real exchange formula: Entry × (1 - 1/leverage + maintenance)
 * Our formula:           Entry × (1 - 1/leverage - buffer)
 * 
 * The buffer gives you EXTRA room before liquidation.
 * 
 * Examples at $1.00 entry with 2% buffer:
 * - 5x Long:  liq at $0.78 (22% room) vs real ~20%
 * - 10x Long: liq at $0.88 (12% room) vs real ~9.5%
 * - 20x Long: liq at $0.93 (7% room)  vs real ~4.5%
 * - 50x Long: liq at $0.96 (4% room)  vs real ~1.5%
 */
export function calculateLiquidationPrice(
  entryPrice: number,
  leverage: number,
  side: 'long' | 'short'
): number {
  // 2% generous buffer - gives MORE room than real exchanges
  // This makes the game more forgiving and fun
  const generousBuffer = 0.02;
  
  if (side === 'long') {
    // Long position liquidates when price drops
    // We SUBTRACT the buffer to give MORE room before liquidation
    return entryPrice * (1 - (1 / leverage) - generousBuffer);
  } else {
    // Short position liquidates when price rises
    // We ADD the buffer to give MORE room before liquidation
    return entryPrice * (1 + (1 / leverage) + generousBuffer);
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
  return pnlPercent * position.size_fakeusd * position.leverage;
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
      size_fakeusd: params.size,
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

  // Return margin + PnL to user's balance
  // Margin is returned, plus any profit (or minus any loss)
  const returnAmount = position.size_fakeusd + realizedPnL;
  
  // Fetch current balance
  const { data: currentBalance } = await supabase
    .from('user_balances')
    .select('amount')
    .eq('user_id', position.user_id)
    .eq('symbol', 'FAKEUSD')
    .maybeSingle();
  
  const newBalance = (Number(currentBalance?.amount) || 0) + returnAmount;
  
  // Update balance
  await supabase.from('user_balances').upsert({
    user_id: position.user_id,
    symbol: 'FAKEUSD',
    amount: Math.max(0, newBalance), // Don't go below 0
  }, { onConflict: 'user_id,symbol' });

  console.log(`[CLOSE] Position ${params.positionId}: Margin ${position.size_fakeusd} + PnL ${realizedPnL.toFixed(2)} = ${returnAmount.toFixed(2)} returned. New balance: ${newBalance.toFixed(2)}`);

  // Record closing trade
  await supabase.from('trades').insert({
    user_id: position.user_id,
    symbol: position.symbol,
    side: position.side === 'long' ? 'sell' : 'buy', // Opposite side to close
    size_fakeusd: position.size_fakeusd,
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
  const realizedPnL = -position.size_fakeusd; // Full loss of margin

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

