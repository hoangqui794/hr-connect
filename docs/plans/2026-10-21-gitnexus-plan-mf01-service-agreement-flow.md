# GitNexus Engineering Plan

> Task: Hoàn thiện toàn bộ MF01 cho ba dịch vụ từ tạo job, duyệt, deal hai chiều đến PDF thỏa thuận, Client ký và kích hoạt/thanh toán.
> Evidence verified at commit `a7b2874f86c2253680aed2087fe93333b25f7fd8`; GitNexus index 28 commits behind. A strict `npx gitnexus analyze --index-only --pdg` refresh was attempted but all analyzer workers failed during startup because their configured memory exceeded the available host budget; graph findings are therefore explicitly stale and source-weighted.
> Evidence provenance schema 2; global dirty digest `0a9c85780067d9afcd0764f307b60891e3cee927ee11eaeb5ec7826d10fd82cd`; cited-path manifest 35 sorted entries; exact generated plan path excluded.

## 1. Objective

Hoàn thiện MF01 thành luồng production cho ba dịch vụ:

1. **CV Application**: Client chọn gói công khai, xác nhận đúng phiên bản điều khoản, được duyệt nội dung, thanh toán nếu cần và kích hoạt.
2. **CV Sourcing**: Client gửi nhu cầu, HR Connect đề xuất/chốt điều khoản với Client, lưu vết phiên bản, Client ký PDF, sau đó hệ thống mới tạo tiền cọc và chờ thanh toán.
3. **Headhunt**: Client gửi nhu cầu, HR Connect deal phí/bảo hành/hạn thanh toán, Client ký PDF, sau đó job mới được kích hoạt.

Phạm vi gồm BE, migration, API contract, FE Client/Internal HR, PDF riêng tư trên R2, OTP ký, notification/audit, test và handoff. Không tái thiết kế Application/Interview/Offer/Placement của MF03–MF05; MF01 chỉ bàn giao trạng thái/sự kiện đúng cho các module đó.

## 2. Current Behaviour

- [verified] `CreateJobCommandHandler` tạo `DRAFT`, kiểm tra thành viên công ty đang hoạt động và công ty `VERIFIED`, rồi lưu điều khoản Client đề xuất vào `Job` (`CreateJobCommandHandler.cs:30-185`).
- [verified] `SubmitJobCommandHandler` kiểm tra ownership, concurrency và dữ liệu theo service trước khi chuyển `DRAFT/REJECTED -> PENDING_REVIEW` (`SubmitJobCommand.cs:27-182`).
- [verified] Với `CV_APPLICATION`, nếu chưa chọn gói thì BE tự chọn `FREE` và có thể tạo posting fee 0 đồng (`SubmitJobCommand.cs:82-140`). Hành vi này che lỗi form và có thể trái ý Client.
- [verified] `ApproveJobCommandHandler` cho Internal HR ghi thẳng official terms, `AgreedAt`, `AgreedBy`; `AgreementReference` chỉ bắt buộc khi final khác một proposal không-null (`ApproveJobCommand.cs:89-133,157-218`). Proposal trống vẫn có thể bị HR tự chốt mà chưa có bằng chứng Client đồng ý.
- [verified] Cùng handler gọi `EnsureDepositAsync` cho sourcing và chuyển job sang `PENDING_PAYMENT` hoặc `ACTIVE` ngay trong thao tác duyệt (`ApproveJobCommand.cs:231-233,327-394`).
- [verified] `Job` chỉ có `AgreementReference`, `AgreementNote`, `AgreedAt`, `AgreedBy`; chưa có agreement entity, version, Client acceptance, signer evidence hay document hash (`Job.cs:99-166`).
- [verified] API chỉ có create/update/submit, defaults và `/internal/jobs/{id}/approve`; chưa có Client accept/change/sign/history/download (`JobEndpoints.cs:55-115,312-344`).
- [verified] FE Internal HR dùng `CommercialTermsApprovalModal` với nút “Chốt điều khoản & Duyệt”, gọi approve một chiều (`CommercialTermsApprovalModal.tsx:53-264`; `JobReviewPage.tsx:205,445-579`).
- [verified] Official BE ranges là multiplier `0.1..10`, warranty `1..365`, payment `1..120`; FE phải dùng đúng các giới hạn này (`JobCommercialTermsModels.cs:79-109`).

### Target state machine

```text
CV_APPLICATION
DRAFT/REJECTED -> PENDING_REVIEW -> ACTIVE (FREE)
                                 -> PENDING_PAYMENT -> ACTIVE (STANDARD)

CV_SOURCING / HEADHUNT
DRAFT/REJECTED -> PENDING_REVIEW -> PENDING_AGREEMENT
PENDING_AGREEMENT --request changes/new version--> PENDING_AGREEMENT
PENDING_AGREEMENT --signed HEADHUNT-------------> ACTIVE
PENDING_AGREEMENT --signed CV_SOURCING----------> PENDING_PAYMENT -> ACTIVE
PENDING_REVIEW or PENDING_AGREEMENT --reject----> REJECTED
```

Agreement có state độc lập: `DRAFT`, `SENT_TO_CLIENT`, `CHANGE_REQUESTED`, `ACCEPTED`, `AWAITING_SIGNATURE`, `SIGNED`, `VOID`, `LEGACY_CONFIRMED`.

## 3. Relevant Architecture

- [verified] Backend dùng Minimal API -> MediatR command/query -> repository/DbContext. `JobEndpoints` chỉ bind identity/permission/HTTP; transition nằm trong handler.
- [verified] `Job.ConcurrencyToken` đã là optimistic concurrency contract; agreement response/sign phải dùng token và trả `409` khi stale (`Job.cs:57`).
- [verified] Company có name, tax code, website, address, description; CompanyUser có `RoleInCompany`, `IsPrimaryContact`, `Status`. Agreement phải chụp legal snapshot, không render bằng dữ liệu join động (`Company.cs:6-22`; `CompanyUser.cs:6-18`).
- [verified] `IFileStorageService` hỗ trợ upload/copy/delete/presigned URL/exists và Cloudflare R2 là implementation hiện hành. DB chỉ lưu object key/hash (`IFileStorageService.cs:6-47`).
- [verified] Hệ thống đã có `IOtpService`, `UserToken` với hash/expiry/attempt count và tests. Agreement cần challenge gắn với agreement/version để chống replay đúng domain (`UserToken.cs:7-21`).
- [verified] Infrastructure dùng SkiaSharp sinh PDF và bundle Roboto hỗ trợ tiếng Việt (`CvPdfRenderer.cs:13-180`; `LICENSE-Roboto.txt`). Tạo `AgreementPdfRenderer` riêng, không thêm dependency PDF mới.
- [verified] `SourcingFinanceService.EnsureDepositAsync` yêu cầu `AgreedAt != null`; sau refactor, chỉ signed agreement mới đặt `AgreedAt` (`SourcingFinanceService.cs:67-90`).
- [inferred] PostgreSQL và R2 không có distributed transaction; finalization cần deterministic keys, idempotency và cleanup compensation.

## 4. GitNexus Findings

Index chậm 28 commits; mọi quyết định đã được kiểm lại bằng source hiện hành.

