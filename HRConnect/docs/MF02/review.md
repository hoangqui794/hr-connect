# Báo cáo Production Readiness Audit — MF-02 (Ứng tuyển, Tạo/Tải CV, Affiliate Giới thiệu, Consent, Attribution, Chống trùng & Giao CV Sourcing)


> **Phạm vi kiểm tra (Strict MF-02 Scope):** Bám sát tuyệt đối tài liệu thiết kế `docs/diagrams/workflows/source/wf-mf02-affiliate-submission.mmd`, `docs/diagrams/classes/source/cls-mf02-submission.mmd`, `HRConnect/docs/MF02/candidate-consent.md` và `HRConnect/docs/MF02/CODE-EXECUTION-FLOW.md`, kết hợp bộ tiêu chuẩn **Ponytail** (Anti-Overengineering), **Vercel Web Interface Guidelines** và **Anthropic Frontend Design**. Không đề xuất tính năng ngoài scope.

## Tổng quan Kết quả

| Hạng mục | Trạng thái hiện tại | Chi tiết |
| :--- | :--- | :--- |
| **Backend Unit/Integration Tests** | ✅ Pass `514/514` | Toàn bộ test `Candidates`, `Affiliates`, `Submission`, `Duplicate`, `Sourcing` chạy xanh |
| **Frontend Unit Tests (`vitest`)** | ✅ Pass `59/59` (8 files) | Toàn bộ test `portal`, `cv-builder`, `sourcing` chạy xanh |
| **🔴 Critical Bugs (Cần sửa bắt buộc trước Production)** | **3 vấn đề** | **0 Backend + 3 Frontend** (CV Builder chế độ tạo mới tự ghi đè mất bản nháp khi F5, trộn CV nháp local `cv_builder_...` vào modal nộp đơn gây lỗi `400`/`404`, nút "Đặt làm CV chính" trên trang Tổng quan không gọi API cho CV tạo bằng CV Builder) |
| **🟠 Major Issues (Cần sửa để chuẩn Production & Realtime)** | **9 vấn đề** | **4 Backend + 5 Frontend** (Giao CV Sourcing chặn nhầm ứng viên tự nộp `409 CONSENT_NOT_CONFIRMED`, Candidate tự `DISMISS` được ca nghi trùng mức `HIGH` trên cùng Job, CV Builder trên BE thiếu gán `ContentSha256`, thiếu query keys trong `notificationRefreshKeys.ts`, tham số `?action=preview\|download` trên CV Builder chưa hoạt động) |
| **🟡 Minor Polish (UI/UX, Thông báo & Code Hygiene)** | **8 vấn đề** | **4 Backend + 4 Frontend** (Bổ sung thông báo cho Affiliate khi Candidate báo cáo không nhận ra hồ sơ, ẩn PII trong log cảnh báo trùng, hiển thị đủ thông tin Job trên trang Public Consent) |

---

## 🔴 1. CRITICAL — Lỗi nghiêm trọng (Mất dữ liệu người dùng / Hỏng luồng nộp đơn & đặt CV chính)

### [FE-C01] CV Builder ở chế độ tạo mới (`create`) tự động ghi đè và làm mất bản nháp đang gõ khi F5 / tải lại trang
- **Vị trí:** `HRConnect-FE/src/features/portal/candidate/cv-builder/CandidateCvBuilderPage.tsx` (dòng `287-307` và `419-431`)
- **Nguyên nhân:**
  - Ở nhánh `mode === 'create'` (dòng `305`), thay vì đọc bản nháp từ `localStorage` qua `readCvBuilderDraft(draftKey)` như nhánh `edit` (dòng `338`), code đang gán cứng `setAvailableDraft(null)`.
  - Ngay sau khi mount 900ms, `useEffect` auto-save (dòng `419-431`) chạy với `DEFAULT_EDITOR_CONTENT` (hồ sơ mẫu) và **ghi đè trực tiếp** lên `draftKey` (`hrconnect.cv-builder.draft.v2:<userId>:new`), xóa sạch toàn bộ nội dung ứng viên vừa nhập trước khi F5.
- **Hướng sửa:** Tại dòng `305`, đổi `setAvailableDraft(null)` thành `setAvailableDraft(readCvBuilderDraft(draftKey))`.

### [FE-C02] Trộn CV nháp local (`cv_builder_...`) vào danh sách chọn nộp đơn khiến `POST /jobs/{id}/apply` và xem CV bị lỗi `400`/`404`
- **Vị trí:**
  - `HRConnect-FE/src/features/portal/CandidatePages.tsx` (dòng `90-106`, `useCandidateCvs`)
  - `HRConnect-FE/src/features/portal/JobApplyActions.tsx` (dòng `88-101`, `135-138`, `304-340`)
