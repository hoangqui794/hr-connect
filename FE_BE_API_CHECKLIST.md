# Báo cáo Rà soát & Đối chiếu API Backend – Frontend (Guest & Candidate)

Tài liệu này tổng hợp toàn bộ trạng thái kết nối API giữa **Backend (`HRConnect`)** và **Frontend (`HRConnect-FE`)** cho 25 màn hình Guest & Candidate theo thiết kế PDF *"HR Connect - Trang chủ Guest và Candidate.pdf"*:
1. **Phần 1:** Các API Backend **vừa được gắn bổ sung / đồng bộ thêm vào FE** trong đợt rà soát này.
2. **Phần 2:** Bảng tổng hợp đầy đủ các trang & tính năng Guest/Candidate **ĐÃ CÓ và ĐÃ GẮN API Backend**.
3. **Phần 3:** Danh sách chi tiết các tính năng / nút bấm / trường dữ liệu trên FE **CHƯA CÓ API Backend** (hoặc thiếu trường trong DTO) cần đội Backend bổ sung.

---

## Phần 1. Các API Backend vừa được gắn bổ sung vào Frontend

| # | Màn hình (PDF) | Endpoint Backend đã có | File Frontend vừa gắn | Nội dung tích hợp |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Hồ sơ đang đối chiếu danh tính** (Trang 31) | `GET /api/v1/candidates/me/duplicate-cases`<br/>`GET /api/v1/candidates/me/duplicate-cases/{caseId}` | - [`candidateIdentity.ts`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/types/api/mf02/candidateIdentity.ts)<br/>- [`candidateIdentityApi.ts`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/services/api/mf02/candidateIdentityApi.ts)<br/>- [`CandidateIdentityPage.tsx`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/features/portal/CandidateIdentityPage.tsx) | Bổ sung `listDuplicateCases` và `getDuplicateCaseDetail`, tự động gọi `useQuery` ở tab *"Hồ sơ đang đối chiếu"* để hiển thị danh sách case trùng thực tế từ BE (`title`, `guidance`, `status`, `evidenceTypes`, `job`), đồng bộ số lượng badge trên tab và tự động invalidate sau khi xác minh OTP. |
| **2** | **Trình tạo CV – Chọn mẫu & Soạn thảo** (Trang 20, 24, 25) | `GET /api/v1/candidates/profile/me`<br/>`GET /api/v1/candidates/cv/{cvId}/download-url`<br/>`GET/POST/PUT /api/v1/candidates/cv/structured` | - [`CandidateCvBuilderPage.tsx`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/features/portal/candidate/cv-builder/CandidateCvBuilderPage.tsx)<br/>- [`cvBuilderApi.ts`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/services/api/cvBuilderApi.ts) | - Tự động gọi `mf04Api.getProfile()` khi tạo CV mới (`mode === 'create'`) để điền sẵn `fullName`, `headline` (`targetRole`/`currentJobTitle`), `email`, `phone`, `address`, `summary`, `skills` đúng mô tả *"Thông tin trong hồ sơ của bạn được điền sẵn vào mẫu"*.<br/>- Nút **Tải PDF** trên thanh công cụ ưu tiên lấy signed URL từ `GET /api/v1/candidates/cv/{cvId}/download-url` (PDF do BE render chuẩn ATS) trước khi fallback sang `window.print()`.<br/>- Chuẩn hóa mapping `content <-> structuredContent` trong `cvBuilderApi.ts` khớp với `StructuredCvDto.Content` của C#. |
| **3** | **Dịch vụ tuyển dụng** (Trang 26) | `GET /api/v1/service-types?isActive=true` | - [`ServicesPage.tsx`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/features/services/ServicesPage.tsx) | Kết nối `GET /api/v1/service-types?isActive=true` để đồng bộ trạng thái hoạt động (`isActive`) của 3 gói dịch vụ (`CV_APPLICATION`, `HEADHUNT_COD`, `CV_SOURCING`) từ DB. |

---

## Phần 2. Tổng hợp các Màn hình Guest & Candidate ĐÃ CÓ & ĐÃ GẮN API Backend