- [graph] `context(symbol=ApproveJobCommandHandler)` cho thấy direct callers là `JobEndpoints` và `JobCommercialTermsTests`, `JobManagementCommandHandlerTests`, `RealDatabaseMf01IntegrationTests`, `SourcingFinanceTests`; source hiện hành xác nhận.
- [graph] `impact(symbol=ApproveJobCommandHandler, maxDepth=3)` trả **HIGH**, 16 affected, 15 direct; depth 2 tới composition root. Cần staged change và compatibility.
- [graph] `impact(symbol=SubmitJobCommandHandler, maxDepth=3)` trả **HIGH**, 21 affected, 20 direct; package requirement phải cập nhật BE tests và FE cùng series.
- [graph] `impact(symbol=CommercialTermsApprovalModal, maxDepth=3)` trả **LOW** với một direct caller `JobReviewPage`; FE cluster còn hooks/API/types.
- [graph] `context(symbol=CommercialTermsApprovalModal)` xác nhận `JobReviewPage` là caller và defaults query là dependency.
- [graph] `impact(symbol=JobTransitions, maxDepth=3)` trả `UNKNOWN` do index stale; source search thấy transition được dùng rộng, nên không coi UNKNOWN là an toàn.
- [graph] `query("MF01 create job commercial terms agreement")` đưa cluster `Jobs-mf01`/Job Review lên đầu và không tìm thấy agreement aggregate hiện hữu.

Direct dependents bắt buộc xử lý: `JobEndpoints`, bốn backend test suites nêu trên, DI/composition; FE gồm `JobReviewPage`, `jobsApi`, `useJobQueries`, API types. Với `Job`/status, executor phải search DB constraints, queries, filters, seeds/builders và chạy `detect_changes` trước commit vì graph stale.

## 5. Statement-Level PDG Findings

- [graph] `pdg_query(ApproveJobCommand.cs, mode=controls)` cho thấy reference chỉ bắt buộc khi `differsFromProposed` (`ApproveJobCommand.cs:119-128,203-211`). Proposal null không chứng minh Client đồng ý. Agreement acceptance phải là action/state rõ ràng.
- [graph] Official terms và `AgreedAt/AgreedBy` được ghi ngay sau validation (`ApproveJobCommand.cs:128-133,213-218`). Chỉ `CompleteSignedAgreementCommandHandler` mới được copy terms vào Job.
- [graph] Data flow của `job` nối terms tới `EnsureDepositAsync`, rồi tới `PendingPayment/Active` (`ApproveJobCommand.cs:231-233,327-394`). Thứ tự bắt buộc: verify OTP -> seal evidence/PDF -> persist signed agreement -> apply official terms -> idempotent finance/activation.
- [graph] Control slice cho `CV_APPLICATION` chỉ ra fallback FREE. Missing package phải là validation error.
- [verified] Finance kiểm `AgreedAt`; mọi write tới field này phải bị giới hạn về signed finalizer.
- [inferred] Upload R2 không nằm trong DB transaction: render/hash trước, upload deterministic key, persist với concurrency; nếu persist lỗi thì enqueue cleanup, retry phải kiểm tra object/hash.

## 6. Proposed Changes

### 6.1 Domain model và database

1. Thêm `ServiceAgreement`:
   - `AgreementId`, `JobId`, `Version`, `ServiceTypeCode`, `Status`, `ConcurrencyToken`, `IsCurrent`.
   - Typed terms: `FeeMultiplier`, `WarrantyDays`, `PaymentDueDays`, `PricePerQualifiedCv`, `SourcingTarget`; notes/change reason.
   - Actor/timestamps, company/platform legal snapshots, signer snapshots, consent text/version, verification code.
   - Unsigned/signed object keys, SHA-256 hashes, IP HMAC/hash, user-agent summary.
   - Unique `(JobId, Version)`, unique verification code, một current non-void/job; signed state yêu cầu key/hash/signer/time và bất biến.

2. Thêm `ServiceAgreementSignatureChallenge`:
   - `ChallengeId`, `AgreementId`, `SignerUserId`, normalized email, OTP hash, expiry, attempts/max attempts, consumed/revoked/created.
   - Một active challenge/agreement/signer; resend revoke challenge cũ; confirm atomic compare-and-consume.
   - Dùng `IOtpService`; không lưu raw OTP. Chỉ reuse `UserToken` nếu executor chứng minh ràng buộc agreement/version/replay đầy đủ, mặc định tạo entity riêng.

3. Sửa `Job`/constants:
   - Thêm `PENDING_AGREEMENT`, `CurrentServiceAgreementId`.
   - Official terms trên Job là denormalized snapshot từ signed agreement.
   - Giữ legacy agreement fields tạm thời để read/backfill; không ghi từ HR approve.

4. EF migration:
   - DbSets, FKs `Restrict`, check constraints, unique/expiry/status indexes.
   - Job cũ có `AgreedAt` -> agreement v1 `LEGACY_CONFIRMED`, copy terms/reference/note; không gắn `SIGNED`, không đổi job status.
   - Setting/flag `MF01_SERVICE_AGREEMENT_ENFORCEMENT_AT`: chỉ job sau cutover bắt buộc signed gate.

### 6.2 Job creation/submission

5. `CreateJobCommand`/`UpdateJobCommand`/validators:
   - CV_APPLICATION nhận `PostingPackageId`, `PackageTermsVersion`, `AcceptPackageTerms`; package active và version phải khớp.
   - CV_SOURCING cần `SourcingTarget > 0`; price/payment/note vẫn chỉ là proposal.
   - HEADHUNT proposal multiplier/warranty/payment/note dùng cùng range BE/FE.
   - Không đổi service type/material fields sau signed agreement; thay đổi phải là amendment/version mới.

6. `SubmitJobCommandHandler`:
   - Bỏ fallback FREE. Thiếu package/acceptance/version trả 400 với `JOB_POSTING_PACKAGE_REQUIRED`, `PACKAGE_TERMS_NOT_ACCEPTED`, `PACKAGE_TERMS_VERSION_STALE`.
   - Giữ free limit/cooldown/standard fee logic sau khi package được chọn rõ.

### 6.3 Duyệt, thương lượng và ký

7. Tách `ApproveJobCommandHandler`:
   - CV_APPLICATION duyệt nội dung và đi `ACTIVE`/`PENDING_PAYMENT` theo posting fee.
   - CV_SOURCING/HEADHUNT dùng agreement flow; endpoint cũ trả conflict/deprecation error, không `AgreedAt`, deposit hoặc activate.

8. Thêm `Features/Jobs/ServiceAgreements`:
   - `CreateServiceAgreementProposalCommand`: HR/Admin tạo version từ proposal/default/final và gửi Client; job -> `PENDING_AGREEMENT`.
   - `RespondToServiceAgreementCommand`: active Client chọn `ACCEPT`/`REQUEST_CHANGES`; reason bắt buộc khi đổi.
   - `CreateSignatureChallengeCommand`: Client active + primary contact; accepted/current agreement; rate-limited OTP qua outbox.
   - `SignServiceAgreementCommand`: kiểm actor/challenge/attempt/expiry/consent/concurrency; seal evidence; finalization idempotent.
   - `VoidServiceAgreementCommand`: chỉ HR, chỉ chưa ký; signed phải amendment.
   - Queries current/history/download/verify.

