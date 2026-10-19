# FE task: Form liên hệ, tạo CV theo mẫu, việc phù hợp, chuông realtime, danh bạ công ty, lỗi FE còn mở

**Người làm:** Sang · **Backend:** đã merge vào `dev` và `main` (BE-04, 2026-10-19)
**Nghiệp vụ chi tiết:** `HRConnect/docs/main-flows.md`, mục 6.1, SF-05 → SF-08.

Mọi response có dạng `{ success, data }`; lỗi nghiệp vụ có dạng `{ success: false, code, message }`. Làm xong phần nào thì thêm vào `API-INTEGRATION-BACKLOG.md` rồi xóa phần đó khỏi file này.

---

## 1. Form liên hệ tư vấn (SF-05)

### Trang công khai (guest, không cần đăng nhập)

`POST /api/v1/public/contact-requests`

```json
{
  "fullName": "Trần Thị B",
  "email": "b@example.com",
  "phone": "0900000000",
  "companyName": "Công ty B",
  "serviceInterest": "HEADHUNT_COD",
  "message": "Cần tuyển 5 lập trình viên.",
  "consentAccepted": true
}
```

- `serviceInterest`: `HEADHUNT_COD` | `CV_SOURCING` | `CV_APPLICATION` | `OTHER`. `phone` và `companyName` không bắt buộc.
- Phải có checkbox đồng ý xử lý dữ liệu cá nhân (Nghị định 13/2023). Không tick thì backend trả `400 CONSENT_REQUIRED`.
- `429 CONTACT_RATE_LIMITED` khi một IP gửi quá số lần cho phép trong 1 giờ: hiện "Bạn gửi quá nhiều, vui lòng thử lại sau".
- Thành công: hiện thông báo cảm ơn, xóa form.

### Màn quản lý (Internal HR, Platform Admin)

- `GET /api/v1/admin/contact-requests?status=NEW&page=1&pageSize=20` trả `{ items, totalCount, page, pageSize }`.
- `PATCH /api/v1/admin/contact-requests/{id}` với body `{ "status": "CONTACTED", "note": "Đã gọi" }`.
- Trạng thái: `NEW` → `CONTACTED` → `CLOSED`. Màn gồm bảng, lọc theo trạng thái, nút đổi trạng thái và ô ghi chú.

**Nghiệm thu:**
- Guest gửi được form.
- Không tick đồng ý thì báo lỗi.
- HR thấy yêu cầu mới và đổi được trạng thái.

---

## 2. Tạo CV theo mẫu / dựng trên nền tảng (SF-06, Candidate)

Màn "Tạo CV" có 3 lựa chọn: **Tải file lên** (đã có), **Chọn mẫu**, **Tự dựng**.

- `GET /api/v1/cv-templates` trả danh sách mẫu `{ cvTemplateId, code, name, description, templateConfig }`. `templateConfig` là JSON gồm `accentColor`, `density` (`normal` | `compact`) và `sections`, dùng để vẽ ô xem trước.
- `POST /api/v1/candidates/cv/structured`

```json
{
  "title": "CV Backend .NET",
  "cvTemplateId": "uuid hoặc null",
  "isPrimary": true,
  "structuredContent": {
    "fullName": "Phạm Minh Hiếu",
    "headline": "Lập trình viên Backend .NET",
    "email": "hieu@example.com",
    "phone": "0901234567",
    "address": "Hà Nội",
    "summary": "Mục tiêu nghề nghiệp...",
    "experiences": [{ "title": "Kỹ sư phần mềm", "company": "Công ty X", "startDate": "2022", "endDate": "2024", "description": "..." }],
    "educations": [{ "school": "ĐH Bách khoa", "degree": "Kỹ sư CNTT", "startDate": "2017", "endDate": "2022", "description": null }],
    "skills": ["C#", "ASP.NET Core"],
    "languages": ["Tiếng Anh (IELTS 6.5)"],
    "certificates": ["AWS Cloud Practitioner"]
  }
}
```

- Có `cvTemplateId` là tạo theo mẫu, `null` là tự dựng (bố cục mặc định).
- `fullName` bắt buộc. Cần ít nhất một trong các mục: mục tiêu, kinh nghiệm, học vấn hoặc kỹ năng, nếu không backend trả `400 CV_CONTENT_EMPTY`.
- Backend tự render PDF. CV vào thẳng kho CV, xem và tải bằng API CV hiện có, và dùng để ứng tuyển như CV thường.
- Sửa CV:
  - `GET /api/v1/candidates/cv/structured/{cvId}` lấy nội dung để điền lại form.
  - `PUT` cùng URL, body giống POST (không có `isPrimary`).
  - CV tải file lên thì trả `400 CV_NOT_STRUCTURED`, nên chỉ hiện nút "Sửa nội dung" với CV có `creationMethod` là `TEMPLATE_FORM` hoặc `PLATFORM_BUILDER`.
