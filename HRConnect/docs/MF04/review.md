# Báo cáo Production Readiness Audit — MF-04 (Phỏng vấn, Offer, Xác nhận đi làm / Placement & Đối soát)

> [!IMPORTANT]
> **YÊU CẦU BẮT BUỘC DÀNH CHO AI & DEV KHI SỬA CODE:**
> - Khi sửa xong **1 chức năng hoặc 1 đoạn code** là **commit & push liền**, tuyệt đối **không chờ làm xong hết mới push**.
> - Xong **1 chức năng / đoạn code bên Backend (BE)** (đã build & pass test liên quan) $\rightarrow$ **push liền**.
> - Xong **1 chức năng / đoạn code bên Frontend (FE)** (đã lint/build & pass test liên quan) $\rightarrow$ **push liền**.
> - Chia nhỏ từng commit/push theo từng mục lỗi (`[BE-M01]`, `[FE-M01]`, ...), không gom toàn bộ vào một lần push cuối cùng.

> **Phạm vi kiểm tra (Strict MF-04 Scope):** Bám sát tuyệt đối tài liệu thiết kế `docs/diagrams/workflows/source/wf-mf04-interview-offer.mmd`, `docs/diagrams/classes/source/cls-mf04-interview-offer.mmd`, `HRConnect/docs/MF04/company-owned-hiring-flow.md` và `HRConnect/docs/MF04/interview-offer-placement.md`, kết hợp bộ tiêu chuẩn **Ponytail** (Anti-Overengineering), **Vercel Web Interface Guidelines** và **Anthropic Frontend Design**. Không đề xuất tính năng ngoài scope.

## Tổng quan Kết quả

> **Cập nhật 16/11/2026:** danh sách lỗi chi tiết bên dưới được giữ làm dấu vết kiểm toán. Bảng này là trạng thái hiện hành và thay thế các con số tại thời điểm audit ban đầu.

| Nhóm | Trạng thái hiện tại | Ghi chú |
| :--- | :--- | :--- |
| **Critical** | ✅ Không phát hiện | Không có lỗi vượt quyền ghi hoặc làm sập luồng MF-04 trong phạm vi đã kiểm tra |
| **Major đã xử lý** | ✅ `BE-M01` → `BE-M03`, `FE-M01` → `FE-M06` | Đã che dữ liệu nội bộ, sửa email Offer hết hạn, đồng bộ realtime/validation/filter/phân trang và luồng sửa ngày đi làm |
| **Major chờ quyết định nghiệp vụ** | ⏸️ `BE-M04` | Không tự thêm chặn Placement full-time thứ hai: hệ thống hiện cho Candidate cam kết chuyển việc nhưng chưa có luồng kết thúc Placement tổng quát cho mọi loại dịch vụ; bật chặn ngay có thể tạo deadlock nghiệp vụ |
| **Minor đã xử lý** | ✅ `FE-m01` → `FE-m05`, `BE-m01` | Công thức quá giờ, nhãn trạng thái/type cũ, giới hạn dời ngày, refresh 409 và quyền xem hồ sơ dự phòng đã được cập nhật |
| **Minor ngoài phạm vi lần sửa này** | ⏸️ `BE-m02` | Thay đổi quyền `PLATFORM_ADMIN` là thay đổi RBAC liên phân hệ, cần được nhóm chốt riêng |
| **Bổ sung sau audit** | ✅ Tìm kiếm server-side | Interview, Offer và Placement tìm theo tên ứng viên/vị trí **trước phân trang**; FE không còn lọc cục bộ 10 dòng hiện tại |

### Kết quả kiểm tra của lần cập nhật này

- Backend: test tập trung cho `GetInterviewsQueryHandler`, `GetOffersQueryHandler`, `GetPlacementsQueryHandler` đều pass.
- Frontend: `ClientInterviewsOffersPage.test.tsx` pass `6/6`; `npx tsc --noEmit` pass.
- Không thêm bảng/migration; không sửa quy tắc phí, hoa hồng, bảo hành hoặc settlement thuộc MF-05.
- Không triển khai lại `BE-M04` cho đến khi có quy tắc kết thúc/chuyển tiếp Placement rõ ràng.

