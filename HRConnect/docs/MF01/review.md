# Báo cáo Production Readiness Audit — MF-01 (Quản lý Tin tuyển dụng, Duyệt tin, Hợp đồng dịch vụ & Phí đăng tin / Đặt cọc)

> [!IMPORTANT]
> **YÊU CẦU BẮT BUỘC DÀNH CHO AI & DEV KHI SỬA CODE:**
> - Khi sửa xong **1 chức năng hoặc 1 đoạn code** là **commit & push liền**, tuyệt đối **không chờ làm xong hết mới push**.
> - Xong **1 chức năng / đoạn code bên Backend (BE)** (đã build & pass test liên quan) $\rightarrow$ **push liền**.
> - Xong **1 chức năng / đoạn code bên Frontend (FE)** (đã lint/build & pass test liên quan) $\rightarrow$ **push liền**.
> - Chia nhỏ từng commit/push theo từng mục lỗi (`[BE-C01]`, `[FE-C01]`, ...), không gom toàn bộ vào một lần push cuối cùng.

> **Phạm vi kiểm tra (Strict MF-01 Scope):** Bám sát tuyệt đối tài liệu thiết kế `docs/diagrams/workflows/source/wf-mf01-job-publishing.mmd`, `docs/diagrams/classes/source/cls-mf01-job-agreement.mmd` và `HRConnect/docs/MF01/README.md`, kết hợp bộ tiêu chuẩn **Ponytail** (Anti-Overengineering), **Vercel Web Interface Guidelines** và **Anthropic Frontend Design**. Không đề xuất thêm tính năng ngoài scope.

## Tổng quan Kết quả

| Hạng mục | Trạng thái hiện tại | Chi tiết |
| :--- | :--- | :--- |
| **Backend Unit/Integration Tests** | ✅ Pass `190/190` | Tất cả test `Jobs` hiện có chạy xanh |
| **Frontend Unit Tests (`vitest`)** | ✅ Pass `44/44` (11 files) | Có 1 cảnh báo thiếu MSW mock `GET /api/v1/jobs/posting-packages` trong `JobReviewPage.test.tsx` |
| **🔴 Critical Bugs (Cần sửa bắt buộc trước Production)** | **5 vấn đề** | **3 Backend + 2 Frontend** (Rò rỉ phí gói `STANDARD`, lỗi không ký được hợp đồng khi dùng default, mất điều khoản khi duyệt bản ký ướt, lỗi thanh toán VNPay từ thông báo) |
| **🟠 Major Issues (Nên sửa để khép kín luồng & realtime)** | **11 vấn đề** | **5 Backend + 6 Frontend** (Rơi `depositPercent`, nuốt lỗi khi xác nhận cọc, thiếu invalidate SignalR cho `SERVICE_FEE`/`ONLINE_PAYMENT`, thiếu chặn trạng thái) |
| **🟡 Minor Polish (UI/UX, Thuật ngữ & Code Hygiene)** | **8 vấn đề** | **3 Backend + 5 Frontend** (Nhãn nút duyệt `CV_APPLICATION`, ước tính hoa hồng fallback cứng `15tr`, dọn code demo `localStorage`) |

---

## 🔴 1. CRITICAL — Lỗi nghiêm trọng (Sai lệch thanh toán / Mất dữ liệu / Chặn luồng chính)

### [BE-C01] Bypass thanh toán gói `STANDARD` (`1.500.000đ`) khi đổi gói sau khi bị từ chối hoặc sửa nháp
- **Vị trí:**
  - `HRConnect/HRConnect.Application/Features/Jobs/Commands/SubmitJob/SubmitJobCommand.cs` (dòng `121-162`)
  - `HRConnect/HRConnect.Application/Features/Jobs/Commands/ApproveJob/ApproveJobCommand.cs` (dòng `278-316`)
  - `HRConnect/HRConnect.Application/Features/Jobs/Commands/UpdateJob/UpdateJobCommandHandler.cs` (dòng `69-81`)
