# Nhật ký triển khai cá nhân — MF01 Job Management

> Phạm vi: Backend của **MF01**.
>
> File này là ghi chú cá nhân/local. Không stage, commit hoặc push lên GitHub.
>
> Cập nhật gần nhất: **03/10/2026**.

## 1. Mục tiêu

Hoàn thiện luồng quản lý Job của Client Company và Internal HR:

```text
DRAFT → PENDING_REVIEW → ACTIVE
          ↓
       REJECTED → chỉnh sửa → PENDING_REVIEW

ACTIVE ↔ PAUSED
ACTIVE/PAUSED → CLOSED
```

Không mở rộng sang FE hoặc các luồng tuyển dụng sau Job.

## 2. Các phần đã thực hiện

| Hạng mục | Kết quả |
|---|---|
| Benefits | Thêm `Job.Benefits`; Create, Update, DTO, validation và migration đã hỗ trợ. |
| Visibility | Thay `PRIVATE` bằng `PUBLIC`, `PARTNER_ONLY`, `INTERNAL_ONLY`. |
| Access policy | Tập trung quy tắc xem list/detail, apply, submit Candidate và quản lý Job. |
| Service Type × Visibility | Validate matrix MF01: `CV_APPLICATION` chỉ `PUBLIC`/`INTERNAL_ONLY`; hai service còn lại chỉ `PARTNER_ONLY`/`INTERNAL_ONLY`. |
| WorkingTime | Dùng text (`Job.WorkingTime`), tối đa 2.000 ký tự. |
| Location | Giữ một trường `Job.Location`; không dùng bảng `JobLocation` hay đa địa điểm. |
| Employment type | Chuẩn hóa `FULL_TIME`, `PART_TIME`, `CONTRACT`, `INTERNSHIP`, `FREELANCE`. |
| Filter/pagination | Bổ sung filter phù hợp MF01 và giới hạn `pageSize` tối đa 100. |
| Status reason | `JobStatusHistory` lưu `ReasonCode` và `ReasonText`. |
| JobSkill | Không còn bắt buộc khi Submit Job; vẫn cần tối thiểu một `MUST_HAVE JobRequirement`. |
| Optimistic concurrency | Job có `ConcurrencyToken`; request dùng token cũ nhận `409 Conflict`. |

## 3. Triển khai cuối cùng: Optimistic concurrency

### Vấn đề giải quyết

Tránh việc Client Company và Internal HR cùng sửa/duyệt một Job, khiến người thực hiện sau ghi đè dữ liệu của người trước.

### Cách hoạt động

1. API Create/Detail/Update trả `concurrencyToken` của Job.
2. FE/API consumer phải gửi lại token này khi Update hoặc đổi trạng thái Job.
3. Sau khi thay đổi thành công, backend tạo token mới.
4. Token không khớp trả HTTP `409` và yêu cầu tải lại Job.

Ví dụ phản hồi khi token cũ:

```json
{
  "success": false,
  "message": "Job đã được thay đổi bởi người dùng khác. Hãy tải lại dữ liệu và thử lại."
}
```

### API chịu ảnh hưởng

- `POST /api/v1/jobs`
- `GET /api/v1/jobs/{jobId}`
- `PUT /api/v1/jobs/{jobId}`
- `POST /api/v1/jobs/{jobId}/submit`
- `POST /api/v1/jobs/{jobId}/pause`
- `POST /api/v1/jobs/{jobId}/resume`
- `POST /api/v1/jobs/{jobId}/close`
- `POST /api/v1/internal/jobs/{jobId}/approve`
- `POST /api/v1/internal/jobs/{jobId}/reject`

## 4. File thay đổi trong release concurrency

### Domain và database

- `HRConnect.Domain/Entities/Job.cs`
  - Thêm `ConcurrencyToken`.
- `HRConnect.Infrastructure/Persistence/ApplicationDbContext.cs`
  - Map `concurrency_token` là EF concurrency token.
