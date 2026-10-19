# Backlog Frontend: nối giao diện với API đã có

> **Phạm vi:** Frontend dùng chung. **Ngày:** 2026-10-15.
> **Căn cứ:** đối chiếu 193 route backend (`HRConnect.Presentation/Endpoints`) với các lời gọi API và các route thật trong `HRConnect-FE/src/app/router.tsx` trên `dev` (commit `b41352d`).
> **Phạm vi:** chỉ những API backend **đã có** nhưng FE **chưa gọi**, hoặc FE đang dùng store trên máy / mock thay cho API. Không đổi nghiệp vụ, không sửa backend. Thiếu API thì ghi lại, không tự chế dữ liệu.

Ký hiệu: 🔴 làm trước · 🟠 cần làm · 🟡 kiểm tra rồi quyết định.

## Quy ước chung

- **Base URL:** `apiClient` đã gắn `/api/v1`, nên trong code gọi `'/notifications'`, không gọi `'/api/v1/notifications'`.
- **Response:** đa số API trả `{ success, data }`; lỗi trả `{ success: false, message, errorCode? }`. Hiển thị `message`, rẽ nhánh theo `errorCode` khi tài liệu có ghi. Riêng nhóm Commission Rule (mục 8) trả thẳng kết quả, không bọc `data`: kiểm tra trên Swagger trước khi viết type.
- **`concurrencyToken`:** gửi token mới nhất lấy từ lần đọc trước. Nhận `409` thì tải lại dữ liệu và báo người dùng "Dữ liệu đã thay đổi, vui lòng thử lại".
- **Code:** hàm gọi API đặt trong `src/services/api/*` (theo mẫu `hrApi.ts`, `financeApi.ts`); query/mutation bằng React Query; type trong `src/types/api/*`; có test `vitest` cho hàm gọi API (mẫu `jobsApi.test.ts`). UI dùng Ant Design như các trang console hiện có.
- **Quyền:** ẩn nút theo permission trong `constants/rbac.ts`, nhưng vẫn xử lý `403` từ backend.
- **Thử API:** `http://localhost:5041/swagger`. Tài khoản demo theo seed của nhóm.

## Bản đồ màn hình hiện có (route thật)

| Vai trò | Route | Component |
|---|---|---|
| Internal HR | `/hr/pipeline` | `features/hr-console/HrPipelinePage.tsx` |
| Internal HR | `/hr/warranty-tracking` | `features/finance-mf05/WarrantyPages.tsx` → `HrWarrantyPage` |
| Client | `/client/jobs`, `/client/candidates`, `/client/interviews-offers` | `Mf01ClientJobsListPage`, `ClientCandidatesPage`, `ClientWorkspaceInterviewsOffersPage` (xem `routes/AppRoutes.tsx`) |
| Client | `/client/warranty` | `features/finance-mf05/WarrantyPages.tsx` → `ClientWarrantyPage` |
| Candidate | `/candidate/applications`, `/candidate/applications/:applicationId` | `features/portal/CandidatePages.tsx` → `CandidateApplicationsPage`, `CandidateApplicationDetailPage` |
| Admin | `/admin/commission-rules` | `features/admin-console/AdminCommissionRulesPage.tsx` |
| Chuông (Client, HR) | header | `components/notifications/NotificationBell.tsx` (đọc `stores/alertStore`) |

> Lưu ý: `features/candidates/CandidateApplicationsPage.tsx` + `stores/candidateStore.ts` là bản cũ, **không** nằm trong route `/candidate/*`. Đừng sửa ở đó; làm trên `features/portal`.

---

## 1. 🔴 Giao CV cho job CV_SOURCING (MF-03)

**Hiện trạng FE:** chưa có màn nào. **Code BE:** `Endpoints/V1/Recruitment/SourcingDeliveryEndpoints.cs`.

| Method | Route | Ai dùng (quyền) | Body |
|---|---|---|---|
| `POST` | `/jobs/{jobId}/sourcing/deliveries` | Internal HR (`application.screen`) | `{ "applicationIds": ["uuid"] }` |
| `GET` | `/jobs/{jobId}/sourcing/deliveries?status=` | Internal HR; Client (`candidate.review_company`, chỉ job công ty mình) | |
| `POST` | `/jobs/{jobId}/sourcing/deliveries/{deliveryId}/decision` | Client | `{ "decision": "ACCEPTED" \| "REJECTED", "reasonCode": "...", "note": "..." }` |
| `POST` | `/jobs/{jobId}/sourcing/deliveries/{deliveryId}/review-rejection` | Internal HR | `{ "upheld": true, "note": "..." }` (`upheld=false` bắt buộc `note`) |
| `POST` | `/jobs/{jobId}/sourcing/deliveries/{deliveryId}/replace` | Internal HR | `{ "applicationId": "uuid" }` |

