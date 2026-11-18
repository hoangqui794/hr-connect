# Tài liệu Đặc tả Toàn diện — MF-05 (Phí dịch vụ, VNPay, Bảo hành, Suất thay thế, Quyết toán Sourcing, Hoa hồng, Khiếu nại & Payout)

> **Tài liệu liên quan:**
> - [`review.md`](review.md): Báo cáo kiểm định Production Readiness MF-05.
> - [`../QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md`](../QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md): Quy tắc gốc về phí dịch vụ, đặt cọc, bảo hành, suất thay thế và hoa hồng của cả 3 loại dịch vụ.
> - [`../main-flows.md`](../main-flows.md): Đặc tả luồng nghiệp vụ mục MF-05 và SF-04.
> - [`../HUONG-DAN-TEST-MF05-CHO-TESTER.md`](../HUONG-DAN-TEST-MF05-CHO-TESTER.md): Kịch bản kiểm thử thực tế cho MF-05.

---

## 1. Tổng quan Cơ chế Tài chính theo 3 Loại dịch vụ

| Loại dịch vụ (`ServiceType`) | Khoản thu từ Client (`ServiceFee` / `JobPostingFee`) | Cơ chế Bảo hành / Nghiệm thu | Hoa hồng Affiliate (`Commission`) |
| :--- | :--- | :--- | :--- |
| **`HEADHUNT_COD`** | `ServiceFee (Kind = PLACEMENT)` = `BaseSalary × FeeMultiplier` cho từng Placement. | Bảo hành **30 ngày** (`WarrantyDays`). Nghỉ việc trong hạn bảo hành được mở tối đa **1 Suất thay thế (`ReplacementSlot`)** miễn phí. | Nhận **100% một lần** khi ứng viên làm đủ 30 ngày (`IN_WARRANTY → EARNED`), tính theo `CommissionRule` (`PERCENT` hoặc `FIXED`). |
| **`CV_SOURCING`** | 1. Đặt cọc trước khi mở Job: `ServiceFee (Kind = DEPOSIT)`.<br>2. Quyết toán khi đủ `SourcingTarget` hoặc đóng Job: `SETTLEMENT` (thu thêm) hoặc `CREDIT` (hoàn cọc dư). | Client nghiệm thu từng CV trong `ReviewDays`; CV bị từ chối hợp lệ được đổi bằng CV dự phòng. | Mỗi CV đạt `ACCEPTED` / `AUTO_ACCEPTED` sinh ngay hoa hồng `EARNED` = `PricePerQualifiedCv × AffiliateShare%`. |
| **`CV_APPLICATION`** | `JobPostingFee` theo gói đăng tin (`FREE` / `STANDARD`) trước khi mở Job. | Không áp dụng bảo hành nhân sự. | Không phát sinh hoa hồng. |

---

## 2. Công nợ Phí dịch vụ (`ServiceFee`) & Cổng thanh toán VNPay

1. **Phân loại & Vòng đời `ServiceFee` (`FinanceStates.cs`):**
   - **Khoản thu từ Client (`PLACEMENT`, `DEPOSIT`, `SETTLEMENT`):** `PENDING → DUE` (nhắc trước hạn `mf05.fee.due_reminder_days`) `→ PAID` (hoặc `OVERDUE` khi quá hạn, `CANCELLED` khi hủy).
   - **Khoản hoàn cho Client (`ServiceFeeKinds.OwedToClient`: `CREDIT`, `REPLACEMENT_REFUND`):** `REFUND_PENDING → PAID` (do Platform Admin xác nhận hoàn tiền).
   - **Giữ phí theo Đối soát (`ReconciliationHoldHelper`):** Với `HEADHUNT_COD`, nếu bản ghi đối soát `PlacementReconciliation` đang ở trạng thái `PENDING` hoặc `FLAGGED`, hệ thống tạm giữ việc chuyển hạn thu phí và hoàn tất bảo hành cho tới khi đối soát được `CONFIRMED`.

