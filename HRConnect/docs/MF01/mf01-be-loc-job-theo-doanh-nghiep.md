# MF-01 Backend: Lọc Job theo doanh nghiệp

> **Trạng thái:** Chưa triển khai  
> **Phạm vi:** Backend MF-01  
> **Mức ưu tiên:** Trung bình  
> **Có thể làm độc lập:** Có. Không cần chờ bảng ngành hoặc danh bạ doanh nghiệp.

## 1. Mục tiêu

Bổ sung bộ lọc chính xác theo `companyId` cho API tìm việc hiện có để Frontend có thể hiển thị toàn bộ Job của một doanh nghiệp cụ thể.

Không tạo API danh sách Job mới. Hai API hiện tại dùng chung bộ lọc:

```http
GET /api/v1/public/jobs?companyId={companyId}
GET /api/v1/jobs?companyId={companyId}
```

## 2. Hiện trạng

- Response danh sách Job đã có `companyId` và `companyName`.
- Tham số `search` hiện tìm trong tiêu đề, mô tả, tên doanh nghiệp và kỹ năng.
- Chưa có query parameter `companyId`, vì vậy FE chỉ có thể tìm gần đúng bằng tên doanh nghiệp.
- `GET /api/v1/jobs/mine` đã tự giới hạn theo doanh nghiệp của Client đang đăng nhập.
- Quyền xem Job đang được giới hạn theo role và cấu hình `service_type_allowed_role`.

Tìm bằng tên doanh nghiệp không thay thế được lọc theo ID vì tên có thể trùng, gần giống nhau hoặc được thay đổi.

## 3. Hợp đồng API cần bổ sung

Thêm query parameter tùy chọn:

| Tên | Kiểu | Bắt buộc | Ý nghĩa |
|---|---|---:|---|
| `companyId` | `Guid?` | Không | Chỉ trả Job thuộc đúng doanh nghiệp này |

### 3.1. Guest

```http
GET /api/v1/public/jobs?companyId=30000000-0000-0000-0000-000000000001&page=1&pageSize=20
```

Guest vẫn chỉ nhận:

- Job có trạng thái `ACTIVE`.
- Job thuộc Service Type mà role `CANDIDATE` có `can_view = true`.
- Các kết quả thỏa toàn bộ bộ lọc khác nếu được truyền cùng lúc.

### 3.2. Người dùng đã đăng nhập

```http
GET /api/v1/jobs?companyId=30000000-0000-0000-0000-000000000001&page=1&pageSize=20
```

Kết quả vẫn phải áp dụng quyền xem theo role thật của người gọi. Ví dụ Affiliate không được nhìn thấy Job thuộc Service Type mà Affiliate không có `can_view` chỉ vì đã truyền đúng `companyId`.

### 3.3. Quy ước kết quả

- `companyId` hợp lệ nhưng không tồn tại: trả trang rỗng với `totalCount = 0`, không trả `404`.
- `companyId` tồn tại nhưng không có Job người gọi được phép xem: trả trang rỗng.
- Giá trị không đúng định dạng UUID: trả `400 Bad Request` theo chuẩn binding/validation hiện có.
- Có thể kết hợp `companyId` với `search`, `location`, `employmentType`, `serviceTypeId`, khoảng lương, sắp xếp và phân trang.

## 4. Quy tắc không được thay đổi

1. Không bỏ điều kiện `Job.Status == ACTIVE` ở API khám phá Job.
2. Không bỏ kiểm tra quyền xem theo `service_type_allowed_role`.
3. Không nhận `companyId` từ Client để thay đổi phạm vi của `GET /api/v1/jobs/mine`; endpoint này luôn lấy `CompanyId` từ membership của tài khoản.
4. Không trả dữ liệu nội bộ của doanh nghiệp như mã số thuế, người dùng công ty hoặc điều khoản thương mại qua API public.
5. Không thay đổi ý nghĩa của `search`; tìm theo tên doanh nghiệp hiện tại vẫn được giữ lại.

## 5. Vị trí dự kiến cần chỉnh sửa

| Thành phần | Thay đổi |
|---|---|
| `JobEndpoints.cs` | Nhận `Guid? companyId` ở `GET /public/jobs` và `GET /jobs`, sau đó truyền vào query |
| `GetPublicJobsQuery.cs` | Thêm thuộc tính `CompanyId` vào request |
| `IJobRepository.GetVisibleJobsAsync` | Thêm tham số `companyId` |
| `JobRepository.GetVisibleJobsAsync` | Khi có giá trị, thêm điều kiện `job.CompanyId == companyId.Value` trước khi đếm và phân trang |
| Swagger | Mô tả rõ bộ lọc và quy tắc quyền theo role |
| Unit tests | Cập nhật mock/signature và bổ sung các ca nghiệm thu bên dưới |

Trước khi tạo migration, kiểm tra index hiện có trên khóa ngoại `job.company_id`. Chỉ thêm migration/index nếu database thực tế chưa có index phù hợp; thay đổi bộ lọc này không yêu cầu thay đổi schema trong trường hợp index đã tồn tại.

## 6. Ca kiểm thử bắt buộc

1. Không truyền `companyId`: kết quả giữ nguyên như trước khi sửa.
2. Truyền ID công ty A: chỉ trả Job của công ty A.
3. Truyền ID công ty không tồn tại: HTTP `200`, `items = []`, `totalCount = 0`.
4. Guest lọc công ty có cả `CV_APPLICATION` và Job dành cho Affiliate: chỉ nhận Job Candidate được phép xem.
5. Affiliate lọc cùng công ty: chỉ nhận Job thuộc Service Type Affiliate được phép xem.
6. Internal HR/Admin có quyền nội bộ: giữ đúng cơ chế bypass hiện tại.
7. Kết hợp `companyId` và `location`: kết quả phải thỏa cả hai điều kiện.
8. Kết hợp `companyId` với phân trang và sắp xếp: `totalCount` chỉ tính trong phạm vi doanh nghiệp đã lọc.
9. `GET /api/v1/jobs/mine` vẫn chỉ trả Job của doanh nghiệp gắn với tài khoản Client.
10. Toàn bộ test cũ của `GetPublicJobsQuery` và Job endpoints vẫn đạt.

## 7. Điều kiện hoàn thành

- Hai API danh sách Job nhận được `companyId` tùy chọn.
- Swagger hiển thị tham số và mô tả quyền rõ ràng.
- Không có đường vòng làm lộ Job sai role hoặc sai Service Type.
- Unit test mới và toàn bộ Backend test đều đạt.
- Không tạo endpoint trùng chức năng.
- Sau khi merge Backend, bàn giao FE bổ sung `companyId?: string` vào `JobSearchParams` và truyền tham số khi người dùng chọn “Xem việc làm của doanh nghiệp”.

## 8. Liên quan

Yêu cầu này là phần nhỏ có thể triển khai độc lập trong backlog lớn về bảng ngành, danh bạ công ty và lọc Job tại [`../tasks/BE-tasks-02-nganh-danh-ba-cong-ty-loc-job.md`](../tasks/BE-tasks-02-nganh-danh-ba-cong-ty-loc-job.md).
