# Bàn giao Backend MF-04 phục vụ giao diện Candidate

> Người nhận: Dev phụ trách MF-04 — Application lifecycle, Interview, Offer và Placement.
>
> Ngày rà soát: 2026-10-12.
>
> Phiên bản đối chiếu: nhánh `main`, commit `fde7aa3`.
>
> Tài liệu này chỉ mô tả phần backend MF-04 mà giao diện Candidate cần. Việc tạo Submission/Application ban đầu, CV, consent và attribution thuộc MF-02; tạo/duyệt/công bố Job thuộc MF-01.

## 1. Phân định trách nhiệm

| Chức năng | Module sở hữu | Ghi chú |
|---|---|---|
| Tạo Application từ lượt nộp hợp lệ | MF-02 | MF-04 nhận Application sau khi được tạo. |
| Vòng đời Application sau khi nộp | **MF-04** | Screening, Interview, Offer, Placement và trạng thái kết thúc. |
| Candidate rút Application | **MF-04** | Phải xử lý Interview/Offer liên quan trong cùng transaction. |
| Candidate xem lịch Interview | **MF-04** | Chỉ dữ liệu công khai của chính Candidate. |
| Candidate xem/phản hồi Offer | **MF-04** | Chỉ Offer `SENT` thuộc Application của Candidate. |
| Timeline tuyển dụng | **MF-04** | Phải có projection riêng cho Candidate, không lộ actor/feedback nội bộ. |
| File CV gốc và consent sử dụng CV | MF-02 | MF-04 chỉ cấp quyền xem bản CV đã gắn với Application. |
| AI scoring | MF-03 | MF-04 chỉ hiển thị summary an toàn nếu cần. |

## 2. Phần hiện tại đã đúng — không làm lại

### 2.1 Candidate rút Application

```http
POST /api/v1/recruitment/applications/{applicationId}/withdraw
```

API hiện đã:

- Yêu cầu permission `application.withdraw_own`.
- Kiểm tra Application thuộc Candidate đang đăng nhập.
- Yêu cầu `concurrencyToken`.
- Chặn các trạng thái terminal.
- Huỷ Interview `SCHEDULED` liên quan.
- Thu hồi Offer `DRAFT`/`SENT` liên quan.
- Chuyển Application sang `WITHDRAWN`.
- Ghi status history và audit.

Không viết lại command này. Khoảng trống hiện tại là Candidate FE chưa lấy được `concurrencyToken` từ API detail phù hợp để gọi nó.

### 2.2 Candidate xem Interview

```http
GET /api/v1/interviews
GET /api/v1/interviews/{interviewId}
GET /api/v1/interviews/{interviewId}/history
```

Backend đã hỗ trợ permission `interview.view_own`, lọc ownership và projection an toàn. Candidate không nhận participant nội bộ, feedback hay kết quả đánh giá nhạy cảm.

### 2.3 Candidate xem và phản hồi Offer

```http
GET  /api/v1/offers
GET  /api/v1/offers/{offerId}
POST /api/v1/offers/{offerId}/response
```

Backend đã hỗ trợ:

- `offer.view_own` cho Candidate.
- Chỉ xem Offer thuộc Application của mình.
- Candidate chỉ phản hồi Offer đã gửi.
- `ACCEPTED` hoặc `DECLINED`; từ chối phải có lý do theo validator hiện tại.
- Concurrency token và ownership được kiểm tra ở server.

### 2.4 Offer hết hạn

Worker hiện đã chuyển Offer hết hạn và tạo notification cho Candidate. Không tạo worker thứ hai.

## 3. Backend MF-04 cần bổ sung

## A. Candidate projection cho Application detail — ưu tiên rất cao

Candidate UI hiện dùng:

```http
GET /api/v1/candidates/applications/{applicationId}
```

Response MF-02 này chỉ có thông tin cơ bản và không trả `concurrencyToken`, Interview, Offer, Placement hoặc allowed actions. Trong khi endpoint MF-04:

```http
GET /api/v1/recruitment/applications/{applicationId}
```

đã có dữ liệu đầy đủ nhưng hiện chỉ cho Client Company, Internal HR và Admin truy cập.

