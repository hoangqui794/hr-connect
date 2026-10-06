# Hướng dẫn FE — Affiliate Submission và Candidate Consent (MF02)

Tài liệu này mô tả luồng FE khi Affiliate nộp Candidate/CV vào Job và Candidate xác nhận hoặc từ chối. Luồng áp dụng cho cả Candidate đã có tài khoản và Candidate chưa có tài khoản.

## 1. Quy tắc nghiệp vụ

1. Affiliate nộp Candidate/CV vào Job.
2. Backend chỉ tạo `Submission` ở trạng thái `PENDING_CONSENT`, lưu CV và gửi email xác nhận.
3. Chưa tạo `Application`, `Attribution` hoặc yêu cầu chấm điểm MF03 tại bước này.
4. Candidate xem thông tin, xem CV rồi chọn đồng ý hoặc từ chối.
5. Khi Candidate đồng ý, backend kiểm tra trùng lần cuối và tạo `Application`, `Attribution`, cùng hàng đợi MF03 trong một transaction.
6. Khi Candidate từ chối hoặc yêu cầu hết hạn, CV do Affiliate vừa tải lên được chuyển sang `ARCHIVED` và không gửi sang MF03.

Thời hạn xác nhận mặc định là 48 giờ. Cấu hình backend có thể thay đổi thời hạn này, vì vậy FE phải dùng trường `expiresAt` hoặc `consentExpiresAt` từ response thay vì tự cộng thời gian.

## 2. Hai trường hợp Candidate

### 2.1 Candidate đã có tài khoản

- Candidate nhận notification trong hệ thống và email yêu cầu vào web xác nhận.
- Notification dùng `relatedEntityId` và link email dùng `submissionId`; không gửi consent token cho trường hợp này.
- Nếu chưa đăng nhập, FE đưa Candidate đến màn hình đăng nhập rồi quay lại đúng trang xác nhận.
- FE gọi API Candidate có ổ khóa bằng Bearer token và `submissionId`.
- Backend chỉ chấp nhận tài khoản đang liên kết với Candidate của Submission.
- Người dùng không nhập, xem hoặc sao chép access token hay consent token.

### 2.2 Candidate chưa có tài khoản

- Link email chứa token một lần là bằng chứng xác nhận quyền truy cập email.
- FE gọi API review mà không cần Bearer token.
- Candidate có thể xem CV và chọn đồng ý hoặc từ chối trực tiếp.
- Không tự động tạo tài khoản cho Candidate.
- Candidate có thể đăng ký tài khoản sau; backend sẽ liên kết hồ sơ theo email sau bước xác minh OTP.

## 3. Token trong link xác nhận

Candidate chưa có tài khoản nhận link token:

```text
https://<frontend-host>/submission-consent#token=<one-time-token>
```

Candidate đã có tài khoản nhận link không chứa secret:

```text
https://<frontend-host>/submission-consent#submissionId=<submission-id>
```

FE đọc `token` hoặc `submissionId` từ `window.location.hash`. Token chỉ được gửi trong JSON request body của API public; `submissionId` được dùng với API Candidate có Bearer.

Yêu cầu bảo mật:

- Không đổi token sang query string `?token=...`.
- Không ghi token vào console, analytics, error tracking hoặc access log.
- Không lưu consent token vào local storage.
- Không gửi token sang domain khác.
- Sau khi xử lý xong có thể gọi `history.replaceState` để xóa fragment khỏi thanh địa chỉ.
- Access token nhận sau đăng nhập nên giữ trong memory của trang xác nhận; không hiển thị ô cho người dùng nhập access token.

### Cấu hình URL khi FE triển khai route riêng

Backend tạo link email từ biến trong file `.env` thật:

```env
SUBMISSION_CONSENT_URL_BASE=http://localhost:5173/submission-consent
```

Thay host và port bằng URL FE thực tế ở từng môi trường. `.env.example` chỉ là mẫu cho developer khác và không quyết định URL khi ứng dụng chạy. Nếu chưa có route FE riêng, trang dự phòng do backend phục vụ đang dùng `http://localhost:5041/submission-consent`.

## 4. API Affiliate nộp Candidate/CV

### `POST /api/v1/jobs/{jobId}/candidate-submissions`

Authentication: Bearer token của Affiliate.

Permission: `submission.create`.