**Response của `GET`:**

```jsonc
{
  "summary": { "sourcingTarget": 10, "delivered": 7, "accepted": 4, "autoAccepted": 1,
               "rejected": 1, "pendingReview": 1, "counted": 5 },
  "items": [
    { "deliveryId": "uuid", "applicationId": "uuid", "candidateName": "Nguyễn A",
      "status": "DELIVERED",            // DELIVERED | ACCEPTED | REJECTED | AUTO_ACCEPTED | REPLACED
      "deliveredAt": "...", "reviewDueAt": "...", "daysLeft": 3,
      "decidedAt": null, "rejectReasonCode": null, "rejectNote": null, "replacedByDeliveryId": null }
  ]
}
```

`POST .../deliveries` trả danh sách CV vừa giao cùng các số đếm; sau khi gọi xong chỉ cần tải lại `GET`.

**Mã lý do từ chối** (`reasonCode`, bắt buộc khi `REJECTED`): `DUPLICATE_ALREADY_OWNED` (ứng viên Client đã có), `FALSE_INFORMATION` (thông tin sai), `UNREACHABLE` (không liên lạc được), `WRONG_JOB` (sai job/tiêu chí), `OTHER` (bắt buộc ghi chú). **Không** có lý do "không chọn phỏng vấn".

**Lỗi 409 (`errorCode`):** `SOURCING_TARGET_REACHED` (đủ chỉ tiêu), `CONSENT_NOT_CONFIRMED`, `APPLICATION_NOT_QUALIFIED` (hồ sơ chưa `SHORTLISTED`), `JOB_NOT_SOURCING`, `REVIEW_WINDOW_CLOSED` (quá hạn xem xét).

**Màn hình cần làm:**

- **Internal HR** (`HrPipelinePage`, khi lọc theo job CV_SOURCING): chọn nhiều hồ sơ `SHORTLISTED` → nút "Giao cho Client"; tab "CV đã giao" dùng `GET`; CV bị từ chối lý do `OTHER` có nút "Giữ từ chối / Bác bỏ"; CV bị từ chối hợp lệ có nút "Thay bằng CV dự phòng" (chọn một hồ sơ `SHORTLISTED`/`BACKUP` khác của job).
- **Client** (từ `/client/jobs` mở job CV_SOURCING; nếu chưa có trang chi tiết job thì thêm route `/client/jobs/:id/sourcing`): thanh tiến độ "`counted`/`sourcingTarget` CV đã nhận", mỗi CV `DELIVERED` có nút **Chấp nhận / Từ chối** (form chọn mã lý do, ghi chú) và nhãn "còn `daysLeft` ngày". CV đã quyết định thì chỉ hiện trạng thái.

**Nhãn gợi ý:** `DELIVERED` "Chờ Client xem", `ACCEPTED` "Đã chấp nhận", `AUTO_ACCEPTED` "Tự động chấp nhận (quá hạn)", `REJECTED` "Bị từ chối", `REPLACED` "Đã thay CV khác".

---

## 2. 🔴 Suất tuyển thay thế (MF-05)

**Hiện trạng FE:** chưa có. **Code BE:** `Endpoints/V1/Finance/FinanceEndpoints.cs`. Quy tắc: [`mf05-thiet-ke-suat-thay-the.md`](../../../HRConnect/docs/MF05/mf05-thiet-ke-suat-thay-the.md).

| Method | Route | Ai dùng (quyền) | Body |
|---|---|---|---|
| `GET` | `/jobs/{jobId}/replacement-slots` | Internal HR / Admin (mọi job); Client (`placement.confirm`, job công ty mình) | |
| `POST` | `/internal/replacement-slots/{replacementSlotId}/cancel` | Internal HR (`warranty.manage`) | `{ "reason": "...", "concurrencyToken": "uuid" }` |

**Response (mảng, mỗi phần tử):**

```jsonc
{ "replacementSlotId": "uuid", "jobId": "uuid",
  "status": "OPEN",                    // WAITING_PAYMENT | OPEN | FILLED | CANCELLED | EXPIRED
  "originalPlacementId": "uuid", "originalCandidateName": "Nam",
  "serviceFeeId": "uuid", "fillWindowDays": 30,
  "openedAt": "...", "expiresAt": "...",
  "filledByPlacementId": null, "replacementCandidateName": null,
  "closedAt": null, "cancelReason": null, "concurrencyToken": "uuid", "createdAt": "..." }
```