- **Nguyên nhân:**
  1. Client tạo Job gói `FREE` và gửi duyệt (`SubmitJob`) -> hệ thống tạo `JobPostingFee` với `Amount = 0, Status = PAID, PaymentReference = "FREE_TIER"`.
  2. Khi HR từ chối (`REJECTED`), Client dùng `UpdateJob` đổi `PostingPackageId` sang gói trả phí `STANDARD` rồi `SubmitJob` lại: `GetPostingFeeByJobIdAsync` trả về bản ghi `existingFee != null` của gói `FREE` cũ và **không cập nhật** sang gói `STANDARD` (`PENDING`).
  3. Khi HR duyệt tin (`ApproveJob`), `fee.Status` vẫn là `PAID` nên `requiresPayment = false` -> Job gói `STANDARD` được **kích hoạt `ACTIVE` miễn phí hoàn toàn**.
  4. Chiều ngược lại: Tạo nháp với gói `STANDARD` (tạo sẵn `JobPostingFee` `PENDING` `1.500.000đ`), sau đó sửa nháp đổi sang `FREE` hoặc đổi dịch vụ sang `HEADHUNT_COD`/`CV_SOURCING` thì bản ghi phí `PENDING` cũ không bị hủy/cập nhật.
- **Hướng sửa:** Trong `SubmitJobCommand` và `UpdateJobCommandHandler`, đồng bộ lại `existingFee` khi `PostingPackageId` hoặc `ServiceTypeId` thay đổi (nếu `existingFee` là `FREE_TIER` hoặc `PENDING` thì cập nhật theo gói mới).

### [BE-C02] Không thể ký OTP thỏa thuận `CV_SOURCING` (hoặc mất điều khoản `HEADHUNT_COD`) khi dùng giá trị mặc định lúc tạo đề xuất
- **Vị trí:**
  - `HRConnect/HRConnect.Application/Features/Jobs/ServiceAgreements/CreateServiceAgreementProposalCommand.cs` (dòng `79-107` và `146-151`)
  - `HRConnect/HRConnect.Application/Features/Jobs/ServiceAgreements/SignServiceAgreementCommand.cs` (dòng `215-220` và `260-270`)
- **Nguyên nhân:** `CreateServiceAgreementProposalCommand` đã tính các biến fallback (`multiplier`, `warranty`, `paymentDue`, `target`, `price`, `review`) để validate, nhưng lúc khởi tạo entity `ServiceAgreement` ở dòng 146–151 lại gán `request.PricePerQualifiedCv ?? job.ProposedPricePerCv` (bỏ qua giá trị fallback mặc định hệ thống). Nếu cả Client lẫn HR để trống để dùng mặc định hệ thống, `ServiceAgreement.PricePerQualifiedCv` bị lưu `null`, khiến bước ký OTP `SignServiceAgreementCommand` ném lỗi `409 Conflict (SOURCING_DEPOSIT_NOT_CREATED)` và chặn đứng việc ký hợp đồng.
- **Hướng sửa:** Lưu trực tiếp các giá trị đã resolve (bao gồm cả default từ `IAdminBusinessSettings`) vào `ServiceAgreement` lúc tạo đề xuất.

### [BE-C03] `ApproveJobCommandHandler` cập nhật `ServiceAgreement` trên bản sao `AsNoTracking()` và sót fallback điều khoản từ hợp đồng ký ướt
- **Vị trí:**
  - `HRConnect/HRConnect.Application/Features/Jobs/Commands/ApproveJob/ApproveJobCommand.cs` (dòng `103-135`, `170-220`, `365-386`)
  - `HRConnect/HRConnect.Infrastructure/Repositories/ServiceAgreementRepository.cs` (dòng `46-55`)
- **Nguyên nhân:**
  1. Dòng 379 gọi `_agreements.GetCurrentByJobIdAsync` (dùng `.AsNoTracking()`) để gán `currentAgreement.Status = Signed` nên `SaveChangesAsync` không lưu trạng thái `SIGNED` xuống DB.
  2. Với `CV_SOURCING` ký ướt, hàm return sớm ở dòng 369 (`PendingPayment`) trước khi cập nhật trạng thái `ServiceAgreement`.
  3. Khi `request.CommercialTerms == null` (như lúc HR bấm xác nhận bản ký ướt), `ApproveJobCommand` chỉ fallback về `job.Proposed*` mà quên đọc điều khoản HR đã chốt trong `job.CurrentServiceAgreement`.
