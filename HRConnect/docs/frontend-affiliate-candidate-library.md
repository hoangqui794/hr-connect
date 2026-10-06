# Hướng dẫn FE: Kho Candidate/CV của Affiliate

## Mục tiêu giao diện

Cho phép `AFFILIATE_RECRUITER` xem lại các Candidate đã từng đồng ý hồ sơ, chọn CV do chính Affiliate tải và nộp Candidate đó vào một Job mới mà không phải nhập hoặc tải lại dữ liệu.

Mỗi Job mới vẫn cần một lần xác nhận mới của Candidate. Việc Candidate/CV xuất hiện trong kho không đồng nghĩa Affiliate được tự động gửi hồ sơ đến mọi doanh nghiệp.

## Xác thực

Tất cả API trong tài liệu này dùng JWT Bearer của Affiliate và yêu cầu:

- Role `AFFILIATE_RECRUITER`.
- Permission `candidate_library.view_own` cho API danh sách và chi tiết kho.
- Permission `candidate_library.download_cv` cho API lấy signed URL của CV.
- Permission `submission.create` cho API nộp Job.

FE chỉ gửi access token trong `Authorization` header. Không truyền `userId` hoặc `affiliateId`.

## 1. Màn hình danh sách kho Candidate

```http
GET /api/v1/affiliates/candidates?search=&page=1&pageSize=20&sortBy=lastSubmittedAt&sortDirection=desc
```

Các giá trị hợp lệ:

- `sortBy`: `lastSubmittedAt`, `candidateName`.
- `sortDirection`: `asc`, `desc`.
- `pageSize`: từ 1 đến 100.
- `search`: tối đa 100 ký tự, tìm theo tên, email hoặc số điện thoại.

Response:

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "candidateId": "uuid",
        "fullName": "Nguyễn Văn A",
        "email": "candidate@example.com",
        "phone": "0900000000",
        "hasAccount": true,
        "activeCvCount": 2,
        "acceptedSubmissionCount": 3,
        "lastSubmittedAt": "2026-10-02T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 1,
      "totalPages": 1
    }
  }
}
```

Giao diện đề xuất:

- Ô tìm kiếm theo tên/email/phone.
- Sắp xếp “Nộp gần nhất” và “Tên Candidate”.
- Mỗi dòng hiển thị tên, email, phone, số CV, số lần nộp thành công và ngày nộp gần nhất.
- Nút `Xem kho CV` mở trang chi tiết.
- Nút `Nộp vào Job` mở bước chọn CV và Job.

Không tự ghép các Candidate có email hoặc số điện thoại giống gần đúng. Backend đã trả đúng `candidateId` chuẩn.

## 2. Màn hình chi tiết Candidate và CV

```http
GET /api/v1/affiliates/candidates/{candidateId}
```

Response:

```json
{
  "success": true,
  "data": {
    "candidateId": "uuid",
    "fullName": "Nguyễn Văn A",
    "email": "candidate@example.com",
    "phone": "0900000000",
    "hasAccount": true,
    "acceptedSubmissionCount": 3,
    "cvs": [
      {
        "cvId": "uuid",
        "title": "Backend CV",
        "fileName": "candidate.pdf",
        "mimeType": "application/pdf",
        "fileSizeBytes": 245000,
        "status": "ACTIVE",
        "createdAt": "2026-09-20T10:00:00Z",
        "acceptedSubmissionCount": 2,
        "lastUsedAt": "2026-10-01T09:00:00Z"
      }
    ]
  }
}
```

Chỉ những CV `ACTIVE`, do Affiliate hiện tại tải và đã được Candidate đồng ý mới xuất hiện. FE không cần tự lọc thêm theo ownership.

## 3. Xem CV

```http
GET /api/v1/affiliates/candidates/{candidateId}/cvs/{cvId}/download-url
```

Response:

```json
{
  "success": true,
  "data": {
    "cvId": "uuid",
    "fileName": "candidate.pdf",
    "mimeType": "application/pdf",
    "downloadUrl": "https://signed-url...",
    "expiresAt": "2026-10-03T10:05:00Z"
  }
}
```

FE chỉ gọi API khi người dùng bấm `Xem CV`. Link hết hạn sau 5 phút; nếu hết hạn thì gọi lại API. Không lưu signed URL vào local storage, database hoặc log phía FE.

## 4. Nộp Candidate/CV có sẵn vào Job mới

```http
POST /api/v1/jobs/{jobId}/candidate-submissions
Content-Type: multipart/form-data
```

Form dùng cho kho:

```text
candidateId = UUID Candidate đã chọn
cvId        = UUID CV đã chọn
note        = ghi chú tùy chọn
file        = không gửi
fullName    = không cần gửi
email       = không cần gửi
phone       = không cần gửi
```

Ví dụ JavaScript:

```javascript
const form = new FormData();
form.append("candidateId", candidateId);
form.append("cvId", cvId);
if (note?.trim()) form.append("note", note.trim());

await api.post(`/api/v1/jobs/${jobId}/candidate-submissions`, form);
```

Backend tự lấy tên, email và số điện thoại đã lưu. FE không gửi lại các trường này để tránh dữ liệu cũ hoặc bị chỉnh sửa.

Response thành công vẫn là Submission chờ consent:

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
    "consentExpiresAt": "2026-10-05T10:00:00Z",
    "emailDeliveryStatus": "SENT",
    "submittedAt": "2026-10-03T10:00:00Z"
  }
}
```

Sau response này, hiển thị: `Đã gửi yêu cầu. Đang chờ Candidate xác nhận.` Không hiển thị là Application đã được tạo hoặc AI đã chấm.

## 5. Nộp Candidate/CV mới

API trên vẫn hỗ trợ chế độ cũ:

```text
candidateId = không gửi
cvId        = không gửi
fullName    = bắt buộc
email       = bắt buộc
phone       = tùy chọn
file        = PDF bắt buộc
note        = tùy chọn
```

Không gửi đồng thời `file` và `cvId`.

## 6. Xử lý lỗi

| HTTP | Ý nghĩa FE |
|---:|---|
| `400` | Form hoặc chế độ nộp không hợp lệ; hiển thị `message` |
| `401` | Access token hết hạn; chuyển về đăng nhập |
| `403` | Affiliate/permission không hợp lệ; khóa thao tác |
| `404` | Candidate/CV không còn trong kho; tải lại danh sách |
| `409` | Candidate đã có hồ sơ hoặc đang chờ xác nhận ở Job; hiển thị `message` |
| `429` | Thao tác quá nhanh; giữ form và yêu cầu thử lại sau |

Nếu API nộp trả `emailDeliveryStatus = FAILED`, Submission vẫn đã được lưu. Hiển thị cảnh báo và cho phép Affiliate dùng API resend consent trong lịch sử Submission; không tự gọi lại POST nộp hồ sơ.

## 7. Luồng giao diện hoàn chỉnh

1. Affiliate mở `Kho Candidate`.
2. FE gọi API danh sách.
3. Affiliate chọn Candidate.
4. FE gọi API chi tiết và hiển thị các CV.
5. Affiliate có thể xem CV bằng signed URL 5 phút.
6. Affiliate chọn Job và một CV.
7. FE gửi `candidateId + cvId` đến API nộp hồ sơ.
8. Hiển thị trạng thái `PENDING_CONSENT`.
9. Theo dõi kết quả bằng lịch sử Submission hiện có.
10. Candidate đồng ý thì backend mới tạo Application, Attribution và gửi MF03.

FE không cần và không được tự tạo Application, Attribution hoặc yêu cầu MF03.
