/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef, useCallback } from 'react';
import { generateNextCandle, generateInitialHistory, Candle } from '@/lib/chaosEngine';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';

interface UseChaosEngineOptions {
  symbol: string;
  initialPrice: number;
  intervalMs?: number;
  isLeader?: boolean; // If true, this client TRIGGERS the server to generate candles
}

// Max candles to store - needs to be high enough for larger timeframes
// 3600 = 1 hour of 1-second candles = 60 one-minute candles
const MAX_CANDLES = 3600;

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
  const pendingLocalCandle = useRef<Candle | null>(null);

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

  /**
   * Save candle to database directly (fallback when Edge Function isn't available)
   */
  const saveCandleToDb = useCallback(async (candle: Candle) => {
    if (!isSupabaseConfigured || !supabase) return;
    
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
      
      // Update current price in pairs table
      await supabase
        .from('pairs')
        .update({ current_price: candle.close })
        .eq('symbol', symbolRef.current);
        
    } catch (error) {
      console.error('[CANDLES] Failed to save candle:', error);
    }
  }, []);

  /**
   * Call the server-side Edge Function to generate a canonical candle
   * Falls back to local generation + direct DB save if Edge Function fails
   */
  const triggerServerCandleGeneration = useCallback(async (localCandle: Candle | null) => {
    if (!isSupabaseConfigured || !supabase) return null;
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-candles', {
        body: { symbol: symbolRef.current }
      });
      
      if (error) {
        // Edge Function failed (likely JWT verification issue)
        // Fall back to saving local candle directly to DB
        if (localCandle) {
          await saveCandleToDb(localCandle);
        }
        return null;
      }
      
      // The candle will arrive via realtime subscription
      return data?.candles?.[0]?.candle || null;
    } catch (error) {
      // Edge Function failed - fall back to local save
      if (localCandle) {
        await saveCandleToDb(localCandle);
      }
      return null;
    }
  }, [saveCandleToDb]);

  /**
   * Generate a LOCAL candle for instant display (hybrid mode)
   * This will be replaced when the server candle arrives
   */
  const generateLocalCandle = useCallback(() => {
    if (!lastCandleRef.current) return null;
    
    const last = lastCandleRef.current;
    const nextTime = Math.floor(Date.now() / 1000);
    
    // Don't generate if we already have a candle for this second
    if (last.time >= nextTime) return null;
    
    return generateNextCandle(last.close, chaosLevel, nextTime);
  }, [chaosLevel]);

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

    // Subscribe to realtime updates for pair settings
    const subscription = supabase
      .channel(`price-updates-${symbol}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'pairs',
        filter: `symbol=eq.${symbol}`
      }, (payload) => {
        // Update price from DB
        if (payload.new.current_price) {
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
        // No Supabase - generate random history locally
        const history = generateInitialHistory(currentPrice, chaosLevel, MAX_CANDLES, 1);
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
        .limit(MAX_CANDLES);

      if (error) {
        console.error('Failed to load candles:', error);
      }

      if (existingCandles && existingCandles.length > 0) {
        // Use existing candles from DB (server-generated)
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
      } else {
        // No candles in DB - start with empty and let server generate
        console.log(`[CANDLES] No existing candles for ${symbol}, waiting for server generation`);
        
        // Generate minimal local history for display while waiting
        const history = generateInitialHistory(currentPrice, chaosLevel, 60, 1);
        setCandles(history);
        lastCandleRef.current = history[history.length - 1];
      }
      
      setIsInitialized(true);
    };

    initializeCandles();
  }, [currentPrice, chaosLevel, symbol, isInitialized]);

  // 3. Subscribe to new candles from DB (ALL clients - both leader and followers)
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const subscription = supabase
      .channel(`candles-${symbol}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'candles',
        filter: `symbol=eq.${symbol}`
      }, (payload) => {
        const serverCandle: Candle = {
          time: payload.new.time,
          open: Number(payload.new.open),
          high: Number(payload.new.high),
          low: Number(payload.new.low),
          close: Number(payload.new.close),
          volume: Number(payload.new.volume),
        };
        
        setCandles(prev => {
          // Replace any local candle with the same time, or add new
          const filtered = prev.filter(c => c.time !== serverCandle.time);
          const updated = [...filtered, serverCandle].sort((a, b) => a.time - b.time);
          if (updated.length > MAX_CANDLES) {
            return updated.slice(-MAX_CANDLES);
          }
          return updated;
        });
        
        lastCandleRef.current = serverCandle;
        setCurrentPrice(serverCandle.close);
        
        // Clear pending local candle since server candle arrived
        pendingLocalCandle.current = null;
      })
      .subscribe();

    return () => {
      subscription?.unsubscribe();
    };
  }, [symbol]);

  // 4. Leader triggers server-side candle generation every second
  // Also generates local candle for instant display (hybrid mode)
  useEffect(() => {
    if (!isInitialized) return;
    if (!isLeaderRef.current) return; // Only leader triggers server

    const interval = setInterval(async () => {
      // Generate local candle for instant display
      const localCandle = generateLocalCandle();
      if (localCandle) {
        pendingLocalCandle.current = localCandle;
        
        // Add local candle to display immediately
        setCandles((prev) => {
          // Don't add if we already have a candle for this time
          if (prev.some(c => c.time === localCandle.time)) return prev;
          const newHistory = [...prev, localCandle];
          if (newHistory.length > MAX_CANDLES) newHistory.shift();
          return newHistory;
        });
        
        lastCandleRef.current = localCandle;
        setCurrentPrice(localCandle.close);
      }
      
      // Trigger server to generate canonical candle
      // This will arrive via realtime subscription and replace local candle
      // If Edge Function fails, it will fall back to saving local candle directly
      await triggerServerCandleGeneration(localCandle);
      
    }, intervalMs);

    return () => clearInterval(interval);
  }, [chaosLevel, isInitialized, intervalMs, generateLocalCandle, triggerServerCandleGeneration]);

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
      try {
        const { data, error } = await supabase
          .from('pairs')
          .select('symbol, current_price');
        
        if (error) {
          console.error('[useAllPrices] Fetch error:', error);
          return;
        }
        
        if (data) {
          const priceMap: Record<string, number> = {};
          data.forEach(pair => {
            // Handle numeric strings from Supabase - use parseFloat for better handling
            const price = parseFloat(String(pair.current_price));
            priceMap[pair.symbol] = isNaN(price) ? 0 : price;
          });
          setPrices(priceMap);
        }
      } catch (err) {
        console.error('[useAllPrices] Fetch exception:', err);
      } finally {
        setLoading(false);
      }
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
        // Use proper null checks instead of truthy checks (0 is a valid price)
        const newData = payload.new as { current_price?: string | number; symbol?: string };
        if (newData.symbol !== undefined && newData.current_price !== undefined && newData.current_price !== null) {
          const price = parseFloat(String(newData.current_price));
          if (!isNaN(price)) {
            setPrices(prev => ({
              ...prev,
              [newData.symbol as string]: price
            }));
          }
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[useAllPrices] Realtime subscription active');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('[useAllPrices] Realtime subscription error');
        }
      });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  return { prices, loading };
}

