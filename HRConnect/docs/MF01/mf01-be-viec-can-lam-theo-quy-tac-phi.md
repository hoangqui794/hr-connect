# MF-01 (Backend): việc cần làm theo quy tắc phí mới

> **Dành cho:** Mi — backend MF-01 (Job). Phần giao diện do Sang làm, xem [`mf01-fe-viec-can-lam-theo-quy-tac-phi.md`](mf01-fe-viec-can-lam-theo-quy-tac-phi.md).
> **Ngày:** 2026-10-14 (bản 2: Client **đề xuất** phí, Internal HR **chốt** phí).
> **Căn cứ:** [`HRConnect/docs/QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md`](../QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md). Số mục `G1`, `1.1`… dưới đây là số mục trong file đó.
> **Hiện trạng** được đối chiếu với code trên `main` ngày 14/10.

Ký hiệu: 🔴 làm trước (đang chặn người khác hoặc sai nghiệp vụ) · 🟠 cần làm · ✅ đã đúng, không cần làm.

---

## Ý tưởng chính

Giữ ý của MF-01: **Client được nhập mức phí mong muốn** để Internal HR có căn cứ thỏa thuận. Bổ sung phần còn thiếu: **Internal HR chốt con số cuối cùng khi duyệt**.

```
Client nhập JD + phí ĐỀ XUẤT (không bắt buộc)
        │  gửi duyệt
        ▼
Internal HR xem đề xuất ──► liên hệ Client thỏa thuận (ngoài hệ thống)
        │
        ▼
Internal HR nhập phí ĐÃ CHỐT (điền sẵn = đề xuất của Client, hoặc mặc định Admin)
        │  duyệt
        ▼
Job lưu cả 2 bộ: proposedTerms (Client đề xuất) + commercialTerms (HR chốt)
MF-05 tính tiền theo commercialTerms
```

## Hiện trạng (đã kiểm tra code)

| # | Chỗ | Đang làm | Vấn đề |
|---|---|---|---|
| 1 | `JobFormPage.tsx` dòng ~923–927 | Khối "🎯 Thỏa thuận phí dịch vụ Headhunt", mô tả *"Nhập các điều khoản thương mại **đã thống nhất**…"* | Câu chữ bảo Client nhập **giá đã chốt**, trong khi lúc này HR chưa thỏa thuận gì |
| 2 | `JobReviewPage.tsx` dòng ~262 | Phí chỉ hiện dạng nhãn `Tag` | HR **không sửa được** con số |
| 3 | `ApproveJobCommand` | Chỉ nhận `concurrencyToken`, `paymentReference` | Duyệt là giữ nguyên số Client nhập |
| 4 | `UpdateJobCommandHandler.cs:19` | Chỉ sửa được khi `DRAFT` / `REJECTED` | Muốn đổi giá, HR phải **từ chối** để Client tự sửa; mã từ chối không có lý do về giá |
| 5 | `SubmitJobCommandHandler` | Client để trống → tự điền **100.000đ/CV**, **14 ngày** | Lệch tài liệu (600.000đ, 20 ngày); số bị chốt trước khi HR xem |
| 6 | — | Không lưu "Client đề xuất bao nhiêu, HR chốt bao nhiêu", không có audit phần giá | Không đối chiếu được khi có tranh chấp |

---

### A1. 🔴 Sửa migration và snapshot

**Hiện trạng:** 5 migration không có `.Designer.cs` và không cập nhật `ApplicationDbContextModelSnapshot`:
`20261009233000_AddJobCommercialTerms`, `20261010000000_AddJobPostingPackagesAndFees`, `20261012170000_AddCandidateCareerFields`, `20261013020000_AddCandidateSavedJobsAndApplicationDeadline`, `20261013210000_AddJobMaxApplicationsAndPendingPayment`.
`dotnet ef migrations has-pending-model-changes` đang báo *"Changes have been made to the model since the last migration"*.

**Hậu quả:** lần tới bất kỳ ai chạy `dotnet ef migrations add` sẽ sinh lại toàn bộ cột/bảng trên, migration đó lỗi khi chạy. **Đang chặn cả nhóm.**

