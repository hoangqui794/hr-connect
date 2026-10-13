# Báo cáo Hoàn thành API — MF-01 & Candidate Backend Enhancements

> **Thời điểm hoàn thành:** 2026-10-13  
> **Tài liệu căn cứ:** [candidate-ui-backend-handoff.md](file:///d:/0-FPT/Capstone/code/BE/hr-connect/docs/MF01/candidate-ui-backend-handoff.md)  
> **Nhánh thực hiện:** `feature/mf01-candidate-backend-enhancements`  
> **Commit hash:** `ba283ea0fff5cd3c80507b27910af4c8abcd3a94`

---

## 1. MF và chức năng đã hoàn thành

### Module: MF-01 (Job Creation, Discovery & Candidate Integration) & Shared Notifications

1. **Job Sorting (Sắp xếp tin tuyển dụng):**
   - Hỗ trợ sắp xếp tin tuyển dụng công khai theo ngày đăng (`POSTED_AT`) và mức lương (`SALARY`).
   - Hỗ trợ chiều sắp xếp giảm dần (`DESC`) và tăng dần (`ASC`).
   - Có cơ chế fallback ổn định theo `jobId` để chống nhảy trang phân trang.
   - Kiểm tra whitelist nghiêm ngặt ở tầng Application, chặn các giá trị query không hợp lệ với thông báo lỗi tiếng Việt thân thiện.
2. **Application Deadline & Server-calculated Eligibility (Hạn nộp hồ sơ & Trạng thái nhận đơn):**
   - Bổ sung trường `application_deadline` (`timestamptz`, có thể `NULL`) vào cơ sở dữ liệu và các DTO tạo/cập nhật/truy vấn tin tuyển dụng.
   - Thêm thuộc tính `isAcceptingApplications` do server tính toán tự động dựa trên:
     - Trạng thái công việc phải là `ACTIVE`.
     - Ngày hiện tại (`DateTime.UtcNow`) phải trước hạn nộp (`ApplicationDeadline == null || ApplicationDeadline > UtcNow`).
   - Chặn nộp hồ sơ ứng tuyển (`ApplyJobCommandHandler`) hoặc giới thiệu ứng viên (`SubmitCandidateCommandHandler`) khi công việc đã quá hạn với mã lỗi HTTP 400.
3. **Expanded Job Search (Mở rộng phạm vi tìm kiếm):**
   - Tìm kiếm từ khóa không phân biệt hoa thường (`ILIKE` / EF `Functions.ILike`) trên cả 4 trường:
     - Tiêu đề công việc (`job.title`)
     - Mô tả công việc (`job.description`)
     - Tên công ty (`company.company_name`)
     - Tên kỹ năng (`skill.skill_name`)
   - Đảm bảo trả về các bản ghi duy nhất (không bị duplicate dòng do quan hệ nhiều-nhiều với bảng kỹ năng).
4. **Candidate Saved Jobs (Tính năng lưu tin tuyển dụng của Candidate):**
   - Tạo bảng `candidate_saved_job` trong database với khóa chính kép duy nhất `(candidate_id, job_id)`.
   - Cung cấp API lưu công việc, hủy lưu công việc (đảm bảo tính idempotent: gọi nhiều lần không sinh lỗi).
   - Cung cấp API lấy danh sách công việc đã lưu phân trang dành riêng cho tài khoản Candidate.
5. **Job Detail DTO Separation & Public Company Sanitization (Bảo vệ thông tin nhạy cảm công ty):**
   - Tách riêng `JobDetailDto` và `PublicCompanyDto`.
   - Tuyệt đối loại bỏ các thông tin nhạy cảm khỏi phản hồi cho ứng viên / khách vãng lai: không có `taxCode`, không có liên hệ người đại diện nội bộ, không có ghi chú xác thực của admin.
   - Chuẩn hóa URL website công ty (tự động bổ sung `https://` nếu thiếu).
   - Đảm bảo `isVerified` luôn là kiểu boolean rõ ràng và `logoUrl` trả về `null` thay vì placeholder không hợp lệ.
6. **Shared Notification API (API thông báo người dùng dùng chung):**
   - Lấy danh sách thông báo phân trang của tài khoản hiện tại, kèm `routeHint` an toàn (ví dụ: `/jobs/{id}`, `/applications/{id}`).
   - Lấy số lượng thông báo chưa đọc (`unread-count`).
   - Đánh dấu 1 thông báo là đã đọc (kiểm tra chặt quyền sở hữu tài khoản).
   - Đánh dấu tất cả thông báo là đã đọc (idempotent).

---

## 2. Danh sách endpoint mới hoặc đã sửa

| STT | Phương thức | Đường dẫn API | Phân loại | Mục đích |
| :--- | :--- | :--- | :--- | :--- |
| 1 | `GET` | `/api/v1/public/jobs` | **Đã sửa** | Tìm kiếm, lọc và sắp xếp tin tuyển dụng công khai cho khách / ứng viên |
| 2 | `GET` | `/api/v1/jobs` | **Đã sửa** | Tìm kiếm, lọc và sắp xếp tin tuyển dụng cho người dùng đã đăng nhập |
| 3 | `GET` | `/api/v1/jobs/{jobId}` | **Đã sửa** | Xem chi tiết tin tuyển dụng với DTO công ty được bảo mật |
| 4 | `GET` | `/api/v1/candidates/me/saved-jobs` | **Mới** | Lấy danh sách tin tuyển dụng đã lưu của Candidate (phân trang) |
| 5 | `POST` | `/api/v1/candidates/me/saved-jobs/{jobId}` | **Mới** | Lưu một tin tuyển dụng (Idempotent) |
| 6 | `DELETE` | `/api/v1/candidates/me/saved-jobs/{jobId}` | **Mới** | Bỏ lưu một tin tuyển dụng (Idempotent) |
| 7 | `GET` | `/api/v1/notifications` | **Mới** | Lấy danh sách thông báo của tài khoản hiện tại |
| 8 | `GET` | `/api/v1/notifications/unread-count` | **Mới** | Lấy số lượng thông báo chưa đọc |
| 9 | `POST` | `/api/v1/notifications/{notificationId}/read` | **Mới** | Đánh dấu 1 thông báo đã đọc |
| 10 | `POST` | `/api/v1/notifications/read-all` | **Mới** | Đánh dấu tất cả thông báo đã đọc |

---

## 3. Permission của từng endpoint

| Endpoint | Quyền / Role yêu cầu | Chi tiết cơ chế xác thực |
| :--- | :--- | :--- |
| `GET /api/v1/public/jobs` | **Public** | `AllowAnonymous()`. Không yêu cầu token. Cố định vai trò xem theo `CANDIDATE`. |
| `GET /api/v1/jobs` | **Authenticated** | `RequireAuthorization()`. Lọc hiển thị theo danh sách role trong JWT token. |
| `GET /api/v1/jobs/{jobId}` | **Public / Authenticated** | Cho phép xem công khai nếu `status == 'ACTIVE'`. Nếu tin chưa duyệt/từ chối/đóng thì yêu cầu quyền của doanh nghiệp sở hữu hoặc Internal HR/Admin. |
| `GET /api/v1/candidates/me/saved-jobs` | **Candidate** | `RequireAuthorization()` + `RequireRole("Candidate")`. |
| `POST /api/v1/candidates/me/saved-jobs/{jobId}` | **Candidate** | `RequireAuthorization()` + `RequireRole("Candidate")`. |
| `DELETE /api/v1/candidates/me/saved-jobs/{jobId}` | **Candidate** | `RequireAuthorization()` + `RequireRole("Candidate")`. |
| `GET /api/v1/notifications` | **Authenticated** | `RequireAuthorization()`. Tự động lấy `userId` từ claim `sub` / `nameid`. |
| `GET /api/v1/notifications/unread-count` | **Authenticated** | `RequireAuthorization()`. Lấy `userId` từ token. |
| `POST /api/v1/notifications/{notificationId}/read` | **Authenticated** | `RequireAuthorization()`. Chỉ đánh dấu nếu thông báo thuộc sở hữu của `userId` hiện tại. |
| `POST /api/v1/notifications/read-all` | **Authenticated** | `RequireAuthorization()`. Áp dụng cho tất cả thông báo của `userId` hiện tại. |

---

## 4. Request, Response, Mã lỗi nghiệp vụ & Thay đổi Contract cũ

### 4.1 Thay đổi Contract API cũ (Before vs After)

#### A. `GET /api/v1/public/jobs` & `GET /api/v1/jobs`
- **Trước đây (Before):**
  - **Query Params:** `page`, `pageSize`, `search`, `workLocation`, `employmentType`, `experienceLevel`, `salaryMin`, `salaryMax`, `skillIds`.
  - Không có tham số chọn sắp xếp. Mặc định luôn sort theo `CreatedAt DESC`.
  - Item trong danh sách không có hạn nộp và cờ khả dụng nhận hồ sơ.
- **Hiện tại (After):**
  - **Bổ sung Query Params:**
    - `sortBy`: Nhận giá trị `POSTED_AT` hoặc `SALARY` (Mặc định: `POSTED_AT`).
    - `sortDirection`: Nhận giá trị `DESC` hoặc `ASC` (Mặc định: `DESC`).
  - **Bổ sung thuộc tính trong từng Job Item:**
    ```json
    {
      "applicationDeadline": "2026-11-30T23:59:59Z", // string ISO 8601 UTC hoặc null
      "isAcceptingApplications": true                // boolean
    }
    ```

#### B. `GET /api/v1/jobs/{jobId}`
- **Trước đây (Before):**
  - Trả về đối tượng `company` đầy đủ (lộ mã số thuế `taxCode`, người tạo, các ghi chú nội bộ).
- **Hiện tại (After):**
  - Trả về `JobDetailDto` chứa `PublicCompanyDto` an toàn:
    ```json
    {
      "jobId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "title": "Senior Backend .NET Engineer",
      "applicationDeadline": "2026-11-30T23:59:59Z",
      "isAcceptingApplications": true,
      "company": {
        "companyId": "7cb4a261-2678-4bb9-9ff0-cfc3ef27c5bd",
        "companyName": "Công ty Công nghệ ABC",
        "logoUrl": null,
        "industry": "Công nghệ thông tin",
        "companySize": "100-499 nhân viên",
        "website": "https://abc-tech.vn",
        "address": "Tầng 5, Tòa nhà FPT, Quận Cầu Giấy, Hà Nội",
        "description": "Mô tả công ty...",
        "isVerified": true
      }
    }
    ```
  - **Lưu ý FE:** Đối tượng `company` không còn trường `taxCode`. `isVerified` luôn là kiểu `boolean`.

---

### 4.2 Chi tiết Request / Response của Endpoints Mới

#### 1. Lấy danh sách tin tuyển dụng đã lưu
- **Request:** `GET /api/v1/candidates/me/saved-jobs?page=1&pageSize=10`
  - Header: `Authorization: Bearer <Candidate_JWT_Token>`
- **Response 200 OK:**
  ```json
  {
    "items": [
      {
        "savedJobId": "c4b12345-0000-0000-0000-000000000001",
        "jobId": "a1b2c3d4-1111-2222-3333-444455556666",
        "savedAt": "2026-10-13T01:00:00Z",
        "title": "Senior .NET Developer",
        "workLocation": "HYBRID",
        "city": "Hồ Chí Minh",
        "employmentType": "FULL_TIME",
        "experienceLevel": "SENIOR",
        "salaryMin": 25000000,
        "salaryMax": 45000000,
        "currency": "VND",
        "postedAt": "2026-10-10T08:00:00Z",
        "applicationDeadline": "2026-10-31T23:59:59Z",
        "status": "ACTIVE",
        "isAcceptingApplications": true,
        "company": {
          "companyId": "99999999-aaaa-bbbb-cccc-dddddddddddd",
          "companyName": "FPT Software",
          "logoUrl": null,
          "isVerified": true
        },
        "skills": ["C#", ".NET Core", "PostgreSQL", "Docker"]
      }
    ],
    "page": 1,
    "pageSize": 10,
    "totalCount": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrevious": false
  }
  ```

#### 2. Lưu tin tuyển dụng (Idempotent)
- **Request:** `POST /api/v1/candidates/me/saved-jobs/{jobId}`
  - Header: `Authorization: Bearer <Candidate_JWT_Token>`
- **Response 200 OK:**
  ```json
  {
    "message": "Đã lưu công việc thành công."
  }
  ```

#### 3. Bỏ lưu tin tuyển dụng (Idempotent)
- **Request:** `DELETE /api/v1/candidates/me/saved-jobs/{jobId}`
  - Header: `Authorization: Bearer <Candidate_JWT_Token>`
- **Response 200 OK:**
  ```json
  {
    "message": "Đã hủy lưu công việc thành công."
  }
  ```

#### 4. Danh sách thông báo
- **Request:** `GET /api/v1/notifications?page=1&pageSize=10`
  - Header: `Authorization: Bearer <JWT_Token>`
- **Response 200 OK:**
  ```json
  {
    "items": [
      {
        "notificationId": "f1e2d3c4-aaaa-bbbb-cccc-111122223333",
        "title": "Hồ sơ ứng tuyển",
        "message": "Hồ sơ ứng tuyển của bạn tại Công ty ABC đã được chuyển sang bước Phỏng vấn.",
        "type": "APPLICATION_UPDATE",
        "isRead": false,
        "createdAt": "2026-10-13T01:15:00Z",
        "readAt": null,
        "referenceId": "app-guid-here",
        "referenceType": "APPLICATION",
        "routeHint": "/applications/app-guid-here"
      }
    ],
    "page": 1,
    "pageSize": 10,
    "totalCount": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrevious": false
  }
  ```

#### 5. Số lượng thông báo chưa đọc
- **Request:** `GET /api/v1/notifications/unread-count`
  - Header: `Authorization: Bearer <JWT_Token>`
- **Response 200 OK:**
  ```json
  {
    "unreadCount": 3
  }
  ```

#### 6. Đánh dấu đã đọc 1 thông báo
- **Request:** `POST /api/v1/notifications/{notificationId}/read`
- **Response 200 OK:**
  ```json
  {
    "message": "Đã đánh dấu thông báo là đã đọc."
  }
  ```

#### 7. Đánh dấu tất cả thông báo đã đọc
- **Request:** `POST /api/v1/notifications/read-all`
- **Response 200 OK:**
  ```json
  {
    "message": "Đã đánh dấu tất cả thông báo là đã đọc."
  }
  ```

---

### 4.3 Các mã lỗi nghiệp vụ (Business Errors)

| Mã HTTP | Tình huống | Message trả về từ Backend |
| :--- | :--- | :--- |
| `400 Bad Request` | Truyền `sortBy` không hợp lệ | `Trường sắp xếp chỉ hỗ trợ POSTED_AT hoặc SALARY.` |
| `400 Bad Request` | Truyền `sortDirection` không hợp lệ | `Chiều sắp xếp chỉ hỗ trợ DESC hoặc ASC.` |
| `400 Bad Request` | Tạo/Cập nhật Job với hạn nộp trong quá khứ | `Hạn nộp hồ sơ phải sau thời điểm hiện tại.` |
| `400 Bad Request` | Candidate ứng tuyển Job đã hết hạn | `Công việc đã hết hạn nhận hồ sơ, không thể ứng tuyển.` |
| `400 Bad Request` | Affiliate nộp hồ sơ cho Job đã hết hạn | `Công việc đã hết hạn nhận hồ sơ, không thể giới thiệu ứng viên.` |
| `401 Unauthorized` | Không gửi Bearer token | `Bạn chưa đăng nhập hoặc token truy cập không hợp lệ.` |
| `403 Forbidden` | Tài khoản không có role Candidate | `Bạn không có quyền thực hiện chức năng này.` |
| `404 Not Found` | Không tìm thấy Job khi xem chi tiết hoặc lưu tin | `Không tìm thấy công việc tuyển dụng.` |
| `404 Not Found` | Thông báo không tồn tại hoặc không thuộc sở hữu của user | `Không tìm thấy thông báo hoặc bạn không có quyền truy cập thông báo này.` |

---

## 5. Các trạng thái FE cần xử lý

```
+-------------------------------------------------------------------------------------------------------+
| Nút Ứng Tuyển / Nộp Hồ Sơ                                                                             |
|                                                                                                       |
| [isAcceptingApplications == true]  --> Hiển thị nút "Ứng tuyển ngay" (Enabled, màu nổi bật)          |
| [isAcceptingApplications == false] --> Hiển thị nút bị Disable kèm Badge: "Đã hết hạn nhận hồ sơ"      |
+-------------------------------------------------------------------------------------------------------+

+-------------------------------------------------------------------------------------------------------+
| Bookmark / Lưu tin Tuyển dụng                                                                        |
|                                                                                                       |
| [Chưa lưu] -> Click icon Bookmark -> Gọi POST /saved-jobs/{id} -> Đổi icon Active                     |
| [Đã lưu]   -> Click icon Bookmark -> Gọi DELETE /saved-jobs/{id} -> Đổi icon Outline                  |
| * Cả 2 API đều Idempotent -> FE có thể áp dụng Optimistic Update ngay lập tức mà không lo lỗi đúp      |
+-------------------------------------------------------------------------------------------------------+

+-------------------------------------------------------------------------------------------------------+
| Sắp xếp danh sách (Sort Dropdown)                                                                     |
|                                                                                                       |
| Mới nhất:      sortBy=POSTED_AT & sortDirection=DESC (Mặc định)                                       |
| Cũ nhất:       sortBy=POSTED_AT & sortDirection=ASC                                                  |
| Lương cao nhất: sortBy=SALARY    & sortDirection=DESC                                                  |
| Lương thấp nhất: sortBy=SALARY    & sortDirection=ASC                                                  |
+-------------------------------------------------------------------------------------------------------+

+-------------------------------------------------------------------------------------------------------+
| Bell Notification & Read States                                                                       |
|                                                                                                       |
| [unreadCount > 0]  --> Hiển thị chấm đỏ với con số unreadCount                                        |
| [unreadCount == 0] --> Ẩn badge chấm đỏ                                                               |
| [Click item]       --> Gọi POST /notifications/{id}/read -> Chuyển route sang routeHint               |
| [Đọc tất cả]       --> Gọi POST /notifications/read-all -> Set unreadCount = 0 & cập nhật giao diện   |
+-------------------------------------------------------------------------------------------------------+
```

---

## 6. Migration hoặc biến môi trường mới

### 6.1 Database Migration
- **Tên file migration:** `20261013020000_AddCandidateSavedJobsAndApplicationDeadline.cs`
- **Nội dung thay đổi:**
  - Bổ sung cột `application_deadline timestamptz NULL` vào bảng `job`.
  - Tạo partial index `idx_job_active_deadline` trên `(status, application_deadline)` với điều kiện `status = 'ACTIVE'`.
  - Tạo bảng mới `candidate_saved_job`:
    - `candidate_saved_job_id` (`uuid`, PK)
    - `candidate_id` (`uuid`, FK -> `candidate(candidate_id)` ON DELETE CASCADE)
    - `job_id` (`uuid`, FK -> `job(job_id)` ON DELETE CASCADE)
    - `created_at` (`timestamptz`)
    - Unique Constraint / Index: `uq_candidate_saved_job` trên `(candidate_id, job_id)`.

### 6.2 Biến môi trường
- **Không có** biến môi trường mới nào cần cấu hình thêm.

---

## 7. Swagger đã cập nhật đầy đủ chưa

- **Trạng thái:** **ĐÃ CẬP NHẬT ĐẦY ĐỦ 100%**.
- Endpoint `GET /swagger/v1/swagger.json` trả về HTTP 200 OK (518.6 KB).
- Tất cả endpoint mới và đã sửa đều có đầy đủ:
  - OpenAPI Tags có thứ tự rõ ràng (`Public Jobs`, `Candidate Saved Jobs`, `Notifications`, v.v.).
  - Schema mẫu request và response phân loại theo từng status code: 200, 400, 401, 403, 404.
  - Đã khắc phục triệt để lỗi Schema ID Collision giữa `JobDetailDto` và module Offer.

---

## 8. Test đã chạy và kết quả

- **Công cụ kiểm thử:** xUnit, FluentAssertions, Moq.
- **Tổng số Unit Tests:** **1,345 tests**.
- **Kết quả:**
  ```text
  Test run for D:\0-FPT\Capstone\code\BE\hr-connect\HRConnect\HRConnect.UnitTests\bin\Debug\net8.0\HRConnect.UnitTests.dll (.NETCoreApp,Version=v8.0)
  Passed!  - Failed: 0, Passed: 1345, Skipped: 0, Total: 1345, Duration: 27 s
  ```
- **Các bộ kiểm thử mới bổ sung:**
  1. `CandidateJobQueryEnhancementTests.cs`: Kiểm tra whitelist sort, salary sort fallback, tính toán deadline và ẩn dữ liệu nhạy cảm của công ty.
  2. `CandidateSavedJobsTests.cs`: Kiểm tra lưu tin idempotent, hủy lưu tin, phân trang và cấm lưu tin không khả dụng.
  3. `NotificationFeatureTests.cs`: Kiểm tra lấy danh sách, tính số lượng chưa đọc, route hints, đánh dấu đọc đơn lẻ và đọc hàng loạt.

---

## 9. Tên nhánh cùng commit đã push

- **Tên nhánh Git:** `feature/mf01-candidate-backend-enhancements`
- **Commit hash mới nhất:** `ba283ea0fff5cd3c80507b27910af4c8abcd3a94`
- **Pull Request URL:** `https://github.com/hoangqui794/hr-connect/pull/new/feature/mf01-candidate-backend-enhancements`

---

## 10. Phần còn thiếu, giới hạn hoặc lưu ý khi FE tích hợp

1. **Hiển thị Avatar / Logo Công ty (`logoUrl`):**
   - Nếu công ty chưa cập nhật logo, trường `logoUrl` sẽ trả về `null`. FE cần chuẩn bị sẵn icon hoặc component chữ viết tắt làm placeholder mặc định, tránh để ảnh lỗi vỡ hình.
2. **Chuẩn hóa URL Website Công ty (`website`):**
   - Backend đã chuẩn hóa URL (nếu người dùng nhập `company.vn`, backend sẽ trả về `https://company.vn`). FE có thể gán trực tiếp vào thuộc tính `href` của thẻ `<a>` mà không sợ lỗi tương đối.
3. **Múi giờ Hạn nộp hồ sơ (`applicationDeadline`):**
   - Giá trị trả về dưới định dạng chuẩn ISO 8601 UTC (ví dụ: `2026-11-30T16:59:59Z`). FE nên dùng thư viện (`dayjs`, `date-fns` hoặc `Intl.DateTimeFormat`) để format sang giờ Việt Nam (UTC+7, `vi-VN`) khi hiển thị: ví dụ `"23:59 ngày 30/11/2026"`.
4. **Idempotent Bookmark:**
   - Khi lưu hoặc hủy lưu tin, cả 2 API đều trả về 200 OK ngay cả khi thực hiện lại thao tác trước đó. FE hoàn toàn có thể kích hoạt Optimistic UI ngay khi người dùng click mà không lo lỗi xung đột dữ liệu.
5. **Điều hướng từ Thông báo (`routeHint`):**
   - Mỗi thông báo trả về một `routeHint` (ví dụ: `/applications/a1b2c3d4-...` hoặc `/jobs/3fa85f64-...`). FE nên tận dụng trường này để đưa thẳng người dùng đến đúng màn hình tương ứng khi bấm vào thông báo.
