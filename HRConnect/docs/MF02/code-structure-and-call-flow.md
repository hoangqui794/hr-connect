# Luồng Đi Qua Các Folder, File & Hàm Chi Tiết — MF-02

Tài liệu này dùng để tra cứu nhanh khi **Review / Vấn đáp code MF-02**: ứng với từng hành động thực tế (Candidate nộp CV, Affiliate giới thiệu CV, Candidate bấm đồng ý Consent, Tải CV / Tạo CV Builder, Xử lý trùng hồ sơ), request sẽ **đi qua đúng những Folder $\rightarrow$ File $\rightarrow$ Hàm nào** và thực hiện **những bước gì** theo thứ tự từ Frontend xuống Database.

---

## 1. Khi Candidate Tự Nộp CV Ứng Tuyển (`CV_APPLICATION`)

### 1.1. Sơ đồ đường đi qua các Folder & File

```text
[1. FRONTEND]       HRConnect-FE/src/features/jobs/components/JobApplyActions.tsx
                    └── gọi hàm applyJob() trong: HRConnect-FE/src/services/candidateApi.ts
                                 │
                                 ▼  (HTTP POST /api/v1/jobs/{jobId}/apply)
[2. PRESENTATION]   HRConnect/HRConnect.Presentation/Endpoints/V1/Candidates/CandidateEndpoints.cs
                    └── nhận request -> tạo ApplyJobCommand -> gọi sender.Send(command)
                                 │
                                 ▼
[3. VALIDATOR]      HRConnect/HRConnect.Application/Features/Candidates/Commands/ApplyJob/ApplyJobCommandValidator.cs
                    └── kiểm tra JobId, CvId / File PDF đầu vào
                                 │
                                 ▼
[4. HANDLER]        HRConnect/HRConnect.Application/Features/Candidates/Commands/ApplyJob/ApplyJobCommandHandler.cs
                    └── hàm Handle() điều phối toàn bộ nghiệp vụ ứng tuyển
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
[5. DOMAIN ENTITIES]     [6. INFRASTRUCTURE]      [7. AI & REALTIME]
HRConnect.Domain/        HRConnect.Infrastructure/ HRConnect.Infrastructure/
Entities/                Repositories/            Services/
├── Candidate.cs         ├── CandidateCompanyTransactionLock.cs (Khóa chống nộp đúp)
├── CandidateCv.cs       ├── CandidateRepository.cs             (Đọc hồ sơ Candidate)
├── Job.cs               ├── CandidateCvRepository.cs           (Đọc/kiểm tra CV)
├── Submission.cs        ├── SubmissionRepository.cs            (Kiểm tra trùng & lưu Submission)
└── Application.cs       ├── ApplicationRepository.cs           (Lưu Application & History)
                         └── Services/Storage/CvStorageService.cs (Nếu tải file PDF mới lên R2)
                                                  ├── Mf03ScoringTrigger (Đẩy chấm điểm AI ngầm)
                                                  └── NotificationPublisher (Bắn SignalR cho Client)
```

### 1.2. Các bước chạy & gọi hàm theo thứ tự