**Lỗi 409:** `REPLACEMENT_SLOT_NOT_CANCELLABLE`, `REPLACEMENT_SLOT_CONCURRENCY_CONFLICT`.

**Liên quan API đã có:** `POST /placements/{id}/resignation/resolve` (Internal HR xác minh báo nghỉ, đang gọi trong `HrWarrantyPage`) giờ trả thêm `replacement`:
`{ "replacementSlotId", "jobId", "status", "expiresAt" }` hoặc `null` (người nghỉ là người thay thế, hoặc không có phí). Hiện thông báo theo `status`: `OPEN` "Đã mở suất thay thế đến `expiresAt`", `WAITING_PAYMENT` "Suất thay thế sẽ mở khi Client thanh toán phí", `null` "Không mở suất thay thế".

**Màn hình cần làm:**

- Trong `HrWarrantyPage` và `ClientWarrantyPage`: với bảo hành `VOIDED` của job HEADHUNT_COD, hiện khối "Suất thay thế" của job đó (trạng thái, người đã nghỉ, hạn chót, người thay thế).
- Internal HR: nút "Hủy suất" (modal nhập lý do) cho suất `WAITING_PAYMENT` / `OPEN`.

**Nhãn gợi ý:** `WAITING_PAYMENT` "Chờ Client thanh toán", `OPEN` "Đang tìm người thay thế", `FILLED` "Đã có người thay thế", `CANCELLED` "Đã hủy", `EXPIRED` "Hết hạn".

---

## 3. 🔴 Chuông thông báo

**Hiện trạng FE:** `components/notifications/NotificationBell.tsx` (gắn trong `ClientShell`, `HrLayout`) đọc `stores/alertStore`, là dữ liệu trên máy, không lấy từ server. Header cũ `components/layout/Header.tsx`, `CandidateHeader.tsx` đọc `localStorage['hrconnect_notifications']`. Cổng Candidate, Affiliate, Admin chưa có chuông. **Code BE:** `Endpoints/V1/Notifications/NotificationEndpoints.cs`.

| Method | Route | Response `data` |
|---|---|---|
| `GET` | `/notifications?page=1&pageSize=20&type=&isRead=` | `{ items: NotificationDto[], page, pageSize, totalCount, totalPages }` |
| `GET` | `/notifications/unread-count` | `{ unreadCount }` |
| `POST` | `/notifications/{notificationId}/read` | |
| `POST` | `/notifications/read-all` | |

```jsonc
// NotificationDto
{ "notificationId": "uuid", "notificationType": "JOB", "title": "...", "message": "...",
  "relatedEntityType": "JOB", "relatedEntityId": "uuid", "routeHint": "/client/jobs/...",
  "isRead": false, "readAt": null, "createdAt": "...", "metadata": "{...json string...}" }
```

**Việc cần làm:**

- `NotificationBell` lấy dữ liệu từ API (số chưa đọc làm mới mỗi 60 giây và khi mở chuông); bấm một thông báo → gọi `read` rồi điều hướng theo `routeHint` (nếu `null` thì chỉ đánh dấu đọc).
- Gắn `NotificationBell` vào layout Candidate, Affiliate, Admin.
- Bỏ phần đọc `localStorage['hrconnect_notifications']`. `alertStore` chỉ giữ nếu còn dùng cho toast tạm thời; không dùng làm nguồn thông báo.

---

## 4. 🔴 Sửa đường dẫn offer và phỏng vấn của ứng viên (đang gọi sai, sẽ 404)

**Hiện trạng FE (commit `b41352d`, nhánh `codex/mf04-candidate-ui-handoff`):** `CandidateApplicationDetailPage` đã có khối lịch phỏng vấn và offer qua `services/api/mf04Api.ts`, nhưng 3 hàm gọi **đường dẫn backend không có**:

| Hàm trong `mf04Api.ts` | Đang gọi (sai) | Sửa thành (route thật) |
|---|---|---|
| `getInterviews` | `GET /recruitment/interviews` | `GET /interviews?applicationId={id}` |
| `getOffers` | `GET /recruitment/offers` | `GET /offers?applicationId={id}` |
| `respondOffer` | `POST /recruitment/offers/{id}/respond` | `POST /offers/{offerId}/response` |