### Hướng triển khai đề xuất

Mở rộng endpoint MF-04 hiện tại để nhận Candidate có permission `application.view_own` và kiểm tra Application thuộc Candidate đang đăng nhập.

Không trả nguyên DTO nội bộ cho Candidate. Tạo projection riêng, ví dụ `CandidateRecruitmentApplicationDetailDto`:

```json
{
  "applicationId": "uuid",
  "jobId": "uuid",
  "jobTitle": "string",
  "companyId": "uuid",
  "companyName": "string",
  "status": "INTERVIEW",
  "currentStage": "INTERVIEW",
  "statusReason": "string|null",
  "appliedAt": "datetime",
  "updatedAt": "datetime",
  "plannedStartDate": "date|null",
  "concurrencyToken": "uuid",
  "submittedCv": {
    "cvId": "uuid",
    "title": "string|null",
    "fileName": "string|null"
  },
  "interviews": [],
  "offers": [],
  "placement": null,
  "allowedActions": ["WITHDRAW_APPLICATION"]
}
```

Candidate projection không được chứa:

- Feedback nội bộ.
- `recordedBy`, actor nội bộ hoặc participant nội bộ.
- AI diagnostics, fingerprints, parse warnings kỹ thuật.
- Ghi chú xác nhận nội bộ của Company.
- Draft Offer chưa gửi.
- Lý do nội bộ mà policy không cho Candidate xem.

`allowedActions` phải do server tính. Candidate không tự suy luận từ status ở frontend.

Tối thiểu hỗ trợ:

- `WITHDRAW_APPLICATION` khi Application chưa terminal.
- `VIEW_INTERVIEW` khi có Interview Candidate được phép xem.
- `RESPOND_OFFER` khi có Offer `SENT` còn hiệu lực.

Tiêu chí nghiệm thu:

1. Candidate A không xem được Application của Candidate B.
2. Candidate nhận được `concurrencyToken` mới nhất để rút hồ sơ.
3. Candidate không thấy feedback/actor/Offer draft nội bộ.
4. Client/Internal/Admin vẫn nhận projection hiện tại, không bị thay đổi contract.
5. Có test riêng cho projection Candidate và ownership.

## B. Candidate projection cho Application timeline — ưu tiên cao

Endpoint hiện tại:

```http
GET /api/v1/recruitment/applications/{applicationId}/timeline
```

chỉ cho Client/Internal/Admin. Candidate UI cần timeline dễ hiểu để biết hồ sơ đang ở đâu.

Mở quyền cho Candidate có `application.view_own`, sau khi kiểm tra ownership, nhưng phải lọc sự kiện.

Candidate được thấy:

- Đã nộp hồ sơ.
- Bắt đầu xem xét/sàng lọc.
- Được chọn hoặc chưa phù hợp.
- Lịch phỏng vấn được tạo/dời/huỷ.
- Offer đã gửi/chấp nhận/từ chối/hết hạn.
- Ngày dự kiến đi làm.
- Company xác nhận đã đi làm hoặc không bắt đầu làm việc.
- Candidate tự rút hồ sơ.

Candidate không được thấy:

- Tên/ID người nội bộ thực hiện.
- Feedback phỏng vấn nội bộ.
- Ghi chú đánh giá, lý do kỹ thuật hoặc audit payload.
- Draft Offer.
- Thông tin Affiliate nhạy cảm.

Nên trả `title`, `description`, `occurredAt`, `eventType`, `status` đã được server chuẩn hóa cho Candidate. FE không nên dịch raw audit log.

Tiêu chí nghiệm thu:

1. Timeline đúng thứ tự và hỗ trợ `ascending`.
2. Candidate chỉ xem timeline Application của mình.
3. Dữ liệu nhạy cảm bị loại ngay tại query/DTO, không chỉ ẩn bằng CSS.

## C. Candidate xem CV đã nộp theo Application — ưu tiên cao

Endpoint hiện tại:

```http
GET /api/v1/recruitment/applications/{applicationId}/cv/download-url
```

