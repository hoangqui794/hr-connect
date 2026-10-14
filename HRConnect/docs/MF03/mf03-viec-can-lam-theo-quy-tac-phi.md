# MF-03: việc cần làm theo quy tắc phí mới

> **Dành cho:** dev phụ trách MF-03 (AI Matching và sàng lọc, giao CV cho Client).
> **Ngày:** 2026-10-14.
> **Căn cứ:** [`HRConnect/docs/QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md`](../QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md) (đã chốt hết), chủ yếu **mục 2 (CV_SOURCING)**.
> **Hiện trạng** được đối chiếu với code trên `main` ngày 14/10.

Ký hiệu: 🔴 làm trước · 🟠 cần làm · ✅ đã có, không cần làm.

---

## C1. ✅ Đã có

- `PATCH /api/v1/jobs/{jobId}/applications/{applicationId}/status` đã nhận `reasonCode` (mã lý do loại) và `reason` (ghi chú).
- `POST /api/v1/jobs/{jobId}/applications/{applicationId}/start-screening` đã có (tự chuyển `SCREENING` khi mở hồ sơ).
- `POST /api/v1/recruitment/applications/{id}/backup-decision` đã có (Client quyết định hồ sơ dự phòng).
- `ScreeningPolicy`: Internal HR sàng lọc HEADHUNT_COD và CV_SOURCING; Client sàng lọc CV_APPLICATION.

---

## C2. 🔴 Giao CV cho Client và Client xem xét trong 7 ngày (mục 2)

**Quy tắc chốt:** CV_SOURCING chỉ tính tiền CV được Client **chấp nhận**. Client có **N ngày** (mặc định **7**, lấy từ `commercialTerms.reviewDays` của job) để chấp nhận hoặc từ chối **kèm lý do hợp lệ**. Hết hạn mà không phản hồi → **coi như chấp nhận**.

**Hiện trạng:** chưa có khái niệm "giao CV" và "Client chấp nhận CV". `SHORTLISTED` hiện mang nghĩa "HR chọn", không phải "Client chấp nhận để tính tiền".

### C2.1 Dữ liệu mới (bảng `sourcing_delivery`, 1 dòng / application CV_SOURCING đã giao)

| Cột | Ý nghĩa |
|---|---|
| `delivery_id` | khóa |
| `application_id`, `job_id` | |
| `status` | `DELIVERED` → `ACCEPTED` / `REJECTED` / `AUTO_ACCEPTED` / `REPLACED` |
| `delivered_at`, `review_due_at` | `review_due_at = delivered_at + reviewDays` |
| `decided_at`, `decided_by` | null nếu `AUTO_ACCEPTED` |
| `reject_reason_code`, `reject_note` | khi `REJECTED` |
| `replaced_by_delivery_id` | khi HR lấy CV dự phòng thay vào |

**Đếm tiền:** CV được tính = `ACCEPTED` + `AUTO_ACCEPTED`, tối đa bằng `sourcingTarget` của job.

### C2.2 API: Internal HR giao CV

```http
POST /api/v1/jobs/{jobId}/sourcing/deliveries
Quyền: application.screen (INTERNAL_HR)
```

```jsonc
// Request
{ "applicationIds": ["uuid", "uuid"] }

// Response 200
{
  "success": true,
  "data": {
    "delivered": [
      { "deliveryId": "uuid", "applicationId": "uuid", "status": "DELIVERED",
        "deliveredAt": "2026-10-14T03:00:00Z", "reviewDueAt": "2026-10-21T03:00:00Z" }
    ],
    "deliveredCount": 7,
    "acceptedCount": 3,
    "sourcingTarget": 10
  }
}
```

Điều kiện từng application (sai → `409` kèm `errorCode`):
- Job là CV_SOURCING và `ACTIVE` (`JOB_NOT_SOURCING`).
- Application `SHORTLISTED` (HR đã xác nhận đạt) (`APPLICATION_NOT_QUALIFIED`).
- Submission đã `CONFIRMED` consent (`CONSENT_NOT_CONFIRMED`).
- Số CV đang `DELIVERED` + đã được tính **không vượt** `sourcingTarget` (`SOURCING_TARGET_REACHED`). Phần dư HR chuyển `BACKUP`.

### C2.3 API: Client chấp nhận / từ chối

```http
POST /api/v1/jobs/{jobId}/sourcing/deliveries/{deliveryId}/decision
Quyền: Client của công ty sở hữu job
```

```jsonc
// Request
{
  "decision": "ACCEPTED",                  // hoặc "REJECTED"
  "reasonCode": "DUPLICATE_ALREADY_OWNED", // bắt buộc khi REJECTED
  "note": "Ứng viên đã nộp trực tiếp cho chúng tôi tháng 9"  // bắt buộc khi reasonCode = OTHER
}

// Response 200
{ "success": true, "data": { "deliveryId": "uuid", "status": "REJECTED", "decidedAt": "..." } }
```

