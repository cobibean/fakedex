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
  liquidatePosition
} from '@/lib/positionService';
import { useAllPrices } from './useChaosEngine';

export interface PositionWithPnL extends Position {
  unrealizedPnL: number;
  pnlPercent: number;
  currentPrice: number;
  isLiquidatable: boolean;
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
      };
    });
  }, [rawPositions, prices]);

  // Check for liquidations
  useEffect(() => {
    const checkLiquidations = async () => {
      for (const pos of positions) {
        if (pos.isLiquidatable && pos.status === 'open' && !liquidatingRef.current.has(pos.id)) {
          liquidatingRef.current.add(pos.id);
          await liquidatePosition(pos.id, pos.currentPrice);
          liquidatingRef.current.delete(pos.id);
        }
      }
    };

    if (positions.some(p => p.isLiquidatable)) {
      checkLiquidations();
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