| Bước | Tầng | File (`Folder/File`) | Hàm được gọi | Việc thực hiện tại bước này |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Frontend UI** | `HRConnect-FE/src/features/jobs/components/JobApplyActions.tsx` | `ApplyModal` $\rightarrow$ `handleSubmit()` | Ứng viên bấm **"Ứng tuyển"**, chọn 1 CV đã lưu trên server (lọc bỏ bản nháp local) hoặc tải file PDF mới. |
| **2** | **Frontend API** | `HRConnect-FE/src/services/candidateApi.ts` | `applyJob(jobId, payload)` | Gửi HTTP `POST /api/v1/jobs/{jobId}/apply` kèm JWT Token của Candidate. |
| **3** | **Presentation** | `HRConnect.Presentation/Endpoints/V1/Candidates/CandidateEndpoints.cs` | `MapCandidateEndpoints()` | Nhận request, lấy `userId` từ JWT, đóng gói `ApplyJobCommand` rồi gọi `await sender.Send(command, ct)`. |
| **4** | **Application (Validate)** | `HRConnect.Application/Features/Candidates/Commands/ApplyJob/ApplyJobCommandValidator.cs` | `ApplyJobCommandValidator()` | Kiểm tra `JobId` khác rỗng, phải có `CvId` hoặc file PDF ($\le 10\text{MB}$). Nếu sai trả `400 Bad Request`. |
| **5** | **Application (Handler)** | `HRConnect.Application/Features/Candidates/Commands/ApplyJob/ApplyJobCommandHandler.cs` | `Handle(ApplyJobCommand, ct)` | Bắt đầu xử lý nghiệp vụ nộp đơn: |
| **5.1** | $\hookrightarrow$ *Gọi Repo* | `HRConnect.Infrastructure/Repositories/CandidateRepository.cs` | `GetByUserIdAsync(userId, ct)` | Kiểm tra hồ sơ `Candidate` đang `ACTIVE` và chưa bị gộp (`MergedIntoCandidateId == null`). |
| **5.2** | $\hookrightarrow$ *Gọi Repo* | `HRConnect.Infrastructure/Repositories/JobRepository.cs` | `GetByIdWithServiceTypeAsync(jobId, ct)` | Kiểm tra Job phải có `ServiceType == "CV_APPLICATION"`, `Status == "ACTIVE"`, chưa quá hạn `ApplicationDeadline` và chưa vượt `MaxApplications`. |
| **5.3** | $\hookrightarrow$ *Gọi Lock* | `HRConnect.Infrastructure/Repositories/CandidateCompanyTransactionLock.cs` | `AcquireLockAsync(candidateId, companyId, ct)` | Mở DB Transaction và khóa cặp `(CandidateId, CompanyId)` bằng `pg_advisory_xact_lock` để chống bấm đúp 2 request cùng lúc. |
| **5.4** | $\hookrightarrow$ *Gọi Repo* | `HRConnect.Infrastructure/Repositories/SubmissionRepository.cs` | `GetExistingForCandidateAndJobAsync(...)` | Kiểm tra ứng viên đã nộp vào Job này chưa. Nếu đã nộp (và đơn cũ không phải `WITHDRAWN`), ghi nhận `Submission (Status = "BLOCKED_DUPLICATE")` và trả lỗi `409 Conflict`. |
| **5.5** | $\hookrightarrow$ *Tạo Entity* | `HRConnect.Domain/Entities/Submission.cs` & `Application.cs` | Khởi tạo `new Submission()` & `new Application()` | Tạo `Submission` (`Source = "CANDIDATE"`, `Status = "ACCEPTED"`) và tạo thẳng `Application` (`Status = "SUBMITTED"`, `AcceptedSubmissionId = submission.SubmissionId`) + `ApplicationStatusHistory`. |
| **5.6** | $\hookrightarrow$ *Lưu DB* | `HRConnect.Infrastructure/Persistence/UnitOfWork.cs` | `SaveChangesAsync(ct)` & `CommitTransactionAsync(ct)` | Ghi `Submission`, `Application`, `ApplicationStatusHistory`, `AuditLog` xuống PostgreSQL trong 1 transaction. |
| **5.7** | $\hookrightarrow$ *Kích hoạt AI & SignalR* | `HRConnect.Infrastructure/Services/Integration/Mf03ScoringTrigger.cs` | `TriggerScoringAsync(applicationId, ct)` | Tạo bản ghi `AiMatchResult (Status = "PENDING")` để worker chấm điểm CV ngầm, đồng thời bắn thông báo SignalR cho Client Company. |

---

## 2. Khi Affiliate Giới Thiệu Ứng Viên (`HEADHUNT_COD` & `CV_SOURCING`)

### 2.1. Sơ đồ đường đi qua các Folder & File

