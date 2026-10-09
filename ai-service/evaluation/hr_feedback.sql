-- Export the latest completed AI score for each application with the HR screening outcome.
-- Run against the HR Connect PostgreSQL database and save as CSV, e.g.:
--   psql "$DATABASE_URL" --csv -f evaluation/hr_feedback.sql > hr_feedback.csv
-- or run it in pgAdmin/DBeaver and export the result grid as CSV.
-- Contains no candidate names or contact details.
WITH latest_score AS (
    SELECT DISTINCT ON (r.application_id)
           r.application_id, r.match_score, r.match_tier, r.model_version, r.completed_at
    FROM public.ai_match_result r
    WHERE r.status = 'COMPLETED' AND r.match_score IS NOT NULL
    ORDER BY r.application_id, r.attempt_no DESC
),
hr_decision AS (
    SELECT h.application_id,
           bool_or(h.new_status = 'SHORTLISTED') AS ever_shortlisted,
           bool_or(h.new_status = 'REJECTED')    AS ever_rejected,
           max(h.reason_code) FILTER (WHERE h.new_status = 'REJECTED') AS reject_reason_code
    FROM public.application_status_history h
    GROUP BY h.application_id
)
SELECT s.application_id,
       s.match_score,
       s.match_tier,
       s.model_version,
       CASE WHEN d.ever_shortlisted THEN 'SHORTLISTED'
            WHEN d.ever_rejected    THEN 'REJECTED'
            ELSE 'UNDECIDED' END AS hr_decision,
       d.reject_reason_code
FROM latest_score s
LEFT JOIN hr_decision d ON d.application_id = s.application_id
ORDER BY s.completed_at DESC
