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