---

## 🔴 1. CRITICAL — Lỗi nghiêm trọng
*(Không phát hiện lỗi mức Critical làm sập luồng hoặc cho phép vượt quyền ghi trái phép giữa các Role).*

---

## 🟠 2. MAJOR — Lỗi bảo mật dữ liệu nội bộ, Lệch Contract API (`400`/`409`) & Mất đồng bộ Realtime

### Backend Major Issues

#### [BE-M01] Rò rỉ `StatusReason` nội bộ và `Interview.ConcurrencyToken` cho Candidate tại API chi tiết hồ sơ ứng tuyển
- **Vị trí:** `HRConnect/HRConnect.Application/Features/Recruitment/Queries/GetRecruitmentApplicationDetail/GetCandidateRecruitmentApplicationDetailQueryHandler.cs` (dòng `81` và `158-160`)
- **Nguyên nhân:**
  1. Dòng `81`: `CandidateInterviewSummaryDto` trả trực tiếp `ConcurrencyToken = i.ConcurrencyToken` cho Candidate, vi phạm đặc tả `interview-offer-placement.md` (dòng `139-141`) và `company-owned-hiring-flow.md` (dòng `88-90`): *"Candidate không nhận danh sách người phỏng vấn, feedback nội bộ, actor nội bộ, lý do history nội bộ hoặc concurrency token của Interview"*.
  2. Dòng `158-160`: Trả trực tiếp `StatusReason = app.StatusReason` cho Candidate. Khi Company đánh dấu `NOT_STARTED`, từ chối khi sàng lọc, hoặc chuyển sang `BACKUP`, ghi chú nội bộ của Company/HR được lưu vào `app.StatusReason` và bị lộ cho Candidate (vi phạm `interview-offer-placement.md` dòng `278-280`).
- **Hướng sửa:** Gán `ConcurrencyToken = null` trong `CandidateInterviewSummaryDto` và chỉ trả `StatusReason` cho Candidate khi hồ sơ do chính Candidate rút (`WITHDRAWN`).

#### [BE-M02] Rò rỉ thông tin vận hành nội bộ (`CreatedBy`, `Approvals`, lý do thu hồi Offer, ghi chú xác nhận Placement) cho Candidate & hiển thị sai Timeline khi Offer bị thu hồi
- **Vị trí:**
  - `HRConnect/HRConnect.Application/Features/Offers/Queries/GetOfferDetail/GetOfferDetailQueryHandler.cs` (dòng `112-134`)
  - `HRConnect/HRConnect.Application/Features/Offers/Queries/GetOffers/GetOffersQueryHandler.cs` (dòng `104`)
  - `HRConnect/HRConnect.Application/Features/Recruitment/Queries/GetRecruitmentApplicationDetail/GetCandidateRecruitmentApplicationDetailQueryHandler.cs` (dòng `105`)
  - `HRConnect/HRConnect.Application/Features/Recruitment/Queries/GetRecruitmentApplicationTimeline/GetRecruitmentApplicationTimelineQueryHandler.cs` (dòng `272-286`)
  - `HRConnect/HRConnect.Application/Features/Placements/Queries/GetPlacementDetail/GetPlacementDetailQueryHandler.cs` (dòng `82-84`, `97-119`, `209-212`)
