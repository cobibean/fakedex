'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import { 
  Position, 
  getUserOpenPositions, 
  closePosition, 
  calculateUnrealizedPnL,
  calculatePnLPercent,
  shouldLiquidate,
  liquidatePosition,
  shouldTriggerStopLoss,
  shouldTriggerTakeProfit
} from '@/lib/positionService';
import { useAllPrices } from './useChaosEngine';

export interface PositionWithPnL extends Position {
  unrealizedPnL: number;
  pnlPercent: number;
  currentPrice: number;
  isLiquidatable: boolean;
  shouldTriggerSL: boolean;
  shouldTriggerTP: boolean;
}

export function usePositions() {
  const account = useActiveAccount();
  const { prices } = useAllPrices();
  const [rawPositions, setRawPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const liquidatingRef = useRef<Set<string>>(new Set());

  // Get user ID from wallet address
  useEffect(() => {
    if (!account?.address || !isSupabaseConfigured || !supabase) {
      setUserId(null);
      setLoading(false);
      return;
    }

    const fetchUserId = async () => {
      const { data } = await supabase
        .from('users')
        .select('id')
        .eq('wallet_address', account.address)
        .single();
      
      if (data) {
        setUserId(data.id);
      }
    };

    fetchUserId();
  }, [account?.address]);

  // Fetch positions and subscribe to updates (only depends on userId, not prices)
  useEffect(() => {
    if (!userId || !isSupabaseConfigured || !supabase) {
      setRawPositions([]);
      setLoading(false);
      return;
    }

    const fetchPositions = async () => {
      setLoading(true);
      const openPositions = await getUserOpenPositions(userId);
      setRawPositions(openPositions);
      setLoading(false);
    };

    fetchPositions();

    // Subscribe to position updates
    const subscription = supabase
      .channel(`user-positions-${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'positions',
        filter: `user_id=eq.${userId}`
      }, () => {
        // Refetch on any change
        fetchPositions();
      })
      .subscribe();

    return () => {
      subscription?.unsubscribe();
    };
  }, [userId]);

  // Compute positions with PnL from raw positions + prices
  const positions: PositionWithPnL[] = useMemo(() => {
    return rawPositions.map(pos => {
      const currentPrice = prices[pos.symbol] || pos.entry_price;
      return {
        ...pos,
        unrealizedPnL: calculateUnrealizedPnL(pos, currentPrice),
        pnlPercent: calculatePnLPercent(pos, currentPrice),
        currentPrice,
        isLiquidatable: shouldLiquidate(pos, currentPrice),
        shouldTriggerSL: shouldTriggerStopLoss(pos, currentPrice),
        shouldTriggerTP: shouldTriggerTakeProfit(pos, currentPrice),
      };
    });
  }, [rawPositions, prices]);

  // Check for liquidations, stop loss, and take profit triggers
  useEffect(() => {
    const checkTriggersAndLiquidations = async () => {
      for (const pos of positions) {
        if (pos.status !== 'open' || liquidatingRef.current.has(pos.id)) continue;
        
        // Priority: Liquidation > Stop Loss > Take Profit
        if (pos.isLiquidatable) {
          liquidatingRef.current.add(pos.id);
          console.log(`[LIQUIDATION] Position ${pos.id} liquidated at ${pos.currentPrice}`);
          await liquidatePosition(pos.id, pos.currentPrice);
          liquidatingRef.current.delete(pos.id);
        } else if (pos.shouldTriggerSL && pos.stop_loss) {
          liquidatingRef.current.add(pos.id);
          console.log(`[STOP LOSS] Position ${pos.id} closed at ${pos.stop_loss}`);
          await closePosition({ positionId: pos.id, exitPrice: pos.stop_loss });
          liquidatingRef.current.delete(pos.id);
        } else if (pos.shouldTriggerTP && pos.take_profit) {
          liquidatingRef.current.add(pos.id);
          console.log(`[TAKE PROFIT] Position ${pos.id} closed at ${pos.take_profit}`);
          await closePosition({ positionId: pos.id, exitPrice: pos.take_profit });
          liquidatingRef.current.delete(pos.id);
        }
      }
    };

    const hasTriggeredPositions = positions.some(p => 
      p.isLiquidatable || p.shouldTriggerSL || p.shouldTriggerTP
    );
    
    if (hasTriggeredPositions) {
      checkTriggersAndLiquidations();
    }
  }, [positions]);

  // Close position handler
  const handleClosePosition = useCallback(async (positionId: string, exitPrice: number) => {
    const result = await closePosition({ positionId, exitPrice });
    return result;
  }, []);

  // Calculate totals
  const totalUnrealizedPnL = positions.reduce((sum, pos) => sum + pos.unrealizedPnL, 0);
  const totalMargin = positions.reduce((sum, pos) => sum + pos.size_fakeusd, 0);

  return {
    positions,
    loading,
    userId,
    totalUnrealizedPnL,
    totalMargin,
    closePosition: handleClosePosition,
    refetch: async () => {
      if (userId) {
        const openPositions = await getUserOpenPositions(userId);
        setRawPositions(openPositions);
      }
    }
  };
}

