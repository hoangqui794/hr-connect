# GitNexus Engineering Plan

> Task: Hoàn thiện các phần Candidate thuộc MF02 còn thiếu sau khi tách Dashboard sang MF03, Profile sang MF04 và Notification dùng chung sang MF01.
> Evidence verified at commit `3528d05c5008705940c5acfa29a2eae73ad9cd91`; GitNexus index refreshed this session with `node .gitnexus/run.cjs analyze --index-only --pdg`, but MCP still reported one commit behind, so all load-bearing conclusions were rechecked against current source.
> Evidence provenance schema 2; global dirty digest `14cb02cfb451419d6b6c555cb60b5ff70504ef65c3054483a849f4709c16ad40`; cited-path manifest contains 35 sorted entries; exact generated plan path excluded.

## 1. Objective

Hoàn thiện trải nghiệm Candidate trong phạm vi MF02 bằng bốn thay đổi có thể triển khai độc lập:

1. Candidate có một danh sách rõ ràng các yêu cầu Affiliate đang chờ xác nhận và có thể mở đúng trang consent.
2. Kho CV cá nhân cho biết CV đã được dùng ở đâu và thao tác xóa sẽ xóa vật lý hay chỉ ẩn để bảo toàn lịch sử.
3. Candidate có thể thu hồi email phụ đã xác minh bằng optimistic concurrency, không ảnh hưởng email đăng nhập chính hoặc dữ liệu tuyển dụng cũ.
4. Danh sách đơn ứng tuyển có tìm kiếm theo Job/doanh nghiệp và lọc theo nguồn `CANDIDATE` hoặc `AFFILIATE`.

Phạm vi này không triển khai Candidate Dashboard, Candidate Profile, notification dùng chung, phỏng vấn/offer hoặc timeline tuyển dụng.

## 2. Current Behaviour

- [verified] `GET /api/v1/candidates/me/submission-consents/{submissionId}` và `POST .../{submissionId}/respond` đã hỗ trợ Candidate đăng nhập xem và phản hồi một consent cụ thể, nhưng chưa có endpoint liệt kê các consent đang chờ. Candidate phải đi từ notification hoặc biết `submissionId` (`HRConnect/HRConnect.Presentation/Endpoints/V1/SubmissionConsents/SubmissionConsentEndpoints.cs:75-139`).
- [verified] Danh sách CV do Affiliate tải lên đã trả `PendingConsentCount`, còn API usages đã có `SubmissionId`, Job, Company, Affiliate và trạng thái consent. Tuy nhiên UI chỉ hiện số lượng, không có một hàng đợi hành động độc lập; một CV có thể liên quan nhiều Submission nên một `pendingConsentSubmissionId` đơn lẻ không đủ (`HRConnect/HRConnect.Infrastructure/Repositories/SubmissionRepository.cs:314-431`).
- [verified] `GET /api/v1/candidates/cv` chỉ trả metadata file. `DeleteCandidateCvCommandHandler` đã phân nhánh đúng: CV có Submission được đổi sang `DELETED`, CV chưa dùng được xóa khỏi DB/storage; response danh sách chưa cho FE biết trước nhánh nào sẽ xảy ra (`HRConnect/HRConnect.Application/Features/Candidates/Commands/DeleteCandidateCv/DeleteCandidateCvCommandHandler.cs:36-117`).
- [verified] `GET /api/v1/candidates/me/email-identities` đã trả `CanRevoke`, `CanMakePrimary` và `ConcurrencyToken`. Entity đã có trạng thái `REVOKED`, `RevokedAt` và unique indexes chỉ áp dụng cho email chưa revoke, nhưng chưa có command/endpoint thu hồi alias (`HRConnect/HRConnect.Domain/Entities/UserEmailIdentity.cs:7-33`; `HRConnect/HRConnect.Application/Features/Candidates/Identity/GetCandidateEmailIdentities/GetCandidateEmailIdentitiesQuery.cs:16-28`).
- [verified] `GET /api/v1/candidates/applications` hiện lọc theo `status`, `jobId`, khoảng ngày và phân trang. DTO danh sách chưa trả `submissionSource`; FE chỉ hiển thị nguồn trong trang chi tiết (`HRConnect/HRConnect.Application/Features/Candidates/Queries/GetCandidateApplications/GetCandidateApplicationsQuery.cs:5-13`; `HRConnect-FE/src/features/portal/CandidatePages.tsx:211-314`).
- [verified] Các API đều phân giải `Candidate` từ `UserId`; ownership được kiểm tra ở backend, không dựa vào ID Candidate do FE gửi.

## 3. Relevant Architecture