- Body `respondOffer` giữ nguyên: `{ "response": "ACCEPTED" | "DECLINED", "declineReason": "...", "concurrencyToken": "uuid" }`. Backend chỉ nhận chữ in hoa; bỏ `'Accepted' | 'Declined'` khỏi type `RespondOfferRequest` (`types/api/mf04.ts`). `DECLINED` bắt buộc `declineReason`.
- `getOffers` đang đọc `o.canRespond`, nhưng backend **không trả** trường này → luôn `false`, nút Chấp nhận/Từ chối không bao giờ hiện. Tự tính ở FE: `status === 'SENT'` và `expiryDate` chưa qua.
- Sửa mock trong `mf04Api.test.ts` và `CandidateApplicationDetailPage.test.tsx` theo route mới.
- **Nghiệm thu:** chạy backend local, Client gửi offer → Candidate mở chi tiết đơn thấy offer và bấm Chấp nhận được; Swagger/network không còn 404.

---

## 5. 🟠 Việc làm đã lưu của ứng viên

**Hiện trạng FE:** `hooks/useSavedJobs.ts` dùng `localStorage`. **Code BE:** `Endpoints/V1/Candidates/CandidateSavedJobEndpoints.cs`.

| Method | Route | Response `data` |
|---|---|---|
| `GET` | `/candidates/me/saved-jobs?page=&pageSize=` | `{ items: [{ savedJobId, savedAt, job: JobListItemDto }], page, pageSize, totalCount, totalPages }` |
| `POST` | `/candidates/me/saved-jobs/{jobId}` | `{ success, message, savedJobId }`. Idempotent: lưu lại không tạo trùng |
| `DELETE` | `/candidates/me/saved-jobs/{jobId}` | |

`job` có cùng dạng với danh sách job công khai (`JobListItemDto`), dùng lại type đã có. Giữ nguyên giao diện nút "Lưu", chỉ đổi nguồn dữ liệu; chỉ gọi khi đăng nhập Candidate (khách bấm "Lưu" thì chuyển sang đăng nhập). Xóa phần dọn `localStorage` cũ trong hook.

---

## 6. 🟠 Chi tiết phỏng vấn cho Client

**Hiện trạng FE:** `hrApi.ts` đã có danh sách, tạo, dời, hủy, ghi kết quả, vắng mặt; **chưa có** xem chi tiết, sửa và lịch sử. **Code BE:** `Endpoints/V1/Recruitment/InterviewEndpoints.cs`.

| Method | Route | Body |
|---|---|---|
| `GET` | `/interviews/{interviewId}` | |
| `PUT` | `/interviews/{interviewId}` | `{ "durationMinutes", "interviewType", "location", "meetingLink", "participants": [...], "concurrencyToken" }` |
| `GET` | `/interviews/{interviewId}/history` | |

Làm drawer chi tiết buổi phỏng vấn trong `ClientWorkspaceInterviewsOffersPage`: thông tin, nút sửa (đổi **giờ** vẫn dùng API `reschedule` đã có; `PUT` chỉ sửa thời lượng, hình thức, địa điểm, link, người tham gia), tab "Lịch sử thay đổi".

---

## 7. 🟠 Chi tiết placement

`GET /placements/{placementId}` (`Endpoints/V1/Recruitment/PlacementEndpoints.cs`; Client và Internal HR). Response gồm: `candidate` (`fullName`, `email`, `phone`, `summary`), `job` (`title`, `companyName`), `offer` (`salary`, `currencyCode`, `startDate`, `status`, `offerDocumentUrl`), `probation` (`startDate`, `endDate`, `result`, `notes`), `warranty` (`startDate`, `endDate`, `status`, `resultNote`).

**Không** có phí và hoa hồng trong response này; phần đó lấy từ `financeApi.ts` (`/service-fees`, `/commissions` lọc theo placement) như hiện tại. Dùng cho drawer "Chi tiết placement" mở từ `HrWarrantyPage` / `ClientWarrantyPage`.

---

## 8. 🟠 Bật / tắt Commission Rule (Admin)

`adminApi.ts` đã có danh sách, xem, tạo, sửa. Thêm (không có body):

```http
PATCH /admin/commission-rules/{commissionRuleId}/activate
PATCH /admin/commission-rules/{commissionRuleId}/deactivate
```

Thêm công tắc trạng thái trên bảng trong `AdminCommissionRulesPage.tsx`, có hộp xác nhận. Response không bọc `{ success, data }`: kiểm tra trên Swagger.

---

## 9. ✅ Ứng viên rút hồ sơ: đã có

`mf04Api.withdrawApplication` gọi đúng `POST /recruitment/applications/{applicationId}/withdraw` (commit `b41352d`). Chỉ cần kiểm tra lại khi làm mục 4.

---

## 10. 🟡 Dọn trang cũ dùng mock

Các file sau vẫn import `services/mockData`, `mockWebSocket` hoặc store trên máy:

