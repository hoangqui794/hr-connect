# Trang Candidate quản lý CV do Affiliate tải lên

## Mục tiêu

Candidate xem CV Affiliate đã dùng cho mình, kiểm tra các Job/Application liên quan, thu hồi quyền tái sử dụng và sao chép CV sang kho cá nhân.

Route FE đề xuất: `/candidate/affiliate-cvs` và `/candidate/affiliate-cvs/:cvId`.

## Base API

`/api/v1/candidates/me/affiliate-cvs`

| API | Chức năng trang |
|---|---|
| `GET ?page=&pageSize=` | Danh sách CV Affiliate |
| `GET /{cvId}` | Chi tiết metadata và trạng thái reuse |
| `GET /{cvId}/download-url` | URL xem CV có hạn 5 phút |
| `GET /{cvId}/usages` | Job/Application đã sử dụng CV |
| `PATCH /{cvId}/reuse` | Cho phép hoặc thu hồi tái sử dụng |
| `POST /{cvId}/adopt` | Sao chép sang kho CV cá nhân |

## Danh sách và chi tiết

Mỗi card nên hiển thị tên file, Affiliate nguồn, ngày tải, trạng thái, số lần sử dụng, reuse đang bật/tắt và CV đã adopt hay chưa.

Không lưu presigned URL trong cache dài hạn. Chỉ gọi download-url khi người dùng bấm xem.

## Cập nhật quyền reuse

```json
{
  "allowed": false,
  "concurrencyToken": "..."
}
```

- Thu hồi chỉ chặn lượt nộp mới.
- Submission/Application/Attribution cũ vẫn giữ để bảo toàn lịch sử.
- Sau thành công, thay `concurrencyToken` bằng token mới.
- `409` stale token: reload detail và yêu cầu thao tác lại.

## Adopt CV

`POST /api/v1/candidates/me/affiliate-cvs/{cvId}/adopt`

Adopt tạo một bản sao độc lập trong `/api/v1/candidates/cv`. Gọi lại cùng `cvId` trả về bản đã adopt, không tạo thêm bản sao.

Sau thành công, hiển thị nút **Mở trong kho CV cá nhân** và reload danh sách CV cá nhân.

## Usages

`GET /api/v1/candidates/me/affiliate-cvs/{cvId}/usages`

Trang usages dùng để giải thích CV này đã được Affiliate nộp vào Job/Application nào. Không xóa lịch sử usages khi Candidate thu hồi reuse hoặc adopt.

## Checklist

- [ ] Candidate chỉ xem được CV thuộc Candidate của mình.
- [ ] URL xem CV hết hạn sau 5 phút và được xin lại khi cần.
- [ ] Thu hồi reuse không xóa dữ liệu cũ.
- [ ] Adopt nhiều lần không tạo CV trùng.
- [ ] `409` concurrency reload đúng record.
