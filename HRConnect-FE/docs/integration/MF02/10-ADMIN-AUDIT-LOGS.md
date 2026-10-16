# Trang Admin tra Audit Log MF02

## Mục tiêu

Admin truy vết ai đã thực hiện thao tác nào, trên entity nào, vào thời điểm nào và dữ liệu trước/sau thay đổi. Trang này chỉ đọc, không có sửa/xóa audit log.

Route FE đề xuất: `/admin/audit-logs` và `/admin/audit-logs/:auditLogId`.

## Actor và quyền

- Permission: `audit.view`.

## API danh sách

`GET /api/v1/admin/audit-logs`

Query:

```text
actorUserId
actorType
action
source
serviceName
entityType
entityId
correlationId
fromUtc
toUtc
page
pageSize
```

Dữ liệu mới nhất hiển thị trước.

## API chi tiết

`GET /api/v1/admin/audit-logs/{auditLogId}`

Hiển thị:

- action và entity;
- actor user/type;
- source và service name;
- correlation ID;
- IP, user agent nếu có;
- old values và new values dưới dạng JSON format đẹp;
- thời điểm UTC và local.

Một số field được phép `null` khi không có actor đăng nhập, không có giá trị trước/sau, hoặc sự kiện do worker hệ thống tạo. FE hiển thị `—`, không hiển thị chuỗi `null` như lỗi dữ liệu.

## Filter nhanh cho MF02

FE nên có preset theo `entityType`/`action` cho:

- Submission và consent;
- Application đầu vào;
- Attribution;
- Candidate CV;
- Candidate Identity Claim;
- email/notification worker liên quan.

Không hard-code rằng mọi action luôn có `entityId` kiểu GUID; dùng schema response.

## Lỗi cần xử lý

- `400`: query/filter không hợp lệ.
- `403`: thiếu `audit.view`.
- `404`: audit log detail không tồn tại.

## Checklist

- [ ] Filter thay đổi reset page 1.
- [ ] Correlation ID có nút copy.
- [ ] JSON old/new values được escape an toàn, không render HTML.
- [ ] Field null hiển thị `—`.
- [ ] Không có action sửa hoặc xóa audit log.
