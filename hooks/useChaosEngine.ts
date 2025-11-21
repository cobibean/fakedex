import { useState, useEffect, useRef, useCallback } from 'react';
import { generateNextCandle, generateInitialHistory, Candle } from '@/lib/chaosEngine';
import { supabase } from '@/lib/supabaseClient';
import { Pair } from '@/lib/types';

interface UseChaosEngineOptions {
  symbol: string;
  initialPrice: number;
  intervalMs?: number; // Default 1000ms for "live" feel
}

export function useChaosEngine({ symbol, initialPrice, intervalMs = 1000 }: UseChaosEngineOptions) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(initialPrice);
  const [chaosLevel, setChaosLevel] = useState<number>(0);
  const [globalChaos, setGlobalChaos] = useState<number>(0);
  
  // We use refs for mutable state accessed in intervals to avoid closure staleness
  const lastCandleRef = useRef<Candle | null>(null);
  
  // 1. Fetch Global Chaos & Pair Override
  useEffect(() => {
    const fetchChaosConfig = async () => {
      // Fetch global setting
      const { data: settings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'global_chaos_level')
        .single();
      
      const globalLevel = settings?.value?.level || 50; // Default to 50 if missing
      setGlobalChaos(globalLevel);

      // Fetch pair override
      const { data: pairData } = await supabase
        .from('pairs')
        .select('chaos_override')
        .eq('symbol', symbol)
        .single();
      
      const override = pairData?.chaos_override;
      
      // Determine effective chaos
      // If override is not null/undefined, use it. Else use global.
      setChaosLevel(override !== null && override !== undefined ? override : globalLevel);
    };

    fetchChaosConfig();

    // Subscribe to changes in settings and pairs for real-time updates
    const subscription = supabase
      .channel('chaos-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settings' }, (payload) => {
         if (payload.new.key === 'global_chaos_level') {
            const newGlobal = payload.new.value.level;
            setGlobalChaos(newGlobal);
            // We'll need to re-check override here ideally, but for V1 simple reactivity:
            // If we don't have an override, update local level.
            // (Optimally we'd store 'hasOverride' in state, but let's trust the effect re-run or simple check)
            setChaosLevel((prev) => prev === globalChaos ? newGlobal : prev); 
         }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pairs', filter: `symbol=eq.${symbol}` }, (payload) => {
          const newOverride = payload.new.chaos_override;
          setChaosLevel(newOverride !== null ? newOverride : globalChaos);
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [symbol, globalChaos]);


  // 2. Initialize History
  useEffect(() => {
    if (candles.length === 0) {
      const history = generateInitialHistory(initialPrice, chaosLevel);
      setCandles(history);
      const last = history[history.length - 1];
      lastCandleRef.current = last;
      setCurrentPrice(last.close);
    }
  }, [initialPrice, chaosLevel, candles.length]);

  // 3. Live Updates (The Chaos Heartbeat)
  useEffect(() => {
    if (!lastCandleRef.current) return;

    const interval = setInterval(() => {
      const last = lastCandleRef.current!;
      const now = Math.floor(Date.now() / 1000);
      
      // In a real chart, we might update the *current* candle if within same minute,
      // or push a new one. For V1 visual flair, let's push a new "tick" every interval
      // but effectively we are simulating a new candle every X seconds.
      // For smooth UI, we'll generate a new candle "tick" that represents a new time slice.
      
      // Note: To prevent memory leaks in V1 array, we slice simulated history.
      
      const next = generateNextCandle(last.close, chaosLevel, now);
      
      setCandles((prev) => {
        const newHistory = [...prev, next];
        if (newHistory.length > 200) newHistory.shift(); // Keep buffer manageable
        return newHistory;
      });
      
      lastCandleRef.current = next;
      setCurrentPrice(next.close);
      
    }, intervalMs);

    return () => clearInterval(interval);
  }, [chaosLevel, intervalMs]);

  return {
    candles,
    currentPrice,
    chaosLevel,
    isOverride: chaosLevel !== globalChaos
  };
}