9. Agreement finalization:
   - `IAgreementPdfRenderer` trong Application; `AgreementPdfRenderer` Infrastructure dùng SkiaSharp + Roboto.
   - PDF chứa agreement ID/version, service/job, pháp nhân hai bên, signer, terms, fee/payment/warranty, qualified-CV/replacement/refund/ownership/anti-bypass, timestamps, consent version, verification code/hash reference.
   - Private deterministic key: `companies/{companyId}/service-agreements/{agreementId}/v{version}/unsigned.pdf|signed.pdf`.
   - Không persist presigned URL; signed file không overwrite; amendment dùng version/key mới.
   - Idempotency key `AgreementId + Version + SignerUserId`; retry không duplicate fee/history/notification.

10. Kích hoạt sau ký:
    - HEADHUNT: copy official terms -> signed -> `ACTIVE` + PostedAt/history/notification.
    - CV_SOURCING: copy official terms -> đúng một `EnsureDepositAsync` -> `PENDING_PAYMENT`.
    - `AgreedBy` là Client signer; audit proposal/response/challenge/sign/document/void/activation.

### 6.4 API và security

| Method | Route | Actor | Kết quả |
|---|---|---|---|
| GET | `/api/v1/jobs/{jobId}/service-agreement` | owner/internal | Current role-safe DTO |
| GET | `/api/v1/jobs/{jobId}/service-agreements` | owner/internal | Version history |
| POST | `/api/v1/internal/jobs/{jobId}/service-agreements` | `service_agreement.manage` | Tạo/gửi proposal |
| POST | `/api/v1/client/jobs/{jobId}/service-agreements/{agreementId}/response` | `.respond` + ownership | Accept/request changes |
| POST | `/api/v1/client/jobs/{jobId}/service-agreements/{agreementId}/signature-challenges` | `.sign` + primary | Gửi OTP |
| POST | `/api/v1/client/jobs/{jobId}/service-agreements/{agreementId}/sign` | cùng signer/challenge | Ký idempotent |
| GET | `/api/v1/jobs/{jobId}/service-agreements/{agreementId}/download-url` | authorized | Short presigned URL |
| POST | `/api/v1/internal/jobs/{jobId}/service-agreements/{agreementId}/void` | `.manage` | Void chưa ký |
| GET | `/api/v1/public/service-agreements/verify/{verificationCode}` | anonymous rate-limited | Safe validity metadata |

- Mọi mutation nhận `ConcurrencyToken`; stale -> 409.
- OTP rate limit theo user + agreement + IP, generic anti-enumeration messages.
- Permission seeds: `service_agreement.read/manage/respond/sign`; service vẫn kiểm ownership/status/primary contact.
- DTO không trả object key, OTP hash, attempt details, IP/user agent đầy đủ hay internal audit note.

### 6.5 Frontend MF01

11. `JobFormPage`: package bắt buộc, giá/quyền lợi/terms version, checkbox xác nhận; đồng bộ ranges; diễn đạt rõ proposal và package price.
12. `JobReviewPage`: thay modal chốt một chiều bằng `ServiceAgreementComposer` có compare, validation, PDF preview, send/version timeline; thêm filter/badge `PENDING_AGREEMENT`.
13. Client job detail: status card, compare terms, accept/request changes, preview/download, OTP signing modal; chỉ primary contact được ký.
14. API types/hooks/query invalidation: model version/status/doc availability; 409/429/expired OTP có UX hành động được.
15. Notification/email: proposal mới, change response, cần ký, ký xong, cần thanh toán; không gửi public PDF URL lâu dài.

### 6.6 Compatibility, rollout, docs

16. Cập nhật OpenAPI và `docs/MF01/FRONTEND-INTEGRATION.md`: state machine, DTO, routes, errors, permission, cache invalidation, UX.
17. Old approve giữ cho CV_APPLICATION; negotiated service trả explicit migration error.
18. Deploy migration -> read/UI -> enforcement flag; theo dõi backfill trước cutover.
19. Không sửa CI/CD ngoài bảo đảm test mới chạy qua `.github/workflows/ci.yml` hiện có.

## 7. Implementation Sequence

1. Re-index GitNexus/PDG trên máy đủ RAM; nếu vẫn lỗi thì source-weighted và chạy impact/detect_changes trước mỗi symbol edit.
2. Domain + migration + PostgreSQL constraint/backfill tests.
3. Repositories/interfaces, renderer/storage/OTP abstractions, permission seeds; chưa đổi flow.
4. Package contract BE+FE, bỏ fallback FREE, regression tests; commit độc lập.
5. Agreement commands/queries + domain/auth/concurrency tests.
6. PDF/storage + hashing/cleanup compensation + Linux-compatible tests.
7. After-sign finalization/finance handoff; exact-once sourcing tests.
8. Endpoints/security/rate limit/stable errors/public safe verify.
9. Internal HR composer/version UI.
10. Client response/OTP sign/download UI.
11. Legacy backfill/feature flag/compatibility.
12. Full BE/FE/migration/Docker PDF smoke/security regression.
13. OpenAPI, frontend handoff và operational runbook.

Mỗi bước phải để tree build được. Migration/domain/snapshot đi cùng nhau. Không bật enforcement trước khi cả hai FE roles đã deploy.

## 8. Test Strategy

### Backend/domain

- CV_APPLICATION thiếu package/accept/stale terms -> stable 400; FREE/STANDARD regression.
- HR gửi proposal -> `PENDING_AGREEMENT`, không `AgreedAt`, deposit hoặc ACTIVE.
- Company khác/user inactive/missing permission -> 403/404 theo anti-enumeration convention.
- Non-primary đọc/respond được nhưng không ký; primary ký được.
- Change request thiếu reason -> 400; version mới supersede đúng.
- Accept chưa phải signed; chỉ OTP sign mới ghi official terms.
- OTP sai/hết hạn/replay/max attempts -> không side effect; resend revoke cũ.
- Stale concurrency -> 409; repeated sign -> một PDF/history/notification/finance artifact.
- Signed/legacy không sửa/void; amendment tạo version mới.

### PDF/storage

- PDF mở được, tiếng Việt đúng trên Linux, có legal/job/terms/signer/version/verification.
- SHA-256 khớp R2 bytes; private tenant path; URL ký không persist.
- Unauthorized download/verify không lộ key/email đầy đủ.
- Upload rồi DB fail -> cleanup; retry không overwrite signed khác.

### PostgreSQL/integration

- Unique version/current/verification/challenge constraints.
- Concurrent accept/sign chỉ một transaction thắng, còn lại 409/idempotent.
- HEADHUNT signed -> ACTIVE một lần.
- SOURCING signed -> một deposit + PENDING_PAYMENT.
- Legacy -> `LEGACY_CONFIRMED`, không giả chữ ký/đổi status.

### Frontend

