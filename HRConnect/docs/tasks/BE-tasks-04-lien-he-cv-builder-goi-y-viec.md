# BE task 04: Form liên hệ, tạo CV theo mẫu, gợi ý việc phù hợp và realtime

> **Ngày:** 2026-10-17. **Ưu tiên:** 🟡 làm sau BE-01..03, nhưng **bắt buộc** vì đề tài có ghi (không cần hỏi GVHD).
> **Hiện trạng code:** GitNexus trên `dev` ngày 17/10.

Quy ước chung: Vertical Slice + MediatR theo README mục 7; response `{ success, data }`; mọi con số nghiệp vụ đọc từ `IAdminBusinessSettings` (thêm khóa vào `BusinessSettingKeys`); chạy GitNexus `impact` trước khi sửa symbol có sẵn và `detect-changes` trước khi commit.

**Cách làm và bàn giao**

- **Ước lượng:** A: 1 ngày; B: 3–4 ngày (cần FE làm form); C: 3 ngày; D: 1–2 ngày. Bốn phần độc lập, giao được cho nhiều người.
- **Nhánh:** `feature/<tên-ngắn>` tạo từ `dev`, PR vào `dev`, ít nhất 1 người review; CI xanh mới merge.
- **Xong khi:** đạt hết mục nghiệm thu, có unit test, `dotnet test` pass, migration có `.Designer.cs` (test cả trên PostgreSQL thật nếu có trigger/SQL tay), Swagger có mô tả tiếng Việt.
- **Bàn giao FE:** báo Sang khi API từng phần merge vào `dev`.

## Đề tài yêu cầu

| Phần | Trích đề tài | Hiện trạng |
|---|---|---|
| A. Form liên hệ | Web Portal: *"public site: home, company directory, job listings, service pages, **contact form**"* | Chưa có bảng, chưa có API |
| B. Tạo CV 3 cách | Module 2: *"candidate account and profile creation (**build-on-platform, template-based, or upload**)"*; Candidate Portal: *"profile/CV builder with **3 creation modes**"* | Mới có **tải file**. Database đã có sẵn `cv_template` và các cột `candidate_cv.creation_method`, `cv_template_id`, `structured_content`, `rendered_file_url`, chưa có code dùng |
| C. Gợi ý việc phù hợp | Candidate: *"receives **AI-generated job-fit notifications**"*; Candidate Portal: *"**job-match notifications**"* | Bảng `candidate_job_match` đã có, chưa có code dùng. Bảng `notification` và API đọc thông báo đã có |
| D. Realtime | Technologies: *"**SignalR for real-time interview/notification updates**"* | Chưa có hub. FE chuông thông báo đang gọi API định kỳ |

---

## A. Form liên hệ tư vấn

- Bảng `contact_request`: `contact_request_id`, `full_name`, `email`, `phone` null, `company_name` null, `service_interest` (`HEADHUNT_COD` \| `CV_SOURCING` \| `CV_APPLICATION` \| `OTHER`), `message`, `consent_accepted` bool, `status` (`NEW` → `CONTACTED` → `CLOSED`), `handled_by` null, `note` null, `created_at`, `updated_at`.
- `POST /api/v1/public/contact-requests` (Guest): validate; **bắt buộc** `consent_accepted = true` (Nghị định 13/2023); giới hạn tần suất theo IP (cài đặt `contact.rate_limit_per_hour`, mặc định 5); gửi email báo về hộp thư vận hành qua `ResendEmailService` (địa chỉ nhận đọc từ cấu hình `CONTACT_NOTIFY_EMAIL`).
- `GET /api/v1/admin/contact-requests?status=&page=` và `PATCH /api/v1/admin/contact-requests/{id}` `{ status, note }` (Platform Admin, Internal HR).

**Nghiệm thu:** Guest gửi form → có bản ghi `NEW` và email báo; gửi quá giới hạn → `429`; thiếu đồng ý xử lý dữ liệu → `400`; Admin đổi trạng thái có audit.

## B. Tạo CV theo mẫu và dựng trên nền tảng

