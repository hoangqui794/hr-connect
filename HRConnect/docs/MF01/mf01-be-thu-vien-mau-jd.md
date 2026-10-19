# MF-01 (Backend): thư viện mẫu JD

> **Phạm vi:** Backend MF-01 (Job). Phần giao diện xem [`JOB-TEMPLATES.md`](../../../HRConnect-FE/docs/integration/MF01/JOB-TEMPLATES.md).
> **Ngày:** 2026-10-15.
> **Hiện trạng** được đối chiếu với code trên `main` ngày 15/10: chưa có bảng, API hay seed nào về mẫu JD. Tài liệu nghiệp vụ (`main-flows.md`) cũng chưa nhắc tới.

> **Trạng thái 19/10:** B1–B7 đã có code và test (`JobTemplateFeatures`, `JobTemplateTests`). Lỗi bộ đếm lượt dùng luôn 0 (N19) đã sửa: form tạo job không gửi `templateId`. B8 để giai đoạn 2. File giữ lại vì code và trang Cài đặt Admin trích dẫn làm nguồn đặc tả.

Ký hiệu: 🔴 làm trước · 🟠 cần làm · ⚪ để giai đoạn 2, chưa làm.

---

## Ý tưởng chính

Hiện Client phải tự gõ toàn bộ JD ở bước 2 của form tạo job. Ta thêm **thư viện mẫu JD dùng chung** do Internal HR và Admin quản lý:

```
Client gõ từ khóa (".net", "marketing", "kế toán")
        │  GET /job-templates?keyword=...
        ▼
Danh sách mẫu khớp (tên, ngành, cấp bậc, tóm tắt)
        │  Client xem trước, bấm "Dùng mẫu này"
        ▼
GET /job-templates/{id} → giao diện điền sẵn form, Client sửa tùy ý
        │  POST /jobs (kèm templateId để thống kê)
        ▼
Job đi qua luồng gửi duyệt và Internal HR duyệt như bình thường
```

Nguyên tắc:
- **Mẫu chỉ là bản nháp.** Job tạo từ mẫu là bản sao độc lập. Sửa hay ẩn mẫu sau này **không** làm thay đổi các job đã tạo.
- **Mẫu không chứa số liệu riêng của từng Client:** không có lương, địa điểm, số lượng, hạn nộp hồ sơ hay phí dịch vụ. Client tự nhập các trường này.
- Giai đoạn đầu **chỉ có mẫu chung**. Client chưa được tự lưu mẫu riêng.
- Giai đoạn 2 (chưa làm): khi không tìm thấy mẫu, AI viết nháp JD (xem mục B8).

---

## B1. 🔴 Bảng `job_template`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `template_id` | uuid PK | |
| `code` | varchar(80) unique | Ví dụ `IT_BACKEND_DOTNET`. Dùng cho seed và đối chiếu |
| `name` | varchar(200) not null | Tên hiển thị, ví dụ "Lập trình viên Backend .NET" |
| `industry` | varchar(80) not null | Ví dụ `IT`, `MARKETING`, `SALES`, `ACCOUNTING`, `HR`, `ADMIN` |
| `level` | varchar(40) null | `INTERN`, `JUNIOR`, `MIDDLE`, `SENIOR`, `LEAD` |
| `keywords` | text null | Từ khóa phụ, cách nhau bằng dấu phẩy: "dotnet, c#, asp.net core, backend" |
| `summary` | varchar(500) null | 1 đến 2 câu hiện trong danh sách kết quả |
| `title` | varchar(255) not null | Gợi ý tên vị trí cho job |
| `description` | text not null | Mô tả công việc |
| `benefits` | text null | Quyền lợi gợi ý |
| `employment_type` | varchar(50) null | Cùng bộ giá trị với `job.employment_type` |
| `min_experience_years` | int null | |
| `max_experience_years` | int null | |
| `search_text` | text not null | Cột tìm kiếm do code tự tính: `name + title + keywords + industry`, đã **bỏ dấu tiếng Việt và viết thường** |
| `is_active` | bool not null default true | Ẩn hoặc hiện mẫu, không xóa cứng |
| `usage_count` | int not null default 0 | Số job đã tạo từ mẫu này |
| `created_at`, `updated_at` | timestamptz | |
| `created_by`, `updated_by` | uuid null | FK `user` |

