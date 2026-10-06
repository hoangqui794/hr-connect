# Shared request and audit logging

## Request correlation

Every HTTP request receives an `X-Correlation-ID` response header. A valid GUID supplied in the same request header is reused; otherwise the API creates one. Request logs and audit rows use this value so an incident can be traced across both sources.

The API also records the client IP for HTTP audit events. In production,
configure `ForwardedHeaders__KnownProxies__0` (and subsequent indexes) with the
trusted reverse proxy addresses. Forwarded headers from untrusted clients are
ignored.

## Actor and source context

Every audit row has explicit context even when `actor_user_id` is null:

- `actor_type`: `USER`, `ANONYMOUS`, `SYSTEM`, `SERVICE`, or `DATABASE_TRIGGER`.
- `source`: `API`, `APPLICATION`, `BACKGROUND_WORKER`, `INTEGRATION`, or `DATABASE_TRIGGER`.
- `service_name`: identifies a service or worker such as `MF03`,
  `MF03_DISPATCHER`, or `CONSENT_EXPIRY_WORKER`.
- `event_version`: version of the JSON event shape, currently `1`.

`actor_user_id` is retained with `ON DELETE RESTRICT`. Accounts referenced by
audit history must be deactivated instead of hard deleted. `entity_type` and
`entity_id` remain a polymorphic reference and deliberately do not use a foreign
key because audit events can refer to several business tables.

## Writing an audit event

Inject `IAuditLogService`, add the event before the unit of work is committed, and let the existing business transaction save it:

```csharp
await auditLogService.AddAsync(new AuditEntry
{
    Action = AuditActions.CvUpdated,
    EntityType = "CANDIDATE_CV",
    EntityId = cv.CvId,
    ActorUserId = request.UserId,
    OldValues = new { title = oldTitle },
    NewValues = new { title = cv.Title }
}, cancellationToken);

await unitOfWork.SaveChangesAsync(cancellationToken);
```

`AddAsync` only adds the row to the current unit of work. It deliberately does not call `SaveChangesAsync`, so the audit row and business change succeed or roll back together.

## Data rules

- Use a stable uppercase action name. Add shared action names to `AuditActions`.
- Store identifiers, states, and small business metadata only.
- Never store passwords, OTPs, tokens, authorization headers, cookies, presigned URLs, CV bytes, or extracted CV text.
- The service recursively redacts sensitive property names and rejects JSON larger than 16 KB. This is a final guard, not a replacement for choosing safe fields.
- Do not audit read-only endpoints unless there is a specific compliance requirement.
- Background workers may pass `ActorUserId = null`; request correlation and network metadata are filled automatically when an HTTP request exists.

## MF02 events currently emitted

| Action | Entity | Trigger |
| --- | --- | --- |
| `CV_UPLOADED` | `CANDIDATE_CV` | Candidate or Affiliate CV metadata is saved |
| `CV_UPDATED` | `CANDIDATE_CV` | Candidate changes a CV title |
| `CV_PRIMARY_SET` | `CANDIDATE_CV` | Candidate changes the primary CV |
| `CV_DELETED` | `CANDIDATE_CV` | CV is hidden or physically deleted |
| `APPLICATION_SUBMITTED` | `APPLICATION` | Candidate submits an accepted application |
| `AFFILIATE_SUBMISSION_CREATED` | `SUBMISSION` | Affiliate creates a submission pending Candidate consent |
| `SUBMISSION_DUPLICATE_BLOCKED` | `SUBMISSION` | A duplicate submission is recorded and blocked |
| `SUBMISSION_CONSENT_CONFIRMED` | `SUBMISSION` | Candidate accepts an Affiliate submission |
| `SUBMISSION_CONSENT_DECLINED` | `SUBMISSION` | Candidate declines an Affiliate submission |
| `SUBMISSION_CONSENT_EXPIRED` | `SUBMISSION` | A consent expires through the worker, review, resend, or resubmission flow |
| `SUBMISSION_CONSENT_CLOSED` | `SUBMISSION` | A pending consent is closed for another controlled business reason |
| `SUBMISSION_CONSENT_EMAIL_RESENT` | `SUBMISSION` | Affiliate requests another consent email |
| `AFFILIATE_CV_VIEWED` | `CANDIDATE_CV` | Affiliate receives a short-lived URL for an authorized Candidate CV |
| `CANDIDATE_CV_DOWNLOAD_URL_ISSUED` | `CANDIDATE_CV` | Candidate receives a short-lived URL for an owned CV |
| `SUBMISSION_CONSENT_CV_DOWNLOAD_URL_ISSUED` | `CANDIDATE_CV` | Consent reviewer receives a five-minute CV URL through an account or email link |
| `INTERNAL_CV_DOWNLOAD_URL_ISSUED` | `CANDIDATE_CV` | MF03 receives a short-lived internal CV URL |
| `AI_SCORING_REQUESTED` | `APPLICATION` | MF02 creates the initial MF03 scoring request |
| `AI_SCORING_RETRY_REQUESTED` | `APPLICATION` | An authorized manual retry is requested |
| `AI_SCORING_RETRY_SCHEDULED` | `APPLICATION` | The dispatcher schedules a bounded retry |
| `AI_SCORING_FAILED` | `APPLICATION` | Dispatch reaches a terminal failure |