- **Nguyên nhân:**
  1. `GetOfferDetailQueryHandler`: Khi `request.IsCandidate == true`, vẫn trả `CreatedBy` (UserId, DisplayName, Email của nhân sự Company) và danh sách `Approvals` nội bộ.
  2. Khi Company thu hồi Offer (`WITHDRAWN`), lý do thu hồi nội bộ lưu trong `offer.DeclineReason` vẫn được trả thẳng cho Candidate.
  3. `GetRecruitmentApplicationTimelineQueryHandler` (dòng `272-286`): Kiểm tra `o.Status == "ACCEPTED" ? "OFFER_ACCEPTED" : "OFFER_DECLINED"`. Nếu Offer từng được Candidate `ACCEPTED` nhưng sau đó chuyển sang `WITHDRAWN`, timeline của Candidate hiển thị sai thành `"Bạn đã từ chối lời mời nhận việc"` kèm lý do nội bộ.
  4. `GetPlacementDetailQueryHandler`: Khi Candidate xem Placement, vẫn trả `ConfirmedBy`, `ConfirmedByName`, `ConfirmationNote`, `Probation.Notes`, `Warranty.ResultNote` (vi phạm `interview-offer-placement.md` dòng `453-454`).
- **Hướng sửa:** Ẩn các trường nội bộ khi `request.IsCandidate == true`, chỉ trả `DeclineReason` khi `offer.Status == OfferStates.Declined`, và trong Timeline chỉ sinh sự kiện `OFFER_DECLINED` khi `o.Status == "DECLINED"`.

#### [BE-M03] `OfferExpiryWorker` thiếu `.Include(a => a.Job).ThenInclude(j => j.Company)` làm email hết hạn Offer bị mất tên công việc và tên công ty
- **Vị trí:**
  - `HRConnect/HRConnect.Infrastructure/Services/Offers/OfferExpiryWorker.cs` (dòng `75-78`)
  - `HRConnect/HRConnect.Application/Features/Recruitment/Common/CandidateRecruitmentDeliveryService.cs` (dòng `456-466`)
- **Nguyên nhân:** Truy vấn nạp các Offer quá hạn chỉ `.Include(item => item.Application).ThenInclude(application => application.Candidate)` mà thiếu `.Include(... => application.Job).ThenInclude(job => job.Company)`. Khi gửi email thông báo hết hạn Offer, `offer.Application?.Job?.Title` và `CompanyName` đều bị `null`, khiến email luôn fallback thành `"vị trí ứng tuyển"` và mất tên doanh nghiệp.
- **Hướng sửa:** Bổ sung `.Include(item => item.Application).ThenInclude(application => application.Job).ThenInclude(job => job.Company)` tại `OfferExpiryWorker.cs:76-77`.

#### [BE-M04] `ConfirmStartWorkCommandHandler` chưa chặn `409 Conflict` khi ứng viên đang có Placement `FULL_TIME/STARTED` khác đang hoạt động
- **Vị trí:** `HRConnect/HRConnect.Application/Features/Recruitment/Commands/ConfirmStartWork/ConfirmStartWorkCommandHandler.cs` (dòng `215-230`)
- **Nguyên nhân:** Đặc tả `interview-offer-placement.md` (dòng `229-231`) quy định: *"Nếu đã có Placement `FULL_TIME/STARTED`, Candidate không thể chấp nhận thêm Offer `FULL_TIME`, và Company cũng không thể xác nhận thêm một Placement toàn thời gian đang hoạt động."* Hiện tại khi `activeFullTimePlacement != null`, handler chỉ `_logger.LogInformation(...)` mà không trả lỗi `409 Conflict`.
- **Hướng sửa:** Trả về `Result.Failure<ConfirmStartWorkResponse>(Error.Conflict("CANDIDATE_ALREADY_WORKING_FULL_TIME", "Ứng viên đã được xác nhận nhận việc toàn thời gian tại một vị trí khác."))` khi `activeFullTimePlacement is not null`.

---

### Frontend Major Issues

#### [FE-M01] Thiếu Query Keys trong `notificationRefreshKeys.ts` và `ClientInterviewDetailDrawer.tsx` khiến UI không tự cập nhật qua SignalR hoặc sau thao tác
- **Vị trí:**
  - `HRConnect-FE/src/hooks/notificationRefreshKeys.ts` (dòng `6-39`)
  - `HRConnect-FE/src/features/client-console/ClientInterviewDetailDrawer.tsx` (dòng `101-108`)
  - `HRConnect-FE/src/features/candidates/CandidateInterviewDetailView.tsx` (dòng `79-84`)
