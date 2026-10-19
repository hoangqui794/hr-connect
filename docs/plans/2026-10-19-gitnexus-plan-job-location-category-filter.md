# GitNexus Engineering Plan — MF01 Job Discovery theo địa điểm, lĩnh vực và chuyên môn

> Task: thay kế hoạch lọc Job theo doanh nghiệp bằng bộ lọc Job theo địa điểm, lĩnh vực công việc, chuyên môn và kỹ năng; đồng thời cập nhật đầy đủ luồng tạo, sửa, gửi duyệt và xem Job.
>
> Evidence verified at commit `0fb87203682def5cfb7bb3246bd99d2879751358`. GitNexus index chậm 28 commits và lần refresh thất bại ở parse-worker startup, vì vậy các kết luận quan trọng đều đã đối chiếu trực tiếp với source hiện tại.
>
> Phạm vi: Backend MF01 và tài liệu bàn giao FE. Không triển khai UI trong nhánh Backend.

## 1. Mục tiêu sản phẩm

Candidate và Affiliate tìm Job theo ba tầng:

1. **Lĩnh vực**: nhóm lớn, ví dụ `CNTT & Phần mềm`, `Kinh doanh & Marketing`.
2. **Chuyên môn**: nhóm công việc bên trong lĩnh vực, ví dụ `Backend`, `Frontend`, `Mobile`, `DevOps`, `Data & AI`.
3. **Kỹ năng/công nghệ**: Java, .NET, Python, React, Flutter...

Ví dụ: `CNTT & Phần mềm` trả các Job IT; thêm `Backend` chỉ còn Backend; thêm từ khóa `Java` chỉ còn Job Backend có Java; thêm `Hồ Chí Minh` tiếp tục thu hẹp. Tất cả vẫn tuân thủ Job `ACTIVE` và quyền `can_view` theo Service Type.

Không dùng `Company.Industry` phân loại Job. Một công ty công nghệ vẫn có thể tuyển Kế toán hoặc HR. Java/.NET/Python là kỹ năng, không phải ngành.

## 2. Hiện trạng và khoảng trống

### Đã có

- `[verified]` `Job.Location` và filter `location` đã có end-to-end.
- `[verified]` `JobRepository.GetVisibleJobsAsync` áp location bằng PostgreSQL `ILIKE` trước count/sort/page.
- `[verified]` Job có quan hệ Skill; keyword tìm trong title, description, company name và skill name.
- `[verified]` Hai API list là `GET /api/v1/public/jobs` và `GET /api/v1/jobs`.

### Chưa có

- `[verified]` `Job` chưa có lĩnh vực/chuyên môn riêng.
- `[verified]` `Company.Industry` là ngành doanh nghiệp, không đại diện từng vị trí.
- `[verified]` `JobTemplate.Industry` không đủ vì template là tùy chọn.
- `[verified]` `Skill.Category` chỉ là loại kỹ năng như Programming Language/Framework/Database.
- `[verified]` Main chưa có `companyId` filter; yêu cầu này chỉ nằm trong tài liệu cũ nên không cần deprecate API.

Kết luận: DB đủ cho location hiện tại nhưng cần taxonomy Job hai cấp.

## 3. Thiết kế database

### 3.1 Bảng `job_field`

| Cột | Kiểu | Ràng buộc |
| --- | --- | --- |
| `job_field_id` | UUID | PK |
| `code` | varchar(64) | NOT NULL, UNIQUE |
| `name_vi` | varchar(150) | NOT NULL |
| `name_en` | varchar(150) | NULL |
| `description` | varchar(500) | NULL |
| `sort_order` | int | NOT NULL, default 0 |
| `is_active` | boolean | NOT NULL, default true |
| `created_at` | timestamptz | NOT NULL |
| `updated_at` | timestamptz | NOT NULL |

Index: unique `code`; `(is_active, sort_order)` cho catalog.