- **Nguyên nhân:** Hook `useCandidateCvs()` gộp các CV chỉ lưu ở `localStorage` (`cvStorage.getAll()`, có ID dạng `cv_builder_<timestamp>_...`) vào chung mảng với CV từ Backend (`candidateCvApi.list()`). Trong `ApplyModal` (`JobApplyActions.tsx:89`), danh sách `activeCvs` lấy cả CV local `cv_builder_...`. Khi ứng viên chọn CV này và bấm **"Gửi hồ sơ ứng tuyển"** hoặc **"Xem"**, FE gửi `cvId: "cv_builder_..."` (không phải UUID trên server) lên Backend và bị lỗi `400`/`404`.
- **Hướng sửa:** Trong `ApplyModal` (`JobApplyActions.tsx:89`), chỉ lọc các CV đã được lưu trên server (`!String(cv.cvId).startsWith('cv_builder_')`).

### [FE-C03] Nút "Đặt làm CV chính" trên trang Tổng quan Ứng viên không gọi API Backend đối với CV tạo bằng CV Builder
- **Vị trí:** `HRConnect-FE/src/features/portal/CandidatePages.tsx` (dòng `582-586` và `667-671`)
- **Nguyên nhân:** Biến `isOnline` được tính bằng `cv.creationMethod === 'ONLINE' || cv.creationMethod === 'PLATFORM_BUILDER' || cv.creationMethod === 'TEMPLATE_FORM'`. Mọi CV tạo bằng CV Builder đã lưu trên server đều có `creationMethod === 'PLATFORM_BUILDER'`. Khi bấm **"Đặt làm CV chính"** ở trang Tổng quan (dòng `667-670`), điều kiện `if (isOnline)` chỉ lưu vào `localStorage` mà **không gọi `setPrimary.mutate(cv.cvId)`** lên Backend (khác với `CandidateCvsPage.tsx:112-120` đã kiểm tra đúng `isOnlyLocalDraft`).
- **Hướng sửa:** Đồng bộ điều kiện `isOnlyLocalDraft = !cv.cvId || String(cv.cvId).startsWith('cv_builder_')` từ `CandidateCvsPage.tsx:112-120` sang `CandidatePages.tsx:667-671`.

---

## 🟠 2. MAJOR — Lỗi nghiệp vụ, Phân quyền xử lý trùng & Đồng bộ Realtime

### Backend Major Issues

#### [BE-M01] Luồng CV Sourcing Delivery chặn nhầm hồ sơ do Candidate tự ứng tuyển (`409 CONSENT_NOT_CONFIRMED`) và lệch `ReviewDays` khi thay thế CV
- **Vị trí:** `HRConnect/HRConnect.Application/Features/Recruitment/Sourcing/SourcingDeliveryFeatures.cs` (dòng `192-205`, `252-286`, `527-556`)
- **Nguyên nhân:**
  1. Hàm `SourcingDeliveryRules.RequireDeliverable` (dòng `200`) bắt buộc `application.Submission?.Consent?.Status == "CONFIRMED"`. Tuy nhiên, khi Candidate tự ứng tuyển vào Job `CV_SOURCING` (`ApplyJobCommandHandler.cs:179-196`), `Submission` có `Source = "CANDIDATE"` và không tạo bản ghi `SubmissionConsent` (`Consent == null`). Hệ quả là Internal HR không bao giờ giao được CV của ứng viên tự ứng tuyển cho Client (luôn lỗi `409 CONSENT_NOT_CONFIRMED`).
  2. Tại `ReplaceSourcingDeliveryCommandHandler` (dòng `527-548`), khi HR giao CV thay thế cho một lượt giao bị từ chối, handler đọc trực tiếp cấu hình mặc định `_settings.GetIntAsync(BusinessSettingKeys.CvSourcingReviewDays)` thay vì ưu tiên `old.Job.ReviewDays` đã chốt trên Job, và chưa kiểm tra `old.Job.Status == JobStatuses.Active`.
- **Hướng sửa:** Trong `RequireDeliverable`, chỉ bắt buộc `Consent.Status == "CONFIRMED"` khi `Submission.Source == "AFFILIATE"`; trong `ReplaceSourcingDeliveryCommandHandler`, kiểm tra `old.Job.Status == JobStatuses.Active` và ưu tiên `old.Job.ReviewDays`.

