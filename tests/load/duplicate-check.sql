-- Duplicate-check path (topic form: "the duplicate-submission check must run synchronously before a CV is
-- accepted, with accuracy on exact email/phone matches"; Work Package 6 load test of this path).
--
-- The check runs inside the CV submission, so a load test through the API would create real applications.
-- Instead this script times the exact lookups the check makes, straight on the database, and shows that
-- each one is served by an index. Read-only: EXPLAIN ANALYZE of SELECTs only.
--
-- Run:  psql "$DATABASE_URL" -f tests/load/duplicate-check.sql
-- Pass mark: every plan uses an Index Scan / Index Only Scan / Bitmap Index Scan and "Execution Time" < 5 ms.

\timing on

-- 1) How many rows the check searches today.
SELECT
  (SELECT count(*) FROM public.candidate)                    AS candidates,
  (SELECT count(*) FROM public.submission_identity_snapshot) AS submission_snapshots;

-- 2) Candidate by e-mail or phone (CandidateRepository, the exact-match check).
EXPLAIN (ANALYZE, BUFFERS)
SELECT candidate_id
FROM public.candidate
WHERE status IN ('ACTIVE', 'INACTIVE')
  AND (normalized_email = (SELECT normalized_email FROM public.candidate WHERE normalized_email IS NOT NULL LIMIT 1)
       OR normalized_phone = (SELECT normalized_phone FROM public.candidate WHERE normalized_phone IS NOT NULL LIMIT 1));

-- 3) Earlier submissions with the same e-mail HMAC (affiliate first-submission attribution).
EXPLAIN (ANALYZE, BUFFERS)
SELECT submission_id
FROM public.submission_identity_snapshot
WHERE (email_hmac, hmac_key_version) IN (
  SELECT email_hmac, hmac_key_version FROM public.submission_identity_snapshot WHERE email_hmac IS NOT NULL LIMIT 1);

-- 4) Same for the phone HMAC.
EXPLAIN (ANALYZE, BUFFERS)
SELECT submission_id
FROM public.submission_identity_snapshot
WHERE (phone_hmac, hmac_key_version) IN (
  SELECT phone_hmac, hmac_key_version FROM public.submission_identity_snapshot WHERE phone_hmac IS NOT NULL LIMIT 1);