Bảng con **`job_template_requirement`**, có cùng cấu trúc với `job_requirement` để giao diện đổ thẳng vào form:

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `template_requirement_id` | uuid PK | |
| `template_id` | uuid FK, xóa theo mẫu | |
| `requirement_type` | varchar(20) | `MUST_HAVE` / `SHOULD_HAVE` |
| `category` | varchar(120) null | Ví dụ `EXPERIENCE`, `SKILL`, `EDUCATION`. **`SKILL` là kỹ năng**, giao diện hiện ở ô "Kỹ năng chính" |
| `content` | varchar(4000) not null | |
| `display_order` | int | |

Thêm cột **`job.template_id`** (uuid null, FK `job_template`, `ON DELETE SET NULL`) để biết job nào được tạo từ mẫu nào.

Migration làm theo chuẩn: tạo bằng `dotnet ef migrations add AddJobTemplates`, có `.Designer.cs` và cập nhật snapshot. Sau đó chạy `dotnet ef migrations has-pending-model-changes` phải ra "No changes".

---

## B2. 🔴 API tìm mẫu (Client dùng)

`GET /api/v1/job-templates?keyword=&industry=&page=1&pageSize=`

- Quyền: `job.create` (Client), `job.review` (Internal HR, Admin).
- Chỉ trả mẫu có `is_active = true`.
- **Tìm kiếm:** bỏ dấu và viết thường `keyword`, rồi tìm theo `search_text` (`ILIKE %từ%`). Từ khóa có nhiều từ thì **mọi từ đều phải khớp**. Ví dụ "ke toan tong hop" khớp mẫu "Kế toán tổng hợp".
- `keyword` rỗng thì trả các mẫu dùng nhiều nhất, sắp theo `usage_count` giảm dần.
- Sắp xếp: khớp ở `name` lên trước, sau đó theo `usage_count`.
- `pageSize` mặc định và tối đa đọc từ **BusinessSettings**. Thêm key `mf01.job_template.page_size_default` (8) và `mf01.job_template.page_size_max` (20). Không ghi cứng trong code.

Response, dạng rút gọn để hiện danh sách:

```json
{
  "items": [
    {
      "templateId": "…", "code": "IT_BACKEND_DOTNET",
      "name": "Lập trình viên Backend .NET", "industry": "IT", "level": "MIDDLE",
      "summary": "Xây dựng API ASP.NET Core, làm việc với SQL Server và hệ thống phân tán.",
      "requirementCount": 7, "usageCount": 12
    }
  ],
  "page": 1, "pageSize": 8, "totalCount": 3, "totalPages": 1
}
```

## B3. 🔴 API xem chi tiết mẫu

`GET /api/v1/job-templates/{templateId}`, quyền như B2. Mẫu đã ẩn trả 404 với Client. Internal HR và Admin vẫn xem được.

```json
{
  "templateId": "…", "code": "IT_BACKEND_DOTNET", "name": "Lập trình viên Backend .NET",
  "industry": "IT", "level": "MIDDLE", "keywords": "dotnet, c#, asp.net core",
  "summary": "…",
  "title": "Lập trình viên Backend .NET (Middle)",
  "description": "…", "benefits": "…",
  "employmentType": "FULL_TIME", "minExperienceYears": 2, "maxExperienceYears": 5,
  "requirements": [
    { "requirementType": "MUST_HAVE", "category": "EXPERIENCE", "content": "Ít nhất 2 năm kinh nghiệm C# và ASP.NET Core" },
    { "requirementType": "SHOULD_HAVE", "category": "SKILL", "content": "Docker" }
  ],
  "isActive": true, "usageCount": 12, "updatedAt": "…"
}
```