- Presentation dùng Minimal API, permission claim và MediatR. Các route mới phải nằm trong nhóm Candidate hiện có và giữ response envelope hiện hành.
- Application layer chứa query/command, validation, ownership/business guards và audit request.
- Infrastructure repository thực hiện LINQ/EF Core. Các bộ lọc, count và pagination phải chạy tại database; không tải toàn bộ rồi lọc trong memory.
- `Submission` giữ nguồn nộp (`Source`), Job, Candidate, CV và trạng thái intake. `SubmissionConsent` là quan hệ 1-1 với Submission, có `Status`, hạn xác nhận và concurrency token.
- `UserEmailIdentity` là danh tính cấp tài khoản. Chỉ `PRIMARY` dùng đăng nhập/khôi phục mật khẩu; `ALIAS` dùng nhận diện và claim dữ liệu Candidate cũ.
- FE dùng React Query, URL search params, API modules trong `src/services/api/mf02`, type tập trung trong `src/types/api/mf02.ts`, và Candidate shell hiện có.
- Audit đã là pattern bắt buộc cho mutation MF02; thu hồi alias phải ghi audit trong cùng transaction với thay đổi identity.

## 4. GitNexus Findings

- [graph] `query(search_query="candidate submission consent pending affiliate CV list confirmation request")` tìm thấy `GetSubmissionConsentQueryHandler`, `RespondSubmissionConsentCommandHandler`, endpoint consent và các tests; không tìm thấy luồng danh sách consent của Candidate. Điều này khớp với source verification.
- [graph] `query(search_query="candidate email identity alias claim verify primary revoke concurrency token")` tìm thấy query danh sách identity, luồng verify/merge và schema tests; không có revoke command.
- [graph] `context(DeleteCandidateCvCommandHandler)` cho thấy test constructor là direct caller duy nhất được graph nhận diện; source cho thấy Minimal API gọi qua MediatR nên graph caller count không bao quát runtime dispatch.
- [graph] `impact(GetCandidateApplicationsQueryHandler, upstream, depth=3)` trả `LOW`, direct dependent là `GetCandidateApplicationsQueryHandlerTests`. Thay đổi vẫn phải cập nhật endpoint, repository interface và FE vì MediatR/minimal-route/runtime consumers không được graph liên kết đầy đủ.
- [graph] `impact(GetCandidateEmailIdentitiesQueryHandler, upstream, depth=3)` trả `LOW`, có hai test methods trực tiếp. Command revoke mới có thể tái sử dụng repository/entity hiện tại mà không đổi response list cũ.
- [graph] `impact(GetCandidateCvsQueryHandler, upstream, depth=3)` trả `LOW`, direct dependent là test fixture. Mở rộng DTO là additive nhưng FE types/tests phải cập nhật.
- [graph] `impact(GetCandidateAffiliateCvsQueryHandler, upstream, depth=3)` trả `UNKNOWN` vì không resolve caller. Source search xác nhận endpoint và FE consumer đang dùng; không được coi là unused.
- [verified] GitNexus `api_impact` không nhận diện các Minimal API route này, nên compatibility được xác minh trực tiếp từ endpoint declarations và FE API modules.

## 5. Statement-Level PDG Findings

### Xóa CV cá nhân

- [graph] `pdg_query(mode="controls", target=".../DeleteCandidateCvCommandHandler.cs")` xác nhận các guard theo thứ tự: Candidate tồn tại → CV active → ownership → không phải `AFFILIATE_UPLOAD` → kiểm tra `IsCvInUseAsync`.
- [verified] Khi `isInUse=true`, handler đổi `Status=DELETED`, bỏ primary, ghi `CV_DELETED`, rồi save; khi false, storage service chịu trách nhiệm xóa vật lý. Vì vậy metadata list phải lấy cùng tiêu chí `Submission.Any(CvId)` để tránh FE báo một hành vi nhưng command chạy hành vi khác.
- [inferred] Count và `deleteBehavior` nên được tạo cùng truy vấn danh sách, tránh N+1 query cho từng CV.

### Thu hồi email phụ

- [graph] PDG của `VerifyCandidateIdentityClaimCommandHandler` xác nhận codebase đã dùng conditional update/concurrency token và trả `409` khi dữ liệu đổi ở thiết bị khác.
- [verified] `UserEmailIdentity.ConcurrencyToken` đã được EF đánh dấu concurrency token; active unique email index bỏ qua `REVOKED`. Command revoke phải kiểm tra expected token trước mutation, xoay token sau mutation và map `DbUpdateConcurrencyException` sang lỗi nghiệp vụ ổn định.
- [inferred] Thu hồi alias không cần migration vì schema đã hỗ trợ đầy đủ `REVOKED`, `RevokedAt` và partial unique index.

### Danh sách consent và applications

- [verified] Consent có hai trạng thái liên quan: `Submission.Status=PENDING_CONSENT` và `SubmissionConsent.Status=PENDING`. Item hành động chỉ hợp lệ khi cả hai đúng và `ExpiresAt > now`.
- [verified] Worker/service hiện chuyển consent hết hạn sang `EXPIRED`, Submission sang `CONSENT_EXPIRED` và archive CV khi phù hợp. GET list không được mutation; nó chỉ loại consent quá hạn khỏi hàng đợi hành động và có thể trả trạng thái lịch sử nếu filter được yêu cầu.
- [verified] Application list query hiện `CountAsync` trước rồi include/paginate, nên search/source phải được áp dụng trước count để total chính xác.
- [inferred] Stable ordering cần `OrderByDescending(AppliedAt).ThenByDescending(ApplicationId)` để tránh lặp/mất item khi nhiều record cùng timestamp.

