# MF-01 (Giao diện): thư viện mẫu JD

> **Dành cho:** Sang, giao diện MF-01.
> **Backend: ✅ đã xong trên `dev`** (commit `443d337`, ngày 15/10). Làm giao diện và **gắn API thật luôn**, không cần dữ liệu giả.
> **Ngày:** 2026-10-15.
> **Hiện trạng:** bước 2 "Mô tả công việc" của `JobFormPage.tsx` chỉ có ô trống kèm chữ gợi ý (placeholder). Không có mẫu và không có chức năng dùng lại tin cũ.

Ký hiệu: 🔴 làm trước · 🟠 cần làm · ⚪ để giai đoạn 2, chưa làm.

---

## ⚠️ Điều kiện trước khi bắt đầu

1. **Pull `dev` mới nhất, có phần sửa giao diện MF-01 ngày 15/10.** Tài liệu này dựa vào các thay đổi đó, đặc biệt:
   - Ô **Kỹ năng chính** được gửi lên dạng yêu cầu `SHOULD_HAVE` có `category = SKILL`. Xem `toInput`, `toFormValues`, `isSkillTag`, `SKILL_CATEGORY` trong `JobFormPage.tsx`.
   - Hạn nộp hồ sơ được gửi là `applicationDeadline` theo giờ UTC. Các tên trường khác cũng đã đổi cho khớp backend: `proposedTerms.pricePerCv`, `sourcingTarget`, `postingPackageId`.
   - Nếu làm trên code cũ, ô kỹ năng sẽ lỗi (backend cần GUID) và chắc chắn bị xung đột khi merge `JobFormPage.tsx`.
2. **Chạy backend từ nhánh `dev`.** Khi khởi động, backend tự chạy migration `AddJobTemplates` và nạp sẵn **13 mẫu JD**, nên có dữ liệu thật để làm ngay.
   - Muốn frontend gọi backend ở máy: đặt `VITE_API_PROXY_TARGET=http://127.0.0.1:5041` trong `HRConnect-FE/.env`.
   - Backend trên Render **chỉ có API mẫu JD sau khi `dev` được merge vào `main`**. Trước lúc đó, gọi Render sẽ ra 404.
3. Tài khoản test (mật khẩu `111111Aa@`): `client@gmail.com` (tìm và dùng mẫu), `internalhr@gmail.com` và `admin@gmail.com` (quản lý mẫu, có quyền `job_template.manage`).

## Ý tưởng chính

Ở bước 2, Client **gõ từ khóa để tìm mẫu JD**, xem trước, rồi bấm **"Dùng mẫu này"**. Form tự điền và Client sửa tùy ý trước khi gửi duyệt.

```
Bước 2 · Mô tả công việc
┌──────────────────────────────────────────────────────────────┐
│ 📄 Bắt đầu nhanh từ mẫu JD                                    │
│ [ Tìm mẫu: ".net", "marketing", "kế toán"...        ] 🔍       │
│                                                              │
│ ┌─────────────────────────┐ ┌─────────────────────────┐      │
│ │ Lập trình viên Backend  │ │ Lập trình viên Fullstack│      │
│ │ .NET  · IT · Middle     │ │ IT · Middle             │      │
│ │ Xây dựng API ASP.NET... │ │ ...                     │      │
│ │ 7 yêu cầu · 12 lượt dùng│ │                         │      │
│ │        [Xem trước]      │ │        [Xem trước]      │      │
│ └─────────────────────────┘ └─────────────────────────┘      │
│ Không thấy mẫu phù hợp? Bạn vẫn tự nhập bên dưới.            │
└──────────────────────────────────────────────────────────────┘
  2.1 Thông tin vị trí tuyển dụng ... (form như hiện tại)
```

Nguyên tắc:
- Mẫu **chỉ điền các trường JD**: tên vị trí, hình thức, kinh nghiệm, mô tả, quyền lợi, yêu cầu và kỹ năng. **Không đụng** tới lương, địa điểm, số lượng, hạn nộp hay phí ở bước 3.
- Dùng mẫu xong, Client **sửa thoải mái**. Tin vẫn qua Internal HR duyệt như bình thường.
- Toàn bộ dữ liệu mẫu **lấy từ API**. Không ghi cứng mẫu nào trong code giao diện.

## API đã có (backend trên `dev`)

Mọi API trả về dạng **`{ success: true, data: ... }`**. Lỗi trả về `{ success: false, errorCode, message }`.

