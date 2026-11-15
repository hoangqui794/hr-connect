# Báo cáo Production Readiness Audit — MF-03 (AI Matching, Phân tích CV/JD, Tiền sàng lọc & Sàng lọc theo Gói dịch vụ, Gợi ý Việc làm cho Ứng viên)

> [!IMPORTANT]
> **YÊU CẦU BẮT BUỘC DÀNH CHO AI & DEV KHI SỬA CODE:**
> - Khi sửa xong **1 chức năng hoặc 1 đoạn code** là **commit & push liền**, tuyệt đối **không chờ làm xong hết mới push**.
> - Xong **1 chức năng / đoạn code bên Backend (BE)** (đã build & pass test liên quan) $\rightarrow$ **push liền**.
> - Xong **1 chức năng / đoạn code bên Frontend (FE)** (đã lint/build & pass test liên quan) $\rightarrow$ **push liền**.
> - Chia nhỏ từng commit/push theo từng mục lỗi (`[FE-C01]`, `[BE-M01]`, ...), không gom toàn bộ vào một lần push cuối cùng.

> **Phạm vi kiểm tra (Strict MF-03 Scope):** Bám sát tuyệt đối tài liệu thiết kế `docs/diagrams/workflows/source/wf-mf03-ai-screening.mmd`, `docs/diagrams/classes/source/cls-mf03-ai-screening.mmd`, `HRConnect/docs/MF03/README.md` và mục MF-03 trong `HRConnect/docs/main-flows.md` (dòng `190-253`), kết hợp bộ tiêu chuẩn **Ponytail** (Anti-Overengineering), **Vercel Web Interface Guidelines** và **Anthropic Frontend Design**. Không đề xuất tính năng ngoài scope.

## Tổng quan Kết quả

| Hạng mục | Trạng thái hiện tại | Chi tiết |
| :--- | :--- | :--- |
| **Backend Unit/Integration Tests** | ✅ Pass `128/128` | Toàn bộ test `Integration`, `Screening`, `JobMatch`, `Mf03`, `SourcingDelivery` chạy xanh |
| **Frontend Unit Tests (`vitest`)** | ✅ Pass `27/27` (5 files) | Toàn bộ test `HrScreeningPage`, `HrPipelinePage`, `ClientCandidatesPage`, `ApplicationWorkbench`, `CandidateJobMatchesSection` chạy xanh |
| **🔴 Critical Bugs (Cần sửa bắt buộc trước Production)** | **3 vấn đề** | **0 Backend + 3 Frontend** (Gộp cứng `SHORTLISTED` và `deliverCvs` trong 1 mutation gây lệch trạng thái khi thiếu Consent/chạm trần quota, thiếu validate bắt buộc `note` khi HR bác bỏ từ chối `OTHER` gây `400 Bad Request`, thiếu invalidate `['candidate-job-matches']` khi ứng tuyển/đặt CV chính/nhận SignalR) |
| **🟠 Major Issues (Cần sửa để chuẩn Production & Realtime)** | **9 vấn đề** | **4 Backend + 5 Frontend** (Giao CV thay thế bỏ qua `job.ReviewDays` và thiếu thông báo Client, chặn nhầm thông báo `REJECTED` nếu từng nhận `SHORTLISTED`, Job đã `DISMISSED` bị hiện lại khi đổi fingerprint, thiếu trả `failureCode`/`errorMessage` AI, lệch màu/ngưỡng Tier AI trên `HrScreeningPage`) |
| **🟡 Minor Polish (UI/UX, Tối ưu Request & Code Hygiene)** | **7 vấn đề** | **4 Backend + 3 Frontend** (Gộp 5 request đếm trên `HrScreeningPage` bằng `screeningApi.counts`, bỏ nút giả ở footer `ApplicationWorkbench`, truyền `minYears` sang endpoint nội bộ chấm JD) |

---

## 🔴 1. CRITICAL — Lỗi nghiêm trọng (Lệch trạng thái bán phần / Lỗi `400 Bad Request` / Mất đồng bộ Cache)

