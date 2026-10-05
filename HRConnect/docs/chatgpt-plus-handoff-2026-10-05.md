# Bàn giao ChatGPT Plus — HR Connect

Ngày bàn giao: 05/10/2026 (GMT+7)  
Repository: `https://github.com/hoangqui794/hr-connect`  
Workspace thường dùng: `D:\Ki_9\HRConnect\HRConnect`

## Cách làm việc cần giữ

- Người dùng gọi trợ lý là **VIKI**; trả lời bằng tiếng Việt, dễ hiểu, gần gũi.
- Làm trực tiếp trong code folder khi được yêu cầu.
- Tạo nhánh mới theo dạng `feature/<ten-chuc-nang>`, không dùng `codex/`.
- Khi hoàn thành một API hoặc một nhóm thay đổi nghiệp vụ độc lập: chạy kiểm tra phù hợp, commit và **push ngay**.
- Chỉ merge vào `dev` hoặc `main` khi người dùng yêu cầu rõ.
- Không đưa secret/API key/token vào Git, log, audit log hoặc tài liệu.
- Khi thêm permission mới: phải thêm vào seeder và gán mặc định cho role phù hợp.
- Khi thay đổi database: cần có migration, kiểm tra foreign key/transaction để không tạo lỗi 500 hoặc dữ liệu mồ côi.

## Dự án

HR Connect là nền tảng tuyển dụng kết nối Candidate, Affiliate Recruiter, Client Company, HR/Admin và các dịch vụ AI. Backend là ASP.NET Core/.NET 8 theo Clean Architecture:

- `HRConnect.Domain`: entity và nghiệp vụ cốt lõi.
- `HRConnect.Application`: command/query, validation, interface.
- `HRConnect.Infrastructure`: EF Core/PostgreSQL, repository, R2 storage, Resend email, background worker, tích hợp MF03.
- `HRConnect.Presentation`: Minimal API endpoints, Swagger, xác thực và rate limit.
- `HRConnect.UnitTests`: unit/integration-oriented test cho các luồng nghiệp vụ.

## Các Main Flow

| MF | Chức năng | Trạng thái/phụ trách |
| --- | --- | --- |
| MF01 | Account, Auth, role/permission, đăng ký OTP và Admin approval | Đã làm nhiều; đang hoàn thiện audit Auth/Admin. |
| **MF02** | Candidate/CV submission, duplicate check, attribution, Candidate consent, trigger AI | **Đây là phần trọng tâm người dùng phụ trách.** Luồng chính đã khá hoàn chỉnh. |
| MF03 | AI matching/chấm điểm CV so với Job, hỗ trợ reviewer sàng lọc | Dev khác phụ trách. MF02 chỉ tạo queue/outbox để gọi MF03. |
| MF04+ | Tuyển dụng tiếp theo: screening, interview, offer, placement, commission/payout | Dev khác phụ trách. |

## MF02 — nghiệp vụ đã thống nhất

### Hai nguồn nộp hồ sơ

1. **Candidate tự ứng tuyển**: chọn một CV có sẵn hoặc upload đúng một file PDF mới. Hệ thống kiểm tra job, service type, quyền nộp, Candidate hợp lệ và duplicate trước khi tạo Application.
2. **Affiliate Recruiter nộp hộ Candidate**: nhập Candidate/CV cho Job. Hệ thống resolve Candidate bằng email + phone, kiểm tra danh tính và duplicate, lưu Submission chờ Candidate consent.

### Candidate do Affiliate nộp

- Nếu Candidate đã tồn tại: submission liên kết với bản ghi `candidate` hiện có.
- Nếu chưa tồn tại: tạo bản ghi `candidate` với `user_id = NULL`; sau này Candidate đăng ký/xác thực email đúng thì hệ thống liên kết hồ sơ đó với `app_user`.
- CV được lưu R2 và metadata nằm ở `candidate_cv`, liên kết `candidate_id`.
- Candidate có tài khoản xác nhận trên trang web sau khi đăng nhập; Candidate chưa có tài khoản xác nhận qua link email một lần.
- Trước consent: submission là `PENDING_CONSENT`; chưa tạo Application, Attribution và chưa gọi MF03.
- Khi Candidate đồng ý: kiểm tra duplicate lần cuối, kiểm tra Candidate/Affiliate còn hợp lệ; sau đó cùng transaction tạo Application, Attribution (nếu Affiliate nộp) và queue yêu cầu MF03.
- Khi từ chối/hết hạn: đóng submission có kiểm soát, giữ lịch sử/audit; không tạo Application.
- Affiliate có lịch sử nộp Candidate/Job và có thể resend consent theo cooldown. Cần tránh gửi đồng thời nhiều email resend.

