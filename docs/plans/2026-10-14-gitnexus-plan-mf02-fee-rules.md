# GitNexus Engineering Plan

> Task: Đồng bộ MF02 với quy tắc phí/hoa hồng đã chốt, dùng thời hạn Client ownership 30 ngày, bảo vệ attribution và ẩn trạng thái nội bộ khỏi Candidate.
> Evidence verified at commit 13520ec1614fcef0272c92954af11f5897de04c8; GitNexus index 86 commits behind, refresh attempted with `analyze --index-only --pdg` but failed during parser-worker startup, so graph output is navigational only and every load-bearing claim below is source-verified.
> Evidence provenance schema 2; global dirty digest `0a9c85780067d9afcd0764f307b60891e3cee927ee11eaeb5ec7826d10fd82cd`; cited-path manifest 28 sorted entries; exact generated plan path excluded.

## 1. Objective

Hoàn thiện MF02 theo bốn quy tắc đã thống nhất:

1. Cùng Candidate + cùng Job chỉ có một lượt Affiliate hợp lệ đang chờ hoặc đã được xác nhận; lượt sau nhận `409 CANDIDATE_ALREADY_SUBMITTED` mà không lộ Affiliate trước.
2. Với `HEADHUNT_COD` và `CV_SOURCING`, Affiliate không được giới thiệu Candidate mà cùng Client đã có Application trong **30 ngày gần nhất**. Giá trị là setting `mf02.client_ownership_days`, mặc định 30, không ghi cứng.
3. Mọi API Candidate nhìn thấy Application chỉ trả trạng thái hiển thị `displayGroup/displayLabel`, không trả trạng thái, stage hay lý do nội bộ.
4. Khi MF05 mở suất thay thế, MF02 tự gắn lượt nộp vào đúng Placement gốc và trả `isReplacement/replacementForPlacementId`; Affiliate không tự chọn và MF02 không tạo phí.

Kết quả phải an toàn khi nhiều request chạy đồng thời, giữ nguyên consent, attribution, audit, notification và MF03 outbox hiện có.

## 2. Current Behaviour

- [verified] `SubmitCandidateCommandHandler.Handle` nhận diện Candidate, chặn Application/Submission `ACCEPTED`, chặn một `PENDING_CONSENT` chưa hết hạn, hết hạn consent cũ trước khi tạo lượt mới, rồi lưu Candidate/CV/Submission/Consent/EmailOutbox trong transaction. Application, Attribution và MF03 chưa được tạo ở bước này.
- [verified] Database có partial unique indexes `uq_submission_one_pending_consent` và `uq_submission_one_accepted` trên `(job_id, candidate_id)`, cùng unique `application_candidate_id_job_id_key`. B1 đã có nền concurrency ở mức cùng Job.
- [verified] Các xung đột B1 đang trả message chung; `JobEndpoints.Run` bỏ `ConflictException.ErrorCode`, chưa hỗ trợ payload `data`, nên chưa đạt contract đã chốt.
- [verified] `RespondSubmissionConsentCommandHandler.Handle` kiểm tra trùng lần cuối, xác minh Affiliate, rồi trong một transaction đổi Submission thành `ACCEPTED`, tạo Application, Attribution, MF03 request, audit và notification.
- [verified] Chưa có truy vấn Candidate + Company + thời gian, chưa có setting MF02, và confirm consent không kiểm tra Client ownership.
- [verified] `GetCandidateApplicationsQueryHandler` trả thẳng `Application.Status`; API chi tiết còn trả `Status`, `CurrentStage`, `StatusReason`; lịch sử dùng CV Affiliate cũng trả `ApplicationStatus/ApplicationCurrentStage`.
- [verified] `ApplicationRepository.GetCandidateApplicationsFilteredAsync` chưa load Offers, nên chưa thể bảo đảm `OFFER` chỉ hiện khi Offer thật sự ở `SENT`.
- [verified] MF05 hiện chỉ chuyển Placement sang `LEFT_DURING_WARRANTY` và Warranty sang `VOIDED`; chưa có persisted replacement slot, trạng thái mở/đóng slot hoặc liên kết Submission → Placement gốc. Không thể suy luận B4 an toàn chỉ từ trạng thái Placement.

## 3. Relevant Architecture

- [verified] Domain/Application/Infrastructure/Presentation được tách lớp; handler chỉ phụ thuộc repository/service interface, EF Core nằm ở Infrastructure.
- [verified] Business numbers được khai báo tập trung trong `BusinessSettingKeys.All`, đọc qua `IAdminBusinessSettings`, lưu override trong `system_setting`; thêm MF02 setting không cần cột database mới.
- [verified] Candidate self-apply và Affiliate consent-confirm là hai đường duy nhất hiện tạo `Application`. Cả hai phải dùng cùng transaction lock Candidate + Company để tránh race giữa direct apply và Affiliate confirm.
- [verified] Candidate-facing endpoints là biên bảo mật dữ liệu. Một mapper dùng chung phải phục vụ list, detail và Affiliate-CV usage để không có API phụ làm lộ trạng thái nội bộ.
- [inferred] Client ownership là derived rule từ Application hiện hữu, không nên tạo bản sao dữ liệu ownership. Một truy vấn có index phù hợp và transaction-level advisory lock giữ nguồn sự thật ở bảng `application`.
- [assumed] MF05 sẽ cung cấp một replacement-slot contract có trạng thái `OPEN` trước khi triển khai B4. Không thêm logic suy diễn tạm trong MF02.

## 4. GitNexus Findings