#### [BE-M02] Candidate có thể tự `DISMISS` ca nghi trùng mức rủi ro `HIGH` (cùng Job, trùng cả CV lẫn Họ tên) để lách bước duyệt của Admin
- **Vị trí:**
  - `HRConnect/HRConnect.Application/Features/CandidateDuplicates/Resolve/DecideMyCandidateDuplicateCase.cs` (dòng `102-152`)
  - `HRConnect/HRConnect.Presentation/Endpoints/V1/Candidates/CandidateEndpoints.cs` (dòng `268-400`)
- **Nguyên nhân:** Theo `CODE-EXECUTION-FLOW.md` (Mục 4.4 & Mục 5), khi phát hiện hồ sơ nộp trùng cả `ContentSha256` lẫn `NormalizedName` trên cùng một Job (`RiskLevel = "HIGH"`, signal `EXACT_CV_AND_NORMALIZED_NAME`), hồ sơ phải bị giữ ở `PENDING_IDENTITY_REVIEW` chờ Admin thẩm định. Hiện tại `DecideMyCandidateDuplicateCaseCommandHandler` cho phép Candidate gọi action `DISMISS` mà không chặn khi `duplicateCase.RiskLevel == "HIGH"` hoặc `duplicateCase.JobId.HasValue`, từ đó gọi thẳng `finalizer.FinalizeAsync(...)` tạo `Application` thứ 2 và cấp `Attribution` mà không qua Admin.
- **Hướng sửa:** Chặn `409 Conflict` trong `DecideMyCandidateDuplicateCaseCommandHandler` khi `action == "DISMISS"` và (`duplicateCase.RiskLevel == "HIGH"` hoặc `duplicateCase.JobId.HasValue`).

#### [BE-M03] Bất nhất kiểm tra `ApplicationDeadline` / `MaxApplications` và khóa đồng thời khi xác nhận Consent
- **Vị trí:**
  - `HRConnect/HRConnect.Application/Features/SubmissionConsents/RespondSubmissionConsent/RespondSubmissionConsentCommandHandler.cs` (dòng `102-135`, `220-269`)
  - `HRConnect/HRConnect.Application/Features/CandidateDuplicates/Finalization/FinalizeIdentityReviewedSubmissionService.cs` (dòng `95-145`)
  - `HRConnect/HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommandHandler.cs` (dòng `132-139`)
- **Nguyên nhân:** `ApplyJobCommandHandler` kiểm tra đầy đủ `ApplicationDeadline` và `MaxApplications`, nhưng `SubmitCandidateCommandHandler` thiếu kiểm tra `MaxApplications`, còn `RespondSubmissionConsentCommandHandler` và `FinalizeIdentityReviewedSubmissionService` chỉ kiểm tra `job.Status == Active`. Ngoài ra, trong `RespondSubmissionConsentCommandHandler` (dòng `220-260`), khóa `_candidateCompanyLock.AcquireAsync` và kiểm tra `GetExistingApplicationAsync` chỉ chạy khi `enforcesClientOwnership == true`.
- **Hướng sửa:** Đồng bộ kiểm tra `ApplicationDeadline` / `MaxApplications` và luôn lấy khóa kiểm tra `GetExistingApplicationAsync(candidateId, jobId)` trong transaction khi tạo `Application`.

#### [BE-M04] CV tạo từ CV Builder (`StructuredCvService`) chưa được tính và lưu `ContentSha256` / `FingerprintVersion`
- **Vị trí:** `HRConnect/HRConnect.Infrastructure/Services/CvBuilder/StructuredCvService.cs` (dòng `63-81`, `103-114`)
- **Nguyên nhân:** Khi tạo mới hoặc cập nhật CV qua CV Builder (`CreateAsync` / `UpdateAsync`), hệ thống render PDF và upload lên R2 nhưng để `cv.ContentSha256 = null` và `cv.FingerprintVersion = null` (khác với `CvStorageService.UploadCvPdfCoreAsync`), làm mất tín hiệu phát hiện trùng lặp bằng mã băm PDF.
- **Hướng sửa:** Tính `Convert.ToHexString(SHA256.HashData(pdfBytes)).ToLowerInvariant()` ngay sau khi render PDF và gán vào `cv.ContentSha256`, `cv.FingerprintVersion = 1`.

---

### Frontend Major Issues

