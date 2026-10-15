# BE task 04: Các mục cần hỏi GVHD trước khi làm (có thể ghi "hướng phát triển")

> **Việc:** hỏi GVHD trước, sau đó giao dev theo kết quả. **Ngày:** 2026-10-15. **Ưu tiên:** 🟡 Thấp.
> **Mục đích:** 3 chức năng dưới đây có trong đề tài nhưng không nằm trên luồng chính và tốn công. Hỏi thầy Phạm Minh Trí xem có thể **ghi vào báo cáo là hướng phát triển** hay phải làm. Mỗi mục có sẵn **phương án tối thiểu** nếu thầy yêu cầu làm.
> **Hiện trạng code:** GitNexus, `main` `5640eb1`.

---

## Câu hỏi gửi GVHD (copy được)

> Thưa thầy, nhóm HR Connect đã hoàn thành 5 luồng chính. Còn 3 chức năng trong đề tài nhóm muốn xin ý kiến thầy có thể đưa vào phần "Hướng phát triển" của báo cáo không, hay cần làm trong đồ án:
> 1. **Form liên hệ tư vấn** trên trang công khai.
> 2. **Tạo CV 3 cách** (dựng trên nền tảng, theo mẫu, tải file). Hiện nhóm đã làm cách **tải file** (có AI đọc CV).
> 3. **Thông báo việc làm phù hợp** cho ứng viên do AI gợi ý, và **cập nhật realtime** (SignalR). Hiện thông báo đã lưu trên hệ thống và giao diện tự tải lại định kỳ.
>
> Nếu cần làm, nhóm đề xuất làm bản tối thiểu như mô tả kèm theo. Em cảm ơn thầy.

Ghi lại câu trả lời của thầy vào cuối file này (mục "Kết quả").

---

## 1. Form liên hệ tư vấn

**Đề tài:** Web Portal "public site: home, company directory, job listings, service pages, **contact form**".
**Hiện trạng:** không có bảng, không có API. `main-flows.md` / tài liệu Actor ghi Guest "form liên hệ tư vấn **[CHƯA CÓ CODE]**".

**Phương án tối thiểu (khoảng 1 ngày):**

- Bảng `contact_request`: `contact_request_id`, `full_name`, `email`, `phone` null, `company_name` null, `service_interest` (`HEADHUNT_COD` | `CV_SOURCING` | `CV_APPLICATION` | `OTHER`), `message`, `status` (`NEW` → `CONTACTED` → `CLOSED`), `handled_by` null, `note` null, `created_at`, `updated_at`.
- `POST /api/v1/public/contact-requests` (Guest): validate, giới hạn tần suất theo IP (chống spam), gửi email báo cho hộp thư vận hành (`ResendEmailService` đã có, địa chỉ nhận đọc từ cấu hình).
- `GET /api/v1/admin/contact-requests`, `PATCH /api/v1/admin/contact-requests/{id}` (Platform Admin / Internal HR): xem và đổi trạng thái.
- Dữ liệu cá nhân: chỉ lưu những gì cần, có ô đồng ý xử lý dữ liệu (Nghị định 13/2023).

---

## 2. Tạo CV trên nền tảng / theo mẫu

**Đề tài:** "candidate account and profile creation (build-on-platform, template-based, or upload)".
**Hiện trạng:** **cơ sở dữ liệu đã chuẩn bị sẵn** nhưng chưa có code dùng:
- `cv_template` (entity `CvTemplate`: `Code`, `Name`, `PreviewUrl`, `TemplateConfig`, `IsActive`): không có handler/endpoint nào.
- `candidate_cv` đã có `CreationMethod`, `CvTemplateId`, `StructuredContent`, `RenderedFileUrl`; hiện chỉ dùng cho file tải lên.

**Phương án tối thiểu (khoảng 3–4 ngày, cần FE làm form):**

- Seed 2–3 mẫu CV (`TemplateConfig` mô tả các mục: thông tin, kinh nghiệm, học vấn, kỹ năng, ngôn ngữ).
- `GET /api/v1/cv-templates` (Candidate).
- `POST /api/v1/candidates/cv/structured` `{ "title", "cvTemplateId" | null, "structuredContent": {...} }` → `CreationMethod = TEMPLATE` hoặc `BUILDER`; server render PDF (thư viện QuestPDF hoặc tương đương) lưu R2 vào `RenderedFileUrl`, để AI (MF-03) và nộp hồ sơ (MF-02) dùng như CV tải lên.
- `PUT` để sửa, render lại.
- **Rủi ro:** thêm thư viện render PDF; phải đảm bảo PDF sinh ra qua được `PdfCvValidator` của MF-02.

---

## 3. Thông báo việc phù hợp (AI) và realtime

**Đề tài:** Candidate "receives AI-generated job-fit notifications"; Candidate Portal "job-match notifications"; Backend "SignalR for real-time interview/notification updates".
**Hiện trạng:**
- Bảng `candidate_job_match` (entity `CandidateJobMatch`: `CandidateId`, `JobId`, `CvId`, `MatchScore`, `MatchTier`, `MatchSummary`, `Status`, `ExpiresAt`) **đã có**, chưa có code dùng.
- Bảng `notification` + API đọc thông báo **đã có**. Không có SignalR hub; FE dùng `mockWebSocket`.

**Phương án tối thiểu:**

- **Gợi ý việc (khoảng 3 ngày):** khi job chuyển `ACTIVE` (MF-01), worker chọn ứng viên có hồ sơ công khai + CV chính, gọi AI service chấm (cùng hợp đồng `match-file` của MF-03, hoặc chỉ dùng điểm Sentence-BERT để rẻ), lưu `candidate_job_match`; điểm ≥ ngưỡng (cài đặt) thì tạo notification loại `JOB_MATCH`. Giới hạn số thông báo mỗi ứng viên mỗi ngày (cài đặt). `GET /api/v1/candidates/me/job-matches`.
  - **Chi phí:** nếu dùng ai-service-v2 (Claude) thì tốn phí theo số cặp CV–job, nên chỉ dùng điểm ngữ nghĩa cho việc gợi ý.
- **Realtime (khoảng 1–2 ngày):** `NotificationHub` (SignalR) gửi sự kiện `notification.created` và `unreadCount` cho đúng người dùng (xác thực JWT qua query string). Khi tạo notification ở bất kỳ luồng nào thì đẩy qua hub. FE giữ cơ chế tải lại định kỳ làm dự phòng. Kiểm tra Render (nơi deploy) có hỗ trợ WebSocket.

---

## Kết quả (điền sau khi hỏi GVHD)

| Mục | Kết quả | Ngày | Người làm (nếu phải làm) |
|---|---|---|---|
| 1. Form liên hệ | | | |
| 2. Tạo CV trên nền tảng / theo mẫu | | | |
| 3. Gợi ý việc + realtime | | | |

Mục nào được ghi "hướng phát triển" thì thêm vào phần **Hướng phát triển** của `main-flows.md` mục 6.4 để báo cáo nhất quán.