**Cần làm:**
1. Cập nhật snapshot cho khớp model hiện tại (cách an toàn: tạo một migration bằng `dotnet ef migrations add SyncSnapshotAfterMf01`, xóa phần `Up/Down` vì DB đã có các cột, chỉ giữ snapshot mới).
2. Kiểm tra: `dotnet ef migrations has-pending-model-changes` → *"No changes have been made to the model since the last migration"*.
3. Migration của A2 (cột `proposed_*`) tạo **sau** bước này.

---

### A2. 🔴 Client nhập phí ĐỀ XUẤT (không phải phí đã chốt)

**Dữ liệu:** tách 2 bộ cột trên bảng `job`:

| Cột hiện có (giữ, đổi nghĩa thành **HR chốt**) | Cột mới (**Client đề xuất**) |
|---|---|
| `fee_multiplier` | `proposed_fee_multiplier` |
| `warranty_days` | `proposed_warranty_days` |
| `payment_due_days` | `proposed_payment_due_days` |
| `sourcing_price_per_cv` | `proposed_price_per_cv` |
| — | `proposed_fee_note` (text, tối đa 1000) — Client ghi chú mong muốn |

`sourcing_target` giữ nguyên: là **nhu cầu** của Client (HR được điều chỉnh khi duyệt, xem A4).

**Request — đổi tên trường giá thành `proposed…`:**

```diff
 POST /api/v1/jobs            (quyền job.create — Client)
 PUT  /api/v1/jobs/{jobId}    (quyền job.update — Client)
 {
   "serviceTypeId": "uuid",
   "title": "Senior .NET Developer",
   "quantity": 2,
   "salaryMin": 25000000,
   "salaryMax": 35000000,
   "sourcingTarget": 10,                   // CV_SOURCING — nhu cầu, bắt buộc khi gửi duyệt
   "postingPackageId": "uuid",             // CV_APPLICATION
-  "sourcingPricePerCv": 600000,
-  "feeMultiplier": 1.5,
-  "warrantyDays": 30,
-  "paymentDueDays": 20,
+  "proposedTerms": {                      // KHÔNG bắt buộc; null = để HR Connect đề xuất
+    "feeMultiplier": 1.5,                 // HEADHUNT_COD
+    "warrantyDays": 30,                   // HEADHUNT_COD
+    "paymentDueDays": 20,                 // HEADHUNT_COD, CV_SOURCING
+    "pricePerCv": 500000,                 // CV_SOURCING
+    "note": "Mong muốn phí 1,5 tháng vì tuyển 2 người"
+  },
   ...
 }
```

- Kiểm tra khoảng như A4.1 (để Client không nhập số vô lý); trường không thuộc Service Type → bỏ qua.
- **Client không ghi được vào `fee_multiplier`, `warranty_days`, `payment_due_days`, `sourcing_price_per_cv`.** Nếu body cũ vẫn gửi 4 trường này → coi như `proposedTerms` (để FE cũ không vỡ trong lúc chuyển).
- Giữ cách nhập "số tháng lương" hoặc "% lương năm" trên FE; gửi lên backend vẫn là `feeMultiplier` (% năm × 12 / 100, như hiện tại).

**Giao diện:** do Sang làm, xem [`mf01-fe-viec-can-lam-theo-quy-tac-phi.md`](mf01-fe-viec-can-lam-theo-quy-tac-phi.md).

---

### A3. 🔴 `SubmitJob` không tự điền giá nữa (G1, G3)

**Hiện trạng:** `SubmitJobCommandHandler` gán `job.FeeMultiplier ??= _businessSettings.DefaultHeadhuntFeeMultiplier`, `job.SourcingPricePerCv ??= …DefaultSourcingPricePerCv` … ngay khi **Client gửi duyệt**.

**Cần làm:**
- Bỏ toàn bộ đoạn gán mặc định giá trong `SubmitJob`. Các cột "HR chốt" giữ `null` cho tới khi duyệt.
- Giữ kiểm tra `SourcingTarget > 0` cho CV_SOURCING.
- Không đổi request/response của `POST /api/v1/jobs/{jobId}/submit`.

