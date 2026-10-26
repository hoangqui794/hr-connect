# Kế hoạch sửa các điểm MF-04 phát hiện khi kiểm tra giao diện ngày 23/10/2026

> **Người rà soát và đề xuất bổ sung:** Khúc Ngọc Sơn
>
> **Trạng thái hoàn tất ngày 26/10/2026:** bốn nhóm sửa đã được triển khai bằng bốn commit và merge lên `main` tại `8498a82`. CI của merge MF-04 (`40127165410`) và CD kế tiếp (`40127711943`) đều thành công. Regression test liên-handler cho nhánh sửa sai `NOT_STARTED -> OFFER_ACCEPTED -> PLACED` được bổ sung sau đó để khóa hành vi tái sử dụng reconciliation, concurrency token, audit history và thời điểm khởi tạo finance.
>
> **Kết quả kiểm tra trước khi merge:** backend build sạch; 69/69 test backend mục tiêu MF-04 pass. Toàn bộ FE có 76/76 file và 396/396 test pass; lint mục tiêu và production build đều pass. Bộ test backend toàn repository đạt 1784/1785; test duy nhất lỗi thuộc MF-01 do PostgreSQL local chưa có cột `company_size_id`, không phát sinh từ thay đổi MF-04.
>
> **Phạm vi:** bổ sung sau UC-41 đã merge. Giữ nguyên lịch sử và quy tắc giữ phí của UC-41; không sửa nghiệp vụ MF-01, MF-02, MF-03 hoặc MF-05 ngoài điểm tích hợp bắt buộc với placement finance.

## 1. Kết luận rà soát

> Các mục trong phần này ghi lại hiện trạng phát hiện ngày 23/10/2026. Chúng đã được xử lý trong bốn commit liệt kê tại mục 4; không còn là danh sách việc chưa làm.

### 1.1 Lỗi chức năng cần sửa

1. **[Đã sửa] Sửa thông tin lịch không báo Candidate.**
   - FE dùng nút `Sửa thông tin lịch` và gọi `UpdateInterview` để đổi hình thức, thời lượng, địa điểm, link họp hoặc participant.
   - Trước bản sửa, `UpdateInterviewCommandHandler` chỉ lưu dữ liệu và audit; chưa gọi `ICandidateRecruitmentDeliveryService`, chưa tạo notification hoặc email outbox.
   - `RescheduleInterview` và `CancelInterview` khi đó đã gửi đúng qua in-app hoặc email fallback. Vì vậy lỗi được khoanh đúng ở đường **sửa thông tin lịch**.

2. **[Đã sửa] UC-41 phát hiện Client khai sai `NOT_STARTED`, nhưng chưa sửa lại được trạng thái nghiệp vụ.**
   - `MarkNotStarted` chuyển Application từ `OFFER_ACCEPTED` sang `NOT_STARTED` và không cho Client tự hoàn tác. Đây là nguyên tắc đúng vì Client không nên tự sửa một quyết định terminal đã ảnh hưởng phí/audit.
   - Trước bản sửa, luồng đối soát cho HR gắn `FLAGGED` nhưng `ResolveFlaggedReconciliation` chỉ đổi đối soát sang `CONFIRMED` và lưu `ResolutionNote`.
   - Khi Candidate/Affiliate chứng minh ứng viên thực sự đã đi làm, Application vẫn mắc ở `NOT_STARTED`, chưa có Placement và chưa có đường sửa chính thức. Đây là khoảng trống nghiệp vụ đã được khép lại.

### 1.2 Thiếu thông báo cần bổ sung

3. **[Đã sửa] Candidate không được báo khi Client đánh dấu “Không nhận việc”.**
   - Trước bản sửa, `MarkNotStartedCommandHandler` cập nhật trạng thái, audit và tạo đối soát cho `HEADHUNT_COD`, nhưng chưa gửi notification/email cho Candidate.
   - Candidate khi đó có thể tiếp tục nhìn dữ liệu cũ tới khi tải lại và không biết để phản hồi với HR Connect nếu Client khai nhầm.

### 1.3 Điểm UI Offer cần làm rõ, không phải lỗi backend

4. **[Đã làm rõ trên FE] Gross/Net:** nghiệp vụ hiện đúng. `HEADHUNT_COD` chỉ nhận Gross và backend đã chặn Net. FE hiển thị chú thích ngắn:
   - `Gross — trước thuế và các khoản khấu trừ`.
   - `Net — số tiền thực nhận theo thỏa thuận`.
   - Với Headhunt, khóa lựa chọn Net thay vì chờ submit mới báo lỗi.
5. **[Đã làm rõ trên FE] “Hạn phản hồi”:** đổi thành **“Hạn phản hồi Offer”** để tránh hiểu là hạn bắt đầu làm việc.
6. **[Đã làm rõ trên FE] “Link tài liệu/PDF Offer (không bắt buộc)”:** đây là URL dẫn tới thư mời/PDF chi tiết. Nhãn được đổi thành **“Tài liệu Offer (không bắt buộc)”** kèm giải thích “Dán đường dẫn bảo mật tới thư mời/PDF”. Upload file riêng tư lên Object Storage vẫn nằm ngoài phạm vi vì cần API upload, quyền tải và signed URL riêng.

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