| API | Quyền | Dùng ở | Ghi chú |
|---|---|---|---|
| `GET /job-templates?keyword=&industry=&page=&pageSize=` | `job.create` (Client), `job.review`, `job_template.manage` | Ô tìm mẫu ở bước 2 (F1) | Tìm không dấu, mọi từ đều phải khớp. Mẫu khớp tên lên trước, rồi tới mẫu dùng nhiều. `keyword` rỗng thì trả mẫu dùng nhiều nhất. `pageSize` mặc định 8, tối đa 20 (backend tự giới hạn). Chỉ trả mẫu đang hiện |
| `GET /job-templates/{id}` | như trên | Khung xem trước, nút "Dùng mẫu này" (F2) | Mẫu đã ẩn trả **404 `TEMPLATE_NOT_FOUND`** với Client. `concurrencyToken` luôn là `null` ở API này |
| `POST /jobs` thêm trường `templateId` | `job.create` | Lưu job | Không bắt buộc. `templateId` sai hoặc mẫu đã bị xóa thì job **vẫn tạo được**, chỉ không ghi nhận mẫu. `GET /jobs/{id}` trả lại `templateId` |
| `GET /internal/job-templates?keyword=&industry=&isActive=&page=&pageSize=` | `job_template.manage` | Danh sách ở màn quản lý (F3) | Có cả mẫu đã ẩn. `isActive` bỏ trống thì lấy tất cả |
| `GET /internal/job-templates/{id}` | `job_template.manage` | Mở form sửa (F3) | Có `concurrencyToken` để gửi lại khi sửa |
| `POST /internal/job-templates` | `job_template.manage` | Tạo mẫu (F3) | Body: `JobTemplateUpsertInput` |
| `PUT /internal/job-templates/{id}` | `job_template.manage` | Sửa mẫu (F3) | Body: **`{ concurrencyToken, template: JobTemplateUpsertInput }`**. Ghi đè toàn bộ danh sách yêu cầu |
| `POST /internal/job-templates/{id}/deactivate` · `/activate` | `job_template.manage` | Ẩn hoặc hiện mẫu (F3) | Trả lại mẫu sau khi đổi trạng thái |

Gọi thử các API này ở Swagger của backend (`/swagger`), nhóm **"MF-01 Job Templates"**.

### Kiểu dữ liệu (thêm vào `src/types/api/jobs.ts`)

Khớp **đúng** với response backend hiện tại.

```ts
export type JobTemplateIndustry = 'IT' | 'MARKETING' | 'SALES' | 'ACCOUNTING' | 'HR' | 'ADMIN';
export type JobTemplateLevel = 'INTERN' | 'JUNIOR' | 'MIDDLE' | 'SENIOR' | 'LEAD';

export interface JobTemplateRequirement {
  requirementType: JobRequirementType;
  /** EXPERIENCE | SKILL | EDUCATION | OTHER; SKILL = kỹ năng, hiện ở ô "Kỹ năng chính". */
  category: string | null;
  content: string;
}

/** GET /job-templates và /internal/job-templates → data.items[] */
export interface JobTemplateSummary {
  templateId: string;
  code: string;
  name: string;
  /** Mã ngành; backend có thể thêm ngành mới nên vẫn để kiểu string. */
  industry: JobTemplateIndustry | string;
  level: JobTemplateLevel | null;
  summary: string | null;
  requirementCount: number;
  usageCount: number;
  isActive: boolean;
  updatedAt: string;
}

export interface JobTemplatePage {
  items: JobTemplateSummary[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/** GET /job-templates/{id} và /internal/job-templates/{id} → data */
export interface JobTemplate {
  templateId: string;
  code: string;
  name: string;
  industry: JobTemplateIndustry | string;
  level: JobTemplateLevel | null;
  keywords: string | null;
  summary: string | null;
  title: string;
  description: string;
  benefits: string | null;
  employmentType: EmploymentType | null;
  minExperienceYears: number | null;
  maxExperienceYears: number | null;
  requirements: JobTemplateRequirement[];
  isActive: boolean;
  usageCount: number;
  updatedAt: string;
  /** null ở API của Client; có giá trị ở /internal/job-templates/{id} và sau khi tạo/sửa. */
  concurrencyToken: string | null;
}

/** Body POST /internal/job-templates và trường `template` của PUT. */
export interface JobTemplateUpsertInput {
  code: string;
  name: string;
  industry: string;
  level?: JobTemplateLevel | null;
  keywords?: string | null;
  summary?: string | null;
  title: string;
  description: string;
  benefits?: string | null;
  employmentType?: EmploymentType | null;
  minExperienceYears?: number | null;
  maxExperienceYears?: number | null;
  requirements: JobTemplateRequirement[];
}
```

Ví dụ response thật của `GET /job-templates?keyword=react`:

