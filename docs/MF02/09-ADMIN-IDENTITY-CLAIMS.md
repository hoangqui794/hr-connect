# Trang Admin xử lý Candidate Identity Claim

## Mục tiêu

Admin đối chiếu các claim không thể tự động hoàn tất và quyết định approve/reject mà không làm mất CV, Submission, Application hoặc Attribution.

Route FE đề xuất: `/admin/candidate-identity-claims` và `/admin/candidate-identity-claims/:claimId`.

## Actor và quyền

- Role phù hợp ở Admin UI.
- Permission: `candidate.identity.review`.

## API

| API | Chức năng |
|---|---|
| `GET /api/v1/admin/candidate-identity-claims` | Hàng đợi, mặc định `PENDING_ADMIN_REVIEW` |
| `GET /api/v1/admin/candidate-identity-claims/{claimId}` | Chi tiết bằng chứng và dữ liệu hai Candidate |
| `POST /api/v1/admin/candidate-identity-claims/{claimId}/approve` | Approve với `concurrencyToken`, `note?` |
| `POST /api/v1/admin/candidate-identity-claims/{claimId}/reject` | Reject với `concurrencyToken`, `reason` bắt buộc |

## Trang danh sách

- Filter status/search/pagination theo Swagger.
- Badge `PENDING_ADMIN_REVIEW`, `COMPLETED`, `REJECTED`, `EXPIRED`, `CANCELLED`.
- Mở detail trước khi cho thao tác.

## Trang chi tiết

Hiển thị tách biệt:

- tài khoản/Candidate đang đăng nhập;
- Candidate đang sở hữu email cũ;
- email đã được OTP xác minh;
- số lượng CV, Submission, Application và dữ liệu liên quan của hai phía;
- reason khiến claim phải review;
- `concurrencyToken` hiện tại.

Nếu cả hai Candidate đều có lịch sử, hiển thị cảnh báo rõ. Không tạo nút “force merge”.

## Approve/reject

- Approve chỉ gửi token hiện tại và note nếu có.
- Reject bắt buộc nhập reason.
- Trong lúc request chạy, khóa cả hai nút.
- Thành công thì reload list/detail và hiển thị trạng thái cuối.

## Lỗi cần xử lý

- `409` stale/concurrent update: reload detail trước khi thao tác lại.
- `IDENTITY_CLAIM_MANUAL_MERGE_REQUIRED`: giữ record trong hàng đợi và báo chưa thể tự động gộp.
- `404`: claim đã bị đóng/xóa khỏi phạm vi hiện tại; quay về danh sách.
- `403`: ẩn toàn bộ action và hiển thị thiếu quyền.

## Checklist

- [ ] Không approve trực tiếp từ row chưa mở detail.
- [ ] Reject bắt buộc reason.
- [ ] Không retry với concurrency token cũ.
- [ ] Manual merge conflict không bị hiển thị thành lỗi 500.
- [ ] Sau quyết định, Candidate nhận đúng trạng thái/notification khi reload.
