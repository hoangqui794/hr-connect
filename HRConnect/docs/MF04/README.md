# Tài liệu Đặc tả Toàn diện — MF-04 (Phỏng vấn, Offer, Nhận việc / Placement & Đối soát Độc lập)

> **Tài liệu liên quan:**
> - [`review.md`](review.md): Báo cáo kiểm định Production Readiness MF-04 (đã hoàn tất toàn bộ hạng mục BE, FE & Server-side Search).
> - [`../main-flows.md`](../main-flows.md): Đặc tả luồng nghiệp vụ mục MF-04.
> - Hướng dẫn giao diện Candidate MF-04: [`../../../HRConnect-FE/docs/candidate/MF04/`](../../../HRConnect-FE/docs/candidate/MF04/).

---

## 1. Nguyên tắc Phân vai (Company-Owned Hiring Flow & Independent Reconciliation)

Từ thời điểm hồ sơ đạt **`SHORTLISTED`** (hoặc đã được giao và chấp nhận trong `CV_SOURCING`), toàn bộ quyết định tuyển dụng thuộc về **Client Company User** (`CompanyMembershipPolicy.IsActive == true` và đúng `CompanyId`):

| Nhóm nghiệp vụ | Vai trò thực hiện | Quy tắc kiểm soát |
| :--- | :--- | :--- |
| **Lên lịch, Dời/Hủy, Ghi kết quả Phỏng vấn & Quyết định Dự phòng (`BACKUP`)** | **Client Company User** | Internal HR chỉ có quyền xem, không thực hiện mutation phỏng vấn. |
| **Soạn, Gửi, Cập nhật & Thu hồi Offer** | **Client Company User** | Ứng viên (`CANDIDATE`) trực tiếp phản hồi `ACCEPT` / `DECLINE`. |
| **Xác nhận Đi làm (`PLACED`) / Đánh dấu Không đi làm (`NOT_STARTED`)** | **Client Company User** | Tạo `Placement (STARTED)` hoặc đóng hồ sơ `NOT_STARTED` kèm lý do bắt buộc. |
| **Đối soát Nhận việc (`PlacementReconciliation` — UC-41) & Sửa ngày đi làm** | **Internal HR** (hoặc Admin xử lý ngoại lệ) | Kiểm soát độc lập trước khi tính phí `HEADHUNT_COD` (`PENDING → CONFIRMED / FLAGGED`) và cho phép sửa ngày đi làm trong vòng **7 ngày** kể từ `ConfirmedAt`. |

---

## 2. Quản lý Phỏng vấn (`InterviewEndpoints` & Handlers)

1. **Tạo & Điều phối lịch phỏng vấn (`ScheduleInterview`, `UpdateInterview`, `RescheduleInterview`, `CancelInterview`):**
   - Hỗ trợ nhiều vòng phỏng vấn (`RoundNumber`), hình thức chuẩn hóa `ONLINE` (yêu cầu `MeetingLink`) hoặc `OFFLINE` (yêu cầu `Location`); các bản ghi `PHONE` cũ được bảo toàn khi hiển thị/dời lịch.
   - Ràng buộc Unique Index `ux_interview_one_scheduled_per_application`: mỗi hồ sơ chỉ có tối đa **1 lịch phỏng vấn đang ở trạng thái `SCHEDULED`** tại một thời điểm.
   - Thời gian phỏng vấn phải ở tương lai; mọi thay đổi đều kiểm tra `Mf04ConcurrencyGuard` và gửi thông báo In-App + Email Outbox cho Candidate.
2. **Xác nhận tham dự của Ứng viên (`ConfirmInterviewAttendance`):**
   - Ứng viên xác nhận tham dự (`CONFIRMED`) trên các lịch phỏng vấn sắp diễn ra (`SCHEDULED`). Khi Client dời lịch sang khung giờ mới, trạng thái xác nhận được đặt lại về `null` để ứng viên xác nhận lại.
3. **Ba giai đoạn thời gian & Ghi nhận kết quả (`RecordInterviewResult`, `ResolveNoShow`):**
   - Phân biệt rõ 3 trạng thái thời gian: **Sắp diễn ra (`UPCOMING`)**, **Đang diễn ra (`IN_PROGRESS`)**, và **Đã qua giờ (`OVERDUE` — sau `ScheduledAt + DurationMinutes`)**.
   - Kết quả phỏng vấn chuyển trạng thái `Application`:
     - **`PASS`** → `OFFER_PENDING` (sẵn sàng tạo Offer hoặc lên lịch vòng tiếp theo).
     - **`FAIL`** → `INTERVIEW_FAILED` (kết thúc hồ sơ).
     - **`BACKUP`** → `BACKUP` (đưa vào danh sách dự phòng; vẫn hiển thị đầy đủ với Client thông qua `ClientVisibilityPolicy.PostShortlistStatuses`).
   - Với hồ sơ `BACKUP`, Client quyết định qua `DecideBackupApplicationCommand`: chọn tuyển (`OFFER_PENDING`) hoặc dừng (`BACKUP_NOT_SELECTED`).

---

## 3. Quản lý Thư mời Nhận việc (`OfferEndpoints`, Handlers & `OfferExpiryWorker`)

1. **Tạo, Gửi & Phiên bản hóa Offer (`CreateOffer`, `UpdateOffer`, `SendOffer`):**
   - Lưu lịch sử từng lần chỉnh sửa vào `OfferVersion` (mức lương cơ bản `BaseSalary`, phụ cấp, loại hợp đồng, ngày dự kiến đi làm `StartDate`, hạn phản hồi `ExpiresAt`).
