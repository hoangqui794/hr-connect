# BE task 03: Khiếu nại tranh chấp trùng ứng viên (SF-04)

> **Ngày:** 2026-10-15. **Ưu tiên:** 🟠 Trung bình.
> **Căn cứ:** đề tài ("resolves duplicate-submission disputes"; Admin console "duplicate dispute resolution"; NFR "Every candidate-to-affiliate attribution… logged with an immutable timestamp and reviewable by Admin"); `main-flows.md` mục 6.1 **SF-04**: *Phát hiện trùng → người nộp khiếu nại → Platform Admin xem xét danh tính, lịch sử nộp, thời điểm, bằng chứng → chấp nhận / bác bỏ → ghi audit* **[CHƯA CÓ CODE]**; `main-flows.md` mục 2.5.
> **Hiện trạng code** (GitNexus `context Dispute`, `main` `5640eb1`): bảng `dispute` và entity `Dispute` **đã có** (`DisputeType`, `SubmissionId`, `AttributionId`, `CommissionId`, `RaisedBy`, `Description`, `Evidence` jsonb, `Status`, `ResolvedBy`, `Resolution`, `ResolvedAt`), nhưng **không có** command, query, endpoint hay check constraint nào. Quyền **đã seed**: `dispute.create`, `dispute.view_own` (Affiliate); `dispute.view`, `dispute.resolve` (Platform Admin).

**Phạm vi:** chỉ luồng khiếu nại và xử lý. **Không** đổi quy tắc kiểm tra trùng hay attribution của MF-02 (dev MF-02 đang làm phần đó); khi cần đổi attribution thì gọi qua một hàm do MF-02 cung cấp, xem mục 4.

Quy ước chung: Vertical Slice + MediatR; audit qua `IAuditLogService` như các luồng khác; GitNexus `impact` trước khi sửa `Attribution`, `Commission`, `Submission`.

**Cách làm và bàn giao**

- **Ước lượng:** khoảng 3–4 ngày.
- **Phụ thuộc:** Cần **Trí (MF-02)** cung cấp hàm chuyển attribution và **dev MF-05** thêm điều kiện chặn duyệt hoa hồng (mục 4). Hẹn trao đổi trước khi code.
- **Nhánh:** `feature/<tên-ngắn>` tạo từ `dev`, PR vào `dev`, ít nhất 1 người review; CI xanh mới merge.
- **Cài đặt mới:** thêm khóa vào `BusinessSettingKeys` (`HRConnect.Application/Common/Settings/BusinessSettings.cs`) để hiện ở trang Cài đặt Admin.
- **Xong khi:** đạt hết mục nghiệm thu, có unit test, `dotnet test` pass, migration có `.Designer.cs`, Swagger có mô tả tiếng Việt, cập nhật trạng thái **[CHƯA CÓ CODE]** trong `main-flows.md` / tài liệu Actor nếu có.
- **Bàn giao FE:** Báo Sang khi API Affiliate và Admin merge.
- **Hỏi ai:** nghiệp vụ hỏi Quí; chỗ nào tài liệu chưa rõ thì hỏi trước, không tự đoán.

---

## 1. Quy tắc nghiệp vụ

| # | Quy tắc |
|---|---|
| D1 | Affiliate khiếu nại khi lượt nộp của mình bị `BLOCKED_DUPLICATE`, hoặc khi cho rằng attribution của một ứng viên đã đi làm thuộc về mình. |
| D2 | Một lượt nộp chỉ có **một** khiếu nại đang mở. Thời hạn khiếu nại tính từ lúc bị chặn / lúc ứng viên đi làm: cài đặt `dispute.window_days` (xem bảng mặc định bên dưới). |
| D3 | Trong lúc khiếu nại liên quan một hoa hồng đang mở, hoa hồng đó **không được** duyệt sang `PAYABLE` (chặn ở bước Admin duyệt, trả `409 COMMISSION_UNDER_DISPUTE`). Không đổi trạng thái hoa hồng. |
| D4 | Platform Admin xem: danh tính ứng viên (email/SĐT đã chuẩn hóa), toàn bộ lượt nộp của ứng viên vào job đó (ai nộp, `created_at`, thời điểm consent), attribution hiện tại, bằng chứng hai bên. |
| D5 | Kết quả: `REJECTED` (giữ nguyên) hoặc `UPHELD` (chấp nhận). `UPHELD` thì Admin chuyển attribution sang Affiliate khiếu nại; hoa hồng chưa `PAID` chuyển theo. Hoa hồng đã `PAID` **không tự đổi**, ghi chú để xử lý ngoài hệ thống. |
| D6 | Mọi bước ghi audit, không xóa hay sửa khiếu nại đã đóng. Ghi đủ: trạng thái trước/sau, người, thời điểm, lý do. |
| D7 | Affiliate **không** thấy tên Affiliate kia; chỉ thấy kết quả và lý do Admin ghi. |

**Giá trị mặc định (đã chốt, đặt trong cài đặt, không viết cứng; Admin đổi được):**