### 3.2 Bảng `job_specialization`

| Cột | Kiểu | Ràng buộc |
| --- | --- | --- |
| `job_specialization_id` | UUID | PK |
| `job_field_id` | UUID | FK NOT NULL, delete RESTRICT |
| `code` | varchar(64) | NOT NULL, UNIQUE |
| `name_vi` | varchar(150) | NOT NULL |
| `name_en` | varchar(150) | NULL |
| `description` | varchar(500) | NULL |
| `sort_order` | int | NOT NULL, default 0 |
| `is_active` | boolean | NOT NULL, default true |
| `created_at` | timestamptz | NOT NULL |
| `updated_at` | timestamptz | NOT NULL |

Index: unique `code`; `(job_field_id, is_active, sort_order)`.

### 3.3 Thay đổi bảng `job`

- thêm `job_specialization_id` UUID FK;
- **không thêm `job_field_id` vào Job** vì field suy ra qua specialization; lưu cả hai có thể gây mismatch;
- navigation `Job.Specialization`, rồi `Specialization.Field`;
- index đề xuất `(status, job_specialization_id, posted_at DESC)`, chốt sau `EXPLAIN ANALYZE`.

Lọc field bằng join `Job -> JobSpecialization` và `JobSpecialization.JobFieldId`; lọc specialization bằng `Job.JobSpecializationId`.

### 3.4 Quan hệ Skill

- giữ nguyên Job–Skill nhiều-nhiều;
- mỗi Job có đúng một specialization và nhiều skill;
- không suy specialization từ skill ở runtime;
- taxonomy dùng phân loại/lọc; skill dùng keyword, hiển thị và AI matching.

## 4. Taxonomy seed ban đầu

| Field code | Tên | Specialization code gợi ý |
| --- | --- | --- |
| `IT_SOFTWARE` | CNTT & Phần mềm | `BACKEND`, `FRONTEND`, `FULLSTACK`, `MOBILE`, `DEVOPS_CLOUD`, `QA_TESTING`, `SYSTEM_NETWORK`, `CYBERSECURITY` |
| `DATA_AI` | Dữ liệu & AI | `DATA_ANALYTICS`, `DATA_ENGINEERING`, `DATA_SCIENCE`, `AI_ML` |
| `PRODUCT_DESIGN` | Sản phẩm & Thiết kế | `PRODUCT_MANAGEMENT`, `BUSINESS_ANALYSIS`, `UI_UX`, `GRAPHIC_DESIGN` |
| `SALES_MARKETING` | Kinh doanh & Marketing | `SALES`, `BUSINESS_DEVELOPMENT`, `DIGITAL_MARKETING`, `CONTENT`, `SEO_SEM`, `CUSTOMER_SUCCESS` |
| `HR_ADMIN` | Nhân sự & Hành chính | `RECRUITMENT`, `HR_OPERATIONS`, `COMPENSATION_BENEFITS`, `ADMINISTRATION` |
| `FINANCE_ACCOUNTING` | Tài chính & Kế toán | `ACCOUNTING`, `AUDIT`, `FINANCIAL_ANALYSIS`, `BANKING` |
| `OPERATIONS_LOGISTICS` | Vận hành & Logistics | `OPERATIONS`, `SUPPLY_CHAIN`, `PROCUREMENT`, `LOGISTICS` |
| `OTHER` | Khác | `GENERAL_OTHER` |

Code là dữ liệu bền vững; sửa nhãn không đổi code. Seed idempotent theo code. `GENERAL_OTHER` ưu tiên cho backfill, không khuyến khích Client chọn mới. Không copy taxonomy Company/LinkedIn Industry.

## 5. Migration và dữ liệu cũ

### Giai đoạn 1 — tương thích ngược

