# Tài liệu Đặc tả Toàn diện — MF-02 (Ứng tuyển, CV, Affiliate Giới thiệu, Consent, Attribution & Chống trùng)

> **Tài liệu liên quan:**
> - [`business-logic-master.md`](business-logic-master.md): **Cẩm nang tổng hợp 100% Logic & Nghiệp vụ MF-02 + Bộ câu hỏi vấn đáp Review 3** (đọc file này để nắm trọn nghiệp vụ mà không cần mở nhiều file lẻ).
> - [`code-structure-and-call-flow.md`](code-structure-and-call-flow.md): Bản đồ chi tiết các folder, file và luồng gọi hàm (Call Trace) qua 4 tầng Clean Architecture theo từng nhóm chức năng MF-02.
> - [`review.md`](review.md): Nhật ký kiểm định Production Readiness (đã hoàn tất **20/20** hạng mục Critical, Major, Minor).
> - [`../main-flows.md`](../main-flows.md): Đặc tả luồng nghiệp vụ mục MF-02.
> - Hợp đồng tích hợp Frontend: [`../../../HRConnect-FE/docs/integration/MF02/`](../../../HRConnect-FE/docs/integration/MF02/).

---

## 1. Quy tắc Phân quyền Nộp hồ sơ theo Loại dịch vụ

| Loại dịch vụ (`ServiceType`) | Đối tượng được phép nộp | Luồng xử lý chính | Yêu cầu Consent |
| :--- | :--- | :--- | :--- |
| **`CV_APPLICATION`** | **Candidate** tự ứng tuyển | `ApplyJobCommandHandler` → tạo thẳng `Submission (ACCEPTED)` + `Application (SUBMITTED)` | Không cần |
| **`HEADHUNT_COD`** | **Affiliate** giới thiệu | `SubmitCandidateCommandHandler` → tạo `Submission (PENDING_CONSENT)` + `SubmissionConsent` | **Bắt buộc `CONFIRMED`** (kèm Client Ownership & Bảo hành) |
| **`CV_SOURCING`** | **Affiliate** giới thiệu | `SubmitCandidateCommandHandler` → sau khi Candidate `CONFIRMED` và HR `SHORTLISTED`, HR giao CV cho Client (`SourcingDelivery`) | **Bắt buộc `CONFIRMED`** |

> [!IMPORTANT]
> Candidate **không** nộp trực tiếp vào `CV_SOURCING` hoặc `HEADHUNT_COD`; hai dịch vụ này chỉ nhận hồ sơ thông qua Affiliate giới thiệu và bắt buộc phải có xác nhận đồng ý (`SubmissionConsent.Status == "CONFIRMED"`) từ Candidate.

---

## 2. Quản lý CV Candidate (Upload PDF & CV Builder)

1. **Hai hình thức tạo CV được lưu trên Server:**
   - **Tải PDF trực tiếp (`CvStorageService`):** Kiểm tra định dạng/kích thước PDF, lưu lên Cloudflare R2, tính `ContentSha256` và `FingerprintVersion = "binary-sha256-v1"`.
   - **CV Builder có cấu trúc (`StructuredCvService`):** Render PDF qua `CvPdfRenderer`, validate PDF cùng chuẩn upload, lưu R2, tính `ContentSha256` và `FingerprintVersion = "binary-sha256-v1"`.
2. **Bản nháp trên trình duyệt & Thao tác ở Frontend:**
   - Bản nháp CV Builder được lưu tự động vào `localStorage` theo key `hrconnect.cv-builder.draft.v2:<userId>:<cvId|new>` và khôi phục ở **cả hai chế độ** `create` và `edit`.
   - Modal nộp đơn (`ApplyModal` trong `JobApplyActions.tsx`) **chỉ hiển thị các CV đã lưu trên server** (lọc bỏ bản nháp local `cv_builder_...`).
   - Hỗ trợ đầy đủ `?action=preview` / `?action=download` khi mở CV Builder từ Kho CV, và công tắc **"Đặt làm CV chính"** đồng bộ cả ở `CvTopbar`, Kho CV lẫn trang Tổng quan Candidate.

---

## 3. Hai Nhánh Luồng Nghiệp vụ Chính

### 3.1. Nhánh A — Candidate Tự ứng tuyển (`CV_APPLICATION`)
1. Kiểm tra hồ sơ Candidate `ACTIVE` (chưa bị khóa/lưu trữ/merge `MergedIntoCandidateId`) và tài khoản còn quyền Candidate.
2. Kiểm tra Job: `Status == "ACTIVE"`, chưa quá `ApplicationDeadline`, chưa vượt `MaxApplications`, và loại dịch vụ cho phép Candidate nộp.
3. Kiểm tra trùng lặp `(CandidateId, JobId)` trong khóa giao dịch `_candidateCompanyLock` (cho phép nộp lại nếu đơn cũ đã `WITHDRAWN`).
4. Tạo `Submission (Source = "CANDIDATE", Status = "ACCEPTED")` + `Application (Status = "SUBMITTED")`, gửi thông báo và kích hoạt chấm điểm AI (MF-03).