- Form/validation theo service; package acceptance/stale terms UX.
- HR compose/send/revise/signed-readonly.
- Client respond/OTP/primary policy/409/429/expired UX.
- List/detail badge/timeline đồng nhất, không đưa raw enum tiếng Anh cho user.
- API method/URL/body tests, không gửi security metadata.

### Verification commands

```text
dotnet restore HRConnect/HRConnect.sln
dotnet build HRConnect/HRConnect.sln --configuration Release --no-restore
dotnet test HRConnect/HRConnect.sln --configuration Release --no-build
cd HRConnect-FE && npm ci --no-audit --no-fund
cd HRConnect-FE && npm run lint
cd HRConnect-FE && npm test
cd HRConnect-FE && npm run build
```

CI còn build backend Docker image; phải smoke-test font/PDF native assets trong image trước merge.

## 9. Risk and Impact Analysis

| Risk | Impact | Mitigation |
|---|---|---|
| `ApproveJobCommandHandler` | HIGH: endpoint/finance/tests/activation | Giữ application branch, flag negotiated flow, contract tests |
| `SubmitJobCommandHandler` | HIGH: create/submit/FE/tests | Stable errors, update FE cùng series, regress FREE/STANDARD |
| PostgreSQL + R2 không atomic | Orphan/missing PDF | Key/hash deterministic, idempotent finalizer, cleanup, metrics |
| Duplicate sign/retry | Duplicate deposit/activation | Unique constraints, concurrency, idempotency, exact-once tests |
| OTP abuse | Signing risk | Hash, expiry, attempts, revoke, rate limit, audit |
| Legacy rows | “Agreed” nhưng không signature | `LEGACY_CONFIRMED`, cutoff, không gọi signed |
| PDF legal content | Dispute | Versioned template/consent/legal snapshot, owner sign-off |
| Render/Linux glyph | Bad PDF | Bundled font, Docker smoke, renderer tests |
| Status expansion | Filter/query/check constraint break | Search all usages, migration/API/FE tests |
| Stale GitNexus | Missing dependencies | Re-index, source search, detect_changes |
| Sensitive data | Privacy/security | Role DTO, safe verify, no raw OTP/key/IP |

Observability: counters proposal/accept/change/sign/OTP lock/PDF/storage cleanup; logs có agreement/job/correlation ID, không raw OTP; alert finalization failure và duplicate-finance constraint.

## 10. Files Expected to Change

| File | Symbols | Reason |
|---|---|---|
| `HRConnect/HRConnect.Domain/Entities/ServiceAgreement.cs` | new | Versioned deal/document/signature evidence |
| `HRConnect/HRConnect.Domain/Entities/ServiceAgreementSignatureChallenge.cs` | new | Agreement OTP lifecycle |
| `HRConnect/HRConnect.Domain/Entities/Job.cs` | `Job` | Current agreement + legacy compatibility |
| `HRConnect/HRConnect.Application/Features/Jobs/Common/JobConstants.cs` | statuses | `PENDING_AGREEMENT`/guards |
| `HRConnect/HRConnect.Application/Features/Jobs/Commands/CreateJob/*` | command/validator/handler | Package/terms/service rules |
| `HRConnect/HRConnect.Application/Features/Jobs/Commands/UpdateJob/*` | command/validator/handler | Same + signed edit lock |
| `HRConnect/HRConnect.Application/Features/Jobs/Commands/SubmitJob/SubmitJobCommand.cs` | handler | Remove fallback FREE |
| `HRConnect/HRConnect.Application/Features/Jobs/Commands/ApproveJob/ApproveJobCommand.cs` | handler | Split application vs negotiated |
| `HRConnect/HRConnect.Application/Features/Jobs/ServiceAgreements/**` | new feature | Proposal/respond/sign/void/read/download |
| `HRConnect/HRConnect.Infrastructure/Persistence/ApplicationDbContext.cs` | mappings | DbSets/constraints/indexes |
| `HRConnect/HRConnect.Infrastructure/Migrations/*ServiceAgreement*` | migration | Schema/backfill |
| `HRConnect/HRConnect.Infrastructure/Services/Agreements/AgreementPdfRenderer.cs` | new | SkiaSharp PDF |
| `HRConnect/HRConnect.Infrastructure/DependencyInjection.cs` | registrations | New services/repos |
| `HRConnect/HRConnect.Presentation/Endpoints/V1/Jobs/JobEndpoints.cs` | routes | API/security/rate limits |
| `HRConnect/HRConnect.UnitTests/Features/Jobs/*` | tests | Workflow/auth/idempotency/PDF |
| `HRConnect/HRConnect.UnitTests/Features/Finance/SourcingFinanceTests.cs` | tests | Deposit after signed only |
| `HRConnect-FE/src/types/api/jobs.ts` | DTOs | Agreement/status contract |
| `HRConnect-FE/src/services/api/jobsApi.ts` | methods | Agreement endpoints |
| `HRConnect-FE/src/features/jobs-mf01/useJobQueries.ts` | hooks | Queries/mutations/cache |
| `HRConnect-FE/src/features/jobs-mf01/JobFormPage.tsx` | form | Explicit package/aligned ranges |
| `HRConnect-FE/src/features/jobs-mf01/JobReviewPage.tsx` | review | Composer/version flow |
| `HRConnect-FE/src/features/jobs-mf01/CommercialTermsApprovalModal.tsx` | replace | Remove one-way approval |
| `HRConnect-FE/src/features/jobs-mf01/ServiceAgreement*.tsx` | new | HR/Client agreement UI |
| `docs/MF01/FRONTEND-INTEGRATION.md` | doc | FE/API handoff |

Tên file mới có thể chỉnh theo convention, nhưng không dồn lại thành một handler/modal lớn.

## 11. Reusable Implementation Context

