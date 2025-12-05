-- Server-Side Price Generation Architecture with Smart Coordination
-- ANY client can trigger candle generation - no designated "leader" needed

-- The generate-candles Edge Function is called by clients every second
-- It generates:
--   1. Raw 1-second candles (stored in 'candles' table)
--   2. Aggregated candles for all timeframes (stored in 'candles_aggregated' table)

-- HOW SMART COORDINATION WORKS:
-- 1. Any client (home page OR pair page) can trigger candle generation
-- 2. Before triggering, client checks `last_candle_time` in pairs table
-- 3. If no candle was generated in the last 2 seconds, client triggers Edge Function
-- 4. Edge Function generates next price using chaos engine algorithm
-- 5. Edge Function saves candle to 'candles' table for ALL pairs
-- 6. Edge Function updates all aggregated timeframes in 'candles_aggregated'
-- 7. All clients receive updates via Supabase Realtime subscriptions

-- BENEFITS:
-- - Server is single source of truth (all clients see same prices)
-- - All timeframes use the same price data (no mismatch)
-- - Real-time experience (1-second updates)
-- - No designated "leader" - any client can keep the system running
-- - Graceful handoff when clients disconnect (next client takes over)

-- ============================================================================
-- EXTERNAL CRON BACKUP (FREE) - For when NO clients are connected
-- ============================================================================
-- 
-- Without any clients connected, no candles will generate. To keep the system
-- alive 24/7, set up a FREE external cron job to call the Edge Function.
--
-- OPTION A: cron-job.org (FREE - up to 1-minute intervals)
-- 1. Go to https://cron-job.org and create a free account
-- 2. Create a new cron job with:
--    - URL: https://jcaoswmspniwlaklvfuh.supabase.co/functions/v1/generate-candles
--    - Schedule: Every 1 minute (or every 5 minutes to conserve resources)
--    - Method: POST
--    - Headers:
--      * Content-Type: application/json
--      * Authorization: Bearer <YOUR_ANON_KEY>
--    - Body: {}
-- 3. Save and enable the cron job
--
-- OPTION B: GitHub Actions (FREE - minimum 5-minute intervals)
-- Create .github/workflows/generate-candles.yml:
/*
name: Generate Candles
on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:  # Manual trigger
jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger candle generation
        run: |
          curl -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            https://jcaoswmspniwlaclvfuh.supabase.co/functions/v1/generate-candles
*/
--
-- OPTION C: UptimeRobot (FREE - every 5 minutes)
-- 1. Go to https://uptimerobot.com and create a free account
-- 2. Create a new HTTP(s) monitor:
--    - Type: HTTP(s)
--    - URL: https://jcaoswmspniwlaklvfuh.supabase.co/functions/v1/generate-candles
--    - Monitoring Interval: 5 minutes
--    Note: UptimeRobot uses GET requests, so this won't actually generate candles
--    but will keep the function warm

-- ============================================================================
-- OPTIONAL: Supabase pg_cron (if you want database-level backup)
-- ============================================================================
-- NOTE: pg_cron minimum interval is 1 minute, not 1 second
/*
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'generate-candles-backup',
  '* * * * *', -- Every minute (minimum interval for pg_cron)
  $$
  select net.http_post(
    url := 'https://jcaoswmspniwlaklvfuh.supabase.co/functions/v1/generate-candles',
    headers := '{"Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
*/

-- CLEANUP:
-- The Edge Function automatically cleans up old candles:
-- - Raw candles: Retained for 1 hour
-- - 1m candles: 7 days
-- - 5m candles: 30 days  
-- - 15m candles: 90 days
-- - 1h candles: 1 year
-- - 4h candles: 2 years
-- - 1d candles: 5 years

-- MANUAL TEST:
-- You can test the Edge Function directly via curl:
/*
curl -X POST \
  -H "Content-Type: application/json" \
  https://jcaoswmspniwlaklvfuh.supabase.co/functions/v1/generate-candles
*/
