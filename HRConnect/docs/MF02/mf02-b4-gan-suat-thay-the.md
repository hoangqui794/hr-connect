# Việc cho Trí (MF-02 B4): gắn lượt nộp vào suất thay thế

> **Phạm vi:** Backend MF-02. **Ngày:** 2026-10-15.
> **Trạng thái:** Đã triển khai trên nhánh `feature/mf02-replacement-slot-b4`; chờ merge.
> **Trả lời:** [`MF02-PENDING-MF05-REPLACEMENT.md`](MF02-PENDING-MF05-REPLACEMENT.md).
> **Thiết kế đầy đủ:** [`MF05/mf05-thiet-ke-suat-thay-the.md`](../MF05/mf05-thiet-ke-suat-thay-the.md). Đọc mục 1 (quy tắc), 2 (dữ liệu), 3 (vòng đời suất) và 7 (mã lỗi).
> **Điều kiện bắt đầu:** MF-05 đã merge bảng `replacement_slot`, cột `submission.replacement_slot_id`, `application.replacement_slot_id` và hằng số `ReplacementSlotStates`.

**Cách gọi:** **Internal HR** = HR nội bộ HR Connect. **HR của Client** = người dùng phía công ty khách hàng.

## Việc cần làm

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
  - Không còn hợp lệ (`FILLED`, `EXPIRED`, `CANCELLED`, mất liên kết hoặc quá `expires_at`): chuyển consent và submission về `CANCELLED`, trả `409` với mã **`REPLACEMENT_SLOT_UNAVAILABLE`**, ghi audit kèm mã lý do và thông báo cho Affiliate. **Không** tạo Application, Attribution hay yêu cầu chấm AI.

### 4.3 Không làm

- MF-02 **không** tạo phí, **không** đổi trạng thái suất.

---

## Tiêu chí nghiệm thu

1. Affiliate nộp vào job có suất `OPEN` → response `isReplacement: true`, `submission.replacement_slot_id` được ghi. Job không có suất → `isReplacement: false`.
2. Job có nhiều suất `OPEN` → gắn vào suất mở sớm nhất.
3. Ứng viên đồng ý khi suất vẫn `OPEN` → Application có `replacement_slot_id`.
4. Ứng viên đồng ý sau khi suất đã `FILLED` / `EXPIRED` / `CANCELLED` → submission đóng với `REPLACEMENT_SLOT_UNAVAILABLE`, không có Application, Attribution hay yêu cầu chấm AI.

## Điểm triển khai

- MF-02 dùng cột và khóa ngoại do migration MF-05 cung cấp; không tạo migration trùng.
- Truy vấn lúc submit chỉ nhận slot `OPEN`, có `opened_at`, có `expires_at` trong tương lai; sắp xếp theo `opened_at`, `created_at`, rồi UUID để kết quả ổn định.
- Khi confirm, PostgreSQL chạy `SELECT ... FOR UPDATE` trong transaction trước khi kiểm tra trạng thái và hạn chót.
- Nhiều Submission/Application được phép tham chiếu cùng một slot. MF-02 không đổi trạng thái slot; MF-04 chỉ lấp slot khi Candidate thật sự đi làm.
- Swagger và kiểu phản hồi FE đã có `isReplacement`, `replacementForPlacementId`, `replacementSlotId`.