1. Tạo hai bảng taxonomy.
2. Seed record nền ngay trong migration để backfill không phụ thuộc runtime seeder.
3. Thêm `job.job_specialization_id` nullable.
4. Backfill:
   - Job seed/template có mapping rõ thì gán specialization tương ứng;
   - title/skill chỉ dùng khi rule cụ thể, có test và không mơ hồ;
   - không xác định thì gán `GENERAL_OTHER`;
   - không suy từ `Company.Industry`.
5. Giữ nullable tạm thời để FE cũ vẫn tạo draft trong lúc rollout.
6. Thêm FK/index, không cascade delete taxonomy.

### Giai đoạn 2 — khóa production

1. Audit số Job còn null.
2. Backfill/sửa thủ công phần còn lại.
3. Khi FE cũ ngừng dùng và không còn null, migration riêng đặt `job_specialization_id NOT NULL`.
4. Trong giai đoạn chuyển tiếp, Application đã bắt buộc specialization khi Submit nên Job công khai mới không thiếu phân loại.

### Inactive

- không xóa taxonomy đã được tham chiếu;
- `is_active=false` ngăn chọn mới/đổi sang giá trị đó;
- Job cũ vẫn trả nhãn inactive để giữ lịch sử;
- draft dùng taxonomy inactive phải chọn lại trước Submit.

## 6. Domain và persistence

Tạo `JobField`, `JobSpecialization`; mở rộng `Job.JobSpecializationId` và navigation; thêm hai `DbSet`; cấu hình table, length, unique code, FK `RESTRICT`, timestamps và indexes; sinh migration `.cs`, `.Designer.cs`, snapshot.

Tạo abstraction/query taxonomy để:

- lấy field active kèm specialization active;
- lookup specialization theo id;
- kiểm tra specialization và field cha đều active;
- không serialize entity EF ra API.

## 7. API catalog

`GET /api/v1/public/job-taxonomy?search=` trả cây:

```json
{
  "items": [{
    "id": "field-id",
    "code": "IT_SOFTWARE",
    "nameVi": "CNTT & Phần mềm",
    "nameEn": "IT & Software",
    "specializations": [{
      "id": "specialization-id",
      "code": "BACKEND",
      "nameVi": "Backend",
      "nameEn": "Backend"
    }]
  }]
}
```

- chỉ trả active; field không có specialization active bị loại;
- sort `sort_order`, sau đó name/code;
- search trim, tối đa 100 ký tự, literal trên tên/code;
- endpoint public dùng chung Landing/Candidate/Affiliate/form Client;
- có thể thêm endpoint con theo field nếu FE cần lazy load, không bắt buộc.

## 8. API tạo, sửa và Submit Job

### Request create/update

Chỉ thêm:

```json
{ "jobSpecializationId": "uuid" }
```

FE không gửi `jobFieldId`; BE suy field qua specialization để loại mismatch.

### Create

- nhận `jobSpecializationId`;
- trong rollout cho null chỉ khi lưu draft;
- nếu có id, specialization và field cha phải tồn tại/active;
- persist FK, không để FK exception thô ra response.

### Update

- cho đổi specialization khi trạng thái Job cho phép sửa;
- validator adapter phải truyền field mới;
- id mới và field cha phải active;
- giữ concurrency token/version;
- không cho đặt null khi Job chuẩn bị Submit hoặc ở trạng thái cấm sửa.

### Submit

Trước `PENDING_REVIEW`:

- bắt buộc `JobSpecializationId`;
- specialization và field cha active;
- location hợp lệ theo rule hiện tại;
- lỗi: `Vui lòng chọn chuyên môn nghề nghiệp trước khi gửi duyệt.`;
- giữ các kiểm tra Service Type, nội dung, lương và quyền hiện có.

### DTO list/detail

```json
{
  "jobField": { "id": "field-id", "code": "IT_SOFTWARE", "nameVi": "CNTT & Phần mềm", "nameEn": "IT & Software" },
  "jobSpecialization": { "id": "spec-id", "code": "BACKEND", "nameVi": "Backend", "nameEn": "Backend" }
}
```

