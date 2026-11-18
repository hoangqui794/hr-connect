# Tài liệu Đặc tả Toàn diện — MF-03 (AI Matching, Tiền sàng lọc, Bàn giao CV Sourcing & Gợi ý Việc làm)

> **Tài liệu liên quan:**
> - [`review.md`](review.md): Báo cáo kiểm định Production Readiness MF-03.
> - [`../main-flows.md`](../main-flows.md): Đặc tả luồng nghiệp vụ mục MF-03 và SF-07.
> - [`../QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md`](../QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md): Quy tắc nghiệm thu CV Sourcing (C1–C3).
> - Hướng dẫn giao diện Candidate MF-03: [`../../../HRConnect-FE/docs/candidate/MF03/`](../../../HRConnect-FE/docs/candidate/MF03/).

---

## 1. Kiến trúc Chấm điểm AI Bất đồng bộ (`Mf03ScoringDispatcher` & `ai-service-v2`)

1. **Kích hoạt & Hàng đợi Retry (`IMf03ScoringTrigger` → `Mf03ScoringDispatcher`):**
   - Ngay khi hồ sơ ứng tuyển (`Application`) được tạo ở trạng thái `SUBMITTED` (hoặc khi Internal HR bấm chấm lại `RetryAiScoringCommand`), hệ thống khởi tạo trạng thái chấm điểm `PENDING` và đưa vào hàng đợi xử lý nền.
   - `Mf03ScoringDispatcher` gửi yêu cầu chấm điểm sang dịch vụ Python `ai-service-v2` kèm chữ ký xác thực nội bộ `X-Service-Token` (so khớp bằng `CryptographicOperations.FixedTimeEquals` tại `InternalServiceAuthFilter`).
   - Nếu dịch vụ AI tạm thời gián đoạn hoặc timeout, worker tự động thử lại theo cơ chế **Exponential Backoff** (từ 30 giây tăng dần tới tối đa 15 phút, giới hạn số lần thử); khi vượt ngưỡng tối đa sẽ chuyển sang `FAILED` để người sàng lọc đánh giá thủ công.

2. **Xử lý kết quả & Hậu kiểm bằng chứng (`AiResultCallbackProcessor` & `verification.py`):**
   - `ai-service-v2` trích xuất văn bản từ CV PDF (qua presigned URL độc lập, kiểm tra magic bytes `%PDF`), đối chiếu với các tiêu chí `MUST_HAVE` và `SHOULD_HAVE` của Job.
   - **Chống ảo giác LLM (Hallucination Guard):** Bộ hậu kiểm `verification.py` kiểm tra từng câu trích dẫn (`evidence_quotes`) có thực sự xuất hiện trong văn bản CV gốc hay không; nếu không khớp sẽ tự động hạ kết quả tiêu chí xuống `NOT_FOUND` (`LLM_UNVERIFIED`) và bật cờ `RequiresManualReview = true`.
   - Callback `POST /api/v1/internal/ai/applications/{applicationId}/result` lưu bản ghi `AiMatchResult` gồm:
     - `OverallScore` (`0–100`) và `MatchTier` theo 4 mức chuẩn: `HIGH` (`>= 80`), `MEDIUM_HIGH` (`70–79`), `MEDIUM` (`60–69`), `LOW` (`< 60`).
     - Chi tiết từng tiêu chí (`AiMatchRequirementResult`), `MustHaveResult`, `ShouldHaveResult`, `CandidateHighlight`, `MatchingReasons`, `MissingRequirements`, cùng `FailureCode` / `ErrorMessage` nếu lỗi.

---

## 2. Phân quyền Sàng lọc theo Loại dịch vụ (`ScreeningPolicy`)

AI chỉ đóng vai trò hỗ trợ ra quyết định, **không tự động loại hay chọn ứng viên**. Quyền sàng lọc (`StartScreening` & `UpdateApplicationScreeningStatus`) được phân tách chặt chẽ theo loại dịch vụ:

| Loại dịch vụ (`ServiceType`) | Người thực hiện sàng lọc | Chủ sở hữu liên hệ (`contactOwner`) | Quy tắc hiển thị & Che thông tin đối với Client (`ClientVisibilityPolicy`) |
| :--- | :--- | :--- | :--- |
| **`CV_APPLICATION`** | **Client Company User** | HR của Client | Client thấy hồ sơ ngay từ `SUBMITTED`; xem toàn bộ thông tin liên hệ và CV gốc. |
| **`HEADHUNT_COD`** | **Internal HR** (tiền sàng lọc) | Internal HR | Client **chỉ thấy hồ sơ từ `SHORTLISTED` trở đi** (`404` nếu còn `SUBMITTED`/`SCREENING`). **Che hoàn toàn** Email, SĐT, Địa chỉ và CV gốc (`isContactMasked = true`) cho tới khi `PLACED`; trước khi `PLACED`, Client xem bản CV đã che thông tin qua `GET /api/v1/recruitment/applications/{id}/cv/masked` (`MaskedCvService`). |
| **`CV_SOURCING`** | **Internal HR** (tiền sàng lọc) | HR của Client (sau khi giao) | Client **chỉ thấy hồ sơ đã được Internal HR bàn giao** (có bản ghi `SourcingDelivery`); các hồ sơ chưa giao hoặc dự phòng (`BACKUP`) trả `404`. |

