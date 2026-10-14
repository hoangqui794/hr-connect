# MF-02: việc cần làm theo quy tắc phí mới

> **Dành cho:** dev phụ trách MF-02 (Tiếp nhận hồ sơ, kiểm tra trùng, ghi nhận nguồn).
> **Ngày:** 2026-10-14.
> **Căn cứ:** [`HRConnect/docs/QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md`](../QUY-TAC-PHI-VA-HOA-HONG-3-DICH-VU.md) (đã chốt hết). Số mục `G1`, `1.1`… dưới đây là số mục trong file đó.
> **Hiện trạng** được đối chiếu với code trên `main` ngày 14/10.

Ký hiệu: 🔴 làm trước (đang chặn người khác hoặc sai nghiệp vụ) · 🟠 cần làm · ✅ đã đúng, không cần làm.

---

### B1. 🔴 Hoa hồng thuộc về Affiliate nộp hợp lệ đầu tiên (mục 1.3, mục 2)

**Hiện trạng:** Attribution được tạo khi ứng viên **xác nhận consent** (`RespondSubmissionConsentCommandHandler`), không phải khi Affiliate nộp. `main-flows.md` mục 2.3 đã ghi đây là điểm lệch.

**Quy tắc chốt:** cùng một ứng viên + cùng một job → hoa hồng thuộc về **lượt nộp đầu tiên** mà ứng viên **đã xác nhận**. Trong lúc lượt đầu đang chờ consent, lượt nộp sau bị chặn. Lượt đầu bị từ chối hoặc hết hạn → lượt sau được nộp.

**Cần làm:**
- Kiểm tra `SubmitCandidate` đã chặn nộp trùng (cùng candidate + job) khi đang có submission `PENDING_CONSENT` hoặc `CONFIRMED`. Nếu chưa chặn → trả:

```jsonc
// 409
{
  "success": false,
  "errorCode": "CANDIDATE_ALREADY_SUBMITTED",
  "message": "Ứng viên này đã được giới thiệu cho công việc và đang chờ xác nhận.",
  "data": { "existingSubmissionStatus": "PENDING_CONSENT", "consentExpiresAt": "2026-10-17T00:00:00Z" }
}
```

  `data` **không** chứa tên Affiliate khác.
- Thêm test: hai Affiliate nộp cùng ứng viên → người thứ hai nhận `409`; người thứ nhất bị từ chối consent → người thứ hai nộp được và nhận Attribution.

### B2. 🟠 Không tính ứng viên Client đã có từ trước (mục 2)

**Quy tắc:** CV_SOURCING và HEADHUNT_COD không tính phí/hoa hồng cho ứng viên **Client đã có** (đã ứng tuyển trực tiếp vào công ty, hoặc đã được giao cho Client trước đó).

**Cần làm trong `SubmitCandidate`:** nếu ứng viên đã có Application thuộc **cùng công ty** trong N tháng gần nhất → chặn:

```jsonc
// 409
{ "success": false, "errorCode": "CANDIDATE_OWNED_BY_CLIENT",
  "message": "Ứng viên đã có trong hồ sơ của công ty này nên không thể giới thiệu." }
```

- N là con số cấu hình, khóa mới `mf02.client_ownership_months`. **[Cần nhóm chốt N — đề xuất 6 tháng]**.
- Không trả cho Affiliate biết ứng viên đã nộp vào job nào.

### B3. 🟠 Candidate không thấy trạng thái nội bộ

**Hiện trạng:** `GET` danh sách đơn của Candidate (`GetCandidateApplicationsQueryHandler`) trả nguyên `status` gốc, nên Candidate thấy được `BACKUP`, `SCREENING`… (lộ việc bị xếp dự phòng ở CV_SOURCING).

**Response — thêm `displayGroup`, bỏ `status` gốc:**

