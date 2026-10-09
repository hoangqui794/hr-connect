# Kế hoạch GitNexus: MF-05 phí dịch vụ, bảo hành, hoa hồng, payout (HEADHUNT_COD)

## Quy tắc đã chốt (2026-10-09)

- `HEADHUNT_COD`: Affiliate nhận **100% hoa hồng một lần** khi ứng viên đi làm đủ **30 ngày**; không chia mốc 15/30/60.
- Bảo hành **30 ngày** (trước là 60), trùng mốc hoa hồng (`WARRANTY_PASSED`).
- `CV_SOURCING` giữ quỹ hoa hồng chia theo quota (chưa làm đợt này); `CV_APPLICATION` không có hoa hồng.
- Hoa hồng `EARNED` chỉ được duyệt chi khi Client đã trả phí dịch vụ của placement đó.

Tài liệu đã cập nhật: `HRConnect/docs/main-flows.md` (MF-05), `HEADHUNT_COD – SERVICE FEE & AFFILIATE COMMISSION MODEL.md`
(mục 13–15, BR-HH-COM-05..07). `CommissionMilestoneSeeder` không đổi: mốc `WARRANTY_PASSED` đã có.

## Hiện trạng

- Bảng `commission`, `commission_adjustment`, `warranty`, `payout` có sẵn nhưng không code nào tạo bản ghi; database không có
  CHECK/trigger cho trạng thái các bảng này.
- Quyền có sẵn: Affiliate `commission.view_own`, `payout.view_own`; Internal HR `warranty.manage`, `commission.view`, `payout.view`;
  Platform Admin `commission.manage`, `payout.manage`; Client `placement.confirm`.
- Chưa có bảng công nợ phí dịch vụ; chưa có Commission Rule nào trong database.

## Impact (index hiện tại)

| Symbol | Risk | Ghi chú |
|---|---|---|
| `ApplicationDbContext` | CRITICAL (77 trực tiếp) | Chỉ **thêm** `DbSet<ServiceFee>` + cấu hình bảng mới; không đổi bảng cũ |
| `ConfirmStartWorkCommandHandler` | UNKNOWN (MediatR) | Text search: endpoint `RecruitmentEndpoints` + test. Thêm 1 lời gọi `IPlacementFinanceService` trong cùng transaction |
| `DatabaseSeeder`, `AddInfrastructure` | UNKNOWN | Thêm seeder rule mặc định, đăng ký service/worker/options |

## Thiết kế

**Dữ liệu**
- Bảng mới `service_fee` (migration `AddServiceFee`): 1 dòng / placement; `base_salary` (lương offer), `fee_multiplier` (1,5),
  `amount`, `currency_code`, `due_date`, `status` (`PENDING`/`PAID`/`OVERDUE`/`CANCELLED`, có CHECK), `paid_at`,
  `payment_reference`, `recorded_by`.
- Trạng thái: bảo hành `ACTIVE`→`PASSED` | `CLAIMED`→`VOIDED`/`ACTIVE`; hoa hồng `PENDING`→`EARNED`→`PAYABLE`→`PAID`,
  `ON_HOLD`, `CANCELLED`; payout `COMPLETED`/`FAILED`.
- Cấu hình `Mf05`: `WarrantyDays=30`, `HeadhuntFeeMultiplier=1.5`, `PaymentDueDays=14`.

**Luồng**
1. Xác nhận đi làm (job `HEADHUNT_COD`) → tạo bảo hành 30 ngày, công nợ phí (lương × 1,5), hoa hồng `PENDING` nếu có attribution
   `ACTIVE` và Commission Rule đang hiệu lực (`PERCENT` × phí, hoặc `FIXED`), lưu snapshot quy tắc/cách tính.
2. Worker định kỳ: bảo hành hết hạn → `PASSED`, hoa hồng `PENDING` → `EARNED`; công nợ quá hạn → `OVERDUE`.
3. Client báo nghỉ trong bảo hành → `CLAIMED`, hoa hồng `ON_HOLD`; Internal HR xác nhận → `VOIDED` + `CANCELLED`, hoặc bác bỏ.
4. Admin ghi nhận Client đã trả phí → `PAID`.
5. Admin duyệt hoa hồng `EARNED` → `PAYABLE` (chặn nếu phí chưa `PAID`); hủy / điều chỉnh số tiền (lưu `commission_adjustment`).
6. Admin ghi nhận payout (`COMPLETED` → hoa hồng `PAID`; `FAILED` giữ `PAYABLE`).
7. Danh sách: phí (Admin tất cả, Client của công ty mình), hoa hồng và payout (Admin/Internal HR tất cả, Affiliate của mình).
8. Seed Commission Rule mặc định `HEADHUNT_COD`: `PERCENT` 30%, mốc `WARRANTY_PASSED` (chỉ khi chưa có rule cho loại này).

**Ngoài phạm vi đợt này:** `CV_SOURCING`/`CV_APPLICATION`, tuyển thay thế, đánh giá Affiliate, thông báo, giao diện FE.

## Kiểm thử

Unit test (EF InMemory) cho: khởi tạo khi xác nhận đi làm, chỉ `HEADHUNT_COD`, không có attribution/rule, worker 30 ngày,
báo nghỉ/xác minh, chặn duyệt khi chưa trả phí, payout. `dotnet build`, `dotnet test`, migration áp dụng được trên DB local,
`detect-changes` trước commit. Không push khi chưa được yêu cầu.
