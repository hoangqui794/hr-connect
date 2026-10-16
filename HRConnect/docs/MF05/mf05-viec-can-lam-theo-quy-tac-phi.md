# MF-05: việc cần làm theo quy tắc phí mới

> **Dành cho:** dev phụ trách MF-05 (Bảo hành, Phí dịch vụ, Hoa hồng, Payout).
> **Ngày:** 2026-10-14.
> **Căn cứ:** [`HRConnect/docs/QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md`](../QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md) (đã chốt hết).
> **Hiện trạng** được đối chiếu với code trên `main` ngày 14/10. **Cập nhật 15/10:** E2, E3, E4, E6 đã xong (commit `31e880b`, đã merge vào `main`); E7 đã có thiết kế.

Ký hiệu: 🔴 làm trước · 🟠 cần làm · ✅ đã có, không cần làm.

---

## E1. ✅ Đã có

- Trang Cài đặt Admin + bảng `system_setting` + `IAdminBusinessSettings` (`GET/PUT /api/v1/admin/settings`).
- Phí dịch vụ HEADHUNT_COD khi xác nhận đi làm; bảo hành 30 ngày; báo nghỉ và HR xác minh.
- `GET /api/v1/service-fees`, `/commissions`, `/payouts`, `/warranties`; Admin ghi nhận thu phí, duyệt / hủy / điều chỉnh hoa hồng, ghi nhận payout.
- Hoa hồng chỉ được duyệt khi Client đã trả phí.

---

## E2. ✅ Sửa chỗ lệch do commit `c3750da` (14/10) — đã xong 15/10

| # | File | Đang làm | Sửa thành |
|---|---|---|---|
| 1 | `Common/Settings/BusinessSettings.cs` | Hệ số điền sẵn `2.0` | **`1.5`** (mục 5 file quy tắc) |
| 2 | `Finance/Common/PlacementFinanceService.cs` | Vừa đi làm → hoa hồng `ON_HOLD` | **`IN_WARRANTY`** (xem E3) |
| 3 | `Finance/Commands/WarrantyClaims/WarrantyClaimCommands.cs` | HR bác bỏ báo nghỉ → `ON_HOLD` | **`IN_WARRANTY`** |
| 4 | `Finance/Common/WarrantyProgressService.cs` | Đủ 30 ngày: lấy cả `ON_HOLD` lẫn `PENDING` | Chỉ lấy **`IN_WARRANTY`**; `ON_HOLD` (đang tranh chấp) **không** tự lên `EARNED` |
| 5 | `Finance/Commands/Settlement/SettlementCommands.cs` | Lỗi ghi "bảo hành 60 ngày" | Lấy số ngày bảo hành của job |
| 6 | FE `finance-mf05/financeLabels.ts` | `EARNED` = "Đã đạt mốc đi làm"; `ON_HOLD` = "Đang trong bảo hành" | Nhãn theo E3 |
| 7 | FE `Mf05Pages.test.tsx` | Test fail do đổi chữ nút | Sửa theo nhãn mới |

---

## E3. ✅ Trạng thái hoa hồng `IN_WARRANTY` (mục 1.3) — đã xong 15/10

**Hằng số** (`HRConnect.Domain/Constants/FinanceStates.cs`): thêm `InWarranty = "IN_WARRANTY"`.

| Trạng thái | Nghĩa | Nhãn FE (Affiliate) |
|---|---|---|
| `PENDING` | Đã giới thiệu, chưa đi làm | "Đang chờ ứng viên đi làm" |
| `IN_WARRANTY` | Đã đi làm, chưa đủ 30 ngày | "Đang trong 30 ngày đầu" |
| `ON_HOLD` | Client báo nghỉ, chờ HR xác minh | "Tạm giữ – đang xác minh" |
| `EARNED` | Đủ 30 ngày, đạt 100% | "Đã đạt, chờ Client thanh toán" |
| `PAYABLE` | Client đã trả + Admin duyệt | "Chờ chuyển tiền" |
| `PAID` | Đã chuyển | "Đã nhận" |
| `CANCELLED` | Nghỉ trước ngày 30 (đã xác minh) | "Đã hủy" |