chỉ phục vụ Client/Internal/Admin và áp dụng chính sách che CV cho phía tuyển dụng. Candidate cần xem bản CV đã gắn với Application của chính mình, kể cả CV do Affiliate upload và đã được Candidate consent.

Mở Candidate scope cho endpoint hiện tại hoặc tạo endpoint Candidate riêng:

```http
GET /api/v1/candidates/applications/{applicationId}/cv-download-url
```

Quy tắc:

- Xác định Candidate từ access token.
- Application phải thuộc Candidate đó.
- Trả URL ký tạm thời tối đa 5–10 phút.
- Không phụ thuộc `affiliateReuseStatus`; đây là quyền xem lịch sử Application của chính Candidate.
- CV bị archive sau khi đã dùng vẫn phải xem được nếu storage object còn được giữ theo retention policy.
- Ghi audit cho mỗi lần cấp URL.
- Không trả storage key nội bộ hoặc URL dài hạn.

## D. Notification khi Interview và Offer thay đổi — ưu tiên rất cao

Các command tạo/dời/huỷ Interview và gửi Offer hiện chưa tạo notification cho Candidate. Candidate có thể bỏ lỡ lịch hoặc Offer nếu không tự mở ứng dụng.

MF-04 cần tạo notification trong cùng unit of work với mutation nghiệp vụ cho các sự kiện:

| Sự kiện | Người nhận | Loại gợi ý |
|---|---|---|
| Interview được lên lịch | Candidate | `INTERVIEW` |
| Interview được dời lịch | Candidate | `INTERVIEW` |
| Interview bị huỷ | Candidate | `INTERVIEW` |
| Offer được gửi | Candidate | `OFFER` |
| Offer bị Company thu hồi | Candidate | `OFFER` |
| Candidate phản hồi Offer | Company users phù hợp | `OFFER` |
| Candidate rút Application | Company users phù hợp; Affiliate chỉ nhận projection an toàn nếu có attribution | `APPLICATION_STATUS` |
| Company xác nhận không bắt đầu/đã bắt đầu | Candidate | `APPLICATION_STATUS` |

Quy tắc:

- Notification và mutation phải commit cùng transaction.
- Có kiểm tra/idempotency để retry không tạo thông báo trùng.
- `relatedEntityType` và `relatedEntityId` phải giúp FE điều hướng đúng Interview, Offer hoặc Application.
- Nội dung gửi Affiliate không chứa lịch/link phỏng vấn, lương, Offer hay lý do chi tiết.
- Chỉ tạo notification cho `app_user` còn hoạt động.

API đọc/đánh dấu notification là hạ tầng dùng chung, không bắt dev MF-04 tự viết nếu đã giao cho module shared. Nhưng MF-04 phải tạo đúng notification row cho các sự kiện do mình sở hữu.

## E. Candidate xem danh sách lịch phỏng vấn sắp tới — ưu tiên trung bình

API `GET /api/v1/interviews` đã có Candidate scope. Cần xác nhận và ghi rõ Swagger các filter phục vụ giao diện:

```text
status=SCHEDULED
fromDate=<utc>
toDate=<utc>
applicationId=<uuid>
page=1
pageSize=20
sortDirection=ASC
```

Nếu query chưa hỗ trợ sort tăng dần theo `scheduledAt`, bổ sung để dashboard lấy lịch gần nhất mà không tải toàn bộ.

Candidate response tối thiểu gồm:

- Job và Company.
- Vòng phỏng vấn.
- Thời gian, thời lượng, hình thức.
- Địa điểm hoặc meeting link.
- Trạng thái công khai.

Không trả participant nội bộ, feedback và result nội bộ trước khi policy cho phép.

## F. Candidate xem Offer cần phản hồi — ưu tiên trung bình

API `GET /api/v1/offers` đã có Candidate scope. Cần bảo đảm hỗ trợ:

```text
status=SENT
applicationId=<uuid>
page=1
pageSize=20
```

Response cho Candidate cần có:

- Mức lương, tiền tệ.
- Ngày bắt đầu.
- Hạn phản hồi.
- Tài liệu Offer qua URL tạm thời nếu file nằm trong private storage.
- `concurrencyToken`.
- `canRespond` do server tính.

