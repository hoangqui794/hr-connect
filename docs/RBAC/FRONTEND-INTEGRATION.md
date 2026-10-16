# Tích hợp FE quản trị phân quyền RBAC

Tài liệu này mô tả hợp đồng Backend đã triển khai cho màn hình quản trị Permission, custom Role và quyền của người dùng. FE không cấp Permission trực tiếp cho từng user. Muốn cấp thêm quyền cho một người, Admin tạo hoặc chọn **custom Role**, cấu hình Permission cho Role rồi gán Role đó cho user.

## 1. Điều kiện truy cập

- Base URL: `/api/v1/admin/authorization`
- Mọi API yêu cầu Bearer access token của tài khoản có system role `PLATFORM_ADMIN` đang hoạt động.
- API đọc yêu cầu `role.view` hoặc `permission.view` theo bảng bên dưới.
- API ghi yêu cầu `role.manage` hoặc `permission.manage`.
- Sau khi gán, thu hồi hoặc đổi ma trận quyền, quyền mới có hiệu lực từ request tiếp theo; không bắt người dùng đăng nhập lại.

## 2. Quy tắc cần thể hiện trên UI

- **System Role** do các luồng đăng ký/phê duyệt quản lý. Không hiển thị nút sửa, xóa, gán hoặc thu hồi system role trong màn hình RBAC.
- **Custom Role** được phép tạo, sửa, cấu hình Permission, gán và thu hồi.
- Xóa Role là soft delete. Role đang được gán ACTIVE phải thu hồi khỏi tất cả user trước.
- Không cho Admin tự gán hoặc tự thu hồi Role của chính mình.
- User phải `ACTIVE` và custom Role phải `ACTIVE` tại thời điểm gán.
- Các Permission IAM nhạy cảm có `isProtected=true` và `isDelegable=false`; không cho chọn chúng trong custom Role.
- Mọi thao tác ghi cần nhập lý do nghiệp vụ (`reason`).
- FE phải gửi đúng `concurrencyToken` vừa đọc. Sau mutation thành công, thay token cũ bằng token mới trong response.
- Khi nhận `RBAC_CONCURRENCY_CONFLICT`, tải lại dữ liệu và yêu cầu người dùng thực hiện lại trên phiên bản mới nhất.

## 3. Danh sách API

| # | Method | Endpoint | Permission | Chức năng |
|---|---|---|---|---|
| 1 | GET | `/permissions` | `permission.view` | Danh sách Permission có phân trang và bộ lọc |
| 2 | GET | `/permissions/{permissionId}` | `permission.view` | Chi tiết Permission và số custom Role đang sử dụng |
| 3 | PATCH | `/permissions/{permissionId}` | `permission.manage` | Đổi mô tả hoặc trạng thái Permission |
| 4 | GET | `/roles` | `role.view` | Danh sách system/custom Role |
| 5 | GET | `/roles/{roleId}` | `role.view` | Chi tiết Role, Permission và số lượt gán ACTIVE |
| 6 | POST | `/roles` | `role.manage` | Tạo custom Role |
| 7 | PATCH | `/roles/{roleId}` | `role.manage` | Sửa hoặc kích hoạt/ngừng custom Role |
| 8 | DELETE | `/roles/{roleId}` | `role.manage` | Ngừng sử dụng custom Role |
| 9 | PUT | `/roles/{roleId}/permissions` | `permission.manage` | Thay toàn bộ ma trận Permission của custom Role |
| 10 | GET | `/users/{userId}` | `role.view` | Xem Role và Permission hiệu lực của user |
| 11 | POST | `/users/{userId}/roles` | `role.manage` | Gán hoặc kích hoạt lại custom Role |
| 12 | DELETE | `/users/{userId}/roles/{roleId}` | `role.manage` | Thu hồi custom Role |

## 4. Kiểu response chung

Thành công:

```json
{
  "success": true,
  "data": {}
}
```

Lỗi nghiệp vụ:

```json
{
  "success": false,
  "message": "Nội dung lỗi",
  "errorCode": "RBAC_CONCURRENCY_CONFLICT",
  "details": null
}
```