| Trang PDF | Tên màn hình | Route FE | File FE chính | Endpoint Backend đang sử dụng | File Endpoint BE |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1, 28** | Trang chủ (Guest & Candidate) | `/` | `HomePage.tsx` | - `GET /api/v1/jobs`<br/>- `GET /api/v1/companies`<br/>- `GET /api/v1/candidates/me/saved-jobs` | `JobEndpoints.cs`<br/>`CompanyDirectoryEndpoints.cs`<br/>`CandidateSavedJobEndpoints.cs` |
| **2, 12** | Tìm kiếm việc làm & Điểm phù hợp | `/jobs` | `JobListingPage.tsx` | - `GET /api/v1/jobs`<br/>- `POST /api/v1/candidates/me/job-matches`<br/>- `POST/DELETE /api/v1/candidates/me/saved-jobs/{jobId}` | `JobEndpoints.cs`<br/>`JobMatchEndpoints.cs`<br/>`CandidateSavedJobEndpoints.cs` |
| **3, 13** | Chi tiết việc làm & Nộp hồ sơ ứng tuyển | `/jobs/:id` | `JobDetailPage.tsx` | - `GET /api/v1/jobs/{id}`<br/>- `GET /api/v1/candidates/me/job-matches/{jobId}`<br/>- `GET /api/v1/candidates/cv/my`<br/>- `POST /api/v1/candidates/jobs/{jobId}/apply`<br/>- `POST/DELETE /api/v1/candidates/me/saved-jobs/{jobId}` | `JobEndpoints.cs`<br/>`JobMatchEndpoints.cs`<br/>`CandidateEndpoints.cs`<br/>`CandidateSavedJobEndpoints.cs` |
| **4, 29** | Danh sách công ty | `/companies` | `CompanyListingPage.tsx` | - `GET /api/v1/companies` | `CompanyDirectoryEndpoints.cs` |
| **5, 30** | Chi tiết công ty | `/companies/:id` | `CompanyDetailPage.tsx` | - `GET /api/v1/companies/{companyId}`<br/>- `GET /api/v1/companies/{companyId}/jobs` | `CompanyDirectoryEndpoints.cs` |
| **6, 23** | Đăng nhập & Quên mật khẩu | `/login`<br/>`/forgot-password`<br/>`/reset-password` | `LoginPage.tsx`<br/>`ForgotPasswordPage.tsx`<br/>`ResetPasswordPage.tsx` | - `POST /api/v1/auth/login`<br/>- `POST /api/v1/auth/google`<br/>- `POST /api/v1/auth/forgot-password`<br/>- `POST /api/v1/auth/reset-password` | `AuthEndpoints.cs` |
| **7, 17** | Đăng ký ứng viên & Xác thực OTP | `/register`<br/>`/verify-otp` | `RegisterPage.tsx`<br/>`VerifyOtpPage.tsx` | - `POST /api/v1/auth/register`<br/>- `POST /api/v1/auth/verify-otp`<br/>- `POST /api/v1/auth/resend-otp` | `AuthEndpoints.cs` |
| **8** | Bảng điều khiển / Đơn ứng tuyển của tôi | `/candidate/applications`<br/>`/candidate/dashboard` | `CandidateApplicationsPage.tsx`<br/>`CandidateDashboardPage.tsx` | - `GET /api/v1/candidates/applications/my`<br/>- `GET /api/v1/interviews`<br/>- `GET /api/v1/offers`<br/>- `GET /api/v1/notifications` | `CandidateEndpoints.cs`<br/>`InterviewEndpoints.cs`<br/>`OfferEndpoints.cs`<br/>`NotificationEndpoints.cs` |
| **9, 10** | Chi tiết đơn ứng tuyển (Timeline & Rút đơn) | `/candidate/applications/:applicationId` | `CandidateApplicationDetailPage.tsx` | - `GET /api/v1/recruitment/applications/{id}`<br/>- `GET /api/v1/recruitment/applications/{id}/timeline`<br/>- `GET /api/v1/recruitment/applications/{id}/cv/download-url`<br/>- `POST /api/v1/recruitment/applications/{id}/withdraw` | `RecruitmentEndpoints.cs` |
| **11** | Chi tiết lịch phỏng vấn | `/candidate/interviews/:interviewId` | `CandidateInterviewDetailPage.tsx`<br/>`CandidateInterviewDetailView.tsx` | - `GET /api/v1/interviews/{interviewId}`<br/>- `POST /api/v1/interviews/{interviewId}/candidate-confirm`<br/>- `GET /api/v1/recruitment/applications/{id}` | `InterviewEndpoints.cs`<br/>`RecruitmentEndpoints.cs` |
| **12 (Offer)** | Xem & Phản hồi thư mời nhận việc (Offer) | `/candidate/offers/:offerId` | `CandidateOfferPage.tsx` | - `GET /api/v1/offers/{offerId}`<br/>- `GET /api/v1/offers/{offerId}/acceptance-impact`<br/>- `POST /api/v1/offers/{offerId}/response` | `OfferEndpoints.cs` |
| **14** | Xác nhận lời giới thiệu (Đã đăng nhập) | `/candidate/submission-consents/:submissionId` | `CandidateSubmissionConsentPage.tsx` | - `GET /api/v1/candidates/me/submission-consents/{submissionId}`<br/>- `POST /api/v1/candidates/me/submission-consents/{submissionId}/approve`<br/>- `POST /api/v1/candidates/me/submission-consents/{submissionId}/reject` | `SubmissionConsentEndpoints.cs` |
| **15** | Xác nhận lời giới thiệu qua Email Token (Guest) | `/submission-consent#token=...` | `PublicSubmissionConsentPage.tsx` | - `POST /api/v1/submission-consents/review`<br/>- `POST /api/v1/submission-consents/approve`<br/>- `POST /api/v1/submission-consents/reject` | `SubmissionConsentEndpoints.cs` |
| **16** | Kho CV của tôi (Upload, Đặt CV chính, Xóa, Tải) | `/candidate/cvs` | `CandidateCvsPage.tsx` | - `GET /api/v1/candidates/cv/my`<br/>- `POST /api/v1/candidates/cv`<br/>- `PATCH /api/v1/candidates/cv/{cvId}/primary`<br/>- `DELETE /api/v1/candidates/cv/{cvId}`<br/>- `GET /api/v1/candidates/cv/{cvId}/download-url` | `CandidateEndpoints.cs` |
| **18** | Hồ sơ cá nhân & Kỹ năng | `/candidate/profile` | `CandidateProfilePage.tsx` | - `GET /api/v1/candidates/profile/me`<br/>- `PUT /api/v1/candidates/profile/me`<br/>- `PATCH /api/v1/candidates/profile/me/visibility`<br/>- `GET/POST/PUT/DELETE /api/v1/candidates/profile/me/skills`<br/>- `POST /api/v1/users/me/avatar` | `CandidateEndpoints.cs`<br/>`CandidateSkillEndpoints.cs`<br/>`UserEndpoints.cs` |
| **19** | Việc làm đã lưu | `/candidate/saved-jobs` | `CandidateSavedJobsPage.tsx` | - `GET /api/v1/candidates/me/saved-jobs`<br/>- `POST /api/v1/candidates/me/saved-jobs/{jobId}`<br/>- `DELETE /api/v1/candidates/me/saved-jobs/{jobId}` | `CandidateSavedJobEndpoints.cs` |
| **20, 24, 25** | Tạo CV – Chọn mẫu, Soạn thảo & Xem trước A4 | `/candidate/cv-builder`<br/>`/candidate/cv-builder/:cvId` | `CandidateCvBuilderPage.tsx`<br/>`CvTemplateGalleryView.tsx` | - `GET /api/v1/cv-templates`<br/>- `POST /api/v1/candidates/cv/structured`<br/>- `GET /api/v1/candidates/cv/structured/{cvId}`<br/>- `PUT /api/v1/candidates/cv/structured/{cvId}`<br/>- `GET /api/v1/candidates/profile/me`<br/>- `GET /api/v1/candidates/cv/{cvId}/download-url`<br/>- `POST /api/v1/users/me/avatar` | `CvBuilderEndpoints.cs`<br/>`CandidateEndpoints.cs`<br/>`UserEndpoints.cs` |
| **21, 32** | CV đối tác gửi kèm giới thiệu & Xem chi tiết PDF | `/candidate/affiliate-cvs`<br/>`/candidate/affiliate-cvs/:cvId` | `CandidateAffiliateCvsPage.tsx` | - `GET /api/v1/candidates/me/affiliate-cvs`<br/>- `GET /api/v1/candidates/me/affiliate-cvs/{cvId}`<br/>- `GET /api/v1/candidates/me/affiliate-cvs/{cvId}/usages`<br/>- `GET /api/v1/candidates/me/affiliate-cvs/{cvId}/download-url`<br/>- `POST /api/v1/candidates/me/affiliate-cvs/{cvId}/adopt` | `CandidateEndpoints.cs` |
| **22, 31** | Cài đặt email đăng nhập & Hồ sơ đang đối chiếu | `/candidate/settings/email-identities` | `CandidateIdentityPage.tsx` | - `GET /api/v1/candidates/me/email-identities`<br/>- `POST /api/v1/candidates/me/email-identities/{id}/revoke`<br/>- `POST /api/v1/candidates/me/identity-claims`<br/>- `POST /api/v1/candidates/me/identity-claims/{claimId}/resend`<br/>- `POST /api/v1/candidates/me/identity-claims/{claimId}/verify`<br/>- `GET /api/v1/candidates/me/duplicate-cases` | `CandidateEndpoints.cs` |
| **26** | Dịch vụ tuyển dụng của HR Connect | `/services` | `ServicesPage.tsx` | - `GET /api/v1/service-types?isActive=true` | `ServiceTypeEndpoints.cs` |
| **27** | Liên hệ & Nhận tư vấn dịch vụ | `/contact` | `ContactPage.tsx`<br/>`ContactConsultationForm.tsx` | - `POST /api/v1/contact-requests` | `ContactRequestEndpoints.cs` |

