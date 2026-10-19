# MF-05: thiết kế suất tuyển thay thế (`replacement_slot`)

> **Phạm vi chính:** Backend MF-05. Phần MF-02 B4 (gắn lượt nộp vào suất) đã xong, merge 16/10. Phần MF-04 nằm ở tài liệu riêng `MF04/mf04-lap-suat-thay-the.md` (đã làm xong trong `ConfirmStartWorkCommandHandler`, tài liệu đã xóa 19/10).
> **Ngày:** 2026-10-15.
> Thay cho phần mô tả ngắn ở mục E7 của [`mf05-viec-can-lam-theo-quy-tac-phi.md`](mf05-viec-can-lam-theo-quy-tac-phi.md).
> **Hiện trạng code (15/10, nhánh `feature/mf05-replacement-slot`):** MF-05 đã làm xong bước 1 và 2 của mục 8: bảng, cột, hằng số `ReplacementSlotStates` / `ReplacementSlotErrorCodes`, cài đặt, migration `Mf05ReplacementSlot`, S1–S4 và API mục 6. Còn lại: MF-02 B4 và mục 5 (MF-04 + MF-05).

**Cách gọi trong tài liệu:**
- **Internal HR:** nhân viên HR nội bộ của HR Connect (vai trò `INTERNAL_HR`).
- **HR của Client:** người dùng phía công ty khách hàng (vai trò `CLIENT_COMPANY_USER`).

Ký hiệu: **[CẦN NHÓM CHỐT]** = điểm còn để ngỏ, chốt trước khi code.

---

## 1. Quy tắc nghiệp vụ (đã chốt 15/10/2026)

Chỉ áp dụng cho **HEADHUNT_COD** (dịch vụ duy nhất có bảo hành).

| # | Quy tắc | Căn cứ |
|---|---|---|
| R1 | Mỗi **khoản phí dịch vụ** được **thay thế miễn phí đúng 1 lần**. Người thay thế cũng nghỉ sớm thì **bảo hành coi như đã hoàn thành**: không mở suất lần hai, không hoàn tiền | [N1] Profile Group: "limited to one replacement candidate… deemed fulfilled and no further replacement or refund". [N2]: "maximum of one (1) occasion". Tài liệu MF-05 E7 |
| R2 | Suất thay thế **chỉ mở khi Client đã thanh toán phí**. Chưa trả thì suất ở trạng thái chờ, Client trả xong mới mở | [N2]: bảo hành phụ thuộc việc Client thanh toán đủ |
| R3 | Suất thay thế có **hạn chót**: quá hạn mà chưa có người đi làm thì suất hết hạn. Số ngày là **cài đặt** `mf05.replacement.fill_window_days` | [N4] gợi ý đặt hạn chót cho việc tìm người thay thế |
| R4 | Phí dịch vụ **giữ nguyên, không hoàn**. Hoa hồng của Affiliate cũ bị **hủy** (đã có) | Tài liệu quy tắc phí, mục 5. [N3]: 61,4% chọn "replacement / no money back" |
| R5 | Người thay thế đi làm thì **không tạo phí mới**. Bảo hành mới và hoa hồng mới (`IN_WARRANTY`) cho Affiliate của người thay thế, **tính trên khoản phí cũ** | Tài liệu MF-05 E7 |

**[CẦN NHÓM CHỐT]**
- Giá trị mặc định của `fill_window_days`. Code đang dùng **30 ngày** (ví dụ trong [N4]), khoảng 1–180; Admin đổi được trong trang Cài đặt.
- Job đã `CLOSED` (đủ người) khi mở suất thay thế: hệ thống **tự mở lại job** về `ACTIVE`, hay Internal HR mở tay? Đề xuất: **tự mở lại**, ghi lịch sử trạng thái job với mã `REOPENED_FOR_REPLACEMENT`.

---

## 2. Dữ liệu (MF-05 làm)