- Form nên cho thêm và xóa nhiều dòng kinh nghiệm, học vấn; kỹ năng, ngôn ngữ, chứng chỉ dùng ô nhập dạng tag.

**Nghiệm thu:**
- Tạo CV từ mẫu xong thì CV hiện trong kho và mở được file PDF.
- Nộp CV đó vào một job `CV_APPLICATION` thành công.
- Sửa nội dung xong thì file PDF đổi theo.

---

## 3. Mục "Việc phù hợp" (SF-07, Candidate)

`GET /api/v1/candidates/me/job-matches` trả tối đa 20 gợi ý:

```json
[{ "candidateJobMatchId": "...", "jobId": "...", "jobTitle": "Backend .NET", "companyName": "Công ty A",
   "location": "Hà Nội", "matchScore": 82.5, "generatedAt": "...", "expiresAt": "..." }]
```

- Hiện thẻ job kèm điểm phù hợp (ví dụ "Phù hợp 83%"); bấm vào thì mở trang chi tiết job.
- Chỉ ứng viên có hồ sơ **công khai** và **CV chính** mới được gợi ý. Danh sách trống thì hiện nhắc "Bật hồ sơ công khai và đặt CV chính để nhận gợi ý việc làm" kèm link tới trang hồ sơ / kho CV.
- Gợi ý được tính định kỳ (khoảng 1 giờ một lần), nên không cần nút làm mới liên tục.
- Thông báo việc phù hợp có loại `JOB_FIT`, trong `metadata` có `routeHint` = `/jobs/{jobId}`; bấm thông báo thì đi tới đó.

**Nghiệm thu:**
- Ứng viên công khai có CV chính thấy gợi ý và nhận thông báo.
- Ứng viên để hồ sơ riêng tư thì thấy màn trống kèm lời nhắc.

---

## 4. Chuông thông báo realtime (SF-08, mọi vai trò)

- Thư viện: `@microsoft/signalr`.
- Hub: `${API_BASE_URL}/hubs/notifications`, truyền token bằng `accessTokenFactory: () => accessToken` (thư viện tự gắn `?access_token=`).
- Dùng `withAutomaticReconnect()`. Kết nối khi đăng nhập, ngắt khi đăng xuất.
- Sự kiện:
  - `notification.created` có `{ notification, unreadCount }`: cập nhật số trên chuông và chèn thông báo vào đầu danh sách ngay, không cần tải lại.
  - `interview.updated` có `{ interviewId }`: nếu đang mở màn lịch phỏng vấn thì tải lại.
- **Giữ cơ chế gọi API định kỳ hiện có làm dự phòng:** khi mất kết nối thì tiếp tục gọi định kỳ, khi kết nối lại thì có thể giãn tần suất gọi.

**Nghiệm thu:**
- Client lên lịch phỏng vấn thì chuông của ứng viên tăng số ngay, không cần tải lại trang.
- Tắt mạng rồi bật lại thì vẫn nhận được thông báo.

---

## 5. Lỗi FE còn mở từ buổi test 17/10 (MF-02 → MF-03)

### 5.1. Hộp chi tiết hồ sơ không cập nhật sau khi loại / chọn

- **Màn hình:** Client → Hồ sơ ứng viên → mở hồ sơ → Loại hồ sơ → chọn lý do → Xác nhận.
- **Hiện tượng:** `PATCH /api/v1/jobs/{jobId}/applications/{applicationId}/status` trả `200` nhưng hộp chi tiết vẫn "Đang sàng lọc", 3 nút *Đưa vào dự phòng / Loại hồ sơ / Chọn ứng viên* vẫn bấm được; phải tải lại trang. Bấm tiếp sẽ gửi `concurrencyToken` cũ → `409`.
- **Sửa:** sau khi đổi trạng thái, invalidate/refetch `GET /recruitment/applications/{id}`, `/timeline` và danh sách; khóa nút trong lúc gửi.
- **Nghiệm thu:** loại hoặc chọn xong thì hộp chi tiết đổi trạng thái ngay, nút theo `allowedActions` mới.