Content-Type: `multipart/form-data`.

| Field | Bắt buộc | Mô tả |
|---|---:|---|
| `fullName` | Có | Tên Candidate, tối đa 255 ký tự |
| `email` | Có | Email dùng để nhận yêu cầu xác nhận |
| `phone` | Không | 8–20 ký tự hợp lệ |
| `note` | Không | Ghi chú của Affiliate |
| `file` | Chọn một | Tệp PDF mới |
| `cvId` | Chọn một | CV hợp lệ do chính Affiliate này đã tải lên trước đó |

Phải gửi đúng một trong `file` hoặc `cvId`. Khi dùng `file`, không gửi `cvId` rỗng hoặc UUID mẫu. Khi dùng `cvId`, không gửi `file`.

Response `200`:

```json
{
  "success": true,
  "message": "Đã tiếp nhận hồ sơ và gửi yêu cầu xác nhận đến Candidate.",
  "data": {
    "applicationId": null,
    "submissionId": "uuid",
    "attributionId": null,
    "affiliateId": "uuid",
    "candidateId": "uuid",
    "jobId": "uuid",
    "cvId": "uuid",
    "status": "PENDING_CONSENT",
    "aiStatus": "NOT_QUEUED",
    "consentExpiresAt": "2026-10-04T13:44:59Z",
    "emailDeliveryStatus": "SENT",
    "submittedAt": "2026-10-02T13:44:59Z"
  }
}
```

FE phải hiển thị theo `emailDeliveryStatus`:

- `SENT`: “Đã nộp hồ sơ. Đang chờ Candidate xác nhận.”
- `FAILED`: “Hồ sơ đã được lưu nhưng chưa gửi được email. Bạn có thể gửi lại từ chi tiết Submission.”

Không hiển thị “ứng tuyển thành công” tại bước này vì chưa có `Application`.

## 5. API đăng nhập Candidate đã có tài khoản

### `POST /api/v1/auth/login`

```json
{
  "email": "candidate@example.com",
  "password": "candidate-password"
}
```

Response `200`:

```json
{
  "success": true,
  "message": "Đăng nhập thành công.",
  "data": {
    "accessToken": "jwt",
    "refreshToken": "...",
    "tokenType": "Bearer",
    "expiresAt": "2026-10-02T15:00:00Z",
    "user": {
      "userId": "uuid",
      "email": "candidate@example.com",
      "roles": ["CANDIDATE"],
      "permissions": []
    }
  }
}
```

Sau login, FE giữ nguyên `submissionId` và gọi API Candidate có ổ khóa với:

```http
Authorization: Bearer <data.accessToken>
```

Nếu đăng nhập bằng tài khoản không thuộc Candidate trong yêu cầu, API review/respond vẫn trả `403`.

## 6. API public cho Candidate chưa có tài khoản

Hai API trong phần này chỉ dùng cho Candidate chưa có tài khoản. Candidate đã có tài khoản dùng API ở phần 8.

### Xem yêu cầu: `POST /api/v1/submission-consents/review`

Không gửi Authorization.

Request:

```json
{
  "token": "one-time-token-from-url-fragment"
}
```

Response `200`:

```json
{
  "success": true,
  "data": {
    "submissionId": "uuid",
    "status": "PENDING",
    "expiresAt": "2026-10-04T13:44:59Z",
    "candidateName": "Nguyễn Văn A",
    "jobTitle": "Senior .NET Backend Developer",
    "companyName": "HR Connect Demo Company",
    "cvFileName": "CV.pdf",
    "cvDownloadUrl": "https://temporary-r2-url",
    "cvUrlExpiresAt": "2026-10-02T13:49:59Z"
  }
}
```

`cvDownloadUrl` chỉ có hiệu lực khoảng 5 phút. Nếu link xem CV hết hạn, FE gọi lại API review để lấy URL mới.

Nếu `status` khác `PENDING`, FE chuyển sang màn hình kết quả và không hiển thị nút quyết định.

### Đồng ý hoặc từ chối: `POST /api/v1/submission-consents/respond`

Không gửi Authorization.

Đồng ý:

```json
{
  "token": "one-time-token-from-url-fragment",
  "decision": "CONFIRM"
}
```

Response `200`:

```json
{
  "success": true,
  "message": "Xác nhận thành công. Hồ sơ đã được tiếp nhận và chuyển sang MF03 để chấm điểm.",
  "submissionId": "uuid",
  "submissionStatus": "ACCEPTED",
  "applicationId": "uuid",
  "aiStatus": "PENDING"
}
```

Từ chối:

```json
{
  "token": "one-time-token-from-url-fragment",
  "decision": "DECLINE"
}
```

Response `200`:

```json
{
  "success": true,
  "message": "Bạn đã từ chối cho phép sử dụng hồ sơ cho công việc này.",
  "submissionId": "uuid",
  "submissionStatus": "CONSENT_REJECTED",
  "applicationId": null,
  "aiStatus": "NOT_QUEUED"
}
```

FE phải disable cả hai nút trong lúc gửi request để tránh bấm lặp. Sau thành công, ẩn nút quyết định và hiển thị màn hình kết quả.

## 7. API Candidate đã đăng nhập — không cần consent token

Hai API này có biểu tượng ổ khóa trong Swagger. FE gửi:

```http
Authorization: Bearer <candidate-access-token>
```

### Xem yêu cầu

```http
GET /api/v1/candidates/me/submission-consents/{submissionId}
```

Không có request body. Response `200` giống response review tại phần 6.

### Đồng ý hoặc từ chối

```http
POST /api/v1/candidates/me/submission-consents/{submissionId}/respond
Content-Type: application/json
```

```json
{
  "decision": "CONFIRM"
}
```

`decision` nhận `CONFIRM` hoặc `DECLINE`. Response giống API respond public nhưng không cần trường `token`.

Nguồn `submissionId`:

- `relatedEntityId` của notification `SUBMISSION`.
- Fragment `#submissionId=...` trong link email.
- Dữ liệu lịch sử/chi tiết Submission nếu FE đã có màn hình tương ứng.

Backend kiểm tra `Candidate.UserId` phải bằng user ID trong JWT. Đăng nhập bằng Candidate khác trả `403`.

## 8. Trạng thái FE cần hỗ trợ

| Submission status | Consent status | Hiển thị |
|---|---|---|
| `PENDING_CONSENT` | `PENDING` | Đang chờ Candidate xác nhận; cho phép Affiliate resend khi đủ điều kiện |
| `ACCEPTED` | `CONFIRMED` | Candidate đã đồng ý; đã tạo Application và đưa MF03 vào hàng đợi |
| `CONSENT_REJECTED` | `DECLINED` | Candidate đã từ chối |
| `CONSENT_EXPIRED` | `EXPIRED` | Link hết hạn; Affiliate phải tạo lượt nộp mới |
| `BLOCKED_DUPLICATE` | `CANCELLED` | Candidate đã có hồ sơ hợp lệ cho Job |
| `CANCELLED` | `CANCELLED` | Yêu cầu bị hủy |
| `JOB_UNAVAILABLE` | `CANCELLED` | Job không còn nhận hồ sơ |

Không suy luận trạng thái MF03 từ Submission. Chỉ hiển thị MF03 đã được tạo khi response trả `aiStatus: "PENDING"` hoặc dữ liệu Application tương ứng có kết quả AI.

## 9. Màn hình xác nhận đề xuất

### Trạng thái tải dữ liệu

- Tiêu đề: “Xác nhận hồ sơ ứng tuyển”.
- Loading skeleton hoặc spinner.
- Chưa hiển thị nút quyết định khi chưa review thành công.

### Candidate đã có tài khoản

- Thông báo: “Hồ sơ này đã liên kết với một tài khoản Candidate. Vui lòng đăng nhập để tiếp tục.”
- Ô Email.
- Ô Mật khẩu.
- Nút “Đăng nhập và tiếp tục”.
- Không có ô access token.

### Màn hình review

- Tên Candidate.
- Tên Job.
- Tên doanh nghiệp.
- Tên tệp CV.
- Hạn xác nhận theo múi giờ người dùng.
- Nút “Xem CV” mở tab mới.
- Nút chính “Đồng ý nộp hồ sơ”.
- Nút phụ nguy hiểm “Từ chối”.
- Nên có modal xác nhận lần cuối cho thao tác từ chối.

### Màn hình kết quả

