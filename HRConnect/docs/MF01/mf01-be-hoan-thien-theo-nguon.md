# MF-01 (Backend): hoàn thiện theo thông lệ của các trang tuyển dụng và luật lao động

> **Dành cho:** dev backend MF-01. Phần giao diện xem [`mf01-fe-hoan-thien-theo-nguon.md`](mf01-fe-hoan-thien-theo-nguon.md).
> **Ngày:** 2026-10-15. **Hiện trạng** được đối chiếu với code trên `main` (commit `d77e363`).
> **Căn cứ:** mỗi mục ghi nguồn ở cuối tài liệu. Đã kiểm chứng: **duyệt tin trước khi công khai** là đúng thông lệ (Indeed), nên giữ nguyên luồng duyệt hiện tại.

Ký hiệu: 🔴 làm trước · 🟠 cần làm · 🟡 việc nhỏ.

---

## Tổng quan

| Mục | Việc | Mức độ | Nguồn |
|---|---|---|---|
| H1 | Ứng viên **báo cáo tin tuyển dụng**, Internal HR xử lý | 🔴 | [N1], [N2] |
| H2 | **Đóng job khi còn hồ sơ đang xử lý**: bắt buộc chọn cách xử lý và báo cho ứng viên, Affiliate | 🟠 | [N3] |
| H3 | **Sửa nhỏ tin đang tuyển** (ACTIVE) mà không phải đóng tin | 🟠 | [N4] |
| H4 | Lý do từ chối **"Nội dung phân biệt đối xử"** | 🟡 | [N5], [N6] |
| H5 | Các việc nhỏ đã biết | 🟡 | (lỗi trong dự án) |

---

## H1. 🔴 Báo cáo tin tuyển dụng

**Hiện trạng:** không có chức năng nào cho người dùng báo tin lừa đảo hoặc sai sự thật. Indeed có nút "Report job" ở cuối mỗi tin [N1]. TopCV có "Báo cáo tin tuyển dụng" ngay trên trang tin [N2]. Nền tảng có Affiliate và ứng viên thật nên càng cần kênh này.

### H1.1 Bảng `job_report`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `report_id` | uuid PK | |
| `job_id` | uuid FK `job` | |
| `reporter_user_id` | uuid FK `user` | Bắt buộc đăng nhập để báo cáo, tránh spam |
| `reason_code` | varchar(40) | Xem H1.2 |
| `note` | varchar(2000) null | Bắt buộc khi `reason_code = OTHER` |
| `status` | varchar(20) | `OPEN` → `RESOLVED_UNPUBLISHED` / `RESOLVED_KEPT` |
| `resolved_by`, `resolved_at` | uuid null, timestamptz null | |
| `resolution_note` | varchar(2000) null | Bắt buộc khi xử lý |
| `created_at` | timestamptz | |

- **Unique filtered index** `(job_id, reporter_user_id) WHERE status = 'OPEN'`: mỗi người chỉ có 1 báo cáo đang mở cho 1 tin.
- Migration chuẩn (`dotnet ef migrations add AddJobReports`, có `.Designer.cs`, snapshot đồng bộ).

### H1.2 Mã lý do (`JobReportReasons`)

| Mã | Ý nghĩa |
|---|---|
| `ASKS_FOR_MONEY` | Đòi ứng viên nộp tiền, phí, đặt cọc (Indeed coi đây là vi phạm [N1]) |
| `FAKE_COMPANY` | Công ty không có thật hoặc mạo danh |
| `MISLEADING_INFO` | Lương, địa điểm, công việc không đúng thực tế |
| `DISCRIMINATION` | Phân biệt giới tính, độ tuổi… không có lý do công việc [N5] |
| `ALREADY_CLOSED` | Tin đã tuyển xong nhưng vẫn mở |
| `OTHER` | Khác (bắt buộc ghi chú) |

### H1.3 API

