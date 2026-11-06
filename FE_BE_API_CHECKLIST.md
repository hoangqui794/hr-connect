# Báo cáo Rà soát & Đối chiếu API Backend – Frontend (Guest & Candidate) & Phân loại theo MF

Tài liệu này tổng hợp toàn bộ trạng thái kết nối API giữa **Backend (`HRConnect`)** và **Frontend (`HRConnect-FE`)** cho 25 màn hình Guest & Candidate theo thiết kế PDF *"HR Connect - Trang chủ Guest và Candidate.pdf"*:
1. **Phần 1:** **Danh sách các API / Trường dữ liệu mà FE đang cần — Phân loại theo từng MF (`MF-01`, `MF-02`, `MF-04`, `SF-06 / BE-04`)** để hỏi đúng thành viên phụ trách Backend.
2. **Phần 2:** Các API Backend **vừa được gắn bổ sung / đồng bộ thêm vào FE & BE** trong đợt rà soát này.
3. **Phần 3:** Bảng tổng hợp đầy đủ 25 màn hình Guest/Candidate **ĐÃ CÓ và ĐÃ GẮN API Backend**.

---

## Phần 1. Danh sách API mà FE đang cần — Phân loại theo từng MF để hỏi đội Backend

### ✅ Nhóm 1: Thuộc phạm vi **MF-01** *(Tạo, duyệt, công bố & khám phá Job — Lưu việc làm)* — **ĐÃ XỬ LÝ XONG**
- **File BE & FE đã cập nhật:**
  - [`CandidateSavedJobEndpoints.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Presentation/Endpoints/V1/Candidates/CandidateSavedJobEndpoints.cs)
  - [`GetCandidateSavedJobsQuery.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Application/Features/Candidates/SavedJobs/Queries/GetCandidateSavedJobs/GetCandidateSavedJobsQuery.cs)
  - [`ICandidateSavedJobRepository.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Application/Common/Interfaces/Repositories/ICandidateSavedJobRepository.cs) & [`CandidateSavedJobRepository.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Infrastructure/Repositories/CandidateSavedJobRepository.cs)
  - [`CandidateSavedJobsTests.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.UnitTests/Features/Candidates/CandidateSavedJobsTests.cs)
  - [`candidateSavedJobs.ts`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/types/api/candidateSavedJobs.ts) & [`CandidateSavedJobsPage.tsx`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/features/candidates/CandidateSavedJobsPage.tsx)
- **Nội dung đã hoàn thành:**
  - Đã bổ sung query param `sortBy` (`SAVED_AT_DESC` | `DEADLINE_ASC`) vào `GET /api/v1/candidates/me/saved-jobs` trên Backend (kèm kiểm tra whitelist `400 Bad Request` và sắp xếp tại DB ưu tiên việc làm đang mở sắp hết hạn ứng tuyển).
  - Đã gắn `sortBy: 'DEADLINE_ASC'` vào `CandidateSavedJobsPage.tsx` khi ứng viên chọn sắp xếp **"Sắp hết hạn"**.

---

### ✅ Nhóm 2: Thuộc phạm vi **MF-02** *(Tiếp nhận hồ sơ, Submission Consent, Email Identity, Đối chiếu trùng / Dedup)* — **ĐÃ XỬ LÝ XONG**
- **File BE & FE đã cập nhật:**
  - [`CandidateEndpoints.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Presentation/Endpoints/V1/Candidates/CandidateEndpoints.cs)
  - [`SubmissionConsentEndpoints.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Presentation/Endpoints/V1/SubmissionConsents/SubmissionConsentEndpoints.cs)
  - [`DecideMyCandidateDuplicateCase.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Application/Features/CandidateDuplicates/Resolve/DecideMyCandidateDuplicateCase.cs) & [`CandidateDuplicateSelfServiceQueries.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Application/Features/CandidateDuplicates/Queries/CandidateDuplicateSelfServiceQueries.cs)
  - [`MakeCandidatePrimaryEmailIdentityCommandHandler.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Application/Features/Candidates/Identity/MakeCandidatePrimaryEmailIdentity/MakeCandidatePrimaryEmailIdentityCommandHandler.cs) & [`GetCandidateEmailIdentitiesQueryHandler.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Application/Features/Candidates/Queries/GetCandidateEmailIdentities/GetCandidateEmailIdentitiesQueryHandler.cs)
  - [`GetSubmissionConsentQuery.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Application/Features/SubmissionConsents/GetSubmissionConsent/GetSubmissionConsentQuery.cs), [`GetSubmissionConsentQueryHandler.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Application/Features/SubmissionConsents/GetSubmissionConsent/GetSubmissionConsentQueryHandler.cs), [`GetCandidateSubmissionConsentsQuery.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Application/Features/Candidates/Queries/GetCandidateSubmissionConsents/GetCandidateSubmissionConsentsQuery.cs) & [`ReportUnauthorizedSubmissionConsentCommand.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Application/Features/SubmissionConsents/ReportUnauthorizedSubmissionConsent/ReportUnauthorizedSubmissionConsentCommand.cs)
  - [`GetCandidateCvsResponse.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Application/Features/Candidates/Queries/GetCandidateCvs/GetCandidateCvsResponse.cs) & [`CandidateCvRepository.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Infrastructure/Repositories/CandidateCvRepository.cs)
  - [`candidateIdentityApi.ts`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/services/api/mf02/candidateIdentityApi.ts), [`candidateConsentApi.ts`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/services/api/mf02/candidateConsentApi.ts), [`CandidateIdentityPage.tsx`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/features/portal/CandidateIdentityPage.tsx) & [`CandidateSubmissionConsentPage.tsx`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/features/portal/CandidateSubmissionConsentPage.tsx)
- **Nội dung đã hoàn thành:**
  1. **[PDF Trang 31] API xử lý đối chiếu hồ sơ trùng cho ứng viên (`dismiss` / `not-me` / `decision`):**
     - Đã bổ sung `POST /api/v1/candidates/me/duplicate-cases/{caseId:guid}/dismiss`, `/not-me` và `/decision` trên Backend, đồng thời trả thêm `concurrencyToken` trong danh sách & chi tiết duplicate case.
  2. **[PDF Trang 22] Đổi Email phụ đã xác minh thành Email đăng nhập chính (`make-primary`):**
     - Đã bật `canMakePrimary = true` cho các email `ALIAS` ở trạng thái `VERIFIED` và bổ sung endpoint `POST /api/v1/candidates/me/email-identities/{emailIdentityId:guid}/make-primary`.
  3. **[PDF Trang 14 & 15] Bổ sung đầy đủ thông tin Job, Mức lương, Địa điểm, Affiliate, PitchText, CvFileSizeBytes & API `report-unauthorized`:**
     - Đã bổ sung các trường tóm tắt Job (`jobLocation`/`workLocation`, `workMode`, `salaryMin`, `salaryMax`, `currencyCode`/`salaryCurrency`, `salaryNegotiable`/`isSalaryNegotiable`, `experienceRequirement`, `affiliateDisplayName`, `affiliateEmail`, `affiliatePhone`, `pitchText`/`candidateConditionSummary`, `cvFileSizeBytes`) vào cả `SubmissionConsentReviewData` và `CandidateSubmissionConsentItem`.
     - Đã bổ sung `POST /api/v1/submission-consents/report-unauthorized` và `POST /api/v1/candidates/me/submission-consents/{submissionId:guid}/report-unauthorized`.
  4. **[PDF Trang 16] Bổ sung `activeApplicationCount` vào DTO Kho CV (`GET /api/v1/candidates/cv/my`):**
     - Đã tính toán và trả về `activeApplicationCount` (số đơn ứng tuyển đang mở sử dụng CV đó) cùng với `applicationUsageCount` và `submissionUsageCount`.

---

### 🟩 Nhóm 3: Thuộc phạm vi **MF-04** *(Vòng đời Application, Lịch phỏng vấn, Offer, Hồ sơ cá nhân Candidate Profile)* — **CẦN HỎI DEV MF-04**
- **File BE liên quan:**
  - [`InterviewEndpoints.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Presentation/Endpoints/V1/Recruitment/InterviewEndpoints.cs)
  - [`CandidateEndpoints.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Presentation/Endpoints/V1/Candidates/CandidateEndpoints.cs) (`/api/v1/candidates/profile/me`)
- **Vấn đề cần hỏi dev MF-04 (Gồm 2 mục):**

  1. **[PDF Trang 11] Ứng viên Báo bận / Đề xuất dời lịch phỏng vấn (`/candidate/interviews/:interviewId`):**
     - **Hiện trạng:** `InterviewEndpoints.cs` mới chỉ có `POST /api/v1/interviews/{interviewId:guid}/candidate-confirm` (chỉ xác nhận tham gia `CONFIRMED`). Còn `PUT /reschedule` và `PATCH /cancel` chỉ cho phép `CLIENT_COMPANY_USER` (`interview.update`). Chưa có API cho `CANDIDATE` báo bận hoặc gửi yêu cầu xin đổi lịch phỏng vấn.
     - **API đề xuất:** Mở rộng hoặc thêm `POST /api/v1/interviews/{interviewId:guid}/candidate-reschedule-request` với body `{ "reason": "...", "proposedTimes": ["..."], "concurrencyToken": "..." }`.

  2. **[PDF Trang 18] Lưu danh sách nhiều mục Học vấn, Kinh nghiệm, Dự án, Chứng chỉ trong Hồ sơ cá nhân (`/candidate/profile`):**
     - **Hiện trạng:** `GET/PUT /api/v1/candidates/profile/me` đã lưu đầy đủ thông tin cá nhân, 9 trường nghề nghiệp (`targetRole`, `currentLevel`, `expectedSalaryMin/Max`, `preferredLocations[]`, `preferredWorkModes[]`, ...) và bảng `skills[]` (`/candidates/profile/me/skills`). Tuy nhiên, học vấn chỉ có 1 trường chuỗi `highestEducation` và kinh nghiệm chỉ có 1 trường số `yearsOfExperience` — chưa có mảng `educations[]`, `experiences[]`, `projects[]`, `certificates[]` ở cấp Candidate Profile (các mảng này hiện chỉ lưu trong từng bản CV của CV Builder).
     - **Câu hỏi chốt với dev MF-04:** Có cần mở rộng `GET/PUT /api/v1/candidates/profile/me` thêm JSONB/bảng con cho `educations[]`, `experiences[]`, `certificates[]` để đồng bộ với CV Builder không, hay giữ nguyên thiết kế hiện tại (Profile lưu tổng quan + Kỹ năng, còn chi tiết từng giai đoạn lưu trong CV Builder)?

---

### ✅ Nhóm 4: Thuộc phạm vi **SF-06 / BE-04** *(Trình tạo CV có cấu trúc `CvBuilderFeatures` & SkiaSharp PDF Renderer)* — **ĐÃ XỬ LÝ XONG**
- **File BE & Test đã cập nhật:**
  - [`CvBuilderFeatures.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Application/Features/Candidates/CvBuilder/CvBuilderFeatures.cs)
  - [`StructuredCvService.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Infrastructure/Services/CvBuilder/StructuredCvService.cs)
  - [`CvBuilderTests.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.UnitTests/Features/Candidates/CvBuilderTests.cs)