- **Hướng sửa:** Thao tác trực tiếp trên `job.CurrentServiceAgreement` (đã được track), đặt trước nhánh `if (requiresPayment)`, và ưu tiên lấy điều khoản từ `job.CurrentServiceAgreement` khi `request.CommercialTerms == null`.

### [FE-C01] Mất điều khoản đã thương lượng & mã hợp đồng khi HR bấm "Xác nhận & Công khai tin" sau khi Client tải bản ký ướt
- **Vị trí:** `HRConnect-FE/src/features/jobs-mf01/JobReviewPage.tsx` (dòng `504-525`, `handleConfirmSignedAgreement`)
- **Nguyên nhân:** Khi HR bấm **"Xác nhận & Công khai tin"** cho bản hợp đồng ký ướt, `handleConfirmSignedAgreement` gọi `jobsApi.approve(job.jobId, { concurrencyToken, note })` mà không truyền `commercialTerms` và `agreementReference` từ `currentAgreement`, kết hợp với `[BE-C03]` làm mất toàn bộ điều khoản HR đã thương lượng.
- **Hướng sửa:** Truyền kèm `commercialTerms` và `agreementReference` từ `currentAgreement` (cùng `depositPercent`), đồng thời sửa `[BE-C03]` ở Backend để bảo vệ cả 2 đầu.

### [FE-C02] Deep-link `?openPayment=true` từ thông báo làm hỏng luồng thanh toán VNPay cho tiền cọc `CV_SOURCING`
- **Vị trí:**
  - `HRConnect-FE/src/features/jobs-mf01/ClientJobsListPage.tsx` (dòng `187-189`)
  - `HRConnect-FE/src/features/jobs-mf01/PaymentDemoModal.tsx` (dòng `49-70`)
- **Nguyên nhân:** Khi Client bấm vào thông báo yêu cầu nộp cọc `CV_SOURCING` (`?highlight={jobId}&openPayment=true`), `ClientJobsListPage.tsx:188` gọi `setPaymentModalJob({ jobId: targetJob.jobId, title: targetJob.title })` mà thiếu `isDeposit: isAwaitingSourcingDeposit(targetJob)` và `depositAmount: depositOf(targetJob)`. Modal thanh toán hiểu nhầm là `POSTING_FEE` của `CV_APPLICATION` và gọi sai endpoint/targetType VNPay, gây lỗi 404/409.
- **Hướng sửa:** Truyền đầy đủ `isDeposit` và `depositAmount` tại `ClientJobsListPage.tsx:188` giống hệt nút bấm thủ công ở dòng 489.

---

## 🟠 2. MAJOR — Lỗi đồng bộ State, Realtime & Ràng buộc nghiệp vụ

### Backend Major Issues
1. **[BE-M01] `UploadSignedServiceAgreementCommand` cho phép ghi đè hợp đồng đã `SIGNED` và không cập nhật hash:** Tại `HRConnect/HRConnect.Application/Features/Jobs/ServiceAgreements/UploadSignedServiceAgreementCommand.cs` (dòng `86-109`), chỉ chặn khi `Status == Void`, chưa chặn khi thỏa thuận đã `SIGNED` hoặc `CHANGE_REQUESTED`, và chưa tính lại `DocumentSha256Hash` của file upload.
2. **[BE-M02] Không thể Reject Job khi đang ở `PENDING_AGREEMENT`:** `HRConnect/HRConnect.Application/Features/Jobs/Commands/RejectJob/RejectJobCommand.cs` (dòng `30`) chỉ cho phép `PendingReview`, dù `JobTransitions.AllowedTransitions[PendingAgreement]` và `JobDto.AvailableActions` cho phép Reject với mã `REJECTED_TERMS_NOT_AGREED`.
3. **[BE-M03] Thiếu guard loại dịch vụ & trạng thái ở các lệnh Thanh toán / Đặt cọc:**
   - `ConfirmJobDepositCommand.cs` (dòng `50-92`): Chưa kiểm tra Job phải là `CV_SOURCING` và có `depositFee != null`.
   - `NotifyJobDepositCommand.cs` (dòng `65-88`): Chưa chặn spam khi `job.DepositSubmittedAt != null` và chưa kiểm tra `CV_SOURCING`.
   - `RecordJobPostingFeePaymentCommand.cs` (dòng `69-138`): Chưa kiểm tra `job.Status == JobStatuses.PendingPayment`.
