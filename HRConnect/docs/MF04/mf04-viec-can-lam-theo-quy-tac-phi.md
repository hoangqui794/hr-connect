# MF-04: việc cần làm theo quy tắc phí mới

> **Dành cho:** dev phụ trách MF-04 (Phỏng vấn, Offer, Nhận việc).
> **Ngày:** 2026-10-14.
> **Căn cứ:** [`HRConnect/docs/QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md`](../QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md) (đã chốt hết), chủ yếu **mục 1.1, 1.2 (HEADHUNT_COD)**.
> **Hiện trạng** được đối chiếu với code trên `main` ngày 14/10.

Ký hiệu: 🔴 làm trước · 🟠 cần làm · ✅ đã có, không cần làm.

MF-04 ít việc nhưng **quyết định số tiền**: phí Headhunt = **lương gross tháng trong offer × hệ số**, tính từ **ngày đi làm thực tế**. Hai con số này do MF-04 ghi nhận.

---

## D1. 🔴 Offer phải ghi rõ lương gross theo tháng

**Hiện trạng:** `CreateOfferDraftCommand` / `Offer` chỉ có `salary` + `currencyCode`. Không biết là gross hay net, theo tháng hay theo năm → MF-05 có thể tính phí sai nhiều lần.

**Request — thêm 2 trường, bắt buộc khi gửi offer:**

```diff
 POST /api/v1/recruitment/applications/{applicationId}/offers
 PUT  /api/v1/offers/{offerId}
 {
   "salary": 30000000,
   "currencyCode": "VND",
+  "salaryBasis": "GROSS",        // GROSS | NET
+  "salaryPeriod": "MONTHLY",     // MONTHLY | ANNUAL
   "startDate": "2026-11-01",
   "expiryDate": "2026-10-25",
   "offerDocumentUrl": "..."
 }
```

- Bản nháp được để trống; **`POST /api/v1/offers/{offerId}/send`** kiểm tra: thiếu `salary`, `salaryBasis` hoặc `salaryPeriod` → `400 OFFER_SALARY_INCOMPLETE`.
- Job **HEADHUNT_COD** bắt buộc `salaryBasis = GROSS` (phí tính trên gross) → sai thì `400 HEADHUNT_REQUIRES_GROSS`.
- Response `OfferDto` thêm 2 trường trên và:

```jsonc
"monthlyGrossSalary": 30000000   // = salary nếu MONTHLY; = salary / 12 nếu ANNUAL; null nếu NET
```

- **Migration:** thêm `offer.salary_basis`, `offer.salary_period` (varchar, có check constraint). Dữ liệu cũ: gán `GROSS` / `MONTHLY` và ghi chú trong migration.
- **Sau khi offer được ứng viên chấp nhận: không sửa lương được nữa** (đã có `ACCEPTED` → khóa; kiểm tra lại).

---

## D2. 🔴 Ngày đi làm thực tế là mốc tiền

**Hiện trạng:** `POST /api/v1/recruitment/applications/{applicationId}/start-work` (`ConfirmStartWorkCommand`) nhận `actualStartDate`, tạo Placement `STARTED`, gọi `IPlacementFinanceService` (MF-05) tạo phí và bảo hành. ✅

**Cần bổ sung:**
- `actualStartDate` **không được ở tương lai** và không sớm hơn ngày offer được chấp nhận → `400 INVALID_START_DATE`.
- **Không có API sửa `actualStartDate` sau khi đã xác nhận.** Nếu cần sửa (nhập nhầm), chỉ Internal HR / Admin được sửa trong **7 ngày**, bắt buộc lý do, có audit, và phải báo MF-05 tính lại hạn thanh toán và bảo hành:

```http
POST /api/v1/placements/{placementId}/start-date-correction
Quyền: INTERNAL_HR, PLATFORM_ADMIN
{ "actualStartDate": "2026-11-03", "reason": "Client nhập nhầm ngày" }
```

  Sau 7 ngày hoặc khi phí đã `PAID` → `409 START_DATE_LOCKED`.

---

## D3. 🟠 Placement của người thay thế

**Quy tắc chốt (mục 1.2):** ứng viên nghỉ trong bảo hành → HR Connect tìm người thay thế **miễn phí**; bảo hành tính lại từ đầu cho người thay thế.

**Cần làm:**
- Khi xác nhận đi làm cho application được đánh dấu thay thế (`isReplacement`, xem tài liệu MF-02 mục B4), Placement lưu `replaces_placement_id`.
- Response `start-work` và `GET /api/v1/placements/{id}` thêm:

```diff
 {
   "placementId": "uuid",
   "status": "STARTED",
   "actualStartDate": "2026-12-05",
+  "isReplacement": true,
+  "replacesPlacementId": "uuid"
 }
```

- MF-05 dựa vào trường này để **không** tạo phí mới (D3 chỉ cần lưu và trả ra).
- **Migration:** thêm `placement.replaces_placement_id` (nullable, FK tới `placement`).

---

## D4. ✅ Không đổi

- Phỏng vấn (`/api/v1/interviews/...`), gửi / rút / phản hồi offer, `planned-start-date`, `not-started`: không bị ảnh hưởng bởi quy tắc phí.

---

## D5. Tiêu chí nghiệm thu

1. Gửi offer thiếu `salaryBasis` → `400 OFFER_SALARY_INCOMPLETE`.
2. Offer job HEADHUNT_COD với `salaryBasis = NET` → `400 HEADHUNT_REQUIRES_GROSS`.
3. Offer `ANNUAL` 360.000.000 → `monthlyGrossSalary = 30.000.000`; MF-05 tính phí theo 30.000.000.
4. Xác nhận đi làm với ngày ở tương lai → `400 INVALID_START_DATE`.
5. Sửa ngày đi làm sau 7 ngày → `409 START_DATE_LOCKED`.
6. Xác nhận đi làm cho người thay thế → Placement có `isReplacement = true`, MF-05 không tạo phí mới.

---

## Ngoài phạm vi MF-04 (để biết, không làm)

| Việc | Người làm |
|---|---|
| Tính phí từ `monthlyGrossSalary` × hệ số trên job | MF-05 |
| Tính lại hạn thanh toán, bảo hành khi sửa ngày đi làm | MF-05 |
| Không tạo phí cho Placement thay thế; mở lại chỗ khi bảo hành bị hủy | MF-05 |
| Đánh dấu application là người thay thế | MF-02 |

## Thứ tự gợi ý

1. **D1** (lương gross tháng) — làm trước, ảnh hưởng trực tiếp số tiền.
2. **D2**.
3. **D3** khi MF-02 và MF-05 có luồng thay thế.