- `features/admin/AdminDashboard.tsx`, `pages/client/ClientDashboardPage.tsx`, `pages/hr/HRDashboardPage.tsx`
- `features/jobs/ClientJobsPage.tsx`, `features/affiliate/ReferralForm.tsx`
- `features/candidates/CandidateApplicationsPage.tsx`, `stores/candidateStore.ts`
- `services/queries/useCandidates.ts`, `services/queries/useFinancials.ts`, `services/localStorageService.ts`

Với từng file: kiểm tra trong `app/router.tsx` còn được route không. Không còn route → xóa file và lazy import trong `routes/AppRoutes.tsx`. Còn route nhưng đã có trang mới thay (`features/*-console`, `features/portal`, `features/finance-mf05`) → chuyển route sang trang mới rồi xóa. Ghi lại danh sách giữ / xóa trong mô tả PR.

---

## 11. 🔴 Dashboard báo cáo (Platform Admin) & Đánh giá chất lượng Affiliate (BE-tasks-01 - ĐÃ CÓ API)

> **Căn cứ:** [`BE-tasks-01`](../../../HRConnect/docs/tasks/BE-tasks-01-bao-cao-va-danh-gia-affiliate.md) đã hoàn thành cả Phần A và Phần B.

### A. Dashboard báo cáo Platform Admin (Quyền `report.view`)

