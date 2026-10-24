# MF-02 — Quy trình code Backend

Tài liệu này là bản đồ đọc code cho toàn bộ luồng MF-02. Mục tiêu là giúp thành viên dự án biết một request bắt đầu ở đâu, đi qua file nào, thay đổi dữ liệu gì và chuyển sang module nào tiếp theo.

## 0. Class Navigator — bấm để mở code

Khi xem file này trên GitHub, bấm trực tiếp vào tên class sẽ mở đúng file và dòng khai báo. Trong IDE, dùng `Ctrl + click`; một số IDE chỉ mở đúng file và không tự cuộn đến `#Lxx`.

### Điểm vào API

| Class/điểm khởi động | Vai trò |
| --- | --- |
| [`Program.cs`](../../HRConnect.Presentation/Program.cs#L381) | Khởi động Backend và ánh xạ các endpoint MF-02 |
| [`JobEndpoints`](../../HRConnect.Presentation/Endpoints/V1/Jobs/JobEndpoints.cs#L31) | Candidate tự ứng tuyển và Affiliate giới thiệu Candidate |
| [`SubmissionConsentEndpoints`](../../HRConnect.Presentation/Endpoints/V1/SubmissionConsents/SubmissionConsentEndpoints.cs#L12) | Candidate xem, đồng ý hoặc từ chối lượt giới thiệu |
| [`CandidateEndpoints`](../../HRConnect.Presentation/Endpoints/V1/Candidates/CandidateEndpoints.cs#L32) | Hồ sơ, CV, định danh và duplicate self-service của Candidate |
| [`AdminCandidateDuplicateEndpoints`](../../HRConnect.Presentation/Endpoints/V1/Admin/AdminCandidateDuplicateEndpoints.cs#L13) | Admin xem và xử lý hồ sơ nghi trùng |
| [`DisputeEndpoints`](../../HRConnect.Presentation/Endpoints/V1/Disputes/DisputeEndpoints.cs#L14) | Tạo, xem và giải quyết khiếu nại |

### Handler và service nghiệp vụ

| Class | Vai trò |
| --- | --- |
| [`SubmitCandidateCommandHandler`](../../HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommandHandler.cs#L20) | Affiliate gửi Candidate và tạo consent |
| [`ResendSubmissionConsentCommandHandler`](../../HRConnect.Application/Features/Affiliates/Commands/ResendSubmissionConsent/ResendSubmissionConsentCommandHandler.cs#L16) | Gửi lại yêu cầu consent an toàn |
| [`RespondSubmissionConsentCommandHandler`](../../HRConnect.Application/Features/SubmissionConsents/RespondSubmissionConsent/RespondSubmissionConsentCommandHandler.cs#L15) | Candidate phản hồi và tạo Application/Attribution khi hợp lệ |
| [`ApplyJobCommandHandler`](../../HRConnect.Application/Features/Candidates/Commands/ApplyJob/ApplyJobCommandHandler.cs#L13) | Candidate tự ứng tuyển |
| [`ResolveCandidateDuplicateCaseCommandHandler`](../../HRConnect.Application/Features/CandidateDuplicates/Resolve/ResolveCandidateDuplicateCase.cs#L50) | Admin bác cảnh báo hoặc hợp nhất Candidate |
| [`FinalizeIdentityReviewedSubmissionService`](../../HRConnect.Application/Features/CandidateDuplicates/Finalization/FinalizeIdentityReviewedSubmissionService.cs#L30) | Hoàn tất lượt nộp sau khi Admin xử lý trùng |
| [`StartCandidateIdentityClaimCommandHandler`](../../HRConnect.Application/Features/Candidates/Identity/StartCandidateIdentityClaim/StartCandidateIdentityClaimCommandHandler.cs#L16) | Bắt đầu xác minh email định danh |
| [`ResendCandidateIdentityClaimOtpCommandHandler`](../../HRConnect.Application/Features/Candidates/Identity/ResendCandidateIdentityClaimOtp/ResendCandidateIdentityClaimOtpCommandHandler.cs#L16) | Gửi lại OTP định danh |
| [`Mf03ScoringDispatcher`](../../HRConnect.Infrastructure/Services/Integration/Mf03ScoringDispatcher.cs#L13) | Gửi công việc chấm điểm sang AI Service V2 |

### Repository và entity cốt lõi

| Class | Vai trò |
| --- | --- |
| [`CandidateDuplicateRepository`](../../HRConnect.Infrastructure/Repositories/CandidateDuplicateRepository.cs#L10) | Truy vấn, khóa và lưu duplicate case |
| [`DisputeRepository`](../../HRConnect.Infrastructure/Repositories/DisputeRepository.cs#L9) | Đọc và ghi khiếu nại |
| [`Candidate`](../../HRConnect.Domain/Entities/Candidate.cs#L6) | Người ứng tuyển chuẩn sau khi định danh |
| [`CandidateCv`](../../HRConnect.Domain/Entities/CandidateCv.cs#L9) | CV của Candidate |
| [`Submission`](../../HRConnect.Domain/Entities/Submission.cs#L9) | Một lượt đưa CV vào Job |
| [`SubmissionConsent`](../../HRConnect.Domain/Entities/SubmissionConsent.cs#L6) | Quyết định xác nhận của Candidate |
| [`SubmissionIdentitySnapshot`](../../HRConnect.Domain/Entities/SubmissionIdentitySnapshot.cs#L4) | Bằng chứng định danh tại thời điểm nộp |
| [`CandidateDuplicateCase`](../../HRConnect.Domain/Entities/CandidateDuplicateCase.cs#L7) | Hồ sơ điều tra nghi trùng |
| [`CandidateDuplicateSignal`](../../HRConnect.Domain/Entities/CandidateDuplicateSignal.cs#L4) | Tín hiệu cấu thành cảnh báo trùng |
| [`Application`](../../HRConnect.Domain/Entities/Application.cs#L6) | Đơn ứng tuyển chính thức |
| [`Attribution`](../../HRConnect.Domain/Entities/Attribution.cs#L9) | Quyền giới thiệu của Affiliate |
| [`Dispute`](../../HRConnect.Domain/Entities/Dispute.cs#L6) | Khiếu nại và kết quả xử lý |

## 1. Cách Backend khởi động

Backend ASP.NET Core bắt đầu tại [`Program.cs`](../../HRConnect.Presentation/Program.cs).

Khi ứng dụng khởi động:

1. `Program.cs` nạp cấu hình, database, authentication, authorization và dependency injection.
2. [`Application/DependencyInjection.cs`](../../HRConnect.Application/DependencyInjection.cs) đăng ký MediatR, validator và các application service.
3. [`Infrastructure/DependencyInjection.cs`](../../HRConnect.Infrastructure/DependencyInjection.cs) đăng ký repository, EF Core, storage, email và integration service.
4. Cuối `Program.cs`, các nhóm Minimal API được ánh xạ vào pipeline, trong đó MF-02 sử dụng:
   - `MapCandidateEndpoints()`;
   - `MapAdminApprovalEndpoints()`;
   - `MapAdminCandidateDuplicateEndpoints()`;
   - `MapJobEndpoints()`;
   - `MapDisputeEndpoints()`;
   - `MapSubmissionConsentEndpoints()`.

Chạy Backend tại thư mục gốc repository:

```powershell
dotnet run --project .\HRConnect\HRConnect.Presentation\HRConnect.Presentation.csproj
```

Các địa chỉ local được khai báo trong [`launchSettings.json`](../../HRConnect.Presentation/Properties/launchSettings.json):

- `https://localhost:7289`
- `http://localhost:5041`

## 2. Mẫu chạy chung của một API

```text
HTTP request
  → Presentation/Endpoints/V1/*Endpoints.cs
  → kiểm tra authentication và permission
  → tạo Command hoặc Query
  → FluentValidation
  → ISender.Send(...) của MediatR
  → Application/Features/.../*Handler.cs
  → Domain entity + repository interface
  → Infrastructure/Repositories/*Repository.cs
  → ApplicationDbContext / PostgreSQL
  → integration, email outbox, notification và audit nếu có
  → HTTP response
```

`Endpoint` chỉ tiếp nhận HTTP, kiểm tra quyền và chuyển dữ liệu. Quy tắc nghiệp vụ chính phải nằm trong `Application handler` hoặc application service. Repository chịu trách nhiệm đọc/ghi dữ liệu; endpoint không truy cập database trực tiếp.

## 3. Luồng chính: Affiliate giới thiệu Candidate

### 3.1 Điểm vào API

```http
POST /api/v1/jobs/{jobId}/candidate-submissions
Content-Type: multipart/form-data
```

Thứ tự file chạy:

| Thứ tự | File | Trách nhiệm |
| --- | --- | --- |
| 1 | [`JobEndpoints.cs`](../../HRConnect.Presentation/Endpoints/V1/Jobs/JobEndpoints.cs) | Nhận form, kiểm tra quyền `submission.create`, tạo command và gọi MediatR |
| 2 | [`SubmitCandidateCommand.cs`](../../HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommand.cs) | Hợp đồng dữ liệu đầu vào/đầu ra của use case |
| 3 | [`SubmitCandidateCommandValidator.cs`](../../HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommandValidator.cs) | Kiểm tra dữ liệu bắt buộc và định dạng |
| 4 | [`SubmitCandidateCommandHandler.cs`](../../HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommandHandler.cs) | Xử lý toàn bộ nghiệp vụ nộp Candidate |
| 5 | Repository trong [`Infrastructure/Repositories`](../../HRConnect.Infrastructure/Repositories/) | Đọc Job, Affiliate, Candidate, CV, Submission và ghi dữ liệu |
| 6 | [`ApplicationDbContext.cs`](../../HRConnect.Infrastructure/Persistence/ApplicationDbContext.cs) | Theo dõi entity và ghi PostgreSQL |

### 3.2 Handler xử lý gì?

`SubmitCandidateCommandHandler.Handle()` thực hiện theo thứ tự:

1. Kiểm tra Job tồn tại, còn hoạt động và còn hạn nhận hồ sơ.
2. Kiểm tra Affiliate đang hoạt động và được phép giới thiệu vào loại dịch vụ của Job.
3. Kiểm tra quota và suất thay thế nếu request gắn với replacement slot.
4. Chuẩn hóa email và số điện thoại.
5. Tìm Candidate thông qua định danh đã xác minh.
6. Chặn trường hợp email và số điện thoại đang trỏ đến hai Candidate khác nhau để tránh gộp sai người.
7. Kiểm tra Candidate đã có lượt nộp hoặc Application trong cùng Job chưa.
8. Kiểm tra CV trong thư viện hoặc tải PDF mới lên storage.
9. Mở database transaction.
10. Tạo `Submission` với trạng thái `PENDING_CONSENT`.
11. Tạo `SubmissionIdentitySnapshot` để giữ bằng chứng định danh tại thời điểm nộp.
12. So sánh tín hiệu họ tên, email, số điện thoại và CV; tạo `CandidateDuplicateCase` khi nghi trùng mạnh.
13. Tạo `SubmissionConsent` trạng thái `PENDING`.
14. Ghi email consent vào `EmailOutbox`, ghi audit log và notification.
15. Commit transaction rồi gửi email yêu cầu Candidate xác nhận.

Kết quả của bước này **chưa tạo `JobApplication` và chưa tạo `Attribution`**. Hồ sơ phải chờ Candidate đồng ý.

```text
Affiliate submit
  → Submission(PENDING_CONSENT)
  → SubmissionIdentitySnapshot
  → SubmissionConsent(PENDING)
  → EmailOutbox
  → Candidate nhận yêu cầu xác nhận
```

## 4. Luồng Candidate xác nhận hoặc từ chối

### 4.1 Điểm vào API

Các endpoint nằm tại [`SubmissionConsentEndpoints.cs`](../../HRConnect.Presentation/Endpoints/V1/SubmissionConsents/SubmissionConsentEndpoints.cs).

Candidate có hai cách phản hồi:

- Đã đăng nhập: dùng API dưới `/api/v1/candidates/me/submission-consents`.
- Chưa đăng nhập: dùng token bảo mật với `/api/v1/submission-consents/review` và `/respond`.

Thứ tự file chính:

| Thứ tự | File | Trách nhiệm |
| --- | --- | --- |
| 1 | [`SubmissionConsentEndpoints.cs`](../../HRConnect.Presentation/Endpoints/V1/SubmissionConsents/SubmissionConsentEndpoints.cs) | Nhận quyết định đồng ý/từ chối |
| 2 | [`RespondSubmissionConsentCommand.cs`](../../HRConnect.Application/Features/SubmissionConsents/RespondSubmissionConsent/RespondSubmissionConsentCommand.cs) | Command phản hồi consent |
| 3 | [`RespondSubmissionConsentCommandHandler.cs`](../../HRConnect.Application/Features/SubmissionConsents/RespondSubmissionConsent/RespondSubmissionConsentCommandHandler.cs) | Kiểm tra và hoàn tất lượt nộp |

### 4.2 Candidate từ chối hoặc consent hết hạn

```text
DECLINE
  → SubmissionConsent = DECLINED
  → Submission = CONSENT_REJECTED
  → không tạo Application
  → không tạo Attribution
  → không gọi MF-03
```

Consent quá hạn được chuyển sang `EXPIRED`; lượt nộp không được đi tiếp.

### 4.3 Candidate đồng ý và hồ sơ không trùng

Handler mở transaction và:

1. Kiểm tra lại Job, Affiliate, duplicate và suất thay thế để tránh dữ liệu thay đổi trong thời gian chờ.
2. Chuyển `Submission` thành `ACCEPTED`.
3. Tạo `JobApplication` với `Status/CurrentStage = SUBMITTED`.
4. Tạo `Attribution` cho Affiliate thắng quyền giới thiệu, với rule `CANDIDATE_CONSENT_THEN_FIRST_ACCEPTED`.
5. Ghi yêu cầu MF-03 vào scoring outbox thông qua `IMf03ScoringTrigger`.
6. Ghi audit và notification.
7. Commit transaction.

```text
Candidate CONFIRM
  → Submission(ACCEPTED)
  → JobApplication(SUBMITTED)
  → Attribution(ACTIVE)
  → MF-03 scoring request
```

### 4.4 Candidate đồng ý nhưng nghi trùng mạnh

Hệ thống không tạo Application ngay:

```text
Candidate CONFIRM
  → Submission(PENDING_IDENTITY_REVIEW)
  → CandidateDuplicateCase(OPEN)
  → chờ Admin kiểm tra
```

Cách này giữ nguyên bằng chứng consent nhưng ngăn hai Candidate record của cùng một người tạo hai Application trong cùng Job.

## 5. Luồng Admin xử lý hồ sơ nghi trùng

Điểm vào API nằm tại [`AdminCandidateDuplicateEndpoints.cs`](../../HRConnect.Presentation/Endpoints/V1/Admin/AdminCandidateDuplicateEndpoints.cs).

Các file nghiệp vụ chính:

| File | Trách nhiệm |
| --- | --- |
| [`CandidateDuplicateCaseQueries.cs`](../../HRConnect.Application/Features/CandidateDuplicates/Queries/CandidateDuplicateCaseQueries.cs) | Danh sách và chi tiết case cho Admin |
| [`PreviewCandidateDuplicateMerge.cs`](../../HRConnect.Application/Features/CandidateDuplicates/PreviewMerge/PreviewCandidateDuplicateMerge.cs) | Xem trước ảnh hưởng trước khi hợp nhất |
| [`ResolveCandidateDuplicateCase.cs`](../../HRConnect.Application/Features/CandidateDuplicates/Resolve/ResolveCandidateDuplicateCase.cs) | Bác cảnh báo hoặc hợp nhất Candidate |
| [`FinalizeIdentityReviewedSubmissionService.cs`](../../HRConnect.Application/Features/CandidateDuplicates/Finalization/FinalizeIdentityReviewedSubmissionService.cs) | Hoàn tất Submission sau khi Admin xử lý |
| [`CandidateDuplicateRepository.cs`](../../HRConnect.Infrastructure/Repositories/CandidateDuplicateRepository.cs) | Truy vấn và khóa dữ liệu duplicate |

Khi Admin xác định hai hồ sơ là khác người, case được dismiss. Khi xác định cùng người, hệ thống hợp nhất định danh và dữ liệu theo quyết định hợp lệ.

Sau khi case được xử lý, `FinalizeIdentityReviewedSubmissionService` kiểm tra lại:

- Submission đang `PENDING_IDENTITY_REVIEW`;
- Candidate đã xác nhận consent;
- Job và Affiliate vẫn hợp lệ;
- chưa có Application khác trong cùng Job;
- suất thay thế và quyền ưu tiên doanh nghiệp vẫn còn hiệu lực.

Nếu đạt, service tạo Application, Attribution và yêu cầu chấm điểm MF-03 đúng một lần. Nếu đã hoàn tất trước đó, service trả `ALREADY_FINALIZED` để bảo đảm idempotency.

## 6. Luồng Candidate tự ứng tuyển

### 6.1 Điểm vào API

```http
POST /api/v1/jobs/{jobId}/apply
Content-Type: multipart/form-data
```

Thứ tự file chạy:

1. [`JobEndpoints.cs`](../../HRConnect.Presentation/Endpoints/V1/Jobs/JobEndpoints.cs) nhận CV trong kho hoặc file PDF mới.
2. [`ApplyJobCommand.cs`](../../HRConnect.Application/Features/Candidates/Commands/ApplyJob/ApplyJobCommand.cs) chứa command.
3. [`ApplyJobCommandValidator.cs`](../../HRConnect.Application/Features/Candidates/Commands/ApplyJob/ApplyJobCommandValidator.cs) kiểm tra input.
4. [`ApplyJobCommandHandler.cs`](../../HRConnect.Application/Features/Candidates/Commands/ApplyJob/ApplyJobCommandHandler.cs) xử lý nghiệp vụ.

Candidate tự nộp CV của chính mình nên không cần consent và không có Attribution cho Affiliate:

```text
Candidate apply
  → kiểm tra Job, Candidate và CV
  → kiểm tra trùng cùng Job
  → Submission(Source=CANDIDATE, Status=ACCEPTED)
  → JobApplication(SUBMITTED)
  → MF-03 scoring request
```

Nếu đã có Submission hoặc Application trong cùng Job, hệ thống trả `CANDIDATE_ALREADY_SUBMITTED` và có thể lưu lượt bị chặn phục vụ audit tùy nhánh xử lý.

## 7. Luồng xác minh định danh Candidate

Candidate quản lý email định danh và claim tại [`CandidateEndpoints.cs`](../../HRConnect.Presentation/Endpoints/V1/Candidates/CandidateEndpoints.cs).

Các feature liên quan nằm trong:

```text
HRConnect.Application/Features/Candidates/Identity/
```

Luồng tổng quát:

```text
Candidate tạo identity claim
  → hệ thống chuẩn hóa và kiểm tra email
  → gửi mã/link xác minh
  → Candidate xác minh
  → identity được liên kết với Candidate
  → lần nộp sau có thể resolve đúng Candidate
```

Admin xử lý trường hợp cần can thiệp qua [`AdminApprovalEndpoints.cs`](../../HRConnect.Presentation/Endpoints/V1/Admin/AdminApprovalEndpoints.cs) và nhóm endpoint identity claim tương ứng.

## 8. Luồng khiếu nại quyền giới thiệu

Điểm vào API nằm tại [`DisputeEndpoints.cs`](../../HRConnect.Presentation/Endpoints/V1/Disputes/DisputeEndpoints.cs).

Thứ tự file:

| File | Trách nhiệm |
| --- | --- |
| [`DisputeEndpoints.cs`](../../HRConnect.Presentation/Endpoints/V1/Disputes/DisputeEndpoints.cs) | API tạo, xem và xử lý khiếu nại |
| [`DisputeFeatures.cs`](../../HRConnect.Application/Features/Disputes/DisputeFeatures.cs) | Command, query, validation và handler nghiệp vụ |
| [`DisputeRepository.cs`](../../HRConnect.Infrastructure/Repositories/DisputeRepository.cs) | Đọc/ghi khiếu nại |
| [`Dispute.cs`](../../HRConnect.Domain/Entities/Dispute.cs) | Entity khiếu nại |

Bằng chứng dùng để xem xét gồm:

- thời gian Submission;
- snapshot email và số điện thoại;
- consent Candidate;
- Affiliate thắng Attribution;
- lịch sử audit;
- duplicate case và quyết định hợp nhất nếu có.

Dispute đang mở hoặc đang xem xét có thể khiến MF-05 giữ thanh toán hoa hồng cho đến khi có kết luận.

## 9. Điểm tích hợp MF-03, MF-04 và MF-05

### MF-03 — Chấm điểm AI

MF-02 không gọi AI trực tiếp trong transaction. Handler gọi `IMf03ScoringTrigger` để ghi yêu cầu bền vững; dispatcher gửi yêu cầu sau khi commit.

File gửi integration:

- [`Mf03ScoringDispatcher.cs`](../../HRConnect.Infrastructure/Services/Integration/Mf03ScoringDispatcher.cs)

Chỉ các hồ sơ đã tạo `JobApplication` mới được chấm điểm.

### MF-04 — Quy trình tuyển dụng

MF-04 nhận `JobApplication` do MF-02 tạo để tiếp tục screening, shortlist, phỏng vấn, offer và placement. MF-02 không tự chuyển các stage tuyển dụng này.

### MF-05 — Attribution và hoa hồng

MF-05 dùng `Attribution` để xác định Affiliate thắng quyền giới thiệu. Dispute hoặc trạng thái không hợp lệ có thể giữ hoặc ngăn thanh toán.

## 10. Các entity cốt lõi

| Entity | Ý nghĩa |
| --- | --- |
| `Candidate` | Một người ứng tuyển đã được hệ thống định danh |
| `CandidateCv` | CV thuộc Candidate |
| `Submission` | Một lượt đưa CV vào Job, kể cả đang chờ hoặc bị từ chối |
| `SubmissionConsent` | Quyết định đồng ý/từ chối của Candidate |
| `SubmissionIdentitySnapshot` | Bằng chứng định danh bất biến tại thời điểm nộp |
| `CandidateDuplicateCase` | Case nghi hai Candidate record là cùng một người |
| `CandidateDuplicateSignal` | Tín hiệu làm cơ sở cho case nghi trùng |
| `JobApplication` | Đơn ứng tuyển chính thức đi vào pipeline tuyển dụng |
| `Attribution` | Quyền giới thiệu của Affiliate đối với Application |
| `Dispute` | Khiếu nại liên quan đến lượt nộp hoặc Attribution |

Các entity chống trùng quan trọng:

- [`CandidateDuplicateCase.cs`](../../HRConnect.Domain/Entities/CandidateDuplicateCase.cs)
- [`CandidateDuplicateSignal.cs`](../../HRConnect.Domain/Entities/CandidateDuplicateSignal.cs)
- [`SubmissionIdentitySnapshot.cs`](../../HRConnect.Domain/Entities/SubmissionIdentitySnapshot.cs)

## 11. Trạng thái quan trọng

### Submission

```text
PENDING_CONSENT
  ├─ Candidate từ chối/hết hạn → CONSENT_REJECTED hoặc EXPIRED
  ├─ Đồng ý, không trùng       → ACCEPTED
  └─ Đồng ý, nghi trùng        → PENDING_IDENTITY_REVIEW
                                      ├─ Admin chấp nhận → ACCEPTED
                                      └─ Không hợp lệ    → BLOCKED_DUPLICATE/CANCELLED
```

### Consent

```text
PENDING → CONFIRMED | DECLINED | EXPIRED
```

### Application

Application chỉ xuất hiện sau khi Submission hợp lệ:

```text
SUBMITTED → SCREENING → SHORTLISTED → INTERVIEW → OFFER → HIRED
```

Các stage sau `SUBMITTED` thuộc pipeline tuyển dụng MF-04.

## 12. Thứ tự mở code khi review

Nếu giảng viên yêu cầu giải thích main workflow, mở theo thứ tự:

1. [`Program.cs`](../../HRConnect.Presentation/Program.cs) — Backend khởi động và đăng ký endpoint.
2. [`JobEndpoints.cs`](../../HRConnect.Presentation/Endpoints/V1/Jobs/JobEndpoints.cs) — request Affiliate đi vào hệ thống.
3. [`SubmitCandidateCommandHandler.cs`](../../HRConnect.Application/Features/Affiliates/Commands/SubmitCandidate/SubmitCandidateCommandHandler.cs) — tạo Submission, snapshot và consent.
4. [`SubmissionConsentEndpoints.cs`](../../HRConnect.Presentation/Endpoints/V1/SubmissionConsents/SubmissionConsentEndpoints.cs) — Candidate phản hồi.
5. [`RespondSubmissionConsentCommandHandler.cs`](../../HRConnect.Application/Features/SubmissionConsents/RespondSubmissionConsent/RespondSubmissionConsentCommandHandler.cs) — tạo Application, Attribution và yêu cầu MF-03.
6. [`ResolveCandidateDuplicateCase.cs`](../../HRConnect.Application/Features/CandidateDuplicates/Resolve/ResolveCandidateDuplicateCase.cs) — Admin xử lý hồ sơ trùng.
7. [`FinalizeIdentityReviewedSubmissionService.cs`](../../HRConnect.Application/Features/CandidateDuplicates/Finalization/FinalizeIdentityReviewedSubmissionService.cs) — hoàn tất hồ sơ sau review.
8. [`DisputeEndpoints.cs`](../../HRConnect.Presentation/Endpoints/V1/Disputes/DisputeEndpoints.cs) và [`DisputeFeatures.cs`](../../HRConnect.Application/Features/Disputes/DisputeFeatures.cs) — khiếu nại.

Nếu cần so sánh với Candidate tự ứng tuyển, mở thêm [`ApplyJobCommandHandler.cs`](../../HRConnect.Application/Features/Candidates/Commands/ApplyJob/ApplyJobCommandHandler.cs).

## 13. Test tương ứng

Các test quan trọng để chứng minh luồng:

- [`SubmitCandidateCommandHandlerTests.cs`](../../HRConnect.UnitTests/Features/Affiliates/SubmitCandidateCommandHandlerTests.cs)
- [`RespondSubmissionConsentCommandHandlerTests.cs`](../../HRConnect.UnitTests/Features/SubmissionConsents/RespondSubmissionConsentCommandHandlerTests.cs)
- [`FinalizeIdentityReviewedSubmissionServiceTests.cs`](../../HRConnect.UnitTests/Features/CandidateDuplicates/FinalizeIdentityReviewedSubmissionServiceTests.cs)
- [`ResolveCandidateDuplicateCaseCommandHandlerTests.cs`](../../HRConnect.UnitTests/Features/CandidateDuplicates/ResolveCandidateDuplicateCaseCommandHandlerTests.cs)
- [`DisputeTests.cs`](../../HRConnect.UnitTests/Features/Disputes/DisputeTests.cs)

Chạy test Backend:

```powershell
dotnet test .\HRConnect\HRConnect.UnitTests\HRConnect.UnitTests.csproj
```

## 14. Câu giải thích ngắn khi được hỏi

> Request MF-02 đi vào Minimal API trong Presentation. Endpoint kiểm tra quyền, tạo command và gửi qua MediatR. Handler trong Application xử lý quy tắc nghiệp vụ, sử dụng repository interface để đọc/ghi dữ liệu. Infrastructure hiện thực repository bằng EF Core và PostgreSQL. Với Affiliate submission, hệ thống chỉ tạo Submission chờ consent; sau khi Candidate đồng ý và vượt qua kiểm tra trùng mới tạo Application, Attribution và yêu cầu MF-03 chấm điểm. Nếu nghi trùng, hồ sơ được giữ lại để Admin xử lý rồi mới finalization. Toàn bộ các bước quan trọng đều có transaction, audit và cơ chế chống xử lý lặp.