```json
{
  "implementation_context": {
    "task_summary": "Complete MF01: three-service job creation, two-party negotiated agreements, PDF/OTP signing, and safe finance/activation handoff.",
    "acceptance_criteria": [
      "Explicit CV_APPLICATION package acceptance",
      "Signed agreement gates SOURCING/HEADHUNT activation",
      "Immutable versioned private PDF evidence",
      "Primary active contact signs by OTP",
      "BE/FE/DB tests and CI pass"
    ],
    "evidence_provenance": {
      "schema_version": 2,
      "head_commit": "a7b2874f86c2253680aed2087fe93333b25f7fd8",
      "generated_plan_path": "docs/plans/2026-10-21-gitnexus-plan-mf01-service-agreement-flow.md",
      "global_dirty_digest": {
        "algorithm": "sha256",
        "canonicalization": "gitnexus-evidence-provenance-v2 NUL-framed UTF-8 records",
        "value": "0a9c85780067d9afcd0764f307b60891e3cee927ee11eaeb5ec7826d10fd82cd"
      },
      "cited_path_manifest": [
        {
          "path": ".github/workflows/ci.yml",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:08088fd0512769c785477a19191543f63a6adf8528d7e5bf0a2154c8a12a2b1a",
          "index_digest": "sha256:08088fd0512769c785477a19191543f63a6adf8528d7e5bf0a2154c8a12a2b1a",
          "worktree_digest": "sha256:1d8e64e50bc44eb6c8d5adaa19a81894cecefa655cb2847335d3bdb08020432d",
          "untracked_digest": "absent"
        },
        {
          "path": "AGENTS.md",
          "object_kind": {
            "head": "absent",
            "index": "absent",
            "worktree": "absent",
            "untracked": "regular"
          },
          "state": "untracked",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "absent",
          "index_digest": "absent",
          "worktree_digest": "absent",
          "untracked_digest": "sha256:8d6bf91756738c63b47d586b3872c7e81e6b21080c124252305981667be4c577"
        },
        {
          "path": "HRConnect-FE/package.json",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:9e0cf6fc685c0f84dbeb07af343d78463c30ebdfd2b4af30237af31cd1ddaf3a",
          "index_digest": "sha256:9e0cf6fc685c0f84dbeb07af343d78463c30ebdfd2b4af30237af31cd1ddaf3a",
          "worktree_digest": "sha256:ba7f814ff7746f9b3248a235ed15c9664aa2e57ea940725ea466d9a3d709205e",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect-FE/src/features/jobs-mf01/CommercialTermsApprovalModal.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:984954a546e113719a105cf8c397af39e5c093daab20d19167357aa31ea89558",
          "index_digest": "sha256:984954a546e113719a105cf8c397af39e5c093daab20d19167357aa31ea89558",
          "worktree_digest": "sha256:16fc8cfb35409649817714f00054c861e164ee63e6d77a14e22e84f2de289a93",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect-FE/src/features/jobs-mf01/JobFormPage.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:7635616bab8a6cca6419b825fa4765f0db9e6a91237a48dbe1b07dcce479fa5a",
          "index_digest": "sha256:7635616bab8a6cca6419b825fa4765f0db9e6a91237a48dbe1b07dcce479fa5a",
          "worktree_digest": "sha256:99bad7a54d12cffd18bcd60efc51b0f8dd86f259915536d401df37227aa8b27d",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect-FE/src/features/jobs-mf01/JobReviewPage.tsx",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:5766c732d9f1e4270a598513dc6718298ca04dd9bc157af8b381205d63a94db4",
          "index_digest": "sha256:5766c732d9f1e4270a598513dc6718298ca04dd9bc157af8b381205d63a94db4",
          "worktree_digest": "sha256:e0123994310edf10b6ca5da5cbdf20dbfba61b749bd933c1ec664d46ccff730e",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect-FE/src/features/jobs-mf01/useJobQueries.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:84bad5ed4aee9b204043b983780c78f69632c7ae82fe44fc47dfdaee5ad3d536",
          "index_digest": "sha256:84bad5ed4aee9b204043b983780c78f69632c7ae82fe44fc47dfdaee5ad3d536",
          "worktree_digest": "sha256:e7a6798e1f518861f6a1ac3e7762d0ece9a4d5638cc28d6a177c2eb66b71fbdd",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect-FE/src/services/api/jobsApi.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:13bba65e85ac285bcf93162957a75b2bc314dc5d651ceece9c660637a8f59a7a",
          "index_digest": "sha256:13bba65e85ac285bcf93162957a75b2bc314dc5d651ceece9c660637a8f59a7a",
          "worktree_digest": "sha256:83a88105c5b194d78a360d724456c8335766912b1adcdce0a6d5248c43764d83",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect-FE/src/types/api/jobs.ts",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:c21f7ad1e2850d1897217f2f6c256e874b7e1319a96947a16220bb0fed01ee28",
          "index_digest": "sha256:c21f7ad1e2850d1897217f2f6c256e874b7e1319a96947a16220bb0fed01ee28",
          "worktree_digest": "sha256:620208fff4be9add11eb6bd9fb833f5bc3afb22ee3014db64e518d2685c04884",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.Application/Common/Interfaces/IFileStorageService.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:74ddcff38efc76533f776bb812cb9ffaec57c9ec52741eec4f0fc81e6702a9f4",
          "index_digest": "sha256:74ddcff38efc76533f776bb812cb9ffaec57c9ec52741eec4f0fc81e6702a9f4",
          "worktree_digest": "sha256:24fe72e0cd145326922ed26619e9d72fd5b709c9b641997f7b30830f16ce8f78",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.Application/Common/Interfaces/IOtpService.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:ba1a5ef411a4b413acaf4cfe286ed2b9be75d77272851bc6901675dbbe96c627",
          "index_digest": "sha256:ba1a5ef411a4b413acaf4cfe286ed2b9be75d77272851bc6901675dbbe96c627",
          "worktree_digest": "sha256:aee636fc30ac589240e6be5caf3ae0da4059f443edf31e3722798400fa30ce7d",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.Application/Features/Finance/Common/SourcingFinanceService.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:1f4ee82fb83930dbd07f79a8297dc7e3ef0285d16048ba12eba81c8c83be5950",
          "index_digest": "sha256:1f4ee82fb83930dbd07f79a8297dc7e3ef0285d16048ba12eba81c8c83be5950",
          "worktree_digest": "sha256:15ff1935aebc75abfe257bc1fc529a39ac0b4032d4158ec3f4033ac89806f59d",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.Application/Features/Jobs/Commands/ApproveJob/ApproveJobCommand.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:3016a0bdd3bb41a89b101617f60ffe858a758d046e76b6f3233f6165e7c4ab55",
          "index_digest": "sha256:3016a0bdd3bb41a89b101617f60ffe858a758d046e76b6f3233f6165e7c4ab55",
          "worktree_digest": "sha256:08756436c69d06153624f7bb9fa590337f4f8bb5a209bbb925c08c6a5ccc1c31",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.Application/Features/Jobs/Commands/CreateJob/CreateJobCommand.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:770c22f30941134ba5c981c2229e2126520dfc4359ab9930a0215515381dd510",
          "index_digest": "sha256:770c22f30941134ba5c981c2229e2126520dfc4359ab9930a0215515381dd510",
          "worktree_digest": "sha256:5a0df6b9e0aa34b4b33675546d95347f7756827de27bc067670d3e55912604c5",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.Application/Features/Jobs/Commands/CreateJob/CreateJobCommandHandler.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:7560cfd948ee23e727ee7e9f6440874b8a935ce9e1c8343873fb6266a54ff649",
          "index_digest": "sha256:7560cfd948ee23e727ee7e9f6440874b8a935ce9e1c8343873fb6266a54ff649",
          "worktree_digest": "sha256:565c609199dd44c2fad82cb6c47b486c37f035c0b6789679d751b848acd7e5fa",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.Application/Features/Jobs/Commands/SubmitJob/SubmitJobCommand.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:5652fb3cd09889fea6303a889d44f70a816fd7d997151d9864e9e95c40bf8bba",
          "index_digest": "sha256:5652fb3cd09889fea6303a889d44f70a816fd7d997151d9864e9e95c40bf8bba",
          "worktree_digest": "sha256:2d8517070aaac0e0bddc579ebc8ba8987b891443395c5dfb2ee73b71556beb9d",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.Application/Features/Jobs/Common/JobCommercialTermsModels.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:8083e8002119f145cfcd5139b68c2a4955c2a74a187fe94554ed9fdf03a9072e",
          "index_digest": "sha256:8083e8002119f145cfcd5139b68c2a4955c2a74a187fe94554ed9fdf03a9072e",
          "worktree_digest": "sha256:d5ec08f87672fbb20c749d1fa07d7975853c59b3da7bd388448b226044a10d1c",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.Application/Features/Jobs/Common/JobConstants.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:f5be971846c574ab31e18fc9414e6d749fb7850ef283e34ec8a80a0783e77c2a",
          "index_digest": "sha256:f5be971846c574ab31e18fc9414e6d749fb7850ef283e34ec8a80a0783e77c2a",
          "worktree_digest": "sha256:a5b8fa1e3a1ddc39721544bdf4c381bb54b5749829421566bbe0e50a449d4156",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.Application/Features/Jobs/Common/JobDto.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:b0ba1b436d1a2fd9804631c868fb3121a1ef4119676320f95d626c8451ce153f",
          "index_digest": "sha256:b0ba1b436d1a2fd9804631c868fb3121a1ef4119676320f95d626c8451ce153f",
          "worktree_digest": "sha256:5403cdb8fc75234ee5176fb7e038b9b126901d0f0dc17fca61a968ed6d0bfa69",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.Domain/Entities/Company.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:fc2a14ba8366ee85fc6e5407f09241ab99bcfb725cbe3704b16d09beea9c12e1",
          "index_digest": "sha256:fc2a14ba8366ee85fc6e5407f09241ab99bcfb725cbe3704b16d09beea9c12e1",
          "worktree_digest": "sha256:1ca0d91ef456c3c2bdf1e55b7c7a453f67dfbd21713e4bb41466cb13779e377d",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.Domain/Entities/CompanyUser.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:bff1a8f0cae0735c87e520a4a2291e3c53bc0b493d288da5d99ccd2c6d3671ea",
          "index_digest": "sha256:bff1a8f0cae0735c87e520a4a2291e3c53bc0b493d288da5d99ccd2c6d3671ea",
          "worktree_digest": "sha256:41853af72243ac92b17b04c64dca69037ef1112b1cc20a20af974595d5b8c0ed",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.Domain/Entities/Job.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:f51adfe3073b7b9a0483e982642848eb3053636259146372f72a0fa317ea2189",
          "index_digest": "sha256:f51adfe3073b7b9a0483e982642848eb3053636259146372f72a0fa317ea2189",
          "worktree_digest": "sha256:de0d0b552a38db4a37b72a0edb8042ac6e2b6aa103ec14eb41f79a16a199ceaf",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.Domain/Entities/UserToken.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:a19d66e8b10cc93e4d418cb66aa8fc45ee12ff25d223185aaff14d299333138f",
          "index_digest": "sha256:a19d66e8b10cc93e4d418cb66aa8fc45ee12ff25d223185aaff14d299333138f",
          "worktree_digest": "sha256:ad4d092221cb5e6502e480e84bf8781da24ee4de8d6ea7ab6dafcbbbb7bba44c",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.Infrastructure/Assets/Fonts/LICENSE-Roboto.txt",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:59f51aaa1475c4c666a6dcfb348818b79ccac7893614caa6711c60299f9ee2dd",
          "index_digest": "sha256:59f51aaa1475c4c666a6dcfb348818b79ccac7893614caa6711c60299f9ee2dd",
          "worktree_digest": "sha256:8cf66a18180e9b950a9e14f96456f79cff00fc95e3d33388b7bdb50b9a6920e1",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.Infrastructure/HRConnect.Infrastructure.csproj",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:7a9f0fb440be84f1e330806ab74911d3a00f6365361d27a16cf3493c2f05bfa4",
          "index_digest": "sha256:7a9f0fb440be84f1e330806ab74911d3a00f6365361d27a16cf3493c2f05bfa4",
          "worktree_digest": "sha256:ce550516f2df1f31b7dd3c1a47fc4f09eed1ffb2ad0de332170de2b30a0271af",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.Infrastructure/Persistence/ApplicationDbContext.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:6ff806495153e21607535a01b85a4937425d96f4638079422da8c2836dae5aa2",
          "index_digest": "sha256:6ff806495153e21607535a01b85a4937425d96f4638079422da8c2836dae5aa2",
          "worktree_digest": "sha256:f6789cfc37eb9414b92c029421a35982f15d67430d271fdb7d7552346dd12116",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.Infrastructure/Services/CvBuilder/CvPdfRenderer.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:00391cb95103ae8732b04447af9895245f5bbd1f7f05eb95f8261b4c76b3062d",
          "index_digest": "sha256:00391cb95103ae8732b04447af9895245f5bbd1f7f05eb95f8261b4c76b3062d",
          "worktree_digest": "sha256:347126b599280dba320d88c9f90460fa3d25690b931148bbc6d1b200d11852fa",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.Infrastructure/Services/Storage/CloudflareR2StorageService.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:da635d753e98f5afabc88a6f367e946d3084e6b48857394e3a139dfdafc4d350",
          "index_digest": "sha256:da635d753e98f5afabc88a6f367e946d3084e6b48857394e3a139dfdafc4d350",
          "worktree_digest": "sha256:370458cb7b262fd989f8ec8d97b5100fbc47ccc33c9dd38030123fbf2d5729d0",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.Presentation/Endpoints/V1/Jobs/JobEndpoints.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:a61700790660fefc323d851df2740926e3a1cfe458bbe0b0318b66216672d57d",
          "index_digest": "sha256:a61700790660fefc323d851df2740926e3a1cfe458bbe0b0318b66216672d57d",
          "worktree_digest": "sha256:2b73624ff554e48845a1615e84a1e31c3e1763f15eb7811a5d00cdf0d330f289",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.UnitTests/Common/Services/OtpServiceTests.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:d3b85ae01d2e8bed433950a08a952489e87880f1fa596c11e313d98a016203bb",
          "index_digest": "sha256:d3b85ae01d2e8bed433950a08a952489e87880f1fa596c11e313d98a016203bb",
          "worktree_digest": "sha256:d41e72e666e19ce576c486ec972ed9ebbe17a959228b2662b0b8d1468188796b",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.UnitTests/Features/Finance/SourcingFinanceTests.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:c5300f5993fc09f7e1b700e478e40b210a282430984931df69df64fb4d8ba40a",
          "index_digest": "sha256:c5300f5993fc09f7e1b700e478e40b210a282430984931df69df64fb4d8ba40a",
          "worktree_digest": "sha256:6cd89ed75114bc1add2f7728ecf59c2960766a994573479501e12d080e452298",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.UnitTests/Features/Jobs/JobCommercialTermsTests.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:c2d8c5ea1fb727333f9b095fe6462526e415eabd1f50dc8e27b2dbc8fa803c55",
          "index_digest": "sha256:c2d8c5ea1fb727333f9b095fe6462526e415eabd1f50dc8e27b2dbc8fa803c55",
          "worktree_digest": "sha256:54a4a7ecd9365b30fb7be331d4394bbebcbcd1ab3964b4e988b4b3751490733f",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.UnitTests/Features/Jobs/JobManagementCommandHandlerTests.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:a6f7934c9e9c8e604a7f60cb410fb423dc1c92e05cc0bdef9efba7f87f6813e0",
          "index_digest": "sha256:a6f7934c9e9c8e604a7f60cb410fb423dc1c92e05cc0bdef9efba7f87f6813e0",
          "worktree_digest": "sha256:2419ef3d2aa28062e027c5ceca55295cfdc4c7c64ed95a9d47ac926077d1f56d",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.UnitTests/Features/Jobs/RealDatabaseMf01IntegrationTests.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:b0fc69e63ee6393e0c630cb99d1708421ebd16f2d7880118eeaa365f705666a1",
          "index_digest": "sha256:b0fc69e63ee6393e0c630cb99d1708421ebd16f2d7880118eeaa365f705666a1",
          "worktree_digest": "sha256:78dc6a4f2cc1c469f5f6f4500e4fc5e092b444dbaa5716ac27102534a3182113",
          "untracked_digest": "absent"
        },
        {
          "path": "HRConnect/HRConnect.UnitTests/Services/Storage/CloudflareR2StorageServiceTests.cs",
          "object_kind": {
            "head": "regular",
            "index": "regular",
            "worktree": "regular",
            "untracked": "absent"
          },
          "state": "clean",
          "rename_from": null,
          "rename_to": null,
          "head_digest": "sha256:db8989415baaa1d2a7245eed07e3f648cbf4c979928f70fc3d5756c36ea82b4d",
          "index_digest": "sha256:db8989415baaa1d2a7245eed07e3f648cbf4c979928f70fc3d5756c36ea82b4d",
          "worktree_digest": "sha256:9e56f2c57d938c8dab26eb2f16d0b33e87ef8e8ff8ea63ad690e34808048556b",
          "untracked_digest": "absent"
        }
      ]
    },
    "primary_symbols": [
      {
        "symbol": "SubmitJobCommandHandler.Handle",
        "file": "HRConnect/HRConnect.Application/Features/Jobs/Commands/SubmitJob/SubmitJobCommand.cs",
        "lines": "27-182",
        "role": "Submission and package gate"
      },
      {
        "symbol": "ApproveJobCommandHandler.Handle",
        "file": "HRConnect/HRConnect.Application/Features/Jobs/Commands/ApproveJob/ApproveJobCommand.cs",
        "lines": "51-394",
        "role": "Current terms, finance and activation coupling"
      },
      {
        "symbol": "Job",
        "file": "HRConnect/HRConnect.Domain/Entities/Job.cs",
        "lines": "47-166",
        "role": "Current flat proposal/agreement storage"
      },
      {
        "symbol": "CommercialTermsApprovalModal",
        "file": "HRConnect-FE/src/features/jobs-mf01/CommercialTermsApprovalModal.tsx",
        "lines": "53-264",
        "role": "Current one-way HR approval UI"
      },
      {
        "symbol": "JobFormPage",
        "file": "HRConnect-FE/src/features/jobs-mf01/JobFormPage.tsx",
        "lines": "451-2030",
        "role": "Three-service creation UI"
      }
    ],
    "related_symbols": [
      {
        "symbol": "CreateJobCommandHandler.Handle",
        "relationship": "precedes",
        "relevance": "Creates draft/proposal"
      },
      {
        "symbol": "SourcingFinanceService.EnsureDepositAsync",
        "relationship": "post-sign side effect",
        "relevance": "Must be exact-once"
      },
      {
        "symbol": "IFileStorageService",
        "relationship": "storage boundary",
        "relevance": "Private PDF/presigned URL"
      },
      {
        "symbol": "IOtpService/UserToken",
        "relationship": "security pattern",
        "relevance": "Hash/expiry/attempts"
      },
      {
        "symbol": "CvPdfRenderer",
        "relationship": "render pattern",
        "relevance": "SkiaSharp and Vietnamese font"
      },
      {
        "symbol": "JobEndpoints",
        "relationship": "HTTP composition",
        "relevance": "Routes/auth/rate limits"
      }
    ],
    "execution_path": [
      "Client submits job",
      "HR approves application content or sends negotiated agreement",
      "Client accepts or requests versioned changes",
      "Primary contact signs with OTP",
      "BE seals PDF/evidence in R2",
      "Signed HEADHUNT activates; signed SOURCING creates one deposit and awaits payment"
    ],
    "pdg_constraints": [
      {
        "description": "Do not write official terms/AgreedAt from HR request",
        "affected_statements": [
          "ApproveJobCommand.cs:119-133",
          "ApproveJobCommand.cs:203-218"
        ],
        "implementation_consequence": "Move to signed finalizer"
      },
      {
        "description": "Finance only after signed evidence and idempotency",
        "affected_statements": [
          "ApproveJobCommand.cs:231-233",
          "ApproveJobCommand.cs:327-394"
        ],
        "implementation_consequence": "Unique agreement-based handoff"
      },
      {
        "description": "No implicit FREE package",
        "affected_statements": [
          "SubmitJobCommand.cs:82-140"
        ],
        "implementation_consequence": "Stable validation error and explicit FE acceptance"
      }
    ],
    "architectural_patterns": [
      {
        "pattern": "MediatR command/query",
        "example_location": "HRConnect/HRConnect.Presentation/Endpoints/V1/Jobs/JobEndpoints.cs",
        "usage_guidance": "Thin endpoints; domain transitions in handlers"
      },
      {
        "pattern": "Private R2 + presigned URL",
        "example_location": "HRConnect/HRConnect.Application/Common/Interfaces/IFileStorageService.cs",
        "usage_guidance": "Persist key/hash, never URL"
      },
      {
        "pattern": "SkiaSharp PDF + bundled Roboto",
        "example_location": "HRConnect/HRConnect.Infrastructure/Services/CvBuilder/CvPdfRenderer.cs",
        "usage_guidance": "Separate AgreementPdfRenderer"
      },
      {
        "pattern": "Optimistic concurrency",
        "example_location": "HRConnect/HRConnect.Domain/Entities/Job.cs:57",
        "usage_guidance": "Mutation token; stale is 409"
      }
    ],
    "files_to_modify": [
      {
        "file": "HRConnect/HRConnect.Domain/Entities/Job.cs",
        "symbols": [
          "Job"
        ],
        "intended_change": "Current agreement relation and legacy compatibility"
      },
      {
        "file": "HRConnect/HRConnect.Application/Features/Jobs/Commands/SubmitJob/SubmitJobCommand.cs",
        "symbols": [
          "SubmitJobCommandHandler"
        ],
        "intended_change": "Explicit package/terms acceptance"
      },
      {
        "file": "HRConnect/HRConnect.Application/Features/Jobs/Commands/ApproveJob/ApproveJobCommand.cs",
        "symbols": [
          "ApproveJobCommandHandler"
        ],
        "intended_change": "Separate application approval from negotiated agreement"
      },
      {
        "file": "HRConnect/HRConnect.Presentation/Endpoints/V1/Jobs/JobEndpoints.cs",
        "symbols": [
          "MapJobEndpoints"
        ],
        "intended_change": "Agreement APIs/security"
      },
      {
        "file": "HRConnect/HRConnect.Infrastructure/Persistence/ApplicationDbContext.cs",
        "symbols": [
          "ApplicationDbContext"
        ],
        "intended_change": "Agreement/challenge mapping and constraints"
      },
      {
        "file": "HRConnect-FE/src/features/jobs-mf01/JobFormPage.tsx",
        "symbols": [
          "JobFormPage"
        ],
        "intended_change": "Package acceptance and aligned ranges"
      },
      {
        "file": "HRConnect-FE/src/features/jobs-mf01/JobReviewPage.tsx",
        "symbols": [
          "JobReviewPage"
        ],
        "intended_change": "Agreement composer/version flow"
      },
      {
        "file": "HRConnect-FE/src/services/api/jobsApi.ts",
        "symbols": [
          "jobsApi"
        ],
        "intended_change": "Agreement endpoints"
      },
      {
        "file": "HRConnect-FE/src/types/api/jobs.ts",
        "symbols": [
          "job/agreement DTOs"
        ],
        "intended_change": "Status/version/document/signing contract"
      }
    ],
    "tests": [
      {
        "file": "HRConnect/HRConnect.UnitTests/Features/Jobs/JobCommercialTermsTests.cs",
        "scenarios": [
          "Proposal does not activate",
          "Signed HEADHUNT activates",
          "Signed SOURCING creates one deposit"
        ]
      },
      {
        "file": "HRConnect/HRConnect.UnitTests/Features/Jobs/JobManagementCommandHandlerTests.cs",
        "scenarios": [
          "Missing package/acceptance fails",
          "FREE/STANDARD regression"
        ]
      },
      {
        "file": "HRConnect/HRConnect.UnitTests/Features/Jobs/RealDatabaseMf01IntegrationTests.cs",
        "scenarios": [
          "Unique version/current",
          "Concurrency 409",
          "Signed immutable",
          "Sign retry idempotent"
        ]
      },
      {
        "file": "HRConnect/HRConnect.UnitTests/Features/Jobs/ServiceAgreementWorkflowTests.cs",
        "scenarios": [
          "Ownership/permissions",
          "Primary signer",
          "OTP expiry/replay/lock",
          "Version supersession"
        ]
      },
      {
        "file": "HRConnect/HRConnect.UnitTests/Features/Jobs/ServiceAgreementPdfRendererTests.cs",
        "scenarios": [
          "Vietnamese PDF",
          "Hash and verification code"
        ]
      },
      {
        "file": "HRConnect-FE/src/features/jobs-mf01/ServiceAgreementFlow.test.tsx",
        "scenarios": [
          "HR compose/send",
          "Client respond/sign",
          "Role-safe rendering"
        ]
      }
    ],
    "verification_commands": [
      "dotnet restore HRConnect/HRConnect.sln",
      "dotnet build HRConnect/HRConnect.sln --configuration Release --no-restore",
      "dotnet test HRConnect/HRConnect.sln --configuration Release --no-build",
      "npm ci --no-audit --no-fund (cwd HRConnect-FE)",
      "npm run lint (cwd HRConnect-FE)",
      "npm test (cwd HRConnect-FE)",
      "npm run build (cwd HRConnect-FE)"
    ],
    "risks": [
      "HIGH impact approve/submit handlers",
      "R2 and DB non-atomicity",
      "OTP abuse/replay",
      "Legacy records lack signatures",
      "Linux font/PDF runtime",
      "Stale GitNexus index"
    ],
    "assumptions": [
      "Signature means authenticated consent + email OTP; confirm legal expectation",
      "Signer is ACTIVE primary contact unless delegation is designed",
      "Reuse SkiaSharp/Roboto/R2; verify Linux render",
      "CV_APPLICATION uses public package acceptance, no negotiated PDF"
    ],
    "open_questions": [
      "HR Connect legal entity fields",
      "Candidate ownership duration",
      "Qualified CV/replacement/refund terms",
      "Delegated signer policy",
      "OTP limits",
      "Public verification fields"
    ],
    "avoid": [
      "Do not repeat full repository discovery",
      "Do not replace established patterns without evidence",
      "No PDF bytes or presigned URLs in DB",
      "No HR-only agreement",
      "No finance before signature",
      "Never overwrite signed PDF",
      "No object keys/OTP hashes/raw IP in public DTOs",
      "Do not expand into MF03/MF05 lifecycle"
    ]
  }
}
```

