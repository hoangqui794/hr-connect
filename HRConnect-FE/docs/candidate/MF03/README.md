# MF-03 — Candidate Dashboard và AI UI

## Chức năng hiện đã có

- MF-02 đã tạo hàng đợi chấm điểm sau khi Application hợp lệ.
- Application cơ bản có `aiStatus`; kết quả match được lưu trong hệ thống.
- FE có route `/candidate/dashboard`, nhưng dữ liệu hiện tại chỉ là tổng hợp tạm từ các API khác và chưa phải contract dashboard chính thức.

## Backend còn cần hoàn thiện trước khi gắn UI chính thức

- Một Candidate dashboard projection/aggregate có ownership.
- Summary Application/CV/consent và các việc cần làm.
- Recent applications.
- Recommendation Job đã lọc visibility, Service Type và loại Job đã apply.
- `partial/unavailableSections` khi nguồn phụ lỗi.
- Chỉ trả AI score/tier nếu policy cho Candidate xem; không trả raw model output, parse warning, dispatcher error hoặc retry count.

BE có thể chỉnh endpoint/DTO theo business MF-03. Khi chốt, ghi contract thật vào file này và cập nhật `src/services/api/mf03`.

## UI cần làm tại `/candidate/dashboard`

- Khối việc cần làm: consent, Interview, Offer hoặc hồ sơ thiếu.
- Summary ứng tuyển đã được backend aggregate.
- Hồ sơ gần đây có deep-link.
- Job phù hợp từ AI hoặc fallback `RECENT_ELIGIBLE`; không tạo điểm AI giả.
- Loading/error/partial theo từng section; lỗi nguồn không được hiển thị thành số 0.

## Test UI

1. Dashboard của Candidate A không nhận dữ liệu B.
2. AI service tắt vẫn hiển thị partial/fallback, không `500` toàn trang.
3. Job đã apply/private/sai policy không được gợi ý.
4. Pending action đã hết hạn không còn nút hành động.
5. Không render raw AI metadata.