---

## Phần 3. Danh sách các tính năng / trường dữ liệu trên FE CHƯA CÓ API Backend (Cần BE bổ sung)

Dưới đây là **7 điểm khuyết API hoặc thiếu trường DTO trên Backend** được phát hiện khi đối chiếu từng nút bấm và trường thông tin trên thiết kế PDF với source code Backend (`HRConnect`):

### 1. Nút `"Đây không phải tôi"` trong màn Hồ sơ đang đối chiếu (PDF Trang 31)
- **Màn hình FE:** `/candidate/settings/email-identities?tab=reconciliation` ([`CandidateIdentityPage.tsx`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/features/portal/CandidateIdentityPage.tsx))
- **Hiện trạng BE:**
  - BE đã có `GET /api/v1/candidates/me/duplicate-cases` và `GET /api/v1/candidates/me/duplicate-cases/{caseId}` (chỉ đọc).
  - Các API xử lý duplicate case (`dismiss`, `merge`) hiện chỉ nằm ở `/api/v1/admin/candidate-duplicates/...` dành cho `PLATFORM_ADMIN`.
  - **Chưa có API** để chính ứng viên bấm **"Đây không phải tôi"** nhằm từ chối hồ sơ nghi trùng ở trạng thái `AWAITING_CANDIDATE`.
