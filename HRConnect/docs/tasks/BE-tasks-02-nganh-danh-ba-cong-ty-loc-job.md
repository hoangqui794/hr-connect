# BE task 02: Bảng ngành, danh bạ công ty và lọc job

> **Ngày:** 2026-10-15. **Ưu tiên:** 🟠 Trung bình.
> **Thứ tự bắt buộc:** **A (bảng ngành) → B (danh bạ công ty) → C (lọc job)**. B và C đều cần A.
> **Căn cứ đề tài:** "searchable/filterable company directory (by industry, using the LinkedIn L1/L2/L3 industry taxonomy) with an admin-curated Top Companies list"; "Filter job listings by region, salary range, years of experience, and industry"; NFR *Maintainability*: "industry taxonomy (backed by the 785-row Industry/Company-Size reference table) without code changes"; Database: "seed table for the LinkedIn-based Industry/Company-Size taxonomy".
> **Hiện trạng code** (GitNexus, `main` `5640eb1`):
> - `Company.Industry`, `Company.CompanySize` là **chuỗi tự nhập**, không có bảng tham chiếu.
> - FE có cây ngành viết cứng ở `HRConnect-FE/src/constants/industries.ts` (khoảng 250 dòng, **không** đủ 785 dòng như đề tài).
> - Không có API danh sách công ty công khai; thông tin công ty chỉ đi kèm chi tiết job (`PublicCompanyDto`).
> - `GET /api/v1/public/jobs` lọc được `search`, `location`, `employmentType`, `serviceTypeId`, `salaryMin`, `salaryMax`. `Job` **đã có** `MinExperienceYears`, `MaxExperienceYears` nhưng chưa lọc được; job không có ngành riêng (lấy theo công ty).

Quy ước chung: Vertical Slice + MediatR; migration có `.Designer.cs`; `has-pending-model-changes` ra "No changes"; chạy GitNexus `impact` trước khi sửa `GetPublicJobsQuery`, `Company`, `CompanyEndpoints`.

**Cách làm và bàn giao**

- **Ước lượng:** khoảng 4 ngày (A: 1,5 ngày, B: 1,5 ngày, C: 1 ngày).
- **Phụ thuộc:** Làm tuần tự A → B → C. Sửa `GetPublicJobsQuery` và `CompanyEndpoints` (đang dùng cho MF-01, MF-02): chạy GitNexus `impact` và báo dev MF-01 trước khi merge.
- **Nhánh:** `feature/<tên-ngắn>` tạo từ `dev`, PR vào `dev`, ít nhất 1 người review; CI xanh mới merge.
- **Cài đặt mới:** thêm khóa vào `BusinessSettingKeys` (`HRConnect.Application/Common/Settings/BusinessSettings.cs`) để hiện ở trang Cài đặt Admin.
- **Xong khi:** đạt hết mục nghiệm thu, có unit test, `dotnet test` pass, migration có `.Designer.cs`, Swagger có mô tả tiếng Việt, cập nhật trạng thái **[CHƯA CÓ CODE]** trong `main-flows.md` / tài liệu Actor nếu có.
- **Bàn giao FE:** cập nhật tài liệu Frontend khi A và C merge (`industries.ts`, thêm bộ lọc).
- **Nghiệp vụ chưa rõ:** xác nhận với người phụ trách nghiệp vụ trước, không tự đoán.

---

## A. Bảng ngành và quy mô công ty

**Dữ liệu nguồn (đã chốt 15/10, tạm thời):** dùng danh sách ngành đang có ở `HRConnect-FE/src/constants/industries.ts` (15 nhóm ngành cấp 1, 141 ngành cấp 2; giữ nguyên `value` làm `code`, `title` làm `name_en`). Bảng vẫn thiết kế đủ 3 cấp để sau này nạp bộ 785 dòng của đề tài **chỉ bằng file seed / trang Admin, không sửa code**.

**Quy mô công ty (mặc định, theo các mức LinkedIn dùng):** `1` · `2-10` · `11-50` · `51-200` · `201-500` · `501-1000` · `1001-5000` · `5001-10000` · `10001+`.

### A1. Bảng

| Bảng | Cột |
|---|---|
| `industry` | `industry_id` uuid PK, `code` varchar UNIQUE (ví dụ `tech-software`), `name_en`, `name_vi` null, `level` smallint (1/2/3), `parent_id` uuid null FK `industry`, `sort_order`, `is_active` bool, `created_at`, `updated_at` |
| `company_size` | `company_size_id` uuid PK, `code` UNIQUE (ví dụ `11-50`), `label`, `min_employees`, `max_employees` null, `sort_order`, `is_active` |

`company` thêm `industry_id` uuid null FK, `company_size_id` uuid null FK. **Giữ** 2 cột chuỗi cũ trong giai đoạn chuyển, migration cố gắng map chuỗi cũ sang `code`/`name_en`; không map được thì để null và ghi log.

### A2. Seed