| Method | Route | Quyền | Việc |
|---|---|---|---|
| `POST` | `/api/v1/jobs/{jobId}/reports` | Quyền mới **`job.report`**, cấp cho `CANDIDATE` và `AFFILIATE_RECRUITER` | Gửi báo cáo `{ reasonCode, note }`. Chỉ báo được tin `ACTIVE` hoặc `PAUSED`. Đã có báo cáo đang mở thì trả **409 `JOB_REPORT_ALREADY_OPEN`** |
| `GET` | `/api/v1/internal/job-reports?status=&jobId=&page=` | `job.review` | Danh sách báo cáo, gom theo tin: số báo cáo đang mở, lý do, ngày gần nhất |
| `GET` | `/api/v1/internal/job-reports/{reportId}` | `job.review` | Chi tiết báo cáo |
| `POST` | `/api/v1/internal/job-reports/jobs/{jobId}/resolve` | `job.review` | `{ action: "UNPUBLISH" \| "KEEP", note }`. Xử lý **mọi báo cáo đang mở của tin** cùng lúc |

- `UNPUBLISH`: chuyển job sang `CLOSED` với mã lý do mới **`CLOSED_POLICY_VIOLATION`**, ghi lịch sử trạng thái, gửi thông báo cho Client kèm `note`. Hồ sơ đang mở của tin xử lý như H2 với hành động `CLOSE_ALL`.
- `KEEP`: giữ tin, đóng các báo cáo với trạng thái `RESOLVED_KEPT`.
- Người báo cáo **nhận thông báo** khi báo cáo được xử lý. Nội dung chỉ ghi "đã gỡ tin" hoặc "đã xem xét", không lộ chi tiết.
- **Đánh dấu ưu tiên:** tin có từ `mf01.job_report.flag_threshold` báo cáo đang mở trở lên (mặc định **3**, đọc từ BusinessSettings) thì `JobDto` trả `reportFlagged = true` cho Internal HR. **Không tự gỡ tin.** Quyết định gỡ thuộc về HR, vì báo cáo có thể bị lạm dụng.
- Audit log cho mọi thao tác: `JOB_REPORTED`, `JOB_REPORT_RESOLVED`.
- Thông báo dùng `INotificationRepository` sẵn có. Thêm loại thông báo `JOB_REPORT` vào danh sách loại được phép, nếu bảng `notification` có ràng buộc.

---

## H2. 🟠 Đóng job khi còn hồ sơ đang xử lý

**Hiện trạng:** `CloseJobCommand` chỉ đổi trạng thái job, **không đụng tới hồ sơ nào**. Hồ sơ đang `SUBMITTED`, `SCREENING`, `INTERVIEW`… bị treo, ứng viên và Affiliate không được báo. LinkedIn tự gửi thông báo cho ứng viên không được chọn [N3].

### Quy tắc

Hồ sơ **đang mở** là hồ sơ ở các trạng thái `SUBMITTED`, `SCREENING`, `SHORTLISTED`, `BACKUP`, `INTERVIEW` (`ApplicationStates`).

| Tình huống | Xử lý |
|---|---|
| Có hồ sơ `OFFER_PENDING` (offer đang chờ ứng viên trả lời) | **Chặn đóng job**, trả **409 `JOB_HAS_PENDING_OFFERS`**. Phải rút offer trước (MF-04) |
| Hồ sơ `OFFER_ACCEPTED`, `PLACED` | **Không đổi**: đã có kết quả, MF-04 và MF-05 vẫn chạy bình thường |
| Có hồ sơ đang mở mà request **không** có `openApplicationsAction` | Trả **409 `JOB_HAS_OPEN_APPLICATIONS`** kèm số lượng theo từng trạng thái, để giao diện hỏi Client |
| `openApplicationsAction = "CLOSE_ALL"` | Chuyển mọi hồ sơ đang mở sang `CLOSED` (đã có trong `ApplicationStates`), ghi lịch sử trạng thái hồ sơ, lý do = mã đóng job |
| Lịch phỏng vấn `SCHEDULED` của các hồ sơ đó | Chuyển `CANCELLED` |

### API

`POST /api/v1/jobs/{id}/close` thêm trường không bắt buộc **`openApplicationsAction`** (hiện chỉ có `CLOSE_ALL`).

