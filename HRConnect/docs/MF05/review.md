# Báo cáo Production Readiness Audit — MF-05 (Tài chính, Phí dịch vụ, Bảo hành, Suất thay thế, Hoa hồng, Khiếu nại & Chi trả)

> [!IMPORTANT]
> **YÊU CẦU BẮT BUỘC DÀNH CHO AI & DEV KHI SỬA CODE:**
> - Khi sửa xong **1 chức năng hoặc 1 đoạn code** là **commit & push liền**, tuyệt đối **không chờ làm xong hết mới push**.
> - Xong **1 chức năng / đoạn code bên Backend (BE)** (đã build & pass test liên quan) $\rightarrow$ **push liền**.
> - Xong **1 chức năng / đoạn code bên Frontend (FE)** (đã lint/build & pass test liên quan) $\rightarrow$ **push liền**.
> - Chia nhỏ từng commit/push theo từng mục lỗi (`[BE-C01]`, `[FE-C01]`, ...), không gom toàn bộ vào một lần push cuối cùng.

> **Phạm vi kiểm tra (Strict MF-05 Scope):** Bám sát tuyệt đối tài liệu thiết kế `docs/diagrams/workflows/source/wf-mf05-warranty-commission.mmd`, `docs/diagrams/classes/source/cls-mf05-finance.mmd`, `HRConnect/docs/MF05/README.md` và `HRConnect/docs/QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md`, kết hợp bộ tiêu chuẩn **Ponytail** (Anti-Overengineering), **Vercel Web Interface Guidelines** và **Anthropic Frontend Design**. Không đề xuất tính năng ngoài scope.

## Tổng quan Kết quả

| Hạng mục | Trạng thái hiện tại | Chi tiết |
| :--- | :--- | :--- |
| **Backend Unit/Integration Tests** | ✅ Pass `171/171` | Toàn bộ test `Finance`, `Dispute`, `Commission`, `VnPay` chạy xanh |
| **Frontend Unit Tests (`vitest`)** | ✅ Pass `57/57` (5 files) | Toàn bộ test `src/features/finance-mf05` chạy xanh |
| **🔴 Critical Bugs (Cần sửa bắt buộc trước Production)** | **4 vấn đề** | **2 Backend + 2 Frontend** (Không duyệt được hoa hồng của ứng viên thay thế `409 SERVICE_FEE_NOT_PAID`, quyết toán CV Sourcing tạo khống phiếu hoàn tiền `CREDIT` khi cọc chưa trả, Admin không xử lý được khiếu nại do thiếu `concurrencyToken`/`idempotencyKey`, route đối soát của Admin bị redirect nhầm sang `/hr/*` gây Forbidden) |
| **🟠 Major Issues (Cần sửa để chuẩn Production & Realtime)** | **8 vấn đề** | **4 Backend + 4 Frontend** (Thiếu kiểm tra `CompanyMembershipPolicy.IsActive`, lộ đơn giá CV cho Affiliate ở API estimate, bảo hành tự `PASSED` khi đang treo đối soát, hiển thị JSON thô `"[]"` ở trang Khiếu nại, thiếu query keys trong `notificationRefreshKeys.ts`) |
| **🟡 Minor Polish (UI/UX, Thuật ngữ & Code Hygiene)** | **6 vấn đề** | **3 Backend + 3 Frontend** (Thiếu thông báo cho Affiliate khi hoa hồng đạt `EARNED`, thiếu `AuditLog` khi sửa `CommissionRule`, tinh chỉnh nhãn trạng thái và dead code) |

---

## 🔴 1. CRITICAL — Lỗi nghiêm trọng (Chặn luồng nghiệp vụ chính / Sai lệch công nợ & thanh toán)