- [graph] `impact(target=SubmitCandidateCommandHandler.Handle, direction=upstream, depth=3)` trên index cũ báo CRITICAL với 31 direct dependents, chủ yếu là test trong `SubmitCandidateCommandHandlerTests.cs`. Source hiện tại xác nhận đây là orchestration chính của Affiliate submission.
- [graph] `impact(target=RespondSubmissionConsentCommandHandler.Handle, direction=upstream, depth=3)` báo 11 direct dependents, chủ yếu là `RespondSubmissionConsentCommandHandlerTests.cs`. Source xác nhận mọi side effect tiền đề của Attribution/MF03 nằm ở đây.
- [graph] `impact(target=GetCandidateApplicationsQueryHandler.Handle, direction=upstream, depth=3)` báo 6 direct dependents, chủ yếu là test Candidate application.
- [graph] `impact(target=SubmissionRepository, direction=upstream, depth=3)` báo 4 direct dependents; source hiện tại cho thấy repository còn phục vụ kho Candidate/CV và consent list, nên thay đổi phải thêm method thay vì đổi semantics method cũ.
- [graph] `api_impact` không tìm thấy hai route hiện tại và `pdg_query` không tìm thấy symbol vì index đang ở commit cũ; không dùng kết quả rỗng này làm bằng chứng an toàn.
- [verified] Text/source search bù phần graph stale đã tìm đủ route, handler, repository, constraint và test liên quan.

## 5. Statement-Level PDG Findings

PDG hiện tại không dùng được ở HEAD: phiên refresh có `--pdg` thất bại khi parser workers không ready trong 5 giây; probe `pdg_query(mode=controls, target=SubmitCandidateCommandHandler.Handle)` không tìm thấy symbol trong index cũ.

Source-derived control/data constraints:

- [verified] Candidate phải được resolve trước duplicate/ownership check; Candidate mới chỉ được tạo sau khi các kiểm tra tiền upload đã qua.
- [verified] Existing accepted Submission/Application phải được kiểm tra trước pending consent; pending hết hạn được đóng rồi mới cho tạo lượt mới.
- [verified] Upload R2 xảy ra trước DB transaction và có compensation khi transaction/race thất bại; mọi nhánh block mới phải chạy trước upload khi có thể.
- [verified] Confirm consent hiện check trùng trước khi bắt đầu transaction. B2 phải được kiểm tra lại **sau khi bắt đầu transaction và lấy lock**, nếu không hai Job cùng Company có thể cùng tạo Application.
- [verified] Candidate self-apply upload/chọn CV trước duplicate check. Đường này phải lấy cùng advisory lock trước tạo Application và giữ compensation hiện có.
- [verified] Status mapping cần xem cả `Application.Status` và Offers; `OFFER_PENDING` không có Offer `SENT` phải hiển thị `IN_REVIEW`, không được lộ offer nháp.

## 6. Proposed Changes

### 6.1 Chốt tài liệu và setting 30 ngày

- **File:** `HRConnect/docs/MF02/mf02-viec-can-lam-theo-quy-tac-phi.md`
  - Đổi B2 từ “N tháng/chưa chốt” sang **30 ngày đã chốt**.
  - Đổi key thành `mf02.client_ownership_days`.
  - Ghi rõ biên thời gian: `AppliedAt >= nowUtc.AddDays(-days)`; đúng ngày thứ 30 vẫn bị chặn, cũ hơn thì được phép.
  - Ghi rõ áp dụng cho `HEADHUNT_COD` và `CV_SOURCING`, không áp dụng `CV_APPLICATION`.
- **File:** `BusinessSettings.cs`
  - Thêm `Mf02ClientOwnershipDays`, group `MF02`, integer, default 30, range 1–365, unit “ngày”.
  - Cập nhật comment để không còn nói danh sách chỉ dành MF03/MF05.
- **Test:** `BusinessSettingsTests.cs` kiểm tra default, override, số lẻ, 0 và >365.

### 6.2 Chuẩn hóa conflict contract của Affiliate submit

- **File:** `ConflictException.cs`
  - Thêm optional `Details` chỉ chứa dữ liệu an toàn để Presentation serialize; giữ constructor cũ tương thích.
- **File:** `JobEndpoints.cs`, symbol `Run`
  - Trả `{ success, errorCode, message, data }` cho `ConflictException`.
  - Swagger mô tả rõ hai mã `CANDIDATE_ALREADY_SUBMITTED`, `CANDIDATE_OWNED_BY_CLIENT`.
- **File:** `SubmitCandidateCommandHandler.cs`
  - Accepted/Application/Pending đều dùng `CANDIDATE_ALREADY_SUBMITTED`.
  - Chỉ pending được trả `existingSubmissionStatus=PENDING_CONSENT` và `consentExpiresAt`; không trả Affiliate, Candidate PII, Job cũ hoặc submissionId của người khác.
  - Giữ behavior: declined/expired cho phép Affiliate sau nộp; expired được đóng có audit/notification theo service hiện tại.
  - Race do partial unique index được map về cùng error code, không thành 500.

### 6.3 Client ownership 30 ngày với kiểm tra kép và concurrency lock

- **File:** `IApplicationRepository.cs` / `ApplicationRepository.cs`
  - Thêm `ExistsForCandidateAndCompanySinceAsync(candidateId, companyId, sinceUtc, cancellationToken)`.
  - Query dùng `Application.Job.CompanyId` và `AppliedAt >= sinceUtc`, không lọc theo trạng thái vì Client đã tiếp cận hồ sơ dù sau đó rejected/withdrawn.
  - Không trả Job/Application cụ thể để tránh lộ lịch sử.
- **New interface/implementation:** `ICandidateCompanyTransactionLock` trong Application Common và PostgreSQL implementation trong Infrastructure.
  - Lấy transaction-level advisory lock từ cặp `candidateId + companyId`; không dùng process-local lock.
  - Fail fast nếu gọi ngoài transaction.
- **File:** `RespondSubmissionConsentCommandHandler.cs`
  - Với Job `HEADHUNT_COD/CV_SOURCING`: bắt đầu transaction, lấy lock, chạy lại same-job duplicate và 30-day company ownership, rồi mới confirm/create Application/Attribution/MF03.
  - Nếu ownership phát sinh trong lúc chờ consent: đóng consent `CANCELLED`, Submission thành trạng thái mới `BLOCKED_CLIENT_OWNED`, archive CV pending nếu phù hợp, audit + notification Affiliate, commit trạng thái terminal rồi trả `409 CANDIDATE_OWNED_BY_CLIENT`.
  - Không tạo Application, Attribution hoặc MF03 request.
