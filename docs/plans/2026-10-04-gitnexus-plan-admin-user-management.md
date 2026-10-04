# Kế hoạch Kỹ thuật GitNexus

> **Nhiệm vụ:** Quản lý người dùng dành cho Platform Admin  
> **Độ sâu:** Standard  
> **Phạm vi:** Backend HRConnect (.NET), Swagger, phân quyền, audit log và kiểm thử  
> **Trạng thái:** Kế hoạch triển khai; chưa thay đổi production code

## §1. Mục tiêu

Xây dựng một nhóm API quản lý người dùng dành riêng cho `PLATFORM_ADMIN`, tuân thủ các quy ước đang có của dự án thay vì tạo một cơ chế quản trị riêng.

Phạm vi gồm:

1. Xem danh sách người dùng có phân trang và lọc theo từ khóa, trạng thái, vai trò.
2. Xem chi tiết một người dùng.
3. Tạm khóa tài khoản đang hoạt động.
4. Kích hoạt lại tài khoản đã bị tạm khóa.
5. Mở khóa đăng nhập do Identity lockout.
6. Ghi audit log cho mọi thao tác thay đổi.
7. Bảo đảm tài khoản bị tạm khóa không tiếp tục dùng access token hoặc refresh token cũ.
8. Mô tả đúng cơ chế Bearer JWT trong Swagger.

Ngoài phạm vi: tạo/xóa người dùng, sửa hồ sơ, thay đổi vai trò, duyệt Affiliate, hard delete và quản trị `PLATFORM_ADMIN` khác.

## §2–3. Hiện trạng và kiến trúc liên quan

### Luồng phân quyền hiện tại

- `[verified]` Endpoint dùng permission policy thông qua `RequirePermission(...)`; quyền được ánh xạ vào claim sau khi xác thực.
- `[verified]` `Permission.md` đã định nghĩa `user.view` và `user.manage`, vì vậy scope này không cần tạo permission mới.
- `[verified]` `ActiveAuthorizationClaimsTransformation` hiện bổ sung role/permission từ cơ sở dữ liệu, nhưng cần được siết chặt để người dùng `SUSPENDED` hoặc đã bị xóa không còn được xem là principal hợp lệ.
- `[verified]` Đăng nhập và refresh token đã kiểm tra trạng thái người dùng, nhưng access token đã phát hành vẫn cần bị chặn ở các request tiếp theo.
- `[verified]` Các API dành cho người dùng nội bộ dùng Bearer JWT; `X-Service-Token` chỉ dành cho endpoint có metadata service-to-service.

### Dữ liệu và audit hiện tại

- `[verified]` `AppUser.Status` là nguồn trạng thái nghiệp vụ của tài khoản.
- `[verified]` ASP.NET Identity lockout là trạng thái kỹ thuật riêng, không đồng nghĩa với `SUSPENDED`.
- `[verified]` Dự án đã có shared audit logging và mô hình hằng số trong `AuditActions`.
- `[assumed]` Việc đổi trạng thái và ghi audit nên được thực hiện trong cùng transaction khi hạ tầng hiện có cho phép; nếu không, handler phải thất bại rõ ràng và không báo thành công giả.

## §4–5. Kết quả khảo sát và ràng buộc

1. `user.view` phù hợp cho danh sách và chi tiết; `user.manage` phù hợp cho suspend/reactivate/unlock.
2. Endpoint phải nằm dưới `/api/v1/admin/users`, không nằm dưới `/api/v1/internal`, để tránh nhập nhằng giữa Platform Admin và Internal HR.
3. Không được gắn `InternalServiceAuthAttribute`; Swagger phải sinh `Authorization: Bearer`.
4. State machine an toàn trong scope hiện tại chỉ gồm `ACTIVE -> SUSPENDED` và `SUSPENDED -> ACTIVE`.
5. `PENDING -> ACTIVE` vẫn thuộc quy trình phê duyệt chuyên biệt, không đi qua API quản lý trạng thái chung.
6. Tất cả tài khoản có role `PLATFORM_ADMIN` là mục tiêu bị bảo vệ. Chưa có super-admin hoặc duyệt nhiều bước nên không cho tự khóa, khóa chéo hay unlock admin.
7. Suspend phải thu hồi refresh token và làm access token cũ mất hiệu lực ngay ở request kế tiếp.
8. Unlock chỉ gỡ Identity lockout; không được tự kích hoạt một tài khoản đang `SUSPENDED`.
9. Danh sách và chi tiết không trả password hash, token, security stamp hoặc dữ liệu nhạy cảm không cần thiết.