### Ràng buộc bảo mật/business MF02 đã xử lý trước đó

- Chống nộp trùng theo Candidate + Job; lưu lịch sử blocked submission.
- Email/phone xác định Candidate phải nhất quán; nếu email trỏ Candidate A và phone trỏ Candidate B hoặc email không thuộc Candidate tìm theo phone thì trả `409 Conflict`.
- Candidate archive/merged/inactive không được tự apply hoặc được dùng cho consent.
- Affiliate phải còn `app_user ACTIVE`, profile `ACTIVE` và role Affiliate hợp lệ tại thời điểm Candidate confirm; nếu không thì không tạo Attribution.
- File CV chỉ nhận PDF hợp lệ, giới hạn thời hạn presigned URL, kiểm tra ownership CV.
- Candidate tự apply phải gửi đúng một nguồn CV: `file` hoặc `cvId`; không được gửi cả hai. Nếu không gửi nguồn nào thì có thể dùng CV primary theo business hiện có.
- Candidate apply có rate limit; Auth và các API nhạy cảm đã có/đang dùng rate limit phù hợp.
- MF03 dispatch có retry backoff, giới hạn retry và trạng thái `FAILED`; API retry thủ công. Đây là phần dispatch bên MF02, không sửa business nội bộ MF03.

## Audit logging chung

`audit_log` là bảng append-only dùng chung toàn hệ thống; không tạo bảng log riêng cho mỗi MF.

Các trường quan trọng:

- Actor (`actor_user_id`, `actor_type`), hành động (`action`), entity (`entity_type`, `entity_id`).
- `old_values`, `new_values` dạng JSON đã redaction các trường nhạy cảm.
- `correlation_id`, IP, user agent, source/service và thời điểm tạo.

Quy tắc: không bao giờ audit raw password, OTP, refresh token, access token, secret, cookie, presigned URL hoặc nội dung CV.

MF02 đã có audit cho CV, submission, duplicate, consent, Application/Attribution và luồng worker hết hạn consent. Có API Admin xem audit log.

## Trạng thái Git hiện tại

Nhánh đang làm:

```text
feature/auth-admin-production-hardening
```

Đã push lên origin. Chưa merge vào `dev` hay `main` theo yêu cầu người dùng.

Các commit mới nhất:

```text
99ec055 feat(auth): audit account registration events
b61e552 fix(auth): persist approval emails and audit events
e86c20c fix(admin): scope approval queues by permission
f1e1b58 merge: promote dev to main
```

## Những phần Auth/Admin đã hoàn thành trên nhánh hiện tại

1. `GET /api/v1/admin/approvals`
   - Không còn trả hồ sơ `PENDING` chưa xác thực OTP, kể cả khi không truyền query `status`.
   - Permission `affiliate.verify` chỉ xem Affiliate; `company.verify` chỉ xem Client; Admin hoặc người có cả hai mới xem danh sách hợp nhất.
2. Email sau khi Affiliate/Client xác thực OTP và sau khi Admin duyệt/từ chối:
   - Đã bỏ `Task.Run`.
   - Ghi email trạng thái vào `email_outbox` cùng transaction nghiệp vụ.
   - `AccountLifecycleEmailOutboxWorker` gửi/retry có backoff và tối đa 5 lần.
   - Worker cố ý **không** replay OTP đăng ký cũ. OTP chỉ gửi ở request đăng ký hoặc resend rõ ràng, để tránh người bỏ dở đăng ký bỗng nhận mail cũ.