- **Migration dữ liệu:** hoa hồng hiện `ON_HOLD` mà bảo hành `ACTIVE` (không có báo nghỉ) → `IN_WARRANTY`; hoa hồng `PENDING` có Placement `STARTED` → `IN_WARRANTY`.
- **API:** `GET /api/v1/commissions?status=IN_WARRANTY` phải lọc được; `CommissionDto.status` có giá trị mới.
- **Dashboard Affiliate** (`AffiliateCommissionsPage.tsx`): thẻ "Đang trong 30 ngày đầu" = `IN_WARRANTY`; "Tạm giữ" = `ON_HOLD`.

---

## E4. ✅ Trạng thái phí `DUE` (mục 1.1) — đã xong 15/10

`PENDING → DUE → PAID`, quá hạn → `OVERDUE`.

- `PENDING`: mới phát sinh, chưa tới hạn nhắc. `DUE`: còn **≤ 5 ngày** tới hạn **[cấu hình: `mf05.fee.due_reminder_days`, mặc định 5]**. Worker chuyển `PENDING → DUE`, gửi nhắc Client.
- **Migration:** sửa `ck_service_fee_status` thêm `'DUE'`.
- `GET /api/v1/service-fees?status=DUE`; FE `SERVICE_FEE_STATUS` thêm nhãn "Sắp đến hạn".

---

## E5. 🟠 Đọc điều khoản trên job (sau khi MF-01 làm A4/A5)

- `PlacementFinanceService` đọc `job.commercialTerms` (hệ số, bảo hành, hạn thanh toán) thay cho các cột rời. Nếu null (job duyệt trước khi MF-01 sửa) → lấy mặc định từ `IAdminBusinessSettings` như hiện tại.
- Phí = **`offer.monthlyGrossSalary` × hệ số** (MF-04 mục D1). `monthlyGrossSalary = null` (lương NET) → không tạo phí, ghi `SERVICE_FEE_BLOCKED` và báo Internal HR.
- Xóa 3 thuộc tính tương thích `WarrantyDays`, `HeadhuntFeeMultiplier`, `PaymentDueDays` trong `Mf05Settings` khi MF-01 bỏ `BusinessSettingsOptions`.

---

## E6. ✅ Khóa cấu hình mới — đã có đủ trong `BusinessSettingKeys`

Thêm vào `BusinessSettingKeys.All` (MF-01 cần cho màn duyệt job):

| Khóa | Mặc định | Khoảng |
|---|---|---|
| `mf05.cv_sourcing.price_per_cv` | 600000 | 1.000 – 100.000.000 |
| `mf05.cv_sourcing.deposit_percent` | 50 | 0 – 100 |
| `mf05.cv_sourcing.review_days` | 7 | 1 – 30 |
| `mf05.cv_sourcing.payment_due_days` | 20 | 1 – 120 |
| `mf05.fee.due_reminder_days` | 5 | 1 – 30 |

Trang `AdminSettingsPage.tsx` tự hiện theo danh sách khóa; chỉ cần thêm nhãn.

---

## E7. 🟠 Tuyển thay thế (mục 1.2, 1.3)

> **Đã có thiết kế chi tiết (15/10):** [`mf05-thiet-ke-suat-thay-the.md`](mf05-thiet-ke-suat-thay-the.md). Thiết kế đó **thay thế** phần mô tả bên dưới: dùng bảng `replacement_slot` thay cho `replacement_for_placement_id` / `openSlots`; chỉ thay 1 lần mỗi khoản phí; suất chỉ mở khi Client đã trả phí; có hạn chót cấu hình được. Phần MF-02 (B4) đã xong 16/10; phần MF-04: [`MF04/mf04-lap-suat-thay-the.md`](../MF04/mf04-lap-suat-thay-the.md).

**Khi HR xác nhận ứng viên nghỉ trước 30 ngày** (`POST /api/v1/placements/{id}/resignation/resolve` với `confirm`):
1. Bảo hành `VOIDED`, hoa hồng `CANCELLED` (đã có).
2. **Mới:** phí dịch vụ **giữ nguyên** (không hoàn); job được đánh dấu "đang tìm người thay thế" và mở lại 1 chỗ (`quantity` còn trống +1); ghi `replacement_for_placement_id`.
3. Response thêm:

```diff
 { "warrantyStatus": "VOIDED", "commissionStatus": "CANCELLED",
+  "replacement": { "jobId": "uuid", "openSlots": 1, "replacementForPlacementId": "uuid" } }
```

