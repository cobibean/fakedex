// Supabase Edge Function: Candle Aggregator
// Runs via cron every minute to aggregate 1-second candles into larger timeframes
// and clean up old data based on retention policies

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Timeframe configurations with retention periods
const TIMEFRAMES = [
  { name: '1m', seconds: 60, retentionDays: 7 },
  { name: '5m', seconds: 300, retentionDays: 30 },
  { name: '15m', seconds: 900, retentionDays: 90 },
  { name: '1h', seconds: 3600, retentionDays: 365 },
  { name: '4h', seconds: 14400, retentionDays: 730 },
  { name: '1d', seconds: 86400, retentionDays: 1825 }, // ~5 years
];

// Raw 1-second candles retention (1 hour)
const RAW_CANDLE_RETENTION_SECONDS = 3600;

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface AggregatedCandle extends Candle {
  symbol: string;
  timeframe: string;
}

Deno.serve(async (req: Request) => {
  try {
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all trading pairs
    const { data: pairs, error: pairsError } = await supabase
      .from('pairs')
      .select('symbol');

    if (pairsError) {
      throw new Error(`Failed to fetch pairs: ${pairsError.message}`);
    }

    const symbols = pairs?.map(p => p.symbol) || [];
    const now = Math.floor(Date.now() / 1000);
    const results: { aggregated: number; cleaned: number } = { aggregated: 0, cleaned: 0 };

    // Process each symbol
    for (const symbol of symbols) {
      // Aggregate candles for each timeframe
      for (const tf of TIMEFRAMES) {
        const aggregated = await aggregateTimeframe(supabase, symbol, tf, now);
        results.aggregated += aggregated;
      }
    }

    // Cleanup old raw candles (older than 1 hour)
    const rawCutoff = now - RAW_CANDLE_RETENTION_SECONDS;
    const { count: rawDeleted } = await supabase
      .from('candles')
      .delete()
      .lt('time', rawCutoff)
      .select('*', { count: 'exact', head: true });
    
    results.cleaned += rawDeleted || 0;

    // Cleanup old aggregated candles based on retention
    for (const tf of TIMEFRAMES) {
      const cutoff = now - (tf.retentionDays * 86400);
      const { count: aggDeleted } = await supabase
        .from('candles_aggregated')
        .delete()
        .eq('timeframe', tf.name)
        .lt('time', cutoff)
        .select('*', { count: 'exact', head: true });
      
      results.cleaned += aggDeleted || 0;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Aggregated ${results.aggregated} candles, cleaned ${results.cleaned} old records`,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Aggregation error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});

async function aggregateTimeframe(
  supabase: ReturnType<typeof createClient>,
  symbol: string,
  tf: { name: string; seconds: number; retentionDays: number },
  now: number
): Promise<number> {
  // Calculate the current bucket and the one we should aggregate
  // We aggregate the PREVIOUS completed bucket, not the current one
  const currentBucket = Math.floor(now / tf.seconds) * tf.seconds;
  const previousBucket = currentBucket - tf.seconds;

  // Check if we already have this aggregated candle
  const { data: existing } = await supabase
    .from('candles_aggregated')
    .select('time')
    .eq('symbol', symbol)
    .eq('timeframe', tf.name)
    .eq('time', previousBucket)
    .single();

  if (existing) {
    // Already aggregated
    return 0;
  }

  // Fetch raw 1-second candles for this bucket
  const { data: rawCandles, error } = await supabase
    .from('candles')
    .select('time, open, high, low, close, volume')
    .eq('symbol', symbol)
    .gte('time', previousBucket)
    .lt('time', currentBucket)
    .order('time', { ascending: true });

  if (error) {
    console.error(`Failed to fetch candles for ${symbol} ${tf.name}:`, error);
    return 0;
  }

  if (!rawCandles || rawCandles.length === 0) {
    // No candles to aggregate - check if we can build from smaller aggregated candles
    // For example, 1h can be built from 1m candles
    const aggregated = await aggregateFromSmallerTimeframe(supabase, symbol, tf, previousBucket, currentBucket);
    if (aggregated) {
      return 1;
    }
    return 0;
  }

  // Aggregate the candles
  const aggregatedCandle = aggregateCandles(rawCandles as Candle[], previousBucket);

  // Upsert to candles_aggregated
  const { error: upsertError } = await supabase
    .from('candles_aggregated')
    .upsert({
      symbol,
      timeframe: tf.name,
      time: previousBucket,
      open: aggregatedCandle.open,
      high: aggregatedCandle.high,
      low: aggregatedCandle.low,
      close: aggregatedCandle.close,
      volume: aggregatedCandle.volume,
    }, { onConflict: 'symbol,timeframe,time' });

  if (upsertError) {
    console.error(`Failed to upsert ${symbol} ${tf.name}:`, upsertError);
    return 0;
  }

  return 1;
}

async function aggregateFromSmallerTimeframe(
  supabase: ReturnType<typeof createClient>,
  symbol: string,
  tf: { name: string; seconds: number },
  bucketStart: number,
  bucketEnd: number
): Promise<boolean> {
  // Determine which smaller timeframe to use
  let sourceTimeframe: string | null = null;
  
  if (tf.name === '5m') sourceTimeframe = '1m';
  else if (tf.name === '15m') sourceTimeframe = '5m';
  else if (tf.name === '1h') sourceTimeframe = '15m';
  else if (tf.name === '4h') sourceTimeframe = '1h';
  else if (tf.name === '1d') sourceTimeframe = '4h';
  else return false; // 1m must come from raw candles

  const { data: sourceCandles, error } = await supabase
    .from('candles_aggregated')
    .select('time, open, high, low, close, volume')
    .eq('symbol', symbol)
    .eq('timeframe', sourceTimeframe)
    .gte('time', bucketStart)
    .lt('time', bucketEnd)
    .order('time', { ascending: true });

  if (error || !sourceCandles || sourceCandles.length === 0) {
    return false;
  }

  const aggregatedCandle = aggregateCandles(sourceCandles as Candle[], bucketStart);

  const { error: upsertError } = await supabase
    .from('candles_aggregated')
    .upsert({
      symbol,
      timeframe: tf.name,
      time: bucketStart,
      open: aggregatedCandle.open,
      high: aggregatedCandle.high,
      low: aggregatedCandle.low,
      close: aggregatedCandle.close,
      volume: aggregatedCandle.volume,
    }, { onConflict: 'symbol,timeframe,time' });

  return !upsertError;
}

function aggregateCandles(candles: Candle[], bucketTime: number): Candle {
  if (candles.length === 0) {
    throw new Error('Cannot aggregate empty candle array');
  }

  // Sort by time to ensure correct open/close
  const sorted = [...candles].sort((a, b) => a.time - b.time);

  return {
    time: bucketTime,
    open: Number(sorted[0].open),
    high: Math.max(...sorted.map(c => Number(c.high))),
    low: Math.min(...sorted.map(c => Number(c.low))),
    close: Number(sorted[sorted.length - 1].close),
    volume: sorted.reduce((sum, c) => sum + Number(c.volume), 0),
  };
}