- **Nguyên nhân:**
  1. `notificationRefreshKeys.ts`:
     - Thiếu `['client-pipeline']` trong các nhóm `APPLICATION`, `INTERVIEW`, `OFFER`, `PLACEMENT`, `PLACEMENT_RECONCILIATION` -> Màn hình `ClientInterviewsOffersPage.tsx` không tự làm mới khi Candidate xác nhận phỏng vấn / phản hồi Offer hoặc khi HR đối soát.
     - Thiếu `['candidate', 'interviews']` trong nhóm `INTERVIEW` -> Trang chi tiết phỏng vấn của Candidate không tự làm mới khi Client dời/hủy lịch.
     - Thiếu `['candidate-offer']`, `['candidate-offer-versions']`, `['candidate-offer-impact']` trong nhóm `OFFER` -> Trang `CandidateOfferPage.tsx` không tự làm mới khi Client gửi lại hoặc thu hồi Offer.
  2. `ClientInterviewDetailDrawer.tsx:101-108`: Hàm `invalidateAll()` quên invalidate `['client-pipeline']` và `['client-candidates']`, nên sau khi thao tác trong Drawer thì bảng danh sách bên dưới vẫn giữ trạng thái cũ.
  3. `CandidateInterviewDetailView.tsx:79-84`: Sau khi `confirmAttendance` thành công, chưa invalidate `['candidate-applications']`.
- **Hướng sửa:** Bổ sung đầy đủ các query keys trên vào `notificationRefreshKeys.ts`, `ClientInterviewDetailDrawer.tsx` và `CandidateInterviewDetailView.tsx`.

#### [FE-M02] Lệch validation với Backend (`400 Bad Request`) khi chọn hình thức phỏng vấn `PHONE` trong `ClientInterviewDetailDrawer.tsx`
- **Vị trí:** `HRConnect-FE/src/features/client-console/ClientInterviewDetailDrawer.tsx` (dòng `615-621`)
- **Nguyên nhân:** Modal **"Chỉnh sửa thông tin phỏng vấn"** vẫn cho phép chọn `{ value: 'PHONE', label: 'Điện thoại' }`, trong khi Backend (`Mf04InputPolicy.NormalizeInterviewType`) chỉ chấp nhận `ONLINE` hoặc `OFFLINE` khi tạo mới/cập nhật hình thức phỏng vấn (giá trị `PHONE` cũ chỉ được giữ nguyên khi dời lịch), gây lỗi `400 Bad Request`.
- **Hướng sửa:** Bỏ option `PHONE` khỏi `Select` trong `ClientInterviewDetailDrawer.tsx:617-621` (đồng bộ với `ApplicationWorkbench.tsx:124-127`).

#### [FE-M03] Lệch validation với Backend (`400 Bad Request`) khi đánh dấu "Không đi làm" (`MARK_NOT_STARTED`) với lý do `EMPLOYER_CANCELLED`
- **Vị trí:** `HRConnect-FE/src/features/recruitment/ApplicationWorkbench.tsx` (dòng `1470-1479`)
- **Nguyên nhân:** Dòng `1473` chỉ đặt `const required = code === 'CANDIDATE_OTHER';`, khiến khi chọn `EMPLOYER_CANCELLED` ("Doanh nghiệp dừng tiếp nhận") thì ô lý do hiển thị `"Ghi chú (không bắt buộc)"`. Nhưng Backend (`MarkNotStartedCommandHandler.cs:62-65`) bắt buộc phải nhập lý do cho cả `CANDIDATE_OTHER` lẫn `EMPLOYER_CANCELLED`, dẫn đến lỗi `400 Bad Request` nếu để trống.
- **Hướng sửa:** Đổi thành `const required = code === 'CANDIDATE_OTHER' || code === 'EMPLOYER_CANCELLED';`.

