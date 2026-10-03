# Affiliate referral progress

Affiliate Recruiter may track only the high-level recruitment progress of Candidates they submitted. This is a read-only view; it is not an Affiliate entry point to MF04 operations.

## API

`GET /api/v1/affiliates/referrals`

Required permission: `referral.progress.view_own`.

Optional query parameters: `jobId`, `page`, and `pageSize` (1-100).

The API scopes every record to `submission.submitted_by =` the authenticated Affiliate user. It returns only:

- `submissionId`, `applicationId`
- Candidate name, Job title, Company name
- `progressStatus`
- `updatedAt`

It does not return interview date/time, location, meeting link, participants, feedback, offer content, salary, financial information, or internal status reasons.

## Progress mapping

| Source state | `progressStatus` |
|---|---|
| `PENDING_CONSENT` | `WAITING_CONSENT` |
| `SUBMITTED`, `SCREENING` | `CV_REVIEW` |
| `SHORTLISTED` | `SHORTLISTED` |
| `INTERVIEW` | `INTERVIEW` |
| `OFFER_PENDING`, `OFFER_ACCEPTED` | `OFFER` |
| `BACKUP` | `BACKUP` |
| `PLACED` | `PLACED` |
| Rejected, declined, failed, withdrawn, not started, duplicate, expired, or unavailable | `CLOSED` |

Frontend displays only the returned high-level status and last update. It must not derive or display private interview/offer data from other APIs.