4. **[BE-M04] `VoidServiceAgreementCommand` không xóa `job.CurrentServiceAgreementId` và thiếu thông báo cho Client:** Tại `HRConnect/HRConnect.Application/Features/Jobs/ServiceAgreements/VoidServiceAgreementCommand.cs` (dòng `56-74`), khi hủy dự thảo thỏa thuận, `job.CurrentServiceAgreementId` vẫn trỏ vào bản ghi `VOID` khiến `JobDto` vẫn báo `AgreementStatus = "VOID"`.
5. **[BE-M05] `JobHandlerGuards.GetOwnedJobAsync` chưa kiểm tra `member.Status == "ACTIVE"`:** Tại `HRConnect/HRConnect.Application/Features/Jobs/Common/JobHandlerGuards.cs` (dòng `17-22`) và `GetMyJobsQuery.cs` (dòng `25`), cần kiểm tra `member.Status == "ACTIVE"` đồng nhất với `CreateJobCommandHandler`.

### Frontend Major Issues
6. **[FE-M01] Rơi trường `depositPercent` khi HR tạo đề xuất thỏa thuận `CV_SOURCING`:** Trong `CommercialTermsApprovalModal.tsx` (dòng `178-181`) và `JobReviewPage.tsx` (dòng `414-425`), HR nhập được `"Tỷ lệ cọc %"` nhưng `approveWithTerms` không gửi `depositPercent` lên `createProposal`, làm mất tỷ lệ cọc HR vừa chỉnh.
7. **[FE-M02] Nuốt lỗi (Silent Error Swallowing) trong `handleConfirmDeposit`:** Tại `JobReviewPage.tsx` (dòng `608-625`), nếu cả `confirmDeposit` và fallback `approve` đều lỗi, khối `catch` chỉ `console.warn` mà không `throw`, dẫn đến hiển thị `message.success('Đã xác nhận nhận cọc!...')` giả.
8. **[FE-M03] Bất nhất cách đọc `depositAmount` làm khóa nút "Nộp cọc" trong `JobDetailPanel`:** Hàm `sourcingDepositAmount(job)` trong `jobDisplay.ts` (dòng `249-259`) chưa ưu tiên đọc `job.depositAmount` do BE trả về, khiến `JobDetailPanel.tsx` (dòng `395`) tính ra `null` và khóa nút nộp cọc khi `commercialTerms.depositPercent` trống.
9. **[FE-M04] Thiếu Invalidate Query khi HR gửi hợp đồng và khi nhận SignalR `SERVICE_FEE` / `ONLINE_PAYMENT`:**
   - `HRConnect-FE/src/hooks/notificationRefreshKeys.ts` (dòng `13-31`): Khi BE bắn thông báo `SERVICE_FEE` hoặc `ONLINE_PAYMENT` (lúc hoàn tất thanh toán phí/cọc), danh sách `['mf01-jobs']` và `['service-fees']` chưa được invalidate tự động.
   - `JobReviewPage.tsx` (dòng `458`, `639-643`): Cần invalidate đúng `jobQueryKeys.all` (`['mf01-jobs']`) và `['service-fees']`.
10. **[FE-M05] Nút "Tải lên file khác" giả trong `CommercialTermsApprovalModal`:** Tại `CommercialTermsApprovalModal.tsx` (dòng `369-384`), nút upload chỉ đổi tên file trên state local chứ không gửi lên BE (vì BE tự xuất PDF từ điều khoản), dễ làm HR tưởng nhầm đã đính kèm file riêng.
11. **[FE-M06] `JobFormPage` Bước 2 thiếu validate các trường bắt buộc khi bấm "Tiếp tục":** Tại `JobFormPage.tsx` (dòng `1043-1057`), `validateStep(1)` chỉ kiểm tra `title`, `quantity`, `deadline` mà bỏ sót `employmentType`, `workMode`, `location`, `description`, `benefits`, `requirements` (đến Bước 4 bấm "Gửi duyệt" mới chặn).

---

## 🟡 3. MINOR — Tinh chỉnh UI/UX, Thuật ngữ & Code Hygiene