#### [FE-M04] Bộ lọc Tin tuyển dụng (`jobFilter`) trên `ClientInterviewsOffersPage.tsx` chỉ lọc cục bộ trên 1 trang 10 dòng và lệch tổng phân trang
- **Vị trí:** `HRConnect-FE/src/features/client-console/ClientInterviewsOffersPage.tsx` (dòng `170-182`, `216-243`, `1044`, `1105`, `1125`, `1145`)
- **Nguyên nhân:** Query `listQ` gọi `/interviews`, `/offers`, `/placements` với `pageSize: 10` nhưng không truyền `jobId` lên server (dù cả 3 endpoint BE đều hỗ trợ `[FromQuery] Guid? jobId`), mà lại lọc `jobFilter` ở client-side trên mảng 10 dòng của trang 1 bằng cách so sánh tên `item.jobTitle !== targetJob.title` và truyền `pagination.total = listQ.data?.total`, gây thiếu kết quả ở các trang sau và lệch số lượng phân trang.
- **Hướng sửa:** Truyền `jobId: jobFilter !== 'ALL' ? jobFilter : undefined` trực tiếp vào params API và reset `page = 1` khi đổi filter.

#### [FE-M05] Modal "Dời lịch phỏng vấn" trong `ClientInterviewDetailDrawer.tsx` chưa chặn chọn ngày/giờ quá khứ
- **Vị trí:** `HRConnect-FE/src/features/client-console/ClientInterviewDetailDrawer.tsx` (dòng `660-666`)
- **Nguyên nhân:** `DatePicker` của `newScheduledAt` thiếu `disabledDate` và validator kiểm tra thời gian tương lai (khác với `ApplicationWorkbench.tsx:1395-1401`), khiến người dùng chọn nhầm giờ quá khứ và bị lỗi `400 Bad Request` khi bấm Lưu.
- **Hướng sửa:** Thêm `disabledDate` chặn ngày quá khứ và rule kiểm tra `value.isAfter(dayjs())`.

#### [FE-M06] Luồng "Sửa ngày đi làm" thiếu truyền `?highlight=` từ trang Đối soát và chưa khóa nút khi quá hạn 7 ngày
- **Vị trí:**
  - `HRConnect-FE/src/features/hr-console/PlacementReconciliationPage.tsx` (dòng `213`)
  - `HRConnect-FE/src/features/hr-console/HrPlacementStartDateCorrectionPage.tsx` (dòng `184-194`)
- **Nguyên nhân:**
  1. `PlacementReconciliationPage.tsx:213` gọi `navigate('/hr/placement-review')` thiếu `?highlight=${selected.placementId}` (trong khi trang đích đã hỗ trợ đọc param `highlight` để tự mở Drawer).
  2. `HrPlacementStartDateCorrectionPage.tsx:184-194` chưa kiểm tra điều kiện quá 7 ngày kể từ `confirmedAt` để disable nút `"Sửa ngày đi làm"`, khiến HR phải nhập xong bấm Lưu mới nhận lỗi `409 Conflict`.
- **Hướng sửa:** Truyền `?highlight=${selected.placementId}` khi điều hướng và disable nút kèm chú thích khi `dayjs().diff(dayjs(detail.data.confirmedAt), 'day') > 7`.

---

## 🟡 3. MINOR — Tinh chỉnh UI/UX, Thuật ngữ & Code Hygiene