#### [FE-M01] Thiếu và lệch Query Keys trong `notificationRefreshKeys.ts` cho các màn hình MF-02
- **Vị trí:** `HRConnect-FE/src/hooks/notificationRefreshKeys.ts` (dòng `18-44`)
- **Chi tiết:**
  1. Thiếu `SUBMISSION_CONSENT` và `ATTRIBUTION` trong `BY_ENTITY`.
  2. `CandidateSubmissionConsentPage.tsx:22` dùng `['candidate-submission-consent', submissionId]` (số ít), nhưng `BY_ENTITY.SUBMISSION` chỉ có `['candidate-submission-consents']` (số nhiều).
  3. `CandidateAffiliateCvsPage.tsx:22` dùng `['candidate-affiliate-cvs']`, chưa có trong `SUBMISSION` / `SUBMISSION_CONSENT`.
  4. `AdminIdentityClaimDetailPage.tsx:163` dùng `['admin-candidate-identity-claim', caseId]` (số ít), nhưng `BY_ENTITY` chỉ có `['admin-candidate-identity-claims']` (số nhiều).
  5. `CandidateIdentityPage.tsx:22-25` dùng `['candidate-email-identities']` và `['candidate-duplicate-cases']`, còn `AffiliatePages.tsx:1783` dùng `['aff-attributions', page]` đều chưa có trong `notificationRefreshKeys.ts`.

#### [FE-M02] Thiếu mapping điều hướng thông báo cho `CANDIDATE_IDENTITY_CLAIM` (Admin) và `SOURCING_DELIVERY` (Client)
- **Vị trí:** `HRConnect-FE/src/components/notifications/notificationRoutes.ts` (dòng `116-123` và `359-393`)
- **Chi tiết:** Nhánh `ADMIN` (dòng `116`) chỉ kiểm tra `CANDIDATE_DUPLICATE_CASE` và `IDENTITY_CLAIM`, thiếu `'CANDIDATE_IDENTITY_CLAIM'`. Nhánh `CLIENT` (dòng `359-393`) chưa có nhánh điều hướng cho `SOURCING_DELIVERY` khi `routeHint` trống.

#### [FE-M03] Tham số `?action=preview` và `?action=download` khi mở CV Builder từ trang Quản lý CV không hoạt động
- **Vị trí:**
  - Nơi gọi: `HRConnect-FE/src/features/portal/CandidateCvsPage.tsx` (dòng `141-143`), `CandidatePages.tsx` (dòng `593`, `621`, `637`)
  - Nơi nhận: `HRConnect-FE/src/features/portal/candidate/cv-builder/CandidateCvBuilderPage.tsx` (dòng `228-235`)
- **Nguyên nhân:** Khi bấm **"Xem"** hoặc **"Tải PDF"** trên một CV tạo bằng CV Builder, ứng dụng điều hướng tới `/candidate/cv-builder/${cvId}?action=preview` hoặc `?action=download`, nhưng `CandidateCvBuilderPage.tsx` chỉ đọc `searchParams.get('template')` mà bỏ qua `searchParams.get('action')`.
- **Hướng sửa:** Đọc `searchParams.get('action')` sau khi dữ liệu CV tải xong để tự động mở `CvPreviewModal` (`action === 'preview'`) hoặc gọi hàm xuất PDF (`action === 'download'`).

#### [FE-M04] Công tắc "Đặt làm CV chính" (`isPrimary`) truyền vào `CvTopbar.tsx` nhưng bị bỏ quên không render
- **Vị trí:** `HRConnect-FE/src/features/portal/candidate/cv-builder/CvTopbar.tsx` (dòng `12-13`, `73-90`)
- **Nguyên nhân:** `CandidateCvBuilderPage.tsx:669-670` đã truyền `isPrimary` và `onPrimaryChange` vào `<CvTopbar />`, nhưng `CvTopbar` chưa destructure và chưa hiển thị nút/checkbox chọn làm CV chính trên thanh công cụ.

#### [FE-M05] Chưa cập nhật trạng thái chờ xác minh trùng lặp (`PENDING_IDENTITY_REVIEW`) và thiếu invalidate sau khi xác nhận Consent
- **Vị trí:**
  - `HRConnect-FE/src/features/portal/CandidateSubmissionConsentPage.tsx` (dòng `60-67`, `107`, `114-121`)
  - `HRConnect-FE/src/features/portal/PublicSubmissionConsentPage.tsx` (dòng `41-47`, `96`, `109-121`)
- **Nguyên nhân:** Khi ứng viên bấm `CONFIRM` nhưng hệ thống phát hiện nghi trùng (`respond.data.submissionStatus === 'PENDING_IDENTITY_REVIEW'`), giao diện cần hiển thị rõ trạng thái đang chờ HR Connect xác minh danh tính và invalidate thêm `['candidate-affiliate-cvs']`, `['candidate-duplicate-cases']`.

---

## 🟡 3. MINOR — Tinh chỉnh Thông báo, Bảo mật Log & UI/UX