### 3.2. Nhánh B — Affiliate Giới thiệu & Candidate Consent (`HEADHUNT_COD`, `CV_SOURCING`)
1. **Tạo lượt giới thiệu (`SubmitCandidateCommandHandler`):**
   - Hỗ trợ 2 nguồn CV:
     - Tải CV PDF mới cho ứng viên.
     - Dùng lại CV từ Kho CV của Affiliate (`CandidateId` + `CvId`), bắt buộc đủ 5 điều kiện: `AFFILIATE_UPLOAD`, đúng `UploadedByUserId`, `Status == "ACTIVE"`, `AffiliateReuseStatus == "ALLOWED"`, và đã có ít nhất 1 `Submission` `ACCEPTED` trước đó.
   - **Định danh & Bảo toàn Snapshot Liên hệ (`SubmissionContactSnapshot`):**
     - Nếu Candidate đã có hồ sơ xác thực (`Mail A + Phone A`), hệ thống áp dụng **Strict Identity Match**: chặn `409 Conflict` nếu Affiliate gửi kèm `Phone B != Phone A` hoặc nếu Email & SĐT trỏ về 2 ứng viên khác nhau, nhằm chống gian lận liên hệ (Contact Hijacking) và tránh sinh SĐT trôi nổi.
     - Nếu Candidate chưa có tài khoản (`UserId == null`) hoặc chưa từng lưu SĐT trên hồ sơ gốc (`Phone == null`), thông tin do Affiliate nộp được lưu snapshot vào `Submission.SubmittedFullName`, `Submission.SubmittedPhone`, `Submission.NormalizedSubmittedPhone`.
     - Khi ứng viên sau đó dùng `Mail A` để đăng ký tài khoản chính chủ (`RegisterCandidateCommand` & `VerifyEmailOtpCommand` qua `CandidateRegistrationIdentity`), chính chủ được phép đăng ký SĐT cá nhân (`Phone A` cập nhật vào `Candidate.Phone`), trong khi các lượt nộp trước đó của Affiliate vẫn giữ nguyên `Submission.SubmittedPhone = Phone B`.
   - Kiểm tra Affiliate `ACTIVE`/`VERIFIED`, Job `ACTIVE`, `ApplicationDeadline`, `MaxApplications`, Replacement Slot (nếu nộp thay thế), Client Ownership (với `HEADHUNT_COD`).
   - Tạo `Submission (PENDING_CONSENT)` + `SubmissionConsent (PENDING)` (token 32 bytes ngẫu nhiên, chỉ lưu `SHA-256` hash trong DB), ghi `EmailOutbox`, tạo `Notification` và đẩy SignalR nếu Candidate đã có tài khoản.
   - *Lưu ý bảo mật:* Log cảnh báo xung đột danh tính chỉ ghi `CandidateId`, không ghi plaintext email/phone.

2. **Candidate Phản hồi Consent (`RespondSubmissionConsentCommandHandler` & `ReportUnauthorizedSubmissionConsentCommandHandler`):**
   - Hỗ trợ cả 2 kênh:
     - **Đã đăng nhập:** `/candidate/submission-consents/:submissionId`
     - **Public qua link email:** `/consent#token=...` (token nằm ở URL fragment và bị xóa khỏi thanh địa chỉ ngay khi đọc; rate-limited + header `Cache-Control: no-store`, `Referrer-Policy: no-referrer`).
   - **3 hành động của Candidate:**
     - **`CONFIRM` (Đồng ý):**
       - Kiểm tra lại `Job.Status == ACTIVE`, `ApplicationDeadline`, `MaxApplications`, trạng thái Candidate/Affiliate, Replacement Slot, và khóa `_candidateCompanyLock` trong transaction.
       - Nếu có ca nghi trùng đang mở trên cùng Job → giữ `Submission` ở **`PENDING_IDENTITY_REVIEW`** (`RequiresIdentityReview = true`) chờ đối chiếu danh tính.
       - Nếu hợp lệ → chuyển `Submission` sang `ACCEPTED`, tạo `Application (SUBMITTED)` + `Attribution (Status = "ACTIVE", Rule = "CANDIDATE_CONSENT_THEN_FIRST_ACCEPTED")`, kích hoạt chấm điểm AI MF-03, thông báo cho Candidate, Affiliate & Internal HR.
     - **`DECLINE` (Từ chối):** Chuyển Consent sang `DECLINED`, Submission sang `CONSENT_REJECTED`, cập nhật thông báo cho Affiliate.
     - **`REPORT_UNAUTHORIZED` (Báo cáo không phải mình):** Đặt Consent `DECLINED`, Submission `CONSENT_REJECTED`, thu hồi quyền dùng lại CV (`AffiliateReuseStatus = "REVOKED"`), xoay `ConcurrencyToken`, lưu `ResponseIp` & `ResponseUserAgent`, ghi AuditLog và gửi thông báo + SignalR cho Affiliate.

