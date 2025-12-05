// Supabase Edge Function: Candle Aggregator
// Runs via cron every minute to aggregate 1-second candles into larger timeframes
// and clean up old data based on retention policies
// Now includes backfill logic to process all available historical data

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

// Max buckets to process per run (to avoid timeouts)
const MAX_BUCKETS_PER_RUN = 100;

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
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
      // Aggregate candles for each timeframe (with backfill)
      for (const tf of TIMEFRAMES) {
        const aggregated = await aggregateTimeframeWithBackfill(supabase, symbol, tf, now);
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

    // IMPORTANT: Remove aggregated candles that are outside the range of raw candles
    // This prevents price discontinuity when raw candles are regenerated with new random prices
    for (const symbol of symbols) {
      // Get the oldest raw candle time for this symbol
      const { data: oldestRaw } = await supabase
        .from('candles')
        .select('time')
        .eq('symbol', symbol)
        .order('time', { ascending: true })
        .limit(1)
        .single();
      
      if (oldestRaw) {
        // Delete any aggregated candles older than the oldest raw candle
        // This ensures aggregated data stays in sync with raw data
        const { count: syncDeleted } = await supabase
          .from('candles_aggregated')
          .delete()
          .eq('symbol', symbol)
          .lt('time', oldestRaw.time)
          .select('*', { count: 'exact', head: true });
        
        results.cleaned += syncDeleted || 0;
      }
    }

    // Cleanup old aggregated candles based on retention (additional safety)
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

/**
 * Aggregate all available time buckets for a symbol/timeframe, including backfill
 */
async function aggregateTimeframeWithBackfill(
  supabase: ReturnType<typeof createClient>,
  symbol: string,
  tf: { name: string; seconds: number; retentionDays: number },
  now: number
): Promise<number> {
  // For 1m timeframe, aggregate from raw candles
  // For larger timeframes, we can aggregate from smaller aggregated candles
  
  if (tf.name === '1m') {
    return await aggregateFromRawCandles(supabase, symbol, tf, now);
  } else {
    return await aggregateFromSmallerTimeframe(supabase, symbol, tf, now);
  }
}

/**
 * Aggregate 1m candles from raw 1-second candles (with backfill)
 */
async function aggregateFromRawCandles(
  supabase: ReturnType<typeof createClient>,
  symbol: string,
  tf: { name: string; seconds: number; retentionDays: number },
  now: number
): Promise<number> {
  // Get the time range of available raw candles
  const { data: timeRange, error: rangeError } = await supabase
    .from('candles')
    .select('time')
    .eq('symbol', symbol)
    .order('time', { ascending: true })
    .limit(1);

  if (rangeError || !timeRange || timeRange.length === 0) {
    return 0;
  }

  const oldestRawTime = timeRange[0].time;
  const currentBucket = Math.floor(now / tf.seconds) * tf.seconds;
  
  // Start from the bucket containing the oldest raw candle
  const startBucket = Math.floor(oldestRawTime / tf.seconds) * tf.seconds;
  
  // Get existing aggregated candles for this symbol/timeframe
  const { data: existingCandles } = await supabase
    .from('candles_aggregated')
    .select('time')
    .eq('symbol', symbol)
    .eq('timeframe', tf.name);
  
  const existingTimes = new Set(existingCandles?.map(c => c.time) || []);
  
  // Find buckets that need aggregation
  const bucketsToProcess: number[] = [];
  for (let bucket = startBucket; bucket < currentBucket && bucketsToProcess.length < MAX_BUCKETS_PER_RUN; bucket += tf.seconds) {
    if (!existingTimes.has(bucket)) {
      bucketsToProcess.push(bucket);
    }
  }
  
  if (bucketsToProcess.length === 0) {
    return 0;
  }
  
  let aggregatedCount = 0;
  
  // Process each bucket
  for (const bucketStart of bucketsToProcess) {
    const bucketEnd = bucketStart + tf.seconds;
    
    // Fetch raw candles for this bucket
    const { data: rawCandles, error } = await supabase
      .from('candles')
      .select('time, open, high, low, close, volume')
      .eq('symbol', symbol)
      .gte('time', bucketStart)
      .lt('time', bucketEnd)
      .order('time', { ascending: true });
    
    if (error || !rawCandles || rawCandles.length === 0) {
      continue;
    }
    
    // Aggregate
    const aggregatedCandle = aggregateCandles(rawCandles as Candle[], bucketStart);
    
    // Upsert
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
    
    if (!upsertError) {
      aggregatedCount++;
    }
  }
  
  return aggregatedCount;
}

/**
 * Aggregate larger timeframes from smaller aggregated candles
 */
async function aggregateFromSmallerTimeframe(
  supabase: ReturnType<typeof createClient>,
  symbol: string,
  tf: { name: string; seconds: number; retentionDays: number },
  now: number
): Promise<number> {
  // Determine source timeframe
  let sourceTimeframe: string;
  let sourceSeconds: number;
  
  if (tf.name === '5m') { sourceTimeframe = '1m'; sourceSeconds = 60; }
  else if (tf.name === '15m') { sourceTimeframe = '5m'; sourceSeconds = 300; }
  else if (tf.name === '1h') { sourceTimeframe = '15m'; sourceSeconds = 900; }
  else if (tf.name === '4h') { sourceTimeframe = '1h'; sourceSeconds = 3600; }
  else if (tf.name === '1d') { sourceTimeframe = '4h'; sourceSeconds = 14400; }
  else return 0;
  
  // Get the time range of available source candles
  const { data: timeRange, error: rangeError } = await supabase
    .from('candles_aggregated')
    .select('time')
    .eq('symbol', symbol)
    .eq('timeframe', sourceTimeframe)
    .order('time', { ascending: true })
    .limit(1);

  if (rangeError || !timeRange || timeRange.length === 0) {
    return 0;
  }

  const oldestSourceTime = timeRange[0].time;
  const currentBucket = Math.floor(now / tf.seconds) * tf.seconds;
  
  // Start from the bucket containing the oldest source candle
  const startBucket = Math.floor(oldestSourceTime / tf.seconds) * tf.seconds;
  
  // Get existing aggregated candles for this symbol/timeframe
  const { data: existingCandles } = await supabase
    .from('candles_aggregated')
    .select('time')
    .eq('symbol', symbol)
    .eq('timeframe', tf.name);
  
  const existingTimes = new Set(existingCandles?.map(c => c.time) || []);
  
  // Find buckets that need aggregation
  const bucketsToProcess: number[] = [];
  for (let bucket = startBucket; bucket < currentBucket && bucketsToProcess.length < MAX_BUCKETS_PER_RUN; bucket += tf.seconds) {
    if (!existingTimes.has(bucket)) {
      bucketsToProcess.push(bucket);
    }
  }
  
  if (bucketsToProcess.length === 0) {
    return 0;
  }
  
  let aggregatedCount = 0;
  
  // Process each bucket
  for (const bucketStart of bucketsToProcess) {
    const bucketEnd = bucketStart + tf.seconds;
    
    // Fetch source candles for this bucket
    const { data: sourceCandles, error } = await supabase
      .from('candles_aggregated')
      .select('time, open, high, low, close, volume')
      .eq('symbol', symbol)
      .eq('timeframe', sourceTimeframe)
      .gte('time', bucketStart)
      .lt('time', bucketEnd)
      .order('time', { ascending: true });
    
    if (error || !sourceCandles || sourceCandles.length === 0) {
      continue;
    }
    
    // Aggregate
    const aggregatedCandle = aggregateCandles(sourceCandles as Candle[], bucketStart);
    
    // Upsert
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
    
    if (!upsertError) {
      aggregatedCount++;
    }
  }
  
  return aggregatedCount;
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
