# Kế hoạch sửa các điểm MF-04 phát hiện khi kiểm tra giao diện ngày 23/10/2026

> **Người rà soát và đề xuất bổ sung:** Khúc Ngọc Sơn
>
> **Trạng thái triển khai ngày 25/10/2026:** đã đối chiếu và rebase trên `main` tại merge commit `601cdd2`; bốn nhóm sửa bên dưới được lưu thành bốn commit trên nhánh `codex/mf04-demo-flow-corrections`. Backend build sạch; 69/69 test backend mục tiêu MF-04 pass. Toàn bộ FE có 76/76 file và 396/396 test pass; lint mục tiêu và production build đều pass. Bộ test backend toàn repository đạt 1784/1785; test duy nhất lỗi thuộc MF-01 do PostgreSQL local chưa có cột `company_size_id`, không phát sinh từ thay đổi MF-04.
>
> **Phạm vi:** bổ sung sau UC-41 đã merge. Giữ nguyên lịch sử và quy tắc giữ phí của UC-41; không sửa nghiệp vụ MF-01, MF-02, MF-03 hoặc MF-05 ngoài điểm tích hợp bắt buộc với placement finance.

## 1. Kết luận rà soát

### 1.1 Lỗi chức năng cần sửa

1. **Sửa thông tin lịch không báo Candidate.**
   - FE dùng nút `Sửa thông tin lịch` và gọi `UpdateInterview` để đổi hình thức, thời lượng, địa điểm, link họp hoặc participant.
   - `UpdateInterviewCommandHandler` hiện chỉ lưu dữ liệu và audit; không gọi `ICandidateRecruitmentDeliveryService`, không tạo notification và không tạo email outbox.
   - `RescheduleInterview` và `CancelInterview` đã gửi đúng qua in-app hoặc email fallback. Vì vậy lỗi chỉ nằm ở đường **sửa thông tin lịch**, đúng với hiện tượng đã thấy trên deploy.

2. **UC-41 phát hiện Client khai sai `NOT_STARTED`, nhưng chưa sửa lại được trạng thái nghiệp vụ.**
   - `MarkNotStarted` chuyển Application từ `OFFER_ACCEPTED` sang `NOT_STARTED` và không cho Client tự hoàn tác. Đây là nguyên tắc đúng vì Client không nên tự sửa một quyết định terminal đã ảnh hưởng phí/audit.
   - Luồng đối soát mới cho HR gắn `FLAGGED` và Platform Admin đóng hồ sơ, nhưng `ResolveFlaggedReconciliation` hiện chỉ đổi trạng thái đối soát sang `CONFIRMED` và lưu `ResolutionNote`.
   - Nếu Candidate/Affiliate chứng minh ứng viên thực sự đã đi làm, Application vẫn là `NOT_STARTED`, chưa có Placement và chưa có đường sửa chính thức. Đây là khoảng trống nghiệp vụ thật.

### 1.2 Thiếu thông báo cần bổ sung

3. **Candidate không được báo khi Client đánh dấu “Không nhận việc”.**
   - `MarkNotStartedCommandHandler` hiện cập nhật trạng thái, audit và tạo đối soát cho `HEADHUNT_COD`, nhưng không gửi notification/email cho Candidate.
   - Candidate có thể tiếp tục nhìn dữ liệu cũ cho tới khi tải lại, và không biết để phản hồi với HR Connect nếu Client khai nhầm.

### 1.3 Điểm UI Offer cần làm rõ, không phải lỗi backend

4. **Gross/Net:** nghiệp vụ hiện đúng. `HEADHUNT_COD` chỉ nhận Gross và backend đã chặn Net. FE cần chú thích ngắn:
   - `Gross — trước thuế và các khoản khấu trừ`.
   - `Net — số tiền thực nhận theo thỏa thuận`.
   - Với Headhunt, khóa lựa chọn Net thay vì chờ submit mới báo lỗi.
5. **“Hạn phản hồi”:** không sai, nhưng nên đổi thành **“Hạn phản hồi Offer”** hoặc **“Phản hồi trước ngày”** để tránh hiểu là hạn bắt đầu làm việc.
6. **“Link tài liệu/PDF Offer (không bắt buộc)”:** đây là URL dẫn tới thư mời/PDF chi tiết. Trước mắt đổi câu chữ thành **“Tài liệu Offer (không bắt buộc)”** và giải thích “Dán đường dẫn bảo mật tới thư mời/PDF”. Upload file riêng tư lên Object Storage là cải tiến lớn hơn, chỉ làm khi nhóm chốt phạm vi vì cần API upload, quyền tải và signed URL.