1. **[BE-m01] `ReportUnauthorizedSubmissionConsentCommandHandler` chưa xoay `ConcurrencyToken` và chưa gửi thông báo cho Affiliate:** Tại `ReportUnauthorizedSubmissionConsentCommand.cs` (dòng `43-67`), bổ sung cập nhật `ConcurrencyToken`, lưu IP/UserAgent và tạo `Notification` báo cho Affiliate khi ứng viên báo cáo không nhận ra hồ sơ.
2. **[BE-m02] Bổ sung đẩy SignalR (`IAppNotifier`) ở 3 điểm:** Khi Affiliate tạo submission cho Candidate đã có tài khoản (`SubmitCandidateCommandHandler.cs:614-629`), khi Admin giải phóng hồ sơ nghi trùng (`FinalizeIdentityReviewedSubmissionService.cs:194-213`), và khi HR bác bỏ từ chối / thay thế CV Sourcing (`SourcingDeliveryFeatures.cs:440-581`).
3. **[BE-m03] Kiểm tra `MergedIntoCandidateId` khi cập nhật hồ sơ Candidate:** Tại `UpdateCandidateProfileCommandHandler.cs` (dòng `33-65`), chặn cập nhật trên bản ghi Candidate đã bị merge.
4. **[BE-m04] Không ghi plaintext Email/Phone vào log cảnh báo:** Tại `SubmitCandidateCommandHandler.cs` (dòng `241-242`), chỉ log `CandidateId` hoặc mask email/phone như `StartCandidateIdentityClaimCommandHandler.cs:180-181`.
5. **[FE-m01] Hiển thị đầy đủ thông tin việc làm & tên CTV trên `PublicSubmissionConsentPage.tsx`:** Tại dòng `157-177`, render thêm `affiliateDisplayName`, `jobLocation`, `workMode`, `salaryMin/Max`, `experienceRequirement` đã có sẵn trong response của `GET /submission-consents/review`.
6. **[FE-m02] Nối nút "Không phải bạn? Báo cho HR Connect" vào API `reportUnauthorized`:** Tại `CandidateSubmissionConsentPage.tsx:270` và `PublicSubmissionConsentPage.tsx:206`, gọi `candidateConsentApi.reportUnauthorized` / `reportUnauthorizedPublic` thay vì dẫn sang trang tĩnh `/contact`.
7. **[FE-m03] Chọn ứng viên dự phòng từ danh sách thay vì nhập tay UUID trong `SourcingDeliveriesView.tsx`:** Tại dòng `809-838`, đổi ô `<Input>` nhập tay UUID sang `<Select>` chọn từ các hồ sơ đạt yêu cầu của Job.
8. **[FE-m04] Tối ưu tải phân trang trên `AffiliateSubmissionsPage`:** Tại `AffiliatePages.tsx:1103-1133`, tránh `readAllPages` tải toàn bộ các trang cùng lúc khi số lượng hồ sơ lớn.

---

## 🟢 4. CLEAN / VERIFIED — Các phần đã chuẩn chỉnh cho Production

- **Bảo mật One-Time Consent Token & Chống Replay/Brute-force:** Token 32 bytes ngẫu nhiên mật mã học, chỉ lưu băm `SHA-256` trong DB, truyền qua request body, gắn Rate Limiting (`submission-consent-public`) và security headers (`Cache-Control: no-store`, `Referrer-Policy: no-referrer`, CSP). Khi resend email, token cũ bị xoay lập tức và kiểm tra chặt cooldown 60s + giới hạn số lần gửi.
- **Kiểm soát quyền truy cập Kho CV của Affiliate (`SubmissionRepository.cs`):** Ràng buộc đủ 5 điều kiện (`AFFILIATE_UPLOAD`, đúng `UploadedByUserId`, `ACTIVE`, `ALLOWED`, và có ít nhất 1 `Submission` đã `ACCEPTED`). Khi Candidate thu hồi quyền (`RevokeAffiliateCvReuseCommand`), mọi CV liên quan bị khóa ngay lập tức.
- **Bảo vệ bằng chứng định danh (`ICandidateIdentityEvidenceProtector`) & Masking PII:** Sử dụng `HMACSHA256` với hỗ trợ xoay khóa (`ActiveKeyVersion`); các API Duplicate Case đều che email/phone và không lộ danh tính Affiliate đối phương.
- **Chống Race Condition & Bồi hoàn lưu trữ R2:** Kết hợp `pg_advisory_xact_lock`, `SELECT ... FOR UPDATE`, unique constraint DB và cơ chế `CompensateUploadAsync` tự động xóa file PDF mồ côi trên Cloudflare R2 nếu transaction DB lỗi.