```text
[1. FRONTEND]       HRConnect-FE/src/features/portal/AffiliateJobPages.tsx
                    └── gọi hàm submitCandidate() trong: HRConnect-FE/src/services/affiliateApi.ts
                                 │
                                 ▼  (HTTP POST /api/v1/jobs/{jobId}/candidate-submissions)
[2. PRESENTATION]   HRConnect/HRConnect.Presentation/Endpoints/V1/Affiliates/AffiliateEndpoints.cs
                    └── nhận form-data -> tạo SubmitCandidateCommand -> gọi sender.Send(command)
                                 │
                                 ▼
[3. VALIDATOR]      HRConnect/HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommandValidator.cs
                    └── kiểm tra Họ tên, Email, SĐT, nguồn CV (file PDF mới hoặc CandidateId + CvId từ kho)
                                 │
                                 ▼
[4. HANDLER]        HRConnect/HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommandHandler.cs
                    └── hàm Handle() thực thi kiểm tra danh tính, chống trùng, lưu CV và phát hành Consent 48h
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
[5. STORAGE & IDENTITY]  [6. DOMAIN & TOKEN]      [7. REPOSITORIES & EMAIL]
HRConnect.Infrastructure/ HRConnect.Application/   HRConnect.Infrastructure/
Services/                Features/SubmissionConsents/ Repositories/
├── Storage/CvStorageService.cs     ├── SubmissionConsentToken.cs (Sinh token 32B & băm SHA-256)
├── Storage/PdfCvValidator.cs       HRConnect.Domain/Entities/
└── Identity/CandidateIdentity      ├── Candidate.cs / CandidateCv.cs
    EvidenceProtector.cs            ├── Submission.cs (PENDING_CONSENT)
                                    ├── SubmissionConsent.cs (PENDING)
                                    └── CandidateDuplicateCase.cs
                                                  ├── AffiliateProfileRepository.cs
                                                  ├── CandidateCompanyTransactionLock.cs
                                                  ├── SubmissionRepository.cs
                                                  ├── SubmissionConsentRepository.cs
                                                  ├── CandidateDuplicateRepository.cs
                                                  └── ResendEmailService (Ghi EmailOutbox gửi link Consent)
```

### 2.2. Các bước chạy & gọi hàm theo thứ tự

