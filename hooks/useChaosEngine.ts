/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useRef } from 'react';
import { generateNextCandle, generateInitialHistory, Candle } from '@/lib/chaosEngine';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

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
      if (!isSupabaseConfigured || !supabase) {
        setGlobalChaos(50);
        setChaosLevel(50);
        return;
      }

      const { data: settings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'global_chaos_level')
        .single();
      
      const globalLevel = settings?.value?.level ?? 50;
      setGlobalChaos(globalLevel);

      const { data: pairData } = await supabase
        .from('pairs')
        .select('chaos_override')
        .eq('symbol', symbol)
        .single();
      
      const override = pairData?.chaos_override;
      
      setChaosLevel(override !== null && override !== undefined ? override : globalLevel);
    };

    fetchChaosConfig();

    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    const subscription = supabase
      .channel('chaos-updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'settings' }, (payload) => {
         if (payload.new.key === 'global_chaos_level') {
            const newGlobal = payload.new.value.level;
            setGlobalChaos(newGlobal);
            setChaosLevel((prev) => prev === globalChaos ? newGlobal : prev); 
         }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pairs', filter: `symbol=eq.${symbol}` }, (payload) => {
          const newOverride = payload.new.chaos_override;
          setChaosLevel(newOverride !== null ? newOverride : globalChaos);
      })
      .subscribe();

    return () => {
      subscription?.unsubscribe();
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
      // Ensure each candle has a unique, strictly increasing timestamp
      // Use the last candle's time + 1 second to guarantee ascending order
      const nextTime = last.time + 1;
      
      const next = generateNextCandle(last.close, chaosLevel, nextTime);
      
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