### [BE-C01] Không thể duyệt hoa hồng (`ApproveCommissionCommand`) cho ứng viên thay thế (`Replacement Placement`) — Lỗi 100% `409 SERVICE_FEE_NOT_PAID`
- **Vị trí:**
  - `HRConnect/HRConnect.Application/Features/Finance/Commands/Settlement/SettlementCommands.cs` (dòng `197-208`)
  - `HRConnect/HRConnect.Infrastructure/Repositories/FinanceRepository.cs` (dòng `273-278`, `505`, `533`)
  - `HRConnect/HRConnect.Application/Features/Finance/Queries/FinanceQueries.cs` (dòng `323`, `416`, `425`)
  - `HRConnect/HRConnect.Application/Features/Finance/Common/SourcingFinanceService.cs` (dòng `49-52`)
- **Nguyên nhân:**
  - Theo mục 1.2 & 1.3 trong `QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md`, ứng viên thay thế không phát sinh phí mới mà lấy từ khoản phí gốc đã trả (`ReplacementSourceServiceFee`), nên trên DB `replacementPlacement.ServiceFee` luôn là `null` và phí gốc nằm tại `replacementPlacement.ReplacementSlot.ServiceFee`.
  - Tuy nhiên, khi ứng viên thay thế hoàn tất 30 ngày bảo hành (`EARNED`) và Admin bấm duyệt chi (`ApproveCommissionCommand`), dòng `199-203` chỉ kiểm tra `var fee = commission.Placement?.ServiceFee;` -> luôn thấy `fee == null` và ném lỗi `409 SERVICE_FEE_NOT_PAID`.
  - Đồng thời trên API `GET /api/v1/commissions` và `GET /api/v1/warranties`, trường `ServiceFeeStatus` của ứng viên thay thế bị trả về `null` thay vì `"PAID"`.
- **Hướng sửa:** Trong `GetCommissionForUpdateAsync` và các query `GetCommissionsAsync` / `GetWarrantiesAsync`, `.Include(p => p.ReplacementSlot).ThenInclude(s => s.ServiceFee)` và lấy phí hiệu lực qua `placement.ServiceFee ?? placement.ReplacementSlot?.ServiceFee`.

### [BE-C02] Quyết toán CV Sourcing (`SettleAsync`) khấu trừ cả tiền cọc `DEPOSIT` chưa thanh toán, tạo khống phiếu hoàn tiền `CREDIT` cho Client
- **Vị trí:**
  - `HRConnect/HRConnect.Application/Features/Finance/Common/SourcingFinanceService.cs` (dòng `200-220`)
  - `HRConnect/HRConnect.Infrastructure/Repositories/FinanceRepository.cs` (dòng `309-322`)
- **Nguyên nhân:**
  - Tại `SourcingFinanceService.cs:200-201`, công thức tính tổng tiền cọc đã đóng đang viết:
    `var deposit = fees.Where(fee => fee.Kind == ServiceFeeKinds.Deposit && fee.Status != ServiceFeeStates.Cancelled).Sum(fee => fee.Amount);`
    (chỉ lọc `Status != Cancelled` thay vì `Status == Paid`).
  - Nếu một Job `CV_SOURCING` vừa duyệt (sinh phiếu `DEPOSIT` ở trạng thái `PENDING`, Client **chưa thanh toán**) rồi Job bị đóng với 0 CV (hoặc ít CV hơn mức cọc), `SourcingFinanceWorker` tự động chạy `SettleAsync`, tính `balance = 0 - deposit < 0` và tạo khống phiếu **`CREDIT` (`REFUND_PENDING`)** báo hoàn tiền cho Client dù Client chưa trả đồng cọc nào!
- **Hướng sửa:** Chỉ cộng `deposit` với các khoản `fee.Kind == ServiceFeeKinds.Deposit && fee.Status == ServiceFeeStates.Paid`; nếu khi quyết toán mà phiếu `DEPOSIT` vẫn đang `PENDING`/`DUE`/`OVERDUE` chưa trả thì chuyển phiếu `DEPOSIT` đó sang `CANCELLED` và chỉ thu đúng `total` thực tế trên phiếu `SETTLEMENT`.

