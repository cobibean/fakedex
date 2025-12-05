// Supabase Edge Function: Server-Side Candle Generator
// This is the SINGLE SOURCE OF TRUTH for all price generation
// Called every second by the leader client to generate canonical candles
// All timeframe aggregations happen here from the same price data

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Timeframe configurations for aggregation
const TIMEFRAMES = [
  { name: '1m', seconds: 60 },
  { name: '5m', seconds: 300 },
  { name: '15m', seconds: 900 },
  { name: '1h', seconds: 3600 },
  { name: '4h', seconds: 14400 },
  { name: '1d', seconds: 86400 },
];

// Retention periods (in seconds)
const RAW_CANDLE_RETENTION = 3600; // 1 hour
const AGGREGATED_RETENTION: Record<string, number> = {
  '1m': 7 * 86400,      // 7 days
  '5m': 30 * 86400,     // 30 days
  '15m': 90 * 86400,    // 90 days
  '1h': 365 * 86400,    // 1 year
  '4h': 730 * 86400,    // 2 years
  '1d': 1825 * 86400,   // 5 years
};

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface PairData {
  symbol: string;
  current_price: number;
  chaos_override: number | null;
}

/**
 * Generate next price using chaos engine algorithm
 * Ported from lib/chaosEngine.ts
 */
function generateNextCandle(previousClose: number, chaosLevel: number, time: number): Candle {
  // Chaos factor: 0.0 = calm, 1.0 = absolute mayhem
  const chaosFactor = Math.max(0, Math.min(100, chaosLevel)) / 100;

  // Volatility base:
  // At chaos 0: 0.05% per candle (very stable)
  // At chaos 100: 2% per candle (volatile meme territory)
  const volatility = 0.0005 + (chaosFactor * 0.0195);
  
  // Directional bias: slight bullish tendency
  const upBias = 0.0001 + (0.0003 * (1 - chaosFactor)); 

  // Random walk component (Gaussian-ish approximation using Box-Muller)
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  
  const changePercent = (z * volatility) + upBias;
  const newClose = previousClose * (1 + changePercent);
  
  // Determine High/Low based on volatility noise
  const wickMultiplier = 1.5 + (chaosFactor * 1.5);
  const wickVolatility = volatility * wickMultiplier;
  const high = Math.max(previousClose, newClose) * (1 + Math.random() * wickVolatility);
  const low = Math.min(previousClose, newClose) * (1 - Math.random() * wickVolatility);

  // Volume is correlated with volatility + chaos
  const baseVolume = 100000;
  const volumeNoise = Math.random() * baseVolume * (1 + chaosFactor * 10);
  const volume = baseVolume + volumeNoise;

  return {
    time,
    open: previousClose,
    high,
    low,
    close: newClose,
    volume: Math.floor(volume),
  };
}

/**
 * Update aggregated candles for all timeframes
 * This is called for each new 1-second candle to update the "current" bucket
 */
async function updateAggregatedCandles(
  supabase: ReturnType<typeof createClient>,
  symbol: string,
  candle: Candle
): Promise<void> {
  for (const tf of TIMEFRAMES) {
    // Calculate the bucket start time for this timeframe
    const bucketStart = Math.floor(candle.time / tf.seconds) * tf.seconds;
    
    // Try to get existing candle for this bucket
    const { data: existing } = await supabase
      .from('candles_aggregated')
      .select('open, high, low, close, volume')
      .eq('symbol', symbol)
      .eq('timeframe', tf.name)
      .eq('time', bucketStart)
      .single();
    
    if (existing) {
      // Update existing bucket - merge the new candle data
      await supabase
        .from('candles_aggregated')
        .update({
          high: Math.max(Number(existing.high), candle.high),
          low: Math.min(Number(existing.low), candle.low),
          close: candle.close,
          volume: Number(existing.volume) + candle.volume,
        })
        .eq('symbol', symbol)
        .eq('timeframe', tf.name)
        .eq('time', bucketStart);
    } else {
      // Create new bucket
      await supabase
        .from('candles_aggregated')
        .insert({
          symbol,
          timeframe: tf.name,
          time: bucketStart,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        });
    }
  }
}