- Seed 2–3 mẫu CV vào `cv_template` (`TemplateConfig` mô tả các mục: thông tin, mục tiêu, kinh nghiệm, học vấn, kỹ năng, ngôn ngữ, chứng chỉ).
- `GET /api/v1/cv-templates` (Candidate): danh sách mẫu đang bật.
- `POST /api/v1/candidates/cv/structured` `{ "title", "cvTemplateId": "uuid" | null, "structuredContent": { ... } }`:
  - Có `cvTemplateId` → `CreationMethod = TEMPLATE`; không có → `BUILDER` (dựng trên nền tảng, bố cục mặc định).
  - Server **render PDF** (đề xuất QuestPDF), lưu R2, ghi `rendered_file_url`, `source_file_url` trỏ tới PDF đã render để **MF-02 nộp hồ sơ** và **MF-03 chấm AI** dùng như CV tải lên.
- `PUT /api/v1/candidates/cv/{cvId}/structured`: sửa nội dung, render lại. `GET` trả lại `structuredContent` để FE mở form sửa.
- PDF sinh ra **phải qua được `PdfCvValidator`** (MF-02).

**Nghiệm thu:** ứng viên tạo CV từ mẫu → có CV mới trong kho với file PDF; nộp CV đó vào job `CV_APPLICATION` thành công; AI chấm được CV đó.

## C. Gợi ý việc phù hợp (AI)

- Khi job chuyển `ACTIVE` (MF-01) và theo lịch hằng ngày: worker chọn ứng viên có hồ sơ **công khai** (`ProfileVisibility`) và CV chính, thuộc vai trò có `can_view` với Service Type của job.
- Tính điểm bằng **điểm ngữ nghĩa Sentence-BERT** của AI service (rẻ, không gọi LLM), lưu `candidate_job_match` (`MatchScore`, `MatchTier`, `Status`, `ExpiresAt`).
- Điểm ≥ ngưỡng (cài đặt `job_match.notify_min_score`, mặc định 70) → tạo notification loại `JOB_MATCH` kèm `routeHint` tới trang job. Giới hạn số thông báo mỗi ứng viên mỗi ngày (`job_match.max_notifications_per_day`, mặc định 3). Không gợi ý job ứng viên đã nộp.
- `GET /api/v1/candidates/me/job-matches` (Candidate): danh sách gợi ý còn hạn.
- AI service cần thêm 1 endpoint chấm nhanh chỉ dùng điểm ngữ nghĩa, có `X-Service-Token` (việc MF-03).

**Nghiệm thu:** job mới `ACTIVE` khớp với hồ sơ công khai → ứng viên nhận thông báo; ứng viên để hồ sơ riêng tư thì không nhận; không vượt giới hạn mỗi ngày.

## D. Realtime (SignalR)

- `NotificationHub` tại `/hubs/notifications`, xác thực JWT (đọc `access_token` từ query string cho WebSocket); mỗi user vào group riêng theo `UserId`.
- Khi tạo notification ở bất kỳ luồng nào (qua `INotificationRepository`), đẩy sự kiện `notification.created` và `unreadCount` tới đúng user.
- Đẩy sự kiện khi lịch phỏng vấn được tạo, dời, hủy (`interview.updated`) cho ứng viên và Client liên quan.
- FE giữ cơ chế gọi API định kỳ làm dự phòng. Kiểm tra Render hỗ trợ WebSocket (có).

**Nghiệm thu:** Client lên lịch phỏng vấn → chuông ứng viên tăng số ngay, không cần tải lại; mất kết nối thì FE tự quay về gọi định kỳ.

---

## Giao cho FE

Khi từng phần merge, bổ sung vào [`HRConnect-FE/docs/tasks/API-INTEGRATION-BACKLOG.md`](../../../HRConnect-FE/docs/tasks/API-INTEGRATION-BACKLOG.md): form liên hệ ở trang công khai; màn tạo/sửa CV theo mẫu; mục "Việc phù hợp" cho ứng viên; kết nối SignalR cho chuông thông báo.