## 6. Proposed Changes

### 6.1 Candidate consent inbox

**API:** `GET /api/v1/candidates/me/submission-consents`

Query parameters:

- `status`: mặc định `PENDING`; whitelist `PENDING`, `CONFIRMED`, `DECLINED`, `EXPIRED`, `CANCELLED`.
- `page`: mặc định 1.
- `pageSize`: mặc định 20, tối đa 100.

Response item:

- `submissionId`, `consentStatus`, `submissionStatus`;
- `jobId`, `jobTitle`, `companyId`, `companyName`;
- `cvId`, `cvTitle`, `cvFileName`;
- `affiliateUserId`, `affiliateDisplayName`;
- `requestedAt`, `expiresAt`, `respondedAt`;
- `isActionable` và `remainingSeconds` tính tại server response time.

Business rules:

- [verified] Candidate lấy từ user đăng nhập; chỉ trả Submission thuộc Candidate đó.
- Với filter `PENDING`, chỉ item có consent/submission đồng bộ và chưa hết hạn mới `isActionable=true`.
- Không gọi expiry mutation trong GET. Worker hiện hữu tiếp tục là nguồn chuyển trạng thái chính thức.
- Bảo vệ bằng authentication, rate-limit `submission-consent`, permission `application.view_own`, ownership query tại DB.
- Sắp xếp pending gần hết hạn trước (`ExpiresAt ASC`, `SubmissionId ASC`); lịch sử sắp xếp `RequestedAt DESC`, `SubmissionId DESC`.
- Không trả token hash, recipient email, response IP hoặc user-agent.

Files/symbols:

- Thêm `GetCandidateSubmissionConsentsQuery`, response DTO và handler trong `HRConnect.Application/Features/Candidates/Queries`.
- Mở rộng `ISubmissionRepository`/`SubmissionRepository` bằng projection paginated; không trả entity graph đầy đủ.
- Thêm route list vào candidate group trong `SubmissionConsentEndpoints.cs`.
- FE thêm `candidateConsentApi.list`, types, trang/panel “Yêu cầu chờ xác nhận”, link đến route detail hiện có.
- Sau CONFIRM/DECLINE, invalidate cả list consent, affiliate CV list/usages và applications.

### 6.2 Metadata mức sử dụng và hành vi xóa CV cá nhân

Mở rộng `CandidateCvItemResponse` bằng:

- `submissionUsageCount`;
- `applicationUsageCount`;
- `isReferenced`;
- `deleteBehavior`: `HARD_DELETE` hoặc `ARCHIVE_HISTORY`.

Business rules:

- `isReferenced = submissionUsageCount > 0`, dùng đúng điều kiện mà delete handler hiện dùng.
- `applicationUsageCount` chỉ để giải thích mức sử dụng; quyết định xóa vẫn dựa trên mọi Submission để bảo toàn cả intake chưa tạo Application.
- Repository trả projection/count trong một query, tránh N+1.
- Không đổi endpoint delete và không đổi dữ liệu lịch sử.
- FE hiển thị số lần dùng và confirmation khác nhau: xóa vĩnh viễn khi chưa dùng; gỡ khỏi kho nhưng giữ lịch sử khi đã dùng.

### 6.3 Thu hồi email phụ

**API:** `POST /api/v1/candidates/me/email-identities/{emailIdentityId}/revoke`

Request:

```json
{ "concurrencyToken": "uuid" }
```

Response trả identity sau mutation: `emailIdentityId`, `status=REVOKED`, `revokedAt`, `concurrencyToken` mới.

Business rules:

- Chỉ user sở hữu identity và Candidate active, chưa merge mới được thao tác.
- Chỉ `Kind=ALIAS` và `Status=VERIFIED` được revoke.
- `PRIMARY` luôn trả `409 PRIMARY_EMAIL_CANNOT_BE_REVOKED`.
- Identity khác owner trả `404` để không lộ tồn tại.
- Token cũ trả `409 STALE_EMAIL_IDENTITY`.
- Request lặp với identity đã `REVOKED`: trả `409 EMAIL_IDENTITY_ALREADY_REVOKED`; FE reload list. Không giả vờ mutation thành công.
- Set `Status=REVOKED`, `RevokedAt/UpdatedAt=UtcNow`, xoay `ConcurrencyToken`.
- Không xóa Candidate, CV, Submission, Application, Attribution hoặc lịch sử claim.
- Ghi audit `CANDIDATE_EMAIL_IDENTITY_REVOKED`, Entity `USER_EMAIL_IDENTITY`, actor user, old/new status, masked email và email hash; không ghi email nguyên văn vào audit.
- Mutation + audit + save trong một transaction. Map concurrency/database conflict thành `409`, không để 500.
- Không cần migration; chỉ thêm audit action constant.

### 6.4 Search và source filter cho Candidate applications

