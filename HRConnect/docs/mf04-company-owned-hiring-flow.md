# MF04: Company-owned hiring flow

## Ownership

MF04 records the recruitment lifecycle in HR Connect, but hiring decisions are
owned by the Company that owns the Job. `INTERNAL_HR` is an HR Connect
operations role, not a member of the Company's hiring team.

| Role | Allowed MF04 responsibility |
| --- | --- |
| `CLIENT_COMPANY_USER` | Screen a Company-owned `CV_APPLICATION` application, schedule and record interviews, manage offers, and confirm actual start work. |
| `CANDIDATE` | Withdraw an owned application and accept or decline an owned offer. |
| `AFFILIATE_RECRUITER` | Submit a candidate and view the separate, safe referral-progress projection only. |
| `INTERNAL_HR` | Screen `HEADHUNT_COD` and `CV_SOURCING` applications (MF-03); read recruitment records, AI results, attribution, and audit records for operational support. |
| System worker | Send notifications and expire unresponded offers. |

Apart from MF-03 screening of `HEADHUNT_COD` and `CV_SOURCING`, `INTERNAL_HR`
must not decide backup candidates, schedule or record interviews, manage
offers, or confirm placements. The database migration
`20261005090000_RestrictInternalHrRecruitmentMutations` revokes those legacy
permissions; `application.screen` is granted back to `INTERNAL_HR` by
`DatabaseSeeder` and restricted per Service Type by `ScreeningPolicy`.

## Screening API

Who screens depends on the Job's Service Type (`ScreeningPolicy`, see
`docs/main-flows.md`, MF-03):

| Service Type | Screener | Permission |
| --- | --- | --- |
| `CV_APPLICATION` | Company user that owns the Job | `candidate.review_company` |
| `HEADHUNT_COD`, `CV_SOURCING` | `INTERNAL_HR` | `application.screen` |

A wrong actor for the Service Type receives `403`. `REJECTED` requires a
`reasonCode` (see `ApplicationReasonCodes`); `reason` is an optional note,
required only for `OTHER`. `concurrencyToken` is required on every call.

`POST /api/v1/jobs/{jobId}/applications/{applicationId}/start-screening` moves
`SUBMITTED` to `SCREENING` when the responsible screener opens the
application; repeated or out-of-role calls return `changed: false`.

Client visibility (`ClientVisibilityPolicy`): for `HEADHUNT_COD` and
`CV_SOURCING` the Company only sees applications that were ever
`SHORTLISTED`. For `HEADHUNT_COD`, candidate email, phone, address and CV file
are hidden from the Company until `PLACED`, in application, interview and
offer responses.

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
