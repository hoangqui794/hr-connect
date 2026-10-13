# MF-04 — Candidate Profile và Recruitment Lifecycle UI

Tài liệu này ghi nhận hiện trạng hoàn thiện và hợp đồng giao tiếp thực tế giữa Backend và Frontend cho module **MF-04 (Hồ sơ ứng viên & Vòng đời tuyển dụng)**.

---

## 1. Hợp đồng API Frontend Thực tế (`src/services/api/mf04Api.ts`)

### 1.1. Hồ sơ ứng viên (Candidate Profile)
- `GET /api/v1/candidates/profile/me`: Lấy thông tin hồ sơ ứng viên từ cơ sở dữ liệu.
- `PUT /api/v1/candidates/profile/me`: Cập nhật thông tin hồ sơ bao gồm 9 trường nghề nghiệp mới.
- `PATCH /api/v1/candidates/profile/me/visibility`: Cập nhật chế độ hiển thị hồ sơ (`PUBLIC` / `PRIVATE`).

**9 trường nghề nghiệp cốt lõi:**
1. `currentJobTitle` (string): Chức danh công việc hiện tại.
2. `currentLevel` (string): Cấp bậc chuyên môn (Intern, Fresher, Junior, Mid-Level, Senior, Lead, Manager, Director).
3. `targetRole` (string): Vị trí mục tiêu mong muốn.
4. `expectedSalaryMin` (number): Mức lương tối thiểu kỳ vọng.
5. `expectedSalaryMax` (number): Mức lương tối đa kỳ vọng.
6. `expectedSalaryCurrency` (string): Loại tiền tệ (`VND` / `USD`).
7. `availableFrom` (string - YYYY-MM-DD): Ngày sớm nhất có thể nhận việc.
8. `preferredLocations` (string[]): Danh sách địa điểm ưu tiên (Hà Nội, TP.HCM, Đà Nẵng, Remote,...).
9. `preferredWorkModes` (string[]): Hình thức làm việc mong muốn (`ONSITE`, `HYBRID`, `REMOTE`).

### 1.2. Chi tiết Đơn ứng tuyển (Application Detail & Lifecycle)
- `GET /api/v1/recruitment/applications/:id`: Trả về chi tiết đơn ứng tuyển với `concurrencyToken`, `allowedActions`, `interviews`, `offers`, `placement` và `submittedCv`.
- `GET /api/v1/recruitment/applications/:id/timeline`: Dòng thời gian công khai (đã lọc sạch nội bộ).
- `GET /api/v1/recruitment/applications/:id/cv/download-url`: Trả về Presigned URL tải CV đã nộp theo đơn.
- `POST /api/v1/recruitment/applications/:id/withdraw`: Rút đơn ứng tuyển (gửi kèm `reason` và `concurrencyToken`).
- `GET /api/v1/recruitment/interviews`: Lấy danh sách lịch phỏng vấn của ứng viên.
- `GET /api/v1/recruitment/offers`: Lấy danh sách lời mời nhận việc (kèm cờ `canRespond`).
- `POST /api/v1/recruitment/offers/:id/respond`: Phản hồi nhận việc (`Accepted` / `Declined` kèm `declineReason` và `concurrencyToken`).

---

## 2. Giao diện Frontend đã hoàn thiện

### 2.1. `/candidate/profile`
- **Nguồn sự thật Database:** Bỏ hoàn toàn phụ thuộc vào `localStorageService`. Dữ liệu tải từ DB qua TanStack Query và cập nhật vào DB.
- **9 trường nghề nghiệp:** Form nhập liệu đầy đủ cho 9 trường chuyên môn và dải lương.
- **Định danh an toàn:** Email đăng nhập hiển thị dạng read-only, có liên kết hướng dẫn tới trang quản lý danh tính MF-02.
- **Chế độ hiển thị:** Nút chuyển đổi Công khai / Riêng tư cập nhật tức thì qua API.
- **Bản tóm tắt CV:** Thẻ CV mặc định kết nối với kho CV MF-02 và công cụ soạn thảo ATS.

### 2.2. `/candidate/applications/:applicationId`
- **Hành động hướng server (`allowedActions`):**
  - Nút *Rút đơn ứng tuyển* chỉ xuất hiện khi server trả `allowedActions.includes('WITHDRAW_APPLICATION')`.
  - Nút *Phản hồi Offer* chỉ xuất hiện khi `offer.canRespond === true`.
- **Tải CV bảo mật:** Nút tải file CV đã nộp mở Presigned URL tải an toàn.
- **Lịch phỏng vấn (Interviews):** Hiển thị vòng, thời gian, hình thức, địa điểm và nút tham gia phòng họp trực tuyến (`meetingLink`).
- **Lời mời nhận việc (Offers):** Hiển thị chi tiết lương thưởng, hạn phản hồi, nút tải tài liệu offer và modal phản hồi (Đồng ý / Từ chối kèm lý do).
- **Dòng thời gian công khai (Public Timeline):** Render timeline sự kiện sạch sẽ, tuyệt đối không rò rỉ đánh giá hay ghi chú nội bộ của nhà tuyển dụng.
- **Xử lý xung đột Concurrency (`409 Conflict`):** Bắt mã lỗi HTTP 409 khi token bị thay đổi, hiển thị cảnh báo người dùng và tự động làm mới snapshot dữ liệu.

---

## 3. Danh mục Kiểm thử UI & API

1. ✅ **Types & Service API:** `src/services/api/mf04Api.test.ts` (10/10 tests pass).
2. ✅ **Candidate Profile Page:** `src/features/candidates/CandidateProfilePage.test.tsx` (kiểm tra load DB, validate 9 trường, lỗi DB).
3. ✅ **Candidate Application Detail Page:** `src/features/portal/CandidateApplicationDetailPage.test.tsx` (kiểm tra tải MF-04, allowedActions, withdraw modal, respond offer modal, xử lý lỗi 409).
4. ✅ **Type Safety:** `npx tsc --noEmit` hoàn thành với **0 lỗi TypeScript**.
