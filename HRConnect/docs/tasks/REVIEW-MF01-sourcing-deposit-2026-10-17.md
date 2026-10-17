# Nhờ dev MF-01 review: job CV Sourcing chờ cọc mới mở

> **Người sửa:** Quí (MF-05). **Ngày:** 2026-10-17. **Nhánh:** `feature/mf05-sourcing-finance`.
> **Vì sao sửa code MF-01:** nhóm chốt ngày 17/10 là **job CV_SOURCING chưa đóng cọc thì không mở**. Muốn vậy, bước duyệt job phải chuyển job sang chờ thanh toán thay vì đang tuyển.
> GitNexus báo `ApproveJobCommandHandler` và `RecordJobPostingFeePaymentCommandHandler` có rủi ro **CRITICAL** (416 chỗ phụ thuộc), nên cần người nắm MF-01 xem lại.

## 1. Luồng mới của CV_SOURCING

```
Client gửi duyệt → Internal HR chốt điều khoản & duyệt
  → job PENDING_PAYMENT + phiếu cọc service_fee (kind = DEPOSIT, PENDING)
  → Client chuyển khoản ngoài hệ thống
  → Platform Admin ghi nhận cọc ở trang Tài chính (POST /api/v1/admin/service-fees/{id}/record-payment)
  → job ACTIVE (PostedAt = lúc ghi nhận), Client nhận thông báo
```

- Cọc = số CV × giá mỗi CV × tỷ lệ cọc. Hạn trả = ngày duyệt + `paymentDueDays` (điều khoản đã chốt).
- Tỷ lệ cọc = 0 thì không tạo phiếu cọc, và job mở ngay như cũ.
- HEADHUNT_COD và CV_APPLICATION **không đổi**.

## 2. Code MF-01 đã sửa

| File | Thay đổi | Cần review |
|---|---|---|
| `Features/Jobs/Commands/ApproveJob/ApproveJobCommand.cs` | Thêm phụ thuộc tùy chọn `ISourcingFinanceService? sourcingFinance = null`. Nhánh CV_SOURCING: sau khi chốt điều khoản thì tạo phiếu cọc. Cọc chưa trả thì `requiresPayment = true`, dùng chung đường `PENDING_PAYMENT` của CV_APPLICATION. Câu thông báo và lý do trạng thái đổi sang "đặt cọc CV Sourcing"; metadata thông báo thêm `paymentKind` | Thứ tự: tạo cọc trước, đổi trạng thái sau, một lần `SaveChanges`. Test cũ tạo handler không truyền dịch vụ này nên vẫn ra `ACTIVE` |
| `Features/Jobs/Commands/RecordJobPostingFeePayment/RecordJobPostingFeePaymentCommand.cs` | Job CV_SOURCING → 409 `JOB_REQUIRES_SOURCING_DEPOSIT` | Trước đây HR bấm "Ghi nhận thanh toán thủ công" sẽ tạo nhầm phí đăng tin gói STANDARD cho job Sourcing và mở job |
| FE `jobs-mf01/jobDisplay.ts` | Thêm `isAwaitingSourcingDeposit`, `sourcingDepositAmount` (+ `jobDisplay.test.ts`) | |
| FE `jobs-mf01/JobDetailPanel.tsx` | Job Sourcing chờ cọc: nhãn "Chờ đặt cọc CV Sourcing", ẩn nút "Thanh toán ngay" | |
| FE `jobs-mf01/ClientJobsListPage.tsx` | Job Sourcing chờ cọc: hiện số tiền cọc, không hiện nút "Thanh toán" (nút này gọi API phí đăng tin) | |
| FE `jobs-mf01/JobReviewPage.tsx` | Job Sourcing chờ cọc: ẩn "Ghi nhận thanh toán thủ công", ghi chú Platform Admin ghi nhận ở trang Tài chính | |

Phía MF-05 (không cần review): `SettlementCommands.RecordServiceFeePayment` mở job khi phiếu `DEPOSIT` được trả (`PENDING_PAYMENT` → `ACTIVE`, ghi lịch sử trạng thái, thông báo Client).

## 3. Test

- `SourcingFinanceTests`:
  - `ApproveSourcingJob_WithDeposit_ShouldWaitForPaymentAndCreateDeposit`
  - `RecordingTheDeposit_ShouldOpenTheJob`
  - `PostingFeePayment_OnSourcingJob_ShouldBeRejected`
- Toàn bộ backend và FE pass ngày 17/10.

## 4. Còn để ý

- Job CV_SOURCING **đã duyệt trước khi deploy** vẫn ở `ACTIVE`. Worker MF-05 chỉ tạo phiếu cọc cho các job này, không đóng chúng lại.
- `ClientJobsListPage.tsx` có chữ cứng "Chờ thanh toán phí kích hoạt (1.5M đ)" cho CV_APPLICATION. Chỗ này sai quy tắc "không viết cứng số tiền". Mình không sửa vì ngoài phạm vi; nhờ MF-01 xem.
- Quyền: chỉ Platform Admin (`commission.manage`) ghi nhận cọc. Internal HR không có quyền này. Nếu nhóm muốn Internal HR ghi nhận cọc như phí đăng tin (xem N4 trong `TEST-2026-10-17-mf01-mf03-3-dich-vu.md`) thì phải chốt lại phân quyền.