### [FE-C01] Gộp cứng 2 bước "Chọn gửi Client" (`SHORTLISTED`) và "Giao CV" (`deliverCvs`) trong `ApplicationWorkbench.tsx` gây lỗi trạng thái bán phần
- **Vị trí:** `HRConnect-FE/src/features/recruitment/ApplicationWorkbench.tsx` (dòng `457-488`)
- **Nguyên nhân:**
  - Đối với dịch vụ `CV_SOURCING`, hàm `confirmShortlist` đang gọi tuần tự 2 API trong cùng 1 mutation:
    1. `screeningApi.updateStatus(jobId, appId, { targetStatus: 'SHORTLISTED', concurrencyToken: token })`
    2. `sourcingApi.deliverCvs(jobId, [appId])`
  - Theo `main-flows.md` (dòng `245`) và `HrScreeningPage.tsx` (dòng `97`), bước chuyển `SHORTLISTED` và bước `Giao CV` là 2 bước độc lập (các hồ sơ vượt quá `sourcingTarget` hoặc đang chờ hoàn tất điều kiện vẫn được chuyển sang `SHORTLISTED` để làm nguồn dự phòng).
  - Khi bước (1) thành công dưới DB nhưng bước (2) ném lỗi `409 CONSENT_NOT_CONFIRMED` hoặc `409 SOURCING_TARGET_REACHED`, mutation rơi vào `onError` và báo thao tác thất bại dù hồ sơ đã đổi sang `SHORTLISTED` và `concurrencyToken` đã xoay mới.
- **Hướng sửa:** Tách bạch thành công của bước `updateStatus('SHORTLISTED')` (luôn invalidate dữ liệu hồ sơ ngay khi bước 1 thành công); nếu gọi kèm `deliverCvs` mà gặp `409` thì hiển thị thông báo rõ: *"Đã duyệt hồ sơ vào danh sách Đạt (Shortlisted), nhưng chưa thể bàn giao ngay cho Doanh nghiệp: <lý do>"*.

### [FE-C02] Thiếu validate bắt buộc ghi chú (`note`) khi Internal HR bác bỏ lý do từ chối `OTHER` của Client trong CV Sourcing (`400 Bad Request`)
- **Vị trí:**
  - `HRConnect-FE/src/features/sourcing/SourcingDeliveriesView.tsx` (dòng `784-805`)
  - Đối chiếu BE: `HRConnect/HRConnect.Application/Features/Recruitment/Sourcing/SourcingDeliveryFeatures.cs` (dòng `471-475`)
- **Nguyên nhân:** Khi Internal HR xác minh lý do từ chối `OTHER` của Client và chọn **Bác bỏ từ chối (`upheld = false`)**, Backend bắt buộc phải nhập `note` (`if (!request.Upheld && note == null) throw new BadRequestException(...)`). Tuy nhiên trên FE ở dòng `802`, trường `note` luôn ghi `"Ghi chú xác minh (Không bắt buộc)"` và không có rule `required` khi `upheld === false`, khiến HR bấm xác nhận bị lỗi `400 Bad Request`.
- **Hướng sửa:** Dùng `Form.useWatch('upheld', reviewForm)` để bắt buộc nhập `note` (`required: true, whitespace: true`) khi `upheld === false`.

### [FE-C03] Thiếu đồng bộ Cache React Query (`['candidate-job-matches']` & `['sourcing-deliveries']`) khi có SignalR hoặc khi Ứng viên nộp đơn / đổi CV chính
- **Vị trí:**
  - `HRConnect-FE/src/hooks/notificationRefreshKeys.ts` (dòng `6-11`, `18-39`)
  - `HRConnect-FE/src/hooks/useNotificationSignalR.ts` (dòng `171-182`)
  - `HRConnect-FE/src/features/portal/JobApplyActions.tsx` (dòng `102-106`)
  - `HRConnect-FE/src/features/portal/CandidateCvsPage.tsx` (dòng `85-87`, `102-104`, `118`) & `CandidatePages.tsx` (dòng `673`)