/**
 * Cleanup old candles based on retention policies
 * Only runs occasionally to avoid overhead on every call
 */
async function cleanupOldCandles(
  supabase: ReturnType<typeof createClient>,
  now: number
): Promise<number> {
  let cleaned = 0;
  
  // Cleanup raw candles older than 1 hour
  const rawCutoff = now - RAW_CANDLE_RETENTION;
  const { count: rawDeleted } = await supabase
    .from('candles')
    .delete()
    .lt('time', rawCutoff)
    .select('*', { count: 'exact', head: true });
  cleaned += rawDeleted || 0;
  
  // Cleanup aggregated candles based on their retention
  for (const tf of TIMEFRAMES) {
    const cutoff = now - AGGREGATED_RETENTION[tf.name];
    const { count: aggDeleted } = await supabase
      .from('candles_aggregated')
      .delete()
      .eq('timeframe', tf.name)
      .lt('time', cutoff)
      .select('*', { count: 'exact', head: true });
    cleaned += aggDeleted || 0;
  }
  
  return cleaned;
}

// CORS headers for client-side access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request - can specify a single symbol or process all
    let targetSymbol: string | null = null;
    let doCleanup = false;
    
    try {
      const body = await req.json();
      targetSymbol = body.symbol || null;
      doCleanup = body.cleanup === true;
    } catch {
      // No body or invalid JSON - process all pairs
    }

    const now = Math.floor(Date.now() / 1000);
    
    // Get global chaos level
    const { data: settings } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'global_chaos_level')
      .single();
    
    const globalChaos = settings?.value?.level ?? 50;

    // Get pairs to process
    let pairsQuery = supabase
      .from('pairs')
      .select('symbol, current_price, chaos_override, initial_price');
    
    if (targetSymbol) {
      pairsQuery = pairsQuery.eq('symbol', targetSymbol);
    }
    
    const { data: pairs, error: pairsError } = await pairsQuery;
    
    if (pairsError || !pairs) {
      throw new Error(`Failed to fetch pairs: ${pairsError?.message}`);
    }

    const generatedCandles: Array<{ symbol: string; candle: Candle }> = [];

    // Generate candle for each pair
    for (const pair of pairs) {
      // Use current_price if available, otherwise fall back to initial_price
      const currentPrice = Number(pair.current_price) || Number(pair.initial_price) || 1;
      const chaosLevel = pair.chaos_override ?? globalChaos;
      
      // Generate the next candle
      const candle = generateNextCandle(currentPrice, chaosLevel, now);
      
      // Save 1-second candle
      const { error: insertError } = await supabase
        .from('candles')
        .upsert({
          symbol: pair.symbol,
          time: now,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
        }, { onConflict: 'symbol,time' });
      
      if (insertError) {
        console.error(`Failed to insert candle for ${pair.symbol}:`, insertError);
        continue;
      }
      
      // Update current price in pairs table
      await supabase
        .from('pairs')
        .update({ 
          current_price: candle.close,
          last_candle_time: now 
        })
        .eq('symbol', pair.symbol);
      
      // Update aggregated candles for all timeframes
      await updateAggregatedCandles(supabase, pair.symbol, candle);
      
      generatedCandles.push({ symbol: pair.symbol, candle });
    }

    // Cleanup old candles (only if requested or randomly ~1% of the time)
    let cleanedCount = 0;
    if (doCleanup || Math.random() < 0.01) {
      cleanedCount = await cleanupOldCandles(supabase, now);
    }

    return new Response(
      JSON.stringify({
        success: true,
        generated: generatedCandles.length,
        cleaned: cleanedCount,
        timestamp: now,
        candles: generatedCandles,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Generate candles error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

