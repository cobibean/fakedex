# Aggregated Candles Deployment Guide

This guide covers deploying the long-term price history feature using Supabase Edge Functions and pg_cron.

## Overview

The system aggregates 1-second candles into longer timeframes (1m, 5m, 15m, 1h, 4h, 1d) and automatically cleans up old data to stay within free tier limits.

**Storage Budget (~42 MB total):**
- 1 second candles: 1 hour retention (~3 MB)
- 1 minute candles: 7 days retention (~9 MB)
- 5 minute candles: 30 days retention (~8 MB)
- 15 minute candles: 90 days retention (~8 MB)
- 1 hour candles: 1 year retention (~8 MB)
- 4 hour candles: 2 years retention (~4 MB)
- 1 day candles: 5 years retention (~2 MB)

## Step 1: Deploy Schema Changes

Run the following SQL in your Supabase SQL Editor (Dashboard > SQL Editor):

```sql
-- Aggregated candle history for long-term chart persistence
create table if not exists public.candles_aggregated (
  id uuid primary key default gen_random_uuid(),
  symbol text not null references public.pairs(symbol) on delete cascade,
  timeframe text not null check (timeframe in ('1m','5m','15m','1h','4h','1d')),
  time integer not null,
  open numeric(38, 18) not null,
  high numeric(38, 18) not null,
  low numeric(38, 18) not null,
  close numeric(38, 18) not null,
  volume numeric(38, 18) not null,
  unique (symbol, timeframe, time)
);

-- Index for efficient queries
create index if not exists idx_candles_agg_query 
  on public.candles_aggregated (symbol, timeframe, time desc);

-- Enable realtime updates
alter publication supabase_realtime add table candles_aggregated;
```

## Step 2: Deploy the Edge Function

### Option A: Using Supabase CLI (Recommended)

1. Install Supabase CLI if you haven't:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref <YOUR_PROJECT_REF>
   ```

4. Deploy the function:
   ```bash
   supabase functions deploy aggregate-candles
   ```

### Option B: Via Supabase Dashboard

1. Go to Dashboard > Edge Functions
2. Click "New Function"
3. Name it `aggregate-candles`
4. Copy the contents of `supabase/functions/aggregate-candles/index.ts` into the editor
5. Deploy

## Step 3: Test the Edge Function

Before scheduling, test the function manually:

1. Go to Dashboard > Edge Functions > aggregate-candles
2. Click "Test" or use curl:

```bash
curl -X POST 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/aggregate-candles' \
  -H 'Authorization: Bearer <YOUR_SERVICE_ROLE_KEY>' \
  -H 'Content-Type: application/json'
```

You should see a response like:
```json
{
  "success": true,
  "message": "Aggregated 6 candles, cleaned 0 old records",
  "timestamp": "2024-01-15T12:00:00.000Z"
}
```

## Step 4: Schedule the Cron Job

### Option A: Using pg_cron (Recommended)

1. Enable extensions in SQL Editor:
   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;
   ```

2. Schedule the function (replace placeholders):
   ```sql
   select cron.schedule(
     'aggregate-candles-every-minute',
     '* * * * *',
     $$
     select net.http_post(
       url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/aggregate-candles',
       headers := '{"Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ) as request_id;
     $$
   );
   ```

3. Verify the job is scheduled:
   ```sql
   select * from cron.job;
   ```

### Option B: External Cron Service

If pg_cron is not available, use an external service:

- **Vercel Cron**: Add to `vercel.json`
- **GitHub Actions**: Schedule a workflow
- **cron-job.org**: Free cron service

Example GitHub Action (`.github/workflows/aggregate-candles.yml`):
```yaml
name: Aggregate Candles
on:
  schedule:
    - cron: '* * * * *' # Every minute (GitHub may throttle this)
jobs:
  aggregate:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/aggregate-candles" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_KEY }}" \
            -H "Content-Type: application/json"
```

## Step 5: Verify Everything Works

1. **Check aggregated candles are being created:**
   ```sql
   select timeframe, count(*) 
   from candles_aggregated 
   group by timeframe 
   order by timeframe;
   ```

2. **Check cron job execution history:**
   ```sql
   select * from cron.job_run_details 
   order by start_time desc 
   limit 10;
   ```

3. **Check old candles are being cleaned:**
   ```sql
   -- Should only have candles from the last hour
   select count(*), min(time), max(time) 
   from candles;
   ```

## Troubleshooting

### Edge Function not running
- Check function logs: Dashboard > Edge Functions > aggregate-candles > Logs
- Verify service role key is correct
- Test manually with curl

### Cron job not firing
- Verify pg_cron extension is enabled: `select * from pg_extension where extname = 'pg_cron';`
- Check job is scheduled: `select * from cron.job;`
- Check execution history: `select * from cron.job_run_details order by start_time desc limit 10;`

### No aggregated candles appearing
- Ensure raw 1-second candles exist in `candles` table first
- The aggregator only processes completed time buckets (e.g., waits until minute 2 to aggregate minute 1)
- Check Edge Function logs for errors

## Maintenance

### Manually trigger aggregation
```sql
select net.http_post(
  url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/aggregate-candles',
  headers := '{"Authorization": "Bearer <YOUR_SERVICE_ROLE_KEY>", "Content-Type": "application/json"}'::jsonb,
  body := '{}'::jsonb
);
```

### Remove cron job
```sql
select cron.unschedule('aggregate-candles-every-minute');
```

### Check storage usage
```sql
select 
  pg_size_pretty(pg_total_relation_size('candles')) as raw_candles_size,
  pg_size_pretty(pg_total_relation_size('candles_aggregated')) as aggregated_candles_size;
```