**Khi người thay thế đi làm** (Placement có `isReplacement`, MF-04 mục D3):
- **Không** tạo phí dịch vụ mới.
- Tạo bảo hành 30 ngày mới và hoa hồng `IN_WARRANTY` cho Affiliate của người thay thế. Số tiền tính trên **khoản phí cũ**.
- Không mở thay thế lần hai cho cùng một khoản phí **[cần nhóm xác nhận nếu muốn khác]**.

---

## E8. 🟠 Phí và hoa hồng CV_SOURCING (mục 2)

**Đặt cọc** — khi job CV_SOURCING được duyệt (MF-01 gọi sự kiện `JobApproved`):

```http
GET /api/v1/service-fees?jobId={jobId}
```

```jsonc
{
  "serviceFeeId": "uuid",
  "serviceTypeCode": "CV_SOURCING",
  "kind": "DEPOSIT",                 // DEPOSIT | SETTLEMENT | PLACEMENT (HEADHUNT)
  "amount": 3000000,                 // sourcingTarget × pricePerCv × depositPercent
  "status": "PENDING",
  "dueDate": "2026-11-03"
}
```

**Quyết toán** — khi đủ `sourcingTarget` CV được tính, hoặc job đóng:
- Tổng = số CV được tính (MF-03: `ACCEPTED` + `AUTO_ACCEPTED`) × `pricePerCv`.
- `SETTLEMENT` = Tổng − tiền cọc đã thu. Âm (giao thiếu) → ghi khoản **hoàn / trừ lần sau** (`kind = CREDIT`).
- **Migration:** `service_fee` thêm `kind`, cho phép `placement_id` null (phí CV_SOURCING không gắn Placement), thêm `job_id`.

**Hoa hồng:**
- Quỹ = tổng phí thực thu × `mf05.cv_sourcing.affiliate_share_percent` (60%).
- Mỗi CV được tính = quỹ ÷ `sourcingTarget`, thuộc Affiliate đã nộp CV đó → `EARNED` khi CV được tính.
- `PAYABLE` khi **Client đã trả đủ** (cọc + quyết toán) **và** hết thời hạn tranh chấp (= `reviewDays` sau lần giao cuối).

---

## E9. Tiêu chí nghiệm thu

1. Ứng viên đi làm → hoa hồng `IN_WARRANTY` (không phải `ON_HOLD`, không phải `EARNED`).
2. Đủ 30 ngày, không báo nghỉ → `EARNED`; đang `ON_HOLD` thì **không** tự lên `EARNED`.
3. Client báo nghỉ, HR bác bỏ → về `IN_WARRANTY`.
4. Hệ số điền sẵn là 1,5; thông báo lỗi không còn chữ "60 ngày".
5. Phí còn 5 ngày tới hạn → `DUE`; quá hạn → `OVERDUE`.
6. HR xác nhận nghỉ trước 30 ngày → phí giữ nguyên, hoa hồng `CANCELLED`, job mở 1 chỗ.
7. Người thay thế đi làm → không có phí mới; hoa hồng mới `IN_WARRANTY`.
8. Job CV_SOURCING 10 CV × 600.000, cọc 50% → phiếu `DEPOSIT` 3.000.000.
9. Giao được 7 CV được tính → `SETTLEMENT` 1.200.000 (4.200.000 − 3.000.000).
10. Toàn bộ test backend và FE pass.

---

## Ngoài phạm vi MF-05 (để biết, không làm)

| Việc | Người làm |
|---|---|
| Lưu `commercialTerms` lên job khi duyệt | MF-01 |
| Lương gross tháng trên offer; đánh dấu Placement thay thế | MF-04 |
| Giao CV, Client chấp nhận / từ chối, tự chấp nhận sau 7 ngày | MF-03 |
| Đánh dấu submission là người thay thế | MF-02 |

## Thứ tự gợi ý

1. ~~E2 + E3~~ ✅ (15/10).
2. ~~E6~~ ✅.
3. ~~E4~~ ✅ (15/10).
4. **E5** sau khi MF-01 xong A4/A5 và MF-04 xong D1.
5. **E7** sau MF-02 B4 và MF-04 D3; **E8** sau MF-03 C2.
