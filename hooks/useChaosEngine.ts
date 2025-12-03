/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useCallback } from 'react';
import { generateNextCandle, generateInitialHistory, Candle } from '@/lib/chaosEngine';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

interface UseChaosEngineOptions {
  symbol: string;
  initialPrice: number;
  intervalMs?: number;
  isLeader?: boolean; // If true, this client updates prices in Supabase
}

export function useChaosEngine({ 
  symbol, 
  initialPrice, 
  intervalMs = 1000,
  isLeader = false 
}: UseChaosEngineOptions) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(initialPrice);
  const [chaosLevel, setChaosLevel] = useState<number>(50);
  const [globalChaos, setGlobalChaos] = useState<number>(50);
  
  const lastCandleRef = useRef<Candle | null>(null);
  const isLeaderRef = useRef(isLeader);
  const symbolRef = useRef(symbol);
  const previousSymbolRef = useRef(symbol);

  // Update refs when props change
  useEffect(() => {
    isLeaderRef.current = isLeader;
    symbolRef.current = symbol;
  }, [isLeader, symbol]);

  // Reset candles when symbol changes (for ticker switching)
  useEffect(() => {
    if (previousSymbolRef.current !== symbol) {
      previousSymbolRef.current = symbol;
      // Clear candles to force re-initialization with new pair's data
      setCandles([]);
      lastCandleRef.current = null;
      setCurrentPrice(initialPrice);
    }
  }, [symbol, initialPrice]);

  // Update price in Supabase (only if leader)
  const updatePriceInDb = useCallback(async (price: number) => {
    if (!isLeaderRef.current || !isSupabaseConfigured || !supabase) return;
    
    try {
      await supabase
        .from('pairs')
        .update({ current_price: price })
        .eq('symbol', symbolRef.current);
    } catch (error) {
      console.error('Failed to update price in DB:', error);
    }
  }, []);

  // 1. Fetch Global Chaos & Current Price
  useEffect(() => {
    const fetchConfig = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setGlobalChaos(50);
        setChaosLevel(50);
        return;
      }

      // Fetch settings
      const { data: settings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'global_chaos_level')
        .single();
      
      const globalLevel = settings?.value?.level ?? 50;
      setGlobalChaos(globalLevel);

      // Fetch pair data including current price
      const { data: pairData } = await supabase
        .from('pairs')
        .select('chaos_override, current_price')
        .eq('symbol', symbol)
        .single();
      
      const override = pairData?.chaos_override;
      setChaosLevel(override !== null && override !== undefined ? override : globalLevel);
      
      // Use current_price from DB if available
      if (pairData?.current_price) {
        setCurrentPrice(Number(pairData.current_price));
      }
    };

    fetchConfig();

    if (!isSupabaseConfigured || !supabase) return;

    // Subscribe to realtime updates
    const subscription = supabase
      .channel(`price-updates-${symbol}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'pairs',
        filter: `symbol=eq.${symbol}`
      }, (payload) => {
        // Update price from DB (for non-leader clients)
        if (!isLeaderRef.current && payload.new.current_price) {
          setCurrentPrice(Number(payload.new.current_price));
        }
        // Update chaos override
        const newOverride = payload.new.chaos_override;
        if (newOverride !== undefined) {
          setChaosLevel(newOverride !== null ? newOverride : globalChaos);
        }
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'settings' 
      }, (payload) => {
        if (payload.new.key === 'global_chaos_level') {
          const newGlobal = payload.new.value.level;
          setGlobalChaos(newGlobal);
        }
      })
      .subscribe();

    return () => {
      subscription?.unsubscribe();
    };
  }, [symbol, globalChaos]);

  // 2. Initialize History (always 1-second base candles)
  useEffect(() => {
    if (candles.length === 0 && currentPrice > 0) {
      // Generate 1-second base candles - timeframe aggregation happens in chart
      const history = generateInitialHistory(currentPrice, chaosLevel, 200, 1);
      setCandles(history);
      const last = history[history.length - 1];
      lastCandleRef.current = last;
    }
  }, [currentPrice, chaosLevel, candles.length]);

  // 3. Live Updates (The Chaos Heartbeat) - Generate 1-second base candles
  useEffect(() => {
    if (!lastCandleRef.current) return;

    // Always generate 1-second candles - timeframe aggregation happens in chart
    const interval = setInterval(() => {
      const last = lastCandleRef.current!;
      const nextTime = last.time + 1; // Always 1 second increment
      
      const next = generateNextCandle(last.close, chaosLevel, nextTime);
      
      setCandles((prev) => {
        const newHistory = [...prev, next];
        if (newHistory.length > 200) newHistory.shift();
        return newHistory;
      });
      
      lastCandleRef.current = next;
      setCurrentPrice(next.close);
      
      // Leader updates the price in DB
      if (isLeaderRef.current) {
        updatePriceInDb(next.close);
      }
      
    }, 1000); // Always 1-second ticks - aggregation to timeframes happens in chart

    return () => clearInterval(interval);
  }, [chaosLevel, updatePriceInDb]);

  return {
    candles,
    currentPrice,
    chaosLevel,
    isOverride: chaosLevel !== globalChaos
  };
}

// Hook to get current price for a symbol (for position PnL calculations)
export function useCurrentPrice(symbol: string) {
  const [price, setPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    const fetchPrice = async () => {
      const { data } = await supabase
        .from('pairs')
        .select('current_price')
        .eq('symbol', symbol)
        .single();
      
      if (data?.current_price) {
        setPrice(Number(data.current_price));
      }
      setLoading(false);
    };

    fetchPrice();

    // Subscribe to price updates
    const subscription = supabase
      .channel(`price-${symbol}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'pairs',
        filter: `symbol=eq.${symbol}`
      }, (payload) => {
        if (payload.new.current_price) {
          setPrice(Number(payload.new.current_price));
        }
      })
      .subscribe();

    return () => {
      subscription?.unsubscribe();
    };
  }, [symbol]);

  return { price, loading };
}

// Hook to get all current prices
export function useAllPrices() {
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    const fetchPrices = async () => {
      const { data } = await supabase
        .from('pairs')
        .select('symbol, current_price');
      
      if (data) {
        const priceMap: Record<string, number> = {};
        data.forEach(pair => {
          priceMap[pair.symbol] = Number(pair.current_price) || 0;
        });
        setPrices(priceMap);
      }
      setLoading(false);
    };

    fetchPrices();

    // Subscribe to all price updates
    const subscription = supabase
      .channel('all-prices')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'pairs'
      }, (payload) => {
        if (payload.new.current_price && payload.new.symbol) {
          setPrices(prev => ({
            ...prev,
            [payload.new.symbol]: Number(payload.new.current_price)
          }));
        }
      })
      .subscribe();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  return { prices, loading };
}