- **Nguyên nhân:**
  1. Khi ứng viên vừa nộp đơn ứng tuyển (`JobApplyActions.tsx:103`) hoặc vừa tải lên / đặt CV chính (`CandidateCvsPage.tsx`), query `['candidate-job-matches']` (đang đặt `staleTime: 5 phút` tại `CandidateJobMatchesSection.tsx:74`) không được invalidate -> Job vừa ứng tuyển vẫn hiện nút ứng tuyển trong danh sách gợi ý suốt 5 phút, hoặc màn hình vẫn báo `"Chọn CV chính để nhận gợi ý"` dù vừa đặt CV chính xong.
  2. Trong `notificationRefreshKeys.ts`, mảng `JOB` (nhận thông báo `JOB_FIT` từ `JobMatchService.cs:202-209`) chưa có `['candidate-job-matches']`.
  3. Trong `useNotificationSignalR.ts` (dòng `173`), sự kiện `application.scored` chưa invalidate `['sourcing-deliveries']`.
- **Hướng sửa:** Bổ sung `['candidate-job-matches']` vào các nơi trên và thêm `['sourcing-deliveries']` khi nhận `application.scored`.

---

## 🟠 2. MAJOR — Lỗi nghiệp vụ, Thông báo & Hiển thị kết quả AI

### Backend Major Issues

#### [BE-M01] Thay thế CV bị từ chối (`ReplaceSourcingDelivery`) bỏ qua `job.ReviewDays` đã thỏa thuận và thiếu thông báo cho Client
- **Vị trí:** `HRConnect/HRConnect.Application/Features/Recruitment/Sourcing/SourcingDeliveryFeatures.cs` (dòng `511-580`, cụ thể dòng `547` và `577`)
- **Nguyên nhân:**
  1. Ở `DeliverSourcingCvsCommandHandler` (dòng `282-284`), thời hạn xem xét CV ưu tiên lấy `job.ReviewDays` đã chốt trên Job trước khi fallback về `BusinessSettingKeys.CvSourcingReviewDays`. Nhưng `ReplaceSourcingDeliveryCommandHandler` (dòng `547`) lại đọc thẳng `_settings.GetIntAsync(BusinessSettingKeys.CvSourcingReviewDays)` mà bỏ qua `old.Job.ReviewDays`.
  2. Handler chưa gửi thông báo (`IAppNotifier.NotifyCompanyAsync`) cho Client Company khi HR đã giao CV thay thế mới.
- **Hướng sửa:** Ưu tiên `old.Job.ReviewDays > 0 ? old.Job.ReviewDays : await _settings.GetIntAsync(...)` và bắn thông báo cho Client Company.

#### [BE-M02] Chặn nhầm thông báo `REJECTED` nếu hồ sơ từng nhận thông báo `SHORTLISTED`, và thiếu thông báo cho Client khi `HEADHUNT_COD` được `SHORTLISTED`
- **Vị trí:** `HRConnect/HRConnect.Application/Features/Recruitment/Commands/UpdateApplicationScreeningStatus/UpdateApplicationScreeningStatusCommandHandler.cs` (dòng `237-240`, `259-292`)
- **Nguyên nhân:**
  1. `AddScreeningNotificationsAsync` kiểm tra trùng bằng `_notificationRepository.ExistsAsync(userId, "APPLICATION_STATUS", "APPLICATION", application.ApplicationId)` mà không phân biệt trạng thái đích (`SHORTLISTED` vs `REJECTED`). Nếu hồ sơ từng được `SHORTLISTED` rồi sau đó bị loại hợp lệ (`REJECTED`), `ExistsAsync` trả về `true` và ứng viên/Affiliate không nhận được thông báo bị loại.
  2. Khi `INTERNAL_HR` chuyển hồ sơ `HEADHUNT_COD` sang `SHORTLISTED` (thời điểm hồ sơ bắt đầu mở khóa hiển thị cho Client theo `wf-mf03-ai-screening.mmd`), hệ thống chưa gửi thông báo cho Client Company sở hữu Job.
- **Hướng sửa:** Không chặn thông báo `REJECTED` bởi thông báo `SHORTLISTED` trước đó, và bổ sung gửi thông báo cho Client khi `HEADHUNT_COD` đạt `SHORTLISTED`.