3. **Giao CV Sourcing (`SourcingDeliveryFeatures`):**
   - Sau khi `Application` đạt `SHORTLISTED`, Internal HR giao CV cho Client (`DeliverSourcingCvsCommandHandler`) — bắt buộc `Submission.Consent.Status == "CONFIRMED"`.
   - Khi Client từ chối và HR thay thế CV (`ReplaceSourcingDeliveryCommandHandler`): bắt buộc `old.Job.Status == JobStatuses.Active`, ưu tiên `old.Job.ReviewDays` trước khi fallback sang cấu hình mặc định, và đẩy SignalR cho doanh nghiệp.

---

## 4. Chống Trùng lặp & Hợp nhất Danh tính (`CandidateDuplicateCases`)

1. **Phát hiện trùng:** Dựa trên Email chuẩn hóa, Số điện thoại chuẩn hóa, `ContentSha256` của PDF, và `NormalizedName` (trùng cả CV lẫn họ tên trên cùng Job tạo mức `RiskLevel = "HIGH"`).
2. **Bảo vệ PII:** Các API xem danh sách/chi tiết ca nghi trùng luôn che email/phone và không làm lộ danh tính Affiliate đối phương.
3. **Phân quyền xử lý (`DecideMyCandidateDuplicateCase` & `ResolveCandidateDuplicateCase`):**
   - **Candidate:** Có thể xác nhận `MERGE` (chuyển sang `UNDER_REVIEW` chờ Admin duyệt), nhưng **bị chặn `409 DUPLICATE_CASE_REQUIRES_ADMIN_REVIEW` nếu cố `DISMISS` ca `RiskLevel == "HIGH"` hoặc ca gắn `JobId`**.
   - **Admin:** Xem trước xung đột & ràng buộc tài chính (`PreviewCandidateDuplicateMerge`), thực hiện `MERGE` hoặc `DISMISS`. Khi `MERGE`, chọn `CanonicalCandidate`, lưu trữ hồ sơ nguồn (`MergedIntoCandidateId`), và gọi `FinalizeIdentityReviewedSubmissionService` để giải phóng các Submission `PENDING_IDENTITY_REVIEW` theo thứ tự xác nhận sớm nhất (`EARLIEST_CANDIDATE_CONFIRMED_VALID_SUBMISSION`), đồng thời đẩy thông báo + SignalR cho Candidate & Affiliate.
4. **Khóa cập nhật hồ sơ đã merge:** `UpdateCandidateProfileCommandHandler` từ chối cập nhật nếu Candidate không ở trạng thái `ACTIVE` hoặc đã có `MergedIntoCandidateId`.

---

## 5. Đồng bộ Giao diện & Realtime (`HRConnect-FE`)

- **SignalR Query Invalidation (`notificationRefreshKeys.ts`):** Đã map đầy đủ entity `SUBMISSION`, `SUBMISSION_CONSENT`, `ATTRIBUTION`, `SOURCING_DELIVERY`, `CANDIDATE_IDENTITY_CLAIM`, `CANDIDATE_DUPLICATE_CASE` tới các query key tương ứng (bao gồm `candidate-submission-consent`, `candidate-affiliate-cvs`, `admin-candidate-identity-claim`, `candidate-duplicate-cases`, `aff-attributions`).
- **Notification Routing (`notificationRoutes.ts`):** Đã hỗ trợ điều hướng đầy đủ cho `CANDIDATE_IDENTITY_CLAIM` (Admin) và `SOURCING_DELIVERY` (Client).
- **UI/UX & Animation:** Toàn bộ các trang MF-02 (`PublicSubmissionConsentPage`, `CandidateSubmissionConsentPage`, `CandidatePages`, `AffiliatePages`, `CvTopbar`) và Shell các vai trò (`CandidateShell`, `AffiliateShell`, `ClientShell`, `HrLayout`, `AdminLayout`) đều sử dụng chuẩn **`unslop`** và **`motion`** (`MotionPageOutlet` + `layoutId` spring pill).


