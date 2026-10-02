# MF02 — Candidate consent for Affiliate submissions

## Business flow

1. Affiliate submits a Candidate and CV to an eligible Job.
2. MF02 resolves Candidate identity and performs a preliminary duplicate check.
3. MF02 stores the Submission as `PENDING_CONSENT`, sends an in-app notification when the Candidate has an account, and sends an email confirmation link.
4. A Candidate with an account logs in and opens the Submission by `submissionId`. A Candidate without an account uses the one-time email token. Both can review the Job, Company, and CV through a five-minute signed URL, then confirm or decline.
5. On confirmation, MF02 checks duplicates again inside the acceptance flow, changes the Submission to `ACCEPTED`, creates the Application and Attribution, and queues MF03 scoring.
6. On decline or expiry, no Application, Attribution, or MF03 request is created.

The default consent lifetime is 48 hours. A background worker marks unanswered requests as `CONSENT_EXPIRED`. Email never contains a CV attachment. One-time tokens for unregistered Candidates are stored as hashes in the database.

## APIs

| Method | Route | Authorization | Purpose |
|---|---|---|---|
| `POST` | `/api/v1/jobs/{jobId}/candidate-submissions` | Affiliate + `submission.create` | Create a `PENDING_CONSENT` submission and send the first request. |
| `POST` | `/api/v1/submission-consents/review` | One-time email token; unregistered Candidate only | View consent details and receive a short-lived CV URL. |
| `POST` | `/api/v1/submission-consents/respond` | One-time email token; unregistered Candidate only | Submit `CONFIRM` or `DECLINE`. |
| `GET` | `/api/v1/candidates/me/submission-consents/{submissionId}` | Matching Candidate Bearer token | View consent details without an email token. |
| `POST` | `/api/v1/candidates/me/submission-consents/{submissionId}/respond` | Matching Candidate Bearer token | Submit `CONFIRM` or `DECLINE` without an email token. |
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

`SubmissionConsent` in `appsettings.json` controls the expiry, resend cooldown, maximum email sends, and confirmation URL. Local development uses the built-in backend page at `http://localhost:5041/submission-consent`; production must set `SUBMISSION_CONSENT_URL_BASE` to the deployed frontend page. Resend is always an explicit Affiliate action; no worker automatically resends email.
