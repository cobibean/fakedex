'use client';

import { useState, useEffect, useCallback } from 'react';
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
  const [positions, setPositions] = useState<PositionWithPnL[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

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

  // Fetch positions and subscribe to updates
  useEffect(() => {
    if (!userId || !isSupabaseConfigured || !supabase) {
      setPositions([]);
      setLoading(false);
      return;
    }

    const fetchPositions = async () => {
      setLoading(true);
      const openPositions = await getUserOpenPositions(userId);
      
      // Enrich with PnL data
      const enriched = openPositions.map(pos => {
        const currentPrice = prices[pos.symbol] || pos.entry_price;
        return {
          ...pos,
          unrealizedPnL: calculateUnrealizedPnL(pos, currentPrice),
          pnlPercent: calculatePnLPercent(pos, currentPrice),
          currentPrice,
          isLiquidatable: shouldLiquidate(pos, currentPrice),
        };
      });
      
      setPositions(enriched);
      setLoading(false);
    };

    fetchPositions();

    // Subscribe to position updates
    const subscription = supabase
      .channel('user-positions')
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
  }, [userId, prices]);

  // Update PnL when prices change
  useEffect(() => {
    if (positions.length === 0) return;

    setPositions(prev => prev.map(pos => {
      const currentPrice = prices[pos.symbol] || pos.entry_price;
      return {
        ...pos,
        unrealizedPnL: calculateUnrealizedPnL(pos, currentPrice),
        pnlPercent: calculatePnLPercent(pos, currentPrice),
        currentPrice,
        isLiquidatable: shouldLiquidate(pos, currentPrice),
      };
    }));
  }, [prices]);

  // Check for liquidations
  useEffect(() => {
    const checkLiquidations = async () => {
      for (const pos of positions) {
        if (pos.isLiquidatable && pos.status === 'open') {
          await liquidatePosition(pos.id, pos.currentPrice);
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
  const totalMargin = positions.reduce((sum, pos) => sum + pos.size, 0);

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
        const enriched = openPositions.map(pos => {
          const currentPrice = prices[pos.symbol] || pos.entry_price;
          return {
            ...pos,
            unrealizedPnL: calculateUnrealizedPnL(pos, currentPrice),
            pnlPercent: calculatePnLPercent(pos, currentPrice),
            currentPrice,
            isLiquidatable: shouldLiquidate(pos, currentPrice),
          };
        });
        setPositions(enriched);
      }
    }
  };
}