- **File:** `ApplyJobCommandHandler.cs`
  - Trước khi Candidate tự tạo Application, bắt đầu transaction và lấy cùng Candidate+Company lock. Direct apply không bị B2 chặn, nhưng lock khiến Affiliate confirm đồng thời phải chờ rồi nhìn thấy Application mới.
  - Giữ nguyên duplicate, upload compensation, quota, audit và MF03 behavior.
- **File:** `ApplicationDbContext.cs` + migration + snapshot
  - Bổ sung `BLOCKED_CLIENT_OWNED` vào check constraint Submission.
  - Thêm index `application(candidate_id, applied_at)` nếu query plan cho thấy index hiện tại `candidate_id, updated_at` không phục vụ cửa sổ 30 ngày; Company được join qua Job.
  - Migration chỉ đổi constraint/index, không backfill dữ liệu.
- [inferred] Đây là thay đổi concurrency CRITICAL: lock phải bao phủ lần kiểm tra cuối và insert Application trong cùng transaction; không giữ lock qua gửi email/R2.

### 6.4 Một policy trạng thái hiển thị cho mọi Candidate API

- **New file:** `CandidateApplicationDisplayStatusMapper.cs`
  - Pure mapper nhận `Application.Status` và trạng thái Offers, trả `displayGroup/displayLabel`.
  - Mapping đúng bảng B3.
  - `OFFER_PENDING` chỉ thành `OFFER` khi có Offer `SENT`; nếu chưa gửi thì `IN_REVIEW`.
  - Runtime unknown không lộ raw value: log warning và trả `IN_REVIEW/Đang xem xét`. Một coverage test đọc danh sách 15 trạng thái của constraint để bảo đảm trạng thái mới làm test fail cho đến khi được map.
- **List:** bỏ `Status` khỏi `CandidateApplicationItemDto`, thêm `DisplayGroup/DisplayLabel`; repository load Offers.
- **Detail:** bỏ `Status`, `CurrentStage`, `StatusReason`; thêm display pair.
- **Affiliate-CV usage:** bỏ `ApplicationStatus/ApplicationCurrentStage`; thêm nullable display pair. Submission/consent status Candidate cần để quản lý consent có thể giữ, nhưng phải dùng label công khai nếu UI hiển thị.
- **Endpoint docs:** cập nhật description/schema; cân nhắc query filter `displayGroup`. Không cho filter response dựa vào mã nội bộ.
- **FE handoff:** cập nhật tài liệu MF02 để FE chuyển badge/filter sang display pair trong cùng release. Đây là breaking response contract, phải deploy BE và FE phối hợp.

### 6.5 Replacement submission — chỉ triển khai sau contract MF05

- **Prerequisite MF05:** persisted replacement slot hoặc tương đương phải có `JobId`, `OriginalPlacementId`, `Status=OPEN/FILLED/CANCELLED`, concurrency token và quy tắc chỉ một slot OPEN cho một Placement.
- **MF02 sau prerequisite:**
  - Repository chỉ đọc slot OPEN theo Job.
  - `Submission` lưu nullable FK/link tới slot hoặc `replacement_for_placement_id`; không suy luận lại từ Job khi đọc.
  - `SubmitCandidateData` thêm `IsReplacement`, `ReplacementForPlacementId`.
  - Request không thêm field.
  - Confirm consent lấy lock/recheck slot còn OPEN trước khi tạo Application; nếu slot đã đóng thì kết thúc có kiểm soát, không tạo Attribution/MF03.
  - MF02 chỉ mang marker; MF05 quyết định replacement Placement không tạo phí mới và đóng slot.
- **Không làm tạm:** không chọn “Placement LEFT_DURING_WARRANTY mới nhất”, vì nhiều lần thay thế/chạy đồng thời sẽ gắn sai phí và bảo hành.

## 7. Implementation Sequence

1. **Baseline:** tạo branch `feature/mf02-fee-rules`; re-run GitNexus analyze/impact nếu parser worker hoạt động; nếu vẫn lỗi, giữ source verification và ghi limitation.
2. **Business contract:** cập nhật MF02 doc sang 30 ngày; thêm setting + tests. Tree vẫn build được, chưa đổi API.
3. **Conflict envelope:** mở rộng `ConflictException`, cập nhật `JobEndpoints.Run`, test serialization/handler B1; map mọi nhánh race về stable error codes.
4. **Ownership query:** thêm repository query và unit/integration tests cho biên 29/30/31 ngày, khác Company và mọi Application status.
5. **Concurrency primitive:** thêm PostgreSQL transaction advisory lock + DI + integration test hai transaction cùng Candidate/Company.
6. **Confirm path:** đưa final duplicate/ownership check vào transaction lock; thêm terminal state/audit/notification/migration; test không tạo side effects.
7. **Direct apply path:** dùng cùng lock để serialise với consent confirmation; chạy regression upload compensation và MF03 outbox.
8. **Candidate display policy:** thêm mapper; đổi list trước, rồi detail, rồi CV usage; cập nhật endpoint docs và tests sau mỗi surface.
9. **Database:** tạo migration chuẩn có `.Designer.cs` và snapshot, kiểm tra SQL Up/Down và migration trên database trống + database có dữ liệu.
10. **B4 gate:** chỉ bắt đầu sau khi MF05 contract đã merge. Impact-check symbol của MF05, sau đó thêm persistence/link/response và race tests.
11. **Final verification:** full build/test, migration verification, Swagger contract snapshot/manual response checks, `gitnexus detect-changes --scope all`; cập nhật FE handoff một lần ở cuối.

## 8. Test Strategy

### Existing test files to extend

- `SubmitCandidateCommandHandlerTests.cs`
  - pending from Affiliate A → Affiliate B gets 409 code + safe data, no PII;
  - accepted/application → same code, no data leak;
  - declined/expired → later Affiliate can submit;
  - existing same-Company Application at 29/30 days → blocked before upload/outbox;
  - 31 days, different Company, CV_APPLICATION → allowed;
  - unique-index race → stable 409, upload compensated.