## 12. Assumptions and Open Questions

### Assumptions

- [assumed] Chữ ký là authenticated Client + email OTP + evidence log, không phải chữ ký số có chứng thư. Phải xác nhận kỳ vọng với thầy/pháp lý trước production thương mại.
- [assumed] Signer mặc định là CompanyUser `ACTIVE` + `IsPrimaryContact`; ủy quyền cần workflow riêng.
- [verified] CV_APPLICATION dùng gói công khai, không deal PDF riêng; lưu package/price/terms-version acceptance.
- [verified] SkiaSharp/Roboto/R2 đã có; không thêm QuestPDF trong scope.
- [assumed] IP được hash/HMAC; không đưa raw security evidence ra DTO.

### Open questions before enforcement

1. Pháp nhân HR Connect trên PDF: tên, MST, địa chỉ, người đại diện/chức danh?
2. Candidate ownership/anti-bypass là 6, 9 hay 12 tháng?
3. “Qualified CV”, CV trùng/từ chối/không liên lạc và replacement/refund được định nghĩa thế nào?
4. Headhunt fee theo tháng lương hay % annual salary; mốc phát sinh phí/warranty cuối cùng?
5. Có cho signer khác primary contact không; cần ủy quyền/admin approval?
6. OTP expiry, max attempts, resend cooldown, daily cap?
7. Có cần ảnh chữ ký hay typed signer + OTP evidence là đủ?
8. Public verify được hiển thị trường nào?