## §6. Thiết kế thay đổi

### API contract

| Method | Endpoint | Permission | Mục đích |
|---|---|---|---|
| `GET` | `/api/v1/admin/users` | `user.view` | Danh sách có phân trang và bộ lọc |
| `GET` | `/api/v1/admin/users/{userId}` | `user.view` | Chi tiết người dùng |
| `PATCH` | `/api/v1/admin/users/{userId}/status` | `user.manage` | Chuyển `ACTIVE/SUSPENDED` theo state machine |
| `POST` | `/api/v1/admin/users/{userId}/unlock` | `user.manage` | Gỡ Identity lockout |

`PATCH status` nhận trạng thái đích và lý do. Lý do là bắt buộc khi suspend; với reactivate vẫn cho phép ghi chú để phục vụ audit.

### Truy vấn danh sách

- Lọc theo từ khóa trên các trường nhận diện được cho phép như tên và email đã chuẩn hóa.
- Lọc theo `AppUser.Status`.
- Lọc theo role qua quan hệ Identity bằng một truy vấn có thể dịch sang SQL.
- Sắp xếp ổn định, mặc định theo thời điểm cập nhật gần nhất rồi theo ID.
- Phân trang có giới hạn kích thước trang để tránh truy vấn không giới hạn.
- Trả DTO tối thiểu cho màn hình quản trị, không trả toàn bộ entity.

### Thay đổi trạng thái

Handler phải thực hiện theo thứ tự:

1. Tải target user và roles.
2. Kiểm tra target tồn tại.
3. Chặn target có role `PLATFORM_ADMIN`.
4. Kiểm tra transition hợp lệ.
5. Kiểm tra lý do bắt buộc.
6. Cập nhật `AppUser.Status`.
7. Khi suspend, thu hồi toàn bộ refresh token còn hiệu lực.
8. Lưu thay đổi và audit với actor/target/action/reason.
9. Trả trạng thái mới, không trả dữ liệu xác thực nhạy cảm.

### Mở khóa đăng nhập

1. Tải target user và roles.
2. Chặn target `PLATFORM_ADMIN`.
3. Nếu không bị lockout, trả kết quả idempotent hoặc lỗi nghiệp vụ nhất quán với convention hiện có.
4. Gỡ thời điểm lockout và reset bộ đếm thất bại bằng API của Identity.
5. Không sửa `AppUser.Status`.
6. Ghi audit `USER_LOGIN_UNLOCKED`.

### Vô hiệu access token cũ

Cập nhật `ActiveAuthorizationClaimsTransformation`:

- Nếu principal không có `sub` đại diện `AppUser`, giữ nguyên để không phá service principal.
- Nếu có `sub`, truy vấn tối thiểu `AppUser` bằng `AsNoTracking`.
- Nếu không tìm thấy hoặc trạng thái khác `ACTIVE`, trả principal không được xác thực/không có quyền ứng dụng.
- Nếu hợp lệ, tiếp tục bổ sung role và permission như hiện tại.
- Bổ sung unit test cho active, suspended, missing user và service principal.

### Swagger

- Thêm tag `Admin Users`.
- Đặt tag vào thứ tự tài liệu hiện có.
- Mỗi operation mô tả rõ permission và response.
- Không để filter service-token nhận nhầm endpoint này.
- Kiểm thử metadata để bảo đảm Bearer JWT được áp dụng.

## §7. Trình tự triển khai

1. **Chốt contract và DTO**
   - Tạo request/response DTO, pagination, bộ lọc và validator.
   - Chốt mã lỗi cho not found, transition sai, thiếu lý do và protected admin.

2. **Tạo query đọc**
   - Cài đặt danh sách phân trang và chi tiết.
   - Dùng projection và `AsNoTracking`.
   - Viết unit test cho lọc, sắp xếp, phân trang và 404.

3. **Tạo command thay đổi trạng thái**
   - Cài đặt state machine, protected-admin guard, thu hồi refresh token và audit.
   - Viết test cho success, invalid transition, PENDING, target admin và rollback/failure.

4. **Tạo command unlock**
   - Dùng `UserManager`/Identity API đúng chuẩn.
   - Giữ nguyên trạng thái nghiệp vụ.
   - Viết test cho locked, already-unlocked, suspended và target admin.

5. **Siết hiệu lực access token**
   - Cập nhật claims transformation.
   - Bảo toàn service principal.
   - Đo số truy vấn và xác minh không phát sinh N+1.