- **Nội dung đã hoàn thành:**
  - Đã bổ sung trường `string? AvatarDataUrl = null` vào record `CvPresentation` trong `CvBuilderFeatures.cs` và cập nhật `CvBuilderHandlers.Validate()` để bảo toàn ảnh chân dung riêng của từng bản CV khi lưu/tải lại từ DB.
  - Đã cập nhật `StructuredCvService.LoadAvatarAsync()` để giải mã trực tiếp `data:image/...;base64,...` từ `AvatarDataUrl` của bản CV và truyền `avatarBytes` sang `CvPdfRenderer.Render()` vẽ lên file PDF xuất bản (fallback sang ảnh tài khoản trên R2 nếu `AvatarDataUrl` trống).

---

## Phần 2. Các API Backend vừa được nâng cấp & gắn bổ sung vào Frontend

| # | Màn hình (PDF) | Module | Endpoint Backend | File đã cập nhật | Nội dung tích hợp |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **1** | **Việc làm đã lưu** (Trang 19) | **MF-01** | `GET /api/v1/candidates/me/saved-jobs?sortBy=SAVED_AT_DESC\|DEADLINE_ASC` | - [`CandidateSavedJobEndpoints.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Presentation/Endpoints/V1/Candidates/CandidateSavedJobEndpoints.cs)<br/>- [`GetCandidateSavedJobsQuery.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Application/Features/Candidates/SavedJobs/Queries/GetCandidateSavedJobs/GetCandidateSavedJobsQuery.cs)<br/>- [`CandidateSavedJobRepository.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Infrastructure/Repositories/CandidateSavedJobRepository.cs)<br/>- [`CandidateSavedJobsPage.tsx`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/features/candidates/CandidateSavedJobsPage.tsx) | Bổ sung `sortBy=SAVED_AT_DESC\|DEADLINE_ASC` trên cả Backend và Frontend để sắp xếp việc đã lưu theo hạn nộp ngay tại Database. |
| **2** | **Trình tạo CV – Lưu ảnh chân dung & Render PDF** (Trang 20, 24, 25) | **SF-06 / BE-04** | `POST/PUT/GET /api/v1/candidates/cv/structured`<br/>`GET /api/v1/candidates/profile/me`<br/>`GET /api/v1/candidates/cv/{cvId}/download-url` | - [`CvBuilderFeatures.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Application/Features/Candidates/CvBuilder/CvBuilderFeatures.cs)<br/>- [`StructuredCvService.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Infrastructure/Services/CvBuilder/StructuredCvService.cs)<br/>- [`CandidateCvBuilderPage.tsx`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/features/portal/candidate/cv-builder/CandidateCvBuilderPage.tsx)<br/>- [`cvBuilderApi.ts`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/services/api/cvBuilderApi.ts) | - Bổ sung `AvatarDataUrl` vào `CvPresentation` trên BE và decode base64 trong `StructuredCvService` để vẽ ảnh lên file PDF xuất bản.<br/>- Tự động gọi `mf04Api.getProfile()` điền sẵn hồ sơ vào CV mới.<br/>- Nút **Tải PDF** ưu tiên lấy signed URL từ `GET /api/v1/candidates/cv/{cvId}/download-url`. |
| **3** | **Hồ sơ đang đối chiếu danh tính** (Trang 31) | **MF-02** | `GET /api/v1/candidates/me/duplicate-cases`<br/>`GET /api/v1/candidates/me/duplicate-cases/{caseId}` | - [`candidateIdentity.ts`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/types/api/mf02/candidateIdentity.ts)<br/>- [`candidateIdentityApi.ts`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/services/api/mf02/candidateIdentityApi.ts)<br/>- [`CandidateIdentityPage.tsx`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/features/portal/CandidateIdentityPage.tsx) | Bổ sung `listDuplicateCases` và `getDuplicateCaseDetail`, tự động gọi `useQuery` ở tab *"Hồ sơ đang đối chiếu"* để hiển thị danh sách case trùng thực tế từ BE (`title`, `guidance`, `status`, `evidenceTypes`, `job`). |
| **4** | **Dịch vụ tuyển dụng** (Trang 26) | **MF-01** | `GET /api/v1/service-types?isActive=true` | - [`ServicesPage.tsx`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/features/services/ServicesPage.tsx) | Kết nối `GET /api/v1/service-types?isActive=true` để đồng bộ trạng thái hoạt động (`isActive`) của 3 gói dịch vụ (`CV_APPLICATION`, `HEADHUNT_COD`, `CV_SOURCING`). |