### 2.1 Bảng `replacement_slot`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `replacement_slot_id` | uuid PK | |
| `job_id` | uuid FK `job` | Job đang tuyển người thay thế |
| `original_placement_id` | uuid FK `placement`, **UNIQUE** | Người đã nghỉ. UNIQUE = mỗi placement chỉ mở suất 1 lần |
| `service_fee_id` | uuid FK `service_fee`, **UNIQUE** | Khoản phí được bảo hành. UNIQUE = R1 (1 lần mỗi khoản phí) |
| `status` | varchar(30) | `WAITING_PAYMENT` · `OPEN` · `FILLED` · `CANCELLED` · `EXPIRED` (check constraint) |
| `opened_at` | timestamptz null | Lúc chuyển sang `OPEN` |
| `expires_at` | timestamptz null | `opened_at + fill_window_days` |
| `filled_by_placement_id` | uuid FK `placement` null, **UNIQUE** | Placement của người thay thế |
| `closed_at`, `closed_by` | timestamptz null, uuid null | Lúc `FILLED` / `CANCELLED` / `EXPIRED` |
| `cancel_reason` | varchar(500) null | Bắt buộc khi `CANCELLED` |
| `fill_window_days` | int | Số ngày hạn, chụp lại từ cài đặt lúc tạo suất (đổi cài đặt sau đó không ảnh hưởng suất cũ) |
| `concurrency_token` | uuid | Đổi mỗi lần đổi trạng thái |
| `created_at`, `updated_at`, `created_by` | | |

Index: `(job_id, status, opened_at)` để tìm suất `OPEN` của job.

### 2.2 Cột liên kết

| Bảng | Cột mới | Ai ghi |
|---|---|---|
| `submission` | `replacement_slot_id` uuid null FK | MF-02, lúc tạo lượt nộp |
| `application` | `replacement_slot_id` uuid null FK | MF-02, lúc ứng viên đồng ý (chép từ submission) |
| `placement` | `replacement_slot_id` uuid null FK, UNIQUE | MF-04, lúc xác nhận đi làm |

**Không suy luận lại khi đọc:** liên kết được ghi một lần, đúng lúc phát sinh (đáp ứng yêu cầu của MF-02).

### 2.3 Cài đặt mới

`mf05.replacement.fill_window_days`: kiểu Integer, mặc định **30** (nhóm có thể đổi), khoảng 1–180, đơn vị ngày, nhóm `HEADHUNT_COD` trong trang Cài đặt.

---

## 3. Vòng đời của suất

```
Internal HR xác nhận người cũ nghỉ trước hạn bảo hành
        │
        ├─ phí đã PAID ─────────────► OPEN (opened_at, expires_at)
        └─ phí chưa PAID ───► WAITING_PAYMENT ──(Client trả phí)──► OPEN
                                                      │
              ┌───────────────────────────────────────┼─────────────────────────┐
              ▼                                       ▼                         ▼
   người thay thế đi làm                     quá expires_at      Internal HR hủy (Client không cần thay)
           FILLED                                EXPIRED                       CANCELLED
```

| Bước | Ai | Việc |
|---|---|---|
| **S1. Mở suất** | MF-05 | Trong `ResolveResignationCommandHandler` khi `confirmed = true`: nếu placement **có** `ServiceFee` và placement **không phải** người thay thế (`replacement_slot_id` null) thì tạo suất. Phí `PAID` → `OPEN`, chưa thì `WAITING_PAYMENT`. Trả về trong response: `replacement: { replacementSlotId, jobId, status, expiresAt }`. Gửi thông báo cho HR của Client và Internal HR |
| **S1'. Không mở** | MF-05 | Placement là **người thay thế** (đã dùng 1 lần, R1) hoặc không có phí: không tạo suất, response `replacement: null`, ghi audit `REPLACEMENT_NOT_ALLOWED` kèm lý do |
| **S2. Kích hoạt khi trả phí** | MF-05 | Trong `RecordServiceFeePayment`: phí có suất `WAITING_PAYMENT` thì chuyển sang `OPEN`, đặt `opened_at` và `expires_at` |
| **S3. Hết hạn** | MF-05 | `WarrantyProgressWorker` thêm bước: suất `OPEN` quá `expires_at` → `EXPIRED`, thông báo HR của Client và Internal HR |
| **S4. Hủy** | MF-05 | `POST /api/v1/internal/replacement-slots/{id}/cancel` `{ reason, concurrencyToken }`, quyền `warranty.manage`. Chỉ hủy được suất `WAITING_PAYMENT` hoặc `OPEN`. Không hoàn phí (R4) |
| **S5. Gắn lượt nộp** | **MF-02 (Trí)** | Xem mục 4 |
| **S6. Lấp suất** | **MF-04** + MF-05 | Xem mục 5 |