### [FE-C01] Lỗi hợp đồng API `POST /api/v1/admin/disputes/{disputeId}/resolve`: Admin không thể xử lý khiếu nại (luôn lỗi `400` / `409`)
- **Vị trí:**
  - `HRConnect-FE/src/types/api/dispute.ts` (dòng `57-77`, `93-96`)
  - `HRConnect-FE/src/services/api/disputeApi.ts` (dòng `77-86`)
  - `HRConnect-FE/src/features/admin-console/AdminDisputesPage.tsx` (dòng `123-125`, `366`)
  - Đối chiếu BE: `HRConnect/HRConnect.Application/Features/Disputes/DisputeFeatures.cs` (dòng `36-43`, `240-267`)
- **Nguyên nhân:** Backend `ResolveDisputeRequest` bắt buộc 4 trường: `Decision`, `Resolution`, `ConcurrencyToken` (`Guid`), và `IdempotencyKey` (`string` tối đa 100 ký tự). Hiện tại `AdminDisputesPage.tsx` chỉ gửi `{ decision, resolution }`, khiến Backend luôn trả về `400 Bad Request` (`"idempotencyKey là bắt buộc..."`) hoặc `409 Conflict` (`"STALE_DISPUTE_RESOLUTION"`).
- **Hướng sửa:** Bổ sung `concurrencyToken` vào `AdminDisputeDetailDto`, và truyền `concurrencyToken: d.concurrencyToken, idempotencyKey: crypto.randomUUID()` khi gọi `disputeApi.resolve`.

### [FE-C02] Nút "Mở danh sách đối soát" trên `AdminFinancePage.tsx` điều hướng Platform Admin sang `/hr/placement-reconciliations` gây lỗi Forbidden
- **Vị trí:**
  - `HRConnect-FE/src/features/finance-mf05/AdminFinancePage.tsx` (dòng `103-106`, `631-640`)
  - `HRConnect-FE/src/app/router.tsx` (dòng `234`)
  - `HRConnect-FE/src/routes/AppRoutes.tsx` (dòng `116-118`)
- **Nguyên nhân:** Trên `AdminFinancePage.tsx`, khi có hồ sơ đối soát bị gắn cờ `FLAGGED`, nút **"Mở danh sách đối soát"** điều hướng tới `/admin/placement-reconciliations`. Tuy nhiên ở `router.tsx:234`, route này đang bị cấu hình `<Navigate to="/hr/placement-reconciliations" replace />` (thuộc nhánh `/hr/*` chỉ cho phép role `INTERNAL_HR`), khiến Platform Admin bị đẩy về `/dashboard?reason=forbidden` dù component `AppRoutes.AdminPlacementReconciliationPage` đã viết sẵn ở `AppRoutes.tsx:116-118`.
- **Hướng sửa:** Gắn `<AppRoutes.AdminPlacementReconciliationPage />` vào route `/admin/placement-reconciliations` tại `router.tsx:234`.

---

## 🟠 2. MAJOR — Lỗi phân quyền, Bảo mật dữ liệu chéo Role & Đồng bộ Realtime

### Backend Major Issues

1. **[BE-M01] Thiếu kiểm tra `CompanyMembershipPolicy.IsActive` ở 5 handler của Client và thiếu permission ở `POST /api/v1/payments/vnpay`:**
   - Tại `ReportResignationCommandHandler` (`WarrantyClaimCommands.cs:57-58`), `GetJobReplacementSlotsQueryHandler` (`ReplacementSlotFeatures.cs:80-81`), `GetServiceFeesQuery` (`FinanceQueries.cs:132-135`), `GetWarrantiesQuery` (`FinanceQueries.cs:370-373`), và `CreateVnPayPaymentCommand` (`VnPayPaymentCommands.cs:58-59`), chỉ kiểm tra `companyUser == null` mà chưa kiểm tra `CompanyMembershipPolicy.IsActive(companyUser)`.
   - Endpoint `POST /api/v1/payments/vnpay` (`VnPayPaymentEndpoints.cs:55`) chưa gắn `.RequireAuthorization(p => p.RequireClaim("permission", "placement.confirm"))` như các endpoint tài chính khác của Client.