2. **Ứng viên phản hồi & Khóa đồng thời (`RespondOfferCommand`):**
   - Bảo vệ bằng khóa `_candidateLock.AcquireAsync(candidateId)` để chống race condition khi ứng viên thao tác trên nhiều Offer cùng lúc:
     - **`ACCEPT`:** Chuyển `Offer → ACCEPTED`, `Application → OFFER_ACCEPTED`.
     - **`DECLINE`:** Chuyển `Offer → DECLINED`, `Application → OFFER_DECLINED` (kèm lý do).
3. **Thu hồi & Tự động hết hạn Offer:**
   - **Thu hồi (`WithdrawOfferCommand`):** Khi Offer chưa được ứng viên chấp nhận, Client có thể thu hồi kèm lý do (`Offer → WITHDRAWN`, `Application` quay về `OFFER_PENDING`).
   - **Tự động hết hạn (`OfferExpiryWorker`):** Quét định kỳ các Offer `SENT` đã quá `ExpiresAt`, chuyển sang `EXPIRED` và gửi email thông báo kèm đầy đủ tên vị trí (`Job.Title`) và tên doanh nghiệp (`Company.Name`).

---

## 4. Nhận việc (`Placement`), Không đi làm (`NOT_STARTED`) & Đối soát (UC-41)

1. **Cập nhật ngày dự kiến đi làm (`UpdatePlannedStartDateCommand`):**
   - Cho phép lùi ngày dự kiến đi làm tối đa **3 lần** (`PlannedStartChangeCount <= 3`) và không quá **60 ngày** so với `StartDate` ban đầu trên Offer đã chấp nhận.
2. **Xác nhận đi làm thực tế (`ConfirmStartWorkCommandHandler`):**
   - Chuyển `Application → PLACED`, tạo bản ghi `Placement (Status = "STARTED")`.
   - Tự động đóng các hồ sơ đang mở khác của cùng ứng viên trong cùng doanh nghiệp.
   - Với dịch vụ **`HEADHUNT_COD`:**
     - Nếu Job có **Suất tuyển thay thế (`ReplacementSlot`)** đang `OPEN` (và không chọn cờ tuyển mới), hệ thống gắn Placement vào `ReplacementSlot` (`Status = "FILLED"`, không phát sinh phí dịch vụ mới), tạo `Warranty (ACTIVE)` và `Commission (IN_WARRANTY)` dựa trên khoản phí gốc.
     - Nếu là tuyển mới, tạo `ServiceFee (PLACEMENT, PENDING)`, `Warranty (ACTIVE)`, `Commission (IN_WARRANTY)` và mở bản ghi **Đối soát (`PlacementReconciliation`, `Status = "PENDING"`)**.
3. **Đánh dấu Không đi làm (`MarkNotStartedCommandHandler`):**
   - Chuyển `Application → NOT_STARTED` với mã lý do chuẩn (`CANDIDATE_NO_SHOW`, `CANDIDATE_WITHDREW`, `CANDIDATE_OTHER`, `EMPLOYER_CANCELLED` — bắt buộc ghi chú chi tiết với `CANDIDATE_OTHER` và `EMPLOYER_CANCELLED`).
4. **Đối soát Placement & Sửa ngày đi làm (`ReconcilePlacement` & `CorrectPlacementStartDate`):**
   - Internal HR đối soát độc lập bản ghi `PlacementReconciliation`:
     - **`CONFIRMED`:** Giải phóng điều kiện thu phí dịch vụ và hoàn tất bảo hành ở MF-05.
     - **`FLAGGED`:** Tạm giữ việc thu phí và nâng trạng thái bảo hành/hoa hồng cho tới khi được xác minh lại.
   - Internal HR được phép điều chỉnh lại ngày bắt đầu làm việc thực tế (`CorrectPlacementStartDateCommand`) trong vòng **7 ngày** kể từ thời điểm xác nhận (`ConfirmedAt`), tự động tính lại mốc hết hạn bảo hành và hạn thanh toán phí.

---

## 5. Bảo vệ Dữ liệu Nội bộ & Tìm kiếm Server-side

- **Che dữ liệu nội bộ với Candidate & Affiliate:**
  - Khi Candidate xem chi tiết Application / Interview / Offer / Placement: hệ thống tự động ẩn `Interview.ConcurrencyToken`, `CreatedBy`, danh sách `Approvals` nội bộ, lý do thu hồi Offer (`WITHDRAWN`), ghi chú nội bộ của Company/HR trên `StatusReason` (chỉ hiển thị khi chính Candidate rút đơn `WITHDRAWN`), và ghi chú đối soát/bảo hành nội bộ.
  - Khi Affiliate theo dõi tiến độ giới thiệu (`GetAffiliateReferralProgressQueryHandler`): chỉ trả trạng thái tổng quát đã sanitize, không lộ lịch phỏng vấn, lương hay nội dung Offer.
- **Tìm kiếm Server-side & Giao diện Tiến trình 5 bước thống nhất:**
  - Cả 3 API danh sách `GET /api/v1/recruitment/interviews`, `GET /api/v1/offers`, `GET /api/v1/placements` đều hỗ trợ lọc theo `jobId` và tìm kiếm `search` (tên ứng viên / tiêu đề công việc) trực tiếp dưới Database trước khi phân trang.
  - Cổng Client (`/client/candidates`) và Candidate (`/candidate/applications`) đồng bộ thanh tiến trình 5 bước chuẩn hóa (`candidateStageMeta.ts`), hỗ trợ chế độ gom nhóm theo giai đoạn từ server, lọc ứng viên cần hành động và hiển thị thẻ Offer hiện hành hợp nhất kèm modal lịch sử điều chỉnh điều khoản.