| Bước | Tầng | File (`Folder/File`) | Hàm được gọi | Việc thực hiện tại bước này |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Frontend UI** | `HRConnect-FE/src/features/portal/AffiliateJobPages.tsx` | Form **"Giới thiệu ứng viên"** | Affiliate nhập Họ tên, Email, SĐT ứng viên và chọn **Tải CV PDF mới** hoặc **Chọn CV từ Kho CV của Affiliate**. |
| **2** | **Frontend API** | `HRConnect-FE/src/services/affiliateApi.ts` | `submitCandidate(jobId, formData)` | Gửi HTTP `POST /api/v1/jobs/{jobId}/candidate-submissions`. |
| **3** | **Presentation** | `HRConnect.Presentation/Endpoints/V1/Affiliates/AffiliateEndpoints.cs` | `MapAffiliateEndpoints()` | Đọc multipart form-data, tạo `SubmitCandidateCommand` rồi gọi `await sender.Send(command, ct)`. |
| **4** | **Application (Validate)** | `HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommandValidator.cs` | `SubmitCandidateCommandValidator()` | Kiểm tra định dạng Email, SĐT, Họ tên và bắt buộc có file PDF mới hoặc `(CandidateId, CvId)`. |
| **5** | **Application (Handler)** | `HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommandHandler.cs` | `Handle(SubmitCandidateCommand, ct)` | Điều phối 7 bước nghiệp vụ giới thiệu ứng viên: |
| **5.1** | $\hookrightarrow$ *Kiểm tra Affiliate & Job* | `HRConnect.Infrastructure/Repositories/AffiliateProfileRepository.cs` | `GetByUserIdAsync(userId, ct)` | Kiểm tra Affiliate phải `ACTIVE`, Job phải thuộc loại `HEADHUNT_COD` hoặc `CV_SOURCING` và đang `ACTIVE`. Nếu nộp vào `ReplacementSlot` thì slot phải đang `OPEN`. |
| **5.2** | $\hookrightarrow$ *Khóa & Đối chiếu danh tính* | `SubmitCandidateCommandHandler.cs` & `CandidateRepository.cs` | `AcquireLockAsync(...)` & tìm theo `NormalizedEmail` / `NormalizedPhone` | **Strict Identity Match:** Nếu Email khớp `Candidate A` nhưng SĐT khớp `Candidate B` (`A != B`), hoặc Candidate đã có tài khoản xác thực (`UserId != null`) với `Phone A` mà Affiliate gửi `Phone B != Phone A` $\rightarrow$ chặn ngay `409 Conflict` để chống gian lận sửa SĐT (Contact Hijacking). Nếu ứng viên chưa tồn tại $\rightarrow$ tạo mới `Candidate (UserId = null)`. |
| **5.3** | $\hookrightarrow$ *Kiểm tra / Upload CV* | `HRConnect.Infrastructure/Services/Storage/CvStorageService.cs` & `PdfCvValidator.cs` | `UploadAffiliateCvPdfAsync(...)` *(hoặc kiểm tra CV cũ)* | - Nếu **Upload CV mới**: kiểm tra `%PDF-`, tính mã băm `ContentSha256`, lưu lên **Cloudflare R2**, tạo `CandidateCv (SourceType = "AFFILIATE_UPLOAD", AffiliateReuseStatus = "ALLOWED")`.<br>- Nếu **Dùng lại CV từ kho**: kiểm tra đủ 5 điều kiện (đúng chủ Affiliate upload, `ACTIVE`, `AffiliateReuseStatus == "ALLOWED"`, và đã có ít nhất 1 `Submission` `ACCEPTED`). |
| **5.4** | $\hookrightarrow$ *Kiểm tra trùng & Client Ownership* | `HRConnect.Infrastructure/Repositories/SubmissionRepository.cs` | `IsCandidateOwnedByClientAsync(...)` | - Với `HEADHUNT_COD`: nếu ứng viên đang thuộc quyền sở hữu của doanh nghiệp tuyển dụng $\rightarrow$ chặn `409 CANDIDATE_OWNED_BY_CLIENT`.<br>- Nếu ứng viên đã có `Application` hoặc `Submission (ACCEPTED / PENDING_CONSENT)` trên cùng Job $\rightarrow$ lưu `Submission (Status = "BLOCKED_DUPLICATE")` và chặn `409 Conflict`. |
| **5.5** | $\hookrightarrow$ *Quét tín hiệu nghi trùng* | `HRConnect.Infrastructure/Repositories/CandidateDuplicateRepository.cs` | Kiểm tra trùng `ContentSha256` / `NormalizedName` | Nếu phát hiện hồ sơ khác trên cùng Job có cùng mã băm file CV `ContentSha256` hoặc cùng tên chuẩn hóa $\rightarrow$ mở ca nghi trùng `CandidateDuplicateCase (RiskLevel = "HIGH")` + `CandidateDuplicateSignal`. |
| **5.6** | $\hookrightarrow$ *Tạo Submission & Token Consent 48h* | `HRConnect.Application/Features/SubmissionConsents/SubmissionConsentToken.cs` | `SubmissionConsentToken.Create()` | - Tạo `Submission` ở trạng thái **`PENDING_CONSENT`** (lưu snapshot `SubmittedFullName`, `SubmittedPhone`).<br>- Sinh token ngẫu nhiên 32 bytes, chỉ lưu mã băm **`TokenHash` (`SHA-256`)** vào bảng `SubmissionConsent (Status = "PENDING", ExpiresAt = UtcNow + 48h)`. |
| **5.7** | $\hookrightarrow$ *Gửi Email & SignalR* | `HRConnect.Infrastructure/Services/Email/ResendEmailService.cs` | Ghi `EmailOutbox` & `PublishAsync()` | Gửi email chứa link xác nhận `/consent#token=<rawToken>` cho ứng viên và bắn SignalR nếu ứng viên đã có tài khoản trên hệ thống. |

---