### Chuyển trạng thái sàng lọc (`UpdateApplicationScreeningStatusCommandHandler`)
- **Bắt đầu xem xét (`POST .../start-screening`):** Chuyển `SUBMITTED → SCREENING` (idempotent).
- **Quyết định sàng lọc (`PATCH .../status` kèm `ConcurrencyToken`):**
  - **Đạt (`SHORTLISTED`):** Mở khóa bước tiếp theo (chuyển sang MF-04 với `CV_APPLICATION` / `HEADHUNT_COD`, hoặc sẵn sàng bàn giao CV với `CV_SOURCING`).
  - **Không đạt (`REJECTED`):** Bắt buộc truyền mã lý do chuẩn (`SKILL_MISMATCH`, `INSUFFICIENT_EXPERIENCE`, `SALARY_MISMATCH`, `LOCATION_MISMATCH`, `LANGUAGE_REQUIREMENT`, `CANDIDATE_UNREACHABLE`, `POSITION_FILLED`, hoặc `OTHER` kèm ghi chú bắt buộc).

---

## 3. Luồng Bàn giao & Nghiệm thu CV Sourcing (`SourcingDeliveryFeatures`)

Áp dụng riêng cho dịch vụ **`CV_SOURCING`**:

1. **Bàn giao CV đạt chuẩn (`DeliverSourcingCvsCommandHandler` — `POST /api/v1/jobs/{jobId}/sourcing/deliveries`):**
   - Internal HR chọn các hồ sơ đã đạt `SHORTLISTED` và đã có `SubmissionConsent.Status == "CONFIRMED"` để giao cho Client.
   - Kiểm tra không vượt quá hạn mức `SourcingTarget` của Job (`409 SOURCING_TARGET_REACHED`); gắn hạn phản hồi `ReviewDeadlineAt = Now + ReviewDays` (ưu tiên `job.ReviewDays`, mặc định 7 ngày).
2. **Client nghiệm thu CV (`ReviewSourcingDeliveryCommandHandler`):**
   - Trong thời hạn `ReviewDeadlineAt`, Client có thể:
     - **Chấp nhận (`ACCEPT`):** `SourcingDelivery` chuyển sang `ACCEPTED`, tính vào quota CV đạt chuẩn và sinh hoa hồng `EARNED` cho Affiliate.
     - **Từ chối (`REJECT`):** Chỉ chấp nhận các mã lý do hợp lệ (`DUPLICATE_ALREADY_OWNED`, `FALSE_INFORMATION`, `UNREACHABLE`, `WRONG_JOB`, hoặc `OTHER` kèm ghi chú). *"Không chọn phỏng vấn"* không phải là lý do từ chối CV.
3. **Tự động chấp nhận khi hết hạn (`SourcingAutoAcceptService` / Worker):**
   - Khi quá `ReviewDeadlineAt` mà Client chưa phản hồi, hệ thống tự động chuyển `DELIVERED → AUTO_ACCEPTED` và ghi nhận quota + hoa hồng như `ACCEPTED`.
4. **Xác minh lý do `OTHER` & Thay thế CV dự phòng:**
   - Với lý do `OTHER`, Internal HR thẩm định (`ReviewSourcingRejectionCommandHandler`): nếu **Giữ nguyên từ chối (`Upheld = true`)** thì CV không tính quota; nếu **Bác bỏ từ chối (`Upheld = false`, bắt buộc ghi chú)** thì CV chuyển sang `ACCEPTED` và tính vào quota.
   - Với CV bị từ chối hợp lệ, Internal HR có thể chọn một ứng viên `SHORTLISTED` khác chưa giao để thay thế (`ReplaceSourcingDeliveryCommandHandler`): bản ghi cũ chuyển sang `REPLACED`, bản ghi mới nhận hạn xem xét mới theo `job.ReviewDays` và gửi thông báo SignalR cho Client.

---

## 4. Gợi ý Việc làm Tự động cho Ứng viên (`JobMatchService` — SF-07)

- Worker `JobMatchWorker` chạy định kỳ quét các Job `ACTIVE` còn hạn (mà vai trò `CANDIDATE` có quyền `can_view`) và các hồ sơ Candidate đang để chế độ `PUBLIC` có CV chính `ACTIVE`.
- Gọi `POST /api/v1/semantic-match` trên `ai-service-v2` (sử dụng mô hình ngữ nghĩa Sentence-BERT) để tính độ tương đồng và lưu vào bảng `CandidateJobMatches` (có thời hạn `job_match.expiry_days`).
- Nếu điểm phù hợp đạt ngưỡng `job_match.min_score` (mặc định 70), hệ thống tạo thông báo `JOB_FIT` (giới hạn tối đa `job_match.max_notifications_per_day` mỗi ứng viên/ngày).
- Ứng viên xem danh sách việc làm gợi ý tại `GET /api/v1/candidates/me/job-matches` và có thể ẩn (`DISMISS`) các gợi ý không quan tâm.