---

### A4. 🔴 Internal HR chốt điều khoản khi duyệt (G2, G3)

#### A4.1 API mới: lấy giá trị điền sẵn cho màn duyệt

Internal HR không có quyền `system_config.view` nên không đọc được `/api/v1/admin/settings`. Thêm:

```http
GET /api/v1/jobs/{jobId}/commercial-terms/defaults
Quyền: job.review (INTERNAL_HR, PLATFORM_ADMIN)
```

**Giá trị điền sẵn** = đề xuất của Client nếu có, không có thì lấy mặc định Admin. Trả kèm cả hai để HR so sánh:

```jsonc
// HEADHUNT_COD
{
  "success": true,
  "data": {
    "serviceTypeCode": "HEADHUNT_COD",
    "proposed":       { "feeMultiplier": 1.2, "warrantyDays": 30, "paymentDueDays": null,
                        "note": "Mong muốn phí thấp vì tuyển 2 người" },
    "adminDefaults":  { "feeMultiplier": 1.5, "warrantyDays": 30, "paymentDueDays": 20 },
    "prefill":        { "feeMultiplier": 1.2, "warrantyDays": 30, "paymentDueDays": 20 },
    "ranges": {
      "feeMultiplier":  { "min": 0.1, "max": 10 },
      "warrantyDays":   { "min": 1,   "max": 365 },
      "paymentDueDays": { "min": 1,   "max": 120 }
    }
  }
}

// CV_SOURCING
{
  "success": true,
  "data": {
    "serviceTypeCode": "CV_SOURCING",
    "proposed":      { "sourcingTarget": 10, "pricePerCv": 500000, "paymentDueDays": null, "note": null },
    "adminDefaults": { "pricePerCv": 600000, "depositPercent": 50, "reviewDays": 7, "paymentDueDays": 20 },
    "prefill":       { "sourcingTarget": 10, "pricePerCv": 500000, "depositPercent": 50, "reviewDays": 7, "paymentDueDays": 20 },
    "ranges": {
      "sourcingTarget": { "min": 1,    "max": 1000 },
      "pricePerCv":     { "min": 1000, "max": 100000000 },
      "depositPercent": { "min": 0,    "max": 100 },
      "reviewDays":     { "min": 1,    "max": 30 },
      "paymentDueDays": { "min": 1,    "max": 120 }
    },
    "estimatedTotal": 5000000,       // prefill.sourcingTarget × prefill.pricePerCv
    "estimatedDeposit": 2500000
  }
}

// CV_APPLICATION: không có điều khoản thương lượng (giá công khai theo gói)
{ "success": true, "data": { "serviceTypeCode": "CV_APPLICATION", "prefill": null } }
```

Đọc mặc định từ `IAdminBusinessSettings` (`HRConnect.Application/Common/Settings/BusinessSettings.cs`). Cần **thêm 4 khóa** vào `BusinessSettingKeys.All` (MF-05 thêm, xem tài liệu MF-05 mục E6):

| Khóa | Mặc định | Khoảng |
|---|---|---|
| `mf05.cv_sourcing.price_per_cv` | 600000 | 1.000 – 100.000.000 |
| `mf05.cv_sourcing.deposit_percent` | 50 | 0 – 100 |
| `mf05.cv_sourcing.review_days` | 7 | 1 – 30 |
| `mf05.cv_sourcing.payment_due_days` | 20 | 1 – 120 |

#### A4.2 Sửa API duyệt: nhận điều khoản trong body

```http
POST /api/v1/jobs/{jobId}/approve
Quyền: job.review (INTERNAL_HR, PLATFORM_ADMIN)
```

