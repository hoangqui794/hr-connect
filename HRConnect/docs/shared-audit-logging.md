# Shared request and audit logging

## Request correlation

Every HTTP request receives an `X-Correlation-ID` response header. A valid GUID supplied in the same request header is reused; otherwise the API creates one. Request logs and audit rows use this value so an incident can be traced across both sources.

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
| `AFFILIATE_SUBMISSION_CREATED` | `SUBMISSION` | Affiliate creates an accepted submission |
| `SUBMISSION_DUPLICATE_BLOCKED` | `SUBMISSION` | A duplicate submission is recorded and blocked |

The application uses the existing `public.audit_log` table. Migration `20260926150000_AddAuditCorrelationIndex` only adds an index for correlation lookup; it does not create another log table.