Mở rộng `GET /api/v1/candidates/applications`:

- `search`: trim, tối đa 100 ký tự; tìm `Job.Title` hoặc `Company.CompanyName` bằng `ILIKE`.
- `submissionSource`: nullable; whitelist `CANDIDATE`, `AFFILIATE`.

Mở rộng item response bằng `submissionSource`.

Business rules:

- Filter source qua `Application.Submission.Source`; record legacy không có Submission chỉ xuất hiện khi không filter và response source là `null`.
- Invalid source trả validation 400, không âm thầm cho danh sách rỗng.
- Search/source áp dụng trước count và pagination.
- Stable ordering thêm `ApplicationId` làm tie-breaker.
- FE đồng bộ filter vào URL; ô search chỉ gửi khi submit hoặc debounce 300–500 ms, reset page về 1 khi đổi filter.
- Không thêm timeline, interview, offer hoặc profile data vào list MF02.

### 6.5 Cleanup giới hạn theo ownership MF02

- Chỉ xóa code MF02 cũ sau khi `rg`, router và GitNexus impact đều chứng minh không còn consumer.
- Không xóa Candidate Dashboard cũ trước khi MF03 thay thế hoàn chỉnh.
- Không xóa Candidate Profile/store cũ trước khi MF04 thay thế hoàn chỉnh.
- Không thay notification UI/service vì thuộc MF01.

## 7. Implementation Sequence

1. **Consent inbox BE:** thêm repository projection, query/handler, endpoint, validation, Swagger và tests. Hoàn thành một API độc lập trước.
2. **Consent inbox FE:** thêm type/service/query/page, action mở detail hiện có, invalidation sau respond và component tests.
3. **CV usage metadata BE:** mở rộng projection/DTO và tests; xác nhận `deleteBehavior` khớp delete handler.
4. **CV usage metadata FE:** cập nhật CV cards và confirmation copy; test cả hard-delete và archive-history.
5. **Alias revoke BE:** thêm repository lookup/update có ownership + concurrency, command/validator/handler, audit constant, endpoint và tests transaction/error mapping.
6. **Alias revoke FE:** thêm API method, nút chỉ hiện khi `canRevoke`, modal xác nhận, disable khi pending, xử lý 409 bằng reload.
7. **Applications filter BE:** mở rộng query/repository/DTO/endpoint, validate source/search, stable pagination và tests.
8. **Applications filter FE:** thêm search/source vào URL state, service types và page tests.
9. Chạy full MF02 regression, build FE/BE, kiểm tra Swagger contract và Playwright smoke Candidate desktop.
10. Chỉ sau khi tất cả module owner đã merge, chạy impact riêng cho cleanup legacy; không gộp cleanup chưa chứng minh vào các commit chức năng.

Mỗi bước có thể commit riêng theo API/chức năng khi triển khai. Plan này không yêu cầu merge `dev/main` cho tới khi test thủ công được duyệt.

## 8. Test Strategy

### Backend unit/integration tests

- **Consent list:** owner chỉ thấy consent của mình; pending chưa hết hạn actionable; expired không actionable; filter whitelist; pagination/ordering; không lộ token/email/IP; Candidate inactive/merged bị chặn; permission thiếu trả 403.
- **CV metadata:** 0 submission → `HARD_DELETE`; có submission nhưng chưa Application → `ARCHIVE_HISTORY`; có Application → counts đúng; affiliate-upload không lọt kho cá nhân; query không N+1.
- **Alias revoke:** alias verified thành revoked; primary bị chặn; identity khác owner trả 404; stale token 409; request lặp 409; Candidate inactive/merged bị chặn; audit được lưu cùng mutation; simulated concurrency không thành 500; unique email có thể được claim lại sau revoke theo rule hiện có.
- **Application list:** search Job; search Company; source Candidate/Affiliate; invalid source 400; kết hợp status/date/source/search; record legacy null source; count và pagination đúng; stable tie-break.
- Cập nhật tests hiện có: `GetCandidateApplicationsQueryHandlerTests`, `GetCandidateCvsQueryHandlerTests`, `DeleteCandidateCvCommandHandlerTests`, `GetCandidateEmailIdentitiesQueryHandlerTests`, `GetCandidateAffiliateCvsQueryHandlerTests`.
- Thêm tests mới cho query consent list và revoke handler/endpoint contract.

### Frontend tests

- Consent inbox render nhiều pending items, countdown/expired state, navigate đúng submission, invalidate sau respond.
- CV card hiển thị usage và modal copy đúng với `deleteBehavior`.
- Identity page chỉ hiện Thu hồi cho alias có `canRevoke`; stale token hiển thị message và reload.
- Applications page giữ filter trong URL, reset page khi thay filter và gửi đúng params.
- API client tests xác nhận path/method/body cho list consent và revoke.

### Verification commands

```powershell
dotnet test HRConnect/HRConnect.UnitTests/HRConnect.UnitTests.csproj
dotnet build HRConnect/HRConnect.sln
cd HRConnect-FE
npm run test:run
npm run lint
npm run build
npm run test:e2e -- --project=candidate-desktop
```

