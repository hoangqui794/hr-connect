# MF-01: việc cần làm theo quy tắc phí mới

> **Dành cho:** dev phụ trách MF-01 (Job).
> **Ngày:** 2026-10-14.
> **Căn cứ:** [`HRConnect/docs/QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md`](../QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md) (đã chốt hết). Số mục `G1`, `1.1`… dưới đây là số mục trong file đó.
> **Hiện trạng** được đối chiếu với code trên `main` ngày 14/10.

Ký hiệu: 🔴 làm trước (đang chặn người khác hoặc sai nghiệp vụ) · 🟠 cần làm · ✅ đã đúng, không cần làm.

---

### A1. 🔴 Sửa migration và snapshot

**Hiện trạng:** 5 migration không có `.Designer.cs` và không cập nhật `ApplicationDbContextModelSnapshot`:
`20261009233000_AddJobCommercialTerms`, `20261010000000_AddJobPostingPackagesAndFees`, `20261012170000_AddCandidateCareerFields`, `20261013020000_AddCandidateSavedJobsAndApplicationDeadline`, `20261013210000_AddJobMaxApplicationsAndPendingPayment`.
`dotnet ef migrations has-pending-model-changes` đang báo *"Changes have been made to the model since the last migration"*.

**Hậu quả:** lần tới bất kỳ ai chạy `dotnet ef migrations add` sẽ sinh lại toàn bộ cột/bảng trên, migration đó lỗi khi chạy. **Đang chặn cả nhóm.**

**Cần làm:**
1. Cập nhật snapshot cho khớp model hiện tại (cách an toàn: tạo một migration rỗng bằng `dotnet ef migrations add SyncSnapshotAfterMf01`, xóa phần `Up/Down` vì DB đã có các cột, chỉ giữ snapshot mới).
2. Kiểm tra: `dotnet ef migrations has-pending-model-changes` → *"No changes have been made to the model since the last migration"*.

---

### A2. 🔴 Client không được nhập giá (G2)

**Hiện trạng:** `POST /api/v1/jobs` và `PUT /api/v1/jobs/{jobId}` nhận `feeMultiplier`, `warrantyDays`, `paymentDueDays`, `sourcingPricePerCv` từ Client và lưu thẳng. Form `JobFormPage.tsx` có ô nhập các trường này.

**Request — bỏ 4 trường giá:**

```diff
 POST /api/v1/jobs            (quyền job.create — Client)
 PUT  /api/v1/jobs/{jobId}    (quyền job.update — Client)
 {
   "serviceTypeId": "uuid",
   "title": "Senior .NET Developer",
   "quantity": 2,
   "salaryMin": 25000000,
   "salaryMax": 35000000,
   "sourcingTarget": 10,          // giữ — chỉ CV_SOURCING, là NHU CẦU của Client
   "postingPackageId": "uuid",    // giữ — chỉ CV_APPLICATION
-  "sourcingPricePerCv": 600000,
-  "feeMultiplier": 1.5,
-  "warrantyDays": 30,
-  "paymentDueDays": 20,
   ...
 }
```

- Nếu body vẫn gửi 4 trường này: **bỏ qua, không lưu** (không trả lỗi, để FE cũ không vỡ).
- Xóa 4 thuộc tính khỏi `CreateJobCommand` / `UpdateJobCommand`.

**FE (`JobFormPage.tsx`):** xóa các ô "Đơn giá CV", "Hệ số phí", "Bảo hành", "Hạn thanh toán". Với CV_SOURCING giữ ô **Sourcing Target** kèm dòng gợi ý: *"Giá do HR Connect thỏa thuận với bạn khi duyệt tin."*

---

### A3. 🔴 `SubmitJob` không tự điền giá nữa (G1, G3)

**Hiện trạng:** `SubmitJobCommandHandler` gán `job.FeeMultiplier ??= _businessSettings.DefaultHeadhuntFeeMultiplier` … lúc **Client gửi duyệt**. Điều khoản bị chốt trước khi HR kịp thỏa thuận, và lấy từ `BusinessSettingsOptions` (viết cứng **14 ngày**, **100.000đ/CV**, sai tài liệu).

**Cần làm:**
- Bỏ toàn bộ đoạn gán mặc định giá trong `SubmitJob`. Giữ kiểm tra `SourcingTarget > 0` cho CV_SOURCING.
- Không đổi request/response của `POST /api/v1/jobs/{jobId}/submit`.

---

### A4. 🔴 Internal HR chốt điều khoản khi duyệt (G2, G3)

**Hiện trạng:** `POST /api/v1/jobs/{jobId}/approve?concurrencyToken=…&paymentReference=…` không có body, HR không nhập được giá. `JobReviewPage.tsx` chỉ hiển thị giá.