## 3. Khi Candidate Phản Hồi Yêu Cầu Đồng Ý (`CONFIRM` / `DECLINE` / `REPORT_UNAUTHORIZED`)

### 3.1. Sơ đồ đường đi qua các Folder & File

```text
[1. FRONTEND]       - Kênh link Email (Public): HRConnect-FE/src/features/portal/PublicSubmissionConsentPage.tsx
                    - Kênh Đã đăng nhập:       HRConnect-FE/src/features/portal/CandidateSubmissionConsentPage.tsx
                                 │
                                 ▼  (HTTP POST /api/v1/submission-consents/respond hoặc /report-unauthorized)
[2. PRESENTATION]   HRConnect/HRConnect.Presentation/Endpoints/V1/SubmissionConsents/SubmissionConsentEndpoints.cs
                    └── nhận request -> gửi RespondSubmissionConsentCommand hoặc ReportUnauthorizedSubmissionConsentCommand
                                 │
                                 ▼
[3. HANDLER]        HRConnect/HRConnect.Application/Features/SubmissionConsents/
                    ├── RespondSubmissionConsent/RespondSubmissionConsentCommandHandler.cs
                    └── ReportUnauthorizedSubmissionConsent/ReportUnauthorizedSubmissionConsentCommand.cs
                                 │
                                 ▼
[4. POLICY]         HRConnect/HRConnect.Application/Features/SubmissionConsents/Common/SubmissionAcceptancePolicy.cs
                    └── hàm AcceptAsync() chuyển Submission -> ACCEPTED, tạo Application (SUBMITTED) & Attribution (ACTIVE)
```

### 3.2. Các bước chạy & gọi hàm theo thứ tự

| Bước | Tầng | File (`Folder/File`) | Hàm được gọi | Việc thực hiện tại bước này |
| :---: | :--- | :--- | :--- | :--- |
| **1** | **Frontend UI** | `PublicSubmissionConsentPage.tsx` hoặc `CandidateSubmissionConsentPage.tsx` | Đọc `#token=` $\rightarrow$ gọi `respondConsent()` | Đọc token từ URL fragment (`#token=...`), xóa ngay khỏi thanh địa chỉ trình duyệt, hiển thị thông tin Job + CV và cho ứng viên chọn 1 trong 3 nút: **Đồng ý (`CONFIRM`)**, **Từ chối (`DECLINE`)**, hoặc **Báo cáo không phải tôi (`REPORT_UNAUTHORIZED`)**. |
| **2** | **Presentation** | `HRConnect.Presentation/Endpoints/V1/SubmissionConsents/SubmissionConsentEndpoints.cs` | `MapSubmissionConsentEndpoints()` | Nhận request (kèm `ClientIp` và `UserAgent`), gọi `sender.Send(...)`. |
| **3** | **Application (Handler)** | `RespondSubmissionConsentCommandHandler.cs` | `Handle(RespondSubmissionConsentCommand, ct)` | Băm `rawToken` bằng `SubmissionConsentToken.HashToken()` (`SHA-256`), tìm `SubmissionConsent` trong DB và kiểm tra còn ở trạng thái `PENDING` cũng như chưa quá 48h (`ExpiresAt > UtcNow`). |
| **4A** | $\hookrightarrow$ *Nhánh 1: Chọn `CONFIRM` (Đồng ý)* | `HRConnect.Application/Features/SubmissionConsents/Common/SubmissionAcceptancePolicy.cs` | `AcceptAsync(submission, consent, ct)` | - Nếu đang có ca nghi trùng cùng Job (`CandidateDuplicateCase`) $\rightarrow$ đặt `SubmissionConsent = "CONFIRMED"` nhưng giữ `Submission.Status = "PENDING_IDENTITY_REVIEW"` chờ Admin phân xử.<br>- Nếu không trùng $\rightarrow$ chuyển `Submission.Status = "ACCEPTED"`, tạo **`Application (Status = "SUBMITTED")`**, tạo **`Attribution (Status = "ACTIVE", Rule = "CANDIDATE_CONSENT_THEN_FIRST_ACCEPTED")`** gắn hoa hồng cho Affiliate, và gọi `IMf03ScoringTrigger.TriggerScoringAsync()` để chấm điểm AI. |
| **4B** | $\hookrightarrow$ *Nhánh 2: Chọn `DECLINE` (Từ chối)* | `RespondSubmissionConsentCommandHandler.cs` | Cập nhật trạng thái từ chối | Đặt `SubmissionConsent.Status = "DECLINED"`, `Submission.Status = "CONSENT_REJECTED"`, không tạo Application, gửi thông báo SignalR cho Affiliate. |
| **4C** | $\hookrightarrow$ *Nhánh 3: Chọn `REPORT_UNAUTHORIZED`* | `ReportUnauthorizedSubmissionConsentCommand.cs` | `Handle(ReportUnauthorizedSubmissionConsentCommand, ct)` | Đặt `SubmissionConsent.Status = "DECLINED"`, `Submission.Status = "CONSENT_REJECTED"`, đồng thời **thu hồi vĩnh viễn quyền dùng lại CV đó của Affiliate (`CandidateCv.AffiliateReuseStatus = "REVOKED"`)**, lưu `ResponseIp`, `ResponseUserAgent`, ghi `AuditLog` và cảnh báo cho Affiliate. |
| **5** | **Infrastructure (Worker chạy ngầm)** | `HRConnect.Infrastructure/Services/SubmissionConsents/SubmissionConsentExpiryWorker.cs` | `ExecuteAsync()` $\rightarrow$ `SubmissionConsentExpiryService.ExpireOverdueConsentsAsync()` | Quét định kỳ các `SubmissionConsent` quá 48h mà ứng viên không phản hồi $\rightarrow$ tự động chuyển sang `EXPIRED` và `Submission.Status = "CONSENT_EXPIRED"`. |

