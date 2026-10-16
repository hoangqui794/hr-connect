# Trang kho CV cá nhân của Candidate

## Mục tiêu

Candidate upload nhiều CV, xem/tải, đổi tên, đặt CV chính và gỡ CV khỏi kho. Đây là nguồn `cvId` dùng trên trang Candidate ứng tuyển.

Route FE đề xuất: `/candidate/cvs`.

## Quyền

| Permission | Chức năng |
|---|---|
| `cv.view_own` | Xem danh sách và download URL |
| `cv.create` | Upload CV |
| `cv.update_own` | Sửa title và đặt primary |
| `cv.delete_own` | Gỡ CV |

## API

| API | Chức năng |
|---|---|
| `GET /api/v1/candidates/cv` | Danh sách, CV chính đứng đầu |
| `POST /api/v1/candidates/cv` | Upload PDF mới |
| `GET /api/v1/candidates/cv/{cvId}/download-url` | URL xem/tải tạm thời |
| `PATCH /api/v1/candidates/cv/{cvId}` | Sửa title |
| `PATCH /api/v1/candidates/cv/{cvId}/primary` | Đặt CV chính |
| `DELETE /api/v1/candidates/cv/{cvId}` | Gỡ CV |

## Upload

Multipart:

```text
file      = PDF bắt buộc
title     = tùy chọn
isPrimary = true/false, tùy chọn
```

FE kiểm tra đuôi/MIME để phản hồi sớm, nhưng backend là nơi kiểm tra nội dung PDF cuối cùng.

## Cập nhật và đặt primary

Sửa title gửi JSON theo Swagger. Đặt primary không cần body. Sau thành công, reload list để bảo đảm chỉ một CV được đánh dấu chính.

CV do Affiliate tải không được sửa/đặt primary bằng nhóm API này. Candidate cần adopt CV trước, sau đó quản lý bản sao cá nhân.

## Xóa/gỡ CV

- CV chưa dùng có thể được xóa khỏi DB và dọn file.
- CV đã gắn với Application không bị hard delete; hệ thống giữ file/lịch sử.
- UI dùng từ **Gỡ khỏi kho** và modal xác nhận, tránh hứa rằng mọi dữ liệu lịch sử sẽ bị xóa.
- Nếu gỡ CV chính, reload list để lấy CV chính mới hoặc trạng thái chưa có CV chính.

## Download URL

`expiryMinutes` là query tùy chọn và bị backend giới hạn. FE nên dùng mặc định; không yêu cầu link sống dài. Không lưu URL vào database/localStorage.

## Checklist

- [ ] Upload PDF hợp lệ và hiển thị ngay trong list.
- [ ] Danh sách chỉ có CV của Candidate hiện tại.
- [ ] Chỉ một CV primary.
- [ ] CV đã dùng không làm mất lịch sử Application khi gỡ.
- [ ] CV Affiliate chưa adopt không xuất hiện như CV cá nhân có thể sửa.