- `RespondSubmissionConsentCommandHandlerTests.cs`
  - ownership appears after submit but before confirm → terminal `BLOCKED_CLIENT_OWNED`, audit/notification, no Application/Attribution/MF03;
  - two confirms on different Jobs same Company → exactly one creates Application;
  - same Job race remains `BLOCKED_DUPLICATE`;
  - other Company and older-than-window succeed.
- `GetCandidateApplicationsQueryHandlerTests.cs`
  - all 15 `ck_application_status` values map;
  - BACKUP/SCREENING do not occur anywhere in serialized response;
  - OFFER_PENDING+DRAFT → IN_REVIEW; OFFER_PENDING+SENT → OFFER;
  - unknown raw status returns safe group and logs warning.
- `GetCandidateApplicationDetailQueryHandlerTests.cs`
  - response has no status/currentStage/statusReason properties and uses same mapper.
- New/extended Candidate Affiliate CV usage tests:
  - no raw ApplicationStatus/CurrentStage; same public mapping.
- `BusinessSettingsTests.cs`
  - default/override/range/integer validation for 30-day key.
- Infrastructure tests:
  - ownership SQL query boundary;
  - advisory lock serialization;
  - migration constraint accepts `BLOCKED_CLIENT_OWNED` and rejects unknown state.
- Replacement tests after MF05:
  - open slot auto-attached and returned;
  - request cannot choose placement;
  - slot closes during consent → no application;
  - normal job returns `isReplacement=false`;
  - replacement application eventually produces no new service fee (cross-MF contract test owned by MF05).

### Verification commands

- `dotnet build HRConnect/HRConnect.sln --configuration Release`
- `dotnet test HRConnect/HRConnect.UnitTests/HRConnect.UnitTests.csproj --configuration Release --filter "FullyQualifiedName~SubmitCandidate|FullyQualifiedName~RespondSubmissionConsent|FullyQualifiedName~GetCandidateApplication|FullyQualifiedName~BusinessSettings"`
- `dotnet test HRConnect/HRConnect.sln --configuration Release`
- `dotnet ef migrations script --project HRConnect/HRConnect.Infrastructure --startup-project HRConnect/HRConnect.Presentation`
- `node .gitnexus/run.cjs detect-changes --scope all --repo .`

Manual contract checks:
- Swagger 409 bodies include stable code/data and no Affiliate identity.
- Candidate list/detail/CV usage JSON contain none of: `BACKUP`, `SCREENING`, `currentStage`, `statusReason`.
- Transaction race test repeats enough times to prove deterministic lock behavior.

## 9. Risk and Impact Analysis

- **CRITICAL — SubmitCandidate orchestration:** 31 graph direct dependents plus storage, consent, email and audit side effects. Keep ownership precheck before upload; final authoritative check belongs at consent confirm.
- **CRITICAL — Respond consent:** creates Application, Attribution and MF03 work atomically. Moving transaction boundary must preserve idempotency and terminal-state persistence.
- **HIGH — Candidate API compatibility:** removing `status` breaks existing FE types/badges/filters. Coordinate release and update handoff; do not temporarily return both raw and public status because that defeats privacy.
- **HIGH — Cross-request race:** application unique key protects only same Candidate+Job, not same Candidate+Company. Process-local locks are invalid on multiple Render instances; use PostgreSQL transaction lock.
- **HIGH — Migration:** adding a Submission state requires check constraint migration + snapshot. Verify existing rows and Up/Down.
- **MEDIUM — Performance:** ownership query joins Application→Job. Validate query plan; add candidate/applied_at index only if needed, avoid loading entity graphs.
- **MEDIUM — Error privacy:** details must never expose Affiliate, historical Job, Application ID, Candidate PII or exact ownership evidence.
- **MEDIUM — Unknown statuses:** runtime must fail closed for privacy while test coverage forces developers to consciously map new persisted values.
- **BLOCKED DEPENDENCY — B4:** MF05 has no replacement-slot source of truth. Implementing before that contract risks free-fee and attribution errors.
- **Observability:** structured logs/audit should record candidateId, companyId, rule code, setting days and correlationId internally; API response remains generic.

Every graph-reported depth-1 dependent is accounted for through the three existing test suites named above. Because the graph is stale, source-discovered detail/CV-usage/ApplyJob consumers are also included.

## 10. Files Expected to Change

| File | Symbols | Reason |
| --- | --- | --- |
| `HRConnect/docs/MF02/mf02-viec-can-lam-theo-quy-tac-phi.md` | B2/B6 | Chốt 30 ngày và contract API |
| `.../Common/Settings/BusinessSettings.cs` | `BusinessSettingKeys` | Thêm setting MF02 |
| `.../Common/Exceptions/ConflictException.cs` | `ConflictException` | Stable error code + safe details |
| `.../Common/Interfaces/Repositories/IApplicationRepository.cs` | new ownership query | Client ownership |
| `.../Infrastructure/Repositories/ApplicationRepository.cs` | ownership query, Candidate includes | SQL query + Offers |
| `.../Features/Affiliates/.../SubmitCandidateCommandHandler.cs` | `Handle` | B1/B2 precheck/error contract |
| `.../Features/SubmissionConsents/.../RespondSubmissionConsentCommandHandler.cs` | `Handle` | Final check, lock, terminal state |
| `.../Features/Candidates/Commands/ApplyJob/ApplyJobCommandHandler.cs` | `Handle` | Same transaction lock |
| `.../Features/Candidates/Queries/...Application*.cs` | DTOs/handlers | Public display state |
| `.../Features/Candidates/Queries/GetCandidateAffiliateCvUsages/*` | DTO/handler | Close secondary leak |
| `.../Presentation/Endpoints/V1/Jobs/JobEndpoints.cs` | `Run`, Swagger | 409 contract |
| `.../Presentation/Endpoints/V1/Candidates/CandidateEndpoints.cs` | docs/query filter | Public status contract |
| `.../Infrastructure/Persistence/ApplicationDbContext.cs` | Submission constraint/index | New terminal state |
| `.../Infrastructure/Migrations/<timestamp>_AddMf02OwnershipGuard.*` | migration | Constraint/index |
| `.../Infrastructure/Migrations/ApplicationDbContextModelSnapshot.cs` | model snapshot | Migration consistency |
| Unit/integration tests listed in §8 | scenarios | Regression and race coverage |
| B4 files after MF05 prerequisite | replacement link/response/repository | Replacement contract |