6. **Ánh xạ endpoint và Swagger**
   - Thêm `AdminUsersEndpoints`.
   - Gắn đúng permission, tag, summary, response và Bearer security.
   - Đăng ký endpoint/tag theo convention hiện có.

7. **Chạy regression**
   - Build toàn solution.
   - Chạy toàn bộ test.
   - Chạy riêng nhóm auth/admin.
   - Kiểm tra Swagger thủ công bằng một JWT `PLATFORM_ADMIN`.

## §8. Chiến lược kiểm thử

### Unit test bắt buộc

- Query danh sách: search, status, role, phân trang, thứ tự ổn định và không lộ dữ liệu nhạy cảm.
- Query chi tiết: thành công và không tồn tại.
- Suspend: thành công, lý do trống, trạng thái sai, target admin, thu hồi refresh token.
- Reactivate: thành công, transition sai, target admin.
- Unlock: thành công, không lock, target admin, giữ nguyên `SUSPENDED`.
- Claims transformation: active, suspended, missing user và principal không có app-user `sub`.
- Audit: đúng action, actor, target, reason; không có token/secret.
- Swagger: đúng tag và không có `X-Service-Token`.

### Kiểm thử tích hợp/API

- `PLATFORM_ADMIN` đủ quyền nhận `200`.
- Không đăng nhập nhận `401`.
- Đăng nhập nhưng thiếu quyền nhận `403`.
- Target không tồn tại nhận `404`.
- Payload sai nhận `400/422` theo convention hiện có.
- JWT phát hành trước khi suspend không truy cập được endpoint bảo vệ sau suspend.
- Refresh token phát hành trước khi suspend không thể đổi lấy token mới.
- Reactivate không làm refresh token cũ sống lại.

### Baseline đã xác minh trước kế hoạch

- `[verified]` `dotnet build HRConnect/HRConnect.sln`: thành công, 0 warning, 0 error.
- `[verified]` `dotnet test HRConnect/HRConnect.sln --no-build`: 957/957 test thành công.

## §11. Gói ngữ cảnh triển khai