**Mã lý do từ chối hợp lệ** (đúng mục 2 của file quy tắc):

| Mã | Nghĩa |
|---|---|
| `DUPLICATE_ALREADY_OWNED` | Ứng viên Client đã có từ trước |
| `FALSE_INFORMATION` | Thông tin trong CV sai sự thật |
| `UNREACHABLE` | Không liên lạc được / ứng viên không còn nhu cầu |
| `WRONG_JOB` | Không đúng job hoặc tiêu chí cơ bản |
| `OTHER` | Khác (bắt buộc ghi chú; Internal HR xác minh) |

- **Không** có mã "không chọn phỏng vấn": Client không chọn ứng viên vẫn phải trả tiền CV đó.
- Quá `reviewDueAt` → `409 REVIEW_WINDOW_CLOSED`.
- `REJECTED` với `OTHER` → Internal HR xác minh; HR bác bỏ thì chuyển `ACCEPTED`.

### C2.4 Tác vụ nền: tự chấp nhận

Chạy định kỳ (dùng chung worker của MF-05): `DELIVERED` và `review_due_at <= now` → `AUTO_ACCEPTED`. Ghi audit `SOURCING_DELIVERY_AUTO_ACCEPTED`. Gửi sự kiện cho MF-05 tính tiền và hoa hồng.

### C2.5 Lấy CV dự phòng thay vào

Khi một CV bị `REJECTED` hợp lệ, Internal HR giao một CV `BACKUP`:

```http
POST /api/v1/jobs/{jobId}/sourcing/deliveries/{deliveryId}/replace
{ "applicationId": "uuid" }   // CV dự phòng, phải đủ điều kiện như C2.2
```

CV cũ → `REPLACED`, CV mới → `DELIVERED` với thời hạn xem xét mới.

### C2.6 Danh sách cho Client và HR

```http
GET /api/v1/jobs/{jobId}/sourcing/deliveries?status=DELIVERED
```

```jsonc
{
  "success": true,
  "data": {
    "summary": { "sourcingTarget": 10, "delivered": 7, "accepted": 5, "autoAccepted": 1, "rejected": 1, "pendingReview": 1 },
    "items": [
      { "deliveryId": "uuid", "applicationId": "uuid", "candidateName": "Nguyễn A",
        "status": "DELIVERED", "deliveredAt": "...", "reviewDueAt": "...", "daysLeft": 3 }
    ]
  }
}
```

FE Client: trang chi tiết job CV_SOURCING có thanh tiến độ "5/10 CV đã nhận", mỗi CV có nút **Chấp nhận / Từ chối** và đồng hồ "còn 3 ngày".

---

## C3. 🟠 Ẩn CV dự phòng với Client và Candidate

- Client **không** thấy application `BACKUP` của CV_SOURCING cho tới khi được giao (C2.2).
- Candidate thấy `BACKUP` là "Đang xem xét" (việc của người phụ trách API Candidate, xem tài liệu MF-02 mục B3).

---

## C4. Tiêu chí nghiệm thu

1. HR giao 11 CV cho job `sourcingTarget = 10` → CV thứ 11 nhận `409 SOURCING_TARGET_REACHED`.
2. HR giao CV chưa có consent `CONFIRMED` → `409 CONSENT_NOT_CONFIRMED`.
3. Client chấp nhận → `ACCEPTED`; Client từ chối không có `reasonCode` → `400`.
4. Client từ chối với lý do "không phù hợp để phỏng vấn" → không có mã đó, không được phép.
5. Hết 7 ngày không phản hồi → worker chuyển `AUTO_ACCEPTED`, có audit.
6. Thay CV bị từ chối bằng CV dự phòng → CV cũ `REPLACED`, CV mới `DELIVERED` với hạn mới.
7. Client gọi danh sách → không thấy CV `BACKUP` chưa giao.

---

## Ngoài phạm vi MF-03 (để biết, không làm)

| Việc | Người làm |
|---|---|
| Tính phí theo số CV được tính, phiếu đặt cọc 50%, hoa hồng 60% | MF-05 |
| Khóa cấu hình `mf05.cv_sourcing.review_days` | MF-05 |
| Lưu `reviewDays`, `sourcingTarget` lên job khi duyệt | MF-01 |
| Consent của ứng viên | MF-02 |

## Thứ tự gợi ý

1. **C2.1 → C2.2 → C2.3** (bảng, giao CV, Client quyết định).
2. **C2.4** (worker), **C2.5** (thay CV), **C2.6** (danh sách + FE).
3. **C3**.