New files expected: public-status mapper, transaction-lock interface/implementation, focused tests. Exact namespaces follow existing Application/Common and Infrastructure/Services patterns.

## 11. Reusable Implementation Context

~~~yaml
implementation_context:
  task_summary: "Align MF02 with fee rules: first valid Affiliate, 30-day Client ownership, Candidate-safe statuses, and MF05-gated replacement linking."
  acceptance_criteria:
    - "Second Affiliate for same Candidate+Job receives 409 CANDIDATE_ALREADY_SUBMITTED without prior Affiliate identity."
    - "HEADHUNT_COD/CV_SOURCING Candidate owned by same Client within inclusive 30-day window receives 409 CANDIDATE_OWNED_BY_CLIENT."
    - "Ownership is rechecked under transaction lock at consent confirmation; no losing request creates Application, Attribution or MF03 work."
    - "Candidate-facing list/detail/CV-usage never returns raw application status, current stage or status reason."
    - "B4 only activates against a persisted MF05 replacement slot."
  evidence_provenance: {"schema_version":2,"head_commit":"13520ec1614fcef0272c92954af11f5897de04c8","generated_plan_path":"docs/plans/2026-10-14-gitnexus-plan-mf02-fee-rules.md","global_dirty_digest":{"algorithm":"sha256","canonicalization":"gitnexus-evidence-provenance-v2 NUL-framed UTF-8 records","value":"0a9c85780067d9afcd0764f307b60891e3cee927ee11eaeb5ec7826d10fd82cd"},"cited_path_manifest":[{"path":"AGENTS.md","object_kind":{"head":"absent","index":"absent","worktree":"absent","untracked":"regular"},"state":"untracked","rename_from":null,"rename_to":null,"head_digest":"absent","index_digest":"absent","worktree_digest":"absent","untracked_digest":"sha256:8d6bf91756738c63b47d586b3872c7e81e6b21080c124252305981667be4c577"},{"path":"HRConnect/HRConnect.Application/Common/Exceptions/ConflictException.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:6313d502b803099904960d52aeaa738b7a83fb8b8f2a306439f8bb00255bdce3","index_digest":"sha256:6313d502b803099904960d52aeaa738b7a83fb8b8f2a306439f8bb00255bdce3","worktree_digest":"sha256:f36a7182a94c2744a7f2ecd14463d8d351c8a83bd74e0c553e443d870a708f57","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Application/Common/Interfaces/Repositories/IApplicationRepository.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:0cb806a26a42f1b9a7044584e47143e8759ded0738443d4cc915c61b2d369e20","index_digest":"sha256:0cb806a26a42f1b9a7044584e47143e8759ded0738443d4cc915c61b2d369e20","worktree_digest":"sha256:c4b8290c3a583a5d667b1e42ca46326faa5180985a7593594aefbee95333a4b9","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Application/Common/Interfaces/Repositories/ISubmissionRepository.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:cf377f1a80546754212806a4933251d30662e3438c12ddf85d3042734bcdf9fb","index_digest":"sha256:cf377f1a80546754212806a4933251d30662e3438c12ddf85d3042734bcdf9fb","worktree_digest":"sha256:336fdfb352892d9cd51523210112847e96297b864f64dbda949ade022ad068ea","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Application/Common/Settings/BusinessSettings.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:1f93d05afb9f4c9ae2b26b892f3b665eac805464d8a1f24142b5203c6da8d765","index_digest":"sha256:1f93d05afb9f4c9ae2b26b892f3b665eac805464d8a1f24142b5203c6da8d765","worktree_digest":"sha256:5f5e392e8ea74143191ef09906405f5b48c27413d52ae21dbeb378bffb5261ab","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommand.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:664aa05562317217301dba60a86e2a9a23fa96f727097fd41f6ed49ff843fa43","index_digest":"sha256:664aa05562317217301dba60a86e2a9a23fa96f727097fd41f6ed49ff843fa43","worktree_digest":"sha256:c7d8b171d7df6bb8945d6faac5c374996a81ad1a418a81316de19bddbc716960","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommandHandler.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:8aef58f01abe588b2c8b2e1cddded51f60324aa9abbd7122a1f5bb16fcba2740","index_digest":"sha256:8aef58f01abe588b2c8b2e1cddded51f60324aa9abbd7122a1f5bb16fcba2740","worktree_digest":"sha256:828471bcd8146a4603678bef1dbe070b87e0380fcc3ff5e2e7c886f8af5209a2","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Application/Features/Candidates/Commands/ApplyJob/ApplyJobCommandHandler.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:57031a68deb02beafa9f422bdc31ad607f056187101263575b51e0657afe8d95","index_digest":"sha256:57031a68deb02beafa9f422bdc31ad607f056187101263575b51e0657afe8d95","worktree_digest":"sha256:a8d90d12b7b8fd4c2f17f8e1862780421f1f3b1dfcc366ac4b6930ccd5df73f3","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Application/Features/Candidates/Queries/GetCandidateAffiliateCvUsages/GetCandidateAffiliateCvUsagesQuery.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:21e2934aff610ecf24d6cec9ea1be86e6a8bbd2ac46ffdf5b69eeabc9968e4ae","index_digest":"sha256:21e2934aff610ecf24d6cec9ea1be86e6a8bbd2ac46ffdf5b69eeabc9968e4ae","worktree_digest":"sha256:65733eb0e4a666b4e6e0f5359cdad580f75b8bdff849740641db52ee233eacb0","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Application/Features/Candidates/Queries/GetCandidateAffiliateCvUsages/GetCandidateAffiliateCvUsagesQueryHandler.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:47227870183b0175d4d8f26560343bab030c384cb27718811b2e044a821b3574","index_digest":"sha256:47227870183b0175d4d8f26560343bab030c384cb27718811b2e044a821b3574","worktree_digest":"sha256:7a03951d22dc7487bf4208cc41b24764078e77452cf0e90fbb6423be8774b8fd","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Application/Features/Candidates/Queries/GetCandidateApplicationDetail/CandidateApplicationDetailResponse.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:ca697f7e8af933ce3b897e6e16c5755963880ff3129281d559cc2f1ecfe136a1","index_digest":"sha256:ca697f7e8af933ce3b897e6e16c5755963880ff3129281d559cc2f1ecfe136a1","worktree_digest":"sha256:96240534242b858a3526c1a8b3c5901ecbcde1f4b1d7ffd72297ad741f9d99c0","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Application/Features/Candidates/Queries/GetCandidateApplicationDetail/GetCandidateApplicationDetailQueryHandler.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:1c3848c3e51524bcf5f5bd4c87bde58179cb8f6cd106e79aeb9ac16aabc291ec","index_digest":"sha256:1c3848c3e51524bcf5f5bd4c87bde58179cb8f6cd106e79aeb9ac16aabc291ec","worktree_digest":"sha256:67d10ea3ab8c16b2112bec923a95123e07659618d82faf430d905a0c38d02f4c","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Application/Features/Candidates/Queries/GetCandidateApplications/CandidateApplicationsResponse.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:ddc980e133336a6cd5658765c34b7c52bfd1541d43db1c2b7bc3b980dbca528e","index_digest":"sha256:ddc980e133336a6cd5658765c34b7c52bfd1541d43db1c2b7bc3b980dbca528e","worktree_digest":"sha256:00ae1572d22e160e65de51342f0e0be1cfb3c9270db662767955f8ac4312df14","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Application/Features/Candidates/Queries/GetCandidateApplications/GetCandidateApplicationsQueryHandler.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:695af1435473b800f407c42581bb9ee08689cdc606c8ff808f804f0212948e58","index_digest":"sha256:695af1435473b800f407c42581bb9ee08689cdc606c8ff808f804f0212948e58","worktree_digest":"sha256:01f37a80c1e6647ed5034e77a0bbb908fe123895746d4d2120df1c1d6e9cffbd","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Application/Features/SubmissionConsents/RespondSubmissionConsent/RespondSubmissionConsentCommandHandler.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:91f03f0b2f8a9af4a0fe0d23f4a382f2c770aae9ef3fef481d0fe438436c89e6","index_digest":"sha256:91f03f0b2f8a9af4a0fe0d23f4a382f2c770aae9ef3fef481d0fe438436c89e6","worktree_digest":"sha256:dbfc0f66cfaa4bf343f51a5b9bf3528e68d403a1a0e9040de96ecdb1e97bb0c2","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Infrastructure/Migrations/ApplicationDbContextModelSnapshot.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:dc3c8634a9f6a34507cd34406462f922cd9b4963cc829bfc8d240925c60f98c9","index_digest":"sha256:dc3c8634a9f6a34507cd34406462f922cd9b4963cc829bfc8d240925c60f98c9","worktree_digest":"sha256:d2bd78d0fc9a2dc2d67603cf167d574f9d023a9cd6458cc76f981e90a82477bb","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Infrastructure/Persistence/ApplicationDbContext.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:02883c20dda99a084f78b56fd3a46a4c58a44b0f4a977ba9c39aa56315ae8b5b","index_digest":"sha256:02883c20dda99a084f78b56fd3a46a4c58a44b0f4a977ba9c39aa56315ae8b5b","worktree_digest":"sha256:ad7b362814177359f083121f14767e3082cc4199329e7e710a06a2e27130b058","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Infrastructure/Repositories/ApplicationRepository.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:29f5facbd1fa05973634ac85048a162b823a1b1dd03546f5a2f7f8a19b6672f4","index_digest":"sha256:29f5facbd1fa05973634ac85048a162b823a1b1dd03546f5a2f7f8a19b6672f4","worktree_digest":"sha256:f0cf2c12611fa9fb65b91dc7cb890ae13bf282b8cc000dd0f22accc01fafb899","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Infrastructure/Repositories/SubmissionRepository.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:b0a55587b621c25708f17e6aa5b44ec1ff59afa5a84bff39a366754916a36306","index_digest":"sha256:b0a55587b621c25708f17e6aa5b44ec1ff59afa5a84bff39a366754916a36306","worktree_digest":"sha256:a7cf94ff1807e7e3a5ae6b1f74be632cd3ca6ae0bf4e0a2f7136ac4286ab3893","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Presentation/Endpoints/V1/Candidates/CandidateEndpoints.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:cc68e55de9eacef92aaf71e844baf5c93da2996551a1df04907ae672841183d7","index_digest":"sha256:cc68e55de9eacef92aaf71e844baf5c93da2996551a1df04907ae672841183d7","worktree_digest":"sha256:aead8f3fd64de6c085bdb1f6ea89f8f4fa778db37675314c72cf805e37722953","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.Presentation/Endpoints/V1/Jobs/JobEndpoints.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:35cad456c875f0cd2fe78673de3614b0a686d60853e6f96d75ac4228547661eb","index_digest":"sha256:35cad456c875f0cd2fe78673de3614b0a686d60853e6f96d75ac4228547661eb","worktree_digest":"sha256:fb1b931528d52c628120c839b259b6037a1c60ac661643326b2b95c4fc07bf73","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.UnitTests/Features/Affiliates/SubmitCandidateCommandHandlerTests.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:be25145194f5a70e637a1c9e79f7e0bc303219ff52c88d7f0b35da4494042c9f","index_digest":"sha256:be25145194f5a70e637a1c9e79f7e0bc303219ff52c88d7f0b35da4494042c9f","worktree_digest":"sha256:e276eb1c7bad1b66d9d3762da8ebfd953ca22c81a797b26190c0e2290337d86d","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.UnitTests/Features/Candidates/GetCandidateApplicationDetailQueryHandlerTests.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:c87b7997486a9a7d737e18b6ef674cafb866376c267b20c4188efec31ec128ce","index_digest":"sha256:c87b7997486a9a7d737e18b6ef674cafb866376c267b20c4188efec31ec128ce","worktree_digest":"sha256:3d43889f9f7cb0b8a9e627ea9ec561e4cbb7ba13d15de0f8bda59b69cf4a88d6","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.UnitTests/Features/Candidates/GetCandidateApplicationsQueryHandlerTests.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:a02991959860fbf999219fa7a9400646f5d4445e4809a6ddd1b8dab8530d8597","index_digest":"sha256:a02991959860fbf999219fa7a9400646f5d4445e4809a6ddd1b8dab8530d8597","worktree_digest":"sha256:5a479dffb440d155d19c5d9a751465c5a840b892043ed71d92fdc2ef5ea37cbf","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.UnitTests/Features/Finance/BusinessSettingsTests.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:bbfe68c03da735261e2f398dc46323f4075061a6d8b3b2bb8ac5fbbfde95ecd7","index_digest":"sha256:bbfe68c03da735261e2f398dc46323f4075061a6d8b3b2bb8ac5fbbfde95ecd7","worktree_digest":"sha256:a6d24196f4bbba9f118f8f4ebd9349281c7cbefe206aeffd83f10cce82fb044b","untracked_digest":"absent"},{"path":"HRConnect/HRConnect.UnitTests/Features/SubmissionConsents/RespondSubmissionConsentCommandHandlerTests.cs","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:40b561fb1d8d7dfd7a3d9b87569012c97206d4b4bcfbb5da028cb1b0996935b4","index_digest":"sha256:40b561fb1d8d7dfd7a3d9b87569012c97206d4b4bcfbb5da028cb1b0996935b4","worktree_digest":"sha256:a9485a45eb3d49a498171e775d293c86eb442255d3970b185542dba7cf87a89d","untracked_digest":"absent"},{"path":"HRConnect/docs/MF02/mf02-viec-can-lam-theo-quy-tac-phi.md","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:2563b7e38e23ec007b7c37ff58446a3ac145d13768f6b48945edd502fb955e4a","index_digest":"sha256:2563b7e38e23ec007b7c37ff58446a3ac145d13768f6b48945edd502fb955e4a","worktree_digest":"sha256:6d848d365ef677260c137ebbc1b996527dbab2bf268d36d76648ff33d2a7b2bc","untracked_digest":"absent"},{"path":"HRConnect/docs/QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md","object_kind":{"head":"regular","index":"regular","worktree":"regular","untracked":"absent"},"state":"clean","rename_from":null,"rename_to":null,"head_digest":"sha256:dc386111a5890766f0bb853143be76decafd09dd4aa0e458e9a03d6b3626ab2e","index_digest":"sha256:dc386111a5890766f0bb853143be76decafd09dd4aa0e458e9a03d6b3626ab2e","worktree_digest":"sha256:4d69b2583c4b9d87da60860fc8a8f45253e074621b532a6806b5274110cde02b","untracked_digest":"absent"}]}
  primary_symbols:
    - symbol: "SubmitCandidateCommandHandler.Handle"
      file: "HRConnect/HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommandHandler.cs"
      lines: "85-621"
      role: "Affiliate intake, identity, duplicate precheck, consent staging"
    - symbol: "RespondSubmissionConsentCommandHandler.Handle"
      file: "HRConnect/HRConnect.Application/Features/SubmissionConsents/RespondSubmissionConsent/RespondSubmissionConsentCommandHandler.cs"
      lines: "53-266"
      role: "Authoritative confirm, Application/Attribution/MF03 transaction"
    - symbol: "ApplyJobCommandHandler.Handle"
      file: "HRConnect/HRConnect.Application/Features/Candidates/Commands/ApplyJob/ApplyJobCommandHandler.cs"
      lines: "44+"
      role: "Direct Candidate Application creation competing with Affiliate confirm"
    - symbol: "GetCandidateApplicationsQueryHandler.Handle"
      file: "HRConnect/HRConnect.Application/Features/Candidates/Queries/GetCandidateApplications/GetCandidateApplicationsQueryHandler.cs"
      lines: "28-94"
      role: "Candidate list projection"
  related_symbols:
    - symbol: "ApplicationRepository.GetCandidateApplicationsFilteredAsync"
      relationship: "called by Candidate list; must include Offers and support public filter"
      relevance: "prevents draft-offer leakage"
    - symbol: "JobEndpoints.Run"
      relationship: "exception-to-HTTP boundary"
      relevance: "must preserve business error code and safe details"
    - symbol: "BusinessSettingKeys.All"
      relationship: "established configurable-number pattern"
      relevance: "30 days is Admin configurable"
  execution_path:
    - "Affiliate submit resolves Candidate and performs same-job + ownership prechecks before upload."
    - "Submission/consent/outbox persist; no Application yet."
    - "Candidate confirms; transaction starts and Candidate+Company advisory lock is acquired."
    - "Same-job and 30-day ownership are rechecked."
    - "Winner creates Application, Attribution and MF03 outbox atomically; loser closes safely."
  pdg_constraints: []
  architectural_patterns:
    - pattern: "Runtime business settings"
      example_location: "HRConnect/HRConnect.Application/Common/Settings/BusinessSettings.cs"
      usage_guidance: "Add mf02.client_ownership_days; never hardcode 30 in handlers."
    - pattern: "EF repository behind Application interface"
      example_location: "HRConnect/HRConnect.Infrastructure/Repositories/ApplicationRepository.cs"
      usage_guidance: "Keep PostgreSQL query/lock implementation out of handlers."
    - pattern: "Transactional consent confirmation"
      example_location: "HRConnect/HRConnect.Application/Features/SubmissionConsents/RespondSubmissionConsent/RespondSubmissionConsentCommandHandler.cs"
      usage_guidance: "Final guard and all side effects share one transaction."
  files_to_modify:
    - file: "HRConnect/HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommandHandler.cs"
      symbols: ["Handle"]
      intended_change: "Stable B1/B2 prechecks and safe conflicts."
    - file: "HRConnect/HRConnect.Application/Features/SubmissionConsents/RespondSubmissionConsent/RespondSubmissionConsentCommandHandler.cs"
      symbols: ["Handle"]
      intended_change: "Locked final ownership check and controlled terminal outcome."
    - file: "HRConnect/HRConnect.Application/Features/Candidates/Queries/GetCandidateApplications/GetCandidateApplicationsQueryHandler.cs"
      symbols: ["Handle"]
      intended_change: "Use shared public display mapper."
    - file: "HRConnect/HRConnect.Infrastructure/Repositories/ApplicationRepository.cs"
      symbols: ["GetCandidateApplicationsFilteredAsync", "new ownership query"]
      intended_change: "Efficient ownership lookup and Offer loading."
  tests:
    - file: "HRConnect/HRConnect.UnitTests/Features/Affiliates/SubmitCandidateCommandHandlerTests.cs"
      scenarios: ["B1 safe 409", "29/30/31-day ownership boundary", "service/company exclusions", "race mapping"]
    - file: "HRConnect/HRConnect.UnitTests/Features/SubmissionConsents/RespondSubmissionConsentCommandHandlerTests.cs"
      scenarios: ["ownership appears while consent pending", "same-company concurrent confirms", "no losing side effects"]
    - file: "HRConnect/HRConnect.UnitTests/Features/Candidates/GetCandidateApplicationsQueryHandlerTests.cs"
      scenarios: ["all constraint statuses mapped", "offer draft hidden", "unknown fails closed"]
    - file: "HRConnect/HRConnect.UnitTests/Features/Candidates/GetCandidateApplicationDetailQueryHandlerTests.cs"
      scenarios: ["detail response has no internal fields"]
  verification_commands:
    - "dotnet build HRConnect/HRConnect.sln --configuration Release"
    - "dotnet test HRConnect/HRConnect.UnitTests/HRConnect.UnitTests.csproj --configuration Release --filter \"FullyQualifiedName~SubmitCandidate|FullyQualifiedName~RespondSubmissionConsent|FullyQualifiedName~GetCandidateApplication|FullyQualifiedName~BusinessSettings\""
    - "dotnet test HRConnect/HRConnect.sln --configuration Release"
    - "dotnet ef migrations script --project HRConnect/HRConnect.Infrastructure --startup-project HRConnect/HRConnect.Presentation"
    - "node .gitnexus/run.cjs detect-changes --scope all --repo ."
  risks:
    - "CRITICAL orchestration symbols; preserve transaction/idempotency/compensation."
    - "Breaking Candidate response contract requires coordinated FE deployment."
    - "MF05 replacement dependency is not present at pinned commit."
  assumptions:
    - "Recheck main and rerun graph before work; current GitNexus index is 86 commits stale."
    - "Verify PostgreSQL advisory-lock capability on the production provider and use the active transaction connection."
    - "Verify MF05 replacement-slot contract exists before starting B4."
  open_questions:
    - "Exact MF05 replacement-slot entity/interface name remains intentionally open until MF05 merges its contract."
  avoid:
    - "Do not infer replacement from latest LEFT_DURING_WARRANTY Placement."
    - "Do not expose Affiliate identity, historical Job/Application IDs or raw internal statuses."
    - "Do not use an in-memory/process-local lock."
    - "Do not create Application/Attribution/MF03 before consent confirmation."
    - "Do not repeat full repository discovery; reverify only drifted cited paths."