Nếu Playwright config không có project `candidate-desktop` tại lúc thực thi, chạy smoke spec Candidate bằng project Chromium desktop hiện hữu và ghi rõ lệnh thật trong commit validation.

## 9. Risk and Impact Analysis

- **Consent expiry race:** item có thể hết hạn giữa lúc list và respond. Respond handler hiện hữu phải tiếp tục là authority; FE xử lý 409/400 và refresh list.
- **Alias revoke concurrency:** EF concurrency token phải được đối chiếu trong conditional update/transaction. Không dùng read-then-save đơn thuần nếu nó có thể ghi đè request song song.
- **Identity uniqueness:** revoke làm partial unique index giải phóng email. Đây là hành vi mong muốn nhưng cần test claim lại và không làm thay đổi email login chính.
- **CV counts/performance:** correlated counts có thể tốn chi phí; dùng một projection và xem SQL/query plan trên dữ liệu thực tế trước khi thêm index. Không tạo migration index nếu chưa có bằng chứng.
- **Application search:** `ILIKE %term%` trong phạm vi một Candidate thường nhỏ; theo dõi query trước khi thêm trigram index toàn hệ thống.
- **Compatibility:** mọi response field thêm là additive. Params mới nullable; client cũ tiếp tục hoạt động.
- **Graph blind spots:** Minimal API/MediatR runtime dispatch không được GitNexus nối đầy đủ; source consumers và tests là nguồn chính cho route impact.
- **Direct dependents:** tất cả direct dependents GitNexus báo đều là tests đã được đưa vào §8. `GetCandidateAffiliateCvsQueryHandler` có risk UNKNOWN và đã được xác minh bằng endpoint/FE text search.
- **Boundary risk:** không đưa Candidate Dashboard/Profile/Notification vào commit MF02; tránh xung đột với dev MF03/MF04/MF01.

## 10. Files Expected to Change

| File | Symbols | Reason |
| ---- | ------- | ------ |
| `HRConnect/HRConnect.Presentation/Endpoints/V1/SubmissionConsents/SubmissionConsentEndpoints.cs` | candidate consent group | Thêm list endpoint, permission, Swagger contract |
| `HRConnect/HRConnect.Presentation/Endpoints/V1/Candidates/CandidateEndpoints.cs` | identity/applications/CV mappings | Thêm revoke endpoint và params mới; cập nhật Swagger |
| `HRConnect/HRConnect.Application/Features/Candidates/Queries/GetCandidateSubmissionConsents/*` | new query/DTO/handler | Hàng đợi consent của Candidate |
| `HRConnect/HRConnect.Application/Common/Interfaces/Repositories/ISubmissionRepository.cs` | new list projection contract | Query consent owner-scoped, paginated |
| `HRConnect/HRConnect.Infrastructure/Repositories/SubmissionRepository.cs` | list projection | Lọc consent, join Job/Company/CV/Affiliate tại DB |
| `HRConnect/HRConnect.Application/Features/Candidates/Queries/GetCandidateCvs/*` | response/handler | Usage metadata và delete behavior |
| `HRConnect/HRConnect.Application/Common/Interfaces/Repositories/ICandidateCvRepository.cs` | list projection contract | Counts không N+1 |
| `HRConnect/HRConnect.Infrastructure/Repositories/CandidateCvRepository.cs` | CV list projection | Tính submission/application usage |
| `HRConnect/HRConnect.Application/Features/Candidates/Identity/RevokeCandidateEmailIdentity/*` | new command/validator/handler | Thu hồi alias an toàn, transaction, audit |
| `HRConnect/HRConnect.Application/Common/Interfaces/Repositories/IUserEmailIdentityRepository.cs` | owner lookup/conditional revoke | Ownership và concurrency |
| `HRConnect/HRConnect.Infrastructure/Repositories/UserEmailIdentityRepository.cs` | repository implementation | Conditional update / identity load |
| `HRConnect/HRConnect.Application/Common/Models/AuditActions.cs` | audit constant | `CANDIDATE_EMAIL_IDENTITY_REVOKED` |
| `HRConnect/HRConnect.Application/Features/Candidates/Queries/GetCandidateApplications/*` | query/handler/DTO | Search/source và response source |
| `HRConnect/HRConnect.Application/Common/Interfaces/Repositories/IApplicationRepository.cs` | signature | Truyền search/source |
| `HRConnect/HRConnect.Infrastructure/Repositories/ApplicationRepository.cs` | `GetCandidateApplicationsAsync` | Database filters và stable order |
| `HRConnect-FE/src/services/api/mf02/*.ts` | candidate consent/CV/identity/application APIs | Contract FE cho bốn phần |
| `HRConnect-FE/src/types/api/mf02.ts` | MF02 types | Fields/request/result mới |
| `HRConnect-FE/src/features/portal/CandidatePages.tsx` | CV và applications pages | Usage warning, search/source filters |
| `HRConnect-FE/src/features/portal/CandidateIdentityPage.tsx` | identity list | Revoke alias UX |
| `HRConnect-FE/src/features/portal/CandidateAffiliateCvsPage.tsx` hoặc component consent mới | consent entry point | Danh sách hành động chờ xác nhận |
| `HRConnect/HRConnect.UnitTests/Features/Candidates/*` | existing/new tests | Backend regression |
| `HRConnect-FE/src/features/portal/*.test.tsx`, `HRConnect-FE/src/services/apiClient.test.ts` | UI/API contract tests | FE regression |