Danh sách phân trang dùng cấu trúc:

```json
{
  "success": true,
  "data": {
    "items": [],
    "page": 1,
    "pageSize": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

## 5. Permission catalog

### 5.1 Danh sách Permission

`GET /api/v1/admin/authorization/permissions`

Query tùy chọn:

- `search`: tìm theo code hoặc mô tả.
- `resource`, `action`: lọc chính xác.
- `isActive`, `isDelegable`: boolean.
- `page`: mặc định 1 ở FE.
- `pageSize`: đề xuất 20; Backend giới hạn tối đa 100.

Mỗi item có `permissionId`, `code`, `resource`, `action`, `description`, `isActive`, `isDelegable`, `isProtected`, `concurrencyToken`.

### 5.2 Chi tiết Permission

`GET /api/v1/admin/authorization/permissions/{permissionId}`

Ngoài metadata còn có `customRoleUsageCount` và `updatedAt`.

### 5.3 Cập nhật Permission

`PATCH /api/v1/admin/authorization/permissions/{permissionId}`

```json
{
  "description": "Cho phép xem báo cáo vận hành",
  "isActive": true,
  "concurrencyToken": "a14f5778-a41f-4939-a53c-dccfddf8ab10",
  "reason": "Chuẩn hóa mô tả quyền"
}
```

FE không cho sửa `code`, `resource`, `action`, `isDelegable`. Permission protected không được tắt.

## 6. Custom Role

### 6.1 Danh sách Role

`GET /api/v1/admin/authorization/roles`

Query: `search`, `isSystem`, `isActive`, `page`, `pageSize`.

Item có `roleId`, `code`, `name`, `description`, `isSystem`, `isActive`, `permissionCount`, `activeAssignmentCount`, `concurrencyToken`.

### 6.2 Tạo custom Role

`POST /api/v1/admin/authorization/roles`

```json
{
  "code": "CLIENT_REVIEWER",
  "name": "Nhân viên xem hồ sơ",
  "description": "Chỉ xem hồ sơ trong phạm vi công việc được giao"
}
```

`code` được chuẩn hóa thành chữ hoa và dấu gạch dưới, chỉ nhận `A-Z`, `0-9`, `_`. Response 201 trả chi tiết Role và token đầu tiên.

### 6.3 Cập nhật hoặc ngừng Role

`PATCH /api/v1/admin/authorization/roles/{roleId}`

```json
{
  "name": "Nhân viên kiểm duyệt hồ sơ",
  "description": "Mô tả mới",
  "isActive": true,
  "concurrencyToken": "4a522a30-922f-4db8-bb29-f2933d671c5b",
  "reason": "Điều chỉnh phạm vi công việc"
}
```

`DELETE /api/v1/admin/authorization/roles/{roleId}` dùng body:

```json
{
  "concurrencyToken": "4a522a30-922f-4db8-bb29-f2933d671c5b",
  "reason": "Vai trò không còn sử dụng"
}
```

### 6.4 Thay ma trận Permission

`PUT /api/v1/admin/authorization/roles/{roleId}/permissions`

```json
{
  "permissionIds": [
    "4ea28fc5-d404-4907-b5a0-75d130376a18",
    "93d45281-b159-46e4-a010-37e0e2b0472b"
  ],
  "concurrencyToken": "4a522a30-922f-4db8-bb29-f2933d671c5b",
  "reason": "Cập nhật nhiệm vụ của nhóm"
}
```

Đây là thao tác **replace toàn bộ**. Mảng rỗng hợp lệ. FE phải gửi toàn bộ Permission muốn giữ, không chỉ phần mới thêm. Không gửi ID trùng nhau.

## 7. Quyền của người dùng

### 7.1 Xem quyền hiệu lực

`GET /api/v1/admin/authorization/users/{userId}`

Response gồm:

- `userId`, `email`, `status`, `authorizationConcurrencyToken`.
- `roles`: cả system/custom assignment, trạng thái, nguồn gán và dữ liệu thu hồi.
- `effectivePermissions`: Permission đã loại trùng, mỗi item có `sourceRoles` để UI giải thích quyền đến từ Role nào.

### 7.2 Gán custom Role

`POST /api/v1/admin/authorization/users/{userId}/roles`

```json
{
  "roleId": "61cfca6c-852c-4fcf-b7db-7d1091f987bf",
  "concurrencyToken": "0ea6ded6-82a6-4d09-8095-07ca880e3c45",
  "reason": "Phân công kiểm duyệt hồ sơ"
}
```

Nếu assignment cũ đang `REVOKED`, API kích hoạt lại và xóa metadata thu hồi cũ. Nếu đã `ACTIVE`, API trả trạng thái hiện tại mà không tạo audit thay đổi mới; token cũ vẫn bị từ chối trước khi xét idempotent.

### 7.3 Thu hồi custom Role

`DELETE /api/v1/admin/authorization/users/{userId}/roles/{roleId}`

```json
{
  "concurrencyToken": "8ac07db2-4048-49f7-9c71-f79299271c33",
  "reason": "Kết thúc phân công"
}
```

Response trả lại toàn bộ quyền hiện tại cùng token mới.

## 8. Mã lỗi cần xử lý

| HTTP | `errorCode` | Cách xử lý UI |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Hiển thị lỗi tại trường dữ liệu |
| 400 | `DUPLICATE_PERMISSION_ID` | Loại ID trùng trong danh sách chọn |
| 403 | `SELF_ROLE_MUTATION_FORBIDDEN` | Báo Admin không thể tự sửa Role của mình |
| 403 | thiếu permission | Ẩn thao tác và hiển thị thông báo không đủ quyền |
| 404 | `NOT_FOUND` | Quay lại danh sách hoặc tải lại dữ liệu |
| 409 | `RBAC_CONCURRENCY_CONFLICT` | Tải lại detail/token rồi cho thao tác lại |
| 409 | `SYSTEM_ROLE_IMMUTABLE` | Khóa toàn bộ thao tác ghi của system Role |
| 409 | `ROLE_IN_USE` | Yêu cầu thu hồi các assignment ACTIVE trước |
| 409 | `ROLE_INACTIVE` | Không cho gán Role đã ngừng sử dụng |
| 409 | `USER_INACTIVE` | Không cho gán Role cho user chưa ACTIVE |
| 409 | `NON_DELEGABLE_PERMISSION` | Bỏ Permission khỏi custom Role |
| 409 | `PROTECTED_PERMISSION` | Không cho tắt Permission IAM được bảo vệ |
| 409 | `ROLE_CODE_EXISTS` | Yêu cầu nhập code khác |

## 9. Đề xuất cấu trúc màn hình FE

### Trang “Vai trò & quyền”

- Tab **Vai trò**: bảng Role, badge System/Custom, trạng thái, số Permission, số user đang dùng.
- Tab **Danh mục quyền**: bộ lọc resource/action/trạng thái/delegable; Permission protected có biểu tượng khóa.
- Role detail: thông tin Role, checklist Permission chỉ gồm item `isActive=true && isDelegable=true && isProtected=false`, lịch sử/lý do ở audit log nếu FE đã tích hợp module audit.
- Với system Role, màn hình chỉ đọc.

### Trang “Phân quyền người dùng”

- Dùng API danh sách user hiện có để chọn user, sau đó gọi `GET /authorization/users/{userId}`.
- Chia hai phần: Role đang có và Permission hiệu lực.
- Hiển thị `sourceRoles` cạnh từng Permission để Admin hiểu nguồn quyền.
- Chỉ custom Role có nút thu hồi.
- Modal gán/thu hồi bắt buộc lý do và dùng token mới nhất của user.

## 10. Trình tự tích hợp khuyến nghị

1. Permission list/detail.
2. Role list/detail/create/update.
3. Permission checklist và API replace matrix.
4. User authorization detail.
5. Assign/revoke custom Role.
6. Xử lý token xung đột bằng refetch và thông báo rõ ràng.

Không cache dài hạn Role, Permission hoặc user authorization. Các thay đổi này là dữ liệu bảo mật và có thể được Admin khác cập nhật cùng lúc.