Consent expiration uses one shared application service. The consent, submission,
pending CV, Affiliate notification, and audit row are persisted by the same unit
of work. Every entry includes a `source` value so support staff can distinguish a
background expiry from an expiry discovered during review, resend, or resubmission.

Short-lived URL events record identifiers, the expiry time, and the access path.
They never record the signed URL. Ordinary list and detail queries are not audited
because they do not change business state and do not grant access to the CV file.

The application uses the existing `public.audit_log` table. Migration
`20261004043422_AddAuditContextMetadata` adds actor/source context, validates
allowed values, backfills existing rows, preserves the append-only trigger, and
adds indexes for operational filtering. It does not create another log table.

## Auth and approval events

| Action | Entity | Trigger |
| --- | --- | --- |
| `CANDIDATE_REGISTERED` | `APP_USER` | Candidate registration data is committed |
| `AFFILIATE_REGISTERED` | `AFFILIATE_APPLICATION` | Affiliate registration data is committed |
| `CLIENT_REGISTERED` | `COMPANY_VERIFICATION_REQUEST` | Client and Company registration data is committed |
| `EMAIL_VERIFIED` | `APP_USER` | A registration OTP is accepted |
| `AFFILIATE_APPROVED` / `AFFILIATE_REJECTED` | `AFFILIATE_APPLICATION` | Admin decides an Affiliate application |
| `CLIENT_APPROVED` / `CLIENT_REJECTED` | `COMPANY_VERIFICATION_REQUEST` | Admin decides a Client verification request |
| `PASSWORD_CHANGED` | `APP_USER` | An authenticated user changes password and sessions are revoked |
| `PASSWORD_RESET` | `APP_USER` | A password-reset OTP is accepted and sessions are revoked |
| `SESSION_REVOKED` | `REFRESH_TOKEN` | Logout revokes an active refresh-token session |
| `ALL_SESSIONS_REVOKED` | `APP_USER` | An authenticated user requests logout on all devices |
| `REFRESH_TOKEN_REUSE_DETECTED` | `REFRESH_TOKEN` | The system detects reuse of a revoked/replaced token and revokes active sessions |

Refresh-token reuse is classified as a `SYSTEM` actor with no `actor_user_id`.
The affected account ID is stored as small event metadata; the caller may be an
attacker and must not be attributed to the affected user. Passwords, OTP values,
token values, and token hashes are never included.

## MF04 events

MF04 writes audit events for all state-changing Interview, Offer, Application,
and Placement commands. A command that changes an application status also writes
`APPLICATION_STATUS_CHANGED` for the application, in addition to its primary
entity event.

| Area | Actions |
| --- | --- |
| Interview | `INTERVIEW_SCHEDULED`, `INTERVIEW_UPDATED`, `INTERVIEW_RESCHEDULED`, `INTERVIEW_CANCELLED`, `INTERVIEW_NO_SHOW_RECORDED`, `INTERVIEW_RESULT_RECORDED` |
| Offer | `OFFER_DRAFT_CREATED`, `OFFER_UPDATED`, `OFFER_SENT`, `OFFER_ACCEPTED`, `OFFER_DECLINED`, `OFFER_WITHDRAWN`, `OFFER_EXPIRED` |
| Application and placement | `APPLICATION_SCREENED`, `APPLICATION_BACKUP_DECIDED`, `APPLICATION_WITHDRAWN`, `APPLICATION_PLANNED_START_DATE_UPDATED`, `APPLICATION_NOT_STARTED`, `APPLICATION_STATUS_CHANGED`, `PLACEMENT_CONFIRMED` |

MF04 audit payloads contain IDs, statuses, dates, version numbers, and small
business metadata only. They must not contain concurrency tokens, meeting links,
offer document URLs, detailed interview feedback, or candidate CV content.

`OFFER_EXPIRED` is produced by `OFFER_EXPIRY_WORKER` after the end of an
offer's expiry date. The worker changes only the offer from `SENT` to
`EXPIRED`; it does not itself transition the Application, so an ordinary
`OFFER_PENDING` application remains ready for a replacement offer. The event has no human actor and is marked as
`SERVICE` / `BACKGROUND_WORKER`.