1. **[FE-m01] Đồng nhất công thức tính "Quá giờ phỏng vấn" (`isOverdue`) tại `ClientInterviewsOffersPage.tsx`:** Dòng `353` đang kiểm tra `dayjs(r.scheduledAt).isBefore(dayjs())` (vừa bắt đầu đã báo quá giờ), lệch với hàm chuẩn `isInterviewOverdue(r)` trong `interviewTiming.ts` (cộng thêm `durationMinutes` mới tính là quá giờ và cho phép ghi kết quả).
2. **[FE-m02] Việt hóa trạng thái trong lịch sử phỏng vấn:** Tại `ClientInterviewDetailDrawer.tsx` (dòng `560-564`) và `ApplicationWorkbench.tsx` (dòng `1738-1740`), đang hiển thị mã thô `SCHEDULED → COMPLETED` -> nên dùng nhãn tiếng Việt như `CandidateInterviewDetailView.tsx`.
3. **[FE-m03] Sử dụng `plannedStartChangeCount` trong Modal cập nhật ngày dự kiến đi làm:** Tại `ApplicationWorkbench.tsx` (dòng `215`, `1645-1662`), biến `plannedStartChangeCount` đã tính nhưng chưa dùng; nên hiển thị số lần đã lùi (`x/3 lần`) và chặn chọn quá 60 ngày sau `acceptedOffer.startDate`.
4. **[FE-m04] Hiển thị hình thức phỏng vấn legacy `PHONE` trên `CandidateInterviewDetailView.tsx`:** Tại dòng `133` và `164`, dùng helper `candidateInterviewType(interview.interviewType)` để không hiển thị nhầm bản ghi `PHONE` cũ thành `"Trực tiếp tại văn phòng"`.
5. **[FE-m05] Tự động làm mới danh sách khi gặp lỗi `409 Conflict` trên `PlacementReconciliationPage.tsx`:** Tại dòng `91-107`, invalidate `['placement-reconciliations']` khi gặp lỗi `409` để lấy `concurrencyToken` mới.
6. **[BE-m01] Bổ sung `Backup` và `BackupNotSelected` vào `ClientVisibilityPolicy.PostShortlistStatuses`:** Tại `ClientVisibilityPolicy.cs` (dòng `24-34`), để hàm `CanClientSeeHeadhuntApplication` luôn trả về `true` cho ứng viên `HEADHUNT_COD` đang ở trạng thái dự phòng.
7. **[BE-m02] Lược bỏ các permission mutation tuyển dụng dư thừa của `PLATFORM_ADMIN` trong `DatabaseSeeder.cs`:** Tại `DatabaseSeeder.cs` (dòng `284`), giữ đúng tinh thần Company-owned hiring flow (`company-owned-hiring-flow.md`).

---

## 🟢 4. CLEAN / VERIFIED — Các phần đã chuẩn chỉnh cho Production

- **Cô lập quyền `INTERNAL_HR` (Company-Owned Hiring Flow):** Toàn bộ 14 command mutation tuyển dụng (`ScheduleInterview`, `RecordInterviewResult`, `DecideBackupApplication`, `SendOffer`, `WithdrawOffer`, `ConfirmStartWork`, `MarkNotStarted`...) đều kiểm tra chặt `IsClientCompanyUser`, `CompanyMembershipPolicy.IsActive(companyUser)` và `job.CompanyId == companyUser.CompanyId`. `INTERNAL_HR` chỉ được phép đối soát (`ReconcilePlacement`) và sửa ngày đi làm (`CorrectPlacementStartDate`).
- **Bảo vệ thông tin liên hệ & CV cho `HEADHUNT_COD` (`ClientVisibilityPolicy`):** Che hoàn toàn Email, SĐT, Địa chỉ, CV gốc trước khi hồ sơ đạt `PLACED` trên mọi API Application, Interview, Offer.
- **Bảo mật dữ liệu cho Affiliate:** `GetAffiliateReferralProgressQueryHandler` chỉ trả tiến độ tổng quát đã sanitize, không lộ lịch phỏng vấn, feedback, lương hay nội dung Offer.
- **Concurrency, Unique Index & Candidate Lock:** `Mf04ConcurrencyGuard` bảo vệ mọi mutation; unique index `ux_interview_one_scheduled_per_application` chặn tạo trùng lịch phỏng vấn; `_candidateLock.AcquireAsync(candidateId)` chống race condition khi Candidate phản hồi nhiều Offer cùng lúc.
- **Email Outbox Fallback & Delivery Check:** Tự động gửi cả In-App Notification + Email Outbox, fallback sang Email nếu Candidate chưa có tài khoản, và chặn `400 CANDIDATE_DELIVERY_UNAVAILABLE` nếu thiếu cả 2 kênh.