- `HRConnect.Infrastructure/Migrations/20261003200000_AddJobConcurrencyToken.cs`
  - Migration thêm cột `public.job.concurrency_token uuid` với default `gen_random_uuid()`.
- `HRConnect.Infrastructure/Migrations/ApplicationDbContextModelSnapshot.cs`
  - Cập nhật EF model snapshot.

### Application và API

- Các command Create, Update, Submit, Approve, Reject, Pause, Resume, Close Job.
  - Nhận/kiểm tra token khi cần.
- `Features/Jobs/Common/JobDto.cs`
  - Trả token và tập trung kiểm tra token hiện tại.
- `Presentation/Endpoints/V1/Jobs/JobEndpoints.cs`
  - Trả `409` cho domain conflict và `DbUpdateConcurrencyException`.
- `Persistence/Seed/CandidateTestJobSeeder.cs`
  - Đồng bộ kiểm tra seed `CV_SOURCING`: Candidate không có quyền xem/nộp.

### Test

- `JobManagementCommandHandlerTests.cs`
  - Test token cũ bị từ chối; test Update `WorkingTime`.
- `CreateJobCommandHandlerTests.cs`
  - Test Create lưu `WorkingTime` và sinh token.

## 5. Kiểm thử đã thực hiện

### Unit test

- Job feature tests: **104/104 pass**.
- Toàn bộ test không phụ thuộc Cloudflare R2: **987/987 pass**.
- Full suite có 1 test live Cloudflare R2 không chạy được vì sandbox chặn kết nối Internet; không liên quan MF01/Job.

### Build và migration

- `dotnet build HRConnect.sln --configuration Release`: thành công.
- Migration `20261003200000_AddJobConcurrencyToken`: đã áp dụng thành công trên PostgreSQL development/test.

### Real API và dữ liệu persistent

Job test: `6a677cbb-f64b-4afa-9876-642717a77da6`.

1. Update bằng token hiện tại: thành công, token đổi từ `485ea096-...` sang `160dfc99-...`.
2. Gửi lại Update với token cũ: HTTP `409 Conflict`.

## 6. GitHub release

| Giai đoạn | Commit | Kết quả |
|---|---|---|
| Feature | `de729f8` | CI success |
| Dev | `34586fa` | CI success |
| Main | `46cd80b` | CI/CD success |

## 7. Ảnh hưởng tới mainflow khác

### Không thay đổi nghiệp vụ của mainflow khác

- Không thay đổi MF02 Candidate apply/submission, AI scoring, Interview, Offer, Placement, Commission hoặc Payment.
- Không thay đổi schema của Application, Submission hay Candidate.
- Không triển khai FE.

### Điểm tích hợp cần biết

- Job là dữ liệu đầu vào của MF02. Vì vậy MF02 chỉ thấy ảnh hưởng gián tiếp từ các rule Job đã có: visibility, service type, trạng thái `ACTIVE` và access policy.
- Concurrency token chỉ áp dụng khi **quản lý Job**; Candidate apply hoặc Affiliate submit Candidate không phải gửi token Job.
- Seed `CV_SOURCING` được sửa để phản ánh rule đã chốt: Candidate không `view`/`submit`; Affiliate và Internal HR mới có quyền phù hợp.

## 8. Chưa làm trong MF01

- FE truyền/lưu `concurrencyToken` và hiển thị màn hình reload khi nhận `409`.
- Audit log nghiệp vụ cho Job (`JOB_CREATED`, `JOB_UPDATED`, `JOB_APPROVED`...). Đây là task có thể làm tiếp, nhưng không thay thế `job_status_history`.
- Assigned Affiliate/JobAccess.
- Nhiều địa điểm, bảng tỉnh/thành, quản lý ca làm việc.

## 9. Ghi nhớ khi làm tiếp

Khi FE triển khai, luôn lấy token mới nhất từ Job detail hoặc response sau action thành công. Không dùng lại token cũ cho lần Update/Approve/Reject/Pause/Resume/Close kế tiếp.