#### A4.1 API mới: lấy giá trị điền sẵn cho màn duyệt

Internal HR không có quyền `system_config.view` nên không đọc được `/api/v1/admin/settings`. Thêm:

```http
GET /api/v1/jobs/{jobId}/commercial-terms/defaults
Quyền: job.review (INTERNAL_HR, PLATFORM_ADMIN)
```

Response (theo Service Type của job):

```jsonc
// HEADHUNT_COD
{
  "success": true,
  "data": {
    "serviceTypeCode": "HEADHUNT_COD",
    "defaults": { "feeMultiplier": 1.5, "warrantyDays": 30, "paymentDueDays": 20 },
    "ranges": {
      "feeMultiplier": { "min": 0.1, "max": 10 },
      "warrantyDays": { "min": 1, "max": 365 },
      "paymentDueDays": { "min": 1, "max": 120 }
    }
  }
}

// CV_SOURCING
{
  "success": true,
  "data": {
    "serviceTypeCode": "CV_SOURCING",
    "clientRequested": { "sourcingTarget": 10 },
    "defaults": {
      "sourcingTarget": 10,          // = số Client đề xuất
      "pricePerCv": 600000,
      "depositPercent": 50,
      "reviewDays": 7,
      "paymentDueDays": 20
    },
    "ranges": {
      "sourcingTarget": { "min": 1, "max": 1000 },
      "pricePerCv": { "min": 1000, "max": 100000000 },
      "depositPercent": { "min": 0, "max": 100 },
      "reviewDays": { "min": 1, "max": 30 },
      "paymentDueDays": { "min": 1, "max": 120 }
    },
    "estimatedTotal": 6000000,       // sourcingTarget × pricePerCv
    "estimatedDeposit": 3000000
  }
}

// CV_APPLICATION: không có điều khoản thương lượng (giá công khai theo gói)
{ "success": true, "data": { "serviceTypeCode": "CV_APPLICATION", "defaults": null } }
```