- Chuyển danh sách trên thành CSV (`industry.csv`, `company_size.csv`) đặt trong `HRConnect.Infrastructure/Persistence/Seed/`, seed idempotent theo `code` như `DatabaseSeeder` hiện tại. Thay file CSV là nạp được bộ dữ liệu mới.
- Admin sửa được, **không** cần sửa code (NFR Maintainability).

### A3. API

| Method | Route | Quyền | Ghi chú |
|---|---|---|---|
| `GET` | `/api/v1/industries?level=&parentId=&search=` | Public | Danh sách phẳng; thêm `?tree=true` trả dạng cây L1→L2→L3 |
| `GET` | `/api/v1/company-sizes` | Public | |
| `POST` / `PUT` | `/api/v1/admin/industries`, `/api/v1/admin/industries/{id}` | `PLATFORM_ADMIN` | Tạo, sửa tên, bật/tắt. **Không xóa cứng** ngành đã gắn công ty |

Cập nhật `PUT /api/v1/companies/profile/me` và đăng ký Client nhận `industryId`, `companySizeId` (validate tồn tại và `is_active`).

### Nghiệm thu A

1. Seed xong có 15 ngành cấp 1, 141 ngành cấp 2 và 9 mức quy mô; chạy seed lần 2 không tạo trùng.
2. `GET /industries?tree=true` trả đúng cây; thêm thử 1 ngành cấp 3 qua API Admin thì cây hiện 3 cấp.
3. Client cập nhật hồ sơ với `industryId` không tồn tại → `400`.

---

## B. Danh bạ công ty công khai và Top Companies

### B1. Dữ liệu

`company` thêm `is_featured` bool mặc định `false`, `featured_order` int null (Admin chọn Top Companies). Chỉ công ty `VerificationStatus = VERIFIED` mới xuất hiện công khai.

### B2. API

| Method | Route | Quyền | Ghi chú |
|---|---|---|---|
| `GET` | `/api/v1/public/companies?search=&industryId=&companySizeId=&location=&page=&pageSize=` | Public | `industryId` cấp 1/2 lọc cả ngành con |
| `GET` | `/api/v1/public/companies/featured` | Public | Top Companies theo `featured_order` |
| `GET` | `/api/v1/public/companies/{companyId}` | Public | Hồ sơ công khai + danh sách job `ACTIVE` mà Guest/Candidate được xem |
| `PUT` | `/api/v1/admin/companies/{companyId}/featured` | `PLATFORM_ADMIN` | `{ "isFeatured": true, "featuredOrder": 1 }` |

**Không trả** `TaxCode`, thông tin người dùng công ty hay dữ liệu nội bộ. Dùng lại `PublicCompanyDto` đã có, bổ sung `industry` (`id`, `name`), `companySize`, `activeJobCount`.

Job trong hồ sơ công ty phải tuân đúng quy tắc hiển thị hiện có (`JobAccessPolicy`): Guest chỉ thấy job thuộc Service Type mà vai trò Candidate có `can_view`.

### Nghiệm thu B

1. Công ty chưa `VERIFIED` không có trong danh bạ, mở chi tiết → `404`.
2. Lọc theo ngành cấp 1 trả cả công ty thuộc ngành cấp 2/3 bên dưới.
3. Hồ sơ công ty không có `taxCode`; job thuộc Service Type mà Candidate không có `can_view` không xuất hiện với Guest.
4. Admin đặt 3 công ty nổi bật → `featured` trả đúng thứ tự.

---

## C. Lọc job theo kinh nghiệm và ngành

Mở rộng `GetPublicJobsQuery` và endpoint `GET /api/v1/public/jobs` (và `GET /api/v1/jobs` cho người đã đăng nhập, cùng bộ lọc):

| Query mới | Cách lọc |
|---|---|
| `experienceYears` | Job có `MinExperienceYears <= x` (hoặc null) **và** `MaxExperienceYears >= x` (hoặc null) |
| `industryId` | Theo ngành của **công ty** đăng job (gồm ngành con) |
| `companyId` | Job của một công ty (trang hồ sơ công ty dùng) |

- Giữ nguyên các bộ lọc cũ; giữ nguyên quy tắc hiển thị theo vai trò.
- Thêm index cần thiết (ví dụ `company(industry_id)`), kiểm tra bằng `EXPLAIN` với dữ liệu seed lớn. NFR đề tài: tìm kiếm nhanh với 50.000 hồ sơ.
- Response job thêm `company.industry` (`id`, `name`) để FE hiện nhãn ngành.

### Nghiệm thu C

1. Job yêu cầu 2–5 năm: `experienceYears=3` thấy, `experienceYears=6` không thấy, job không ghi kinh nghiệm luôn thấy.
2. Lọc ngành cấp 1 trả job của công ty thuộc ngành con.
3. Test cũ của `GetPublicJobs` vẫn pass.

---

## Giao cho FE

Sau khi xong, bổ sung vào [`API-INTEGRATION-BACKLOG.md`](../../../HRConnect-FE/docs/tasks/API-INTEGRATION-BACKLOG.md): thay `constants/industries.ts` bằng API `/industries`; trang danh bạ công ty và Top Companies; thêm 2 bộ lọc kinh nghiệm và ngành ở trang tìm việc.