## B4. 🟠 Ghi nhận job tạo từ mẫu

- `CreateJobCommand` thêm trường không bắt buộc **`templateId`**.
- Khi tạo job: nếu `templateId` có giá trị và mẫu tồn tại thì lưu `job.template_id` và **tăng `usage_count` của mẫu thêm 1**. Mẫu không tồn tại thì bỏ qua và **không báo lỗi**, vì việc tạo job không được hỏng chỉ vì thống kê.
- Backend **không tự chép nội dung mẫu vào job**. Giao diện gửi nội dung (đã được Client sửa) như một job bình thường.
- `JobDto` trả thêm `templateId` để HR biết job tạo từ mẫu nào.

## B5. 🟠 API quản lý mẫu (Internal HR, Admin)

Quyền mới **`job_template.manage`**, cấp cho `INTERNAL_HR` và `PLATFORM_ADMIN` trong migration seed quyền. Không cấp cho Client.

| Method | Route | Việc |
|---|---|---|
| `GET` | `/api/v1/internal/job-templates?keyword=&industry=&isActive=` | Danh sách, gồm cả mẫu đã ẩn |
| `POST` | `/api/v1/internal/job-templates` | Tạo mẫu kèm danh sách yêu cầu |
| `PUT` | `/api/v1/internal/job-templates/{id}` | Sửa, ghi đè toàn bộ danh sách yêu cầu. Dùng `concurrencyToken` như job |
| `POST` | `/api/v1/internal/job-templates/{id}/deactivate` | Ẩn mẫu |
| `POST` | `/api/v1/internal/job-templates/{id}/activate` | Hiện lại mẫu |

Kiểm tra dữ liệu (FluentValidation):
- `code` không trùng, chỉ gồm `A-Z 0-9 _`.
- `name`, `title`, `description` không rỗng.
- Có **ít nhất 1 yêu cầu `MUST_HAVE`**, giống điều kiện gửi duyệt job.
- `requirementType` thuộc `MUST_HAVE`/`SHOULD_HAVE`. Độ dài theo bảng B1.
- `minExperienceYears ≤ maxExperienceYears`.

Mã lỗi: `TEMPLATE_CODE_DUPLICATE`, `TEMPLATE_NOT_FOUND`, `TEMPLATE_MUST_HAVE_REQUIRED`. Sai `concurrencyToken` thì trả **409**, giống job. API quản lý trả kèm `concurrencyToken` trong chi tiết mẫu, để giao diện gửi lại khi sửa. Cần thêm cột `concurrency_token` (uuid) vào bảng ở B1.

**Audit log:** ghi lại thao tác tạo, sửa, ẩn và hiện mẫu, kèm người làm, giống các thao tác job.

## B6. 🟠 Seed 13 mẫu ban đầu

Thêm `JobTemplateSeeder` gọi từ `DatabaseSeeder`. Seed **idempotent theo `code`**: đã có `code` thì không tạo lại và không ghi đè chỗ HR đã sửa.

| Ngành | `code` | Tên |
|---|---|---|
| IT | `IT_BACKEND_DOTNET` | Lập trình viên Backend .NET |
| IT | `IT_FRONTEND_REACT` | Lập trình viên Frontend ReactJS |
| IT | `IT_FULLSTACK` | Lập trình viên Fullstack |
| IT | `IT_QA_TESTER` | Kiểm thử phần mềm (QA/Tester) |
| IT | `IT_DATA_ANALYST` | Chuyên viên phân tích dữ liệu |
| Marketing | `MKT_CONTENT` | Chuyên viên Content Marketing |
| Marketing | `MKT_DIGITAL` | Chuyên viên Digital / Performance Marketing |
| Marketing | `MKT_MARCOM` | Chuyên viên Marketing & Communication |
| Kinh doanh | `SALES_B2B` | Nhân viên kinh doanh B2B |
| Kinh doanh | `SALES_CS` | Nhân viên chăm sóc khách hàng |
| Kế toán | `ACC_GENERAL` | Kế toán tổng hợp |
| Nhân sự | `HR_RECRUITER` | Chuyên viên tuyển dụng |
| Hành chính | `ADMIN_OFFICE` | Nhân viên hành chính văn phòng |

