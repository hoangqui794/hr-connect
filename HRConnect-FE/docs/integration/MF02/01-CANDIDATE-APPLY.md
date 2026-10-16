# Trang Candidate ứng tuyển Job

## Mục tiêu

Candidate xem Job, chọn đúng một nguồn CV và ứng tuyển. Backend tạo Submission `ACCEPTED`, Application và hàng đợi MF03 ngay trong luồng này; không cần consent.

Route FE đề xuất: `/candidate/jobs/:jobId/apply`.

## Actor và quyền

- Role: `CANDIDATE`.
- Permission: `application.create`.
- Candidate profile và tài khoản phải `ACTIVE`, chưa archive hoặc merge.

## API và thứ tự gọi

1. `GET /api/v1/jobs/{jobId}` — lấy Job và xác nhận actor được xem/nộp theo Service Type.
2. `GET /api/v1/candidates/cv` — lấy kho CV để chọn.
3. `POST /api/v1/jobs/{jobId}/apply` — ứng tuyển.
4. Sau thành công, `GET /api/v1/candidates/applications/{applicationId}` hoặc mở danh sách `GET /api/v1/candidates/applications`.

## Form giao diện

- Card thông tin Job.
- Hai lựa chọn loại trừ nhau:
  - chọn một `cvId` trong kho;
  - upload một file PDF mới.
- Nút **Ứng tuyển** chỉ bật khi đúng một nguồn CV được chọn.

Không có trường consent trong luồng Candidate tự ứng tuyển.

## Request

`POST /api/v1/jobs/{jobId}/apply`, `multipart/form-data`:

```text
cvId = UUID của CV trong kho
```

hoặc:

```text
file = PDF mới
```

Không gửi đồng thời `cvId` và `file`; cũng không được để cả hai rỗng.

## Sau khi thành công

Response chứa `applicationId`, `submissionId`, `candidateId`, `jobId`, `cvId`, `status`, `aiStatus`, `appliedAt`.

FE hiển thị **Ứng tuyển thành công** và mở Application. Không gọi MF03 từ browser.

## Trạng thái UI

| State | UI |
|---|---|
| `loading` | Skeleton Job và CV list |
| `ready` | Cho chọn CV/upload file |
| `submitting` | Khóa form và nút |
| `success` | Hiển thị kết quả, dẫn tới Application |
| `duplicate` | Báo Candidate đã ứng tuyển Job này, dẫn tới lịch sử |
| `jobUnavailable` | Khóa form, báo Job không còn nhận hồ sơ |
| `rateLimited` | Khóa nút và hiển thị thời gian thử lại |

## Lỗi cần xử lý

- `400`: sai nguồn CV hoặc PDF không hợp lệ.
- `403`: thiếu quyền hoặc Service Type không cho Candidate submit.
- `404`: Job/Candidate/CV không tồn tại trong phạm vi user.
- `409`: duplicate, Candidate inactive/archive/merged hoặc Job đổi trạng thái.
- `429`: vượt giới hạn Candidate apply.

## Checklist

- [ ] Chọn CV trong kho ứng tuyển được.
- [ ] Upload PDF ứng tuyển được.
- [ ] UI chặn cả hai nguồn cùng lúc và chặn không chọn nguồn nào.
- [ ] Bấm hai lần không tạo hai Application.
- [ ] Thành công mở đúng Application và không gọi MF03 trực tiếp.