- **Xử lý tạm trên FE:** Đóng yêu cầu OTP tạm ở `sessionStorage` hoặc điều hướng sang `/contact?topic=DATA_PRIVACY` đối với duplicate case từ server.
- **Đề xuất API BE cần thêm:**
  - `POST /api/v1/candidates/me/duplicate-cases/{caseId:guid}/dismiss`
  - **Body:** `{ "reason": "Ứng viên xác nhận không phải hồ sơ của mình", "concurrencyToken": "..." }`
  - **Response:** Cập nhật trạng thái duplicate case sang `DISMISSED` (hoặc `UNDER_REVIEW` kèm cờ `candidateDenied = true` để Admin kiểm tra).

---

### 2. Chuyển đổi Email phụ đã xác minh thành Email đăng nhập chính (PDF Trang 22)
- **Màn hình FE:** `/candidate/settings/email-identities` ([`CandidateIdentityPage.tsx`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/features/portal/CandidateIdentityPage.tsx))
- **Hiện trạng BE:**
  - Trong `GetCandidateEmailIdentitiesQueryHandler`, trường `canMakePrimary` trong `CandidateEmailIdentityDto` luôn trả về `false`.
  - Trong `CandidateEndpoints.cs` mới có `POST /api/v1/candidates/me/email-identities/{emailIdentityId:guid}/revoke`, **chưa có** endpoint đổi email phụ (`ALIAS` đã `VERIFIED`) thành `PRIMARY`.
- **Đề xuất API BE cần thêm:**
  - `POST /api/v1/candidates/me/email-identities/{emailIdentityId:guid}/make-primary`
  - **Body:** `{ "concurrencyToken": "..." }`

---