```json{
  "task_summary": "Xây dựng chức năng quản lý người dùng dành cho PLATFORM_ADMIN theo chuẩn kiến trúc hiện có, gồm tra cứu, xem chi tiết, tạm khóa, kích hoạt lại và mở khóa đăng nhập; đồng thời bảo đảm Swagger, phân quyền, audit log và token đang tồn tại đều xử lý đúng.",
  "plan_depth": "standard",
  "intended_change": [
    "Bổ sung bốn API quản trị người dùng dưới /api/v1/admin/users.",
    "Dùng user.view cho thao tác đọc và user.manage cho thao tác thay đổi trạng thái.",
    "Chỉ cho phép chuyển ACTIVE sang SUSPENDED và SUSPENDED sang ACTIVE; không dùng API chung để duyệt tài khoản PENDING.",
    "Cấm thao tác lên tài khoản có vai trò PLATFORM_ADMIN cho đến khi có chính sách quản trị cấp cao hơn.",
    "Thu hồi toàn bộ refresh token khi tạm khóa và làm cho access token cũ mất hiệu lực ngay khi xác thực lại trạng thái người dùng.",
    "Ghi audit cho tạm khóa, kích hoạt lại và mở khóa đăng nhập.",
    "Hiển thị nhóm Admin Users trong Swagger và chỉ dùng Bearer JWT."
  ],
  "files_to_modify": [
    {
      "path": "HRConnect/HRConnect.Application/Common/Models/AuditActions.cs",
      "symbols": [
        "AuditActions"
      ],
      "reason": "Bổ sung hằng số hành động audit USER_SUSPENDED, USER_REACTIVATED và USER_LOGIN_UNLOCKED."
    },
    {
      "path": "HRConnect/HRConnect.Infrastructure/Authentication/ActiveAuthorizationClaimsTransformation.cs",
      "symbols": [
        "ActiveAuthorizationClaimsTransformation.TransformAsync"
      ],
      "reason": "Đối chiếu sub với AppUser trong cơ sở dữ liệu; nếu người dùng không tồn tại hoặc không ACTIVE thì trả về principal không được xác thực, nhưng không ảnh hưởng service principal không có app-user sub."
    },
    {
      "path": "HRConnect/HRConnect.Presentation/Program.cs",
      "symbols": [
        "SwaggerGen options.TagActionsBy",
        "SwaggerGen options.DocumentFilter"
      ],
      "reason": "Đăng ký và sắp xếp tag Admin Users nhất quán với các nhóm API hiện có."
    },
    {
      "path": "HRConnect/HRConnect.Presentation/Swagger/SwaggerTagOrderDocumentFilter.cs",
      "symbols": [
        "SwaggerTagOrderDocumentFilter.Apply"
      ],
      "reason": "Thêm Admin Users vào thứ tự tag Swagger."
    },
    {
      "path": "HRConnect/HRConnect.Application/Features/Admin/Users/Queries/GetAdminUsers/GetAdminUsersQuery.cs",
      "symbols": [
        "GetAdminUsersQuery",
        "GetAdminUsersQueryHandler"
      ],
      "reason": "Tạo danh sách người dùng phân trang với bộ lọc search, status và role."
    },
    {
      "path": "HRConnect/HRConnect.Application/Features/Admin/Users/Queries/GetAdminUserDetail/GetAdminUserDetailQuery.cs",
      "symbols": [
        "GetAdminUserDetailQuery",
        "GetAdminUserDetailQueryHandler"
      ],
      "reason": "Tạo truy vấn chi tiết người dùng phục vụ màn hình quản trị."
    },
    {
      "path": "HRConnect/HRConnect.Application/Features/Admin/Users/Commands/ChangeUserStatus/ChangeUserStatusCommand.cs",
      "symbols": [
        "ChangeUserStatusCommand",
        "ChangeUserStatusCommandHandler"
      ],
      "reason": "Thực thi state machine ACTIVE/SUSPENDED, lý do bắt buộc, chặn PLATFORM_ADMIN, thu hồi refresh token và ghi audit."
    },
    {
      "path": "HRConnect/HRConnect.Application/Features/Admin/Users/Commands/UnlockUser/UnlockUserCommand.cs",
      "symbols": [
        "UnlockUserCommand",
        "UnlockUserCommandHandler"
      ],
      "reason": "Xóa lockout đăng nhập nhưng không thay đổi trạng thái nghiệp vụ của tài khoản; ghi audit."
    },
    {
      "path": "HRConnect/HRConnect.Presentation/Endpoints/AdminUsersEndpoints.cs",
      "symbols": [
        "AdminUsersEndpoints.MapAdminUsersEndpoints"
      ],
      "reason": "Ánh xạ bốn endpoint, permission, response contract và metadata Swagger."
    }
  ],
  "files_to_add": [
    "Các DTO/request/validator tương ứng trong HRConnect.Application/Features/Admin/Users/.",
    "Unit test cho query, command, authorization claims transformation và Swagger metadata.",
    "Integration test cho endpoint quản trị nếu test host hiện tại hỗ trợ cơ sở dữ liệu phù hợp."
  ],
  "files_to_delete": [],
  "symbols_to_modify": [
    "AuditActions",
    "ActiveAuthorizationClaimsTransformation.TransformAsync",
    "SwaggerTagOrderDocumentFilter.Apply",
    "Program SwaggerGen registration"
  ],
  "symbols_to_add": [
    "GetAdminUsersQuery/GetAdminUsersQueryHandler",
    "GetAdminUserDetailQuery/GetAdminUserDetailQueryHandler",
    "ChangeUserStatusCommand/ChangeUserStatusCommandHandler",
    "UnlockUserCommand/UnlockUserCommandHandler",
    "AdminUsersEndpoints.MapAdminUsersEndpoints"
  ],
  "invariants": [
    "PLATFORM_ADMIN mới được truy cập nhóm API quản lý người dùng.",
    "Mọi endpoint vẫn tuân theo permission policy hiện có; không tự kiểm tra role bằng chuỗi rời rạc.",
    "Không dùng đường dẫn /api/v1/internal và không gắn InternalServiceAuthAttribute.",
    "PENDING không được kích hoạt qua endpoint đổi trạng thái chung.",
    "Không cho phép thao tác lên bất kỳ tài khoản PLATFORM_ADMIN nào.",
    "SUSPENDED phải làm access token cũ vô hiệu ở lần request tiếp theo và thu hồi refresh token.",
    "Unlock chỉ xử lý lockout đăng nhập, không tự chuyển SUSPENDED thành ACTIVE.",
    "Mọi thay đổi trạng thái quan trọng phải có audit actor, target, action và metadata phù hợp; không ghi dữ liệu nhạy cảm."
  ],
  "scenarios": [
    {
      "name": "Liệt kê người dùng",
      "given": "PLATFORM_ADMIN có user.view",
      "when": "Gọi GET /api/v1/admin/users với phân trang và bộ lọc hợp lệ",
      "then": "Trả danh sách phân trang ổn định, không lộ dữ liệu nhạy cảm và lọc đúng search/status/role."
    },
    {
      "name": "Xem chi tiết",
      "given": "PLATFORM_ADMIN có user.view",
      "when": "Gọi GET /api/v1/admin/users/{userId}",
      "then": "Trả dữ liệu quản trị cần thiết hoặc 404 khi không tồn tại."
    },
    {
      "name": "Tạm khóa người dùng",
      "given": "Tài khoản đích ACTIVE, không có role PLATFORM_ADMIN và admin có user.manage",
      "when": "PATCH trạng thái SUSPENDED kèm lý do",
      "then": "Cập nhật trạng thái, thu hồi refresh token, access token cũ không còn được chấp nhận và tạo audit USER_SUSPENDED."
    },
    {
      "name": "Kích hoạt lại",
      "given": "Tài khoản đích SUSPENDED, không có role PLATFORM_ADMIN",
      "when": "PATCH trạng thái ACTIVE",
      "then": "Kích hoạt lại tài khoản và tạo audit USER_REACTIVATED nhưng không khôi phục refresh token cũ."
    },
    {
      "name": "Chặn chuyển trạng thái không hợp lệ",
      "given": "Tài khoản PENDING hoặc trạng thái đích không nằm trong state machine",
      "when": "Gọi endpoint đổi trạng thái",
      "then": "Trả lỗi nghiệp vụ rõ ràng và không thay đổi dữ liệu."
    },
    {
      "name": "Chặn tác động admin",
      "given": "Tài khoản đích có role PLATFORM_ADMIN",
      "when": "Gọi suspend, reactivate hoặc unlock",
      "then": "Từ chối thao tác, không thay đổi dữ liệu và không tạo audit thành công giả."
    },
    {
      "name": "Mở khóa đăng nhập",
      "given": "Người dùng không phải PLATFORM_ADMIN đang bị Identity lockout",
      "when": "POST /unlock",
      "then": "Đặt lockout về trạng thái mở, giữ nguyên AppUser.Status và tạo audit USER_LOGIN_UNLOCKED."
    },
    {
      "name": "Swagger dùng đúng cơ chế xác thực",
      "given": "Mở Swagger cho Admin Users",
      "when": "Kiểm tra security scheme",
      "then": "Endpoint dùng Authorization Bearer JWT, không yêu cầu X-Service-Token."
    },
    {
      "name": "Service principal không bị ảnh hưởng",
      "given": "Principal nội bộ không có app-user sub",
      "when": "Claims transformation chạy",
      "then": "Luồng service-to-service hiện có tiếp tục hoạt động."
    }
  ],
  "test_commands": [
    "dotnet build HRConnect/HRConnect.sln",
    "dotnet test HRConnect/HRConnect.sln --no-build",
    "dotnet test HRConnect/HRConnect.UnitTests/HRConnect.UnitTests.csproj --filter FullyQualifiedName~ActiveAuthorizationClaimsTransformationTests",
    "dotnet test HRConnect/HRConnect.UnitTests/HRConnect.UnitTests.csproj --filter FullyQualifiedName~Admin"
  ],
  "risk_notes": [
    "Thêm truy vấn cơ sở dữ liệu ở claims transformation có thể tăng chi phí mỗi request; cần dùng AsNoTracking, truy vấn tối thiểu và đo tác động.",
    "Nếu chỉ thu hồi refresh token mà không kiểm tra trạng thái ở request kế tiếp, access token cũ vẫn dùng được đến khi hết hạn.",
    "Lọc theo role qua quan hệ Identity cần tránh N+1 và bảo đảm truy vấn có thể dịch sang SQL.",
    "Audit và thay đổi trạng thái phải cùng một transaction hoặc có quy tắc rõ ràng để tránh dữ liệu nghiệp vụ đã đổi nhưng audit thất bại.",
    "Endpoint unlock dễ bị hiểu nhầm là reactivate; contract và tên hiển thị phải phân biệt rõ hai khái niệm."
  ],
  "assumptions": [
    "Chức năng quản lý user ở mức Standard không bao gồm tạo tài khoản, xóa tài khoản, sửa hồ sơ, đổi role hoặc duyệt quy trình affiliate.",
    "Permission user.view và user.manage trong Permission.md là nguồn sự thật hiện hành và chưa cần migration.",
    "Quy tắc chặn mọi target PLATFORM_ADMIN là chính sách an toàn tạm thời cho đến khi có super-admin hoặc quy trình phê duyệt nhiều bước.",
    "Không bổ sung migration cơ sở dữ liệu trong scope này."
  ],
  "open_questions": [
    "Sau scope này, nếu cần quản trị role hoặc tác động PLATFORM_ADMIN thì phải thiết kế governance riêng; không mở rộng ngầm trong implementation.",
    "Nếu màn hình FE cần thêm cột ngoài contract tối thiểu, phải xác nhận dữ liệu đó không nhạy cảm trước khi mở API."
  ],
  "avoid": [
    "Không suy luận service authentication từ chuỗi /api/v1/internal.",
    "Không tái sử dụng luồng approve PENDING cho thao tác reactivate.",
    "Không hard-delete người dùng.",
    "Không ghi password hash, token, security stamp hoặc PII không cần thiết vào audit.",
    "Không làm thay đổi các dự án .NET ngoài phạm vi cần thiết của HRConnect."
  ],
  "evidence_provenance": {
    "schema_version": 2,
    "head_commit": "237d4c229508ec45da1583d993a15a1ceb42afcb",
    "generated_plan_path": "docs/plans/2026-10-04-gitnexus-plan-admin-user-management.md",
    "global_dirty_digest": {
      "algorithm": "sha256",
      "canonicalization": "gitnexus-evidence-provenance-v2 NUL-framed UTF-8 records",
      "value": "0a9c85780067d9afcd0764f307b60891e3cee927ee11eaeb5ec7826d10fd82cd"
    },
    "cited_path_manifest": [
      {
        "path": "HRConnect/HRConnect.Application/Common/Models/AuditActions.cs",
        "object_kind": {
          "head": "regular",
          "index": "regular",
          "worktree": "regular",
          "untracked": "absent"
        },
        "state": "clean",
        "rename_from": null,
        "rename_to": null,
        "head_digest": "sha256:72d0546cd9969a23c098f7838c7ce8b5efcf66831c5c4af98e1218faabf50f80",
        "index_digest": "sha256:72d0546cd9969a23c098f7838c7ce8b5efcf66831c5c4af98e1218faabf50f80",
        "worktree_digest": "sha256:f92f1e130f6479dd3b067f5f91cddab6b1e0912afb4214a76fbf1a21a187524e",
        "untracked_digest": "absent"
      },
      {
        "path": "HRConnect/HRConnect.Application/Features/Auth/Commands/Login/LoginCommandHandler.cs",
        "object_kind": {
          "head": "regular",
          "index": "regular",
          "worktree": "regular",
          "untracked": "absent"
        },
        "state": "clean",
        "rename_from": null,
        "rename_to": null,
        "head_digest": "sha256:b6bf3bfb4e18b28d758f7dfb5108498228909d6f3c383c36b33ae15e3df1977c",
        "index_digest": "sha256:b6bf3bfb4e18b28d758f7dfb5108498228909d6f3c383c36b33ae15e3df1977c",
        "worktree_digest": "sha256:cd620bf6bbfdc7531691293c3d23d58c29566ec9334a986b2d692e2d0389c6b9",
        "untracked_digest": "absent"
      },
      {
        "path": "HRConnect/HRConnect.Application/Features/Auth/Commands/RefreshToken/RefreshTokenCommandHandler.cs",
        "object_kind": {
          "head": "regular",
          "index": "regular",
          "worktree": "regular",
          "untracked": "absent"
        },
        "state": "clean",
        "rename_from": null,
        "rename_to": null,
        "head_digest": "sha256:47c71ffd40ef0ae3899ef1fc4e374bbf71a7eec1a4752ecb1ce11be711f81ad1",
        "index_digest": "sha256:47c71ffd40ef0ae3899ef1fc4e374bbf71a7eec1a4752ecb1ce11be711f81ad1",
        "worktree_digest": "sha256:22f889883b6eaf9734097fb026af3a5d9429b1551749748e95ccac47ca6f86ec",
        "untracked_digest": "absent"
      },
      {
        "path": "HRConnect/HRConnect.Domain/Entities/AppUser.cs",
        "object_kind": {
          "head": "regular",
          "index": "regular",
          "worktree": "regular",
          "untracked": "absent"
        },
        "state": "clean",
        "rename_from": null,
        "rename_to": null,
        "head_digest": "sha256:2a7b0a14e4f722e5b64709a44bed7795559698a8d162cb5c2d3868ebdaaec00e",
        "index_digest": "sha256:2a7b0a14e4f722e5b64709a44bed7795559698a8d162cb5c2d3868ebdaaec00e",
        "worktree_digest": "sha256:cf8a7aeded6233bdfbf02e77713fb27ecdc1e4aace21910dca60fc42ed6b3481",
        "untracked_digest": "absent"
      },
      {
        "path": "HRConnect/HRConnect.Infrastructure/Authentication/ActiveAuthorizationClaimsTransformation.cs",
        "object_kind": {
          "head": "regular",
          "index": "regular",
          "worktree": "regular",
          "untracked": "absent"
        },
        "state": "clean",
        "rename_from": null,
        "rename_to": null,
        "head_digest": "sha256:4bd5e532457cf718cded8eed21ba6daed8034356f5f4bf3aa49e55be11fc22bb",
        "index_digest": "sha256:4bd5e532457cf718cded8eed21ba6daed8034356f5f4bf3aa49e55be11fc22bb",
        "worktree_digest": "sha256:9d81ea80755735b19fc07ac48eeed6a4db7288aa6b0fe109b0ac1d17738aaece",
        "untracked_digest": "absent"
      },
      {
        "path": "HRConnect/HRConnect.Infrastructure/DependencyInjection.cs",
        "object_kind": {
          "head": "regular",
          "index": "regular",
          "worktree": "regular",
          "untracked": "absent"
        },
        "state": "clean",
        "rename_from": null,
        "rename_to": null,
        "head_digest": "sha256:e4921187556f7cac7dbe41712c1cc6ad15471401698dbd4d1ecc716c78d547d5",
        "index_digest": "sha256:e4921187556f7cac7dbe41712c1cc6ad15471401698dbd4d1ecc716c78d547d5",
        "worktree_digest": "sha256:e8a17e4e631871d37a14855e083bfc4342b15ac3345becb8744f748364061335",
        "untracked_digest": "absent"
      },
      {
        "path": "HRConnect/HRConnect.Presentation/Authorization/PermissionAuthorization.cs",
        "object_kind": {
          "head": "regular",
          "index": "regular",
          "worktree": "regular",
          "untracked": "absent"
        },
        "state": "clean",
        "rename_from": null,
        "rename_to": null,
        "head_digest": "sha256:12bcf7ad7c9b90b39f51b4fcba04b2854d7feca75f43f4cbef94f72a0ddf83ba",
        "index_digest": "sha256:12bcf7ad7c9b90b39f51b4fcba04b2854d7feca75f43f4cbef94f72a0ddf83ba",
        "worktree_digest": "sha256:118a195b48bc11d1b1f0671ae87429f7dcd89ba8aa9733471d883480f49220fb",
        "untracked_digest": "absent"
      },
      {
        "path": "HRConnect/HRConnect.Presentation/Program.cs",
        "object_kind": {
          "head": "regular",
          "index": "regular",
          "worktree": "regular",
          "untracked": "absent"
        },
        "state": "clean",
        "rename_from": null,
        "rename_to": null,
        "head_digest": "sha256:f109571de28492384b5dcdfdba2179627c5092cf46f22edaca182f134300ba59",
        "index_digest": "sha256:f109571de28492384b5dcdfdba2179627c5092cf46f22edaca182f134300ba59",
        "worktree_digest": "sha256:76697431ed179bdf986f11edf8571ee4ca3065457eabc3231b0a6f53d3cc36f6",
        "untracked_digest": "absent"
      },
      {
        "path": "HRConnect/HRConnect.Presentation/Swagger/InternalServiceAuthOperationFilter.cs",
        "object_kind": {
          "head": "regular",
          "index": "regular",
          "worktree": "regular",
          "untracked": "absent"
        },
        "state": "clean",
        "rename_from": null,
        "rename_to": null,
        "head_digest": "sha256:a4b96b9b0213d47c035dff32fcc5b94b99ddb0160a33cec83c98db10dddec651",
        "index_digest": "sha256:a4b96b9b0213d47c035dff32fcc5b94b99ddb0160a33cec83c98db10dddec651",
        "worktree_digest": "sha256:e0a0d422b967b819f1c7481bfe9b54cdd99baea3e6e98e25a1522da4931415e6",
        "untracked_digest": "absent"
      },
      {
        "path": "HRConnect/HRConnect.Presentation/Swagger/SwaggerTagOrderDocumentFilter.cs",
        "object_kind": {
          "head": "regular",
          "index": "regular",
          "worktree": "regular",
          "untracked": "absent"
        },
        "state": "clean",
        "rename_from": null,
        "rename_to": null,
        "head_digest": "sha256:f5d6459e726cb2c35c0b11d122815f0f8b15bc4955c855cb809da9b2f2b30f69",
        "index_digest": "sha256:f5d6459e726cb2c35c0b11d122815f0f8b15bc4955c855cb809da9b2f2b30f69",
        "worktree_digest": "sha256:62d8bb3cb121a801f43fff627f799e85da6791affd8aaddf5c94a09bdcea6838",
        "untracked_digest": "absent"
      },
      {
        "path": "HRConnect/HRConnect.UnitTests/Authentication/ActiveAuthorizationClaimsTransformationTests.cs",
        "object_kind": {
          "head": "regular",
          "index": "regular",
          "worktree": "regular",
          "untracked": "absent"
        },
        "state": "clean",
        "rename_from": null,
        "rename_to": null,
        "head_digest": "sha256:ca6b77e5b4fc1b588df71e4b274a6a566a2c9a3cfac7b5f51481ada99a2e0d23",
        "index_digest": "sha256:ca6b77e5b4fc1b588df71e4b274a6a566a2c9a3cfac7b5f51481ada99a2e0d23",
        "worktree_digest": "sha256:bdbcd662314c0bcb1dfffe8bf6435beb5577ab1b09565b8e094798dffa406237",
        "untracked_digest": "absent"
      },
      {
        "path": "HRConnect/Permission.md",
        "object_kind": {
          "head": "regular",
          "index": "regular",
          "worktree": "regular",
          "untracked": "absent"
        },
        "state": "clean",
        "rename_from": null,
        "rename_to": null,
        "head_digest": "sha256:7c4a799995c55908674b76d1a00ebec295b776b0d27546c9807a4261f51a9a30",
        "index_digest": "sha256:7c4a799995c55908674b76d1a00ebec295b776b0d27546c9807a4261f51a9a30",
        "worktree_digest": "sha256:afae459324a0f0b29e1fb468d541b3985c51647a02a8d2ad8f0671c29663f403",
        "untracked_digest": "absent"
      },
      {
        "path": "HRConnect/docs/shared-audit-logging.md",
        "object_kind": {
          "head": "regular",
          "index": "regular",
          "worktree": "regular",
          "untracked": "absent"
        },
        "state": "clean",
        "rename_from": null,
        "rename_to": null,
        "head_digest": "sha256:da3af24d0b36b7820f6aaa96da29513b75c0398591cd9b1ab1c1ec99d41d0f92",
        "index_digest": "sha256:da3af24d0b36b7820f6aaa96da29513b75c0398591cd9b1ab1c1ec99d41d0f92",
        "worktree_digest": "sha256:ffebe4b2a5ca026938ca2369aadd9ce39e746762a394d67a56279d7ad5200548",
        "untracked_digest": "absent"
      }
    ]
  }
}
```