---

## 4. Việc của MF-02 (Trí): B4

### 4.1 Lúc Affiliate nộp

- Request **không** có trường chọn suất hay placement.
- Job là HEADHUNT_COD và có suất `OPEN`, chưa quá `expires_at`: lấy **suất mở sớm nhất** (`ORDER BY opened_at`), ghi vào `submission.replacement_slot_id`. Nhiều lượt nộp có thể cùng gắn vào một suất; suất chỉ bị "chiếm" khi có người **đi làm** (mục 5).
- Không có suất `OPEN`: nộp bình thường, `replacement_slot_id = null`.
- Response thêm:

```json
{ "isReplacement": true, "replacementForPlacementId": "uuid", "replacementSlotId": "uuid" }
```

Job bình thường: `isReplacement: false`, hai trường kia `null`.

### 4.2 Lúc ứng viên đồng ý

- Submission có `replacement_slot_id`: **khóa dòng suất** (`SELECT … FOR UPDATE` trong transaction) và kiểm tra suất vẫn `OPEN`, chưa quá `expires_at`.
  - Còn hợp lệ: tạo Application **kèm** `replacement_slot_id`, Attribution, yêu cầu chấm AI như bình thường.
  - Không còn hợp lệ (`FILLED`, `EXPIRED`, `CANCELLED`): đóng submission có kiểm soát, mã **`REPLACEMENT_SLOT_UNAVAILABLE`**, ghi audit, thông báo cho Affiliate. **Không** tạo Application, Attribution hay yêu cầu chấm AI.

### 4.3 Không làm

- MF-02 **không** tạo phí, **không** đổi trạng thái suất.

---

## 5. Lấp suất khi người thay thế đi làm (MF-04 + MF-05)

Chi tiết ở tài liệu MF-04: `MF04/mf04-lap-suat-thay-the.md` (đã làm xong trong `ConfirmStartWorkCommandHandler`, tài liệu đã xóa 19/10). Tóm tắt:

- **MF-04:** trong `ConfirmStartWorkCommandHandler`, khóa suất, lấp suất (`FILLED`) hoặc trả 409 `REPLACEMENT_SLOT_ALREADY_FILLED`; ghi `placement.replacement_slot_id`.
- **MF-05:** `PlacementFinanceService.InitializeAsync` nhận thông tin người thay thế: không tạo phí mới, tạo bảo hành mới, hoa hồng `IN_WARRANTY` tính trên phí gốc. Người thay thế nghỉ sớm thì không mở suất mới (R1).

## 6. API

| Method | Route | Quyền | Việc |
|---|---|---|---|
| `GET` | `/api/v1/jobs/{jobId}/replacement-slots` | `warranty.manage` / `commission.manage` / `commission.view` (Internal HR, Admin); `placement.confirm` (HR của Client, chỉ job của công ty mình) | Danh sách suất của job: trạng thái, người cũ, hạn chót, người thay thế |
| `POST` | `/api/v1/internal/replacement-slots/{id}/cancel` | `warranty.manage` | Hủy suất (S4) |
| `POST` | `/api/v1/placements/{id}/resignation/resolve` | (đã có) | Response thêm `replacement` (S1) |
| `POST` | `/api/v1/jobs/{id}/candidate-submissions` | (đã có, MF-02) | Response thêm `isReplacement`, `replacementForPlacementId`, `replacementSlotId` |

## 7. Mã lỗi (MF-02, MF-04 và MF-05 dùng chung)