Thêm API đọc trước để giao diện hiện số liệu trước khi đóng:
`GET /api/v1/jobs/{id}/close-impact` → `{ openApplications: { SUBMITTED: 3, INTERVIEW: 1, … }, pendingOffers: 0, scheduledInterviews: 1, affectedAffiliates: 2 }`.

### Thông báo

Mỗi ứng viên có hồ sơ bị đóng nhận thông báo "Vị trí … đã ngừng tuyển". Mỗi Affiliate có ứng viên bị ảnh hưởng nhận **một** thông báo gộp. Toàn bộ thông báo ghi **trong cùng giao dịch** với việc đóng job.

**Lưu ý phân quyền:** ứng viên không được thấy lý do nội bộ, chỉ thấy câu thông báo chung.

---

## H3. 🟠 Sửa nhỏ tin đang tuyển (ACTIVE)

**Hiện trạng:** `UpdateJobCommandHandler` chỉ cho sửa tin `DRAFT` và `REJECTED`. Sai một lỗi chính tả trên tin đang tuyển, Client phải đóng tin rồi đăng lại, và mất hồ sơ đã nhận.

**Căn cứ:** Indeed cho **sửa nhỏ** trên tin đang chạy (ví dụ lỗi chính tả). Còn **thay đổi lớn** như tên vị trí, địa điểm, yêu cầu thì đăng tin mới [N4].

### Quy tắc

| Được sửa khi `ACTIVE` / `PAUSED` | Không được sửa (phải đăng tin mới) |
|---|---|
| `description`, `benefits`, `workingTime`, `salaryNote`, `applicationDeadline` (chỉ được **kéo dài**) | `title`, `location`, `employmentType`, mức lương, kinh nghiệm, `requirements`, `skills`, `quantity`, `serviceTypeId`, điều khoản thương mại (đã chốt) |

- API mới `PATCH /api/v1/jobs/{id}/live-edit`, quyền `job.update_own`, body chỉ gồm các trường được sửa, kèm `concurrencyToken`. Gửi trường không được phép thì trả **400 `FIELD_NOT_EDITABLE_WHEN_ACTIVE`** kèm tên trường.
- Sửa xong **job vẫn `ACTIVE`**, không gián đoạn nhận hồ sơ. Ghi lịch sử trạng thái với mã mới **`EDITED_WHILE_ACTIVE`**, lưu giá trị cũ và mới vào audit log.
- `JobDto` trả `editedAfterApprovalAt` (lần sửa gần nhất). Internal HR **xem lại sau** (H3 không bắt duyệt lại). Indeed không công bố việc tin đã sửa có bị duyệt lại hay không [N4], nên dự án chọn cách xem lại sau để không làm gián đoạn tin.
- `GET /internal/jobs/review?status=EDITED` trả các tin đã sửa sau khi duyệt mà HR **chưa xem**. Thêm `POST /internal/jobs/{id}/acknowledge-edit` để HR đánh dấu đã xem. HR thấy vi phạm thì dùng H1 (`UNPUBLISH`).

---

## H4. 🟡 Lý do từ chối "Nội dung phân biệt đối xử"

**Căn cứ:** Bộ luật Lao động 2019, Điều 8 cấm phân biệt đối xử trong lao động. Điều 3 khoản 8 định nghĩa phân biệt theo giới tính, độ tuổi…, **trừ khi xuất phát từ yêu cầu đặc thù của công việc** [N5]. Luật Bình đẳng giới 2006, Điều 13: nam, nữ bình đẳng về tiêu chuẩn và độ tuổi khi tuyển dụng [N6].

- Thêm vào `JobReasonCodes`: **`REJECTED_DISCRIMINATORY_CONTENT`** (từ chối khi duyệt) và **`CLOSED_POLICY_VIOLATION`** (gỡ tin, dùng ở H1).
- Cho phép 2 mã này ở validator của từ chối và đóng job.
- **Không** tự quét chữ để chặn tin. Ví dụ "tuyển nam" có thể hợp pháp nếu là yêu cầu đặc thù của công việc [N5], nên quyết định thuộc về HR khi duyệt.

---

## H5. 🟡 Việc nhỏ đã biết