- `UpdateInterviewCommandHandler` đã giao thay đổi Candidate nhìn thấy qua delivery service; participant-only không gửi thông báo.
- Realtime FE tiếp tục dùng ánh xạ `INTERVIEW` sẵn có tới application, timeline và interview detail; không tạo cơ chế realtime thứ hai.
- `MarkNotStartedCommandHandler` đã giao kết quả cho Candidate theo account-or-email policy.
- `ResolveFlaggedReconciliationCommandHandler` hỗ trợ `REOPEN_FOR_CLIENT_CONFIRMATION` và ghi đầy đủ audit/history.
- `ConfirmStartWork` và `MarkNotStarted` tái sử dụng reconciliation đã được Admin mở lại, không insert trùng `ApplicationId`.
- Form Offer đã làm rõ Gross/Net, hạn phản hồi và trường tài liệu; API contract và database Offer không đổi.

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

## 4. Lịch sử triển khai thực tế

Bản sửa được triển khai bằng **4 commit**, không phải 5 commit:

1. `edb0167` — `feat(mf04): extend candidate recruitment delivery`
   - Bổ sung delivery account-or-email cho kết quả `NOT_STARTED` và nền tảng template/metadata dùng chung.
2. `5c25886` — `fix(mf04): deliver interview detail updates`
   - Gửi thay đổi lịch Candidate cần biết; không gửi khi chỉ thay participant nội bộ.
3. `e6f9838` — `fix(mf04): reconcile incorrect not-started outcomes`
   - Thêm hành động Admin mở lại hồ sơ, migration `ResolutionAction`, audit/history và tái sử dụng reconciliation.
4. `71965a4` — `fix(mf04-fe): clarify offer terms and workflow guidance`
   - Làm rõ Gross/Net, hạn phản hồi Offer và tài liệu Offer; cập nhật UI Admin cho bước giải quyết sai lệch.

Bốn commit trên được merge lên `main` tại `8498a82`. Regression test bổ sung sau merge nằm trong commit độc lập `test(mf04): cover corrected not-started lifecycle`; commit này chỉ khóa luồng đã có, không bổ sung API, bảng hoặc nghiệp vụ mới.

## 5. Tiêu chí hoàn tất

- [x] Không có notification khi chỉ thay participant nội bộ.
- [x] Candidate nhận đúng một notification/email khi thông tin họ cần biết thay đổi.
- [x] Không cho Client tự hoàn tác `NOT_STARTED`.
- [x] Admin mở lại hồ sơ có audit đầy đủ và không làm phát sinh phí trước `ConfirmStartWork`.
- [x] Không còn lỗi unique reconciliation khi ghi nhận lại kết quả.
- [x] Candidate thấy trạng thái mới qua realtime hoặc REST polling fallback.
- [x] FE test, backend targeted test, full build và CI của merge MF-04 đều pass.
- [x] Quy tắc phát hành được giữ: chỉ push khi người dùng yêu cầu rõ; chờ CI xanh trước khi merge nhánh kế tiếp.

## 6. Regression test và smoke checklist

### 6.1 Regression test tự động

`Mf04HappyPathFlowTests.IncorrectNotStartedClaim_CanBeReopenedAndCorrectedWithoutDuplicateReconciliation` kiểm tra xuyên handler:

1. Client khai `NOT_STARTED` từ `OFFER_ACCEPTED`; Candidate nhận delivery đúng một lần.
2. Hệ thống tạo đúng một reconciliation `PENDING`; stale concurrency token bị từ chối.
3. Internal HR đánh dấu sai lệch `FLAGGED`; Platform Admin mở lại hồ sơ về `OFFER_ACCEPTED`.
4. Chưa khởi tạo finance ở bước mở lại.
5. Client xác nhận đi làm; Application sang `PLACED` và reconciliation cũ được reset về `PENDING/STARTED` thay vì insert bản ghi mới.
6. Dữ liệu review cũ được xóa, token đổi và lịch sử trạng thái vẫn được giữ.
7. Internal HR xác nhận lần cuối; reconciliation sang `CONFIRMED`.

### 6.2 Smoke checklist trên deploy

- Client sửa địa điểm/link/hình thức/thời lượng: Candidate nhận một cập nhật và thấy dữ liệu mới sau realtime hoặc tải lại.
- Client chỉ sửa participant: Candidate không nhận thông báo.
- Client khai “Không nhận việc”: Candidate nhận thông báo; Application sang `NOT_STARTED`; Client không có nút tự hoàn tác.
- Internal HR đối soát không khớp: hồ sơ sang `FLAGGED`; Platform Admin thấy hai lựa chọn xử lý.
- Platform Admin mở lại: Application về `OFFER_ACCEPTED`, chưa phát sinh Placement hoặc finance.
- Client xác nhận đi làm: Application sang `PLACED`; danh sách đối soát chỉ có một bản ghi của Application và quay lại `PENDING`.
- Internal HR xác nhận kết quả mới: reconciliation sang `CONFIRMED`.

