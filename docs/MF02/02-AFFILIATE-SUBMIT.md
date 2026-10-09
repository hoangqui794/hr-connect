# Trang Affiliate nộp Candidate/CV

## Mục tiêu

Affiliate nộp hồ sơ mới hoặc tái sử dụng Candidate/CV đã được Candidate cho phép. Kết quả ban đầu luôn là Submission `PENDING_CONSENT`; Application, Attribution và MF03 chỉ xuất hiện sau khi Candidate đồng ý.

Route FE đề xuất: `/affiliate/jobs/:jobId/submit-candidate`.

## Actor và quyền

- Role: `AFFILIATE_RECRUITER` còn hoạt động và đã xác minh.
- Permission: `submission.create`.
- Job phải cho Affiliate xem và submit theo Service Type.

## API tải trang

1. `GET /api/v1/jobs/{jobId}`.
2. Nếu chọn tab **Từ kho**, gọi `GET /api/v1/affiliates/candidates`.
3. Khi chọn Candidate trong kho, gọi `GET /api/v1/affiliates/candidates/{candidateId}` để lấy CV hợp lệ.

## Hai tab của form

### Hồ sơ mới

`POST /api/v1/jobs/{jobId}/candidate-submissions`, multipart:

```text
fullName = bắt buộc
email    = bắt buộc
phone    = tùy chọn
file     = PDF mới
note     = tùy chọn
```

Không gửi `candidateId` và `cvId`.

### Từ kho Affiliate

```text
candidateId = Candidate lấy từ API kho
cvId        = CV thuộc đúng Candidate đó
note        = tùy chọn
```

Không gửi `file`; FE không cho sửa lại email/phone/fullName trong tab này.

## Rule nhận diện Candidate

- Email chính và alias đã xác minh đều quy về Candidate canonical.
- Email và phone cùng tồn tại nhưng trỏ hai Candidate khác nhau: trả `409`.
- Email/alias trỏ hai hồ sơ chưa hợp nhất: `409 CANDIDATE_IDENTITY_MERGE_PENDING`.
- Candidate có tài khoản chỉ nhận consent tại email chính đã xác minh.
- Duplicate kiểm tra theo `Candidate + Job`, không theo riêng chuỗi email.

## Response thành công

```json
{
  "success": true,
  "data": {
    "applicationId": null,
    "submissionId": "...",
    "attributionId": null,
    "candidateId": "...",
    "jobId": "...",
    "cvId": "...",
    "status": "PENDING_CONSENT",
    "aiStatus": "NOT_QUEUED",
    "consentExpiresAt": "...",
    "emailDeliveryStatus": "SENT"
  }
}
```

Hiển thị **Đã gửi hồ sơ và đang chờ Candidate xác nhận**. Không hiển thị “Application đã tạo”.

Nếu `emailDeliveryStatus = FAILED`, Submission vẫn đã được lưu. Hiển thị cảnh báo gửi email thất bại và dẫn tới chi tiết Submission để resend; không submit lại hồ sơ.

## Lỗi cần xử lý

- `400`: sai tổ hợp field, PDF không hợp lệ hoặc UUID không đúng.
- `403`: Affiliate bị khóa, mất role/permission hoặc Job không cho submit.
- `404`: Job, Candidate hoặc CV trong kho không tồn tại.
- `409`: duplicate, xung đột danh tính, email/phone không cùng Candidate hoặc reuse đã bị thu hồi.
- `429`: vượt rate limit.

## Checklist

- [ ] FormData bỏ hẳn field không dùng.
- [ ] Hồ sơ mới chỉ dùng file; hồ sơ kho chỉ dùng `candidateId + cvId`.
- [ ] FE không cho tự nhập UUID.
- [ ] `PENDING_CONSENT` được hiển thị là chờ xác nhận.
- [ ] Email gửi lỗi không làm FE submit hồ sơ lần hai.
