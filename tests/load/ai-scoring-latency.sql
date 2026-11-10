-- AI scoring latency (topic form NFR: "95% of applications receive their score within 60 seconds of submission").
-- Read-only. Measures completed_at - requested_at of every finished AI match result.
--
-- Run:  psql "$DATABASE_URL" -f tests/load/ai-scoring-latency.sql
-- Pass mark: p95_seconds <= 60 and within_60s_pct >= 95.
-- Optional: change the interval in the WHERE clause to look at a recent window only.

WITH done AS (
  SELECT EXTRACT(EPOCH FROM (completed_at - requested_at)) AS seconds
  FROM public.ai_match_result
  WHERE status = 'COMPLETED'
    AND completed_at IS NOT NULL
    AND requested_at >= now() - interval '90 days'
)
SELECT
  count(*)                                                                AS scored,
  round(avg(seconds)::numeric, 1)                                         AS avg_seconds,
  round(percentile_cont(0.50) WITHIN GROUP (ORDER BY seconds)::numeric, 1) AS p50_seconds,
  round(percentile_cont(0.95) WITHIN GROUP (ORDER BY seconds)::numeric, 1) AS p95_seconds,
  round(max(seconds)::numeric, 1)                                         AS max_seconds,
  round(100.0 * count(*) FILTER (WHERE seconds <= 60) / NULLIF(count(*), 0), 1) AS within_60s_pct
FROM done;

-- Results that never finished are part of the picture too.
SELECT status, count(*)
FROM public.ai_match_result
WHERE requested_at >= now() - interval '90 days'
GROUP BY status
ORDER BY count(*) DESC;