2. **[BE-M02] Lộ dữ liệu chéo vai trò (Data Masking Violation) giữa Client và Affiliate:**
   - Khi Client gọi `ReportResignationCommand` (`WarrantyClaimCommands.cs:349-353`) hoặc `ConfirmStartWorkCommand` (`ConfirmStartWorkCommandHandler.cs:453-465`), response trả lộ thông tin `CommissionId`, `CommissionAmount`, `Status` của Affiliate cho Client (trong khi `GET /api/v1/warranties` đã chủ động ẩn).
   - Tại `GetJobCommissionEstimateQuery.cs:64-65` (`GET /api/v1/affiliate/jobs/{jobId}/commission-estimate`), chuỗi `Explanation` trả về cho Affiliate trên job `CV_SOURCING` nối trực tiếp đơn giá `price` (`job.SourcingPricePerCv`) của Client (`"{share}% × giá {price}/CV"`), làm lộ mức phí mỗi CV mà Client trả cho HR Connect.
3. **[BE-M03] `CompleteWarrantyAsync` tự động chuyển bảo hành sang `PASSED` và hoa hồng sang `EARNED` khi đối soát đang `PENDING`/`FLAGGED` hoặc Affiliate bị `SUSPENDED`:**
   - Tại `WarrantyProgressService.cs` (dòng `58-80`), hàm `CompleteWarrantyAsync` chưa gọi `ReconciliationHoldHelper.ShouldHoldServiceFeeCollection` (như `MarkServiceFeeDueAsync` đã làm) và chưa kiểm tra `Affiliate.Status == "SUSPENDED"` trước khi nâng hoa hồng từ `IN_WARRANTY` lên `EARNED`.
4. **[BE-M04] Quyết toán thủ công CV Sourcing (`SettleSourcingJobCommand`) không chặn khi Job đang `ACTIVE` hoặc còn CV đang chờ phản hồi/xác minh:**
   - Tại `SettlementCommands.cs` (dòng `420-432`), cần chặn quyết toán thủ công nếu Job chưa `CLOSED` (trừ khi đã đủ `SourcingTarget`) hoặc vẫn còn hồ sơ `SourcingDelivery` đang ở trạng thái `DELIVERED` / chờ HR xác minh từ chối (`HrRejectionConfirmed == null`).

### Frontend Major Issues

5. **[FE-M01] Thiếu Query Keys trong `notificationRefreshKeys.ts` làm mất đồng bộ SignalR trên trang Công nợ Client, KPI Admin và Chi tiết nhận việc:**
   - Tại `HRConnect-FE/src/hooks/notificationRefreshKeys.ts` (dòng `6-40`):
     - Thiếu `['client-billing']` trong nhóm `FINANCE` và `JOB` -> Trang `ClientBillingPage.tsx` không tự làm mới khi có SignalR `SERVICE_FEE`, `REPLACEMENT_SLOT` hoặc `PLACEMENT_RECONCILIATION`.
     - Thiếu key `'ONLINE_PAYMENT'` trong `BY_ENTITY` -> Thông báo thanh toán VNPay từ BE (`VnPayPaymentCommands.cs:347`) không kích hoạt làm mới query nào.
     - Thiếu `['mf05-count']` trong `FINANCE` -> 4 thẻ KPI trên đầu `AdminFinancePage.tsx` không tự nhảy số khi bảng bên dưới cập nhật qua SignalR.
     - Thiếu `['mf05-replacement-slots-summary']`, `['mf05-replacement-refunds']`, `['placements']` và chưa nối `...FINANCE` vào `DISPUTE` / `SOURCING_DELIVERY`.