// Timeframe definitions for aggregated candles
export const AGGREGATED_TIMEFRAMES = {
  '1m': { seconds: 60, dbTimeframe: '1m', maxCandles: 10080 },      // 7 days
  '5m': { seconds: 300, dbTimeframe: '5m', maxCandles: 8640 },      // 30 days  
  '15m': { seconds: 900, dbTimeframe: '15m', maxCandles: 8640 },    // 90 days
  '1h': { seconds: 3600, dbTimeframe: '1h', maxCandles: 8760 },     // 1 year
  '4h': { seconds: 14400, dbTimeframe: '4h', maxCandles: 4380 },    // 2 years
  '1d': { seconds: 86400, dbTimeframe: '1d', maxCandles: 1825 },    // 5 years
} as const;

export type AggregatedTimeframe = keyof typeof AGGREGATED_TIMEFRAMES;

/**
 * Hook to fetch aggregated candles for longer timeframes (1m, 5m, 15m, 1h, 4h, 1d)
 * These are pre-aggregated by the Edge Function and stored in candles_aggregated table
 */
export function useAggregatedCandles(symbol: string, timeframe: AggregatedTimeframe) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tfConfig = AGGREGATED_TIMEFRAMES[timeframe];

  useEffect(() => {
    if (!symbol || !timeframe) return;

    const fetchCandles = async () => {
      setLoading(true);
      setError(null);

      if (!isSupabaseConfigured || !supabase) {
        // Generate mock data if no Supabase
        const mockCandles = generateInitialHistory(100, 50, 100, tfConfig.seconds);
        setCandles(mockCandles);
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('candles_aggregated')
          .select('time, open, high, low, close, volume')
          .eq('symbol', symbol)
          .eq('timeframe', tfConfig.dbTimeframe)
          .order('time', { ascending: true })
          .limit(tfConfig.maxCandles);

        if (fetchError) {
          console.error(`[useAggregatedCandles] Fetch error for ${symbol} ${timeframe}:`, fetchError);
          setError(fetchError.message);
          setLoading(false);
          return;
        }

        if (data && data.length > 0) {
          const loadedCandles: Candle[] = data.map(c => ({
            time: c.time,
            open: Number(c.open),
            high: Number(c.high),
            low: Number(c.low),
            close: Number(c.close),
            volume: Number(c.volume),
          }));
          setCandles(loadedCandles);
          console.log(`[useAggregatedCandles] Loaded ${loadedCandles.length} ${timeframe} candles for ${symbol}`);
        } else {
          // No aggregated candles yet - this is normal for a new deployment
          console.log(`[useAggregatedCandles] No ${timeframe} candles found for ${symbol} (waiting for server generation)`);
          setCandles([]);
        }
      } catch (err) {
        console.error(`[useAggregatedCandles] Exception:`, err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchCandles();

    // Subscribe to aggregated candle updates (INSERT and UPDATE)
    if (!isSupabaseConfigured || !supabase) return;

    const subscription = supabase
      .channel(`agg-candles-${symbol}-${timeframe}`)
      .on('postgres_changes', {
        event: '*', // Listen for INSERT and UPDATE
        schema: 'public',
        table: 'candles_aggregated',
        filter: `symbol=eq.${symbol}`
      }, (payload) => {
        // Only process candles for our timeframe
        if (payload.new && (payload.new as { timeframe?: string }).timeframe !== tfConfig.dbTimeframe) return;

        const newCandle: Candle = {
          time: (payload.new as { time: number }).time,
          open: Number((payload.new as { open: string | number }).open),
          high: Number((payload.new as { high: string | number }).high),
          low: Number((payload.new as { low: string | number }).low),
          close: Number((payload.new as { close: string | number }).close),
          volume: Number((payload.new as { volume: string | number }).volume),
        };

        setCandles(prev => {
          // Replace existing candle with same time or add new
          const filtered = prev.filter(c => c.time !== newCandle.time);
          const updated = [...filtered, newCandle].sort((a, b) => a.time - b.time);
          // Trim to max candles
          if (updated.length > tfConfig.maxCandles) {
            return updated.slice(-tfConfig.maxCandles);
          }
          return updated;
        });
      })
      .subscribe();

    return () => {
      subscription?.unsubscribe();
    };
  }, [symbol, timeframe, tfConfig.dbTimeframe, tfConfig.maxCandles, tfConfig.seconds]);

  return { candles, loading, error };
}
