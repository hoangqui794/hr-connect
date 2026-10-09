# Quy ước tích hợp chung cho MF02

## Xác thực

- Base path: `/api/v1`.
- API có bảo vệ dùng `Authorization: Bearer <accessToken>`.
- Swagger dùng HTTP Bearer nên ô Authorize chỉ nhập token, không nhập thêm chữ `Bearer`.
- API nội bộ MF03 dùng `X-Service-Token`; trình duyệt không được gọi.
- FE đọc cả `roles[]` và `permissions[]` từ response login hoặc `GET /api/v1/auth/me`.

Các permission chính:

| Permission | Chức năng |
|---|---|
| `application.create` | Candidate tự ứng tuyển |
| `application.view_own` | Candidate xem Application của mình |
| `submission.create` | Affiliate nộp Candidate/CV |
| `submission.view_own` | Affiliate xem Submission của mình |
| `submission.consent.resend_own` | Affiliate gửi lại consent |
| `candidate_library.view_own` | Affiliate xem kho Candidate/CV |
| `candidate_library.download_cv` | Affiliate xem file CV trong kho |
| `referral.progress.view_own` | Affiliate xem tiến độ referral tổng quát |
| `attribution.view_own` | Affiliate xem Attribution của mình |
| `candidate.identity.review` | Admin xử lý Identity Claim |
| `audit.view` | Admin xem audit log |

## HTTP client

Khi request trả `401`, chỉ cho một request gọi `POST /api/v1/auth/refresh-token`; các request khác chờ kết quả. Backend rotation cả access token và refresh token, vì vậy FE phải thay cả hai. Refresh thất bại thì xóa phiên và về login.

Không tạo vòng lặp refresh cho login, refresh và logout.

## Lỗi

| HTTP | Cách xử lý FE |
|---|---|
| `400` | Map `errors[field]` vào form; nếu không có thì dùng `message` hoặc `title`. |
| `401` | Refresh đúng một lần, sau đó logout nếu vẫn thất bại. |
| `403` | Hiển thị không đủ quyền; không retry. |
| `404` | Record không tồn tại hoặc không thuộc user hiện tại. |
| `409` | Đọc `code`/`errorCode`; reload nếu là stale/concurrent update. |
| `429` | Khóa nút theo `retryAfterSeconds` hoặc thời gian server trả về. |
| `500` | Hiển thị lỗi chung và `x-correlation-id` để hỗ trợ tra log. |

## File upload

- Dùng `FormData` và để browser tự tạo `Content-Type` kèm boundary.
- Không gửi field rỗng hoặc UUID mẫu của Swagger.
- File phải là PDF; backend còn kiểm tra nội dung và kích thước.
- Presigned URL chỉ dùng tạm thời. Khi hết hạn, gọi API xin URL mới.

## Thời gian, pagination và concurrency

- Thời gian API là UTC/ISO 8601; chỉ đổi sang local ở UI.
- Pagination bắt đầu từ `page=1`, thường dùng `pageSize=20`.
- Lưu `concurrencyToken` cùng record.
- Sau mutation thành công, thay token cũ bằng token mới.
- `409` stale/concurrent update: reload record rồi mới cho thao tác lại.

## Cache cần invalidate

| Mutation | Dữ liệu cần reload |
|---|---|
| Candidate apply | Candidate applications, Job detail |
| Affiliate submit | Affiliate submissions |
| Consent confirm/decline | Consent detail, Affiliate submissions, Candidate applications, CV usages |
| Resend consent | Submission detail và timer |
| Update CV reuse | Candidate affiliate CV list/detail; Affiliate library khi mở lại |
| Adopt CV | Candidate affiliate CV detail và kho CV cá nhân |
| Identity Claim hoàn tất | Auth/me, email identities, CV, applications |
| Admin xử lý claim | Admin claim list/detail |