#### [BE-M03] Gợi ý việc làm đã bị ứng viên ẩn (`DISMISSED`) bị tái xuất hiện khi CV/Job cập nhật, và gửi trùng thông báo `JOB_FIT` qua ngày mới
- **Vị trí:** `HRConnect/HRConnect.Infrastructure/Services/JobMatching/JobMatchService.cs` (dòng `120-128`, `189-210`)
- **Nguyên nhân:**
  1. Dòng `122-124` chỉ kiểm tra `sameInput?.Status == JobMatchStates.Dismissed` theo `InputFingerprint` hiện tại. Khi ứng viên cập nhật CV/kỹ năng hoặc Job cập nhật (`fingerprint` đổi), `sameInput` là `null` nên hệ thống chấm lại và tạo bản ghi mới `Status = GENERATED`, làm Job đã bị ứng viên ẩn hiện lại trên feed.
  2. Dòng `191-196` chỉ đếm số thông báo `JOB_FIT` trong ngày mà chưa kiểm tra `_notifications.ExistsAsync(userId, "JOB_FIT", "JOB", job.JobId)`, khiến ứng viên có thể nhận lại thông báo cho cùng một Job vào ngày hôm sau.
- **Hướng sửa:** Đổi điều kiện dòng `123` thành `if (rows.Any(m => m.Status == JobMatchStates.Dismissed)) continue;` và kiểm tra `ExistsAsync` theo `job.JobId` trước khi tạo thông báo `JOB_FIT`.

#### [BE-M04] API Chi tiết hồ sơ (`GET /api/v1/recruitment/applications/{applicationId}`) chưa trả `mustHaveResult`, `shouldHaveResult`, `failureCode`, `errorMessage` trong `AiMatch`
- **Vị trí:**
  - `HRConnect/HRConnect.Application/Features/Recruitment/Queries/GetRecruitmentApplicationDetail/GetRecruitmentApplicationDetailQueryHandler.cs` (dòng `180-194`, `229-239`)
  - `RecruitmentApplicationDetailResponse.cs` (dòng `107-132`)
- **Nguyên nhân:** `AiResultCallbackProcessor` đã lưu đầy đủ `MustHaveResult`, `ShouldHaveResult`, `FailureCode`, `ErrorMessage` vào bảng `AiMatchResults`, nhưng `RecruitmentAiMatchSummaryDto` chưa trả các trường này ra API chi tiết hồ sơ, khiến khi lượt chấm AI bị `FAILED` (`AI_TIMEOUT`, `UNSUPPORTED_CV_FORMAT`...) thì giao diện HR chỉ thấy trạng thái lỗi chung mà không rõ nguyên nhân.
- **Hướng sửa:** Bổ sung `FailureCode`, `ErrorMessage`, `MustHaveResult`, `ShouldHaveResult` vào `RecruitmentAiMatchSummaryDto`.

---

### Frontend Major Issues

#### [FE-M01] `HrScreeningPage.tsx` viết cứng ngưỡng điểm và màu AI lệch với chuẩn 4 Tier của MF-03
- **Vị trí:**
  - `HRConnect-FE/src/features/hr-console/HrScreeningPage.tsx` (dòng `48-56`)
  - Đối chiếu: `HRConnect-FE/src/features/screening/matchTierStyle.ts` (dòng `19-32`) & `main-flows.md` (dòng `231`)
- **Nguyên nhân:** `main-flows.md` quy định 4 mốc Tier (`>=80` HIGH, `70-79` MEDIUM_HIGH, `60-69` MEDIUM, `<60` LOW). Trong khi `ClientCandidatesPage.tsx` và `ApplicationWorkbench.tsx` đã dùng chung `MATCH_TIER_STYLE` & `matchTierOf`, thì `HrScreeningPage.tsx` lại viết riêng hàm `AiScore` với ngưỡng cứng sai (`>=75` xanh lá, `>=50` xanh dương, `<50` vàng) và bỏ qua `r.aiMatchTier`. Ngược lại, ở `ClientCandidatesPage.tsx:102-106`, khi `r.aiStatus === 'FAILED'` thì chỉ hiện `"Chưa có điểm"` thay vì báo lỗi chấm điểm.
- **Hướng sửa:** Dùng chung `MATCH_TIER_STYLE` / `matchTierOf` trên cả `HrScreeningPage.tsx` và `ClientCandidatesPage.tsx`.