---

## Phần 3. Tổng hợp 25 Màn hình Guest & Candidate ĐÃ CÓ & ĐÃ GẮN API Backend

| Trang PDF | Tên màn hình | MF sở hữu | Route FE | File FE chính | Endpoint Backend đang sử dụng |
| :---: | :--- | :---: | :--- | :--- | :--- |
| **1, 28** | Trang chủ (Guest & Candidate) | **MF-01** | `/` | `HomePage.tsx` | - `GET /api/v1/jobs`<br/>- `GET /api/v1/companies`<br/>- `GET /api/v1/candidates/me/saved-jobs` |
| **2, 12** | Tìm kiếm việc làm & Điểm phù hợp | **MF-01 / MF-03** | `/jobs` | `JobListingPage.tsx` | - `GET /api/v1/jobs`<br/>- `POST /api/v1/candidates/me/job-matches`<br/>- `POST/DELETE /api/v1/candidates/me/saved-jobs/{jobId}` |
| **3, 13** | Chi tiết việc làm & Nộp hồ sơ ứng tuyển | **MF-01 / MF-02 / MF-03** | `/jobs/:id` | `JobDetailPage.tsx` | - `GET /api/v1/jobs/{id}`<br/>- `GET /api/v1/candidates/me/job-matches/{jobId}`<br/>- `GET /api/v1/candidates/cv/my`<br/>- `POST /api/v1/candidates/jobs/{jobId}/apply`<br/>- `POST/DELETE /api/v1/candidates/me/saved-jobs/{jobId}` |
| **4, 29** | Danh sách công ty | **BE-02 / MF-01** | `/companies` | `CompanyListingPage.tsx` | - `GET /api/v1/companies` |
| **5, 30** | Chi tiết công ty | **BE-02 / MF-01** | `/companies/:id` | `CompanyDetailPage.tsx` | - `GET /api/v1/companies/{companyId}`<br/>- `GET /api/v1/companies/{companyId}/jobs` |
| **6, 23** | Đăng nhập & Quên mật khẩu | **Auth** | `/login`<br/>`/forgot-password`<br/>`/reset-password` | `LoginPage.tsx`<br/>`ForgotPasswordPage.tsx`<br/>`ResetPasswordPage.tsx` | - `POST /api/v1/auth/login`<br/>- `POST /api/v1/auth/google`<br/>- `POST /api/v1/auth/forgot-password`<br/>- `POST /api/v1/auth/reset-password` |
| **7, 17** | Đăng ký ứng viên & Xác thực OTP | **Auth** | `/register`<br/>`/verify-otp` | `RegisterPage.tsx`<br/>`VerifyOtpPage.tsx` | - `POST /api/v1/auth/register`<br/>- `POST /api/v1/auth/verify-otp`<br/>- `POST /api/v1/auth/resend-otp` |
| **8** | Bảng điều khiển / Đơn ứng tuyển của tôi | **MF-02 / MF-03 / MF-04** | `/candidate/applications`<br/>`/candidate/dashboard` | `CandidateApplicationsPage.tsx`<br/>`CandidateDashboardPage.tsx` | - `GET /api/v1/candidates/applications/my`<br/>- `GET /api/v1/interviews`<br/>- `GET /api/v1/offers`<br/>- `GET /api/v1/notifications` |
| **9, 10** | Chi tiết đơn ứng tuyển (Timeline & Rút đơn) | **MF-04** | `/candidate/applications/:applicationId` | `CandidateApplicationDetailPage.tsx` | - `GET /api/v1/recruitment/applications/{id}`<br/>- `GET /api/v1/recruitment/applications/{id}/timeline`<br/>- `GET /api/v1/recruitment/applications/{id}/cv/download-url`<br/>- `POST /api/v1/recruitment/applications/{id}/withdraw` |
| **11** | Chi tiết lịch phỏng vấn | **MF-04** | `/candidate/interviews/:interviewId` | `CandidateInterviewDetailPage.tsx`<br/>`CandidateInterviewDetailView.tsx` | - `GET /api/v1/interviews/{interviewId}`<br/>- `POST /api/v1/interviews/{interviewId}/candidate-confirm`<br/>- `GET /api/v1/recruitment/applications/{id}` |
| **12 (Offer)** | Xem & Phản hồi thư mời nhận việc (Offer) | **MF-04** | `/candidate/offers/:offerId` | `CandidateOfferPage.tsx` | - `GET /api/v1/offers/{offerId}`<br/>- `GET /api/v1/offers/{offerId}/acceptance-impact`<br/>- `POST /api/v1/offers/{offerId}/response` |
| **14** | Xác nhận lời giới thiệu (Đã đăng nhập) | **MF-02** | `/candidate/submission-consents/:submissionId` | `CandidateSubmissionConsentPage.tsx` | - `GET /api/v1/candidates/me/submission-consents/{submissionId}`<br/>- `POST /api/v1/candidates/me/submission-consents/{submissionId}/approve`<br/>- `POST /api/v1/candidates/me/submission-consents/{submissionId}/reject` |
| **15** | Xác nhận lời giới thiệu qua Email Token (Guest) | **MF-02** | `/submission-consent#token=...` | `PublicSubmissionConsentPage.tsx` | - `POST /api/v1/submission-consents/review`<br/>- `POST /api/v1/submission-consents/approve`<br/>- `POST /api/v1/submission-consents/reject` |
| **16** | Kho CV của tôi (Upload, Đặt CV chính, Xóa, Tải) | **MF-02** | `/candidate/cvs` | `CandidateCvsPage.tsx` | - `GET /api/v1/candidates/cv/my`<br/>- `POST /api/v1/candidates/cv`<br/>- `PATCH /api/v1/candidates/cv/{cvId}/primary`<br/>- `DELETE /api/v1/candidates/cv/{cvId}`<br/>- `GET /api/v1/candidates/cv/{cvId}/download-url` |
| **18** | Hồ sơ cá nhân & Kỹ năng | **MF-04** | `/candidate/profile` | `CandidateProfilePage.tsx` | - `GET /api/v1/candidates/profile/me`<br/>- `PUT /api/v1/candidates/profile/me`<br/>- `PATCH /api/v1/candidates/profile/me/visibility`<br/>- `GET/POST/PUT/DELETE /api/v1/candidates/profile/me/skills`<br/>- `POST /api/v1/users/me/avatar` |
| **19** | Việc làm đã lưu | **MF-01** | `/candidate/saved-jobs` | `CandidateSavedJobsPage.tsx` | - `GET /api/v1/candidates/me/saved-jobs?sortBy=SAVED_AT_DESC\|DEADLINE_ASC`<br/>- `POST /api/v1/candidates/me/saved-jobs/{jobId}`<br/>- `DELETE /api/v1/candidates/me/saved-jobs/{jobId}` |
| **20, 24, 25** | Tạo CV – Chọn mẫu, Soạn thảo & Xem trước A4 | **SF-06 (BE-04)** | `/candidate/cv-builder`<br/>`/candidate/cv-builder/:cvId` | `CandidateCvBuilderPage.tsx`<br/>`CvTemplateGalleryView.tsx` | - `GET /api/v1/cv-templates`<br/>- `POST /api/v1/candidates/cv/structured`<br/>- `GET /api/v1/candidates/cv/structured/{cvId}`<br/>- `PUT /api/v1/candidates/cv/structured/{cvId}`<br/>- `GET /api/v1/candidates/profile/me`<br/>- `GET /api/v1/candidates/cv/{cvId}/download-url` |
| **21, 32** | CV đối tác gửi kèm giới thiệu & Xem chi tiết PDF | **MF-02** | `/candidate/affiliate-cvs`<br/>`/candidate/affiliate-cvs/:cvId` | `CandidateAffiliateCvsPage.tsx` | - `GET /api/v1/candidates/me/affiliate-cvs`<br/>- `GET /api/v1/candidates/me/affiliate-cvs/{cvId}`<br/>- `GET /api/v1/candidates/me/affiliate-cvs/{cvId}/usages`<br/>- `GET /api/v1/candidates/me/affiliate-cvs/{cvId}/download-url`<br/>- `POST /api/v1/candidates/me/affiliate-cvs/{cvId}/adopt` |
| **22, 31** | Cài đặt email đăng nhập & Hồ sơ đang đối chiếu | **MF-02** | `/candidate/settings/email-identities` | `CandidateIdentityPage.tsx` | - `GET /api/v1/candidates/me/email-identities`<br/>- `POST /api/v1/candidates/me/email-identities/{id}/revoke`<br/>- `POST /api/v1/candidates/me/identity-claims`<br/>- `POST /api/v1/candidates/me/identity-claims/{claimId}/resend`<br/>- `POST /api/v1/candidates/me/identity-claims/{claimId}/verify`<br/>- `GET /api/v1/candidates/me/duplicate-cases` |
| **26** | Dịch vụ tuyển dụng của HR Connect | **MF-01** | `/services` | `ServicesPage.tsx` | - `GET /api/v1/service-types?isActive=true` |
| **27** | Liên hệ & Nhận tư vấn dịch vụ | **SF-05 (BE-04)** | `/contact` | `ContactPage.tsx`<br/>`ContactConsultationForm.tsx` | - `POST /api/v1/contact-requests` |