## 2. Những phần đã đúng, không sửa lại

- Candidate chỉ **xác nhận tham gia**, không có quyền tự dời lịch.
- Client được dời/hủy lịch; cả hai đường đã có notification in-app hoặc email fallback.
- Khi Client dời lịch, xác nhận tham gia cũ được xóa để Candidate xác nhận lại giờ mới.
- Candidate không bấm xác nhận thì lịch vẫn `SCHEDULED`; xác nhận là tín hiệu hỗ trợ vận hành, không phải điều kiện được phỏng vấn.
- `FAIL` kết thúc hồ sơ ở `INTERVIEW_FAILED`; `PASS` chưa phải vòng cuối giữ hồ sơ ở `INTERVIEW`; `BACKUP` chờ Client quyết định.
- Offer draft không gửi thông báo; chỉ khi gửi Offer mới giao tới Candidate. Thu hồi và hết hạn cũng đã có delivery.
- Client không được tự hoàn tác `NOT_STARTED`; mọi sửa sai phải qua HR/Admin, có ghi chú và audit.

## 3. Thiết kế sửa

### 3.0 Kết quả kiểm tra lại code mới

- `UpdateInterviewCommandHandler` vẫn chỉ lưu và audit; chưa gọi delivery service. Đây là lỗi thật.
- Realtime FE đã có sẵn ánh xạ `INTERVIEW` tới application, timeline và interview detail. Vì vậy không tạo thêm cơ chế realtime thứ hai; chỉ cần tạo notification đúng metadata và thêm regression test.
- `MarkNotStartedCommandHandler` vẫn chưa giao thông báo cho Candidate.
- `ResolveFlaggedReconciliationCommandHandler` vẫn chỉ đóng `FLAGGED -> CONFIRMED`; chưa thể sửa một khai báo `NOT_STARTED` sai.
- Hai handler `ConfirmStartWork` và `MarkNotStarted` vẫn luôn thêm reconciliation mới. Sau khi Admin mở lại hồ sơ, cách này sẽ đụng unique `ApplicationId`; phải đổi sang tái sử dụng bản ghi hiện có.
- Các nhãn Offer vẫn là `Hạn phản hồi` và `Link tài liệu/PDF Offer (không bắt buộc)`; Gross/Net chưa có giải thích và Net chưa bị khóa sớm cho `HEADHUNT_COD`.

### 3.1 Thông báo khi sửa thông tin lịch

- Thêm event delivery `InterviewCandidateDeliveryEvent.Updated` và template `CANDIDATE_INTERVIEW_UPDATED`.
- `UpdateInterviewCommandHandler` so sánh giá trị trước/sau của các trường Candidate nhìn thấy: hình thức, thời lượng, địa điểm và meeting link.
- Chỉ gửi thông báo khi ít nhất một trường Candidate nhìn thấy thay đổi. Thay đổi participant nội bộ không gửi Candidate.
- Candidate có tài khoản nhận notification và SignalR; Candidate chưa liên kết tài khoản nhận email outbox. Nội dung không lộ participant hoặc dữ liệu đánh giá nội bộ.
- Metadata phải có `applicationId`, `interviewId`, `round`, `eventType=UPDATED` và route tới đúng chi tiết phỏng vấn.
- Việc sửa thông tin không đổi giờ nên không xóa `CandidateAttendanceStatus`. Chỉ `RescheduleInterview` mới xóa xác nhận cũ.

### 3.2 Sửa sai kết quả `NOT_STARTED` theo quy trình có kiểm soát

- Không tạo nút “hoàn tác” cho Client.
- Mở rộng xử lý hồ sơ `FLAGGED` cho Platform Admin với hai kết quả rõ ràng:
  1. `CONFIRM_REPORTED_OUTCOME`: xác nhận kết quả Client khai là đúng; Application giữ trạng thái hiện tại.
  2. `REOPEN_FOR_CLIENT_CONFIRMATION`: xác nhận Client khai sai; Application quay lại `OFFER_ACCEPTED` để Client dùng API `ConfirmStartWork` hiện có và nhập ngày thực tế.