3. Audit đã có:
   - `AFFILIATE_REGISTERED`, `CLIENT_REGISTERED`, `CANDIDATE_REGISTERED`.
   - `EMAIL_VERIFIED`.
   - `AFFILIATE_APPROVED`, `AFFILIATE_REJECTED`.
   - `CLIENT_APPROVED`, `CLIENT_REJECTED`.
4. Kiểm tra đã chạy trước khi dừng:
   - `AdminApprovalServiceTests` và `VerifyEmailOtpCommandHandlerTests`: 24 tests passed.
   - `RegisterAffiliate/Client/CandidateCommandHandlerTests`: 14 tests passed.
   - Build solution thành công; còn một warning cũ ở `CreateJobCommandValidator.cs` về nullable dereference, không thuộc thay đổi này.

## Việc Auth/Admin còn phải làm tiếp

Hoàn thiện audit cho các API/command bảo mật sau, cùng transaction với thay đổi dữ liệu:

1. `PASSWORD_CHANGED` — `ChangePasswordCommandHandler`.
2. `PASSWORD_RESET` — `ResetPasswordCommandHandler`.
3. `SESSION_REVOKED` — `LogoutCommandHandler`, chỉ khi token thuộc user và thực sự bị revoke.
4. `ALL_SESSIONS_REVOKED` — `LogoutAllCommandHandler`.
5. `REFRESH_TOKEN_REUSE_DETECTED` — `RefreshTokenCommandHandler`, khi refresh token đã revoked/replaced bị dùng lại và hệ thống thu hồi toàn bộ session.

Yêu cầu khi làm:

- Không log password/token/hash dưới bất kỳ dạng nào.
- Audit phải không làm hỏng idempotency của logout.
- Khi refresh token reuse: audit cần được ghi trước commit cùng việc revoke toàn bộ session.
- Cập nhật unit tests của từng handler; commit/push riêng một nhóm API đã hoàn chỉnh.

## Các phần MF02 nên rà lại sau khi Auth audit hoàn thành

Không cần sửa ngay nếu chưa có yêu cầu, nhưng đây là backlog production theo ưu tiên:

1. Chống hai request resend consent đồng thời để không phát hai mail/token vô hiệu lẫn nhau.
2. Candidate quản lý CV do Affiliate upload: API xem CV trong kho và thu hồi quyền tái sử dụng, nhưng vẫn giữ lịch sử Application cũ.
3. Kiểm tra notification cho Affiliate khi consent `CONFIRMED`, `DECLINED`, `EXPIRED` đã có đầy đủ cả UI/API hay chưa.
4. Rà Swagger sau mỗi API: tag đúng nhóm, mô tả quyền, request/response và status code chuẩn.

## API/UX consent cần nhớ

- Candidate **có tài khoản**: FE không yêu cầu người dùng nhập token. Người dùng đăng nhập web, FE dùng access token tự động để xem/xác nhận consent.
- Candidate **chưa có tài khoản**: link email chứa one-time consent token; FE gọi review/respond API bằng token này.
- APIs email-token hiện hữu:
  - `POST /api/v1/submission-consents/review`
  - `POST /api/v1/submission-consents/respond`
- Có tài liệu FE tại:
  - `docs/frontend-submission-consent-flow.md`
  - `docs/mf02-candidate-consent.md`

## Prompt ngắn để bắt đầu chat mới

```text
Bạn là VIKI, đang tiếp tục dự án HR Connect tại D:\\Ki_9\\HRConnect\\HRConnect. Hãy đọc file docs/chatgpt-plus-handoff-2026-10-05.md trước khi làm bất kỳ thay đổi nào. Hiện nhánh làm việc là feature/auth-admin-production-hardening; chưa được merge vào dev/main. Tiếp tục hoàn thiện audit Auth còn lại theo đúng file bàn giao: Change Password, Reset Password, Logout, Logout All và refresh-token reuse. Làm trên nhánh hiện tại, kiểm tra bằng test phù hợp, commit và push ngay sau mỗi nhóm API hoàn chỉnh. Không ghi password, OTP hay token vào audit/log. Trao đổi bằng tiếng Việt dễ hiểu.
```