- Đồng ý: hiển thị “Hồ sơ đã được tiếp nhận và đang chờ AI đánh giá.”
- Từ chối: hiển thị “Bạn đã từ chối yêu cầu sử dụng hồ sơ.”
- Hết hạn: hiển thị “Liên kết đã hết hạn. Vui lòng liên hệ Affiliate Recruiter.”
- Đã xử lý: hiển thị trạng thái hiện tại, không cho gửi quyết định khác.

## 10. Xử lý HTTP status

| HTTP | Ý nghĩa | FE xử lý |
|---:|---|---|
| `200` | Thành công | Render theo response |
| `400` | Token/decision không hợp lệ hoặc đã hết hạn | Hiển thị `message`; nếu có `errors`, gắn lỗi vào field tương ứng |
| `401` | Đăng nhập thất bại hoặc Bearer hết hạn | Hiển thị form đăng nhập lại |
| `403` | Bearer thuộc Candidate khác hoặc không có quyền truy cập | Báo sai tài khoản/không có quyền và cho phép đổi tài khoản |
| `404` | Token không tồn tại/không hợp lệ | Hiển thị trang link không hợp lệ, không retry tự động |
| `409` | Đã xử lý, Job đóng hoặc phát hiện trùng | Hiển thị `message`, khóa các nút quyết định rồi gọi review lại một lần |
| `429` | Gọi quá nhanh | Disable nút tạm thời và thông báo thử lại sau |
| `500` | Lỗi hệ thống | Hiển thị thông báo chung kèm correlation ID nếu response/header có cung cấp |

Error response nghiệp vụ thường có dạng:

```json
{
  "success": false,
  "message": "Nội dung lỗi cụ thể"
}
```

Validation error có thể theo `application/problem+json` với trường `errors`.

## 11. API lịch sử và resend cho Affiliate

### Danh sách Submission

```http
GET /api/v1/affiliates/submissions?status=PENDING_CONSENT&page=1&pageSize=20
Authorization: Bearer <affiliate-access-token>
```

Permission: `submission.view_own`.

Filter hỗ trợ: `status`, `jobId`, `candidateId`, `fromDate`, `toDate`, `page`, `pageSize`. `pageSize` tối đa 100.

Mỗi item có `submissionId`, Candidate, Job, CV, `status`, `consentStatus`, hạn/phản hồi consent, `applicationId`, `attributionId`, thông tin duplicate và thời điểm nộp.

### Chi tiết Submission

```http
GET /api/v1/affiliates/submissions/{submissionId}
Authorization: Bearer <affiliate-access-token>
```

FE dùng API này cho trang chi tiết và để quyết định có hiển thị nút resend hay không.

### Gửi lại email xác nhận

```http
POST /api/v1/affiliates/submissions/{submissionId}/consent/resend
Authorization: Bearer <affiliate-access-token>
```

Permission: `submission.consent.resend_own`.

Điều kiện:

- Submission thuộc Affiliate đang đăng nhập.
- Submission vẫn là `PENDING_CONSENT`.
- Consent vẫn là `PENDING` và chưa hết hạn.
- Cooldown mặc định 2 phút.
- Tối đa mặc định 5 lần gửi.
- Mỗi lần resend tạo token mới và vô hiệu hóa link cũ.

Response `200` gồm `submissionId`, `status`, `expiresAt`, `emailSendCount` và `emailDeliveryStatus`.

## 12. Checklist bàn giao FE

- [ ] Route `/submission-consent` đọc `token` hoặc `submissionId` từ URL fragment.
- [ ] Không log hoặc lưu consent token.
- [ ] Candidate có tài khoản dùng Bearer + `submissionId`; không dùng consent token.
- [ ] Candidate chưa có tài khoản xác nhận trực tiếp từ link email.
- [ ] Review thành công mới hiển thị CV và hai nút quyết định.
- [ ] Disable nút khi request đang chạy.
- [ ] Xử lý đầy đủ `400/401/403/404/409/429/500`.
- [ ] Hiển thị thời hạn từ response theo múi giờ người dùng.
- [ ] Refresh review khi presigned URL của CV hết hạn.
- [ ] Affiliate thấy trạng thái `PENDING_CONSENT` ngay sau khi nộp.
- [ ] Affiliate chỉ thấy nút resend khi Submission còn chờ xác nhận.
- [ ] Không hiển thị Application/Attribution/MF03 trước khi Candidate xác nhận.