Không dự kiến migration database cho plan này. Nếu implementation phát hiện query plan cần index mới, phải route-back để duyệt migration riêng thay vì tự thêm.

## 11. Reusable Implementation Context

```yaml
implementation_context:
  task_summary: "Hoàn thiện Candidate MF02: consent inbox, CV usage/delete metadata, revoke email alias, application search/source filter và FE tương ứng."
  acceptance_criteria:
    - "Candidate tìm và mở được mọi consent đang chờ của chính mình."
    - "FE biết trước thao tác xóa CV là hard delete hay archive history."
    - "Chỉ verified alias của đúng user được revoke bằng concurrency token; primary không thể revoke."
    - "Application list tìm theo Job/Company và lọc nguồn CANDIDATE/AFFILIATE tại database."
    - "Không sửa Dashboard MF03, Profile MF04 hoặc Notification MF01."
  evidence_provenance:
    schema_version: 2
    head_commit: "3528d05c5008705940c5acfa29a2eae73ad9cd91"
    generated_plan_path: "docs/plans/2026-10-12-gitnexus-plan-mf02-candidate-controls.md"
    global_dirty_digest:
      algorithm: "sha256"
      canonicalization: "gitnexus-evidence-provenance-v2 NUL-framed UTF-8 records"
      value: "14cb02cfb451419d6b6c555cb60b5ff70504ef65c3054483a849f4709c16ad40"
    cited_path_manifest:
      - { path: "AGENTS.md", state: "untracked" }
      - { path: "HRConnect/HRConnect.Presentation/Endpoints/V1/Candidates/CandidateEndpoints.cs", state: "clean" }
      - { path: "HRConnect/HRConnect.Presentation/Endpoints/V1/SubmissionConsents/SubmissionConsentEndpoints.cs", state: "clean" }
      - { path: "HRConnect/HRConnect.Application/Features/Candidates/Queries/GetCandidateApplications/GetCandidateApplicationsQueryHandler.cs", state: "clean" }
      - { path: "HRConnect/HRConnect.Application/Features/Candidates/Commands/DeleteCandidateCv/DeleteCandidateCvCommandHandler.cs", state: "clean" }
      - { path: "HRConnect/HRConnect.Application/Features/Candidates/Identity/GetCandidateEmailIdentities/GetCandidateEmailIdentitiesQueryHandler.cs", state: "clean" }
      - { path: "HRConnect/HRConnect.Infrastructure/Repositories/ApplicationRepository.cs", state: "clean" }
      - { path: "HRConnect/HRConnect.Infrastructure/Repositories/CandidateCvRepository.cs", state: "clean" }
      - { path: "HRConnect/HRConnect.Infrastructure/Repositories/SubmissionRepository.cs", state: "clean" }
      - { path: "HRConnect/HRConnect.Infrastructure/Repositories/UserEmailIdentityRepository.cs", state: "clean" }
      - { path: "HRConnect/HRConnect.Domain/Entities/UserEmailIdentity.cs", state: "clean" }
      - { path: "HRConnect-FE/src/features/portal/CandidatePages.tsx", state: "clean" }
      - { path: "HRConnect-FE/src/features/portal/CandidateIdentityPage.tsx", state: "clean" }
      - { path: "HRConnect-FE/src/features/portal/CandidateAffiliateCvsPage.tsx", state: "clean" }
      - { path: "HRConnect-FE/src/types/api/mf02.ts", state: "clean" }
  primary_symbols:
    - symbol: "GetCandidateApplicationsQueryHandler.Handle"
      file: "HRConnect/HRConnect.Application/Features/Candidates/Queries/GetCandidateApplications/GetCandidateApplicationsQueryHandler.cs"
      lines: "27-86"
      role: "Candidate-owned application list orchestration and mapping"
    - symbol: "DeleteCandidateCvCommandHandler.Handle"
      file: "HRConnect/HRConnect.Application/Features/Candidates/Commands/DeleteCandidateCv/DeleteCandidateCvCommandHandler.cs"
      lines: "36-116"
      role: "Authoritative hard-delete versus archive-history decision"
    - symbol: "GetCandidateEmailIdentitiesQueryHandler.Handle"
      file: "HRConnect/HRConnect.Application/Features/Candidates/Identity/GetCandidateEmailIdentities/GetCandidateEmailIdentitiesQueryHandler.cs"
      lines: "21-60"
      role: "Identity ownership and alias action capabilities"
    - symbol: "SubmissionRepository.GetCandidateAffiliateCvUsagesAsync"
      file: "HRConnect/HRConnect.Infrastructure/Repositories/SubmissionRepository.cs"
      lines: "371-431"
      role: "Existing consent/job/company projection pattern"
  related_symbols:
    - symbol: "RespondSubmissionConsentCommandHandler.Handle"
      relationship: "existing mutation authority"
      relevance: "List routes to this handler and must tolerate expiry/concurrency races"
    - symbol: "SubmissionConsentExpiryService.ExpireAsync"
      relationship: "state transition owner"
      relevance: "GET list must not duplicate expiry mutation"
    - symbol: "IUserEmailIdentityRepository"
      relationship: "repository boundary"
      relevance: "Needs owner lookup and concurrency-safe revoke"
  execution_path:
    - "Resolve active, unmerged Candidate from authenticated UserId."
    - "Apply ownership and validated filters in repository query."
    - "Return additive DTO fields without secrets or cross-candidate data."
    - "For mutations, validate current state and concurrency token, write audit, then commit atomically."
    - "FE invalidates all MF02 projections affected by the mutation."
  pdg_constraints:
    - description: "CV delete behavior is controlled by ownership, creation method and IsCvInUseAsync."
      affected_statements:
        - "HRConnect/HRConnect.Application/Features/Candidates/Commands/DeleteCandidateCv/DeleteCandidateCvCommandHandler.cs:52"
        - "HRConnect/HRConnect.Application/Features/Candidates/Commands/DeleteCandidateCv/DeleteCandidateCvCommandHandler.cs:59"
        - "HRConnect/HRConnect.Application/Features/Candidates/Commands/DeleteCandidateCv/DeleteCandidateCvCommandHandler.cs:66-105"
      implementation_consequence: "List metadata must use the same Submission-reference definition."
    - description: "Identity mutations in this codebase guard stale tokens and use transaction rollback."
      affected_statements:
        - "HRConnect/HRConnect.Application/Features/Candidates/Identity/VerifyCandidateIdentityClaim/VerifyCandidateIdentityClaimCommandHandler.cs:48-82"
        - "HRConnect/HRConnect.Application/Features/Candidates/Identity/VerifyCandidateIdentityClaim/VerifyCandidateIdentityClaimCommandHandler.cs:141-192"
      implementation_consequence: "Revoke must follow the same optimistic-concurrency and atomic-audit pattern."
  architectural_patterns:
    - pattern: "Authenticated UserId -> Candidate ownership"
      example_location: "GetCandidateApplicationsQueryHandler.Handle"
      usage_guidance: "Never accept CandidateId from the client for own-resource APIs."
    - pattern: "Repository projection for paginated read models"
      example_location: "SubmissionRepository.GetCandidateAffiliateCvUsagesAsync"
      usage_guidance: "Project only required columns and apply count/filter before pagination."
    - pattern: "Concurrency token + business conflict"
      example_location: "VerifyCandidateIdentityClaimCommandHandler.Handle"
      usage_guidance: "Return stable 409 error codes and rotate tokens after mutation."
  files_to_modify:
    - file: "HRConnect/HRConnect.Presentation/Endpoints/V1/SubmissionConsents/SubmissionConsentEndpoints.cs"
      symbols: ["MapSubmissionConsentEndpoints"]
      intended_change: "Add authenticated consent list route."
    - file: "HRConnect/HRConnect.Presentation/Endpoints/V1/Candidates/CandidateEndpoints.cs"
      symbols: ["MapCandidateEndpoints"]
      intended_change: "Add alias revoke and application filters; document additive CV fields."
    - file: "HRConnect/HRConnect.Infrastructure/Repositories/SubmissionRepository.cs"
      symbols: ["new GetCandidateSubmissionConsentsAsync"]
      intended_change: "Owner-scoped consent projection."
    - file: "HRConnect/HRConnect.Infrastructure/Repositories/CandidateCvRepository.cs"
      symbols: ["candidate CV list projection"]
      intended_change: "Usage counts and delete behavior without N+1."
    - file: "HRConnect/HRConnect.Infrastructure/Repositories/UserEmailIdentityRepository.cs"
      symbols: ["new owner lookup/conditional revoke"]
      intended_change: "Concurrency-safe alias revocation."
    - file: "HRConnect/HRConnect.Infrastructure/Repositories/ApplicationRepository.cs"
      symbols: ["GetCandidateApplicationsAsync"]
      intended_change: "Search, submission source and stable ordering."
    - file: "HRConnect-FE/src/types/api/mf02.ts"
      symbols: ["MF02 Candidate contracts"]
      intended_change: "Types for new/additive APIs."
    - file: "HRConnect-FE/src/features/portal/CandidatePages.tsx"
      symbols: ["CandidateApplicationsPage", "Candidate CV UI"]
      intended_change: "Filters and deletion consequence UI."
    - file: "HRConnect-FE/src/features/portal/CandidateIdentityPage.tsx"
      symbols: ["CandidateIdentityPage"]
      intended_change: "Revoke alias action and stale-state handling."
  tests:
    - file: "HRConnect/HRConnect.UnitTests/Features/Candidates/GetCandidateApplicationsQueryHandlerTests.cs"
      scenarios: ["search/source passed and mapped", "source returned", "pagination unchanged"]
    - file: "HRConnect/HRConnect.UnitTests/Features/Candidates/GetCandidateCvsQueryHandlerTests.cs"
      scenarios: ["hard-delete metadata", "archive-history metadata"]
    - file: "HRConnect/HRConnect.UnitTests/Features/Candidates/Identity/RevokeCandidateEmailIdentityCommandHandlerTests.cs"
      scenarios: ["success", "primary conflict", "foreign ownership", "stale token", "already revoked", "audit atomicity"]
    - file: "HRConnect/HRConnect.UnitTests/Features/Candidates/GetCandidateSubmissionConsentsQueryHandlerTests.cs"
      scenarios: ["owner isolation", "pending actionable", "expired non-actionable", "pagination"]
    - file: "HRConnect-FE/src/features/portal/CandidateIdentityPage.test.tsx"
      scenarios: ["revoke visibility", "confirmation", "409 reload"]
    - file: "HRConnect-FE/src/features/portal/CandidatePages.test.tsx"
      scenarios: ["application URL filters", "CV deletion warning modes"]
  verification_commands:
    - "dotnet test HRConnect/HRConnect.UnitTests/HRConnect.UnitTests.csproj"
    - "dotnet build HRConnect/HRConnect.sln"
    - "cd HRConnect-FE && npm run test:run"
    - "cd HRConnect-FE && npm run lint"
    - "cd HRConnect-FE && npm run build"
  risks:
    - "Consent can expire between list and respond; respond remains authoritative."
    - "Alias revoke releases a partial unique email key; claim-again behavior must be tested."
    - "Usage counts and ILIKE filters need database-side projection and query-plan review."
    - "Minimal API/MediatR edges are incomplete in GitNexus; source verification is mandatory."
  assumptions:
    - "Candidate role continues to include application.view_own; verify seed/production permission before endpoint rollout."
    - "No migration is required; verify generated EF model before implementation commit."
    - "Submission.Source remains limited to CANDIDATE/AFFILIATE for user-facing filter."
  open_questions: []
  avoid:
    - "Do not repeat full repository discovery."
    - "Do not modify MF01 notifications, MF03 dashboard, MF04 profile or recruitment pipeline detail."
    - "Do not return consent token hashes, recipient email, IP or user-agent in list APIs."
    - "Do not hard-delete referenced CVs or any historical Submission/Application."
    - "Do not revoke PRIMARY email."
    - "Do not add database indexes without an observed query-plan need."
```