Đọc số từ `IAdminBusinessSettings` (`HRConnect.Application/Common/Settings/BusinessSettings.cs`). Cần **thêm 4 khóa** vào `BusinessSettingKeys.All` (phía MF-05 sẽ thêm nếu MF-01 muốn, báo trước):

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
+   "commercialTerms": {                 // bắt buộc với HEADHUNT_COD, CV_SOURCING; null với CV_APPLICATION
+     "feeMultiplier": 1.8,              // HEADHUNT_COD
+     "warrantyDays": 30,                // HEADHUNT_COD
+     "paymentDueDays": 20,              // HEADHUNT_COD, CV_SOURCING
+     "sourcingTarget": 10,              // CV_SOURCING
+     "pricePerCv": 550000,              // CV_SOURCING
+     "depositPercent": 50,              // CV_SOURCING
+     "reviewDays": 7                    // CV_SOURCING
+   },
+   "agreementReference": "Email ABC xác nhận ngày 12/10/2026",   // bắt buộc khi có giá trị khác mặc định
+   "note": "Giảm hệ số vì tuyển 2 người"                           // không bắt buộc, tối đa 1000 ký tự
+ }
```

Quy tắc:
- Trường bỏ trống → lấy **giá trị điền sẵn** hiện tại.
- Trường không thuộc Service Type của job → trả `400` (`TERM_NOT_APPLICABLE`).
- Ngoài khoảng ở A4.1 → trả `400` (`TERM_OUT_OF_RANGE`), message nêu tên trường và khoảng.
- HR **giảm Sourcing Target** so với số Client đề xuất mà không có `note` → `400` (`NOTE_REQUIRED`).
- Lưu điều khoản lên job **tại thời điểm duyệt** (G3). Không đọc lại mặc định ở bất kỳ bước nào sau đó.
- **Audit** `JOB_APPROVED` thêm: `defaultsAtApproval`, `approvedTerms`, `agreementReference`, `note`.
- `paymentReference` (CV_APPLICATION) giữ nhưng chuyển vào body nếu còn dùng.

Response: giữ `JobActionResponse`, `data` (JobDto) thêm khối `commercialTerms` (xem A5).

**FE (`JobReviewPage.tsx`, cả Internal HR và Admin):** thêm khối **"Điều khoản phí"** theo Service Type: các ô điền sẵn từ A4.1, hiện khoảng hợp lệ, CV_SOURCING hiện tổng phí và tiền cọc dự kiến; ô "Mã tham chiếu thỏa thuận"; nút "Duyệt và công bố" gửi body như trên.

---

### A5. 🟠 Client xem điều khoản đã chốt (chỉ đọc)

`GET /api/v1/jobs/{jobId}` — `JobDto` hiện trả rời rạc `feeMultiplier`, `warrantyDays`, `paymentDueDays`, `sourcingPricePerCv`. Gom thành:

```diff
 {
   "jobId": "uuid",
   "status": "ACTIVE",
-  "sourcingPricePerCv": 600000,
-  "feeMultiplier": 1.5,
-  "warrantyDays": 30,
-  "paymentDueDays": 20,
+  "commercialTerms": {
+    "serviceTypeCode": "HEADHUNT_COD",
+    "feeMultiplier": 1.8,
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

- Trước khi duyệt: `commercialTerms = null` (chưa chốt).
- `agreementReference`, `note`, `defaultsAtApproval` **chỉ** trả cho Internal HR / Admin, không trả cho Client.
- Để FE không vỡ: giữ 4 trường cũ thêm 1 bản phát hành, đánh dấu `[Obsolete]`, sau đó xóa.

**FE (chi tiết job phía Client):** hiện câu: *"Phí dịch vụ = lương offer × **1,8** cho mỗi người đi làm. Thanh toán trong **20** ngày kể từ ngày đi làm. Bảo hành **30** ngày."* (lấy số từ `commercialTerms`).

---

### A6. 🟠 Bỏ nguồn con số thứ hai (G1)

**Hiện trạng:** MF-01 có `IBusinessSettings` / `BusinessSettingsOptions` (`HRConnect.Application/Common/Models/BusinessSettingsOptions.cs`, `HRConnect.Infrastructure/Services/BusinessSettings.cs`) với giá trị viết cứng `DefaultPaymentDueDays = 14`, `DefaultSourcingPricePerCv = 100_000m`.

**Cần làm:** sau A3 và A4, chỗ duy nhất còn đọc mặc định là A4.1 → chuyển sang `IAdminBusinessSettings`, rồi xóa `IBusinessSettings`, `BusinessSettingsOptions`, `Infrastructure/Services/BusinessSettings.cs`. Riêng giá gói đăng tin (`StandardPostingPackagePrice`) đọc từ bảng gói (`job_posting_package.price`). Báo MF-05 để xóa 3 thuộc tính tương thích còn lại trong `Mf05Settings`.

---

### A7. ✅ CV_APPLICATION: duyệt trước, trả tiền sau (mục 3)

Code hiện tại **đã đúng**: `SubmitJob` tạo phí `PENDING` → `ApproveJob` chuyển job sang `PENDING_PAYMENT` → `RecordJobPostingFeePayment` chuyển `PAID` và job `ACTIVE`. Chỉ cần kiểm tra lại FE: Client thấy nút "Thanh toán" **sau** khi job được duyệt, không phải trước khi gửi duyệt.

---

### A8. Tiêu chí nghiệm thu MF-01

1. `has-pending-model-changes` → "No changes".
2. Client gửi `feeMultiplier: 0.1` khi tạo/sửa job → job **không** lưu giá trị này.
3. Client gửi duyệt job HEADHUNT_COD → `feeMultiplier` trên job vẫn `null`.
4. HR duyệt bỏ trống `commercialTerms` → job nhận **1,5 / 30 / 20**.
5. HR duyệt với `feeMultiplier: 1.8` → job lưu 1,8; audit có cả 1,5 (mặc định) và 1,8.
6. HR nhập `feeMultiplier: 12` → `400 TERM_OUT_OF_RANGE`.
7. Admin đổi mặc định hệ số thành 2,0 → job duyệt **sau đó** điền sẵn 2,0; job duyệt **trước đó** giữ 1,8.
8. Client gọi `GET /jobs/{id}` → thấy `commercialTerms`, **không** thấy `agreementReference`.
9. MF-05: ứng viên của job (hệ số 1,8) đi làm → phí dịch vụ dùng **1,8**.

---

## Ngoài phạm vi MF-01 (để biết, không làm)

| Việc | Người làm |
|---|---|
| Thêm 4 khóa cấu hình CV_SOURCING vào trang Cài đặt Admin (dùng cho A4.1) | MF-05 |
| Phiếu đặt cọc 50% khi job CV_SOURCING được duyệt | MF-05 |
| Tính phí dịch vụ theo `commercialTerms` đã lưu trên job | MF-05 |
| Client chấp nhận / từ chối CV của CV_SOURCING | MF-03 / MF-05 |

## Thứ tự gợi ý

1. **A1** (migration): làm ngay, đang chặn mọi người.
2. **A2 → A3 → A4 → A5 → A6**: cùng một luồng, làm liền nhau.