```diff
 {
   "applicationId": "uuid",
   "jobTitle": "Senior .NET Developer",
-  "status": "BACKUP",
+  "displayGroup": "IN_REVIEW",
+  "displayLabel": "Đang xem xét",
   ...
 }
```

| `displayGroup` | Trạng thái gốc |
|---|---|
| `SUBMITTED` | `SUBMITTED` |
| `IN_REVIEW` | `SCREENING`, `SHORTLISTED`, `BACKUP` |
| `INTERVIEW` | `INTERVIEW` |
| `OFFER` | `OFFER_PENDING` (chỉ khi offer đã `SENT`) |
| `HIRED` | `OFFER_ACCEPTED`, `PLACED` |
| `NOT_SELECTED` | `REJECTED`, `INTERVIEW_FAILED`, `BACKUP_NOT_SELECTED`, `CLOSED` |
| `WITHDRAWN` | `WITHDRAWN`, `OFFER_DECLINED`, `NOT_STARTED` |

- Không trả `statusReason`, mã lý do, ghi chú HR.
- Thêm test duyệt **tất cả** giá trị của `ck_application_status`; giá trị chưa có nhóm → test fail.
- **[Cần xác nhận người phụ trách]**: API này nằm trong `Features/Candidates`; nếu không phải MF-02 thì chuyển mục này cho người phụ trách Candidate.

### B4. 🟠 Hồ sơ người thay thế (mục 1.2)

**Quy tắc:** ứng viên nghỉ trong 30 ngày → HR Connect tìm người thay thế miễn phí cho Client; Affiliate giới thiệu người thay thế được hoa hồng khi người đó đi làm đủ 30 ngày.

**Cần làm (phối hợp MF-05):**
- MF-05 mở lại 1 chỗ cho job khi bảo hành bị hủy và đánh dấu job "đang tìm người thay thế".
- `SubmitCandidate` response thêm `isReplacement`:

```diff
 {
   "submissionId": "uuid",
   "status": "PENDING_CONSENT",
+  "isReplacement": true,
+  "replacementForPlacementId": "uuid"
 }
```

- Request **không đổi** (Affiliate không tự chọn; hệ thống tự gắn khi job đang tìm người thay thế).
- Placement của người thay thế **không** tạo phí dịch vụ mới (MF-05 xử lý).

### B5. ✅ Đã đúng

- Consent bắt buộc trước khi gửi hồ sơ cho Client (`PENDING_CONSENT` → `CONFIRMED`).
- Tìm consent của Candidate qua hồ sơ của chính họ, không so email.

### B6. Tiêu chí nghiệm thu MF-02

1. Hai Affiliate nộp cùng ứng viên vào cùng job → người sau nhận `409 CANDIDATE_ALREADY_SUBMITTED`, không thấy tên người trước.
2. Ứng viên từ chối lượt đầu → lượt sau nộp được; Attribution thuộc lượt sau.
3. Ứng viên đã ứng tuyển trực tiếp vào công ty trong N tháng → Affiliate nhận `409 CANDIDATE_OWNED_BY_CLIENT`.
4. Candidate xem danh sách đơn → không có chuỗi `BACKUP`, `SCREENING` trong response.
5. Job đang tìm người thay thế → submission mới có `isReplacement: true`.

---

## Ngoài phạm vi MF-02 (để biết, không làm)

| Việc | Người làm |
|---|---|
| Mở lại chỗ cho job và đánh dấu "đang tìm người thay thế" khi bảo hành bị hủy (dùng cho B4) | MF-05 |
| Placement của người thay thế không tạo phí mới; hủy hoa hồng khi ứng viên nghỉ trước 30 ngày | MF-05 |
| Client chấp nhận / từ chối CV của CV_SOURCING trong 7 ngày | MF-03 / MF-05 |

## Thứ tự gợi ý

1. **B1 → B3**: ảnh hưởng tiền và dữ liệu cá nhân, làm trước.
2. **B2** sau khi nhóm chốt số tháng; **B4** sau khi MF-05 có luồng thay thế.