6. **[FE-M02] Thiếu React Query invalidations cục bộ & thiếu `disabledDate` khi báo nghỉ từ trang Chi tiết nhận việc:**
   - `PlacementDetailView.tsx` (dòng `635`, `680-682`): `DatePicker` chọn `"Ngày làm việc cuối cùng"` thiếu `disabledDate` giới hạn trong `[warranty.startDate, warranty.endDate)` (không đồng bộ với `WarrantyPages.tsx:352`), dễ gây lỗi `400 Bad Request`.
   - `ReplacementQuotaCard.tsx` (dòng `154`), `PostingFeePaymentsPanel.tsx` (dòng `40-41`), `PlacementReconciliationPage.tsx` (dòng `86-88`), và `ClientVnPayReturnPage.tsx` (dòng `197-199`): Cần bổ sung invalidate đầy đủ các query liên quan (`['mf05-warranties']`, `['mf05-replacement-slots-summary']`, `['mf01-jobs']`, `['mf05-count']`, `['client-billing']`).
7. **[FE-M03] `AdminDisputesPage.tsx` hiển thị trực tiếp chuỗi JSON thô của `evidence` (luôn hiện `"[]"` khi không có bằng chứng):**
   - Tại `AdminDisputesPage.tsx` (dòng `302-306`), do BE lưu `Dispute.Evidence` dạng chuỗi JSON `"[]"` (truthy trong JS), giao diện luôn hiện cảnh báo `Bằng chứng / Ghi chú: []` hoặc in ra chuỗi JSON thô `[{"type":"NOTE","value":"..."}]`. Cần parse JSON an toàn và ẩn khi mảng rỗng.
8. **[FE-M04] `AffiliateCommissionsPage.tsx` cố định `pageSize: 100` và chưa có phân trang cho bảng hoa hồng:**
   - Tại `AffiliateCommissionsPage.tsx` (dòng `122-141`, `194-305`), bảng hoa hồng gọi `financeApi.commissions({ page: 1, pageSize: 100 })` mà chưa gắn `Pagination` như bảng lịch sử chuyển khoản bên dưới.

---

## 🟡 3. MINOR — Tinh chỉnh Thông báo, Audit Log, UI/UX & Thuật ngữ

1. **[BE-m01] Bổ sung thông báo In-App / SignalR ở 4 điểm chuyển trạng thái phụ:**
   - Gửi thông báo cho Affiliate khi hoa hồng chuyển sang `EARNED` (`WarrantyProgressService.cs:106-121` & `SourcingFinanceService.cs:256-315`).
   - Gửi thông báo kết quả xác minh báo nghỉ cho Client cả khi HR bác bỏ (`Confirmed == false`) hoặc khi phí chưa trả (`ResolveResignationCommandHandler` tại `WarrantyClaimCommands.cs:204-250`).
   - Gửi thông báo nhắc phí quá hạn (`OVERDUE`) cho Client (`WarrantyProgressService.cs:154-163`) và thông báo khi tạo phiếu quyết toán `SETTLEMENT`/`CREDIT` (`SourcingFinanceService.cs:178-254`).
2. **[BE-m02] Ghi `AuditLog` khi tạo/sửa/bật/tắt `CommissionRule` và lọc `MilestoneType` trong `GetActiveCommissionRuleAsync`:**
   - Bổ sung `IAuditLogService.AddAsync` vào 4 command handler trong `Features/CommissionRules/Commands/**` (tuân thủ nguyên tắc G3) và lọc `MilestoneType == CommissionMilestoneCodes.WarrantyPassed` trong `FinanceRepository.cs:26-34`.
3. **[BE-m03] Khóa dòng (`FOR UPDATE`) trong `GetServiceFeeForUpdateAsync` và `GetCommissionForUpdateAsync`:**
   - Tại `FinanceRepository.cs:267-278`, đồng bộ cách khóa dòng như `GetReplacementSlotWithLockAsync` và `DisputeRepository.GetForUpdateAsync` để trả `409 Conflict` thay vì `500 DbUpdateException` khi 2 Admin bấm cùng lúc.