1. **[FE-m01] Nhãn nút duyệt tin ở `JobReviewPage`:** Tại `JobReviewPage.tsx` (dòng `962`), nút đang gắn cứng `"Duyệt & Ký điều khoản"` cho cả gói `CV_APPLICATION` (vốn không có hợp đồng thương mại) -> nên hiển thị `needsTerms ? 'Duyệt & Soạn thỏa thuận' : 'Duyệt tin tuyển dụng'`.
2. **[FE-m02] Đồng nhất điều kiện `isSigned` trên Header `JobReviewPage`:** Tại `JobReviewPage.tsx` (dòng `970-1026`), đồng bộ điều kiện kiểm tra đã ký (`currentAgreement?.status === 'SIGNED' || currentAgreement?.hasSignedDocument || job.hasSignedAgreement`) giữa Header và Banner dòng 1066.
3. **[FE-m03] Hoa hồng ước tính trên `JobDiscoveryPage` (Affiliate):** Tại `JobDiscoveryPage.tsx` (dòng `24-42`), khi lương thỏa thuận (`salaryMax == null`), hàm đang fallback cứng `'15.000.000 đ'` -> nên hiển thị `'Theo thỏa thuận'`.
4. **[FE-m04] Dọn dẹp `localStorage` & `useAlertStore` demo cũ trong `JobReviewPage`:** Xóa các đoạn đẩy alert giả `targetRole: 'CLIENT'` vào Zustand store local tại `JobReviewPage.tsx` (dòng `440-457`) vì BE đã gửi SignalR Notification thật.
5. **[FE-m05] Nhãn `AWAITING_SIGNATURE` trong `jobDisplay.ts`:** Tại `jobDisplay.ts` (dòng `41`), đổi `'Chờ nộp HĐ đã ký'` thành `'Chờ ký hợp đồng'` để bao quát cả ký điện tử OTP lẫn tải bản ký ướt.
6. **[BE-m01] Đồng nhất hàm `ReviewerCan` ở `ServiceAgreementEndpoints.cs` và `JobEndpoints.cs`:** Bỏ điều kiện thừa `|| user.IsInRole(...)` ở `ServiceAgreementEndpoints.cs` (dòng `278-280`) để kiểm tra đúng claim permission như `JobEndpoints.ReviewerCan`.
7. **[BE-m02] Ghi `JobStatusHistory` khi gửi lại đề xuất thỏa thuận `v2+`:** Tại `CreateServiceAgreementProposalCommand.cs` (dòng `184-192`), ghi lịch sử cả khi `job.Status == JobStatuses.PendingAgreement`.
8. **[BE-m03] Nội dung thông báo hết hạn & ngày xuất PDF:** Tại `JobExpirationWorker.cs` (dòng `128`, không hardcode `"30 ngày"` / gợi ý nâng cấp nếu đã là gói trả phí) và `AgreementPdfRenderer.cs` (dòng `57`, dùng `agreement.SignedAt ?? agreement.CreatedAt` thay vì `DateTime.UtcNow` để giữ hash ổn định).

---

## 🟢 4. CLEAN / VERIFIED — Các phần đã chuẩn chỉnh cho Production

- **Chống IDOR & Cô lập dữ liệu theo `CompanyId`:** Tất cả endpoints & handlers của Client đều đối chiếu `CompanyId` và `agreement.JobId == request.JobId`.
- **Bảo mật ký điện tử OTP (`SignServiceAgreement`):** Kiểm tra `IsPrimaryContact`, giới hạn 5 OTP/ngày, cooldown 60s, tối đa 5 lần nhập sai và khóa tự động.
- **Hiển thị công khai & Phân quyền xem (`JobAccessPolicy`):** Tuân thủ ma trận `service_type_allowed_role`, ẩn hoàn toàn Job `DRAFT` với HR/Admin và ẩn thông tin nhạy cảm của doanh nghiệp trên trang Public.
- **Cơ chế Concurrency & Realtime Interceptor:** `ConcurrencyToken` được kiểm tra xuyên suốt; `NotificationPushInterceptor` đẩy SignalR sau khi `SaveChangesAsync` / `CommitTransactionAsync` thành công.