Không trả Offer `DRAFT` hoặc bản đã bị thu hồi mà Candidate chưa từng được nhận.

## 4. Điểm phối hợp với MF-02 và frontend

### 4.1 Không tạo Application detail thứ ba có dữ liệu mâu thuẫn

Hiện MF-02 có endpoint detail cơ bản, MF-04 có detail tuyển dụng đầy đủ. Hai nhóm cần chốt một contract Candidate chính:

- Khuyến nghị: Candidate list tiếp tục dùng MF-02; Candidate detail chuyển sang projection MF-04.
- Không để FE ghép nhiều response rồi tự quyết định trạng thái cuối.
- MF-04 là nguồn sự thật cho lifecycle sau `SUBMITTED`.

### 4.2 Không trả raw AI diagnostics cho Candidate

Nếu trang detail cần AI, chỉ trả trạng thái và kết quả đã được product phê duyệt. Retry AI và lỗi dispatcher không phải hành động của Candidate.

### 4.3 Notification reader là hạ tầng chung

MF-04 tạo notification đúng transaction. Module shared cung cấp:

```http
GET  /api/v1/notifications
GET  /api/v1/notifications/unread-count
POST /api/v1/notifications/{notificationId}/read
POST /api/v1/notifications/read-all
```

## 5. Yêu cầu bảo mật và transaction

- Lấy `userId` và role từ JWT; không nhận `candidateId`/`companyId` từ body để cấp quyền.
- Candidate chỉ xem và mutation tài nguyên thuộc Candidate profile gắn với `app_user` đang đăng nhập.
- Mọi mutation dùng `concurrencyToken`; thiếu token trả `400`, token cũ trả `409`.
- Interview/Offer/Application liên quan phải được cập nhật trong cùng transaction.
- Mọi thay đổi trạng thái ghi status history và audit.
- Signed URL phải ngắn hạn và không log URL đầy đủ chứa chữ ký.
- Endpoint list phân trang tại database.
- Lỗi ownership trả `403` hoặc `404` theo policy thống nhất; không để thành `500`.
- DTO Candidate phải được tạo ở backend; không gửi DTO nội bộ rồi yêu cầu FE tự ẩn trường.

## 6. Thứ tự triển khai đề xuất

1. **Candidate Application detail projection** có `concurrencyToken` và `allowedActions`.
2. **Candidate timeline projection**.
3. **Candidate Application CV download URL**.
4. **Notification cho Interview/Offer/Application**.
5. Xác nhận filter/sort cho danh sách Interview và Offer của Candidate.
6. Phối hợp FE gắn rút hồ sơ, lịch phỏng vấn và phản hồi Offer.

## 7. Kịch bản test tay bàn giao

1. Candidate A không xem/rút Application của Candidate B.
2. Candidate xem Application của mình và nhận đúng `allowedActions`.
3. Candidate rút Application đang `INTERVIEW`: Application thành `WITHDRAWN`, Interview đang chờ bị huỷ, audit/history đầy đủ.
4. Candidate rút Application có Offer `SENT`: Offer bị thu hồi và Company nhận notification.
5. Candidate xem timeline không thấy feedback hoặc actor nội bộ.
6. Candidate xem đúng CV đã nộp kể cả CV do Affiliate gửi và Candidate đã consent.
7. Company lên lịch/dời/huỷ Interview: Candidate nhận đúng một notification cho mỗi sự kiện.
8. Company gửi/thu hồi Offer: Candidate nhận notification và chỉ phản hồi Offer hợp lệ.
9. Candidate chấp nhận Offer với token hiện tại thành công; gửi lại token cũ nhận `409`.
10. Offer hết hạn tự động: Candidate thấy trạng thái mới và notification, không thể phản hồi Offer đã hết hạn.

Tài liệu mô tả MF-04 đầy đủ của dự án nằm tại `HRConnect/docs/mf04-phong-van-offer-placement.md`. Tài liệu này chỉ tập trung vào backend cần thiết để hoàn thiện trải nghiệm Candidate.
