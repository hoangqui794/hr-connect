# Load and performance checks

Evidence for the topic form's Work Package 6 ("load testing of the job-search and duplicate-check paths")
and its two performance requirements. All three are read-only.

| Check | File | Pass mark |
|---|---|---|
| Job search under load | `job-search.k6.js` | p95 < 1 s, < 1% errors at 50 virtual users |
| Duplicate check (email/phone, HMAC) | `duplicate-check.sql` | every lookup uses an index, < 5 ms |
| AI score within 60 s | `ai-scoring-latency.sql` | p95 ≤ 60 s, ≥ 95% within 60 s |

## Run

```bash
# Job search (Docker, nothing to install)
docker run --rm -i -e BASE_URL=https://<backend-host> grafana/k6:0.54.0 run - < tests/load/job-search.k6.js

# Database checks
psql "$DATABASE_URL" -f tests/load/duplicate-check.sql
psql "$DATABASE_URL" -f tests/load/ai-scoring-latency.sql
```

`PEAK_USERS` (default 50) changes the k6 peak. Copy the k6 summary and the two SQL outputs into the
test report; they are the numbers the topic form promises.