---

## 4. Khi Candidate Tải CV PDF Hoặc Dùng CV Builder

| Hành động | Đi qua các File theo thứ tự (`Frontend` $\rightarrow$ `Presentation` $\rightarrow$ `Application` $\rightarrow$ `Infrastructure`) | Các bước xử lý chính |
| :--- | :--- | :--- |
| **Tải file CV PDF lên Kho CV** | 1. `HRConnect-FE/src/features/portal/CandidateCvsPage.tsx`<br>2. `HRConnect-FE/src/services/api/mf02/candidateCvApi.ts` (`uploadCv`)<br>3. `HRConnect.Presentation/Endpoints/V1/Candidates/CandidateEndpoints.cs` (`POST /api/v1/candidates/me/cvs`)<br>4. `HRConnect.Application/Features/Candidates/Commands/UploadCv/UploadCvCommandHandler.cs`<br>5. `HRConnect.Infrastructure/Services/Storage/CvStorageService.cs` & `PdfCvValidator.cs` | 1. Kiểm tra file PDF hợp lệ (`%PDF-`, $\le 10\text{MB}$).<br>2. Băm nhị phân lấy `ContentSha256` (`binary-sha256-v1`).<br>3. Upload file lên **Cloudflare R2**.<br>4. Lưu bản ghi `CandidateCv (SourceType = "CANDIDATE_UPLOAD")` xuống PostgreSQL. |
| **Tạo / Sửa CV bằng CV Builder** | 1. `HRConnect-FE/src/features/portal/candidate/cv-builder/CandidateCvBuilderPage.tsx` & `CvTopbar.tsx`<br>2. `HRConnect.Presentation/Endpoints/V1/Candidates/CvBuilderEndpoints.cs`<br>3. `HRConnect.Application/Features/Candidates/CvBuilder/CvBuilderFeatures.cs`<br>4. `HRConnect.Infrastructure/Services/CvBuilder/StructuredCvService.cs` & `CvPdfRenderer.cs` | 1. Lưu nháp tự động ở `localStorage` trình duyệt.<br>2. Khi bấm Lưu: gửi JSON cấu trúc CV xuống Backend.<br>3. `CvPdfRenderer` (`SkiaSharp`) render ra file PDF, tính `ContentSha256`, upload lên **Cloudflare R2** và lưu `CandidateCv (SourceType = "CV_BUILDER")`. |
| **Bật/Tắt quyền cho Affiliate dùng lại CV hoặc Nhận CV về kho cá nhân** | 1. `HRConnect-FE/src/features/portal/CandidateAffiliateCvsPage.tsx`<br>2. `HRConnect.Presentation/Endpoints/V1/Candidates/CandidateEndpoints.cs`<br>3. `UpdateCandidateAffiliateCvReuseCommandHandler.cs` / `AdoptCandidateAffiliateCvCommandHandler.cs` | - Cho phép Candidate chủ động đổi `CandidateCv.AffiliateReuseStatus` giữa `ALLOWED` và `REVOKED`.<br>- Hoặc sao chép (`Adopt`) CV do Affiliate nộp về thành CV cá nhân của mình. |