2. **Thanh toán trực tuyến VNPay (`VnPayGateway` & `VnPayPaymentCommands`) & Ghi nhận thủ công:**
   - Endpoint `POST /api/v1/payments/vnpay` (bắt buộc quyền `placement.confirm` và `CompanyMembershipPolicy.IsActive`) hỗ trợ 3 đích thanh toán: `POSTING_FEE`, `SOURCING_DEPOSIT`, `SERVICE_FEE`.
   - **Bảo mật & Idempotency:**
     - Xác thực chữ ký `HMAC-SHA512` bằng `CryptographicOperations.FixedTimeEquals` chống timing attack và đối chiếu khớp tuyệt đối số tiền.
     - Đồng bộ giữa luồng **Browser Return** và **Server IPN** bằng thao tác atomic `TryClaimAsync` (`ExecuteUpdateAsync`) kết hợp unique partial index `uq_online_payment_active_target`.
     - Nếu giao dịch VNPay thành công nhưng khoản phí đã được Admin gạch nợ thủ công trước đó, bản ghi chuyển sang `NEEDS_REVIEW` để đối chiếu.
   - **Ghi nhận thủ công (`RecordServiceFeePaymentCommand`):** Sử dụng khóa dòng `FOR UPDATE` (`GetServiceFeeForUpdateAsync`) trong transaction để chống xử lý trùng khi nhiều Admin thao tác đồng thời.

---

## 3. Bảo hành 30 Ngày (`Warranty`) & Suất Tuyển Thay thế (`ReplacementSlot`)

Áp dụng cho dịch vụ **`HEADHUNT_COD`**:

1. **Hoàn tất bảo hành tự động (`WarrantyProgressService.CompleteWarrantyAsync`):**
   - Khi hết thời hạn bảo hành mà không có báo nghỉ việc và bản ghi đối soát `PlacementReconciliation` đã `CONFIRMED`:
     - Chuyển `Warranty` từ `ACTIVE → PASSED`.
     - Nếu Affiliate đang hoạt động bình thường (`Status == "ACTIVE"`): chuyển `Commission` từ `IN_WARRANTY → EARNED` và đẩy thông báo SignalR cho Affiliate.
     - Nếu Affiliate đang bị tạm khóa (`Status == "SUSPENDED"`): chuyển `Commission` sang `ON_HOLD` chờ Admin quyết định.

2. **Báo nghỉ việc & Xác minh (`ReportResignationCommand` & `ResolveResignationCommand`):**
   - **Client báo nghỉ (`ReportResignationCommand`):** Trong thời hạn bảo hành, Client gửi ngày làm việc cuối cùng → `Warranty` chuyển sang `CLAIMED`, `Commission` chuyển sang `ON_HOLD`.
   - **Internal HR xác minh (`ResolveResignationCommand`):**
     - **Bác bỏ (`Confirmed = false`):** Khôi phục `Warranty → ACTIVE`, `Commission → IN_WARRANTY`, thông báo cho Client.
     - **Xác nhận nghỉ (`Confirmed = true`):** Chuyển `Warranty → VOIDED`, `Commission → CANCELLED`, `Application → LEFT_DURING_WARRANTY` và kích hoạt **Suất tuyển thay thế (`ReplacementSlot`)** nếu đây là Placement gốc (mỗi khoản phí tối đa 1 lần thay thế miễn phí).

3. **Vòng đời Suất thay thế (`ReplacementSlotLifecycle`):**
   - Nếu khoản phí gốc đã `PAID` → mở suất `OPEN` ngay (hạn `ExpiresAt = Now + mf05.replacement.fill_window_days`, đồng thời tự mở lại Job về `ACTIVE` nếu Job đã `CLOSED`). Nếu phí gốc chưa trả → đặt ở `WAITING_PAYMENT` và tự động chuyển sang `OPEN` ngay khi phí gốc được thanh toán.
   - **Tự động gia hạn 1 lần:** Khi chạm `ExpiresAt` lần đầu mà chưa có người đi làm, worker tự động gia hạn thêm `mf05.replacement.extension_days` (`ExtendedAt != null`) và thông báo cho Client.
   - **Hết hạn sau gia hạn (`EXPIRED`) & Hoàn phí một phần (`REPLACEMENT_REFUND`):** Nếu hết hạn sau gia hạn mà **chưa có bất kỳ hồ sơ thay thế nào được chuyển tới tay Client**, hệ thống tự động tạo phiếu hoàn tiền `ServiceFee (Kind = REPLACEMENT_REFUND, Status = REFUND_PENDING)` theo tỷ lệ `mf05.replacement.refund_percent` (mặc định 30%).
   - **Khi ứng viên thay thế đi làm (`FILLED`):** Không tạo phí dịch vụ mới; bảo hành và hoa hồng mới của ứng viên thay thế tham chiếu trực tiếp tới khoản phí gốc đã thanh toán (`placement.ServiceFee ?? placement.ReplacementSlot?.ServiceFee`), cho phép Admin duyệt hoa hồng (`ApproveCommissionCommand`) bình thường khi ứng viên thay thế vượt qua 30 ngày bảo hành.

