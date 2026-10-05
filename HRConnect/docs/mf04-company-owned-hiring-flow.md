# MF04: Company-owned hiring flow

## Ownership

MF04 records the recruitment lifecycle in HR Connect, but hiring decisions are
owned by the Company that owns the Job. `INTERNAL_HR` is an HR Connect
operations role, not a member of the Company's hiring team.

| Role | Allowed MF04 responsibility |
| --- | --- |
| `CLIENT_COMPANY_USER` | Screen a Company-owned application, schedule and record interviews, manage offers, and confirm actual start work. |
| `CANDIDATE` | Withdraw an owned application and accept or decline an owned offer. |
| `AFFILIATE_RECRUITER` | Submit a candidate and view the separate, safe referral-progress projection only. |
| `INTERNAL_HR` | Read recruitment records, AI results, attribution, and audit records for operational support. |
| System worker | Send notifications and expire unresponded offers. |

`INTERNAL_HR` must not screen, shortlist, reject, decide backup candidates,
schedule or record interviews, manage offers, or confirm placements. The
database migration `20261005090000_RestrictInternalHrRecruitmentMutations`
revokes those legacy permissions from existing databases.

## Screening API

Only a Company user that owns the Job and has `candidate.review_company` can
call:

```http
PATCH /api/v1/jobs/{jobId}/applications/{applicationId}/status
```

```json
{
  "targetStatus": "SHORTLISTED",
  "reason": "Phù hợp yêu cầu vị trí.",
  "concurrencyToken": "uuid"
}
```

Legal transitions are:

```text
SUBMITTED -> SCREENING | SHORTLISTED | REJECTED | BACKUP
SCREENING -> SHORTLISTED | REJECTED | BACKUP
BACKUP -> SHORTLISTED | BACKUP_NOT_SELECTED
```

Creating an interview is the only action that moves `SHORTLISTED` to
`INTERVIEW`. The Company then owns the interview result, offer and placement
steps. An Affiliate never receives schedule details, interview feedback, offer
contents, salary, or placement notes.

## Offer expiry

An offer remains usable through its `expiryDate`. After that date,
`OFFER_EXPIRY_WORKER` changes a still-`SENT` offer to `EXPIRED`, creates a safe
in-app notification for the Candidate when the Candidate has an account, and
writes `OFFER_EXPIRED` to the shared audit log. It does not itself change the
Application status, so an ordinary `OFFER_PENDING` application remains ready
for a replacement offer.
