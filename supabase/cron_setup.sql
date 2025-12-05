-- Cron Setup for Candle Aggregation
-- Run this SQL in your Supabase SQL Editor after deploying the Edge Function
-- Prerequisites: pg_cron and pg_net extensions must be enabled

-- Enable required extensions (if not already enabled)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Schedule the aggregate-candles Edge Function to run every minute
-- Replace <YOUR_PROJECT_REF> with your Supabase project reference (e.g., abcdefghijklmnop)
-- Replace <YOUR_SERVICE_ROLE_KEY> with your service role key from Supabase Dashboard > Settings > API

-- IMPORTANT: Run this AFTER deploying the Edge Function
-- You can find your project ref in your Supabase URL: https://<project-ref>.supabase.co

/*
-- Example command (uncomment and modify before running):
select cron.schedule(
  'aggregate-candles-every-minute',
  '* * * * *', -- Every minute
  $$
  select net.http_post(
    url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/aggregate-candles',
    headers := '{"Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
*/

-- To check scheduled jobs:
-- select * from cron.job;

-- To unschedule a job:
-- select cron.unschedule('aggregate-candles-every-minute');

-- To view job execution history:
-- select * from cron.job_run_details order by start_time desc limit 20;

-- Alternative: Manual one-time test of the Edge Function
-- This can be useful to verify the function works before scheduling
/*
select net.http_post(
  url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/aggregate-candles',
  headers := '{"Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
  body := '{}'::jsonb
) as request_id;
*/