```json
{ "success": true, "data": { "items": [
  { "templateId": "…", "code": "IT_FRONTEND_REACT", "name": "Lập trình viên Frontend ReactJS",
    "industry": "IT", "level": "MIDDLE", "summary": "Phát triển giao diện web bằng ReactJS và TypeScript, kết nối API backend.",
    "requirementCount": 7, "usageCount": 0, "isActive": true, "updatedAt": "2026-10-15T04:12:59Z" },
  { "templateId": "…", "code": "IT_FULLSTACK", "name": "Lập trình viên Fullstack", "…": "…" }
], "page": 1, "pageSize": 8, "totalCount": 2, "totalPages": 1 } }
```

`JobUpsertInput` thêm `templateId?: string | null`. `Job` thêm `templateId?: string | null`.

### Nhãn tiếng Việt (thêm vào `features/jobs-mf01/jobDisplay.ts`)

Mọi màn hình dùng chung bảng nhãn này, không tự đặt chữ riêng ở từng chỗ.

| Mã ngành | Nhãn | Mã cấp bậc | Nhãn |
|---|---|---|---|
| `IT` | Công nghệ thông tin | `INTERN` | Thực tập sinh |
| `MARKETING` | Marketing | `JUNIOR` | Nhân viên mới (Junior) |
| `SALES` | Kinh doanh | `MIDDLE` | Chuyên viên (Middle) |
| `ACCOUNTING` | Kế toán | `SENIOR` | Chuyên viên cao cấp (Senior) |
| `HR` | Nhân sự | `LEAD` | Trưởng nhóm (Lead) |
| `ADMIN` | Hành chính | | |

Nhóm yêu cầu (dùng ở F3): `EXPERIENCE` → Kinh nghiệm, `SKILL` → Kỹ năng, `EDUCATION` → Học vấn, `OTHER` → Khác.

Gặp mã lạ (backend thêm ngành mới) thì hiện nguyên mã, không để giao diện lỗi.

### Thông báo theo mã lỗi

| Mã lỗi | Xảy ra khi | Giao diện hiện |
|---|---|---|
| `TEMPLATE_NOT_FOUND` (404) | Client xem trước hoặc bấm dùng một mẫu vừa bị ẩn | "Mẫu này không còn được sử dụng. Vui lòng chọn mẫu khác." Đóng khung xem trước và tải lại danh sách |
| `TEMPLATE_CODE_DUPLICATE` | F3, tạo hoặc sửa mẫu | Lỗi ngay dưới ô `code`: "Mã mẫu đã tồn tại." |
| `TEMPLATE_MUST_HAVE_REQUIRED` | F3, lưu mẫu không có yêu cầu bắt buộc | Lỗi ngay dưới danh sách yêu cầu: "Mẫu cần ít nhất 1 yêu cầu bắt buộc." |
| 409 `TEMPLATE_CONCURRENCY_CONFLICT` | F3, hai người cùng sửa một mẫu | "Mẫu vừa được người khác cập nhật. Tải lại để xem bản mới." kèm nút Tải lại |
| 403 | Tài khoản không có quyền `job_template.manage` mở F3 | Chuyển về trang tổng quan, giống các trang có phân quyền khác |

Lỗi khác dùng `getApiErrorMessage(err)` (`services/apiClient.ts`) như các màn MF-01 hiện có.

---

### F1. 🔴 Ô tìm mẫu ở bước 2 (`JobFormPage.tsx`)

- Đặt khối **"Bắt đầu nhanh từ mẫu JD"** ở đầu bước 2, phía trên mục 2.1. Cho thu gọn hoặc mở rộng được. Mặc định mở khi form còn trống, thu gọn khi Client đã nhập nội dung hoặc đang sửa job cũ.
- Ô tìm kiếm:
  - Gọi API sau khi ngừng gõ khoảng 300 ms (debounce).
  - Ô trống thì hiện các mẫu dùng nhiều nhất, do API trả về.
  - Có lọc theo ngành (`industry`) dạng nhãn chọn nhanh: IT, Marketing, Kinh doanh, Kế toán, Nhân sự, Hành chính.
- Mỗi kết quả là một thẻ gồm tên mẫu, nhãn ngành và cấp bậc, 1 đến 2 dòng tóm tắt, số yêu cầu, và nút **Xem trước**.
- Trạng thái:
  - Đang tải: skeleton.
  - Không có kết quả: "Không tìm thấy mẫu cho "…". Bạn vẫn có thể tự nhập JD bên dưới."
  - Lỗi API: thông báo kèm nút **Thử lại**. Lỗi không được chặn Client tự nhập JD.
