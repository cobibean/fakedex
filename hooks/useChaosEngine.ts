/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useCallback } from 'react';
import { generateNextCandle, generateInitialHistory, Candle } from '@/lib/chaosEngine';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

interface UseChaosEngineOptions {
  symbol: string;
  initialPrice: number;
  intervalMs?: number;
  isLeader?: boolean; // If true, this client generates and saves candles
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
  const [isInitialized, setIsInitialized] = useState(false);
  
  const lastCandleRef = useRef<Candle | null>(null);
  const isLeaderRef = useRef(isLeader);
  const symbolRef = useRef(symbol);
  const previousSymbolRef = useRef(symbol);

  // Update refs when props change
  useEffect(() => {
    isLeaderRef.current = isLeader;
    symbolRef.current = symbol;
  }, [isLeader, symbol]);

  // Reset when symbol changes
  useEffect(() => {
    if (previousSymbolRef.current !== symbol) {
      previousSymbolRef.current = symbol;
      setCandles([]);
      lastCandleRef.current = null;
      setCurrentPrice(initialPrice);
      setIsInitialized(false);
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

  // Save candle to database (only if leader)
  const saveCandleToDb = useCallback(async (candle: Candle) => {
    if (!isLeaderRef.current || !isSupabaseConfigured || !supabase) return;
    
    try {
      await supabase
        .from('candles')
        .upsert({
          symbol: symbolRef.current,
          time: candle.time,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        }, { onConflict: 'symbol,time' });
    } catch (error) {
      console.error('Failed to save candle:', error);
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

  // 2. Load candles from DB or generate initial history
  useEffect(() => {
    if (isInitialized || currentPrice <= 0) return;

    const initializeCandles = async () => {
      if (!isSupabaseConfigured || !supabase) {
        // No Supabase - generate random history
        const history = generateInitialHistory(currentPrice, chaosLevel, 200, 1);
        setCandles(history);
        lastCandleRef.current = history[history.length - 1];
        setIsInitialized(true);
        return;
      }

      // Try to load existing candles from DB
      const { data: existingCandles, error } = await supabase
        .from('candles')
        .select('*')
        .eq('symbol', symbol)
        .order('time', { ascending: true })
        .limit(200);

      if (error) {
        console.error('Failed to load candles:', error);
      }

      if (existingCandles && existingCandles.length > 0) {
        // Use existing candles from DB
        const loadedCandles: Candle[] = existingCandles.map(c => ({
          time: c.time,
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume),
        }));
        
        setCandles(loadedCandles);
        const last = loadedCandles[loadedCandles.length - 1];
        lastCandleRef.current = last;
        setCurrentPrice(last.close);
        console.log(`[CANDLES] Loaded ${loadedCandles.length} candles for ${symbol} from DB`);
      } else if (isLeaderRef.current) {
        // No candles in DB and we're the leader - generate initial history
        const history = generateInitialHistory(currentPrice, chaosLevel, 200, 1);
        setCandles(history);
        lastCandleRef.current = history[history.length - 1];
        
        // Save initial history to DB
        console.log(`[CANDLES] Generating and saving ${history.length} candles for ${symbol}`);
        const candlesToSave = history.map(c => ({
          symbol,
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
        }));
        
        // Batch insert in chunks to avoid payload limits
        const chunkSize = 50;
        for (let i = 0; i < candlesToSave.length; i += chunkSize) {
          const chunk = candlesToSave.slice(i, i + chunkSize);
          await supabase.from('candles').upsert(chunk, { onConflict: 'symbol,time' });
        }
      } else {
        // Not leader and no candles - generate local history (will sync when leader runs)
        const history = generateInitialHistory(currentPrice, chaosLevel, 200, 1);
        setCandles(history);
        lastCandleRef.current = history[history.length - 1];
      }
      
      setIsInitialized(true);
    };

    initializeCandles();
  }, [currentPrice, chaosLevel, symbol, isInitialized]);

  // 3. Subscribe to new candles from DB (for non-leader clients)
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || isLeaderRef.current) return;

    const subscription = supabase
      .channel(`candles-${symbol}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'candles',
        filter: `symbol=eq.${symbol}`
      }, (payload) => {
        const newCandle: Candle = {
          time: payload.new.time,
          open: Number(payload.new.open),
          high: Number(payload.new.high),
          low: Number(payload.new.low),
          close: Number(payload.new.close),
          volume: Number(payload.new.volume),
        };
        
        setCandles(prev => {
          // Avoid duplicates
          if (prev.some(c => c.time === newCandle.time)) return prev;
          const updated = [...prev, newCandle];
          if (updated.length > 200) updated.shift();
          return updated;
        });
        
        lastCandleRef.current = newCandle;
        setCurrentPrice(newCandle.close);
      })
      .subscribe();

    return () => {
      subscription?.unsubscribe();
    };
  }, [symbol]);

  // 4. Live Updates - Leader generates and saves candles
  useEffect(() => {
    if (!lastCandleRef.current || !isInitialized) return;
    if (!isLeaderRef.current) return; // Non-leaders get candles via subscription

    const interval = setInterval(() => {
      const last = lastCandleRef.current!;
      const nextTime = last.time + 1;
      
      const next = generateNextCandle(last.close, chaosLevel, nextTime);
      
      setCandles((prev) => {
        const newHistory = [...prev, next];
        if (newHistory.length > 200) newHistory.shift();
        return newHistory;
      });
      
      lastCandleRef.current = next;
      setCurrentPrice(next.close);
      
      // Save candle and price to DB
      saveCandleToDb(next);
      updatePriceInDb(next.close);
      
    }, 1000);

    return () => clearInterval(interval);
  }, [chaosLevel, isInitialized, saveCandleToDb, updatePriceInDb]);

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