## §12. Giả định và câu hỏi mở

- `[assumed]` Scope Standard không bao gồm chỉnh sửa role hay tạo/xóa tài khoản.
- `[assumed]` Chặn toàn bộ target `PLATFORM_ADMIN` là lựa chọn an toàn cho đến khi có mô hình super-admin.
- `[assumed]` Không cần migration vì permission và trạng thái cần thiết đã tồn tại.
- `[open]` Nếu FE yêu cầu thêm trường dữ liệu, phải duyệt lại quyền riêng tư và contract trước khi mở rộng.
- `[open]` Quản trị role hoặc admin-to-admin phải là một kế hoạch riêng có governance và audit mạnh hơn.

## §13. Tiêu chí hoàn thành

Kế hoạch chỉ được coi là triển khai xong khi:

1. Bốn endpoint hoạt động đúng permission và state machine.
2. Suspend vô hiệu cả refresh token lẫn access token cũ.
3. Unlock không làm thay đổi trạng thái nghiệp vụ.
4. Mọi target `PLATFORM_ADMIN` được bảo vệ.
5. Audit đầy đủ, không chứa secret.
6. Swagger dùng Bearer JWT và hiển thị đúng nhóm `Admin Users`.
7. Build thành công, toàn bộ test cũ và test mới đều xanh.
8. Không có migration ngoài kế hoạch và không làm thay đổi luồng Internal HR/service-to-service.