---

## 5. Khi Phát Hiện Trùng Lặp & Admin Gộp Hồ Sơ (`CandidateDuplicateCases` & `CandidateIdentityClaim`)

| Hành động | Đi qua các File theo thứ tự (`Frontend` $\rightarrow$ `Presentation` $\rightarrow$ `Application` $\rightarrow$ `Infrastructure`) | Các bước xử lý chính |
| :--- | :--- | :--- |
| **Ứng viên xác nhận chủ quyền hồ sơ cũ bằng OTP (`CandidateIdentityClaim`)** | 1. `HRConnect-FE/src/features/portal/CandidateIdentityPage.tsx`<br>2. `HRConnect.Presentation/Endpoints/V1/Candidates/CandidateEndpoints.cs`<br>3. `HRConnect.Application/Features/Candidates/Identity/StartCandidateIdentityClaim/StartCandidateIdentityClaimCommandHandler.cs`<br>4. `VerifyCandidateIdentityClaimCommandHandler.cs` | 1. Ứng viên nhập email từng được Affiliate giới thiệu.<br>2. Hệ thống gửi mã OTP tới email đó.<br>3. Ứng viên nhập đúng OTP $\rightarrow$ tạo yêu cầu gộp hồ sơ chờ Admin duyệt. |
| **Platform Admin phân xử & gộp 2 hồ sơ trùng (`ResolveCandidateDuplicateCase`)** | 1. `HRConnect-FE/src/features/admin-console/AdminIdentityClaimsPage.tsx` & `AdminDuplicateCasesPanel.tsx`<br>2. `HRConnect.Presentation/Endpoints/V1/Admin/AdminCandidateDuplicateEndpoints.cs`<br>3. `HRConnect.Application/Features/CandidateDuplicates/PreviewMerge/PreviewCandidateDuplicateMerge.cs`<br>4. `HRConnect.Application/Features/CandidateDuplicates/Resolve/ResolveCandidateDuplicateCase.cs`<br>5. `HRConnect.Application/Features/CandidateDuplicates/Common/CandidateMergePolicy.cs`<br>6. `HRConnect.Application/Features/CandidateDuplicates/Finalization/FinalizeIdentityReviewedSubmissionService.cs` | 1. `CandidateMergePolicy` kiểm tra điều kiện gộp và chọn hồ sơ gốc (`CanonicalCandidate`).<br>2. Đánh dấu hồ sơ phụ `ARCHIVED` (`MergedIntoCandidateId = CanonicalCandidateId`), bảo toàn lịch sử và **giữ nguyên `Attribution` của Affiliate được ứng viên xác nhận sớm nhất**.<br>3. `FinalizeIdentityReviewedSubmissionService.FinalizeAsync()` giải phóng đơn hợp lệ sớm nhất sang `ACCEPTED` + tạo `Application` + kích hoạt chấm điểm AI; toàn bộ đơn trùng còn lại (`ACCEPTED`, `PENDING_IDENTITY_REVIEW` và cả `PENDING_CONSENT`) đều tự động chuyển sang `BLOCKED_DUPLICATE` (đóng `Consent` đang `PENDING` sang `CANCELLED`). |