- Lưu `ResolutionAction`, `ResolutionNote`, người xử lý và thời điểm xử lý; ghi audit cả trạng thái Application cũ/mới. `ResolutionAction` nhận `CONFIRM_REPORTED_OUTCOME` hoặc `REOPEN_FOR_CLIENT_CONFIRMATION`.
- Khi Admin mở lại, reconciliation chuyển sang `CONFIRMED` với `ResolutionAction=REOPEN_FOR_CLIENT_CONFIRMATION`, còn Application quay về `OFFER_ACCEPTED`. Không cần thêm trạng thái reconciliation trung gian vì lúc này chưa có Placement/ServiceFee để giữ.
- Khi Client xác nhận đi làm, handler tái sử dụng/reset bản ghi đó thành `PENDING`, `ClaimedOutcome=STARTED`, gắn Placement mới và xóa dữ liệu review cũ, tránh vi phạm unique `ApplicationId`.
- Nếu Client lại chọn `NOT_STARTED`, cũng tái sử dụng bản ghi theo quy tắc idempotent thay vì insert trùng.
- Không tạo phí khi chỉ mở lại hồ sơ. Tài chính chỉ được khởi tạo qua `ConfirmStartWork` như luồng chuẩn.

### 3.3 Báo Candidate khi Client khai không đi làm

- Sau khi lưu `NOT_STARTED`, gửi thông báo an toàn: “Doanh nghiệp đã cập nhật rằng bạn chưa bắt đầu làm việc; HR Connect đang/ sẽ xác minh kết quả”.
- Candidate có tài khoản nhận in-app + SignalR; chưa có tài khoản nhận email fallback.
- Notification dẫn tới Application của Candidate và làm mới application detail/timeline.
- Candidate chỉ được xem và liên hệ hỗ trợ; không thêm nút tự sửa trạng thái hoặc tự mở Placement.

### 3.4 Làm rõ form Offer

- Thêm tooltip/help cho Gross và Net; khóa Net với `HEADHUNT_COD`.
- Đổi `Hạn phản hồi` thành `Hạn phản hồi Offer`.
- Đổi label URL thành `Tài liệu Offer (không bắt buộc)` và thêm help text về đường dẫn bảo mật.
- Giữ nguyên contract API và database ở commit UI này.

## 4. Chia commit triển khai

### Commit 1 — `fix(mf04): deliver interview detail updates to candidates`

- Backend event/template `InterviewUpdated`.
- Gắn delivery vào `UpdateInterviewCommandHandler` sau khi xác định thay đổi Candidate nhìn thấy.
- Test in-app, email fallback, participant-only không gửi và payload không lộ dữ liệu nội bộ.
- Giữ cơ chế SignalR hiện có; thêm regression test xác nhận notification `INTERVIEW/UPDATED` làm mới application detail, timeline và interview detail.

### Commit 2 — `feat(mf04): add audited correction for incorrect not-started outcomes`

- Migration bổ sung `ResolutionAction` và trạng thái cần thiết cho reconciliation.
- Mở rộng command và UI Admin để chọn xác nhận claim hoặc mở lại `OFFER_ACCEPTED`.
- Tái sử dụng reconciliation khi Client ghi nhận kết quả lần nữa.
- Test concurrency, idempotency, audit và không tạo phí sớm.

### Commit 3 — `feat(mf04): notify candidates of reported not-started outcomes`

- Delivery account-or-email cho `MarkNotStarted`.
- Metadata/route an toàn và realtime invalidation.
- Test Candidate có tài khoản, không có tài khoản và không có kênh liên hệ.

### Commit 4 — `fix(mf04-fe): clarify offer salary deadline and document fields`

- Tooltip Gross/Net, khóa Net cho Headhunt.
- Sửa label hạn phản hồi và tài liệu Offer.
- Test form tạo/sửa Offer giữ nguyên DTO hiện tại.

### Commit 5 — `test(mf04): cover corrected demo flow end to end`

- Test tích hợp: sửa thông tin lịch → Candidate nhận realtime và thấy dữ liệu mới.
- Test: Client khai `NOT_STARTED` → HR flag → Admin mở lại → Client xác nhận đi làm → reconciliation mới `PENDING` → HR xác nhận.
- Test phân quyền: Candidate/Client/Internal HR không gọi được endpoint sửa sai của Platform Admin.
- Cập nhật activity diagram, tài liệu MF-04 và test script Swagger/deploy.

## 5. Tiêu chí hoàn tất

- Không có notification khi chỉ thay participant nội bộ.
- Candidate nhận đúng một notification/email khi thông tin họ cần biết thay đổi.
- Không cho Client tự hoàn tác `NOT_STARTED`.
- Admin mở lại hồ sơ có audit đầy đủ và không làm phát sinh phí trước `ConfirmStartWork`.
- Không còn lỗi unique reconciliation khi ghi nhận lại kết quả.
- Candidate thấy trạng thái mới qua realtime hoặc REST polling fallback.
- FE test, backend targeted test, full build và CI đều pass trước khi chuyển sang nhánh tiếp theo.
- Chỉ push khi người dùng yêu cầu rõ; mỗi nhánh phải chờ CI xanh trước khi merge tiếp.