| # | Việc | Ghi chú |
|---|---|---|
| H5.1 | Gửi ngày **không có múi giờ** (ví dụ `applicationDeadline: "2026-12-31"`) đang gây **500** | Chuẩn hóa về UTC trước khi lưu (`DateTime.SpecifyKind(…, Utc)`, hoặc coi là cuối ngày giờ Việt Nam rồi đổi sang UTC), hoặc trả 400 kèm thông báo rõ. **Không để 500** |
| H5.2 | Hệ số phí mặc định HEADHUNT đang là **2.0** trong `BusinessSettingKeys` | Nhóm đã chốt **1,5** (tài liệu quy tắc phí). Sửa giá trị mặc định, hoặc Admin chỉnh ở trang Cài đặt. Xem thêm MF-05 mục E2 |

---

## Tiêu chí nghiệm thu backend

1. Ứng viên báo cáo tin `ACTIVE` thành công. Báo cáo lần 2 khi báo cáo cũ còn mở thì nhận 409. Client không có quyền báo cáo.
2. Tin đủ ngưỡng báo cáo (mặc định 3, lấy từ cài đặt) thì HR thấy `reportFlagged = true`. Tin **không** tự bị gỡ.
3. HR `UNPUBLISH` thì job chuyển `CLOSED_POLICY_VIOLATION`, mọi báo cáo đóng lại, Client và người báo cáo nhận thông báo.
4. Đóng job còn hồ sơ đang mở mà không chọn cách xử lý thì nhận 409 kèm số liệu. Chọn `CLOSE_ALL` thì hồ sơ chuyển `CLOSED`, lịch phỏng vấn bị hủy, ứng viên và Affiliate nhận thông báo.
5. Có offer đang chờ thì không đóng được job (409). Hồ sơ `PLACED` không bị đổi.
6. Sửa `description` khi ACTIVE thì job vẫn ACTIVE, có lịch sử `EDITED_WHILE_ACTIVE` và audit. Sửa `title` khi ACTIVE thì nhận 400 `FIELD_NOT_EDITABLE_WHEN_ACTIVE`.
7. Từ chối với `REJECTED_DISCRIMINATORY_CONTENT` hợp lệ.
8. Gửi ngày không có múi giờ không còn trả 500.
9. Migration có `.Designer.cs`, `has-pending-model-changes` ra "No changes", toàn bộ test pass. Có unit test cho từng mục trên.

## Thứ tự gợi ý

H5.1 (nhỏ, đang gây 500) → **H1** → **H2** → H3 → H4, H5.2.
Làm xong API nào thì báo dev giao diện để gắn (xem tài liệu frontend).

---

## Nguồn

- **[N1]** Indeed – How to report a job: <https://www.indeed.com/help/job-seekers/articles/360028156452-how-to-report-a-job>
- **[N2]** TopCV – trang chi tiết tin tuyển dụng có mục "Báo cáo tin tuyển dụng" và "Tin đăng đã được kiểm duyệt" (quan sát trực tiếp trên tin "Marketing & Communication Specialist – Hồ Chí Minh", ngày 15/10/2026; không có tài liệu chính thức).
- **[N3]** LinkedIn Help – Automate sending rejection messages to job applicants: <https://www.linkedin.com/help/learning/answer/a521538>
- **[N4]** Indeed Employer Help – Edit a job post: <https://in.indeed.com/help/employers/articles/203366260>. Indeed review trước khi đăng: <https://in.indeed.com/help/employers/articles/205846516>
- **[N5]** Bộ luật Lao động 2019, Điều 3 khoản 8 và Điều 8 (trích qua Thư viện Pháp luật): <https://thuvienphapluat.vn/lao-dong-tien-luong/phan-biet-doi-xu-trong-lao-dong-co-bi-cam-trong-cong-ty-khong-20243.html>. **Khi đưa vào báo cáo nên trích văn bản gốc.**
- **[N6]** Luật Bình đẳng giới 2006, Điều 13 (trích qua Luật Minh Khuê): <https://luatminhkhue.vn/hanh-vi-bi-nghiem-cam-trong-linh-vuc-lao-dong.aspx>