- File cần sửa:
  - `src/services/api/jobsApi.ts`: thêm `searchTemplates(params)` và `getTemplate(id)`.
  - `src/features/jobs-mf01/useJobQueries.ts`: thêm `useJobTemplates(keyword, industry)` và `useJobTemplate(id)`, cùng key cache trong `jobQueryKeys`.
  - `src/features/jobs-mf01/JobFormPage.tsx`: đặt khối mẫu JD ở đầu bước 2, phía trên `2.1 Thông tin vị trí tuyển dụng`. Nên tách thành component riêng, ví dụ `JobTemplatePicker.tsx` trong cùng thư mục, vì `JobFormPage.tsx` đã hơn 2.000 dòng.

### F2. 🔴 Xem trước và "Dùng mẫu này"

- Bấm **Xem trước** mở Drawer hoặc Modal, hiện đúng nội dung sẽ được điền:
  - Tên vị trí, hình thức, kinh nghiệm.
  - Mô tả, quyền lợi.
  - Yêu cầu bắt buộc, yêu cầu ưu tiên.
  - Kỹ năng: các yêu cầu có `category = SKILL`.
- Bấm **Dùng mẫu này**:
  1. Nếu bước 2 **đã có nội dung**, hỏi xác nhận: "Thay nội dung hiện tại bằng mẫu? Các ô lương, địa điểm, số lượng và phí giữ nguyên." Hai nút: **Thay bằng mẫu** và **Hủy**.
  2. Điền vào form:

     | Trường mẫu | Ô trong form |
     |---|---|
     | `title` | `title` |
     | `employmentType` | `employmentType` |
     | `minExperienceYears`, `maxExperienceYears` | 2 ô kinh nghiệm |
     | `description`, `benefits` | 2 textarea |
     | `requirements` có `category ≠ SKILL` | danh sách `requirements` |
     | `requirements` có `category = SKILL` | ô **Kỹ năng chính** (`skills`) |

  3. Giữ `templateId` trong state của form. Khi lưu, gửi kèm `templateId` vào `POST /jobs`.
  4. Hiện thông báo "Đã điền từ mẫu "…". Bạn có thể chỉnh sửa trước khi gửi duyệt." Thanh "Mức độ hoàn thiện" cập nhật theo.
- Khi lưu, kỹ năng vẫn gửi dạng yêu cầu `SHOULD_HAVE` có `category = SKILL`, giống cách form đang làm. Không gửi `skillId` dạng tên kỹ năng, vì backend cần GUID và sẽ từ chối.
- Bàn phím: thẻ mẫu tab tới được, Enter mở xem trước. Drawer có tiêu đề và đóng được bằng Esc.

**Các tình huống cần xử lý:**

| Tình huống | Cách xử lý |
|---|---|
| Đang **sửa** job nháp hoặc job bị từ chối | Vẫn hiện khối mẫu nhưng **thu gọn mặc định**. Dùng mẫu thì luôn hỏi xác nhận, vì form đã có nội dung |
| Job ở trạng thái không sửa được (`editable = false`) | Ẩn khối mẫu |
| Client đổi loại dịch vụ ở bước 1 **sau khi** đã dùng mẫu | **Giữ** nội dung JD và `templateId`. Mẫu là JD dùng chung cho mọi dịch vụ. Bước 1 chỉ xóa dữ liệu phí ở bước 3, như hiện tại |
| Dùng mẫu A rồi đổi sang mẫu B | Hỏi xác nhận như trên. `templateId` đổi thành B |
| Dùng mẫu rồi tự sửa hoặc xóa nội dung | Vẫn gửi `templateId`. Trường này chỉ để thống kê "job này bắt đầu từ mẫu nào" |
| Mở lại job đã tạo từ mẫu để sửa | Đọc `job.templateId` vào state, để lần lưu sau vẫn gửi đúng `templateId` |
| Mẫu có kỹ năng trùng với kỹ năng Client đã nhập | Gộp lại, bỏ trùng (không phân biệt hoa thường) |
| Ô tìm kiếm có ký tự đặc biệt hoặc rất dài | Cắt còn tối đa 100 ký tự trước khi gọi API |

### F3. 🟠 Màn quản lý mẫu JD (Internal HR, Admin)

