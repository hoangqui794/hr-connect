# Đặc tả Backend: Client xem ứng viên theo Job và quản lý trạng thái tuyển dụng

## 1. Mục tiêu

Tài liệu này mô tả phần backend cho màn hình của `CLIENT_COMPANY_USER`:

1. Xem các Job thuộc doanh nghiệp của mình.
2. Chọn một Job để xem danh sách Candidate đã ứng tuyển hoặc đã được Affiliate giới thiệu.
3. Xem hồ sơ, CV và kết quả hỗ trợ sàng lọc từ MF03.
4. Ghi nhận quyết định sàng lọc và theo dõi lịch sử trạng thái tuyển dụng.

Phạm vi này bắt đầu từ khi một `Application` hợp lệ đã được tạo. Submission của Affiliate còn ở trạng thái `PENDING_CONSENT`, đã bị từ chối hoặc đã hết hạn **không được hiển thị cho Client như một ứng viên của Job**.

## 2. Hiện trạng trong code

### Đã có

- `GET /api/v1/jobs/mine`: lấy Job của doanh nghiệp hiện tại.
- `GET /api/v1/jobs/{jobId}`: xem chi tiết Job và đã có kiểm tra quyền sở hữu.
- Permission `application.view_company`: xem Application thuộc Job của công ty.
- Permission `candidate.review_company`: thực hiện quyết định sàng lọc Candidate của công ty.
- Các bảng `application`, `application_status_history`, `candidate`, `candidate_cv`, `ai_match_result`, `interview`, `offer`, `placement`.
- `application` có `concurrency_token` để chống hai người cập nhật đè lên nhau.
- Index `(job_id, status)` và index lịch sử theo `(application_id, changed_at)` đã phù hợp cho màn hình này.

### Chưa có

- API Client lấy danh sách Application theo một Job.
- API Client xem chi tiết một Application.
- API Client lấy URL CV tạm thời.
- API Client cập nhật quyết định sàng lọc và ghi lịch sử trạng thái.

### Kết luận về database

Không cần tạo bảng mới cho chức năng này. Chỉ tạo migration nếu khi triển khai phát hiện thiếu index hoặc constraint thực tế; không tạo bảng riêng chỉ để phục vụ màn hình.

## 3. Quy tắc phân quyền bắt buộc

Mọi API trong tài liệu này phải đồng thời thỏa mãn:

- JWT còn hiệu lực.
- User có role `CLIENT_COMPANY_USER` đang hoạt động.
- `CompanyUser.Status` đang hoạt động.
- User có permission tương ứng.
- `Job.CompanyId` phải bằng `CompanyUser.CompanyId` lấy từ user đăng nhập.

Không nhận `companyId` từ query, route hoặc request body để quyết định quyền. Backend luôn tự suy ra Company từ JWT và bảng `company_user`.

Nếu Job tồn tại nhưng thuộc doanh nghiệp khác, trả `404` để không làm lộ tài nguyên của doanh nghiệp khác.

## 4. API cần triển khai

### 4.1. Danh sách ứng viên của một Job

```http
GET /api/v1/jobs/{jobId}/applications
```

Permission: `application.view_company`

Query đề xuất:

| Tham số | Kiểu | Mặc định | Ý nghĩa |
|---|---:|---:|---|
| `status` | string? | null | Lọc chính xác theo trạng thái Application |
| `search` | string? | null | Tìm theo tên hoặc email Candidate; trim và giới hạn 100 ký tự |
| `aiStatus` | string? | null | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` |
| `minMatchScore` | decimal? | null | Từ 0 đến 100 |
| `source` | string? | null | `CANDIDATE` hoặc `AFFILIATE` |
| `page` | int | 1 | Tối thiểu 1 |
| `pageSize` | int | 20 | Từ 1 đến 100 |
| `sortBy` | string | `appliedAt` | `appliedAt`, `updatedAt`, `matchScore`, `candidateName` |
| `sortDirection` | string | `desc` | `asc` hoặc `desc` |

Response mẫu:

```json
{
  "success": true,
  "data": {
    "job": {
      "jobId": "uuid",
      "title": "Senior .NET Backend Developer",
      "status": "ACTIVE",
      "serviceTypeCode": "HEADHUNT_COD"
    },
    "summary": {
      "total": 12,
      "submitted": 3,
      "screening": 2,
      "shortlisted": 3,
      "interview": 2,
      "rejected": 1,
      "other": 1
    },
    "items": [
      {
        "applicationId": "uuid",
        "candidateId": "uuid",
        "candidateName": "Nguyen Van A",
        "email": "candidate@example.com",
        "phone": "0900000000",
        "status": "SUBMITTED",
        "currentStage": "SUBMITTED",
        "source": "AFFILIATE",
        "cvFileName": "CV-Nguyen-Van-A.pdf",
        "appliedAt": "2026-10-02T10:00:00Z",
        "updatedAt": "2026-10-02T10:05:00Z",
        "concurrencyToken": "uuid",
        "ai": {
          "status": "COMPLETED",
          "matchScore": 82.5,
          "matchTier": "HIGH",
          "candidateHighlight": "Kinh nghiệm .NET phù hợp"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 12,
      "totalPages": 1
    }
  }
}
```

Quy tắc truy vấn:

- Nguồn dữ liệu gốc là `application`, không lấy trực tiếp từ `submission`.
- Chỉ lấy `application.job_id = jobId` sau khi đã xác nhận Job thuộc Company hiện tại.
- Với MF03, chỉ lấy attempt có `attempt_no` lớn nhất. Không trả `raw_response` và `error_message` nội bộ cho Client.
- Không tạo presigned URL CV trong API danh sách.
- `source` lấy từ accepted Submission; nếu có Attribution hợp lệ thì là `AFFILIATE`, còn tự ứng tuyển là `CANDIDATE`.
- Không trả thông tin liên hệ của Affiliate cho Client trong response này.

### 4.2. Chi tiết một ứng viên trong Job

```http
GET /api/v1/jobs/{jobId}/applications/{applicationId}
```

Permission: `application.view_company`

Response cần gồm:

- Thông tin Job tối thiểu.
- Candidate: họ tên, email, điện thoại và thông tin hồ sơ nghề nghiệp cần cho tuyển dụng.
- Application: status, currentStage, statusReason, appliedAt, updatedAt, concurrencyToken.
- CV metadata: `cvId`, fileName, mimeType, fileSizeBytes; không trả object key hoặc URL storage gốc.
- Kết quả MF03 gần nhất: status, score, tier, highlight, must-have, should-have, modelVersion, completedAt.
- Nguồn hồ sơ: `CANDIDATE` hoặc `AFFILIATE`. Có thể trả `hasAttribution`; không trả contact của Affiliate.
- Danh sách lịch sử trạng thái, mới nhất trước.
- Tóm tắt interview/offer/placement nếu các module đó đã có dữ liệu.

Phải kiểm tra đồng thời:

```text
application.ApplicationId == applicationId
application.JobId == jobId
application.Job.CompanyId == currentCompanyId
```

Không chỉ kiểm tra `applicationId`, vì như vậy dễ tạo lỗi truy cập chéo doanh nghiệp.

### 4.3. Lấy link xem CV tạm thời

```http
GET /api/v1/jobs/{jobId}/applications/{applicationId}/cv-download-url
```

Permission: `application.view_company`

Response mẫu:

```json
{
  "success": true,
  "data": {
    "fileName": "CV-Nguyen-Van-A.pdf",
    "downloadUrl": "https://signed-url.example/...",
    "expiresAt": "2026-10-02T10:05:00Z"
  }
}
```

Quy tắc:

- URL có thời hạn cố định 5 phút; Client không được truyền `expiryMinutes`.
- Lấy đúng CV thuộc accepted Submission của Application.
- Không trả `SourceFileUrl`/object key trực tiếp.
- Ghi audit event `APPLICATION_CV_VIEWED` nhưng không ghi signed URL vào log.

### 4.4. Cập nhật quyết định sàng lọc

```http
PATCH /api/v1/jobs/{jobId}/applications/{applicationId}/status
```

Permission: `candidate.review_company`

Request mẫu:

```json
{
  "targetStatus": "SHORTLISTED",
  "reason": "Kinh nghiệm và kỹ năng phù hợp yêu cầu",
  "concurrencyToken": "uuid"
}
```

Response mẫu:

```json
{
  "success": true,
  "message": "Đã cập nhật trạng thái ứng viên.",
  "data": {
    "applicationId": "uuid",
    "oldStatus": "SCREENING",
    "status": "SHORTLISTED",
    "currentStage": "SHORTLISTED",
    "reason": "Kinh nghiệm và kỹ năng phù hợp yêu cầu",
    "updatedAt": "2026-10-02T10:10:00Z",
    "concurrencyToken": "new-uuid"
  }
}
```

## 5. State machine cho API sàng lọc

API tại mục 4.4 chỉ quản lý quyết định sàng lọc. Không dùng API này để giả lập Interview, Offer hoặc Placement, vì các bước đó cần bảng nghiệp vụ và permission riêng.

Các chuyển trạng thái được phép trong phạm vi này:

| Trạng thái hiện tại | Trạng thái đích cho phép | Ghi chú |
|---|---|---|
| `SUBMITTED` | `SCREENING`, `SHORTLISTED`, `REJECTED`, `BACKUP` | Client bắt đầu hoặc đưa ra quyết định ban đầu |
| `SCREENING` | `SHORTLISTED`, `REJECTED`, `BACKUP` | Không cho quay lại `SUBMITTED` |
| `BACKUP` | `SHORTLISTED`, `BACKUP_NOT_SELECTED` | `BACKUP_NOT_SELECTED` cần reason |

Quy tắc bổ sung:

- `REJECTED` và `BACKUP_NOT_SELECTED` là trạng thái kết thúc trong API này.
- Chuyển sang `REJECTED`, `BACKUP` hoặc `BACKUP_NOT_SELECTED` bắt buộc có `reason` sau khi trim, tối đa 1.000 ký tự.
- `SHORTLISTED -> INTERVIEW` phải xảy ra khi tạo Interview hợp lệ trong module Interview.
- `INTERVIEW -> INTERVIEW_FAILED/OFFER_PENDING` phải do kết quả Interview hoặc nghiệp vụ Offer xử lý.
- `OFFER_*`, `PLACED`, `NOT_STARTED`, `CLOSED`, `WITHDRAWN` do các use case riêng cập nhật.
- MF03 chỉ cung cấp dữ liệu hỗ trợ. Kết quả AI không được tự động chuyển Candidate sang `SHORTLISTED` hoặc `REJECTED`.

Nếu nhóm muốn cho phép sửa một quyết định kết thúc, cần một API reopen riêng với permission cao hơn và lý do bắt buộc; không mở đường chuyển trạng thái tự do trong API này.

## 6. Transaction, lịch sử và chống cập nhật đè

Khi cập nhật trạng thái, trong cùng một transaction phải:

1. Khóa/đọc Application cùng `concurrency_token` hiện tại.
2. Kiểm tra ownership của Job và state transition.
3. Cập nhật `application.status`, `current_stage`, `status_reason`, `updated_at`.
4. Sinh `concurrency_token` mới.
5. Thêm một dòng `application_status_history` với oldStatus, newStatus, changedBy, reason, changedAt.
6. Ghi `audit_log` bằng dịch vụ audit dùng chung.
7. Commit một lần.

Nếu `concurrencyToken` không còn đúng, trả `409 APPLICATION_CHANGED` để FE tải lại dữ liệu. Không âm thầm ghi đè quyết định của người khác.

Audit action đề xuất:

- `APPLICATION_STATUS_CHANGED`
- `APPLICATION_CV_VIEWED`

Không ghi CV, signed URL, access token hoặc dữ liệu AI raw vào audit log.

## 7. Mã lỗi thống nhất

| HTTP | errorCode | Khi nào dùng |
|---:|---|---|
| 400 | `INVALID_FILTER` | Filter, sort hoặc status không hợp lệ |
| 401 | `UNAUTHENTICATED` | Chưa đăng nhập/token hết hạn |
| 403 | `PERMISSION_DENIED` | Đúng tài nguyên nhưng thiếu role/permission |
| 404 | `JOB_NOT_FOUND` | Job không tồn tại hoặc không thuộc Company hiện tại |
| 404 | `APPLICATION_NOT_FOUND` | Application không thuộc đúng Job/Company |
| 409 | `INVALID_STATUS_TRANSITION` | Chuyển trạng thái sai state machine |
| 409 | `APPLICATION_CHANGED` | concurrencyToken cũ |

Response lỗi chuẩn:

```json
{
  "success": false,
  "errorCode": "INVALID_STATUS_TRANSITION",
  "message": "Không thể chuyển Application từ REJECTED sang SHORTLISTED."
}
```

## 8. Permission và seeder

Không cần tạo permission mới cho bốn API trên:

- API xem danh sách, chi tiết và CV: `application.view_company`.
- API quyết định sàng lọc: `candidate.review_company`.

Hai permission này đã có và đã được gán mặc định cho `CLIENT_COMPANY_USER` trong `DatabaseSeeder`/`Permission.md`. Dev phải giữ seeder idempotent.

Nếu sau này bổ sung API reopen quyết định cuối, nên tạo permission riêng, ví dụ `application.reopen_company`, thêm vào seeder và chỉ gán cho role được Product Owner duyệt.

## 9. Cấu trúc code đề xuất

```text
HRConnect.Application/Features/ClientApplications/
  Queries/GetJobApplications/
  Queries/GetJobApplicationDetail/
  Queries/GetJobApplicationCvUrl/
  Commands/UpdateJobApplicationStatus/
  Common/ClientApplicationAccessGuard.cs
  Common/ApplicationStatusTransitionPolicy.cs

HRConnect.Presentation/Endpoints/V1/ClientApplications/
  ClientApplicationEndpoints.cs
```

Repository nên bổ sung truy vấn chuyên biệt, chiếu thẳng sang DTO và dùng `AsNoTracking()` cho các API đọc. Tránh load toàn bộ collection rồi mới phân trang trong memory.

`ClientApplicationAccessGuard` dùng chung cho cả bốn API để kiểm tra Company ownership thống nhất. `ApplicationStatusTransitionPolicy` là nguồn duy nhất chứa state machine; không lặp điều kiện ở endpoint, handler và repository.

## 10. Swagger

Nhóm tag: `Client Recruitment Pipeline`.

Mỗi endpoint cần:

- Summary và Description bằng tiếng Việt.
- Hiển thị ổ khóa Bearer.
- Ghi rõ role, permission và ownership.
- Khai báo đủ response `200/400/401/403/404/409` tương ứng.
- Có schema cụ thể, không để response chỉ là `object` hoặc `Undocumented`.
- Ghi rõ CV URL chỉ có hiệu lực 5 phút.
- Ghi rõ MF03 hỗ trợ sàng lọc, quyết định cuối do con người thực hiện.

## 11. Tiêu chí nghiệm thu

1. Client A xem được Candidate thuộc Job của Company A.
2. Client A không xem được Job/Application/CV của Company B, kể cả biết UUID.
3. Affiliate Submission `PENDING_CONSENT`, `DECLINED`, `EXPIRED`, `BLOCKED_DUPLICATE` không xuất hiện trong danh sách Application.
4. Candidate tự ứng tuyển và Candidate đã đồng ý hồ sơ Affiliate đều xuất hiện sau khi có Application.
5. List phân trang tại database, lọc và sort đúng, không phát sinh N+1 query.
6. List không tạo signed URL; endpoint CV trả URL 5 phút và đúng CV của accepted Submission.
7. Chỉ lấy AI attempt mới nhất; AI chưa xong vẫn trả item với trạng thái rõ ràng.
8. Chuyển trạng thái hợp lệ tạo đúng một history và một audit log.
9. Chuyển trạng thái sai trả `409`; không sửa dữ liệu.
10. Hai request dùng cùng concurrencyToken: chỉ một request thành công, request còn lại trả `409 APPLICATION_CHANGED`.
11. Không API nào trả `raw_response`, object key storage, token hoặc thông tin liên hệ Affiliate.
12. Swagger mô tả đủ contract để FE tích hợp mà không cần đọc handler.

## 12. Thứ tự triển khai khuyến nghị

1. `GET /api/v1/jobs/{jobId}/applications`.
2. `GET /api/v1/jobs/{jobId}/applications/{applicationId}`.
3. `GET /api/v1/jobs/{jobId}/applications/{applicationId}/cv-download-url`.
4. `PATCH /api/v1/jobs/{jobId}/applications/{applicationId}/status`.
5. Hoàn thiện unit test, integration test ownership/concurrency và Swagger cho từng API trước khi merge.

Mỗi API nên được commit/push riêng sau khi test đạt để dễ review và rollback.