Các câu hỏi không chặn dựng schema/workflow có cấu hình; chúng chặn bật enforcement production.

## 13. Definition of Done

- [ ] Ba service create/update/submit đúng rule, FE/BE validation đồng nhất.
- [ ] CV_APPLICATION không fallback FREE; package và terms version được xác nhận rõ.
- [ ] SOURCING/HEADHUNT có proposal versions, accept/change request, `PENDING_AGREEMENT`.
- [ ] Chỉ primary active contact ký; OTP hash/expiry/attempt/revoke/replay đầy đủ.
- [ ] Signed agreement có immutable PDF tiếng Việt private R2, SHA-256, verification code và snapshots.
- [ ] Không terms/deposit/activation trước ký; after-sign transitions idempotent.
- [ ] API role/ownership/concurrency/rate-limit/error contract có tests.
- [ ] HR và Client FE có compose/version/respond/sign/download/status UX.
- [ ] Legacy backfill `LEGACY_CONFIRMED`, không giả chữ ký/đổi status.
- [ ] Notifications/audit/metrics/cleanup hoạt động, không log raw OTP/sensitive metadata.
- [ ] PostgreSQL, PDF/storage, finance exact-once, BE/FE tests, lint/build và Docker image đạt.
- [ ] Frontend integration doc/OpenAPI đủ cho dev khác làm không cần đọc handler.
- [ ] Feature flag chỉ bật sau migration + hai FE roles deploy; có rollback/runbook.