- Thêm mục menu **"Mẫu JD"** ở không gian Internal HR (`/hr/job-templates`) và Admin (`/admin/job-templates`). Chỉ hiện khi tài khoản có quyền `job_template.manage`.
- File cần sửa:
  - `src/app/router.tsx`: thêm route `job-templates` vào nhóm `/hr` và `/admin`, cạnh route `jobs` hiện có.
  - `src/routes/AppRoutes.tsx`: khai báo `React.lazy` cho trang mới, giống `Mf01JobReviewPage`.
  - `src/features/hr-console/HrLayout.tsx` và `src/features/admin-console/AdminLayout.tsx`: thêm mục menu, đặt cạnh "Duyệt tin tuyển dụng".
  - Kiểm tra quyền bằng `hasPermission('job_template.manage')` có sẵn trong `src/stores/authStore.ts`. Không kiểm tra theo tên vai trò.
  - Trang mới: `src/features/jobs-mf01/JobTemplatesAdminPage.tsx`, đặt chung với các màn MF-01.
- **Danh sách:**
  - Bảng gồm tên, ngành, cấp bậc, số yêu cầu, lượt dùng, trạng thái hiện hoặc ẩn, ngày cập nhật.
  - Có ô tìm kiếm và bộ lọc ngành, trạng thái.
- **Tạo hoặc sửa:**
  - Các trường theo bảng B1 của tài liệu backend.
  - Danh sách yêu cầu thêm hoặc xóa được, chọn loại `MUST_HAVE`/`SHOULD_HAVE` và nhóm (`EXPERIENCE`, `SKILL`, `EDUCATION`, `OTHER`).
  - Bắt buộc có ít nhất 1 `MUST_HAVE`, hiện lỗi ngay dưới ô.
  - Có khung **xem trước** giống khung Client sẽ thấy.
- **Ẩn hoặc hiện mẫu:** hỏi xác nhận, và ghi rõ: "Các job đã tạo từ mẫu này không bị thay đổi."
- Hiển thị lỗi theo mã từ backend: `TEMPLATE_CODE_DUPLICATE` hiện ngay dưới ô `code`.
- Theo style của không gian HR hiện có: sidebar sáng, màu nhấn sky. Dùng lại các component trong `features/admin-console/ui`.

### F4. 🟠 Hiện nguồn mẫu ở trang duyệt job

Ở `JobReviewPage` / `JobDetailPanel`: nếu job có `templateId` thì hiện nhãn nhỏ **"Tạo từ mẫu: …"**. Mục đích là để HR biết JD nào do Client tự viết, JD nào dựa trên mẫu. Client và ứng viên không cần thấy nhãn này.

### F5. ⚪ Giai đoạn 2: nút "Để AI viết nháp" (chưa làm)

Khi tìm không ra mẫu, hiện thêm nút "Để AI viết nháp". Kết quả AI có cùng cấu trúc với mẫu, nên dùng lại khung xem trước và luồng điền form của F2. Phần này sẽ có tài liệu riêng.

---

## Tiêu chí nghiệm thu giao diện

1. Ở bước 2, gõ "ke toan" (không dấu) ra mẫu Kế toán. Ô trống thì hiện các mẫu dùng nhiều nhất.
2. Xem trước hiện đúng nội dung sẽ điền. Bấm "Dùng mẫu này" thì form điền đúng các trường, kỹ năng nằm ở ô Kỹ năng chính, và **lương, địa điểm, số lượng, phí không bị đổi**.
3. Form đã có nội dung thì hỏi xác nhận trước khi thay.
4. Lưu job gửi kèm `templateId`. Tạo job, gửi duyệt và Internal HR duyệt **vẫn chạy bình thường** với JD đã sửa từ mẫu.
5. API mẫu lỗi thì có thông báo và nút Thử lại, và Client vẫn tự nhập JD được.
6. Internal HR và Admin tạo, sửa, ẩn, hiện được mẫu. Mẫu đã ẩn không còn hiện ở ô tìm của Client. Client không thấy menu "Mẫu JD".
7. Không có mẫu hay số liệu nào ghi cứng trong code giao diện.
8. Dùng được bằng bàn phím. Giao diện không vỡ ở chiều rộng 390 px.
9. Mẫu bị ẩn trong lúc Client đang xem trước thì hiện đúng thông báo `TEMPLATE_NOT_FOUND`, không trắng trang.
10. Đổi loại dịch vụ sau khi dùng mẫu vẫn giữ nội dung JD. Mở lại job tạo từ mẫu rồi lưu vẫn giữ `templateId`.
11. Có test (Vitest) cho: hàm chuyển mẫu sang giá trị form (đúng bảng ở F2, kỹ năng gộp và bỏ trùng), và 2 hàm API mới trong `jobsApi.test.ts`.

## Thứ tự gợi ý

Backend đã sẵn sàng, nên làm theo thứ tự **F1 → F2 → F4 → F3**, gắn API thật ngay từ đầu.
Dữ liệu giả chỉ dùng **trong file test** (Vitest), không đưa vào code giao diện.