#### [FE-M02] Modal "Thay thế CV dự phòng" bắt Internal HR tự nhập tay chuỗi UUID (`applicationId`)
- **Vị trí:** `HRConnect-FE/src/features/sourcing/SourcingDeliveriesView.tsx` (dòng `809-838`)
- **Nguyên nhân:** Trường `applicationId` đang dùng `<Input placeholder="Nhập UUID hồ sơ ứng viên đạt yêu cầu..." />`, bắt HR phải tự copy-paste UUID.
- **Hướng sửa:** Đổi sang `<Select>` tải danh sách các hồ sơ `SHORTLISTED` (hoặc `BACKUP`) chưa giao của chính `jobId` đó để HR chọn theo tên ứng viên.

#### [FE-M03] Nút "Xác minh" lý do từ chối `OTHER` vẫn hiển thị sau khi HR đã xác minh (`UPHELD`)
- **Vị trí:** `HRConnect-FE/src/features/sourcing/SourcingDeliveriesView.tsx` (dòng `421-433`)
- **Nguyên nhân:** Điều kiện hiển thị nút `"Xác minh"` chỉ kiểm tra `r.status === 'REJECTED' && r.rejectReasonCode === 'OTHER'`, nên sau khi HR chọn *"Giữ nguyên từ chối"* (`r.rejectionReviewStatus === 'UPHELD'`), nút vẫn hiện.
- **Hướng sửa:** Chỉ hiển thị khi `!r.rejectionReviewStatus || r.rejectionReviewStatus === 'PENDING_HR_REVIEW'`.

#### [FE-M04] Bỏ sót `d.aiMatch.matchingReasons` khi hiển thị bằng chứng AI trong `ApplicationWorkbench.tsx`
- **Vị trí:** `HRConnect-FE/src/features/recruitment/ApplicationWorkbench.tsx` (dòng `696`, `1200-1240`)
- **Nguyên nhân:** Hiện tại chỉ parse `d?.aiMatch?.candidateHighlight` mà bỏ qua mảng `d?.aiMatch?.matchingReasons`, dẫn tới khi `candidateHighlight` trống nhưng `matchingReasons` có dữ liệu thì UI báo nhầm `"AI chưa trả về giải thích chi tiết."`.
- **Hướng sửa:** Kết hợp hiển thị cả `candidateHighlight` và `matchingReasons`.

#### [FE-M05] Dọn dẹp 2 component Dead Code (`AIMatchReviewer.tsx` và `CandidateAiMatchingSection.tsx`) chứa dữ liệu/điểm AI giả
- **Vị trí:**
  - `HRConnect-FE/src/features/screening/AIMatchReviewer.tsx`
  - `HRConnect-FE/src/features/portal/candidate/CandidateAiMatchingSection.tsx`
- **Nguyên nhân:** Cả 2 file không được mount ở bất kỳ đâu trong ứng dụng, chứa điểm AI giả định `0.85` (85%) và mã lý do tự chế lệch với Backend. Theo nguyên tắc **Ponytail (Dead Code Elimination)**, cần xóa bỏ để tránh nhầm lẫn.

---

## 🟡 3. MINOR — Tối ưu hiệu năng truy vấn, Thông báo & UI/UX