| Khóa cài đặt | Mặc định | Khoảng | Lý do chọn |
|---|---|---|---|
| `dispute.window_days` | `30` | 1–180 | Bằng thời hạn bảo hành và mốc đạt hoa hồng (30 ngày). Affiliate khiếu nại kịp **trước khi** hoa hồng thành `EARNED` và được duyệt chi, tránh phải đòi lại tiền đã chi |
| `dispute.max_evidence_files` | `5` | 1–20 | Đủ cho ảnh chụp tin nhắn, email, CV; chặn tải lên tràn lan |
| `dispute.max_evidence_file_mb` | `10` | 1–50 | Bằng giới hạn CV hiện tại (`MAX_CV_FILE_SIZE_MB` mặc định 10) |

## 2. Dữ liệu

- Thêm check constraint:
  - `ck_dispute_type`: `DUPLICATE_SUBMISSION` | `ATTRIBUTION`.
  - `ck_dispute_status`: `OPEN` → `UNDER_REVIEW` → `UPHELD` | `REJECTED`; `WITHDRAWN` khi người khiếu nại rút.
- Unique index một phần: `(submission_id) WHERE status IN ('OPEN','UNDER_REVIEW')` (D2).
- `evidence` jsonb: mảng `{ "type": "NOTE" | "FILE" | "LINK", "value": "...", "addedBy": "uuid", "addedAt": "..." }`. File đính kèm lưu R2 như CV, chỉ PDF/ảnh, giới hạn số file và dung lượng theo `dispute.max_evidence_files`, `dispute.max_evidence_file_mb`.
- Hằng số trạng thái, loại, mã lỗi trong `HRConnect.Domain/Constants/DisputeStates.cs`.

## 3. API

| Method | Route | Quyền | Body / ghi chú |
|---|---|---|---|
| `POST` | `/api/v1/disputes` | `dispute.create` | `{ "disputeType", "submissionId", "description", "evidence": [...] }`. Kiểm tra lượt nộp thuộc Affiliate gọi, đúng điều kiện D1, D2 |
| `GET` | `/api/v1/disputes/mine?status=` | `dispute.view_own` | Khiếu nại của mình |
| `POST` | `/api/v1/disputes/{id}/evidence` | `dispute.create` (chủ khiếu nại) | Bổ sung bằng chứng khi còn `OPEN`/`UNDER_REVIEW` |
| `POST` | `/api/v1/disputes/{id}/withdraw` | `dispute.create` (chủ khiếu nại) | `WITHDRAWN` |
| `GET` | `/api/v1/admin/disputes?status=&type=&page=` | `dispute.view` | Hàng chờ cho Admin |
| `GET` | `/api/v1/admin/disputes/{id}` | `dispute.view` | Chi tiết đủ dữ liệu D4 |
| `POST` | `/api/v1/admin/disputes/{id}/start-review` | `dispute.resolve` | `OPEN` → `UNDER_REVIEW` |
| `POST` | `/api/v1/admin/disputes/{id}/resolve` | `dispute.resolve` | `{ "decision": "UPHELD" \| "REJECTED", "resolution": "lý do bắt buộc", "concurrencyToken" }` |

**Mã lỗi:** `409 DISPUTE_ALREADY_OPEN`, `409 DISPUTE_WINDOW_CLOSED`, `400 DISPUTE_NOT_ELIGIBLE` (lượt nộp không bị chặn / không phải của mình), `409 DISPUTE_NOT_OPEN`, `409 COMMISSION_UNDER_DISPUTE` (ở luồng duyệt hoa hồng MF-05).

**Thông báo** (bảng `notification` đã có): Affiliate khiếu nại nhận thông báo khi có kết quả; Affiliate đang giữ attribution nhận thông báo khi attribution bị chuyển (không nêu tên người khiếu nại).

## 4. Phối hợp với MF-02 và MF-05

| Việc | Ai |
|---|---|
| Hàm chuyển attribution an toàn (đổi `AffiliateId`, `WinningSubmissionId`, ghi `AttributionRule = DISPUTE_RESOLUTION`) | Nhờ dev MF-02 cung cấp, task này chỉ gọi |
| Chặn duyệt hoa hồng khi có khiếu nại mở (D3), chuyển hoa hồng chưa `PAID` (D5) | Nhờ dev MF-05 thêm điều kiện, hoặc làm cùng sau khi trao đổi |

Trao đổi trước khi code để không sửa trùng file của MF-02/MF-05.

## 5. Nghiệm thu

1. Affiliate B bị chặn trùng → tạo khiếu nại thành công; tạo lần 2 → `409 DISPUTE_ALREADY_OPEN`.
2. Quá `dispute.window_days` → `409 DISPUTE_WINDOW_CLOSED`.
3. Affiliate B không khiếu nại được lượt nộp của Affiliate khác → `400`.
4. Admin `UPHELD` → attribution sang B, hoa hồng chưa chi chuyển theo, có audit đủ trước/sau.
5. Khi khiếu nại đang mở, Admin duyệt hoa hồng liên quan → `409 COMMISSION_UNDER_DISPUTE`.
6. Response cho Affiliate không chứa tên/ID Affiliate kia.
7. Toàn bộ test backend pass; migration có `.Designer.cs`.

## Giao cho FE

Sau khi xong, bổ sung vào [`FE-tasks-sang.md`](FE-tasks-sang.md): nút "Khiếu nại" ở lượt nộp bị chặn (Affiliate), trang "Khiếu nại của tôi", hàng chờ và màn xử lý cho Admin.