| Method | Route | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/reports/overview?from=&to=` | `report.view` | Báo cáo tổng quan: việc làm theo trạng thái/dịch vụ, hồ sơ, tuyển dụng, doanh thu, hoa hồng, phân hạng affiliate |
| `GET` | `/reports/revenue?from=&to=&groupBy=MONTH\|QUARTER\|YEAR` | `report.view` | Báo cáo doanh thu phát sinh/thực thu theo gói dịch vụ và chuỗi thời gian gom nhóm |
| `GET` | `/reports/top-affiliates?from=&to=&sortBy=PLACEMENTS\|SUBMISSION_TO_HIRE_RATE\|COMMISSION_EARNED&limit=10` | `report.view` | Bảng xếp hạng Top Affiliate theo placements, tỷ lệ chuyển đổi hoặc hoa hồng |
| `GET` | `/reports/top-companies?from=&to=&sortBy=PLACEMENTS\|REVENUE\|ACTIVE_JOBS&limit=10` | `report.view` | Bảng xếp hạng Top Doanh nghiệp chi tiêu cao nhất hoặc nhiều job nhất |

### B. Hiệu suất & Đánh giá chất lượng Affiliate

| Method | Route | Quyền | Mô tả |
|---|---|---|---|
| `GET` | `/affiliates/me/performance?period=MONTH\|QUARTER\|YEAR` | `affiliate.performance.view_own` | Cho thẻ "Hiệu suất của tôi" trên portal Affiliate (kỳ hiện tại + mảng `history`) |
| `GET` | `/admin/affiliates/{affiliateId}/performance?period=MONTH\|QUARTER\|YEAR` | `report.view` | Admin xem lịch sử hiệu suất và xếp hạng của từng Affiliate |
| `POST` | `/admin/affiliate-performance/recalculate` | `report.view` | Body: `{ "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "affiliateId": null }`. Tính lại hiệu suất |

**Response mẫu `GET /affiliates/me/performance`:**
```jsonc
{
  "success": true,
  "data": {
    "affiliateId": "uuid",
    "displayName": "Đối Tác A",
    "affiliateType": "INDIVIDUAL",
    "periodStart": "2026-10-01",
    "periodEnd": "2026-10-31",
    "totalSubmissions": 10,
    "totalShortlisted": 4,
    "totalInterviews": 3,
    "totalPlacements": 2,
    "submissionToHireRate": 0.2,
    "qualityRating": 4.1,
    "ratingLabel": "EXCELLENT", // EXCELLENT | GOOD | AVERAGE | LOW | NEW
    "calculationVersion": "v1",
    "calculatedAt": "2026-10-16T15:00:00Z",
    "history": [
      {
        "periodStart": "2026-09-01",
        "periodEnd": "2026-09-30",
        "totalSubmissions": 8,
        "totalShortlisted": 3,
        "totalPlacements": 1,
        "qualityRating": 3.2,
        "ratingLabel": "GOOD",
        "calculatedAt": "..."
      }
    ]
  }
}
```

---

## 12. ✅ Form liên hệ tư vấn dịch vụ (SF-05) - ĐÃ HOÀN THÀNH

> **Căn cứ:** [`FE-tasks-be04-lien-he-cv-builder-goi-y-viec-realtime.md`](../../../HRConnect/docs/tasks/FE-tasks-be04-lien-he-cv-builder-goi-y-viec-realtime.md) Mục 1 (SF-05).

### A. Phía Trang Công Khai (Guest - không cần đăng nhập)
- **API Client:** `POST /public/contact-requests` (`contactApi.submit`).
- **Body:** `{ fullName, email, phone?, companyName?, serviceInterest, message, consentAccepted }`.
- **Giao diện:**
  - Trang công khai `/contact` (`ContactPage.tsx`) và form tư vấn (`ContactConsultationForm.tsx`).
  - Liên kết điều hướng từ `Navbar.tsx` (mục "Liên hệ" trên desktop & drawer mobile) và CTA trong `ServicesPage.tsx`.
  - Checkbox bắt buộc đồng ý xử lý dữ liệu cá nhân theo Nghị định 13/2023/NĐ-CP (chặn submit client-side & bắt lỗi `400 CONSENT_REQUIRED` từ backend).
  - Bắt lỗi `429 CONTACT_RATE_LIMITED`: hiển thị thông báo "Bạn gửi quá nhiều, vui lòng thử lại sau" kèm thời gian chờ nếu có.
  - Thành công: hiển thị Receipt mã yêu cầu, thời gian gửi, trạng thái `NEW` và nút gửi yêu cầu khác (reset form).

### B. Phía Màn Quản Lý (Platform Admin, Internal HR)
- **API Clients:**
  - `GET /admin/contact-requests?status=&page=&pageSize=` (`contactApi.list`).
  - `PATCH /admin/contact-requests/{id}` (`contactApi.updateStatus`).
- **Giao diện:**
  - Trang `/admin/contact-requests` và `/hr/contact-requests` (`AdminContactRequestsPage.tsx`).
  - Tích hợp menu vào Sidebar `AdminLayout.tsx` và `HrLayout.tsx` (nhóm "Vận hành").
  - Bảng danh sách với các cột: Họ tên, Email, Số điện thoại, Công ty, Dịch vụ quan tâm, Trạng thái (`NEW` / `CONTACTED` / `CLOSED`), Ngày tạo, Ghi chú, Thao tác.
  - Bộ lọc trạng thái bằng `FilterPills` (`Tất cả`, `Mới tiếp nhận`, `Đã liên hệ`, `Đã đóng`) và ô tìm kiếm nhanh.
  - Drawer xem chi tiết toàn bộ nội dung yêu cầu và Modal cập nhật trạng thái + ghi chú nội bộ.

---

## 13. ✅ Gợi ý "Việc phù hợp" cho Candidate (SF-07) - ĐÃ HOÀN THÀNH

> **Căn cứ:** [`FE-tasks-be04-lien-he-cv-builder-goi-y-viec-realtime.md`](../../../HRConnect/docs/tasks/FE-tasks-be04-lien-he-cv-builder-goi-y-viec-realtime.md) Mục 3 (SF-07).

### A. API Client & Types
- **API Client:** `GET /candidates/me/job-matches` (`candidateJobMatchApi.getJobMatches`).
- **Response DTO:** Mảng tối đa 20 gợi ý:
  `Array<{ candidateJobMatchId, jobId, jobTitle, companyName, location, matchScore, generatedAt, expiresAt }>`.

### B. Giao diện Candidate & Điều hướng thông báo
- **Giao diện:**
  - Component `CandidateJobMatchesSection.tsx`: hiển thị thẻ việc làm kèm điểm phù hợp nổi bật (ví dụ: `Phù hợp 83%`, badge tone theo ngưỡng điểm).
  - Tích hợp Tabs trên trang Tìm việc `/candidate/jobs` (`CandidateJobPages.tsx`): tab **Việc phù hợp với bạn** và tab **Tất cả việc làm**, đồng bộ URL param `?tab=matches` / `?tab=all`.
  - Tích hợp section gợi ý việc làm trên Candidate Dashboard `/candidate/dashboard` (`CandidateHomePage` trong `CandidatePages.tsx`).
  - Xử lý trạng thái rỗng (Empty State): hiển thị lời nhắc *"Bật hồ sơ công khai và đặt CV chính để nhận gợi ý việc làm"* kèm 2 nút điều hướng tới **Hồ sơ cá nhân** (`/candidate/profile`) và **Kho CV** (`/candidate/cvs`). Không đặt nút làm mới liên tục vì backend cập nhật định kỳ (~1h/lần).
- **Điều hướng thông báo (Notification routing):**
  - Cập nhật `NotificationBell.tsx`: xử lý thông báo loại `JOB_FIT`, đọc `metadata.routeHint` (hoặc `metadata.jobId`) để chuyển hướng trực tiếp tới trang chi tiết công việc `/jobs/{jobId}` (hoặc danh sách việc phù hợp). Icon thông báo dạng tia sét (`ThunderboltOutlined`).

---

## 14. ✅ Chuông thông báo realtime với SignalR cho mọi vai trò (SF-08) - ĐÃ HOÀN THÀNH

> **Căn cứ:** [`FE-tasks-be04-lien-he-cv-builder-goi-y-viec-realtime.md`](../../../HRConnect/docs/tasks/FE-tasks-be04-lien-he-cv-builder-goi-y-viec-realtime.md) Mục 4 (SF-08).

### A. Thư viện & Khởi tạo Kết nối SignalR
- **Thư viện:** `@microsoft/signalr` (^8.0.7).
- **Service:** `src/services/signalRNotificationService.ts`:
  - **Hub URL Resolution:** Tự động cắt bỏ `/api/v1` từ `API_BASE_URL` -> kết nối đến `${API_ORIGIN}/hubs/notifications`.
  - **Vite Proxy:** Bổ sung rule `/hubs` với `ws: true` trong `vite.config.ts`.
  - **Xác thực:** Truyền Bearer JWT Token qua `accessTokenFactory: () => authTokenStorage.getAccessToken() || ''`.
  - **Tự động kết nối lại:** `.withAutomaticReconnect()`.
  - **Quản lý vòng đời:** Kết nối khi đăng nhập (có token); ngắt kết nối (`stop()`) khi đăng xuất hoặc khi nhận sự kiện `hrconnect:unauthorized`.

### B. Hook & Xử lý sự kiện Realtime (`useNotificationSignalR.ts`)
- **Sự kiện `notification.created`:**
  - Nhận payload `{ notification, unreadCount }`.
  - Cập nhật ngay lập tức query cache unreadCount (`['notifications', 'unread-count']`).
  - Chèn trực tiếp notification mới vào đầu danh sách `['notifications', 'list']` mà không reload trang.
  - Hiển thị Ant Design toast notification (`antNotification.info`) góc trên bên phải màn hình kèm route click để điều hướng nhanh.
- **Sự kiện `interview.updated`:**
  - Nhận payload `{ interviewId }`.
  - Tự động invalidate / refetch tất cả query liên quan tới lịch phỏng vấn: `['interviews']`, `['hr-pipeline']`, `['client-overview', 'interviews']`, `['candidate', 'interviews']`, `['candidate-interviews']`, `['client-interviews']`, `['candidate-applications']`.

### C. Cơ chế dự phòng (Fallback & Adaptive Polling)
- Tích hợp hook vào `NotificationBell.tsx` dùng chung cho toàn bộ layout (Candidate, Client, HR, Affiliate, Admin).
- Khi SignalR kết nối thành công (`isConnected === true`): tạm dừng polling định kỳ (`refetchInterval: false`) để tối ưu 100% tài nguyên server.
- Khi mất kết nối hoặc đang reconnecting: tự động kích hoạt polling định kỳ 60s làm dự phòng.
- Hiển thị chấm trạng thái tinh tế (xanh lục khi realtime hoạt động) trong popover thông báo.

---

## 15. ✅ Tạo CV theo mẫu / Dựng trên nền tảng cho Candidate (SF-06) - ĐÃ HOÀN THÀNH

> **Căn cứ:** [`FE-tasks-be04-lien-he-cv-builder-goi-y-viec-realtime.md`](../../../HRConnect/docs/tasks/FE-tasks-be04-lien-he-cv-builder-goi-y-viec-realtime.md) Mục 2 (SF-06).

### A. API Client & Types
- **Thư viện/File:** `src/types/api/cvBuilder.ts` và `src/services/api/cvBuilderApi.ts` (cũng được re-export tiện lợi qua `candidateCvApi`).
- **Endpoints:**
  - `GET /api/v1/cv-templates`: Danh sách mẫu CV (`cvTemplateId`, `code`, `name`, `description`, `templateConfig` gồm `accentColor`, `density`, `sections`).
  - `POST /api/v1/candidates/cv/structured`: Tạo CV mới có cấu trúc từ mẫu hoặc tự dựng (`cvTemplateId = null`).
  - `GET /api/v1/candidates/cv/structured/{cvId}`: Lấy dữ liệu CV có cấu trúc để điền vào form chỉnh sửa.
  - `PUT /api/v1/candidates/cv/structured/{cvId}`: Cập nhật nội dung CV có cấu trúc.
- **Quy tắc nghiệp vụ & Validation (`validateStructuredCvContent`):**
  - Bắt buộc phải có `fullName` và `title`.
  - Bắt buộc phải có ít nhất 1 trong 4 mục: `summary` (mục tiêu), `experiences` (kinh nghiệm), `educations` (học vấn), hoặc `skills` (kỹ năng). Chặn submit ngay từ client nếu trống và hiển thị thông báo tiếng Việt trực quan khi backend trả lỗi 400 `CV_CONTENT_EMPTY`.
  - Phân quyền & hiển thị nút: Nút **"Sửa nội dung"** trong Kho CV (`/candidate/cvs`) chỉ hiển thị cho CV có `creationMethod` là `TEMPLATE_FORM` hoặc `PLATFORM_BUILDER`. CV tải tệp lên (`UPLOAD`) ẩn nút sửa hoặc chặn báo lỗi 400 `CV_NOT_STRUCTURED`.

### B. Giao diện (Candidate CV Creation & Builder UI)
- **Modal CV Builder (`CandidateCvBuilderModal.tsx`):**
  - **Bước 1 (Chọn phương thức tạo CV):**
    1. Tải file PDF có sẵn (Upload).
    2. Dựng CV theo mẫu đẹp: hiển thị danh sách từ `/cv-templates` với badge màu chủ đạo (`accentColor`) và chế độ hiển thị (`density`).
    3. Tự dựng CV nhanh (Chuẩn ATS, `cvTemplateId = null`).
  - **Bước 2 (Form nhập liệu nội dung CV):**
    - Thông tin cá nhân & liên hệ (Họ tên, chức danh, email, SĐT, địa chỉ).
    - Mục tiêu nghề nghiệp (Summary) kèm bộ đếm ký tự.
    - Kinh nghiệm làm việc (Thêm/xóa dòng linh hoạt, chức danh, công ty, thời gian bắt đầu/kết thúc, mô tả).
    - Học vấn & bằng cấp (Thêm/xóa dòng, trường học, bằng cấp, thời gian).
    - Kỹ năng, Ngôn ngữ & Chứng chỉ: Tag input gõ Enter hoặc bấm nút thêm, kèm gợi ý kỹ năng phổ biến.
    - Thanh đo độ hoàn thiện hồ sơ (Completeness progress bar) cập nhật theo thời gian thực.
  - **Tích hợp Kho CV (`/candidate/cvs`):**
    - Nút "Tạo CV mới" trên header và khung điều hướng bên cạnh.
    - Nút "Sửa nội dung" trên từng thẻ CV có cấu trúc.
    - Nhãn phân loại trực quan: badge "Mẫu thiết kế" (tím), "Tự dựng" (xanh dương), "CV chính" (amber/primary).
    - Hỗ trợ URL redirect: `/cv-builder` chuyển hướng mượt mà sang `/candidate/cvs?action=builder`.

---

## Chưa làm được (backend chưa có API)

Danh bạ công ty, bộ lọc kinh nghiệm/ngành ([`BE-tasks-02`](../../../HRConnect/docs/tasks/BE-tasks-02-nganh-danh-ba-cong-ty-loc-job.md)); khiếu nại tranh chấp trùng ([`BE-tasks-03`](../../../HRConnect/docs/tasks/BE-tasks-03-tranh-chap-trung-sf04.md)). Đợi backend merge rồi giao tiếp; không làm số liệu giả.

## Thứ tự gợi ý

1. **4** (sửa đường dẫn offer/phỏng vấn, nhỏ, đang lỗi 404) rồi **3** (thông báo).
2. **1** (giao CV CV_SOURCING) và **2** (suất thay thế): màn mới, ảnh hưởng tiền.
3. **5 → 8**.
4. **10** khi rảnh, tách PR riêng.

Mỗi mục một nhánh `feature/fe-<tên-ngắn>` tạo từ `dev`, PR vào `dev`.

**Hạn (đã chốt, trong tuần 15–18/10/2026):**

| Ngày | Mục |
|---|---|
| Thứ Năm 15/10 | 4 |
| Thứ Sáu 16/10 | 3 |
| Thứ Bảy 17/10 | 1, 2 (không kịp thì ưu tiên 1, lùi 2) |
| Chủ nhật 18/10 | 5, 6, 7, 8 |
| Sau tuần này | 10 |

"Xong" = PR đã mở vào `dev`, test và build pass.

## Nghiệm thu chung

- Không còn đọc/ghi `localStorage` cho thông báo, việc đã lưu, offer.
- Mỗi màn hình mới có trạng thái đang tải, rỗng, lỗi; xử lý `409` bằng cách tải lại dữ liệu; nút ẩn theo quyền.
- Thử bằng tài khoản thật của từng vai trò (Internal HR, Client, Candidate, Admin) trên backend local.
- `npm run test` và `npm run build` của FE pass.