### 3. Thiếu thông tin tóm tắt Job (`location`, `salary`, `experience`) & API báo cáo vi phạm dữ liệu trên trang Xác nhận lời giới thiệu (PDF Trang 14 & 15)
- **Màn hình FE:**
  - `/candidate/submission-consents/:submissionId` ([`CandidateSubmissionConsentPage.tsx`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/features/portal/CandidateSubmissionConsentPage.tsx))
  - `/submission-consent#token=...` ([`PublicSubmissionConsentPage.tsx`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/features/portal/PublicSubmissionConsentPage.tsx))
- **Hiện trạng BE:**
  - DTO `SubmissionConsentReviewResponse` (`SubmissionConsentDtos.cs`) hiện chỉ trả về: `submissionId`, `jobId`, `jobTitle`, `companyName`, `candidateName`, `cvFileName`, `cvDownloadUrl`, `status`, `affiliateReuseStatus`, `expiresAt`, `respondedAt`, `decisionNote`.
  - **Thiếu các trường hiển thị trên thẻ vị trí của PDF Trang 14–15:**
    - `jobLocation` (ví dụ: `"Quận 1, TP. Hồ Chí Minh · Làm tại văn phòng"`)
    - `salaryMin`, `salaryMax`, `currencyCode`, `salaryNegotiable` (ví dụ: `"30 – 45 triệu VND (Gross)"`)
    - `experienceRequirement` (ví dụ: `"Yêu cầu 3+ năm .NET"`)
    - `affiliateDisplayName` (tên đối tác tuyển dụng giới thiệu để hiển thị trên dòng *"một đối tác tuyển dụng trên HR Connect đã giới thiệu bạn..."*)
  - Ngoài ra, nút/link ***"Không phải bạn? Báo cho HR Connect"*** ở chân trang PDF 14 & 15 hiện đang dẫn sang `/contact?topic=DATA_PRIVACY` vì BE chưa có endpoint report trực tiếp từ token.
- **Đề xuất BE cần bổ sung:**
  1. Bổ sung `jobLocation`, `workMode`, `salaryMin`, `salaryMax`, `currencyCode`, `salaryNegotiable`, `experienceRequirement`, `affiliateDisplayName` vào `SubmissionConsentReviewResponse`.
  2. (Tùy chọn) Thêm `POST /api/v1/submission-consents/report-unauthorized` (`{ token, note }`) để tự động khóa token & tạo ticket vi phạm Nghị định 13/2023/NĐ-CP.

---

### 4. Ứng viên Báo bận / Đề xuất dời lịch phỏng vấn (PDF Trang 11)
- **Màn hình FE:** `/candidate/interviews/:interviewId` ([`CandidateInterviewDetailView.tsx`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/features/portal/candidate/CandidateInterviewDetailView.tsx))
- **Hiện trạng BE:**
  - `InterviewEndpoints.cs` đã có `POST /api/v1/interviews/{interviewId:guid}/candidate-confirm` (`ConfirmInterviewAttendanceCommand` - chỉ nhận xác nhận tham gia `CONFIRMED`).
  - Hai endpoint `PUT /api/v1/interviews/{interviewId:guid}/reschedule` và `PATCH /api/v1/interviews/{interviewId:guid}/cancel` hiện chỉ phân quyền cho `CLIENT_COMPANY_USER` (`interview.update`).
  - **Chưa có API** cho phép `CANDIDATE` gửi phản hồi **xin dời lịch / báo không thể tham gia** kèm lý do và khung giờ đề xuất.
- **Đề xuất API BE cần thêm:**
  - `POST /api/v1/interviews/{interviewId:guid}/candidate-reschedule-request` (hoặc mở rộng `candidate-confirm` thành `candidate-response` nhận `response: "CONFIRMED" | "RESCHEDULE_REQUESTED" | "DECLINED"`, `reason`, `proposedTimes[]`, `concurrencyToken`).

---