### 5.2. Không hiện trạng thái AI thất bại

Ô **Đánh giá của AI** đang hiện "—" cho cả lúc chờ lẫn lúc `FAILED`. Hiển thị theo `aiMatch.status`:

| `status` | Hiển thị |
|---|---|
| `PENDING` / `PROCESSING` | "AI đang chấm điểm…" |
| `COMPLETED` | Điểm, tier, giải thích (như hiện tại) |
| `FAILED` | "AI chưa chấm được hồ sơ này, vui lòng xem CV trực tiếp". Internal HR có thêm nút **Yêu cầu chấm lại** (API đã có) |

### 5.3. Còn trang dùng mock

Các file còn import `services/mockData` hoặc `mockWebSocket`:
- `components/layout/AppShell.tsx`, `ClientLayout.tsx`, `Header.tsx`
- `features/admin/AdminDashboard.tsx`
- `features/affiliate/ReferralForm.tsx`
- `features/jobs/ClientJobsPage.tsx`
- `pages/client/ClientDashboardPage.tsx`, `pages/hr/HRDashboardPage.tsx`
- `services/localStorageService.ts`, `services/queries/useCandidates.ts`

`stores/alertStore.ts` có câu mẫu viết cứng "1.500.000 đ"; khi thay mock thì lấy số tiền từ API, không viết cứng. Chuông thông báo nên chuyển sang SignalR ở mục 4 thay cho `mockWebSocket`.

### 5.4. Chi tiết phỏng vấn cho Client

Commit `e92650a` mới làm chi tiết phỏng vấn cho Candidate. Client (`ClientWorkspaceInterviewsOffersPage`) cần: xem chi tiết, sửa `PUT /interviews/{id}`, tab lịch sử `GET /interviews/{id}/history`. Kiểm tra đã có chưa; chưa có thì làm.

### 5.5. Màn mới (backend đã có API)

- Dashboard báo cáo Admin: `GET /api/v1/reports/{overview, revenue, top-affiliates, top-companies}`.
- Hiệu suất của tôi (Affiliate): `GET /api/v1/affiliates/me/performance`.
- Khiếu nại trùng ứng viên (SF-04): Affiliate `/api/v1/disputes`, Platform Admin `/api/v1/admin/disputes` (xem `main-flows.md`, SF-04).

**Nhắc chung:** làm giao diện thì theo quyết định thiết kế từng vai trò đã chốt (Admin, HR, Client, Candidate/Affiliate).

---

## 6. Danh bạ công ty, bảng ngành, lọc kinh nghiệm (SF-09, backend đã có 19/10)

- Thay `src/constants/industries.ts` bằng `GET /api/v1/industries?tree=true` (cây ngành) và `GET /api/v1/company-sizes`. Hồ sơ công ty gửi `industryId`, `companySizeId` (`PUT /api/v1/companies/profile/me`); response có lại 2 id này.
- Trang danh bạ công ty công khai: `GET /api/v1/public/companies?search=&industryId=&companySizeId=&location=&page=&pageSize=` trả `{ items, page, pageSize, totalCount, totalPages }`, mỗi công ty có `industry {industryId, name}`, `companySize {companySizeId, label}`, `activeJobCount`, `isFeatured`.
- Khối Top Companies ở trang chủ: `GET /api/v1/public/companies/featured`.
- Trang hồ sơ công ty: `GET /api/v1/public/companies/{companyId}` → `{ company, jobs }`; công ty chưa xác minh → `404`.
- Admin: quản lý ngành `GET/POST/PUT /api/v1/admin/industries`; chọn Top Companies `PUT /api/v1/admin/companies/{id}/featured` `{ isFeatured, featuredOrder }`.
- Trang tìm việc: thêm bộ lọc **Số năm kinh nghiệm** → query `experienceYears` (0–60). Bộ lọc lĩnh vực / chuyên môn chờ backend theo plan job taxonomy của Trí.
- Đã sửa sẵn (19/10, khỏi làm lại): nút thanh toán của Client chỉ hiện khi tin chờ thanh toán và mở hướng dẫn chuyển khoản; Admin ghi nhận phí đăng tin ở **Tài chính › Phí đăng tin**; nhãn trạng thái theo dịch vụ; drawer hồ sơ co theo màn hình; Client xem CV Headhunt đã che; Affiliate xem chi tiết job trong layout Affiliate kèm hoa hồng ước tính; nhắc HR CV Sourcing chưa giao.
