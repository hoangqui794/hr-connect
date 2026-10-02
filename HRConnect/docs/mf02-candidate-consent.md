# MF02 — Candidate consent for Affiliate submissions

## Business flow

1. Affiliate submits a Candidate and CV to an eligible Job.
2. MF02 resolves Candidate identity and performs a preliminary duplicate check.
3. MF02 stores the Submission as `PENDING_CONSENT`, sends an in-app notification when the Candidate has an account, and sends an email confirmation link.
4. The Candidate reviews the Job, Company, and CV through a five-minute signed URL, then confirms or declines.
5. On confirmation, MF02 checks duplicates again inside the acceptance flow, changes the Submission to `ACCEPTED`, creates the Application and Attribution, and queues MF03 scoring.
6. On decline or expiry, no Application, Attribution, or MF03 request is created.

The default consent lifetime is 48 hours. A background worker marks unanswered requests as `CONSENT_EXPIRED`. Email never contains a CV attachment or a raw token stored in the database.

## APIs

| Method | Route | Authorization | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/jobs/{jobId}/candidate-submissions` | Affiliate + `submission.create` | Create a `PENDING_CONSENT` submission and send the first request. |
| `POST` | `/api/v1/submission-consents/review` | Token; matching Candidate login is also required when the Candidate has an account | View consent details and receive a short-lived CV URL. |
| `POST` | `/api/v1/submission-consents/respond` | Token; matching Candidate login is also required when the Candidate has an account | Submit `CONFIRM` or `DECLINE`. |
| `POST` | `/api/v1/affiliates/submissions/{submissionId}/consent/resend` | Owning Affiliate + `submission.view_own` | Rotate the token and explicitly resend the email. |
| `GET` | `/api/v1/affiliates/submissions` | Affiliate + `submission.view_own` | View Submission and consent statuses and expiry. |
| `GET` | `/api/v1/affiliates/submissions/{submissionId}` | Owning Affiliate + `submission.view_own` | View Submission and consent details. |

## Statuses

- `PENDING_CONSENT`: waiting for Candidate response.
- `ACCEPTED`: Candidate confirmed; Application and Attribution exist and MF03 is queued.
- `CONSENT_REJECTED`: Candidate declined.
- `CONSENT_EXPIRED`: Candidate did not respond before expiry.
- `BLOCKED_DUPLICATE`: another accepted Submission/Application already exists.
- `JOB_UNAVAILABLE`: the Job stopped accepting submissions before confirmation.

## Configuration

`SubmissionConsent` in `appsettings.json` controls the expiry, resend cooldown, maximum email sends, and frontend confirmation URL. Production must set `SUBMISSION_CONSENT_URL_BASE` to the deployed frontend page. Resend is always an explicit Affiliate action; no worker automatically resends email.