```diff
- POST /api/v1/jobs/{jobId}/approve?concurrencyToken=…&paymentReference=…   (không body)
+ POST /api/v1/jobs/{jobId}/approve
+ {
+   "concurrencyToken": "uuid",
+   "commercialTerms": {                 // HEADHUNT_COD, CV_SOURCING; null với CV_APPLICATION
+     "feeMultiplier": 1.4,              // HEADHUNT_COD
+     "warrantyDays": 30,                // HEADHUNT_COD
+     "paymentDueDays": 20,              // HEADHUNT_COD, CV_SOURCING
+     "sourcingTarget": 10,              // CV_SOURCING
+     "pricePerCv": 550000,              // CV_SOURCING
+     "depositPercent": 50,              // CV_SOURCING
+     "reviewDays": 7                    // CV_SOURCING
+   },
+   "agreementReference": "Email ABC xác nhận ngày 12/10/2026",
+   "note": "Client đề xuất 1,2; thống nhất 1,4 vì vị trí cấp cao",
+   "paymentReference": null             // CV_APPLICATION, như hiện tại
+ }
```

Quy tắc:
- Trường bỏ trống → lấy `prefill` (A4.1).
- Trường không thuộc Service Type của job → `400 TERM_NOT_APPLICABLE`.
- Ngoài khoảng → `400 TERM_OUT_OF_RANGE`, message nêu tên trường và khoảng.
- **Số HR chốt khác số Client đề xuất** → bắt buộc `agreementReference` (`400 AGREEMENT_REFERENCE_REQUIRED`), để có bằng chứng Client đã đồng ý mức mới.
- HR **giảm Sourcing Target** so với số Client yêu cầu mà không có `note` → `400 NOTE_REQUIRED`.
- Lưu vào các cột "HR chốt" **tại thời điểm duyệt** (G3); các cột `proposed_*` giữ nguyên để đối chiếu.
- **Audit** `JOB_APPROVED` thêm: `proposedTerms`, `adminDefaultsAtApproval`, `approvedTerms`, `agreementReference`, `note`.

**Từ chối vì chưa thống nhất được giá:** thêm mã lý do `REJECTED_TERMS_NOT_AGREED` vào `JobReasonCodes` cho trường hợp hai bên không đi tới thỏa thuận.

Response: giữ `JobActionResponse`; `data` (JobDto) có thêm `proposedTerms` và `commercialTerms` (xem A5).

**Giao diện:** do Sang làm, xem [`mf01-fe-viec-can-lam-theo-quy-tac-phi.md`](mf01-fe-viec-can-lam-theo-quy-tac-phi.md).

---

### A5. 🟠 Trả về đề xuất và điều khoản đã chốt

`GET /api/v1/jobs/{jobId}` — `JobDto` hiện trả rời rạc `feeMultiplier`, `warrantyDays`, `paymentDueDays`, `sourcingPricePerCv`. Gom thành 2 khối:

```diff
 {
   "jobId": "uuid",
   "status": "ACTIVE",
-  "sourcingPricePerCv": 600000,
-  "feeMultiplier": 1.5,
-  "warrantyDays": 30,
-  "paymentDueDays": 20,
+  "proposedTerms": {                    // Client đề xuất (null nếu không đề xuất)
+    "feeMultiplier": 1.2, "warrantyDays": 30, "paymentDueDays": null,
+    "pricePerCv": null, "note": "Mong muốn phí thấp vì tuyển 2 người"
+  },
+  "commercialTerms": {                  // HR chốt (null khi chưa duyệt)
+    "serviceTypeCode": "HEADHUNT_COD",
+    "feeMultiplier": 1.4,
+    "warrantyDays": 30,
+    "paymentDueDays": 20,
+    "sourcingTarget": null,
+    "pricePerCv": null,
+    "depositPercent": null,
+    "reviewDays": null,
+    "agreedAt": "2026-10-14T03:00:00Z",
+    "agreedBy": "Nguyễn Văn HR"
+  },
   ...
 }
```

- Client thấy cả `proposedTerms` (của mình) và `commercialTerms`.
- `agreementReference`, `note` của HR, `adminDefaultsAtApproval` **chỉ** trả cho Internal HR / Admin.
- Để FE không vỡ: giữ 4 trường cũ (trả theo `commercialTerms`) thêm 1 bản phát hành, đánh dấu `[Obsolete]`, sau đó xóa.