Cách viết yêu cầu trong mẫu, để **AI chấm CV chính xác hơn**:
- Mỗi yêu cầu **một ý**, đo được. Viết "Ít nhất 2 năm kinh nghiệm C# và ASP.NET Core", không viết "Có kinh nghiệm lập trình tốt".
- Yêu cầu về số năm đặt `category = EXPERIENCE`, kỹ năng đặt `category = SKILL`.
- Mỗi mẫu có 3 đến 5 `MUST_HAVE` và 2 đến 5 `SHOULD_HAVE`.
- Nội dung bằng tiếng Việt, tên công nghệ giữ nguyên tiếng Anh.

Nội dung chi tiết từng mẫu do nhóm soạn. Có thể tham khảo JD thật trên TopCV hoặc ITviec, nhưng viết lại, **không chép nguyên văn**.

## B7. 🟠 Test

Unit test:
- Tìm "ke toan" (không dấu) ra "Kế toán tổng hợp". Tìm "react" ra các mẫu Frontend và Fullstack.
- Mẫu đã ẩn không hiện với Client, nhưng HR vẫn thấy.
- Tạo job kèm `templateId` thì `usage_count` tăng 1. Gửi `templateId` sai thì job vẫn tạo được.
- Client gọi API quản lý mẫu thì nhận 403.
- Tạo mẫu không có `MUST_HAVE` thì nhận lỗi `TEMPLATE_MUST_HAVE_REQUIRED`.
- Seed chạy hai lần không tạo bản trùng.

## B8. ⚪ Giai đoạn 2: AI viết nháp JD (chưa làm)

Khi Client tìm không ra mẫu khớp, giao diện hiện nút "Để AI viết nháp". Dự kiến:
- `POST /api/v1/job-templates/ai-draft` với `{ "positionName": "...", "notes": "..." }`. Kết quả trả về **cùng cấu trúc với B3** để giao diện dùng lại phần điền form.
- Gọi LLM qua `ai-service-v2`, dùng model và quota riêng để **không ăn vào quota chấm CV**.
- Giới hạn số lần mỗi Client mỗi ngày, đọc từ BusinessSettings.
- Bản nháp được HR xem lại và có thể "Lưu thành mẫu" để làm giàu thư viện.

Phần này sẽ có tài liệu riêng khi bắt đầu làm.

---

## Tiêu chí nghiệm thu backend

1. `GET /job-templates?keyword=net` trả về mẫu .NET. Tìm không dấu vẫn ra.
2. Client không thấy mẫu đã ẩn và không gọi được API quản lý mẫu.
3. Job tạo kèm `templateId` lưu `template_id`, mẫu tăng `usage_count`. `templateId` sai không làm hỏng việc tạo job.
4. Sửa hoặc ẩn mẫu không làm đổi nội dung các job đã tạo.
5. Có đủ 13 mẫu seed, mỗi mẫu có ít nhất 1 `MUST_HAVE`. Seed lại không tạo bản trùng.
6. Kích thước trang lấy từ BusinessSettings.
7. Migration có `.Designer.cs`, snapshot đồng bộ (`has-pending-model-changes` ra "No changes"), toàn bộ test pass.

## Thứ tự gợi ý

B1 → B6 (seed để có dữ liệu thật) → B2 + B3 (Frontend bắt đầu tích hợp được) → B4 → B5 → B7.