### 5. Lưu trữ ảnh chân dung riêng cho từng bản CV (`avatarUrl` / `avatarDataUrl`) & Render ảnh vào file PDF trên Server (PDF Trang 20 & 25)
- **Màn hình FE:** `/candidate/cv-builder` & `/candidate/cv-builder/:cvId` ([`CandidateCvBuilderPage.tsx`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/features/portal/candidate/cv-builder/CandidateCvBuilderPage.tsx))
- **Hiện trạng BE:**
  - Trong [`CvBuilderFeatures.cs`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect/HRConnect.Application/Features/Candidates/CvBuilder/CvBuilderFeatures.cs) (dòng 24–30), record `CvPresentation` chỉ có:
    `AccentColor`, `Density`, `FontFamily`, `Layout`, `VisibleSections`, `ShowAvatar` (boolean).
  - Khi `CvBuilderHandlers.Validate()` chạy trên BE, nó tạo lại `new CvPresentation(accent, density, font, layout, sections, value.ShowAvatar)` nên mọi trường mở rộng như `avatarDataUrl` hoặc `avatarUrl` riêng của từng CV bị lược bỏ khi lưu vào cột `structured_content`.
  - Hiện tại khi người dùng bấm khung **"Thêm ảnh"** trên tờ CV A4, FE vừa lưu `avatarDataUrl` vào nháp trình duyệt vừa gọi `POST /api/v1/users/me/avatar` để cập nhật avatar tài khoản chung.
- **Đề xuất BE cần bổ sung:**
  - Thêm trường `string? AvatarUrl = null` vào record `CvPresentation` trong `CvBuilderFeatures.cs` (cho phép lưu URL ảnh hoặc DataURL nhỏ), đồng thời cập nhật `StructuredCvService` (QuestPDF renderer) để vẽ ảnh ứng viên lên góc trái Header khi `ShowAvatar == true`.

---

### 6. Danh sách nhiều mục Học vấn, Kinh nghiệm, Dự án, Chứng chỉ trong Hồ sơ cá nhân (`/candidate/profile` - PDF Trang 18)
- **Màn hình FE:** `/candidate/profile` ([`CandidateProfilePage.tsx`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/features/portal/CandidateProfilePage.tsx))
- **Hiện trạng BE:**
  - `GET/PUT /api/v1/candidates/profile/me` (`CandidateEndpoints.cs`) lưu bảng `candidates` với các trường đơn: `fullName`, `phone`, `dateOfBirth`, `gender`, `currentAddress`, `highestEducation` (1 chuỗi text), `yearsOfExperience` (số năm), `summary`, 9 trường nghề nghiệp (`currentJobTitle`, `currentLevel`, `targetRole`, `expectedSalaryMin/Max`, `availableFrom`, `preferredLocations[]`, `preferredWorkModes[]`) và bảng `candidate_skills` (`/api/v1/candidates/profile/me/skills`).
  - **Chưa có bảng / API riêng** ở cấp Candidate Profile để lưu danh sách nhiều mục `educations[]`, `experiences[]`, `projects[]`, `certificates[]` độc lập với từng bản CV (hiện các danh sách nhiều mục này chỉ nằm trong `structured_content` của từng CV trong CV Builder).
- **Đề xuất BE (nếu muốn đồng bộ 2 chiều giữa Hồ sơ cá nhân và Trình tạo CV):**
  - Bổ sung JSONB hoặc bảng con `candidate_educations`, `candidate_experiences`, `candidate_certificates` trong `GET/PUT /api/v1/candidates/profile/me`.

---

### 7. Tham số sắp xếp (`sortBy`) trên API Việc làm đã lưu (`GET /api/v1/candidates/me/saved-jobs` - PDF Trang 19)
- **Màn hình FE:** `/candidate/saved-jobs` ([`CandidateSavedJobsPage.tsx`](file:///c:/Users/truon/Documents/DA/hr-connect/HRConnect-FE/src/features/portal/CandidateSavedJobsPage.tsx))
- **Hiện trạng BE:**
  - `CandidateSavedJobEndpoints.cs` (`GET /api/v1/candidates/me/saved-jobs`) hiện chỉ nhận 2 query params `page` và `pageSize` (mặc định sắp xếp theo `savedAt DESC`).
  - Trên giao diện PDF Trang 19 có bộ lọc sắp xếp **"Mới lưu gần đây"** và **"Sắp hết hạn ứng tuyển"**. Hiện FE đang lấy `pageSize = 100` và thực hiện sort theo `applicationDeadline` ở phía Client.
- **Đề xuất BE cần bổ sung:**
  - Thêm query param `[FromQuery] string? sortBy = "SAVED_AT_DESC"` (hỗ trợ `"SAVED_AT_DESC"` và `"DEADLINE_ASC"`) vào `GetSavedJobsQuery`.