| Mã | HTTP | Khi nào |
|---|---|---|
| `REPLACEMENT_SLOT_UNAVAILABLE` | 409 | Ứng viên đồng ý nhưng suất đã `FILLED` / `EXPIRED` / `CANCELLED` (MF-02) |
| `REPLACEMENT_SLOT_ALREADY_FILLED` | 409 | Xác nhận đi làm nhưng suất không còn `OPEN` (MF-04) |
| `REPLACEMENT_NOT_ALLOWED` | (audit) | Người thay thế nghỉ, hoặc không có phí: không mở suất (MF-05) |
| `REPLACEMENT_SLOT_NOT_CANCELLABLE` | 409 | Hủy suất đã `FILLED` / `EXPIRED` / `CANCELLED` |

Đã có trong `HRConnect.Domain/Constants/ReplacementSlotStates.cs`: lớp `ReplacementSlotStates` (trạng thái) và `ReplacementSlotErrorCodes` (mã lỗi, thêm `REPLACEMENT_SLOT_CONCURRENCY_CONFLICT` khi hủy với token cũ). Ba luồng dùng hằng số này, không tự gõ chuỗi.

---

## 8. Chia việc và thứ tự

| Thứ tự | Ai | Việc |
|---|---|---|
| 1 | MF-05 ✅ | Bảng, cột, hằng số, cài đặt, migration (mục 2) |
| 2 | MF-05 ✅ | S1, S1', S2, S3, S4 và API mục 6 |
| 3 | **Trí (MF-02)** | Mục 4 (B4). Làm được ngay khi bước 1 đã merge |
| 4 | MF-04 + MF-05 | Mục 5 (tài liệu MF-04) |

## 9. Tiêu chí nghiệm thu

1. Internal HR xác nhận người cũ nghỉ trước hạn, phí đã trả → suất `OPEN` với `expires_at` đúng theo cài đặt. Phí chưa trả → `WAITING_PAYMENT`, ghi nhận thanh toán xong → `OPEN`.
2. Affiliate nộp vào job có suất `OPEN` → response `isReplacement: true`. Job không có suất → `false`.
3. Hai Affiliate nộp vào cùng một suất: cả hai đều được ứng tuyển. Người **đi làm trước** lấp suất; người sau xác nhận đi làm thì nhận 409 `REPLACEMENT_SLOT_ALREADY_FILLED`, trừ khi HR của Client chọn tuyển như mới.
4. Ứng viên đồng ý sau khi suất đã `FILLED` / `EXPIRED` → submission đóng với `REPLACEMENT_SLOT_UNAVAILABLE`, không có Application.
5. Người thay thế đi làm → **không** có phí mới; hoa hồng mới `IN_WARRANTY`, tính trên phí gốc.
6. Người thay thế cũng nghỉ sớm → **không** mở suất thứ hai; bảo hành coi như hoàn thành.
7. Một placement / một khoản phí không thể có 2 suất (ràng buộc UNIQUE trong database).
8. Quá `expires_at` → `EXPIRED`, HR của Client và Internal HR được thông báo.
9. Migration có `.Designer.cs`, `has-pending-model-changes` ra "No changes", toàn bộ test pass; có test đồng thời cho bước 3.

---

## Nguồn

- **[N1]** Profile Group – Replacement guarantee FAQ (trang chính thức, đã đọc trực tiếp): <https://www.profilegroup.com/en/faq/does-profile-group-offer-a-replacement-guarantee>
- **[N2]** Điều khoản kinh doanh của agency tại Úc/NZ, câu "replace an employed Candidate on a maximum of one (1) occasion" và điều kiện thanh toán đủ (trích qua kết quả tìm kiếm, chưa mở file gốc): <https://certus.sites.sourceflow.co.uk/pdf/AUS_Terms.pdf>, <https://deciphergroup.co.nz/wm/wp-content/uploads/2026/02/DG-Terms-and-Conditions.pdf>
- **[N3]** Top Echelon – khảo sát chính sách bảo hành của người làm tuyển dụng: <https://topechelon.com/blog/recruiter-guarantees-once-i-am-paid-i-do-not-refund-any-money>
- **[N4]** The Hire Hub – Agency replacement clause (blog, tham khảo): <https://www.thehirehub.ai/blog/agency-replacement-clause>

Hạn chế: không tìm được nguồn Việt Nam về số lần thay thế. Đây là **điều khoản hợp đồng do từng công ty tự quy định**, không phải luật.
