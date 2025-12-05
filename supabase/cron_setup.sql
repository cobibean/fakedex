-- Server-Side Price Generation Architecture
-- NO CRON JOB NEEDED - The client triggers the Edge Function directly every second
-- This provides true real-time price generation with the server as the single source of truth

-- The generate-candles Edge Function is called by the leader client every second
-- It generates:
--   1. Raw 1-second candles (stored in 'candles' table)
--   2. Aggregated candles for all timeframes (stored in 'candles_aggregated' table)

-- HOW IT WORKS:
-- 1. Leader client opens home page with isLeader=true
-- 2. Every second, client calls: supabase.functions.invoke('generate-candles', { body: { symbol } })
-- 3. Edge Function generates next price using chaos engine algorithm
-- 4. Edge Function saves candle to 'candles' table
-- 5. Edge Function updates all aggregated timeframes in 'candles_aggregated'
-- 6. All clients receive updates via Supabase Realtime subscriptions

-- BENEFITS:
-- - Server is single source of truth (all clients see same prices)
-- - All timeframes use the same price data (no mismatch)
-- - Real-time experience (1-second updates)
-- - No cron job needed (client-triggered)

-- OPTIONAL: Backup cron for when no clients are connected
-- If you want prices to continue generating even when no one is viewing:
/*
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'generate-candles-backup',
  '* * * * *', -- Every minute (minimum interval for pg_cron)
  $$
  select net.http_post(
    url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/generate-candles',
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
-- You can test the Edge Function directly:
/*
select net.http_post(
  url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/generate-candles',
  headers := '{"Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
  body := '{"symbol": "COPE"}'::jsonb
) as request_id;
*/