4. **[FE-m01] Đồng bộ câu chữ theo đúng `QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md`:**
   - `PlacementDetailView.tsx` (dòng `334-366`): Khi `warranty.status === 'VOIDED'`, hiển thị `"Bảo hành đã dừng"` thay vì `"Còn X ngày bảo hành"`.
   - `PlacementDetailView.tsx` (dòng `672`) & `WarrantyPages.tsx` (dòng `346`, `380`): Sửa mô tả báo nghỉ việc thành *"để xác minh và mở suất tìm ứng viên thay thế miễn phí theo hợp đồng"* (bỏ chữ *"hoặc hoàn phí"* ngay lúc báo nghỉ).
   - `AdminDisputesPage.tsx` (dòng `81-89`): Phân biệt rõ `PENDING` (*"Đang chờ ứng viên đi làm"*) và `IN_WARRANTY` (*"Đang trong thời gian bảo hành"*).
   - `replacementUtils.ts` (dòng `50`): Không viết cứng con số *"30 ngày"* trong mô tả `EXPIRED` (nguyên tắc G1).
5. **[FE-m02] Đồng bộ bộ lọc khi bấm thẻ KPI "Phí chờ thu" và công thức hiển thị của `SETTLEMENT`/`CREDIT` trên `AdminFinancePage.tsx`:**
   - Tại `AdminFinancePage.tsx` (dòng `484`, `643-650`), không hiển thị `baseSalary × 1` dưới các khoản `SETTLEMENT`/`CREDIT` (chỉ hiển thị cho `PLACEMENT_FEE`).
6. **[FE-m03] Dọn dẹp Dead Code & Accessibility:**
   - Xóa component mẫu cũ không dùng `src/features/admin/DisputeResolutionTable.tsx` và `AdminPayoutsPlaceholder` / `AdminSettingsPlaceholder` (`AdminProfileAndPlaceholders.tsx:162-174`).
   - Đổi `<span onClick>` trong `Breadcrumb` của `PlacementDetailPage.tsx` (dòng `41`, `51`) sang `<button type="button">` hoặc `<Link>` để hỗ trợ bàn phím.

---

## 🟢 4. CLEAN / VERIFIED — Các phần đã chuẩn chỉnh cho Production

- **VNPay Gateway, Callback & IPN (`VnPayGateway.cs`, `VnPayPaymentCommands.cs`, `OnlinePaymentRepository.cs`):** Kiểm tra chữ ký HMAC-SHA512 bằng `CryptographicOperations.FixedTimeEquals` chống timing attack, kiểm tra khớp số tiền, đồng bộ idempotent giữa IPN và Browser Return bằng atomic `ExecuteUpdateAsync` (`TryClaimAsync`), unique partial index `uq_online_payment_active_target`, và tự động xử lý `NEEDS_REVIEW` khi giao dịch đụng độ với thanh toán thủ công.
- **Vòng đời Suất thay thế (`ReplacementSlotLifecycle.cs`, `WarrantyProgressService.cs`):** Đảm bảo tối đa 1 lần thay thế mỗi khoản phí (kèm unique index DB), chỉ mở `OPEN` khi phí đã `PAID` (tự động mở từ `WAITING_PAYMENT` ngay khi thu phí), tự gia hạn 1 lần theo cấu hình động, và chỉ hoàn `mf05.replacement.refund_percent` khi hết hạn sau gia hạn mà chưa có ứng viên thay thế nào tới tay Client.
- **Cô lập dữ liệu Phí & Hoa hồng (`FinanceQueries.cs`, `PlacementDetailView.tsx`):** Client tuyệt đối không thấy hoa hồng của Affiliate trên các API danh sách/chi tiết; Affiliate tuyệt đối không thấy `BaseAmount` / `ServiceFee` của Client trên `HEADHUNT_COD`.
- **Cơ chế Khóa & Xử lý Tranh chấp ở Backend (`DisputeFeatures.cs`, `DisputeRepository.cs`):** Có row-level lock `FOR UPDATE`, `ConcurrencyToken`, `ResolutionIdempotencyKey`, chặn duyệt hoa hồng (`ApproveCommissionCommand`) khi còn `Dispute` hoặc `CandidateDuplicateCase` đang mở.

