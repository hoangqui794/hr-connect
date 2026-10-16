# MF-04: lấp suất thay thế khi người thay thế đi làm

> **Phạm vi:** Backend MF-04. **Ngày:** 2026-10-15.
> **Thiết kế đầy đủ:** [`MF05/mf05-thiet-ke-suat-thay-the.md`](../MF05/mf05-thiet-ke-suat-thay-the.md). Đọc mục 1 (quy tắc) và mục 3 (vòng đời suất) trước.
> **Điều kiện bắt đầu:** MF-05 đã merge bảng `replacement_slot`, cột `application.replacement_slot_id`, `placement.replacement_slot_id` và hằng số `ReplacementSlotStates` (bước 1 trong thiết kế).

**Cách gọi:** **HR của Client** = người dùng phía công ty khách hàng (`CLIENT_COMPANY_USER`, có quyền `placement.confirm`). **Internal HR** = HR nội bộ HR Connect.

## Bối cảnh ngắn

Người được tuyển (HEADHUNT_COD) nghỉ trước hạn bảo hành thì MF-05 mở một **suất thay thế** cho job. Affiliate nộp người mới vào suất đó (MF-02). Khi HR của Client xác nhận người thay thế **đi làm**, MF-04 quyết định người này có lấp suất hay không. Người thay thế **không tạo phí mới**.

## Việc cần làm

Sửa `ConfirmStartWorkCommandHandler` (`POST /api/v1/recruitment/applications/{applicationId}/start-work`), **trước khi** gọi `PlacementFinanceService.InitializeAsync`:

1. Application **không** có `replacement_slot_id`: giữ nguyên luồng cũ.
2. Application **có** `replacement_slot_id`: trong cùng transaction, khóa dòng suất (`SELECT … FOR UPDATE`).
   - Suất `OPEN`: tạo placement kèm `replacement_slot_id`; suất chuyển `FILLED`, ghi `filled_by_placement_id`, `closed_at`, đổi `concurrency_token`. Gọi `PlacementFinanceService` với thông tin người thay thế (MF-05 cung cấp tham số).
   - Suất `FILLED` / `EXPIRED` / `CANCELLED`: trả **409** mã **`REPLACEMENT_SLOT_ALREADY_FILLED`**, lời nhắc: "Suất thay thế không còn. Nếu vẫn nhận ứng viên này thì sẽ tính phí như tuyển mới."
3. Request thêm trường tùy chọn `acceptAsNewHire` (bool, mặc định `false`). HR của Client gửi lại với `true` thì tạo placement **như tuyển mới** (có phí), **không** gắn suất.
4. Ghi audit khi lấp suất và khi chuyển sang tuyển mới.

## Ngoài phạm vi MF-04

- Không tạo phí, bảo hành, hoa hồng (MF-05 làm trong `PlacementFinanceService`).
- Không mở, hủy hay cho hết hạn suất (MF-05).

## Frontend (màn hình xác nhận đi làm của Client)

- Application là người thay thế: hiện nhãn "Người thay thế – không tính phí mới".
- Nhận 409 `REPLACEMENT_SLOT_ALREADY_FILLED`: hiện hộp xác nhận với lời nhắc trên, nút "Nhận như tuyển mới" gửi lại với `acceptAsNewHire = true`.

## Tiêu chí nghiệm thu

1. Xác nhận đi làm với suất `OPEN` → suất `FILLED`, placement có `replacement_slot_id`, **không** có service fee mới.
2. Hai người cùng gắn một suất, xác nhận gần như cùng lúc → chỉ một người lấp suất, người kia nhận 409 (có test đồng thời).
3. Gửi lại với `acceptAsNewHire = true` → placement thường, có phí, không gắn suất.
4. Application không có suất → hành vi cũ không đổi, test cũ vẫn pass.