---

## 4. Quyết toán Dịch vụ CV Sourcing (`SourcingFinanceService` & `SettleSourcingJobCommand`)

1. **Điều kiện quyết toán:**
   - Tự động quyết toán qua `SourcingFinanceWorker` hoặc quyết toán thủ công (`SettleSourcingJobCommand`) khi **Job đã `CLOSED` hoặc đã đạt đủ `SourcingTarget`**, và **không còn bản ghi `SourcingDelivery` nào đang chờ Client phản hồi (`DELIVERED`) hoặc chờ HR xác minh từ chối (`HrRejectionConfirmed == null`)**.
2. **Công thức quyết toán an toàn:**
   - `Total = BillableCvs × PricePerQualifiedCv`.
   - Chỉ khấu trừ tiền cọc (`Deposit`) từ các phiếu `ServiceFee (Kind = DEPOSIT)` **đã thực sự thanh toán (`Status == PAID`)**; nếu còn phiếu `DEPOSIT` chưa thanh toán (`PENDING`/`DUE`/`OVERDUE`) thì tự động hủy (`CANCELLED`) để tuyệt đối không tạo khống phiếu hoàn tiền `CREDIT`.
   - Nếu `Balance = Total - PaidDeposit > 0` → tạo phiếu thu thêm `SETTLEMENT (PENDING)`.
   - Nếu `Balance < 0` → tạo phiếu hoàn cọc dư `CREDIT (REFUND_PENDING)` cho Client.

---

## 5. Hoa hồng (`Commission`), Khiếu nại (`Dispute` — SF-04) & Chi trả (`Payout`)

1. **Quản lý Quy tắc Hoa hồng (`CommissionRules`):**
   - Hỗ trợ quy tắc theo `ServiceType` (`PERCENT` hoặc `FIXED`, lọc theo `MilestoneType == WARRANTY_PASSED`), ghi `AuditLog` đầy đủ cho mọi thao tác tạo, cập nhật, bật/tắt quy tắc.
   - Bảo mật dữ liệu chéo vai trò: API ước tính hoa hồng của Affiliate (`GET /api/v1/affiliate/jobs/{jobId}/commission-estimate`) chỉ hiển thị số tiền hoa hồng ước tính trên mỗi CV mà không làm lộ đơn giá `SourcingPricePerCv` của Client.
2. **Duyệt & Chi trả Hoa hồng (`ApproveCommissionCommand`, `CreatePayoutCommand`, `CompletePayoutCommand`):**
   - Sử dụng khóa dòng `FOR UPDATE` (`GetCommissionForUpdateAsync`).
   - Chỉ cho phép chuyển `EARNED → PAYABLE` khi:
     - Khoản phí dịch vụ hiệu lực (`placement.ServiceFee ?? placement.ReplacementSlot?.ServiceFee`, hoặc phí quyết toán Sourcing) đã **`PAID`**.
     - Không có khiếu nại (`Dispute`) hoặc ca nghi trùng danh tính (`CandidateDuplicateCase`) đang mở trên hồ sơ đó.
   - Gom các khoản `PAYABLE` vào đợt chi trả (`Payout`: `PENDING → COMPLETED / FAILED / CANCELLED`), khi `COMPLETED` thì toàn bộ `Commission` trong đợt chuyển sang `PAID`.
3. **Xử lý Khiếu nại Attribution (`Disputes` — SF-04):**
   - Affiliate có thể gửi khiếu nại trong thời hạn `dispute.window_days` khi lượt nộp bị `BLOCKED_DUPLICATE`.
   - Platform Admin xử lý qua `POST /api/v1/admin/disputes/{disputeId}/resolve` (bắt buộc `ConcurrencyToken` + `IdempotencyKey`, khóa dòng `FOR UPDATE`):
     - **`UPHELD` (Chấp nhận khiếu nại):** Chuyển `Attribution` và các khoản hoa hồng chưa chi trả sang cho Affiliate thắng khiếu nại.
     - **`REJECTED` (Bác bỏ khiếu nại):** Giữ nguyên `Attribution` hiện hành và mở khóa duyệt hoa hồng.