~~~

## 12. Assumptions and Open Questions

### Confirmed

- [verified] B2 uses **30 days**, inclusive at the cutoff, and must be configurable as days.
- [verified] B1 database uniqueness already protects same Candidate+Job accepted/pending states.
- [verified] Candidate status leakage exists in three surfaces, not only list.
- [verified] No safe MF05 replacement-slot source of truth exists at the pinned commit.

### Assumptions to reverify before implementation

- [assumed] PostgreSQL advisory transaction locks are allowed by the deployed Supabase/PostgreSQL connection role. Verify with an integration test; if unavailable, use SERIALIZABLE transaction + bounded retry, not an in-memory lock.
- [assumed] FE can ship the display contract in the same release. Confirm before removing raw fields.
- [assumed] “Client đã có” means every Application status in the 30-day window. This follows the canonical wording “đã ứng tuyển trực tiếp hoặc đã được giao”; do not silently exclude rejected/withdrawn records.

### Open dependency

- [assumed] MF05 must define the replacement slot lifecycle and fee linkage. Until then, implement B1–B3 and leave B4 behind an explicit gate; do not ship a heuristic.

### Explicitly deferred

- SF-04 dispute redesign, SMS/Zalo delivery, Internal HR submission UX, CV_SOURCING client review and fee settlement remain outside this MF02 plan.

## 13. Definition of Done

- MF02 doc and Admin settings show `mf02.client_ownership_days = 30`.
- B1 returns deterministic `409 CANDIDATE_ALREADY_SUBMITTED`; pending details are safe and no prior Affiliate identity is exposed.
- B2 blocks same-Client Applications at 29 and exactly 30 days, allows older than 30 days/different Company/CV_APPLICATION, and rechecks under a cross-instance transaction lock at consent confirmation.
- A blocked confirmation reaches a persisted terminal state with audit + Affiliate notification and creates no Application, Attribution or MF03 request.
- Direct Candidate apply uses the same Candidate+Company lock so concurrent direct apply cannot bypass B2.
- Candidate list, detail and Affiliate-CV usage responses contain only public display status fields and never raw status/currentStage/statusReason.
- All 15 application constraint statuses have explicit mapping coverage; OFFER is visible only after SENT.
- Migration, snapshot, Up/Down SQL and clean-database/current-database migration checks pass.
- B4 is complete only when an MF05 persisted slot exists, response fields are automatic, races are handled and MF05 proves no new fee.
- Focused tests, full solution tests and Release build pass.
- Final `detect-changes --scope all` is complete and no HIGH/CRITICAL finding is left unexplained.