**Giao diện:** do Sang làm, xem [`mf01-fe-viec-can-lam-theo-quy-tac-phi.md`](mf01-fe-viec-can-lam-theo-quy-tac-phi.md).

---

### A6. 🟠 Bỏ nguồn con số thứ hai (G1)

**Hiện trạng:** MF-01 có `IBusinessSettings` / `BusinessSettingsOptions` (`HRConnect.Application/Common/Models/BusinessSettingsOptions.cs`, `HRConnect.Infrastructure/Services/BusinessSettings.cs`) với giá trị viết cứng `DefaultPaymentDueDays = 14`, `DefaultSourcingPricePerCv = 100_000m`.

**Cần làm:** sau A3 và A4, chỗ duy nhất còn đọc mặc định là A4.1 → chuyển sang `IAdminBusinessSettings`, rồi xóa `IBusinessSettings`, `BusinessSettingsOptions`, `Infrastructure/Services/BusinessSettings.cs`. Giá gói đăng tin (`StandardPostingPackagePrice`) đọc từ bảng gói (`job_posting_package.price`). Báo MF-05 để xóa 3 thuộc tính tương thích còn lại trong `Mf05Settings`.

---

### A7. ✅ CV_APPLICATION: duyệt trước, trả tiền sau (mục 3)

Code hiện tại **đã đúng**: `SubmitJob` tạo phí `PENDING` → `ApproveJob` chuyển job sang `PENDING_PAYMENT` → `RecordJobPostingFeePayment` chuyển `PAID` và job `ACTIVE`. Chỉ cần kiểm tra lại FE: Client thấy nút "Thanh toán" **sau** khi job được duyệt.

---

### A8. Tiêu chí nghiệm thu MF-01

1. `has-pending-model-changes` → "No changes".
2. Client tạo job HEADHUNT_COD với `proposedTerms.feeMultiplier = 1.2` → lưu vào `proposed_fee_multiplier`; `fee_multiplier` vẫn `null`.
3. Client gửi duyệt → `fee_multiplier` vẫn `null` (không tự điền mặc định).
4. `GET …/commercial-terms/defaults` → `prefill.feeMultiplier = 1.2` (theo đề xuất); job không có đề xuất → `1.5` (mặc định Admin).
5. HR duyệt giữ nguyên 1,2 → không cần `agreementReference`; job lưu 1,2.
6. HR duyệt với 1,4 mà không có `agreementReference` → `400 AGREEMENT_REFERENCE_REQUIRED`; có thì lưu 1,4, audit có cả 1,2 (đề xuất), 1,5 (mặc định), 1,4 (chốt).
7. HR nhập `feeMultiplier: 12` → `400 TERM_OUT_OF_RANGE`.
8. Admin đổi mặc định hệ số thành 2,0 → job duyệt **trước đó** giữ nguyên số đã chốt.
9. Client gọi `GET /jobs/{id}` → thấy `proposedTerms` và `commercialTerms`, **không** thấy `agreementReference`.
10. HR từ chối với `REJECTED_TERMS_NOT_AGREED` → Client sửa đề xuất và gửi lại được.
11. MF-05: ứng viên của job (chốt 1,4) đi làm → phí dịch vụ dùng **1,4**, không dùng 1,2.

---

## Ngoài phạm vi MF-01 (để biết, không làm)

| Việc | Người làm |
|---|---|
| Thêm 4 khóa cấu hình CV_SOURCING vào trang Cài đặt Admin (dùng cho A4.1) | MF-05 |
| Phiếu đặt cọc 50% khi job CV_SOURCING được duyệt | MF-05 |
| Tính phí dịch vụ theo `commercialTerms` (số HR chốt) | MF-05 |
| Client chấp nhận / từ chối CV của CV_SOURCING | MF-03 / MF-05 |

## Thứ tự gợi ý

1. **A1** (migration): làm ngay, đang chặn mọi người.
2. **A2 → A3 → A4 → A5 → A6**: cùng một luồng, làm liền nhau.
3. Làm xong API nào thì báo Sang để giao diện nối vào (thứ tự Sang cần: A2 → A4.1 → A4.2 → A5).