## 12. Assumptions and Open Questions

### Confirmed boundaries

- [verified] Dashboard/count cards are handed off to MF03; MF02 only owns the underlying candidate consent/application/CV read models.
- [verified] Candidate Profile is handed off to MF04.
- [verified] Notification list/read-state UI and shared API are handed off to MF01.

### Assumptions to re-verify at execution

- [assumed] Production Candidate role contains `application.view_own`. The executor must verify seed SQL and a real Candidate JWT before enabling the new consent list permission.
- [assumed] `Submission.Source` production values are only `CANDIDATE` and `AFFILIATE`; verify constraints/data before enforcing validator whitelist.
- [assumed] Existing storage delete service deletes both metadata and R2 object for unused CVs as the handler comment states; run the existing delete tests and inspect implementation before changing UI copy.
- [assumed] No database migration is needed. Re-run EF model diff after repository/entity work; if a schema change appears, stop and review separately.

### Explicitly deferred

- Candidate Dashboard widgets and aggregate endpoint: MF03.
- Candidate Profile API/form: MF04.
- Notification inbox/read-state: MF01.
- Application timeline, Interview, Offer, Placement: MF04.
- Saved Jobs: MF01/current job-discovery owner.
- Broad deletion of legacy Candidate pages/stores until all owner modules are merged and route impact is re-run.

## 13. Definition of Done

- Candidate đăng nhập thấy danh sách consent của chính mình, mở đúng request và phản hồi bằng flow hiện có.
- Không có consent quá hạn nào được trình bày là còn hành động được; race tại thời điểm respond được xử lý bằng lỗi nghiệp vụ và refresh.
- CV list trả counts và delete behavior đúng cùng tiêu chí với delete handler; FE giải thích đúng hậu quả trước xác nhận.
- Candidate revoke được verified alias, không revoke được primary/foreign/stale identity; audit và mutation atomic.
- Application list hỗ trợ `search` và `submissionSource`, trả `submissionSource`, giữ pagination/count ổn định.
- Swagger mô tả đủ request, response, permission và status codes cho API mới/thay đổi.
- Backend tests, build, FE unit tests, lint và build đều pass.
- Playwright Candidate desktop smoke xác nhận consent, CV, identity và applications không regress.
- Không có migration ngoài dự kiến, không có 500 do FK/concurrency trong các scenario đã nêu.
- Không có thay đổi production code thuộc MF01/MF03/MF04 trong scope này.