1. **[BE-m01] Không bắn sự kiện SignalR `application.scored` cho Client khi hồ sơ `HEADHUNT_COD` / `CV_SOURCING` còn ở `SUBMITTED`, và bổ sung bắn cho HR khi dispatcher đánh dấu `FAILED`:** Tại `AiIntegrationEndpoints.cs` (dòng `303-328`) và `Mf03ScoringDispatcher.cs` (dòng `84-114`, `163-175`).
2. **[BE-m02] Đồng bộ kiểm tra `ClientVisibilityPolicy.IsVisibleToClient` và trả `404` trong `DecideBackupApplicationCommandHandler.cs`:** Tại dòng `96-116`, đồng nhất với `StartScreening` và `UpdateApplicationScreeningStatus`.
3. **[BE-m03] Bổ sung thông báo cho Client khi HR xử lý khiếu nại từ chối CV Sourcing (`ReviewSourcingRejection`) hoặc khi CV tự động chấp nhận (`SourcingAutoAcceptService`):** Tại `SourcingDeliveryFeatures.cs` (dòng `440-509`, `755-800`).
4. **[BE-m04] Truyền `minYears` từ `job.MinExperienceYears` trong `/api/v1/internal/jobs/{jobId}/jd`:** Tại `AiIntegrationEndpoints.cs` (dòng `39-44`) để kích hoạt bộ hậu kiểm số năm kinh nghiệm bằng code trong `ai-service-v2/app/pipeline.py` (dòng `119-129`).
5. **[FE-m01] Gộp 5 request đếm trên `HrScreeningPage.tsx` thành 1 request `screeningApi.counts('status', ...)`:** Tại dòng `32-44`, `77-83` (giống `ClientCandidatesPage.tsx:225`).
6. **[FE-m02] Bỏ nút giả (no-op button) ở footer `ApplicationWorkbench.tsx` và khóa nút "Yêu cầu chấm lại" khi đang chấm:** Tại dòng `765` (đổi `btn('sourcingStatus', ..., () => {})` thành tag tĩnh) và dòng `1110-1161` (disable nút khi `PENDING`/`PROCESSING`, bỏ nút trùng lặp khi `FAILED`).
7. **[FE-m03] Bổ sung trạng thái `LEFT_DURING_WARRANTY` trong `ApplicationWorkbench.tsx:1089` và `RESIGNED`/`CLOSED` vào nhóm lọc `closed` của `ClientCandidatesPage.tsx:62`.**

---

## 🟢 4. CLEAN / VERIFIED — Các phần đã chuẩn chỉnh cho Production

- **Xác thực Service-to-Service (`CryptographicOperations.FixedTimeEquals` & `secrets.compare_digest`):** Cả `InternalServiceAuthFilter.cs` ở Backend lẫn `ai-service-v2` đều xác thực `X-Service-Token` bằng thuật toán hằng thời gian chống timing attack, khóa `/docs` và `/api/v1/match-file` mặc định trên production.
- **Bảo vệ khi tải CV PDF & Chống lộ Token / DoS (`HRConnectClient.cs` & `hrconnect_client.py`):** Tải CV qua presigned URL bằng HTTP client độc lập không đính kèm `X-Service-Token`, không tự follow redirect, giới hạn dung lượng stream và kiểm tra magic bytes `%PDF`.
- **Phân quyền Sàng lọc (`ScreeningPolicy`) & Cô lập Vai trò:** `CV_APPLICATION` chỉ do Client sàng lọc; `HEADHUNT_COD` và `CV_SOURCING` chỉ do Internal HR tiền sàng lọc ở `SUBMITTED`/`SCREENING`, cấm Internal HR chuyển sang `BACKUP` (`403 Forbidden`).
- **Chính sách Hiển thị & Che thông tin (`ClientVisibilityPolicy` & `MaskedCvService`):** Với `CV_SOURCING`, Client chỉ thấy hồ sơ đã có bản ghi `SourcingDelivery` (`404` nếu chưa giao); với `HEADHUNT_COD`, Client chỉ thấy hồ sơ từ `SHORTLISTED` trở đi và bị che hoàn toàn Email/SĐT/Địa chỉ/CV gốc cho tới khi `PLACED` (chỉ xem được PDF đã redact qua `/cv/masked`).
- **Hậu kiểm bằng chứng AI (`ai-service-v2/app/verification.py`):** Đối chiếu từng câu trích dẫn (`evidence_quotes`) của LLM với văn bản CV thực tế; nếu không khớp sẽ tự động hạ xuống `NOT_FOUND` (`LLM_UNVERIFIED`) và bật cờ `requiresManualReview = True`.

