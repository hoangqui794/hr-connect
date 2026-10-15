# MF02 — Việc còn lại sau khi MF05 có luồng tuyển người thay thế

> **Trạng thái:** Chưa triển khai — **đã có contract từ MF05 (15/10/2026)**, chờ MF05 merge bảng `replacement_slot` là làm được.
> **Việc cần làm:** [`mf02-b4-gan-suat-thay-the.md`](mf02-b4-gan-suat-thay-the.md). **Thiết kế đầy đủ:** [`MF05/mf05-thiet-ke-suat-thay-the.md`](../MF05/mf05-thiet-ke-suat-thay-the.md).
> **Phạm vi:** Backend MF02.
> **Lý do chờ:** Hiện database chưa có persisted replacement slot đủ an toàn để xác định một lượt nộp thuộc đợt tuyển thay thế nào.

## Bối cảnh nghiệp vụ

Khi Candidate đã đi làm nhưng nghỉ trong thời hạn bảo hành, MF05 có thể mở một suất tuyển người thay thế cho Placement gốc. Affiliate vẫn được phép giới thiệu Candidate mới, nhưng lượt nộp phải được hệ thống tự gắn đúng suất thay thế.

MF02 không được tự suy luận từ Placement có trạng thái `LEFT_DURING_WARRANTY`, không lấy Placement mới nhất và không cho Affiliate tự chọn Placement. Các cách này có thể gắn sai hồ sơ, sai bảo hành, phí dịch vụ và hoa hồng khi có nhiều lần thay thế hoặc request chạy đồng thời.

## Contract MF05 cần cung cấp trước

MF05 cần có nguồn dữ liệu persisted tương đương `replacement_slot`, tối thiểu gồm:

- `JobId`.
- `OriginalPlacementId`.
- Trạng thái `OPEN`, `FILLED`, `CANCELLED`.
- Concurrency token.
- Thời điểm mở/đóng.
- Ràng buộc chỉ có một slot `OPEN` hợp lệ cho cùng Placement theo quy tắc MF05.
- Quy tắc xác định slot nào được dùng nếu một Job có nhiều lịch sử thay thế.
- Contract xác nhận Application/Placement thay thế không tạo thêm phí dịch vụ cho Client.

## MF02 phải thực hiện sau khi contract MF05 được merge

### 1. Persistence

- Thêm liên kết nullable từ Submission đến replacement slot hoặc `replacement_for_placement_id` theo contract cuối cùng của MF05.
- Lưu liên kết ngay lúc tạo Submission; không suy luận lại khi đọc dữ liệu.
- Thêm foreign key, index, check constraint và migration tương ứng.

### 2. Affiliate submit

- Request không thêm trường chọn Placement hoặc replacement slot.
- Backend tự tìm slot `OPEN` hợp lệ theo Job.
- Response bổ sung:

```json
{
  "isReplacement": true,
  "replacementForPlacementId": "uuid"
}
```

- Job bình thường trả `isReplacement: false` và `replacementForPlacementId: null`.

### 3. Candidate consent

- Khi Candidate xác nhận, lấy transaction lock phù hợp và kiểm tra lại slot vẫn còn `OPEN`.
- Chỉ tạo Application, Attribution và MF03 request khi slot còn hợp lệ.
- Nếu slot đã được lấp hoặc bị hủy trong lúc chờ consent, đóng Submission có kiểm soát, ghi audit, gửi notification và không tạo side effect tuyển dụng.
- Cần mã lỗi nghiệp vụ ổn định cho trường hợp slot không còn khả dụng; chốt tên mã cùng MF05 trước khi code.

### 4. Phí và hoa hồng

- MF02 chỉ lưu marker/liên kết của lượt tuyển thay thế.
- MF02 không tự tạo phí dịch vụ.
- MF05 chịu trách nhiệm tạo Placement thay thế, đóng slot và bảo đảm không phát sinh phí dịch vụ mới.
- Hoa hồng Affiliate của Candidate thay thế chỉ được xử lý theo quy tắc đã chốt khi Candidate đi làm đủ thời hạn yêu cầu.

## Test bắt buộc

- Slot `OPEN` được tự động gắn đúng vào Submission.
- Affiliate không thể truyền hoặc giả mạo Placement đích.
- Job không có slot vẫn đi theo luồng MF02 bình thường.
- Slot đóng trong lúc chờ consent không tạo Application, Attribution hoặc MF03 request.
- Hai consent xác nhận đồng thời chỉ một lượt chiếm được slot.
- Submission luôn giữ đúng liên kết với Placement gốc sau nhiều lần thay thế.
- MF05 có cross-module test chứng minh Placement thay thế không tạo phí dịch vụ mới.
- Audit và notification đầy đủ cho cả thành công và slot hết khả dụng.

## Điều kiện bắt đầu

Chỉ bắt đầu phần này khi tất cả điều kiện sau đã có:

- [ ] Entity/table replacement slot của MF05 đã merge.
- [ ] Migration và constraint MF05 đã ổn định.
- [ ] Repository hoặc Application interface để đọc/lock slot đã có.
- [ ] Quy tắc phí và hoa hồng replacement đã được nhóm chốt.
- [ ] Mã lỗi và trạng thái terminal khi slot đóng đã được thống nhất.
- [ ] Đã chạy GitNexus impact analysis lại trên code mới nhất của MF02 và MF05.

## Tiêu chí hoàn thành

- MF02 tự nhận diện đúng lượt tuyển thay thế mà không nhận Placement từ request.
- Liên kết replacement được persisted và truy vết được bằng audit.
- Luồng chạy an toàn khi nhiều request đồng thời.
- Không tạo Application/Attribution/MF03 khi slot không còn hợp lệ.
- Không tạo phí dịch vụ mới cho Placement thay thế.
- Swagger, tài liệu FE và test liên module được cập nhật trong cùng phiên bản phát hành.