Dùng projection/include đủ hai cấp, tránh N+1. Job legacy null trong rollout trả hai object null; Job mới đã Submit không được null.

## 9. API tìm Job

Áp dụng cho cả hai list endpoint. Thêm:

- `jobFieldId`: tất cả specialization thuộc field;
- `jobSpecializationId`: đúng specialization;
- giữ location, search, employmentType, serviceTypeId, salary, sort, page;
- không thêm `companyId`.

Quy tắc:

- filter kết hợp AND;
- chỉ field: join specialization và lọc field id;
- chỉ specialization: lọc FK trên Job;
- gửi cả hai mà không khớp: `400 Chuyên môn không thuộc lĩnh vực đã chọn.`;
- id không tồn tại trả 400 thống nhất thay vì trang rỗng;
- visibility chạy trước optional filters;
- tất cả filters chạy trước `CountAsync`, sort, `Skip/Take`.

`search=Java` vẫn tìm title/description/skill. Không biến skill thành specialization. Trim và giới hạn search/location 100 ký tự; escape `%`, `_`, `\` để tìm literal. Location vẫn là chuỗi con không phân biệt hoa/thường; geospatial/province chuẩn hóa để task riêng.

## 10. Seed dữ liệu demo

Thứ tự `DatabaseSeeder`: Field → Specialization → Skill → Template → Job/demo.

- seed idempotent theo code;
- mỗi `SeedJobDef` có specialization code rõ;
- mapping template cũ sang specialization nhưng không dùng template làm nguồn runtime;
- nhiều doanh nghiệp và location;
- IT có Backend Java/.NET/Python, Frontend React, Mobile Flutter, DevOps, QA;
- ngoài IT có Kế toán, Tuyển dụng, Sales, Marketing, Logistics;
- có Hà Nội, TP.HCM, Đà Nẵng và Remote;
- chạy seed hai lần không duplicate hoặc đổi ID ổn định.

## 11. Lỗi API chuẩn hóa

- không tồn tại: `Chuyên môn nghề nghiệp không tồn tại.`;
- inactive: `Chuyên môn nghề nghiệp hiện không còn được sử dụng.`;
- field cha inactive: `Lĩnh vực công việc hiện không còn được sử dụng.`;
- thiếu khi Submit: `Vui lòng chọn chuyên môn nghề nghiệp trước khi gửi duyệt.`;
- hierarchy mismatch: `Chuyên môn không thuộc lĩnh vực đã chọn.`;
- text quá dài: 400 kèm field error rõ.

## 12. Trình tự triển khai

1. Duyệt taxonomy/code.
2. Thêm domain entities/navigation.
3. EF configuration/DbSet/index.
4. Migration giai đoạn 1 + seed nền + backfill + snapshot.
5. Runtime seeders idempotent.
6. Catalog API.
7. Create/Update nhận và persist specialization.
8. Submit gate.
9. List/detail DTO trả field + specialization.
10. Discovery nhận hai filters xuyên endpoint → query → repository.
11. Harden search/location.
12. Seed demo và integration tests.
13. Đánh dấu tài liệu company filter đã hủy.
14. Viết FE handoff.
15. Deploy BE tương thích → FE tích hợp → audit null → migration NOT NULL.

## 13. Files/symbols dự kiến

| Khu vực | File/symbol | Thay đổi |
| --- | --- | --- |
| Domain | `Entities/JobField.cs` | Entity lĩnh vực |
| Domain | `Entities/JobSpecialization.cs` | Entity chuyên môn |
| Domain | `Entities/Job.cs` | FK/navigation specialization |
| Application | taxonomy query/DTO mới | Catalog tree |
| Application | `CreateJobCommand*`, `UpdateJobCommand*` | Contract/validation/persist |
| Application | `SubmitJobCommandHandler` | Completeness gate |
| Application | `GetPublicJobsQuery*` | Hai filter mới |
| Application | `JobDto.cs` | Hai object taxonomy |
| Application | `IJobRepository` | Query signature/lookup |
| Infrastructure | `ApplicationDbContext` | DbSet/config |
| Infrastructure | migration + snapshot | Schema/backfill/index |
| Infrastructure | taxonomy repository/query | Catalog/lookup |
| Infrastructure | `JobRepository.GetVisibleJobsAsync` | Filter trước count/page |
| Infrastructure | `DatabaseSeeder` + seeders | Thứ tự/catalog/demo |
| Presentation | `JobEndpoints.MapJobEndpoints` | Params/catalog route |
| Tests | command/query/integration | Regression/contract/DB |
| Docs | MF01 docs + FE handoff | Hủy yêu cầu cũ/bàn giao mới |

Tên file thực tế theo convention solution khi implementation; không tạo layer song song.

## 14. Test strategy

### Taxonomy

- chỉ active; sort ổn định; field rỗng bị loại;
- search literal;
- seed hai lần không duplicate.

### Create/Update/Submit

- active lưu đúng FK;
- id thiếu/not found/inactive/field inactive trả lỗi đúng;
- draft null được phép trong rollout;
- update giữ concurrency;
- Submit thiếu/inactive bị chặn; hợp lệ giữ transition cũ.

### Query

- handler truyền đủ field/specialization/location/search/page;
- hierarchy mismatch trả 400;
- guest/Candidate/Affiliate giữ visibility;
- filter trước count/page;
- `%`, `_`, `\` là literal.

### PostgreSQL integration

- IT trả .NET/Java/Python/React/Flutter nhưng loại HR/Kế toán;
- IT + Backend loại Frontend/Mobile;
- Backend + Java chỉ còn Java;
- Backend + Hồ Chí Minh đúng location;
- tổ hợp filter + role + page có totalCount đúng;
- invalid id/mismatch có status đúng;
- Job legacy null không crash;
- catalog/DTO không N+1;
- migration chạy DB sạch và DB có dữ liệu cũ.

### Verification

```powershell
dotnet test HRConnect/HRConnect.sln --configuration Release
dotnet ef migrations has-pending-model-changes --project HRConnect/HRConnect.Infrastructure --startup-project HRConnect/HRConnect.Presentation
```

Chạy `EXPLAIN ANALYZE` cho ACTIVE + field/page, ACTIVE + specialization/page và specialization + location + search. Chỉ thêm `pg_trgm` khi số liệu chứng minh cần.

## 15. Rollout và FE handoff

### BE tương thích

- migration nullable;
- catalog hoạt động;
- create/update hiểu field mới nhưng draft FE cũ chưa vỡ;
- Submit bắt buộc specialization;
- list/detail chịu legacy null.

### FE Client

- tải taxonomy từ BE, không hardcode;
- dropdown Lĩnh vực → dropdown Chuyên môn phụ thuộc;
- request chỉ gửi `jobSpecializationId`;
- edit suy field từ response;
- đổi field thì xóa specialization không tương thích;
- hiển thị validation Submit.

### FE Candidate/Affiliate

- filter hai cấp và location/keyword;
- lưu IDs trong URL;
- đổi field thì xóa specialization không tương thích;
- card/detail hiển thị field/specialization; skill là tag riêng;
- xử lý loading, empty, invalid URL, retry.

### Khóa production

- theo dõi validation failures;
- audit/sửa Job null;
- migration NOT NULL khi client cũ hết dùng;
- xóa compatibility branch null.

## 16. Rủi ro

- nhầm Industry/Field/Specialization/Skill: tên code/DTO phải rõ;
- FE cũ: rollout hai giai đoạn;
- backfill sai: chỉ mapping xác định, còn lại `GENERAL_OTHER`, có báo cáo;
- taxonomy đổi: đổi label, không đổi code/delete record đã dùng;
- totalCount sai: filter trước count/page;
- N+1: projection/include và integration test;
- location chậm: đo PostgreSQL trước khi thêm extension;
- GitNexus graph stale: impact/detect_changes lại trên HEAD khi thực thi;
- không lan scope sang Company directory.

## 17. Tài liệu cần cập nhật

- đánh dấu `docs/MF01/mf01-be-loc-job-theo-doanh-nghiep.md` là **ĐÃ HỦY / superseded**;
- sửa phần Job filtering trong `docs/tasks/BE-tasks-02-nganh-danh-ba-cong-ty-loc-job.md`;
- sau khi API/test xong, tạo FE handoff gồm catalog, create/update, Submit validation, query params, response, dropdown phụ thuộc, URL state, null handling và acceptance checklist.

## 18. Ngoài phạm vi

- lọc Job theo doanh nghiệp;
- Company directory/Top Companies;
- Admin CRUD taxonomy đợt đầu (quản lý qua reviewed seed/migration);
- AI tự phân loại;
- geocoding/radius/province table;
- accent-insensitive location nếu chưa có yêu cầu riêng;
- đổi AI matching;
- code FE trong nhánh BE.

## 19. Quyết định cần chốt trước implementation

1. Danh sách field/specialization/code cuối.
2. `GENERAL_OTHER` chỉ backfill hay cho Client chọn?
3. Location tiếp tục free text hay chuẩn hóa ở task riêng?
4. Tên contract cuối: khuyến nghị `jobFieldId`, `jobSpecializationId`, `job-taxonomy`.
5. Mốc kết thúc compatibility để đặt FK NOT NULL.

Ghi các quyết định vào plan/PR trước khi sinh migration.

## 20. Definition of Done

1. Có `job_field`, `job_specialization` với FK/index/audit và seed idempotent.
2. Job chỉ lưu `job_specialization_id`, không lưu trùng field id.
3. Migration giai đoạn 1 chạy DB sạch và production-like; backfill không mất Job.
4. Catalog public trả cây active, sort ổn định.
5. Create/Update lưu specialization và trả lỗi nghiệp vụ rõ.
6. Submit chặn thiếu/inactive taxonomy.
7. List/detail trả field + specialization, chịu legacy null trong rollout.
8. Hai list API lọc field/specialization kết hợp đúng location/skill/role/sort/page.
9. Không có companyId filter; Company.Industry không phân loại Job.
10. Demo chứng minh IT → Backend → Java/.NET/Python và nhiều doanh nghiệp/location/ngành.
11. Unit/integration/full Release tests và pending-model check pass.
12. Query plan đã đo; index/extension có bằng chứng.
13. Docs cũ được đánh dấu hủy; FE handoff tạo sau khi BE hoàn tất.
14. Sau FE rollout/audit có migration NOT NULL hoặc quyết định bằng văn bản giữ nullable.

## 21. Context pack cho dev MF01

- Luồng đọc: HTTP → `GetPublicJobsQuery` → handler → `IJobRepository.GetVisibleJobsAsync` → visibility → filters → count → sort/page → DTO.
- Điểm sửa: `JobEndpoints.MapJobEndpoints`, `GetPublicJobsQueryHandler.Handle`, `JobRepository.GetVisibleJobsAsync`, `JobDto.From`, create/update handlers, `SubmitJobCommandHandler.Handle`.
- Ràng buộc PDG: filter mới trước `CountAsync`; visibility trước optional filters; không post-filter trang kết quả.
- Pattern: Minimal API → MediatR → repository → DTO; seed idempotent; migration có Designer/snapshot.
- Khi thực thi: GitNexus impact trên HEAD trước sửa symbol; detect_changes và test sau từng cụm API.
- Tránh: reuse Company.Industry/Skill.Category, lưu cả field/spec trên Job, suy runtime bằng AI/keyword, hardcode taxonomy ở FE, lọc sau pagination.
